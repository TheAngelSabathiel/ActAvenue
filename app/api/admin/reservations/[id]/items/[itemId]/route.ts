import { remainingForTier } from "@/lib/tier-stock";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";
import { holdTicketTier, releaseTicketTierHold } from "@/lib/inventory";
import { isTransferred } from "@/lib/transfer";
import { ensureTicketQrs } from "@/lib/tickets";
import { calculatePricing, eligibleTicketCount } from "@/lib/pricing";
import type { PromoCode, TicketTier } from "@/types/database";
import { sendQuantityChangedEmail } from "@/lib/email/send";
import { withRefresh } from "@/lib/refresh-public";

/** Change the quantity on one ticket line. Adjusts availability and emails the buyer. */
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const gate = await requireProduction(await productionOfReservation(id), "foh");
  if (gate.error) return gate.error;
  const quantity = Math.floor(Number((await req.json()).quantity));
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: reservation } = await db
    .from("reservations")
    .select("*, production:productions(*), performance:performances(*)")
    .eq("id", id)
    .single();
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (reservation.payment_status === "rejected" || reservation.payment_status === "expired" || isTransferred(reservation.rejection_reason)) {
    return NextResponse.json({ error: "This booking is no longer active." }, { status: 409 });
  }

  const { data: item } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("id", itemId)
    .eq("reservation_id", id)
    .single();
  if (!item) return NextResponse.json({ error: "Ticket line not found" }, { status: 404 });

  const from = item.quantity as number;
  if (quantity === from) return NextResponse.json({ ok: true, unchanged: true });
  if (quantity < (item.scans_used ?? 0)) {
    return NextResponse.json({ error: `${item.scans_used} already scanned at the door. Quantity can't go below that.` }, { status: 409 });
  }

  // A booking with a promo code keeps the code across the whole order. Work out
  // the new discount before touching anything, so a code that can't cover the
  // extra tickets stops the change cleanly.
  const { data: allItems } = await db.from("reservation_items").select("id, quantity, unit_price, ticket_tier:ticket_tiers(*)").eq("reservation_id", id);
  let promoPlan: { promo: PromoCode; discount: number; uses: number; ownUses: number } | null = null;
  if (reservation.promo_code_id && Number(reservation.discount_amount) > 0) {
    const { data: promo } = await db.from("promo_codes").select("*").eq("id", reservation.promo_code_id).maybeSingle();
    if (promo) {
      const ownUses = (reservation.promo_uses as number | null) ?? 0;
      const lines = (allItems ?? []).map((i) => ({
        ticket_tier: ({ ...(Array.isArray(i.ticket_tier) ? i.ticket_tier[0] : i.ticket_tier), price: Number(i.unit_price) }) as TicketTier,
        quantity: i.id === itemId ? quantity : i.quantity,
      }));
      const bookedAt = new Date(reservation.created_at);
      const pricing = calculatePricing(lines, { ...promo, times_used: Math.max(0, promo.times_used - ownUses) } as PromoCode, reservation.production_id, bookedAt);
      const wanted = eligibleTicketCount(lines, promo as PromoCode, bookedAt);
      if (quantity > from && pricing.promoUses < wanted) {
        return NextResponse.json(
          {
            code: "promo_cannot_cover",
            error: `The promo code ${promo.code} can't cover all ${wanted} tickets (${pricing.promoUses} covered). Ask the customer to make a new registration for the extra tickets, or add a new order manually.`,
          },
          { status: 409 }
        );
      }
      promoPlan = { promo: promo as PromoCode, discount: pricing.discountAmount, uses: pricing.promoUses, ownUses };
    }
  }

  // Availability first. Nothing else changes if the show can't take more.
  const diff = quantity - from;
  if (diff > 0) {
    const { error } = await holdTicketTier(db, item.ticket_tier_id, diff);
    if (error) {
      const message = error.message.includes("insufficient_availability")
        ? `Only ${await remainingForTier(db, item.ticket_tier)} left for ${item.ticket_tier.label} on this show.`
        : error.message;
      return NextResponse.json({ error: message }, { status: 409 });
    }
  } else {
    const { error } = await releaseTicketTierHold(db, item.ticket_tier_id, -diff);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: updateError } = await db.from("reservation_items").update({ quantity }).eq("id", itemId);
  if (updateError) {
    if (diff > 0) await releaseTicketTierHold(db, item.ticket_tier_id, diff);
    else await holdTicketTier(db, item.ticket_tier_id, -diff);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Keep the order totals in line with the new quantities.
  const { data: all } = await db.from("reservation_items").select("quantity, unit_price").eq("reservation_id", id);
  const subtotal = (all ?? []).reduce((n, i) => n + i.quantity * Number(i.unit_price), 0);
  const discount = promoPlan ? promoPlan.discount : Number(reservation.discount_amount ?? 0);
  const total = Math.max(0, subtotal - discount);
  const { data: updated } = await db
    .from("reservations")
    .update({ subtotal, total, discount_amount: discount, ...(promoPlan ? { promo_uses: promoPlan.uses } : {}) })
    .eq("id", id)
    .select()
    .single();

  // Promo uses follow the tickets: one per discounted ticket.
  if (promoPlan) {
    const delta = promoPlan.uses - promoPlan.ownUses;
    if (delta !== 0) {
      const { data: fresh } = await db.from("promo_codes").select("times_used").eq("id", promoPlan.promo.id).single();
      if (fresh) {
        await db.from("promo_codes").update({ times_used: Math.max(0, fresh.times_used + delta) }).eq("id", promoPlan.promo.id);
      }
    }
  }

  // The reservation is no longer fully admitted if the quantity went up.
  if (updated?.checked_in && diff > 0) {
    await db.from("reservations").update({ checked_in: false, checked_in_at: null }).eq("id", id);
  }

  let emailed = false;
  if (reservation.payment_status === "confirmed" && reservation.buyer_email) {
    try {
      const items = await ensureTicketQrs(db, id, reservation.reference_code);
      await sendQuantityChangedEmail(
        { reservation: updated ?? reservation, production: reservation.production, performance: reservation.performance, items },
        { tier: item.ticket_tier.label, from, to: quantity }
      );
      emailed = true;
    } catch (err) {
      console.error("Failed to send quantity-change email:", err);
    }
  }

  return NextResponse.json({ ok: true, emailed });
}

export const PATCH = withRefresh(handlePATCH);
