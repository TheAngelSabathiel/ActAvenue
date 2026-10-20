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
  let idFile: File | null = null;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData();
    ticket_tier_id = fd.get("ticket_tier_id") as string;
    performance_id = fd.get("performance_id") as string;
    quantity = Number(fd.get("quantity"));
    const f = fd.get("id_file");
    idFile = f instanceof File && f.size > 0 ? f : null;
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

  // Discounted tiers can ask for an ID before the ticket goes in the cart.
  let idPath: string | null = null;
  if (tier.require_id) {
    if (idFile) {
      if (!/^(image\/|application\/pdf)/.test(idFile.type)) {
        return NextResponse.json({ error: "Upload your ID as an image or PDF." }, { status: 400 });
      }
      if (idFile.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "ID file is too large (8 MB max)." }, { status: 400 });
      }
      const safe = idFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      idPath = `${cart.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await db.storage
        .from("id-proofs")
        .upload(idPath, new Uint8Array(await idFile.arrayBuffer()), { contentType: idFile.type });
      if (upErr) return NextResponse.json({ error: `ID upload failed: ${upErr.message}` }, { status: 500 });
    } else if (!existingItem?.id_proof_path) {
      return NextResponse.json(
        { error: "Upload your ID to add this ticket.", code: "id_required" },
        { status: 400 }
      );
    }
  }

  if (existingItem) {
    const { data, error } = await db
      .from("cart_items")
      .update({ quantity: existingItem.quantity + quantity, ...(idPath ? { id_proof_path: idPath } : {}) })
      .eq("id", existingItem.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  const { data, error } = await db
    .from("cart_items")
    .insert({ cart_id: cart.id, ticket_tier_id, performance_id, quantity, id_proof_path: idPath })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
