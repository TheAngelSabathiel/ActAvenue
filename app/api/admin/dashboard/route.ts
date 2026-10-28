import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const round = (n: number) => Math.round(n * 100) / 100;
/** Manila calendar day (YYYY-MM-DD) of a timestamp. */
const manilaDay = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * GET /api/admin/dashboard?production_id=
 * Seats, sales by day, attendance and payment queue for one production.
 * Without production_id it returns just the list of productions to pick from.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;
  const db = createServiceClient();

  const scope = accessibleProductionIds(gate.access, "foh");
  let list = db.from("productions").select("id, title, status").order("created_at", { ascending: false });
  if (scope) list = list.in("id", scope);
  const { data: productions } = await list;

  const productionId = req.nextUrl.searchParams.get("production_id");
  if (!productionId) return NextResponse.json({ productions: productions ?? [] });
  if (!canAccess(gate.access, productionId, "foh")) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  const { data: production } = await db
    .from("productions")
    .select("id, title, performances(id, label, datetime, venue, ticket_tiers(id, label, quantity_available, quantity_held, price, pool_tier_id, pool_capped))")
    .eq("id", productionId)
    .single();
  if (!production) return NextResponse.json({ error: "Production not found." }, { status: 404 });

  const { data: reservations, error } = await db
    .from("reservations")
    .select("id, total, discount_amount, payment_status, created_at, performance_id, booking_source, promo_code:promo_codes(code), reservation_items(quantity, scans_used, ticket_tier_id)")
    .eq("production_id", productionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const status = { pending_review: 0, confirmed: 0, rejected: 0, expired: 0 } as Record<string, number>;
  const days = new Map<string, { tickets: number; revenue: number }>();
  const promos = new Map<string, { uses: number; discount: number }>();
  let online = 0;
  let walkIn = 0;

  type Agg = { sold: number; pending: number; revenue: number; admitted: number };
  const perf = new Map<string, Agg>();
  const tier = new Map<string, { sold: number; pending: number }>();
  const agg = (id: string) => perf.get(id) ?? { sold: 0, pending: 0, revenue: 0, admitted: 0 };

  for (const r of reservations ?? []) {
    status[r.payment_status] = (status[r.payment_status] ?? 0) + 1;
    const items = (r.reservation_items ?? []) as { quantity: number; scans_used: number | null; ticket_tier_id: string }[];
    const qty = items.reduce((n, i) => n + i.quantity, 0);
    const a = agg(r.performance_id);
    if (r.payment_status === "pending_review") {
      a.pending += qty;
      for (const i of items) {
        const t = tier.get(i.ticket_tier_id) ?? { sold: 0, pending: 0 };
        t.pending += i.quantity;
        tier.set(i.ticket_tier_id, t);
      }
    }
    if (r.payment_status === "confirmed") {
      a.sold += qty;
      a.revenue += Number(r.total);
      a.admitted += items.reduce((n, i) => n + Math.min(i.quantity, i.scans_used ?? 0), 0);
      for (const i of items) {
        const t = tier.get(i.ticket_tier_id) ?? { sold: 0, pending: 0 };
        t.sold += i.quantity;
        tier.set(i.ticket_tier_id, t);
      }
      const day = manilaDay(r.created_at);
      const d = days.get(day) ?? { tickets: 0, revenue: 0 };
      d.tickets += qty;
      d.revenue += Number(r.total);
      days.set(day, d);
      if (r.booking_source === "admin_manual") walkIn += qty;
      else online += qty;
      const code = one(r.promo_code)?.code;
      if (code) {
        const p = promos.get(code) ?? { uses: 0, discount: 0 };
        p.uses += qty;
        p.discount += Number(r.discount_amount);
        promos.set(code, p);
      }
    }
    perf.set(r.performance_id, a);
  }

  const performances = (production.performances ?? [])
    .slice()
    .sort((a: { datetime: string }, b: { datetime: string }) => a.datetime.localeCompare(b.datetime))
    .map((p: { id: string; label: string; datetime: string; venue: string; ticket_tiers: { id: string; label: string; quantity_available: number; price: number; pool_tier_id?: string | null; pool_capped?: boolean }[] }) => {
      const a = agg(p.id);
      // Linked tiers share their main tier's seats, so only unlinked tiers add to capacity.
      const capacity = p.ticket_tiers.filter((t) => !t.pool_tier_id).reduce((n, t) => n + t.quantity_available, 0);
      const started = new Date(p.datetime).getTime() <= now;
      return {
        id: p.id,
        label: p.label,
        datetime: p.datetime,
        venue: p.venue,
        capacity,
        sold: a.sold,
        pending: a.pending,
        remaining: Math.max(0, capacity - a.sold - a.pending),
        revenue: round(a.revenue),
        admitted: a.admitted,
        started,
        noShows: started ? Math.max(0, a.sold - a.admitted) : null,
        // Most expensive first, down to the cheapest.
        tiers: [...p.ticket_tiers].sort((x, y) => Number(y.price) - Number(x.price)).map((t) => ({
          label: t.label,
          capacity: t.pool_tier_id ? (t.pool_capped ? t.quantity_available : (p.ticket_tiers.find((x) => x.id === t.pool_tier_id)?.quantity_available ?? 0)) : t.quantity_available,
          sold: tier.get(t.id)?.sold ?? 0,
          pending: tier.get(t.id)?.pending ?? 0,
        })),
      };
    });

  const salesByDay = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, tickets: v.tickets, revenue: round(v.revenue) }));

  return NextResponse.json({
    productions: productions ?? [],
    production: { id: production.id, title: production.title },
    performances,
    salesByDay,
    status,
    totals: {
      revenue: round(performances.reduce((n: number, p: { revenue: number }) => n + p.revenue, 0)),
      sold: performances.reduce((n: number, p: { sold: number }) => n + p.sold, 0),
      pending: performances.reduce((n: number, p: { pending: number }) => n + p.pending, 0),
      capacity: performances.reduce((n: number, p: { capacity: number }) => n + p.capacity, 0),
      online,
      walkIn,
    },
    promos: [...promos.entries()].map(([code, v]) => ({ code, uses: v.uses, discount: round(v.discount) })).sort((a, b) => b.uses - a.uses),
  });
}
