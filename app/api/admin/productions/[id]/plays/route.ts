import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

/** Plays this production stages, in display order. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("production_plays")
    .select("sort_order, play:plays(id, title)")
    .eq("production_id", id)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const plays = (data ?? [])
    .map((r) => {
      const play = Array.isArray(r.play) ? r.play[0] : r.play;
      return play ? { id: play.id as string, title: play.title as string, sort_order: r.sort_order as number } : null;
    })
    .filter((p) => p !== null);
  return NextResponse.json({ plays });
}

/** Assign a catalog play ({ play_id }) or create one on the spot ({ title }) and assign it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const db = createServiceClient();

  let playId: string | undefined = body.play_id;
  if (!playId) {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "play_id or title is required" }, { status: 400 });
    const { data: existing } = await db.from("plays").select("id").ilike("title", title).maybeSingle();
    if (existing) {
      playId = existing.id;
    } else {
      const { data: created, error } = await db.from("plays").insert({ title }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      playId = created.id;
    }
  }

  const { data: last } = await db
    .from("production_plays")
    .select("sort_order")
    .eq("production_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db
    .from("production_plays")
    .insert({ production_id: id, play_id: playId, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) {
    const msg = error.code === "23505" ? "That play is already in this production." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, play_id: playId });
}

/** Removes the play from this production. Its credits here become "no specific play". */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const playId = req.nextUrl.searchParams.get("play_id");
  if (!playId) return NextResponse.json({ error: "play_id is required" }, { status: 400 });

  const db = createServiceClient();
  await db.from("production_credits").update({ play_id: null }).eq("production_id", id).eq("play_id", playId);
  const { error } = await db.from("production_plays").delete().eq("production_id", id).eq("play_id", playId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
