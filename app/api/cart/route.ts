import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCart } from "@/lib/cart-session";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const cart = await getOrCreateCart();
  const db = createServiceClient();

  const { data: items, error } = await db
    .from("cart_items")
    .select("*, ticket_tier:ticket_tiers(*), performance:performances(*)")
    .eq("cart_id", cart.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cart, items });
}

export async function POST(req: NextRequest) {
  const { ticket_tier_id, performance_id, quantity } = await req.json();

  if (!ticket_tier_id || !performance_id || !quantity || quantity < 1) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const cart = await getOrCreateCart();
  const db = createServiceClient();

  // Guard against overselling: check remaining = quantity_available - quantity_held
  const { data: tier, error: tierError } = await db
    .from("ticket_tiers")
    .select("*")
    .eq("id", ticket_tier_id)
    .single();

  if (tierError || !tier) {
    return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });
  }

  const remaining = tier.quantity_available - tier.quantity_held;
  if (quantity > remaining) {
    return NextResponse.json(
      { error: `Only ${remaining} left for this tier.` },
      { status: 409 }
    );
  }

  // Upsert: bump quantity if this tier is already in the cart.
  const { data: existingItem } = await db
    .from("cart_items")
    .select("*")
    .eq("cart_id", cart.id)
    .eq("ticket_tier_id", ticket_tier_id)
    .maybeSingle();

  if (existingItem) {
    const { data, error } = await db
      .from("cart_items")
      .update({ quantity: existingItem.quantity + quantity })
      .eq("id", existingItem.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  const { data, error } = await db
    .from("cart_items")
    .insert({ cart_id: cart.id, ticket_tier_id, performance_id, quantity })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
