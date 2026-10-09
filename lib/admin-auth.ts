import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns a NextResponse (401/403) if the current request isn't from a
 * signed-in admin/organizer, or null if it's fine to proceed.
 * Usage: `const authError = await requireStaff(); if (authError) return authError;`
 */
export async function requireStaff(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "organizer"].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return null;
}
