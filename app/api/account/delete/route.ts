import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Deleting an auth.users row requires the admin API (service-role key) -
 * there's no client-SDK method for a user to delete themselves. This route
 * verifies the caller's own session first, then only ever deletes that
 * exact user.id - never a client-supplied id.
 *
 * The profiles row cascades on delete (profiles.id references auth.users
 * with on delete cascade). Their reservations are NOT deleted or touched
 * beyond having profile_id set to null (see reservations.profile_id's
 * on delete set null in schema.sql) - booking/attendance history is
 * preserved, same as the app's no-hard-deletes philosophy everywhere else.
 */
export async function POST() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createServiceClient();

  // Staff accounts can't be deleted from here. It would remove the admin
  // login, and possibly the last one.
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile && ["admin", "organizer"].includes(profile.role)) {
    return NextResponse.json({ error: "Admin accounts can't be deleted here. Ask another admin." }, { status: 403 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
