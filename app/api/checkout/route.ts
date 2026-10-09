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

  // All items in a single checkout must belong to the same performance/production
  // in this MVP - keeps reservation modeling simple (one performance per order).
  const performanceIds = new Set(items.map((i) => i.performance_id));
  if (performanceIds.size > 1) {
    return NextResponse.json(
      { error: "Please check out one performance at a time." },
      { status: 400 }
    );
  }

  const performance = items[0].performance;
  const { data: production } = await db
    .from("productions")
    .select("*")
    .eq("id", performance.production_id)
    .single();

  if (!production) {
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

  const cartLines = items.map((i) => ({ ticket_tier: i.ticket_tier as TicketTier, quantity: i.quantity }));
  const pricing = calculatePricing(cartLines, promo, production.id);

  // --- Atomic inventory hold ---
  // Each hold is a single check-and-increment DB statement (see
  // hold_ticket_tier in supabase/schema.sql) with row-level locking, which
  // is what actually prevents two concurrent buyers from both succeeding
  // over the same last seat - a plain "read remaining, then decide" in
  // application code has a race window between the read and the write.
  // If any item in a multi-tier cart fails partway through, roll back the
  // ones that already succeeded so we don't leave phantom holds behind.
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

  // From here on, any failure needs to release the holds above before
  // returning - but only until the reservation row itself is successfully
  // created. Once that happens, the reservation IS the record of that hold;
  // an error in a later step (promo bump, cart conversion, email) must not
  // trigger a rollback, or we'd release seats a real, already-existing
  // reservation still legitimately occupies - a double-sell risk in the
  // other direction. This flag is what the outer catch checks.
  let reservationCommitted = false;

  try {
    // Upload payment proof to Storage
    const proofBytes = new Uint8Array(await proofFile.arrayBuffer());
    const proofPath = `payment-proofs/${cart.id}-${Date.now()}-${proofFile.name}`;
    const { error: uploadError } = await db.storage
      .from("payment-proofs")
      .upload(proofPath, proofBytes, { contentType: proofFile.type });

    if (uploadError) {
      await releaseTicketTierHolds(db, heldSoFar);
      return NextResponse.json({ error: `Proof upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: proofUrlData } = db.storage.from("payment-proofs").getPublicUrl(proofPath);

    // Generate a unique reference code (retry on the rare collision)
    let referenceCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: codeData } = await db.rpc("generate_reference_code");
      const candidate = codeData as unknown as string;
      const { data: clash } = await db
        .from("reservations")
        .select("id")
        .eq("reference_code", candidate)
        .maybeSingle();
      if (!clash) {
        referenceCode = candidate;
        break;
      }
    }
    if (!referenceCode) {
      await releaseTicketTierHolds(db, heldSoFar);
      return NextResponse.json({ error: "Could not generate a reference code, try again." }, { status: 500 });
    }

    const holdExpiresAt = new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000).toISOString();

    const { data: reservation, error: reservationError } = await db
      .from("reservations")
      .insert({
        production_id: production.id,
        performance_id: performance.id,
        reference_code: referenceCode,
        profile_id: user?.id ?? null,
        buyer_name,
        buyer_email,
        buyer_phone,
        promo_code_id: promo?.id ?? null,
        subtotal: pricing.subtotal,
        discount_amount: pricing.discountAmount,
        total: pricing.total,
        payment_status: "pending_review",
        booking_source: "public",
        payment_proof_url: proofUrlData.publicUrl,
        hold_expires_at: holdExpiresAt,
      })
      .select()
      .single();

    if (reservationError || !reservation) {
      await releaseTicketTierHolds(db, heldSoFar);
      return NextResponse.json(
        { error: `Failed to create reservation: ${reservationError?.message}` },
        { status: 500 }
      );
    }

    // Reservation items
    const reservationItemsPayload = items.map((i) => ({
      reservation_id: reservation.id,
      ticket_tier_id: i.ticket_tier_id,
      quantity: i.quantity,
      unit_price: i.ticket_tier.price,
    }));
    const { data: reservationItems, error: itemsInsertError } = await db
      .from("reservation_items")
      .insert(reservationItemsPayload)
      .select("*, ticket_tier:ticket_tiers(*)");

    if (itemsInsertError) {
      await releaseTicketTierHolds(db, heldSoFar);
      // Reservation row already exists at this point with no items - leave
      // it as an orphaned pending_review record rather than compounding the
      // error with a delete; it'll fall out via the 24h hold-expiry cron.
      return NextResponse.json({ error: itemsInsertError.message }, { status: 500 });
    }

    // The reservation is now the authoritative record of these holds -
    // from here on, errors get logged, not rolled back.
    reservationCommitted = true;

    // Bump promo usage count atomically, enforcing max_uses at commit time
    // (defense in depth beyond the eligibility check baked into `pricing`).
    if (promo && pricing.discountAmount > 0) {
      const { error: promoError } = await incrementPromoUsage(db, promo.id);
      if (promoError) {
        // Extremely rare: the code hit its usage cap in the moment between
        // validation and commit. The reservation is already valid on its
        // own terms (pricing was computed with the discount) - proceed
        // rather than fail the whole checkout over a promo-usage edge case.
        console.error(`Promo usage increment failed for ${promo.code}:`, promoError.message);
      }
    }

    // Convert cart, clear items
    await db.from("carts").update({ status: "converted" }).eq("id", cart.id);

    // Email 1 - pending confirmation, no QR yet. The reservation itself is
    // already committed at this point; an email failure (bad API key,
    // Resend outage) shouldn't turn a successful booking into a 500 for the
    // buyer - it's recoverable later via the admin "Resend email" button.
    try {
      await sendBookingReceivedEmail({
        reservation,
        production,
        performance,
        items: reservationItems,
      });
      await db
        .from("reservations")
        .update({ booking_email_sent_at: new Date().toISOString() })
        .eq("id", reservation.id);
    } catch (err) {
      console.error("Failed to send booking-received email:", err);
    }

    return NextResponse.json({ reservation });
  } catch (err) {
    // Catch-all safety net for anything unexpected thrown (not a normal
    // {error} return) - e.g. a network exception during upload. Only rolls
    // back holds if the reservation itself was never successfully created;
    // once reservationCommitted is true, the reservation row is the source
    // of truth for those holds and must not be undone here.
    if (!reservationCommitted) {
      await releaseTicketTierHolds(db, heldSoFar);
    }
    console.error("Checkout failed unexpectedly:", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
