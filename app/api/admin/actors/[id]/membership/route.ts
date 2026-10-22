import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { withRefresh } from "@/lib/refresh-public";

/**
 * Moves an account between Audience and Cast and Crew.
 * Only touches plain 'actor' and 'public' accounts. Admin and organizer
 * roles are never changed here.
 */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const member = body.member === true;
  const db = createServiceClient();

  const { data: current, error: findError } = await db.from("profiles").select("id, role").eq("id", id).maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (member && current.role === "public") {
    const { error } = await db.from("profiles").update({ role: "actor" }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (!member && current.role === "actor") {
    const { error } = await db.from("profiles").update({ role: "public", is_approved: false }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (current.role === "admin" || current.role === "organizer") {
    return NextResponse.json({ error: "Staff accounts stay in Cast and Crew." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRefresh(handlePOST);
