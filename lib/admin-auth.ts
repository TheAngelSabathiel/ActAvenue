import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type StaffRole = "manager" | "foh";

export interface Access {
  userId: string;
  /** admin or organizer: full access to everything. */
  isAdmin: boolean;
  /** Per-production access for Managers and FOH. */
  assignments: Record<string, StaffRole>;
}

/**
 * Who is signed in and what they can reach. Admin and organizer accounts see
 * everything. Anyone else only reaches the productions they are assigned to.
 * Returns null when nobody is signed in.
 */
export async function getAccess(): Promise<Access | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = !!profile && ["admin", "organizer"].includes(profile.role);

  const assignments: Record<string, StaffRole> = {};
  if (!isAdmin) {
    const { data } = await createServiceClient()
      .from("production_staff")
      .select("production_id, staff_role")
      .eq("profile_id", user.id);
    for (const row of data ?? []) assignments[row.production_id] = row.staff_role as StaffRole;
  }
  return { userId: user.id, isAdmin, assignments };
}

/**
 * "foh" level: a Manager or FOH of the production. "manager" level: a Manager
 * of the production. Admins pass everything.
 */
export function canAccess(access: Access | null, productionId: string | null | undefined, level: StaffRole): boolean {
  if (!access) return false;
  if (access.isAdmin) return true;
  if (!productionId) return false;
  const role = access.assignments[productionId];
  if (!role) return false;
  return level === "foh" ? true : role === "manager";
}

/** Production ids this person can reach at the given level. null = all (admin). */
export function accessibleProductionIds(access: Access, level: StaffRole): string[] | null {
  if (access.isAdmin) return null;
  return Object.entries(access.assignments)
    .filter(([, role]) => level === "foh" || role === "manager")
    .map(([id]) => id);
}

export function hasAnyAccess(access: Access | null, level: StaffRole = "foh"): boolean {
  if (!access) return false;
  if (access.isAdmin) return true;
  const ids = accessibleProductionIds(access, level);
  return !!ids && ids.length > 0;
}

const unauthorized = () => NextResponse.json({ error: "Not signed in." }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "You don't have access to this." }, { status: 403 });

/**
 * Admin only (admin/organizer). Usage:
 * `const authError = await requireStaff(); if (authError) return authError;`
 */
export async function requireStaff(): Promise<NextResponse | null> {
  const access = await getAccess();
  if (!access) return unauthorized();
  if (!access.isAdmin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return null;
}

/**
 * Access to one production. Usage:
 * `const gate = await requireProduction(id, "manager"); if (gate.error) return gate.error;`
 */
export async function requireProduction(
  productionId: string | null | undefined,
  level: StaffRole
): Promise<{ access: Access; error: null } | { access: null; error: NextResponse }> {
  const access = await getAccess();
  if (!access) return { access: null, error: unauthorized() };
  if (!canAccess(access, productionId, level)) return { access: null, error: forbidden() };
  return { access, error: null };
}

/** Any signed-in person with access at this level to at least one production (or admin). */
export async function requireAnyAccess(
  level: StaffRole
): Promise<{ access: Access; error: null } | { access: null; error: NextResponse }> {
  const access = await getAccess();
  if (!access) return { access: null, error: unauthorized() };
  if (!hasAnyAccess(access, level)) return { access: null, error: forbidden() };
  return { access, error: null };
}

/** For admin-only pages (server layouts). Sends Managers and FOH back to their own area. */
export async function requireAdminPage() {
  const access = await getAccess();
  if (!access) redirect("/admin/login");
  if (!access.isAdmin) redirect("/admin/reservations");
}
