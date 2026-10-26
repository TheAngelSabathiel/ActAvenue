import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canAccess, requireAnyAccess } from "@/lib/admin-auth";
import { inScanWindow, parseScanned } from "@/lib/ticket-code";
import { logScan } from "@/lib/scan-log";
import { formatDateTime } from "@/lib/datetime";

type Line = { id: string; quantity: number; scans_used: number | null; ticket_tier: { label: string } | { label: string }[] | null };
const label = (l: Line) => (Array.isArray(l.ticket_tier) ? l.ticket_tier[0]?.label : l.ticket_tier?.label) ?? "Ticket";

const fail = (message: string, extra: Record<string, unknown> = {}, httpStatus = 200) =>
  NextResponse.json({ status: "error", message, ...extra }, { status: httpStatus });

/** GET ?code= : which show a scanned ticket belongs to (used when a ticket link is opened). */
export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("scanner");
  if (gate.error) return gate.error;
  const code = parseScanned(req.nextUrl.searchParams.get("code") ?? "");
  const db = createServiceClient();
  const { data: item } = await db
    .from("reservation_items")
    .select("reservation:reservations(performance_id, production_id)")
    .eq("ticket_code", code)
    .maybeSingle();
  const r = Array.isArray(item?.reservation) ? item?.reservation[0] : item?.reservation;
  if (!r || !canAccess(gate.access, r.production_id, "scanner")) return NextResponse.json({ performance_id: null });
  return NextResponse.json({ performance_id: r.performance_id });
}

/**
 * POST { code, performance_id, mode: "all" | "one" | "ask", override? }
 * Admits people against a scanned ticket. Same show only, inside the scan
 * window (1 hour before to 3 hours after the show starts). Managers and
 * admins can override the window. Reads new links, ticket codes and the
 * bare reference codes on QRs sent earlier.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAnyAccess("scanner");
  if (gate.error) return gate.error;
  const body = await req.json().catch(() => ({}));
  const code = parseScanned(String(body.code ?? ""));
  const mode = body.mode === "one" ? "one" : body.mode === "ask" ? "ask" : "all";
  if (!code) return fail("Could not read that code.");

  const db = createServiceClient();
  const select = "id, reference_code, buyer_name, payment_status, production_id, performance_id, performance:performances(label, datetime)";

  // New QRs hold a ticket code. Old QRs hold the reference code of the whole booking.
  const { data: byCode } = await db.from("reservation_items").select("reservation_id").eq("ticket_code", code).maybeSingle();
  let reservation: {
    id: string; reference_code: string; buyer_name: string; payment_status: string; production_id: string; performance_id: string;
    performance: { label: string; datetime: string } | { label: string; datetime: string }[] | null;
  } | null = null;
  if (byCode) {
    reservation = (await db.from("reservations").select(select).eq("id", byCode.reservation_id).maybeSingle()).data;
  } else {
    reservation = (await db.from("reservations").select(select).eq("reference_code", code).maybeSingle()).data;
  }
  if (!reservation) return fail("Ticket not recognized.", { code });
  if (!canAccess(gate.access, reservation.production_id, "scanner")) {
    return fail("This ticket is for a production you are not assigned to.", { code });
  }
  const perf = Array.isArray(reservation.performance) ? reservation.performance[0] : reservation.performance;

  if (reservation.payment_status !== "confirmed") {
    return fail(`Not valid. Payment status is "${reservation.payment_status}".`, { buyer: reservation.buyer_name, code });
  }
  if (body.performance_id && reservation.performance_id !== body.performance_id) {
    return fail(`Wrong show. This ticket is for ${perf?.label ?? "another show"}${perf ? `, ${formatDateTime(perf.datetime)}` : ""}.`, { buyer: reservation.buyer_name, code, kind: "wrong_show" });
  }
  if (perf) {
    const w = inScanWindow(perf.datetime);
    if (!w.ok && !(body.override && canAccess(gate.access, reservation.production_id, "manager"))) {
      return fail(
        Date.now() < w.opensAt
          ? `Too early. Scanning opens 1 hour before the show (${formatDateTime(new Date(w.opensAt).toISOString())}).`
          : "Scanning closed 3 hours after the show started.",
        { buyer: reservation.buyer_name, code, kind: "outside_window", canOverride: canAccess(gate.access, reservation.production_id, "manager") }
      );
    }
  }

  const { data: all } = await db
    .from("reservation_items")
    .select("id, quantity, scans_used, ticket_code, ticket_tier:ticket_tiers(label)")
    .eq("reservation_id", reservation.id)
    .order("id", { ascending: true });
  let lines = (all ?? []) as (Line & { ticket_code: string | null })[];
  if (byCode) lines = lines.filter((l) => l.ticket_code === code);

  const left = (l: Line) => l.quantity - (l.scans_used ?? 0);
  const remaining = lines.reduce((n, l) => n + Math.max(0, left(l)), 0);
  const quantity = lines.reduce((n, l) => n + l.quantity, 0);
  const summary = () => lines.map((l) => ({ label: label(l), used: l.scans_used ?? 0, quantity: l.quantity }));

  if (remaining <= 0) {
    return fail(`Already fully used. All ${quantity} admitted.`, { buyer: reservation.buyer_name, code, kind: "used", tickets: summary() });
  }
  if (mode === "ask" && remaining > 1) {
    return NextResponse.json({ status: "choose", buyer: reservation.buyer_name, code, remaining, quantity, tickets: summary() });
  }

  let toAdmit = mode === "one" ? 1 : remaining;
  let admitted = 0;
  for (const l of lines) {
    if (toAdmit <= 0) break;
    const take = Math.min(toAdmit, Math.max(0, left(l)));
    if (take <= 0) continue;
    // Compare-and-set, so two phones scanning at once can't pass the limit.
    const { data: ok } = await db
      .from("reservation_items")
      .update({ scans_used: (l.scans_used ?? 0) + take })
      .eq("id", l.id)
      .eq("scans_used", l.scans_used ?? 0)
      .select("id")
      .maybeSingle();
    if (!ok) {
      if (admitted > 0) break;
      return fail("This ticket was just scanned on another phone. Scan again.", { buyer: reservation.buyer_name, code });
    }
    l.scans_used = (l.scans_used ?? 0) + take;
    admitted += take;
    toAdmit -= take;
  }

  const { data: every } = await db.from("reservation_items").select("quantity, scans_used").eq("reservation_id", reservation.id);
  if ((every ?? []).every((i) => (i.scans_used ?? 0) >= i.quantity)) {
    await db.from("reservations").update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("id", reservation.id);
  }

  if (admitted > 0) {
    await logScan(db, {
      reservation_id: reservation.id,
      performance_id: reservation.performance_id,
      production_id: reservation.production_id,
      ticket_code: code,
      admitted,
      source: "scan",
      override: !!body.override && !!perf && !inScanWindow(perf.datetime).ok,
      scanned_by: gate.access.userId,
    });
  }

  return NextResponse.json({
    status: "admitted",
    buyer: reservation.buyer_name,
    code,
    admitted,
    remaining: remaining - admitted,
    quantity,
    tickets: summary(),
  });
}
