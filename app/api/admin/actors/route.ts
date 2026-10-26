import { NextRequest, NextResponse } from "next/server";
import { MEMBER_ROLES } from "@/lib/member-roles";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAnyAccess } from "@/lib/admin-auth";

// Account emails live in auth and take several calls to list. Keep them for a
// minute so switching tabs and refreshing stays fast.
let emailCache: { at: number; map: Map<string, string> } | null = null;
async function loadEmails(db: ReturnType<typeof createServiceClient>) {
  if (emailCache && Date.now() - emailCache.at < 60_000) return emailCache.map;
  const map = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data: list } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const users = list?.users ?? [];
    for (const u of users) if (u.email) map.set(u.id, u.email);
    if (users.length < 1000) break;
  }
  emailCache = { at: Date.now(), map };
  return map;
}

/**
 * Lists accounts for the Cast and Crew admin page and the credit picker.
 * ?group=pending  members who asked to be listed and await approval
 * ?group=members  cast and crew (actor, admin, organizer)
 * ?group=audience audience/visitor accounts (role public)
 * (default)       every account
 */
export async function GET(req: NextRequest) {
  // Managers get the people list for crediting, without emails or bios.
  const gate = await requireAnyAccess("manager");
  if (gate.error) return gate.error;
  const isAdmin = gate.access.isAdmin;

  const group = !isAdmin
    ? "all"
    : (req.nextUrl.searchParams.get("group") ?? (req.nextUrl.searchParams.get("pending") === "true" ? "pending" : "all"));
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

  // Production access (Manager / FOH) per person, for the admin page.
  const staffByProfile = new Map<string, { id: string; production_id: string; title: string; staff_role: string }[]>();
  if (isAdmin) {
    const { data: staffRows } = await db
      .from("production_staff")
      .select("id, profile_id, production_id, staff_role, production:productions(title)");
    for (const r of staffRows ?? []) {
      const prod = Array.isArray(r.production) ? r.production[0] : r.production;
      const list = staffByProfile.get(r.profile_id) ?? [];
      list.push({ id: r.id, production_id: r.production_id, title: prod?.title ?? "Production", staff_role: r.staff_role });
      staffByProfile.set(r.profile_id, list);
    }
  }

  // Emails live in auth, not profiles. Attach them so unnamed accounts can be told apart.
  let emails = new Map<string, string>();
  if (isAdmin) {
    try {
      emails = await loadEmails(db);
    } catch (err) {
      console.error("Could not load account emails:", err);
    }
  }

  // How many bookings each account has made (admin view only).
  const orders = new Map<string, number>();
  if (isAdmin) {
    const { data: rows } = await db.from("reservations").select("profile_id").not("profile_id", "is", null);
    for (const r of rows ?? []) orders.set(r.profile_id as string, (orders.get(r.profile_id as string) ?? 0) + 1);
  }

  const actors = (data ?? []).map((p) => ({
    ...p,
    bio: isAdmin ? p.bio : null,
    email: emails.get(p.id) ?? null,
    orders: orders.get(p.id) ?? 0,
    staff: staffByProfile.get(p.id) ?? [],
  }));
  return NextResponse.json({ actors });
}
