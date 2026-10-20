import { NextRequest, NextResponse } from "next/server";
import { manilaDayStart, manilaDayEnd } from "@/lib/datetime";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";

type TierRow = { id: string; label: string; tier_type: string; price: number; tickets: number; gross: number; discount: number; revenue: number };
type PerfRow = { id: string; label: string; datetime: string; venue: string; tickets: number; gross: number; discount: number; revenue: number; tiers: TierRow[] };
type ProdRow = { id: string; title: string; tickets: number; gross: number; discount: number; revenue: number; performances: PerfRow[] };

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * "Sold" = confirmed reservations only. Every production, show and ticket tier
 * is listed, with zeros when nothing sold yet. A reservation's discount is
 * shared across its ticket lines by their share of the price.
 *
 * GET /api/admin/sales-summary?production_id=<optional>&from=<date>&to=<date>
 * from/to filter on when the booking was made.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;

  const productionId = req.nextUrl.searchParams.get("production_id");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const db = createServiceClient();

  if (productionId && !canAccess(gate.access, productionId, "foh")) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }
  const scope = productionId ? [productionId] : accessibleProductionIds(gate.access, "foh");

  // Structure first, so shows and tiers with no sales still appear.
  let structure = db
    .from("productions")
    .select("id, title, performances(id, label, datetime, venue, ticket_tiers(id, label, tier_type, price))")
    .order("title", { ascending: true });
  if (scope) structure = structure.in("id", scope);
  const { data: productions, error: structError } = await structure;
  if (structError) return NextResponse.json({ error: structError.message }, { status: 500 });

  let query = db
    .from("reservations")
    .select(
      `id, total, discount_amount, booking_source, promo_uses, performance_id, production_id,
       reservation_items(quantity, unit_price, ticket_tier_id),
       promo_code:promo_codes(code)`
    )
    .eq("payment_status", "confirmed");
  if (scope) query = query.in("production_id", scope);
  if (from) query = query.gte("created_at", manilaDayStart(from));
  if (to) query = query.lte("created_at", manilaDayEnd(to));
  const { data: reservations, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const prodMap = new Map<string, ProdRow>();
  const perfMap = new Map<string, PerfRow>();
  const tierMap = new Map<string, TierRow>();
  for (const p of productions ?? []) {
    const row: ProdRow = { id: p.id, title: p.title, tickets: 0, gross: 0, discount: 0, revenue: 0, performances: [] };
    const perfs = [...(p.performances ?? [])].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    for (const perf of perfs) {
      const pr: PerfRow = { id: perf.id, label: perf.label, datetime: perf.datetime, venue: perf.venue, tickets: 0, gross: 0, discount: 0, revenue: 0, tiers: [] };
      const tiers = [...(perf.ticket_tiers ?? [])].sort((a, b) => Number(b.price) - Number(a.price) || a.label.localeCompare(b.label));
      for (const t of tiers) {
        const tr: TierRow = { id: t.id, label: t.label, tier_type: t.tier_type, price: Number(t.price), tickets: 0, gross: 0, discount: 0, revenue: 0 };
        pr.tiers.push(tr);
        tierMap.set(t.id, tr);
      }
      row.performances.push(pr);
      perfMap.set(perf.id, pr);
    }
    prodMap.set(p.id, row);
  }

  let totalRevenue = 0;
  let totalDiscount = 0;
  let totalTickets = 0;
  let online = 0;
  let walkIn = 0;
  const byPromo = new Map<string, { uses: number; discountGiven: number }>();

  for (const r of reservations ?? []) {
    totalRevenue += Number(r.total);
    totalDiscount += Number(r.discount_amount);
    if (r.booking_source === "admin_manual") walkIn += 1;
    else online += 1;

    const items = r.reservation_items ?? [];
    const gross = items.reduce((n, i) => n + Number(i.unit_price) * i.quantity, 0);
    const ticketCount = items.reduce((n, i) => n + i.quantity, 0);
    totalTickets += ticketCount;

    const prod = prodMap.get(r.production_id);
    const perf = perfMap.get(r.performance_id);
    for (const item of items) {
      const lineGross = Number(item.unit_price) * item.quantity;
      const share = gross > 0 ? lineGross / gross : 0;
      const lineDiscount = Number(r.discount_amount) * share;
      for (const target of [tierMap.get(item.ticket_tier_id), perf, prod]) {
        if (!target) continue;
        target.tickets += item.quantity;
        target.gross += lineGross;
        target.discount += lineDiscount;
        target.revenue += lineGross - lineDiscount;
      }
    }

    const promo = one(r.promo_code);
    if (promo) {
      // Usage counts tickets, not orders.
      const entry = byPromo.get(promo.code) ?? { uses: 0, discountGiven: 0 };
      entry.uses += (r.promo_uses as number | null) ?? ticketCount;
      entry.discountGiven += Number(r.discount_amount);
      byPromo.set(promo.code, entry);
    }
  }

  const fix = <T extends { gross: number; discount: number; revenue: number }>(o: T) => {
    o.gross = round(o.gross);
    o.discount = round(o.discount);
    o.revenue = round(o.revenue);
  };
  const out = [...prodMap.values()];
  for (const p of out) {
    fix(p);
    for (const pf of p.performances) {
      fix(pf);
      pf.tiers.forEach(fix);
    }
  }

  return NextResponse.json({
    totals: {
      revenue: round(totalRevenue),
      discountGiven: round(totalDiscount),
      ticketsSold: totalTickets,
      reservationsConfirmed: reservations?.length ?? 0,
      onlineBookings: online,
      walkInBookings: walkIn,
    },
    productions: out,
    byPromo: [...byPromo.entries()].map(([code, v]) => ({ code, uses: v.uses, discountGiven: round(v.discountGiven) })),
  });
}
