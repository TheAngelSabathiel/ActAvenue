import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The only self-service role transition: public -> actor. The target role
 * is never read from the request body - it's hardcoded here - so this
 * route can't be repurposed into a privilege-escalation path no matter
 * what a client sends. Promoting to admin/organizer always stays a manual
 * SQL step (see SETUP.md).
 */
export async function POST() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const db = createServiceClient();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  if (profile.role !== "public") {
    // Already an actor, or staff - nothing to do, and staff should never
    // be silently downgraded/changed by this route.
    return NextResponse.json({ role: profile.role });
  }

  const { data: updated, error } = await db
    .from("profiles")
    .update({ role: "actor" })
    .eq("id", user.id)
    .select("role")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ role: updated.role });
}
