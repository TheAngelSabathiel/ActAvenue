import { toIsoManila } from "@/lib/datetime";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanTypes } from "@/lib/tiers";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";
import { withRefresh } from "@/lib/refresh-public";

export async function GET() {
  const gate = await requireAnyAccess("manager");
  if (gate.error) return gate.error;

  // Managers only see codes tied to productions they manage.
  const ids = accessibleProductionIds(gate.access, "manager");
  const db = createServiceClient();
  let query = db
    .from("promo_codes")
    .select("*, production:productions(title)")
    .order("created_at", { ascending: false });
  if (ids) query = query.in("applies_to_production_id", ids);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo_codes: data });
}

async function handlePOST(req: NextRequest) {
  const gate = await requireAnyAccess("manager");
  if (gate.error) return gate.error;

  const {
    organization_id: bodyOrgId,
    code,
    discount_type,
    discount_value,
    applies_to_production_id,
    valid_from,
    valid_until,
    max_uses,
    applicable_tier_types,
  } = await req.json();

  const db = createServiceClient();
  let organization_id: string | undefined = bodyOrgId;
  if (!gate.access.isAdmin) {
    // Managers can only create codes for one of their own productions, and
    // the organization comes from that production.
    if (!applies_to_production_id || !canAccess(gate.access, applies_to_production_id, "manager")) {
      return NextResponse.json({ error: "Pick a production you manage." }, { status: 403 });
    }
    const { data: prod } = await db.from("productions").select("organization_id").eq("id", applies_to_production_id).maybeSingle();
    organization_id = prod?.organization_id;
  }

  if (!organization_id || !code || !discount_type || discount_value === undefined) {
    return NextResponse.json(
      { error: "organization_id, code, discount_type, discount_value are required" },
      { status: 400 }
    );
  }
  if (!["percent", "fixed"].includes(discount_type)) {
    return NextResponse.json({ error: "discount_type must be percent or fixed" }, { status: 400 });
  }

  const { data, error } = await db
    .from("promo_codes")
    .insert({
      organization_id,
      code: code.toUpperCase().trim(),
      discount_type,
      discount_value,
      applies_to_production_id: applies_to_production_id || null,
      valid_from: toIsoManila(valid_from) ?? new Date().toISOString(),
      valid_until: toIsoManila(valid_until),
      max_uses: max_uses || null,
      applicable_tier_types: cleanTypes(applicable_tier_types),
    })
    .select()
    .single();

  if (error) {
    // unique (organization_id, code) constraint
    const message = error.code === "23505" ? "This code already exists." : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ promo_code: data });
}

export const POST = withRefresh(handlePOST);
