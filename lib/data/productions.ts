import { createClient } from "@/lib/supabase/server";
import { isTierDiscountActive } from "@/lib/pricing";
import type { ProductionWithPerformances, TicketTier } from "@/types/database";

export interface ProductionCreditWithActor {
  id: string;
  role_played: string;
  profile: { id: string; display_name: string | null; photo_url: string | null };
}

export async function getProductionBySlug(
  slug: string
): Promise<(ProductionWithPerformances & { credits: ProductionCreditWithActor[] }) | null> {
  const supabase = await createClient();

  const { data: production } = await supabase
    .from("productions")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!production) return null;

  const { data: performances } = await supabase
    .from("performances")
    .select("*, ticket_tiers(*)")
    .eq("production_id", production.id)
    .order("datetime", { ascending: true });

  const performancesWithAvailability = (performances ?? []).map((perf) => ({
    ...perf,
    ticket_tiers: (perf.ticket_tiers ?? []).map((tier: TicketTier) => ({
      ...tier,
      remaining: tier.quantity_available - tier.quantity_held,
      discount_active: isTierDiscountActive(tier),
    })),
  }));

  // Only show credits for actors whose public profile is actually live -
  // an actor being cast doesn't mean they've opted into (or been approved
  // for) public display. RLS on `profiles` already enforces this for the
  // nested select; the inner join here just means unapproved/private
  // actors' credits come back with profile: null and get filtered out.
  const { data: creditsRaw } = await supabase
    .from("production_credits")
    .select("id, role_played, profile:profiles(id, display_name, photo_url)")
    .eq("production_id", production.id);

  const credits: ProductionCreditWithActor[] = (creditsRaw ?? [])
    .map((c) => ({
      id: c.id,
      role_played: c.role_played,
      profile: Array.isArray(c.profile) ? (c.profile[0] ?? null) : c.profile,
    }))
    .filter((c): c is ProductionCreditWithActor => c.profile !== null);

  return { ...production, performances: performancesWithAvailability, credits };
}
