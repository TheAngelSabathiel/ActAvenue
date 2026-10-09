import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function GET() {
  const authError = await requireStaff();
  if (authError) return authError;

  const db = createServiceClient();
  const { data, error } = await db
    .from("promo_codes")
    .select("*, production:productions(title)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promo_codes: data });
}

export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const {
    organization_id,
    code,
    discount_type,
    discount_value,
    applies_to_production_id,
    valid_from,
    valid_until,
    max_uses,
  } = await req.json();

  if (!organization_id || !code || !discount_type || discount_value === undefined) {
    return NextResponse.json(
      { error: "organization_id, code, discount_type, discount_value are required" },
      { status: 400 }
    );
  }
  if (!["percent", "fixed"].includes(discount_type)) {
    return NextResponse.json({ error: "discount_type must be percent or fixed" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("promo_codes")
    .insert({
      organization_id,
      code: code.toUpperCase().trim(),
      discount_type,
      discount_value,
      applies_to_production_id: applies_to_production_id || null,
      valid_from: valid_from ?? new Date().toISOString(),
      valid_until: valid_until || null,
      max_uses: max_uses || null,
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
