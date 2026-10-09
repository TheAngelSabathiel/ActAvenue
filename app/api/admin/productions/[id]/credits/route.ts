import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("production_credits")
    .select("*, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
    .eq("production_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credits: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const { profile_id, role_played } = await req.json();

  if (!profile_id || !role_played) {
    return NextResponse.json({ error: "profile_id and role_played are required" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("production_credits")
    .insert({ production_id: id, profile_id, role_played })
    .select("*, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
    .single();

  if (error) {
    const message = error.code === "23505" ? "This actor already has that exact credit on this production." : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ credit: data });
}
