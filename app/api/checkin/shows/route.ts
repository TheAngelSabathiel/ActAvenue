import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, requireAnyAccess } from "@/lib/admin-auth";

/** Shows a scanner can pick from: recent and upcoming, with admitted counts. */
export async function GET() {
  const gate = await requireAnyAccess("scanner");
  if (gate.error) return gate.error;
  const scope = accessibleProductionIds(gate.access, "scanner");
  const db = createServiceClient();

  let q = db
    .from("performances")
    .select("id, label, datetime, venue, production_id, production:productions(title)")
    .gte("datetime", new Date(Date.now() - 12 * 3600_000).toISOString())
    .order("datetime", { ascending: true })
    .limit(30);
  if (scope) q = q.in("production_id", scope);
  const { data: perfs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (perfs ?? []).map((p) => p.id);
  const totals = new Map<string, { total: number; admitted: number }>();
  if (ids.length) {
    const { data: rows } = await db
      .from("reservations")
      .select("performance_id, reservation_items(quantity, scans_used)")
      .in("performance_id", ids)
      .eq("payment_status", "confirmed");
    for (const r of rows ?? []) {
      const t = totals.get(r.performance_id) ?? { total: 0, admitted: 0 };
      for (const i of r.reservation_items ?? []) {
        t.total += i.quantity;
        t.admitted += Math.min(i.quantity, i.scans_used ?? 0);
      }
      totals.set(r.performance_id, t);
    }
  }

  const shows = (perfs ?? []).map((p) => {
    const prod = Array.isArray(p.production) ? p.production[0] : p.production;
    return { id: p.id, label: p.label, datetime: p.datetime, venue: p.venue, production: prod?.title ?? "", ...(totals.get(p.id) ?? { total: 0, admitted: 0 }) };
  });
  return NextResponse.json({ shows });
}
