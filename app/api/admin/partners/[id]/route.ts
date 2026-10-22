import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfPartner } from "@/lib/admin-scope";
import { cleanUrl, PARTNER_CATEGORIES, SPONSOR_LEVELS } from "@/lib/partners";
import { withRefresh } from "@/lib/refresh-public";

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPartner(id), "manager");
  if (gate.error) return gate.error;
  const body = await req.json();
  const db = createServiceClient();
  const { data: current } = await db.from("production_partners").select("*").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const update: Record<string, unknown> = {};
  if ("name" in body) {
    if (!String(body.name ?? "").trim()) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    update.name = String(body.name).trim();
  }
  if ("url" in body) update.url = cleanUrl(body.url);
  if ("sort_order" in body) update.sort_order = Number(body.sort_order) || 0;
  if ("category" in body) {
    if (!PARTNER_CATEGORIES.some((c) => c.value === body.category)) return NextResponse.json({ error: "Bad category." }, { status: 400 });
    update.category = body.category;
  }
  const category = (update.category ?? current.category) as string;
  if (category === "sponsor") {
    const level = "sponsor_level" in body ? body.sponsor_level : current.sponsor_level;
    if (!SPONSOR_LEVELS.some((l) => l.value === level)) return NextResponse.json({ error: "Pick a sponsor level." }, { status: 400 });
    update.sponsor_level = level;
  } else {
    update.sponsor_level = null;
  }
  const level = (update.sponsor_level ?? null) as string | null;
  if (level === "special_thanks" || ("logo_url" in body && body.logo_url === null)) update.logo_url = null;

  const { data, error } = await db.from("production_partners").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPartner(id), "manager");
  if (gate.error) return gate.error;
  const { error } = await createServiceClient().from("production_partners").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const PATCH = withRefresh(handlePATCH);
export const DELETE = withRefresh(handleDELETE);
