import { promoUsesForDiscount } from "@/lib/pricing";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";
import { releaseTicketTierHold } from "@/lib/inventory";
import { withRefresh } from "@/lib/refresh-public";

/**
 * Permanently deletes a reservation of any status (for test tickets and
 * cleanup). Seats it still holds (pending or confirmed) go back on sale, and
 * a promo use it consumed is given back. Its items are removed with it.
 */
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfReservation(id), "manager");
  if (gate.error) return gate.error;
  const db = createServiceClient();

  const { data: reservation } = await db.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  // Rejected and expired reservations already released their seats.
  if (["pending_review", "confirmed"].includes(reservation.payment_status)) {
    const { data: items } = await db.from("reservation_items").select("ticket_tier_id, quantity").eq("reservation_id", id);
    for (const item of items ?? []) {
      const { error } = await releaseTicketTierHold(db, item.ticket_tier_id, item.quantity);
      if (error) console.error(`Failed to release hold for tier ${item.ticket_tier_id}:`, error.message);
    }
  }

  const { error } = await db.from("reservations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (reservation.promo_code_id && reservation.discount_amount > 0) {
    const { data: promo } = await db
      .from("promo_codes")
      .select("times_used, discount_type, discount_value")
      .eq("id", reservation.promo_code_id)
      .maybeSingle();
    if (promo && promo.times_used > 0) {
      // Give back every use this booking consumed (one per ticket for fixed-amount codes).
      const back = Math.min(promo.times_used, (reservation.promo_uses ?? promoUsesForDiscount(promo, reservation.discount_amount)));
      await db.from("promo_codes").update({ times_used: promo.times_used - back }).eq("id", reservation.promo_code_id);
    }
  }

  return NextResponse.json({ ok: true });
}

export const DELETE = withRefresh(handleDELETE);
