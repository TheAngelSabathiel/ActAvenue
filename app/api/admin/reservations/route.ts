import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;
  const ids = accessibleProductionIds(gate.access, "foh");
  const productionId = req.nextUrl.searchParams.get("production_id");
  if (productionId && !canAccess(gate.access, productionId, "foh")) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status"); // optional filter
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const db = createServiceClient();
  const performanceId = req.nextUrl.searchParams.get("performance_id");
  // Search text: name, email, phone, reference or order code. Characters that mean something in a filter are dropped.
  const q = (req.nextUrl.searchParams.get("q") ?? "").replace(/[%*,()"\\]/g, " ").trim().slice(0, 80);

  // Same filters for the list and for the counts on each status tab.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = <T extends { eq: any; in: any; or: any }>(query: T): T => {
    let x = query;
    if (productionId) x = x.eq("production_id", productionId);
    else if (ids) x = x.in("production_id", ids);
    if (performanceId) x = x.eq("performance_id", performanceId);
    if (q) {
      const like = `%${q}%`;
      x = x.or(
        ["buyer_name", "buyer_email", "buyer_phone", "reference_code", "order_code"].map((c) => `${c}.ilike.${like}`).join(",")
      );
    }
    return x;
  };

  let query = scoped(
    db
      .from("reservations")
      .select(
        "*, production:productions(title), performance:performances(label, datetime), reservation_items(*, ticket_tier:ticket_tiers(label, tier_type))",
        { count: "exact" }
      )
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("payment_status", status);
  }

  const STATUSES = ["pending_review", "confirmed", "rejected", "expired"] as const;
  const [{ data, error, count }, ...tabCounts] = await Promise.all([
    query,
    ...STATUSES.map((s) => scoped(db.from("reservations").select("id", { count: "exact", head: true })).eq("payment_status", s)),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tabTotals = Object.fromEntries(STATUSES.map((s, i) => [s, tabCounts[i].count ?? 0])) as Record<string, number>;
  tabTotals.all = STATUSES.reduce((n, s) => n + tabTotals[s], 0);

  // How many bookings share each row's order (for the "whole order" buttons).
  const codes = [...new Set((data ?? []).map((r) => r.order_code).filter(Boolean))] as string[];
  const counts = new Map<string, number>();
  if (codes.length) {
    const { data: siblings } = await db.from("reservations").select("order_code").in("order_code", codes);
    for (const s of siblings ?? []) counts.set(s.order_code, (counts.get(s.order_code) ?? 0) + 1);
  }
  const reservations = (data ?? []).map((r) => ({ ...r, order_count: r.order_code ? counts.get(r.order_code) ?? 1 : 1 }));

  return NextResponse.json({
    reservations,
    tabCounts: tabTotals,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 1,
    },
  });
}
