import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { defaultRole, type CreditSection, type CreditType } from "@/lib/credits";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("production_credits")
    .select("*, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
    .eq("production_id", id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credits: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const profile_id: string | undefined = body.profile_id;
  const section: CreditSection = body.section === "artistic" ? "artistic" : "production";
  const credit_type: CreditType | null =
    section === "artistic" && ["writer", "director", "actor"].includes(body.credit_type) ? body.credit_type : null;
  const play_id: string | null = section === "artistic" && body.play_id ? body.play_id : null;
  const role_played: string = String(body.role_played ?? "").trim() || defaultRole(credit_type);

  if (!profile_id || !role_played) {
    return NextResponse.json({ error: "Choose a person and enter their role." }, { status: 400 });
  }
  if (section === "artistic" && !credit_type) {
    return NextResponse.json({ error: "Choose Actor, Writer or Director." }, { status: 400 });
  }

  const db = createServiceClient();

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
