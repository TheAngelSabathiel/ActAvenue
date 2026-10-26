import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logScan } from "@/lib/scan-log";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";

// GET /api/checkin?q=<reference code or name>&performance_id=<id>
export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;
  const scope = accessibleProductionIds(gate.access, "foh");

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const performanceId = req.nextUrl.searchParams.get("performance_id");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const db = createServiceClient();

  // Two separate queries instead of a single .or() filter string: building
  // that string via interpolation breaks (or silently mismatches) if the
  // search term contains a comma or parenthesis, since PostgREST's or()
  // syntax treats those as structural characters.
  let refQuery = db
    .from("reservations")
    .select("*, reservation_items(*, ticket_tier:ticket_tiers(*))")
    .eq("reference_code", q.toUpperCase());
  let nameQuery = db
    .from("reservations")
    .select("*, reservation_items(*, ticket_tier:ticket_tiers(*))")
    .ilike("buyer_name", `%${q}%`);

  if (scope) {
    refQuery = refQuery.in("production_id", scope);
    nameQuery = nameQuery.in("production_id", scope);
  }
  if (performanceId) {
    refQuery = refQuery.eq("performance_id", performanceId);
    nameQuery = nameQuery.eq("performance_id", performanceId);
  }

  // A scanned ticket QR holds a ticket code (reference code plus a number).
  const { data: codeItem } = await db
    .from("reservation_items")
    .select("id, reservation_id")
    .eq("ticket_code", q.toUpperCase())
    .maybeSingle();
  let codeQuery = db
    .from("reservations")
    .select("*, reservation_items(*, ticket_tier:ticket_tiers(*))")
    .eq("id", codeItem?.reservation_id ?? "00000000-0000-0000-0000-000000000000");
  if (scope) codeQuery = codeQuery.in("production_id", scope);
  if (performanceId) codeQuery = codeQuery.eq("performance_id", performanceId);

  const [refResult, nameResult, codeResult] = await Promise.all([refQuery, nameQuery, codeQuery]);
  if (refResult.error) return NextResponse.json({ error: refResult.error.message }, { status: 500 });
  if (nameResult.error) return NextResponse.json({ error: nameResult.error.message }, { status: 500 });

  const seen = new Set<string>();
  const results = [...(codeResult.data ?? []), ...(refResult.data ?? []), ...(nameResult.data ?? [])].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return NextResponse.json({ results, matched_item_id: codeItem?.id ?? null });
}

// POST /api/checkin  { item_id, count? }
// Admits `count` people (default 1) against one ticket line. A line scans
// at most as many times as its quantity.
export async function POST(req: NextRequest) {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;

  const { item_id, count: rawCount } = await req.json();
  const count = Math.max(1, Math.floor(Number(rawCount) || 1));
  const db = createServiceClient();

  const { data: item } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(label)")
    .eq("id", item_id)
    .single();
  if (!item) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { data: reservation } = await db.from("reservations").select("*").eq("id", item.reservation_id).single();
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (!canAccess(gate.access, reservation.production_id, "foh")) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }
  if (reservation.payment_status !== "confirmed") {
    return NextResponse.json(
      { error: `Cannot check in - payment status is "${reservation.payment_status}", not confirmed.` },
      { status: 409 }
    );
  }

  const used = item.scans_used ?? 0;
  if (used >= item.quantity) {
    return NextResponse.json(
      { error: `Fully used. All ${item.quantity} scans of this ${item.ticket_tier.label} QR are done.` },
      { status: 409 }
    );
  }
  if (used + count > item.quantity) {
    return NextResponse.json(
      { error: `Only ${item.quantity - used} scan${item.quantity - used === 1 ? "" : "s"} left on this QR.` },
      { status: 409 }
    );
  }

  // Compare-and-set, so two doors scanning the same QR at once can't both pass the limit.
  const { data: updatedItem } = await db
    .from("reservation_items")
    .update({ scans_used: used + count })
    .eq("id", item_id)
    .eq("scans_used", used)
    .select()
    .maybeSingle();
  if (!updatedItem) {
    return NextResponse.json({ error: "This QR was just scanned somewhere else. Search again." }, { status: 409 });
  }

  const { data: all } = await db.from("reservation_items").select("quantity, scans_used").eq("reservation_id", reservation.id);
  const done = (all ?? []).every((i) => (i.scans_used ?? 0) >= i.quantity);
  const { data: updated } = await db
    .from("reservations")
    .update(done ? { checked_in: true, checked_in_at: new Date().toISOString() } : {})
    .eq("id", reservation.id)
    .select()
    .single();

  await logScan(db, {
    reservation_id: reservation.id,
    performance_id: reservation.performance_id,
    production_id: reservation.production_id,
    ticket_code: item.ticket_code ?? null,
    admitted: count,
    source: "manual",
    scanned_by: gate.access.userId,
  });

  return NextResponse.json({ reservation: updated ?? reservation, item: updatedItem, admitted: count });
}
