import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { CREDIT_TYPES, defaultRole, isDanceType, type CreditSection, type CreditType } from "@/lib/credits";
import { withRefresh } from "@/lib/refresh-public";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const db = createServiceClient();
  const { data, error } = await db
    .from("production_credits")
    .select("*, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
    .eq("production_id", id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credits: data });
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const body = await req.json();
  const profile_id: string | undefined = body.profile_id;
  const section: CreditSection = body.section === "artistic" ? "artistic" : "production";
  const credit_type: CreditType | null =
    section === "artistic" && CREDIT_TYPES.includes(body.credit_type) ? body.credit_type : null;
  const play_id: string | null = section === "artistic" && body.play_id && !isDanceType(credit_type) ? body.play_id : null;
  const role_played: string = String(body.role_played ?? "").trim() || defaultRole(credit_type);

  if (!profile_id || !role_played) {
    return NextResponse.json({ error: "Choose a person and enter their role." }, { status: 400 });
  }
  if (section === "artistic" && !credit_type) {
    return NextResponse.json({ error: "Choose a credit type." }, { status: 400 });
  }

  const db = createServiceClient();

  // Crediting an audience account makes it part of Cast and Crew, so the
  // admin can pick anyone without a listing request first.
  const { data: person } = await db.from("profiles").select("role").eq("id", profile_id).maybeSingle();
  if (!person) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (person.role === "public") {
    await db.from("profiles").update({ role: "actor" }).eq("id", profile_id);
  }

  // New credits go to the end of their list.
  let last = db
    .from("production_credits")
    .select("sort_order")
    .eq("production_id", id)
    .eq("section", section)
    .order("sort_order", { ascending: false })
    .limit(1);
  last = play_id ? last.eq("play_id", play_id) : last.is("play_id", null);
  const { data: lastRow } = await last.maybeSingle();

  const { data, error } = await db
    .from("production_credits")
    .insert({
      production_id: id,
      profile_id,
      role_played,
      section,
      credit_type,
      play_id,
      sort_order: (lastRow?.sort_order ?? 0) + 10,
    })
    .select("*, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
    .single();

  if (error) {
    const message = error.code === "23505" ? "This person already has that exact credit here." : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ credit: data });
}

export const POST = withRefresh(handlePOST);
