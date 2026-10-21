import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

/**
 * Give a Cast and Crew member Manager, FOH or Scanner access to one production.
 * POST { profile_id, production_id, staff_role: "manager" | "foh" | "scanner" }.
 * Assigning again changes their role for that production.
 */
export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { profile_id, production_id, staff_role } = await req.json().catch(() => ({}));
  if (!profile_id || !production_id || !["manager", "foh", "scanner"].includes(staff_role)) {
    return NextResponse.json({ error: "Choose a production and a role." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: person } = await db.from("profiles").select("role").eq("id", profile_id).maybeSingle();
  if (!person) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (person.role === "public") {
    return NextResponse.json({ error: "Add this account to Cast and Crew first." }, { status: 400 });
  }

  const { data, error } = await db
    .from("production_staff")
    .upsert({ profile_id, production_id, staff_role }, { onConflict: "profile_id,production_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data });
}
