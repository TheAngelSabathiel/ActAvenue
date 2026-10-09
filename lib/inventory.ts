import type { createServiceClient } from "@/lib/supabase/service";
import type { PromoCode, TicketTier } from "@/types/database";

type Db = ReturnType<typeof createServiceClient>;

/**
 * Atomically checks availability and increments quantity_held in a single
 * DB statement (see hold_ticket_tier in supabase/schema.sql) - this is what
 * actually closes the race two concurrent buyers could otherwise hit over
 * the last seat. On failure, error.message contains 'insufficient_availability'
 * or 'ticket_tier_not_found'.
 */
export async function holdTicketTier(db: Db, tierId: string, quantity: number) {
  return db.rpc("hold_ticket_tier", { p_tier_id: tierId, p_quantity: quantity }) as unknown as Promise<{
    data: TicketTier | null;
    error: { message: string } | null;
  }>;
}

/** Atomically releases a hold (floors at 0). */
export async function releaseTicketTierHold(db: Db, tierId: string, quantity: number) {
  return db.rpc("release_ticket_tier_hold", { p_tier_id: tierId, p_quantity: quantity }) as unknown as Promise<{
    data: TicketTier | null;
    error: { message: string } | null;
  }>;
}

/**
 * Releases holds for a batch of {tierId, quantity} pairs - used as a
 * compensating rollback when a multi-item checkout partially succeeds
 * (some tiers held, then a later one fails or the reservation insert fails).
 * Best-effort: logs but doesn't throw, since we're already in an error path.
 */
export async function releaseTicketTierHolds(db: Db, holds: { tierId: string; quantity: number }[]) {
  for (const h of holds) {
    const { error } = await releaseTicketTierHold(db, h.tierId, h.quantity);
    if (error) console.error(`Rollback release failed for tier ${h.tierId}:`, error.message);
  }
}

/**
 * Atomically increments a promo code's usage and enforces max_uses at
 * commit time. On failure, error.message contains 'promo_max_uses_reached'
 * or 'promo_not_found'.
 */
export async function incrementPromoUsage(db: Db, promoId: string) {
  return db.rpc("increment_promo_usage", { p_promo_id: promoId }) as unknown as Promise<{
    data: PromoCode | null;
    error: { message: string } | null;
  }>;
}
