import { createClient } from "@/lib/supabase/server";
import { isTierDiscountActive } from "@/lib/pricing";
import type { ProductionWithPerformances, TicketTier } from "@/types/database";

export interface ProductionCreditWithActor {
  id: string;
  role_played: string;
  section: "artistic" | "production";
  credit_type: "writer" | "director" | "actor" | null;
  play_id: string | null;
  sort_order: number;
  profile: { id: string; display_name: string | null; photo_url: string | null };
}

export interface PublicPlay {
  id: string;
  title: string;
  sort_order: number;
}

export async function getProductionBySlug(
  slug: string
): Promise<(ProductionWithPerformances & { credits: ProductionCreditWithActor[]; plays: PublicPlay[] }) | null> {
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

  // Only credits whose profile is public and approved come back (RLS on
  // `profiles` enforces it), and discredited credits are hidden by the
  // credits policy. Order: hierarchy set by admin, then name as tie-break.
  const { data: creditsRaw } = await supabase
    .from("production_credits")
    .select("id, role_played, section, credit_type, play_id, sort_order, profile:profiles(id, display_name, photo_url)")
    .eq("production_id", production.id)
    .eq("is_discredited", false);

  const credits: ProductionCreditWithActor[] = (creditsRaw ?? [])
    .map((c) => ({
      id: c.id,
      role_played: c.role_played,
      section: c.section,
      credit_type: c.credit_type,
      play_id: c.play_id,
      sort_order: c.sort_order,
      profile: Array.isArray(c.profile) ? (c.profile[0] ?? null) : c.profile,
    }))
    .filter((c): c is ProductionCreditWithActor => c.profile !== null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (a.profile.display_name ?? "").localeCompare(b.profile.display_name ?? "")
    );

  const { data: plays } = await supabase
    .from("plays")
    .select("id, title, sort_order")
    .eq("production_id", production.id)
    .order("sort_order", { ascending: true });

  return { ...production, performances: performancesWithAvailability, credits, plays: plays ?? [] };
}
