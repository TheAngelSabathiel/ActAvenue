import type { createServiceClient } from "@/lib/supabase/service";

type Db = ReturnType<typeof createServiceClient>;

/**
 * Checks that `poolTierId` is a valid main tier for a tier on this show:
 * same show, not itself, not linked to another tier, and the tier has no
 * linked tiers of its own. Returns an error message, or null when fine.
 */
export async function checkPoolLink(db: Db, performanceId: string, tierId: string | null, poolTierId: string): Promise<string | null> {
  if (tierId && tierId === poolTierId) return "A tier can't share seats with itself.";
  const { data: main } = await db.from("ticket_tiers").select("id, performance_id, pool_tier_id, label").eq("id", poolTierId).maybeSingle();
  if (!main || main.performance_id !== performanceId) return "Pick a tier from the same show.";
  if (main.pool_tier_id) return `${main.label} already shares seats with another tier. Pick the main one.`;
  if (tierId) {
    const { count } = await db.from("ticket_tiers").select("id", { count: "exact", head: true }).eq("pool_tier_id", tierId);
    if (count && count > 0) return "Other tiers draw seats from this one. Unlink them first.";
  }
  return null;
}
