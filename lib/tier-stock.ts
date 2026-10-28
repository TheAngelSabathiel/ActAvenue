import type { createServiceClient } from "@/lib/supabase/service";
import { tierRemaining, type StockTier } from "@/lib/tiers";

type Db = ReturnType<typeof createServiceClient>;

/** Seats left for one tier, counting the shared pool it belongs to. */
export async function remainingForTier(db: Db, tier: StockTier): Promise<number> {
  const rootId = tier.pool_tier_id ?? tier.id;
  const { data } = await db
    .from("ticket_tiers")
    .select("id, quantity_available, quantity_held, pool_tier_id, pool_capped")
    .or(`id.eq.${rootId},pool_tier_id.eq.${rootId}`);
  return tierRemaining(tier, (data ?? []) as StockTier[]);
}
