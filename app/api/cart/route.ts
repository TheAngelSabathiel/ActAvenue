import { remainingForTier } from "@/lib/tier-stock";
import { idPaths } from "@/lib/id-proofs";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCart } from "@/lib/cart-session";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const cart = await getOrCreateCart();
  const db = createServiceClient();

  const { data: items, error } = await db
    .from("cart_items")
    .select("*, ticket_tier:ticket_tiers(*), performance:performances(*, production:productions(id, title))")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cart, items });
}

export async function POST(req: NextRequest) {
  let ticket_tier_id: string, performance_id: string, quantity: number;
  let idFiles: File[] = [];
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData();
    ticket_tier_id = fd.get("ticket_tier_id") as string;
    performance_id = fd.get("performance_id") as string;
    quantity = Number(fd.get("quantity"));
    idFiles = fd.getAll("id_file").filter((f): f is File => f instanceof File && f.size > 0);
  } else {
    ({ ticket_tier_id, performance_id, quantity } = await req.json());
  }

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

  const remaining = await remainingForTier(db, tier);
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

  // Discounted tiers need one ID per ticket before the tickets go in the cart.
  const newPaths: string[] = [];
  if (tier.require_id) {
    if (idFiles.length !== quantity) {
      return NextResponse.json(
        {
          error: `Upload ${quantity} ID${quantity === 1 ? "" : "s"}, one for each ticket.`,
          code: "id_required",
          needed: quantity,
        },
        { status: 400 }
      );
    }
    for (const f of idFiles) {
      if (!/^(image\/|application\/pdf)/.test(f.type)) {
        return NextResponse.json({ error: "Upload your IDs as images or PDFs." }, { status: 400 });
      }
      if (f.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "An ID file is too large (8 MB max each)." }, { status: 400 });
      }
    }
    for (const [n, f] of idFiles.entries()) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${cart.id}/${Date.now()}-${n}-${safe}`;
      const { error: upErr } = await db.storage
        .from("id-proofs")
        .upload(path, new Uint8Array(await f.arrayBuffer()), { contentType: f.type });
      if (upErr) {
        if (newPaths.length) await db.storage.from("id-proofs").remove(newPaths);
        return NextResponse.json({ error: `ID upload failed: ${upErr.message}` }, { status: 500 });
      }
      newPaths.push(path);
    }
  }

  if (existingItem) {
    const { data, error } = await db
      .from("cart_items")
      .update({
        quantity: existingItem.quantity + quantity,
        ...(newPaths.length
          ? (() => {
              const all = [...idPaths(existingItem), ...newPaths];
              return { id_proof_paths: all, id_proof_path: all[0] };
            })()
          : {}),
      })
      .eq("id", existingItem.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  const { data, error } = await db
    .from("cart_items")
    .insert({
      cart_id: cart.id,
      ticket_tier_id,
      performance_id,
      quantity,
      id_proof_paths: newPaths,
      id_proof_path: newPaths[0] ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
