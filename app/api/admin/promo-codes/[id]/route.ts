import { toIsoManila } from "@/lib/datetime";
import { cleanTypes } from "@/lib/tiers";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canAccess, requireProduction } from "@/lib/admin-auth";
import { productionOfPromo } from "@/lib/admin-scope";
import { withRefresh } from "@/lib/refresh-public";

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPromo(id), "manager");
  if (gate.error) return gate.error;
  const body = await req.json();
  const allowed = [
    "discount_type",
    "discount_value",
    "applies_to_production_id",
    "valid_from",
    "valid_until",
    "max_uses",
    "applicable_tier_types",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if ("applicable_tier_types" in update) update.applicable_tier_types = cleanTypes(update.applicable_tier_types);
  for (const k of ["valid_from", "valid_until"] as const) {
    if (k in update) update[k] = toIsoManila(update[k]);
  }

  if (!gate.access.isAdmin && "applies_to_production_id" in update) {
    if (!canAccess(gate.access, update.applies_to_production_id as string | null, "manager")) {
      return NextResponse.json({ error: "Pick a production you manage." }, { status: 403 });
    }
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("promo_codes")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo_code: data });
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPromo(id), "manager");
  if (gate.error) return gate.error;
  const db = createServiceClient();
  const { error } = await db.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const PATCH = withRefresh(handlePATCH);
export const DELETE = withRefresh(handleDELETE);
