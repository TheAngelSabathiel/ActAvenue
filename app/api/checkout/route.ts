import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCart } from "@/lib/cart-session";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { calculatePricing } from "@/lib/pricing";
import { sendBookingReceivedEmail } from "@/lib/email/send";
import { holdTicketTier, incrementPromoUsage, releaseTicketTierHolds } from "@/lib/inventory";
import type { TicketTier } from "@/types/database";

const HOLD_HOURS = 24;

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const buyer_name = formData.get("buyer_name") as string;
  const buyer_email = formData.get("buyer_email") as string;
  const buyer_phone = formData.get("buyer_phone") as string;
  const promo_code = (formData.get("promo_code") as string) || null;
  const proofFile = formData.get("payment_proof") as File | null;

  // Email is required regardless of whether the buyer is signed in - an
  // account just links a reservation to a buyer's history, it never
  // replaces the need for an email to send the booking/e-ticket to.
  if (!buyer_name || !buyer_email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  if (!proofFile) {
    return NextResponse.json({ error: "Payment proof is required at checkout." }, { status: 400 });
  }

  const cart = await getOrCreateCart();
  const db = createServiceClient();

  // If the buyer is signed in, link this reservation to their account so it
  // shows up in "My tickets" automatically - no separate claiming step needed.
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const { data: items, error: itemsError } = await db
    .from("cart_items")
    .select("*, ticket_tier:ticket_tiers(*), performance:performances(*)")
    .eq("cart_id", cart.id);

  if (itemsError || !items?.length) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const missingId = items.find((i) => i.ticket_tier.require_id && !i.id_proof_path);
  if (missingId) {
    return NextResponse.json(
      { error: `Upload your ID for "${missingId.ticket_tier.label}" in your cart first.` },
      { status: 400 }
    );
  }

  // One checkout can span several shows. Each show becomes its own
  // reservation (own reference code, QR and check-in); they share a single
  // payment proof and an order_code so staff and the buyer can see them together.
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const list = groups.get(item.performance_id) ?? [];
    list.push(item);
    groups.set(item.performance_id, list);
  }

  const productionIds = [...new Set(items.map((i) => i.performance.production_id as string))];
  const { data: productions } = await db.from("productions").select("*").in("id", productionIds);
  const productionById = new Map((productions ?? []).map((p) => [p.id as string, p]));
  if (productionById.size !== productionIds.length) {
    return NextResponse.json({ error: "Production not found." }, { status: 404 });
  }

  // Resolve promo code (server-side validation, not trusting client-calculated totals)
  let promo = null;
  if (promo_code) {
    const { data } = await db
      .from("promo_codes")
      .select("*")
      .eq("code", promo_code.toUpperCase().trim())
      .maybeSingle();
    promo = data;
  }

  // Price each show on its own. A promo only discounts the shows it applies to.
  // A code with limited uses is spread across the shows in order: each show
  // sees the uses the earlier ones already took.
  let promoLeft = promo;
  const plans = [...groups.values()].map((groupItems) => {
    const performance = groupItems[0].performance;
    const production = productionById.get(performance.production_id)!;
    const cartLines = groupItems.map((i) => ({ ticket_tier: i.ticket_tier as TicketTier, quantity: i.quantity }));
    const pricing = calculatePricing(cartLines, promoLeft, production.id);
    if (promoLeft) promoLeft = { ...promoLeft, times_used: promoLeft.times_used + pricing.promoUses };
    return { groupItems, performance, production, pricing };
  });

  // --- Atomic inventory hold ---
  // Each hold is a single check-and-increment DB statement (see
  // hold_ticket_tier in supabase/schema.sql) with row-level locking, which
  // is what actually prevents two concurrent buyers from both succeeding
  // over the same last seat. If any item fails partway through, roll back
  // the ones that already succeeded so we don't leave phantom holds behind.
  const heldSoFar: { tierId: string; quantity: number }[] = [];
  for (const item of items) {
    const { error: holdError } = await holdTicketTier(db, item.ticket_tier_id, item.quantity);
    if (holdError) {
      await releaseTicketTierHolds(db, heldSoFar);
      const message = holdError.message.includes("insufficient_availability")
        ? `"${item.ticket_tier.label}" no longer has enough availability. Please update your cart.`
        : holdError.message;
      return NextResponse.json({ error: message }, { status: 409 });
    }
    heldSoFar.push({ tierId: item.ticket_tier_id, quantity: item.quantity });
  }

  // Reservations created so far. If a later step fails, these are deleted
  // (the buyer never saw them) and every hold is released. Once ALL of them
  // exist, they are the record of the holds and nothing is rolled back.
  const createdIds: string[] = [];
  let committed = false;
  async function rollback() {
    if (createdIds.length) await db.from("reservations").delete().in("id", createdIds);
    await releaseTicketTierHolds(db, heldSoFar);
  }

  try {
    // Upload payment proof to Storage once; every reservation in the order points at it.
    const proofBytes = new Uint8Array(await proofFile.arrayBuffer());
    const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const proofPath = `payment-proofs/${cart.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await db.storage
      .from("payment-proofs")
      .upload(proofPath, proofBytes, { contentType: proofFile.type });

    if (uploadError) {
      await rollback();
      return NextResponse.json({ error: `Proof upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: proofUrlData } = db.storage.from("payment-proofs").getPublicUrl(proofPath);
    const holdExpiresAt = new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000).toISOString();

    let orderCode = "";
    const emailContexts: Parameters<typeof sendBookingReceivedEmail>[0] = [];

    for (const plan of plans) {
      // Generate a unique reference code (retry on the rare collision)
      let referenceCode = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: codeData } = await db.rpc("generate_reference_code");
        const candidate = codeData as unknown as string;
        const { data: clash } = await db.from("reservations").select("id").eq("reference_code", candidate).maybeSingle();
        if (!clash) {
          referenceCode = candidate;
          break;
        }
      }
      if (!referenceCode) {
        await rollback();
        return NextResponse.json({ error: "Could not generate a reference code, try again." }, { status: 500 });
      }
      if (!orderCode) {
        orderCode = referenceCode;
      }

      const { data: reservation, error: reservationError } = await db
        .from("reservations")
        .insert({
          production_id: plan.production.id,
          performance_id: plan.performance.id,
          reference_code: referenceCode,
          order_code: orderCode,
          profile_id: user?.id ?? null,
          buyer_name,
          buyer_email,
          buyer_phone,
          promo_code_id: plan.pricing.discountAmount > 0 ? promo?.id ?? null : null,
          promo_uses: plan.pricing.discountAmount > 0 ? plan.pricing.promoUses : null,
          subtotal: plan.pricing.subtotal,
          discount_amount: plan.pricing.discountAmount,
          total: plan.pricing.total,
          payment_status: "pending_review",
          booking_source: "public",
          payment_proof_url: proofUrlData.publicUrl,
          hold_expires_at: holdExpiresAt,
        })
        .select()
        .single();

      if (reservationError || !reservation) {
        await rollback();
        return NextResponse.json(
          { error: `Failed to create reservation: ${reservationError?.message}` },
          { status: 500 }
        );
      }
      createdIds.push(reservation.id);

      const { data: reservationItems, error: itemsInsertError } = await db
        .from("reservation_items")
        .insert(
          plan.groupItems.map((i) => ({
            reservation_id: reservation.id,
            ticket_tier_id: i.ticket_tier_id,
            quantity: i.quantity,
            unit_price: i.ticket_tier.price,
            id_proof_path: i.id_proof_path ?? null,
          }))
        )
        .select("*, ticket_tier:ticket_tiers(*)");

      if (itemsInsertError) {
        await rollback();
        return NextResponse.json({ error: itemsInsertError.message }, { status: 500 });
      }

      emailContexts.push({
        reservation,
        production: plan.production,
        performance: plan.performance,
        items: reservationItems,
      });
    }

    // Every reservation exists now - they are the authoritative record of
    // the holds. From here on, errors get logged, not rolled back.
    committed = true;

    // Bump promo usage once per reservation it actually discounted, enforcing
    // max_uses at commit time (defense in depth beyond the eligibility check).
    if (promo) {
      for (const plan of plans) {
        if (plan.pricing.discountAmount <= 0) continue;
        // A fixed-amount code uses up one use per discounted ticket.
        for (let n = 0; n < Math.max(1, plan.pricing.promoUses); n++) {
          const { error: promoError } = await incrementPromoUsage(db, promo.id);
          if (promoError) {
            console.error(`Promo usage increment failed for ${promo.code}:`, promoError.message);
            break;
          }
        }
      }
    }

    // Convert cart, clear items
    await db.from("carts").update({ status: "converted" }).eq("id", cart.id);

    // Email 1 - pending confirmation, no QR yet. One email for the whole
    // order. A failure (bad API key, Resend outage) must not turn a
    // successful booking into a 500; it's recoverable via "Resend email".
    try {
      await sendBookingReceivedEmail(emailContexts);
      await db
        .from("reservations")
        .update({ booking_email_sent_at: new Date().toISOString() })
        .in("id", createdIds);
    } catch (err) {
      console.error("Failed to send booking-received email:", err);
    }

    return NextResponse.json({
      reservation: emailContexts[0].reservation,
      order_code: orderCode,
      count: createdIds.length,
    });
  } catch (err) {
    // Catch-all for anything unexpected thrown (e.g. a network exception
    // during upload). Only roll back if the order never fully committed.
    if (!committed) await rollback();
    console.error("Checkout failed unexpectedly:", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
