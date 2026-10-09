import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

/** The full catalog of Act Avenue plays, A to Z. */
export async function GET() {
  const authError = await requireStaff();
  if (authError) return authError;

  const db = createServiceClient();
  const { data, error } = await db.from("plays").select("*").order("title", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plays: data });
}

export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { title, description } = await req.json();
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const db = createServiceClient();
  const { data, error } = await db
    .from("plays")
    .insert({ title: String(title).trim(), description: description ? String(description).trim() : null })
    .select()
    .single();
  if (error) {
    const msg = error.code === "23505" ? "A play with that title already exists." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ play: data });
}
