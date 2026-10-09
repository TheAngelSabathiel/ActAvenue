import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

// GET /api/checkin?q=<reference code or name>&performance_id=<id>
export async function GET(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

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

  if (performanceId) {
    refQuery = refQuery.eq("performance_id", performanceId);
    nameQuery = nameQuery.eq("performance_id", performanceId);
  }

  const [refResult, nameResult] = await Promise.all([refQuery, nameQuery]);
  if (refResult.error) return NextResponse.json({ error: refResult.error.message }, { status: 500 });
  if (nameResult.error) return NextResponse.json({ error: nameResult.error.message }, { status: 500 });

  const seen = new Set<string>();
  const results = [...(refResult.data ?? []), ...(nameResult.data ?? [])].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return NextResponse.json({ results });
}

// POST /api/checkin  { reservation_id }
export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { reservation_id } = await req.json();
  const db = createServiceClient();

  const { data: reservation } = await db
    .from("reservations")
    .select("*")
    .eq("id", reservation_id)
    .single();

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }
  if (reservation.payment_status !== "confirmed") {
    return NextResponse.json(
      { error: `Cannot check in - payment status is "${reservation.payment_status}", not confirmed.` },
      { status: 409 }
    );
  }
  if (reservation.checked_in) {
    return NextResponse.json(
      { error: `Already checked in at ${reservation.checked_in_at}.` },
      { status: 409 }
    );
  }

  const { data: updated, error } = await db
    .from("reservations")
    .update({ checked_in: true, checked_in_at: new Date().toISOString() })
    .eq("id", reservation_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reservation: updated });
}
