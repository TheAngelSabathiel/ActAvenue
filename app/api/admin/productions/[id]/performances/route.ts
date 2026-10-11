import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "foh");
  if (gate.error) return gate.error;
  const db = createServiceClient();
  const { data, error } = await db
    .from("performances")
    .select("*, ticket_tiers(*)")
    .eq("production_id", id)
    .order("datetime", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ performances: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const { label, datetime, venue, capacity } = await req.json();

  if (!label || !datetime || !venue || !capacity) {
    return NextResponse.json({ error: "label, datetime, venue, capacity are required" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("performances")
    .insert({ production_id: id, label, datetime, venue, capacity })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ performance: data });
}
