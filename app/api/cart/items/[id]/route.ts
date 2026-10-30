import { idPaths } from "@/lib/id-proofs";
import { remainingForTier } from "@/lib/tier-stock";
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
  const remaining = await remainingForTier(db, existing.ticket_tier);
  if (quantity > remaining) {
    return NextResponse.json(
      { error: `Only ${remaining} left for this tier.` },
      { status: 409 }
    );
  }

  // Discounted tickets carry one ID each. Fewer tickets drops the extra IDs. More tickets
  // needs new IDs, which are uploaded when the tickets are added from the show page.
  const updates: Record<string, unknown> = { quantity };
  if (existing.ticket_tier.require_id) {
    const have = idPaths(existing);
    if (quantity > have.length) {
      return NextResponse.json(
        {
          code: "id_required",
          error: "Each discounted ticket needs its own ID. Add more tickets from the show page so you can upload their IDs.",
        },
        { status: 400 }
      );
    }
    if (quantity < have.length) {
      const keep = have.slice(0, quantity);
      updates.id_proof_paths = keep;
      updates.id_proof_path = keep[0] ?? null;
      await db.storage.from("id-proofs").remove(have.slice(quantity));
    }
  }

  const { data, error } = await db
    .from("cart_items")
    .update(updates)
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
