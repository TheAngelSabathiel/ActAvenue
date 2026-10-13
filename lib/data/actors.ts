import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MEMBER_ROLES } from "@/lib/member-roles";
import type { ActorPhoto, Profile, ProductionCredit } from "@/types/database";

export async function listPublicActors(): Promise<Profile[]> {
  const supabase = await createClient();
  // is_approved required alongside is_public - see the moderation section
  // in schema.sql. RLS enforces this too; the explicit filters here are
  // just for clarity/query efficiency, not the actual security boundary.
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("role", [...MEMBER_ROLES])
    .eq("is_public", true)
    .eq("is_approved", true)
    .order("display_name", { ascending: true });
  return data ?? [];
}

export interface ActorProfileWithDetails extends Profile {
  actor_photos: ActorPhoto[];
  production_credits: (ProductionCredit & { production: { title: string; slug: string; status: "published" | "closed" } })[];
}

export async function getPublicActor(id: string): Promise<ActorProfileWithDetails | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .in("role", [...MEMBER_ROLES])
    .eq("is_public", true)
    .eq("is_approved", true)
    .maybeSingle();

  if (!profile) return null;

  const { data: photos } = await supabase
    .from("actor_photos")
    .select("*")
    .eq("profile_id", id)
    .order("sort_order", { ascending: true });

  // Draft productions are never shown on a public profile. Read with the
  // service client so visitors and signed-in users see the same list.
  const { data: credits } = await createServiceClient()
    .from("production_credits")
    .select("*, production:productions(title, slug, status)")
    .eq("profile_id", id)
    .eq("is_discredited", false)
    .order("created_at", { ascending: false });

  const visible = (credits ?? [])
    .map((c) => ({ ...c, production: Array.isArray(c.production) ? (c.production[0] ?? null) : c.production }))
    .filter((c) => c.production && c.production.status !== "draft");

  return { ...profile, actor_photos: photos ?? [], production_credits: visible as ActorProfileWithDetails["production_credits"] };
}
