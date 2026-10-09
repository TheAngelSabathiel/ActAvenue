import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const pendingOnly = req.nextUrl.searchParams.get("pending") === "true";
  const db = createServiceClient();

  let query = db
    .from("profiles")
    .select("id, display_name, bio, photo_url, is_public, is_approved, created_at")
    .eq("role", "actor")
    .order("created_at", { ascending: false });

  // "Pending" = wants to be listed (is_public) but hasn't been approved yet
  // - the admin moderation queue.
  if (pendingOnly) {
    query = query.eq("is_public", true).eq("is_approved", false);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actors: data });
}
