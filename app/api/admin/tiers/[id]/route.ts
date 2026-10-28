import { toIsoManila } from "@/lib/datetime";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfTier } from "@/lib/admin-scope";
import { isTierType, tierDisplayName, tierTypeName } from "@/lib/tiers";
import { withRefresh } from "@/lib/refresh-public";
import { checkPoolLink } from "@/lib/tier-pool";

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfTier(id), "manager");
  if (gate.error) return gate.error;
  const body = await req.json();
  const allowed = [
    "tier_type",
    "alias",
    "description",
    "require_id",
    "price",
    "quantity_available",
    "pool_tier_id",
    "is_discount_tier",
    "discount_valid_from",
    "discount_valid_until",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  for (const k of ["discount_valid_from", "discount_valid_until"] as const) {
    if (k in update) update[k] = toIsoManila(update[k]);
  }

  const db = createServiceClient();
  const { data: current } = await db.from("ticket_tiers").select("*").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Tier not found." }, { status: 404 });

  if ("tier_type" in update && !isTierType(update.tier_type)) {
    return NextResponse.json({ error: "Tier type must be Regular, VIP, Discounted or Special." }, { status: 400 });
  }
  for (const k of ["alias", "description"] as const) {
    if (k in update) update[k] = typeof update[k] === "string" && (update[k] as string).trim() ? (update[k] as string).trim() : null;
  }
  const type = (update.tier_type ?? current.tier_type) as string;
  if (update.tier_type && update.tier_type !== current.tier_type) {
    const { data: clash } = await db
      .from("ticket_tiers")
      .select("id")
      .eq("performance_id", current.performance_id)
      .eq("tier_type", type)
      .neq("id", id)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: `This show already has a ${tierTypeName(type)} tier.` }, { status: 409 });
    }
  }
  if ("pool_tier_id" in update || "quantity_available" in update) {
    const poolId = ("pool_tier_id" in update ? update.pool_tier_id : current.pool_tier_id) as string | null;
    if (poolId) {
      if ("pool_tier_id" in update && poolId !== current.pool_tier_id) {
        const bad = await checkPoolLink(db, current.performance_id, id, poolId);
        if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      }
      // Sharing seats: the quantity is an optional cap (0 or empty means no cap).
      const cap = Number("quantity_available" in update ? update.quantity_available : current.pool_capped ? current.quantity_available : 0) || 0;
      update.pool_tier_id = poolId;
      update.quantity_available = cap;
      update.pool_capped = cap > 0;
    } else {
      update.pool_tier_id = null;
      update.pool_capped = false;
    }
  }
  if (type !== "discounted") update.require_id = false;
  const alias = "alias" in update ? (update.alias as string | null) : current.alias;
  update.label = tierDisplayName({ tier_type: type, alias });

  const { data, error } = await db
    .from("ticket_tiers")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfTier(id), "manager");
  if (gate.error) return gate.error;
  const db = createServiceClient();

  const { count: linked } = await db
    .from("ticket_tiers")
    .select("id", { count: "exact", head: true })
    .eq("pool_tier_id", id);
  if (linked && linked > 0) {
    return NextResponse.json(
      { error: "Other tiers draw seats from this one. Unlink or delete them first." },
      { status: 409 }
    );
  }

  const { count } = await db
    .from("reservation_items")
    .select("id", { count: "exact", head: true })
    .eq("ticket_tier_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Can't delete a tier that already has reservations against it." },
      { status: 409 }
    );
  }

  const { error } = await db.from("ticket_tiers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const PATCH = withRefresh(handlePATCH);
export const DELETE = withRefresh(handleDELETE);
