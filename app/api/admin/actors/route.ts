import { NextRequest, NextResponse } from "next/server";
import { MEMBER_ROLES } from "@/lib/member-roles";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

/**
 * Lists accounts for the Cast and Crew admin page and the credit picker.
 * ?group=pending  members who asked to be listed and await approval
 * ?group=members  cast and crew (actor, admin, organizer)
 * ?group=audience audience/visitor accounts (role public)
 * (default)       every account
 */
export async function GET(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const group = req.nextUrl.searchParams.get("group") ?? (req.nextUrl.searchParams.get("pending") === "true" ? "pending" : "all");
  const db = createServiceClient();

  let query = db
    .from("profiles")
    .select("id, role, display_name, bio, photo_url, is_public, is_approved, created_at")
    .order("display_name", { ascending: true, nullsFirst: false });

  if (group === "members") query = query.in("role", [...MEMBER_ROLES]);
  else if (group === "audience") query = query.not("role", "in", `(${MEMBER_ROLES.join(",")})`);
  else if (group === "pending") {
    query = query.in("role", [...MEMBER_ROLES]).eq("is_public", true).eq("is_approved", false);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Emails live in auth, not profiles. Attach them so unnamed accounts can be told apart.
  const emails = new Map<string, string>();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      const users = list?.users ?? [];
      for (const u of users) if (u.email) emails.set(u.id, u.email);
      if (users.length < 1000) break;
    }
  } catch (err) {
    console.error("Could not load account emails:", err);
  }

  const actors = (data ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? null }));
  return NextResponse.json({ actors });
}
