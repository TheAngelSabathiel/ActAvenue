import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db
    .from("ticket_tiers")
    .select("*")
    .eq("performance_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tiers: data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const {
    label,
    price,
    quantity_available,
    is_discount_tier,
    discount_valid_from,
    discount_valid_until,
  } = await req.json();

  if (!label || price === undefined || quantity_available === undefined) {
    return NextResponse.json(
      { error: "label, price, quantity_available are required" },
      { status: 400 }
    );
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("ticket_tiers")
    .insert({
      performance_id: id,
      label,
      price,
      quantity_available,
      is_discount_tier: !!is_discount_tier,
      discount_valid_from: discount_valid_from ?? null,
      discount_valid_until: discount_valid_until ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}
