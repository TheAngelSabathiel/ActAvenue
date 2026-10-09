import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrCreateCart } from "@/lib/cart-session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quantity } = await req.json();

  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "quantity must be >= 1" }, { status: 400 });
  }

  const cart = await getOrCreateCart();
  const db = createServiceClient();

  // Ownership check: only allow editing items in the current session's cart -
  // without this, any cart_item id (however hard to guess) could be modified
  // regardless of whose cart it belongs to.
  const { data: existing } = await db
    .from("cart_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("id", id)
    .eq("cart_id", cart.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  // Re-check availability when raising quantity, same guard as adding a new
  // item - otherwise a buyer could bump quantity past what's left in the
  // cart UI and only discover the problem at checkout.
  const remaining =
    existing.ticket_tier.quantity_available - existing.ticket_tier.quantity_held;
  if (quantity > remaining) {
    return NextResponse.json(
      { error: `Only ${remaining} left for this tier.` },
      { status: 409 }
    );
  }

  const { data, error } = await db
    .from("cart_items")
    .update({ quantity })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cart = await getOrCreateCart();
  const db = createServiceClient();

  // Same ownership check as PATCH above.
  const { error } = await db.from("cart_items").delete().eq("id", id).eq("cart_id", cart.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
