import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { cleanUrl, PARTNER_CATEGORIES, SPONSOR_LEVELS } from "@/lib/partners";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const { data, error } = await createServiceClient()
    .from("production_partners")
    .select("*")
    .eq("production_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const { category, sponsor_level, name, url } = await req.json();
  if (!PARTNER_CATEGORIES.some((c) => c.value === category) || !name?.trim()) {
    return NextResponse.json({ error: "Pick a category and enter a name." }, { status: 400 });
  }
  let level: string | null = null;
  if (category === "sponsor") {
    if (!SPONSOR_LEVELS.some((l) => l.value === sponsor_level)) {
      return NextResponse.json({ error: "Pick a sponsor level." }, { status: 400 });
    }
    level = sponsor_level;
  }
  const { data, error } = await createServiceClient()
    .from("production_partners")
    .insert({ production_id: id, category, sponsor_level: level, name: name.trim(), url: cleanUrl(url) })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}
