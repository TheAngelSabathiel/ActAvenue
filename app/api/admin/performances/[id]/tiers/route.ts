import { toIsoManila } from "@/lib/datetime";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfPerformance } from "@/lib/admin-scope";
import { isTierType, tierDisplayName, tierTypeName } from "@/lib/tiers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPerformance(id), "foh");
  if (gate.error) return gate.error;
  const db = createServiceClient();
  const { data, error } = await db
    .from("ticket_tiers")
    .select("*")
    .eq("performance_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tiers: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPerformance(id), "manager");
  if (gate.error) return gate.error;
  const {
    tier_type,
    alias,
    description,
    require_id,
    price,
    quantity_available,
    is_discount_tier,
    discount_valid_from,
    discount_valid_until,
  } = await req.json();

  if (!isTierType(tier_type) || price === undefined || quantity_available === undefined) {
    return NextResponse.json(
      { error: "Pick a tier type and enter a price and quantity." },
      { status: 400 }
    );
  }

  const db = createServiceClient();
  const { data: clash } = await db
    .from("ticket_tiers")
    .select("id")
    .eq("performance_id", id)
    .eq("tier_type", tier_type)
    .maybeSingle();
  if (clash) {
    return NextResponse.json({ error: `This show already has a ${tierTypeName(tier_type)} tier.` }, { status: 409 });
  }
  const cleanAlias = typeof alias === "string" && alias.trim() ? alias.trim() : null;
  const { data, error } = await db
    .from("ticket_tiers")
    .insert({
      performance_id: id,
      label: tierDisplayName({ tier_type, alias: cleanAlias }),
      tier_type,
      alias: cleanAlias,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      require_id: tier_type === "discounted" && !!require_id,
      price,
      quantity_available,
      is_discount_tier: !!is_discount_tier,
      discount_valid_from: toIsoManila(discount_valid_from),
      discount_valid_until: toIsoManila(discount_valid_until),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}
