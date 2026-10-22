import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { isTierDiscountActive } from "@/lib/pricing";
import type { ProductionWithPerformances, TicketTier } from "@/types/database";

export interface ProductionCreditWithActor {
  id: string;
  role_played: string;
  section: "artistic" | "production";
  credit_type: "writer" | "director" | "actor" | "choreographer" | "dancer" | null;
  play_id: string | null;
  sort_order: number;
  profile: { id: string; display_name: string | null; photo_url: string | null; listed: boolean };
}

export interface PublicPlay {
  id: string;
  title: string;
  sort_order: number;
}

export async function getProductionBySlug(
  slug: string
): Promise<(ProductionWithPerformances & { credits: ProductionCreditWithActor[]; plays: PublicPlay[] }) | null> {
  const supabase = createPublicClient();

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

  // Anyone an admin credits is shown, whether or not they asked for a public
  // profile. `listed` says if they also have a public profile page to link
  // to. Discredited credits stay hidden. Order: hierarchy set by admin, then
  // name as tie-break.
  const { data: creditsRaw } = await createServiceClient()
    .from("production_credits")
    .select("id, role_played, section, credit_type, play_id, sort_order, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
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
      profile: (() => {
        const p = Array.isArray(c.profile) ? (c.profile[0] ?? null) : c.profile;
        return p
          ? { id: p.id, display_name: p.display_name, photo_url: p.photo_url, listed: !!(p.is_public && p.is_approved) }
          : null;
      })(),
    }))
    .filter((c): c is ProductionCreditWithActor => c.profile !== null)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (a.profile.display_name ?? "").localeCompare(b.profile.display_name ?? "")
    );

  const { data: playRows } = await supabase
    .from("production_plays")
    .select("sort_order, play:plays(id, title)")
    .eq("production_id", production.id)
    .order("sort_order", { ascending: true });

  const plays: PublicPlay[] = (playRows ?? [])
    .map((r) => {
      const play = Array.isArray(r.play) ? r.play[0] : r.play;
      return play ? { id: play.id as string, title: play.title as string, sort_order: r.sort_order as number } : null;
    })
    .filter((p): p is PublicPlay => p !== null);

  return { ...production, performances: performancesWithAvailability, credits, plays };
}
