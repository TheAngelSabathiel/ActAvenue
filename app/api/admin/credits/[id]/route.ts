import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfCredit } from "@/lib/admin-scope";
import { CREDIT_TYPES, isDanceType } from "@/lib/credits";

/** Edit a credit: role text, play, type, or discredit/restore. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfCredit(id), "manager");
  if (gate.error) return gate.error;
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.role_played === "string" && body.role_played.trim()) update.role_played = body.role_played.trim();
  if (typeof body.is_discredited === "boolean") update.is_discredited = body.is_discredited;
  if ("play_id" in body) update.play_id = body.play_id || null;
  if (CREDIT_TYPES.includes(body.credit_type)) {
    update.credit_type = body.credit_type;
    // Dance credits are not tied to a play.
    if (isDanceType(body.credit_type)) update.play_id = null;
  }
  if (typeof body.sort_order === "number") update.sort_order = body.sort_order;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("production_credits")
    .update(update)
    .eq("id", id)
    .select("*, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
    .single();

  if (error) {
    const message = error.code === "23505" ? "That person already has this exact credit here." : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ credit: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfCredit(id), "manager");
  if (gate.error) return gate.error;
  const db = createServiceClient();
  const { error } = await db.from("production_credits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
