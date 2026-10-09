import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Returns null if not signed in. Otherwise, first "claims" any past guest
 * reservations made with this account's email (profile_id was left null at
 * checkout time since the buyer wasn't signed in then), then returns the
 * full list linked to this account.
 *
 * The claim step needs the service-role client because normal RLS only
 * allows staff to write to reservations - a buyer can't UPDATE their own
 * row directly. This is safe here because the write is scoped to rows
 * matching the *currently authenticated* user's own verified email, not
 * anything client-supplied.
 */
export async function getAccountReservations() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const db = createServiceClient();

  if (user.email) {
    await db
      .from("reservations")
      .update({ profile_id: user.id })
      .is("profile_id", null)
      .ilike("buyer_email", user.email);
  }

  const { data: reservations } = await db
    .from("reservations")
    .select(
      `*, production:productions(title, slug, poster_url),
       performance:performances(label, datetime, venue),
       reservation_items(*, ticket_tier:ticket_tiers(label))`
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return { user, reservations: reservations ?? [], fetchedAt: Date.now() };
}
