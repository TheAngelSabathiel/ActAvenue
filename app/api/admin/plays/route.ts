import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { setPlayWriters } from "@/lib/play-writers";
import { requireAnyAccess, requireStaff } from "@/lib/admin-auth";
import { withRefresh } from "@/lib/refresh-public";

/** The full catalog of Act Avenue plays, A to Z. */
export async function GET() {
  const gate = await requireAnyAccess("manager");
  if (gate.error) return gate.error;

  const db = createServiceClient();
  let { data, error } = await db.from("plays").select("*, play_writers(profile_id, sort_order)").order("title", { ascending: true });
  if (error) {
    // Writers not set up yet (migration not run): still list the plays.
    ({ data, error } = await db.from("plays").select("*").order("title", { ascending: true }));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plays: data });
}

async function handlePOST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { title, description, logline, writer_ids } = await req.json();
  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const db = createServiceClient();
  const { data, error } = await db
    .from("plays")
    .insert({
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      ...(logline && String(logline).trim() ? { logline: String(logline).trim().slice(0, 200) } : {}),
    })
    .select()
    .single();
  if (error) {
    const msg = error.code === "23505" ? "A play with that title already exists." : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
  }
  if (Array.isArray(writer_ids) && writer_ids.length) {
    try {
      await setPlayWriters(db, data.id, writer_ids.filter((x: unknown) => typeof x === "string"));
    } catch (err) {
      return NextResponse.json({ error: `Play added, but writers were not saved: ${err instanceof Error ? err.message : "error"}` }, { status: 500 });
    }
  }
  return NextResponse.json({ play: data });
}

export const POST = withRefresh(handlePOST);
