import { NextRequest, NextResponse } from "next/server";
import { manilaDayStart, manilaDayEnd, formatDate } from "@/lib/datetime";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

/**
 * "Sold" = confirmed reservations only (pending/rejected/expired don't count
 * as revenue). Admin-manual walk-ins are included since a confirmed walk-in
 * is a real sale - booking_source is broken out separately so it's visible.
 *
 * GET /api/admin/sales-summary?production_id=<optional>&from=<ISO date>&to=<ISO date>
 * from/to filter on reservations.created_at (when the booking was made),
 * inclusive of the whole "to" day.
 */
export async function GET(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const productionId = req.nextUrl.searchParams.get("production_id");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const db = createServiceClient();

  let query = db
    .from("reservations")
    .select(
      `id, total, discount_amount, booking_source, promo_code_id, created_at,
       production:productions(id, title),
       performance:performances(id, label, datetime),
       reservation_items(quantity, unit_price, ticket_tier:ticket_tiers(id, label)),
       promo_code:promo_codes(code)`
    )
    .eq("payment_status", "confirmed");

  if (productionId) query = query.eq("production_id", productionId);
  if (from) query = query.gte("created_at", manilaDayStart(from));
  if (to) {
    // Make "to" inclusive of the entire day rather than midnight-exclusive.
    query = query.lte("created_at", manilaDayEnd(to));
  }

  const { data: reservations, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let totalRevenue = 0;
  let totalDiscount = 0;
  let totalTicketsSold = 0;
  let onlineCount = 0;
  let walkInCount = 0;

  const byProduction = new Map<string, { title: string; revenue: number; tickets: number }>();
  const byPerformance = new Map<string, { label: string; production: string; revenue: number; tickets: number }>();
  const byTier = new Map<string, { label: string; revenue: number; tickets: number }>();
  const byPromo = new Map<string, { uses: number; discountGiven: number }>();

  for (const r of reservations ?? []) {
    totalRevenue += r.total;
    totalDiscount += r.discount_amount;
    if (r.booking_source === "admin_manual") walkInCount += 1;
    else onlineCount += 1;

    const production = Array.isArray(r.production) ? r.production[0] : r.production;
    const performance = Array.isArray(r.performance) ? r.performance[0] : r.performance;
    const promoCode = Array.isArray(r.promo_code) ? r.promo_code[0] : r.promo_code;

    if (production) {
      const key = production.id;
      const entry = byProduction.get(key) ?? { title: production.title, revenue: 0, tickets: 0 };
      entry.revenue += r.total;
      byProduction.set(key, entry);
    }

    if (performance && production) {
      const key = performance.id;
      const entry =
        byPerformance.get(key) ??
        {
          label: `${performance.label} (${formatDate(performance.datetime)})`,
          production: production.title,
          revenue: 0,
          tickets: 0,
        };
      entry.revenue += r.total;
      byPerformance.set(key, entry);
    }

    // Proportionally allocate this reservation's discount across its line
    // items by revenue share, so byTier revenue is net (and reconciles
    // with totals.revenue) instead of gross unit_price × quantity. This is
    // an allocation, not a stored fact - discounts apply at the reservation
    // level, not per line item - but it's the standard way to attribute an
    // order-level discount down to line items for reporting.
    const items = r.reservation_items ?? [];
    const reservationGrossSubtotal = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );

    for (const item of items) {
      const tier = Array.isArray(item.ticket_tier) ? item.ticket_tier[0] : item.ticket_tier;
      totalTicketsSold += item.quantity;

      if (production) {
        const entry = byProduction.get(production.id);
        if (entry) entry.tickets += item.quantity;
      }
      if (performance) {
        const entry = byPerformance.get(performance.id);
        if (entry) entry.tickets += item.quantity;
      }
      if (tier) {
        const grossItemRevenue = item.unit_price * item.quantity;
        const itemShare = reservationGrossSubtotal > 0 ? grossItemRevenue / reservationGrossSubtotal : 0;
        const netItemRevenue = grossItemRevenue - r.discount_amount * itemShare;

        const key = tier.id;
        const entry = byTier.get(key) ?? { label: tier.label, revenue: 0, tickets: 0 };
        entry.revenue += netItemRevenue;
        entry.tickets += item.quantity;
        byTier.set(key, entry);
      }
    }

    if (promoCode) {
      const entry = byPromo.get(promoCode.code) ?? { uses: 0, discountGiven: 0 };
      entry.uses += 1;
      entry.discountGiven += r.discount_amount;
      byPromo.set(promoCode.code, entry);
    }
  }

  return NextResponse.json({
    totals: {
      revenue: totalRevenue,
      discountGiven: totalDiscount,
      ticketsSold: totalTicketsSold,
      reservationsConfirmed: reservations?.length ?? 0,
      onlineBookings: onlineCount,
      walkInBookings: walkInCount,
    },
    byProduction: Array.from(byProduction.values()),
    byPerformance: Array.from(byPerformance.values()),
    byTier: Array.from(byTier.values()),
    byPromo: Array.from(byPromo.entries()).map(([code, v]) => ({ code, ...v })),
  });
}
