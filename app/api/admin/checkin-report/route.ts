import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
/** Manila time of day rounded down to 15 minutes, e.g. "18:45". */
function slot(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  const m = Math.floor(d.getUTCMinutes() / 15) * 15;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * GET /api/admin/checkin-report            productions and shows to pick from
 * GET /api/admin/checkin-report?performance_id=   who admitted whom, and when
 * Managers and admins only.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("manager");
  if (gate.error) return gate.error;
  const db = createServiceClient();

  const performanceId = req.nextUrl.searchParams.get("performance_id");
  if (!performanceId) {
    const scope = accessibleProductionIds(gate.access, "manager");
    let q = db.from("productions").select("id, title, performances(id, label, datetime)").order("created_at", { ascending: false });
    if (scope) q = q.in("id", scope);
    const { data } = await q;
    return NextResponse.json({ productions: data ?? [] });
  }

  const { data: perf } = await db
    .from("performances")
    .select("id, label, datetime, venue, production_id")
    .eq("id", performanceId)
    .single();
  if (!perf) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  if (!canAccess(gate.access, perf.production_id, "manager")) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  const { data: logs, error } = await db
    .from("scan_log")
    .select("id, created_at, admitted, source, override, ticket_code, scanned_by, reservation:reservations(buyer_name, reference_code)")
    .eq("performance_id", performanceId)
    .order("created_at", { ascending: true });
  if (error) {
    const setup = /scan_log|schema cache|does not exist/i.test(error.message);
    return NextResponse.json(
      { error: setup ? "The scan log is not set up yet. Run supabase/migration-dashboard-mailing.sql in the Supabase SQL Editor." : error.message },
      { status: 500 }
    );
  }

  const staffIds = [...new Set((logs ?? []).map((l) => l.scanned_by).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (staffIds.length) {
    const { data: profiles } = await db.from("profiles").select("id, display_name").in("id", staffIds);
    for (const p of profiles ?? []) names.set(p.id, p.display_name ?? "Unnamed");
  }

  // Everyone admitted for this show, to show how many entered before logging began.
  const { data: res } = await db
    .from("reservations")
    .select("reservation_items(quantity, scans_used)")
    .eq("performance_id", performanceId)
    .eq("payment_status", "confirmed");
  let admittedTotal = 0;
  for (const r of res ?? []) for (const i of (r.reservation_items ?? []) as { quantity: number; scans_used: number | null }[]) admittedTotal += Math.min(i.quantity, i.scans_used ?? 0);

  const rows = (logs ?? []).map((l) => {
    const r = one(l.reservation);
    return {
      id: l.id,
      time: l.created_at,
      staff: l.scanned_by ? (names.get(l.scanned_by) ?? "Unnamed") : "Unknown",
      staffId: l.scanned_by,
      buyer: r?.buyer_name ?? "",
      reference: r?.reference_code ?? "",
      ticket: l.ticket_code ?? "",
      admitted: l.admitted,
      source: l.source,
      override: l.override,
    };
  });

  const byStaff = new Map<string, { id: string | null; name: string; scans: number; admitted: number; overrides: number; first: string; last: string }>();
  const slots = new Map<string, number>();
  for (const r of rows) {
    const key = r.staffId ?? "unknown";
    const s = byStaff.get(key) ?? { id: r.staffId, name: r.staff, scans: 0, admitted: 0, overrides: 0, first: r.time, last: r.time };
    s.scans += 1;
    s.admitted += r.admitted;
    if (r.override) s.overrides += 1;
    if (r.time < s.first) s.first = r.time;
    if (r.time > s.last) s.last = r.time;
    byStaff.set(key, s);
    const k = slot(r.time);
    slots.set(k, (slots.get(k) ?? 0) + r.admitted);
  }

  const loggedAdmitted = rows.reduce((n, r) => n + r.admitted, 0);
  return NextResponse.json({
    performance: { id: perf.id, label: perf.label, datetime: perf.datetime, venue: perf.venue },
    totals: {
      scans: rows.length,
      admitted: loggedAdmitted,
      door: rows.filter((r) => r.source === "scan").length,
      manual: rows.filter((r) => r.source === "manual").length,
      overrides: rows.filter((r) => r.override).length,
      admittedTotal,
      unlogged: Math.max(0, admittedTotal - loggedAdmitted),
    },
    byStaff: [...byStaff.values()].sort((a, b) => b.admitted - a.admitted),
    arrivals: [...slots.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, admitted]) => ({ time, admitted })),
    timeline: rows.slice().reverse(),
  });
}
