import { toIsoManila } from "@/lib/datetime";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfPerformance } from "@/lib/admin-scope";

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
      discount_valid_from: toIsoManila(discount_valid_from),
      discount_valid_until: toIsoManila(discount_valid_until),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}
