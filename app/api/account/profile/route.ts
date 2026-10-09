import { NextRequest, NextResponse } from "next/server";
import { STAFF_ROLES } from "@/lib/member-roles";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Updates the caller's own profile fields. Deliberately whitelists columns
 * - role and is_approved are never accepted from the request body, both as defense in depth and because the DB-level column grants
 * (see schema.sql) would reject them anyway.
 */
export async function POST(req: NextRequest) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json();
  const allowed = ["display_name", "bio", "is_public", "resume_url", "reel_url"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const db = createServiceClient();

  // Staff (admin/organizer) are already trusted, so their public profile
  // goes live without a separate moderation step. Actors still need approval.
  const { data: current } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (current && (STAFF_ROLES as readonly string[]).includes(current.role)) {
    update.is_approved = true;
  }

  const { data, error } = await db
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
