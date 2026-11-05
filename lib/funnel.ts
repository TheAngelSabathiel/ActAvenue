import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type FunnelEvent = "visit" | "production_view" | "cart_started" | "checkout_submitted";

/** Signed-in staff are left out so testing the site does not inflate the numbers. */
export async function isStaffViewer(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return !!profile && ["admin", "organizer"].includes(profile.role);
  } catch {
    return false;
  }
}

/** Records one funnel step. Never throws and never slows or breaks a booking. */
export async function logFunnel(event: FunnelEvent, productionId: string | null, visitorId: string) {
  try {
    if (await isStaffViewer()) return;
    await createServiceClient().from("funnel_events").insert({ event, production_id: productionId, visitor_id: visitorId });
  } catch {
    /* migration-funnel.sql not run yet, or a hiccup: ignore */
  }
}
