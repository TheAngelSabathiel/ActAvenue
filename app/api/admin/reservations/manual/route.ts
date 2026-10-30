import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { ensureTicketQrs } from "@/lib/tickets";
import { sendApprovedEmail, sendBookingReceivedEmail } from "@/lib/email/send";
import { holdTicketTier, releaseTicketTierHolds } from "@/lib/inventory";
import { withRefresh } from "@/lib/refresh-public";
import { incrementPromoUsage } from "@/lib/inventory";
import { calculatePricing } from "@/lib/pricing";
import { uploadPaymentProof } from "@/lib/payment-proof";

async function handlePOST(req: NextRequest) {
  const form = await req.formData();
  const performance_id = form.get("performance_id") as string | null;
  const buyer_name = form.get("buyer_name") as string | null;
  const buyer_email = (form.get("buyer_email") as string | null) || null; // optional - walk-ins may have none
  const buyer_phone = (form.get("buyer_phone") as string | null) || null;
  const status = form.get("status") as string | null; // "confirmed" | "pending_review" - admin decides
  const promoCode = ((form.get("promo_code") as string | null) ?? "").toUpperCase().trim();
  const proofFile = form.get("payment_proof") as File | null;
  let items: { ticket_tier_id: string; quantity: number }[] = [];
  try {
    items = JSON.parse((form.get("items") as string) || "[]");
  } catch {
    /* handled below */
  }

  if (!performance_id || !buyer_name || !items?.length || !status) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!["confirmed", "pending_review"].includes(status)) {
    return NextResponse.json({ error: "status must be confirmed or pending_review" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: performance } = await db
    .from("performances")
    .select("*")
    .eq("id", performance_id)
    .single();
  if (!performance) return NextResponse.json({ error: "Performance not found" }, { status: 404 });

  const { data: production } = await db
    .from("productions")
    .select("*")
    .eq("id", performance.production_id)
    .single();
  if (!production) return NextResponse.json({ error: "Production not found" }, { status: 404 });

  const gate = await requireProduction(production.id, "foh");
  if (gate.error) return gate.error;

  const tierIds = items.map((i: { ticket_tier_id: string }) => i.ticket_tier_id);
  const { data: tiers } = await db.from("ticket_tiers").select("*").in("id", tierIds);
  const tierMap = new Map((tiers ?? []).map((t) => [t.id, t]));

  for (const item of items) {
    if (!tierMap.get(item.ticket_tier_id)) {
      return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });
    }
  }
  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
    return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
  }

  // Optional promo code, same rules as public checkout.
  let promo = null;
  if (promoCode) {
    const { data } = await db.from("promo_codes").select("*").eq("code", promoCode).maybeSingle();
    if (!data) return NextResponse.json({ error: "Promo code not found." }, { status: 400 });
    promo = data;
  }
  const pricing = calculatePricing(
    items.map((i) => ({ ticket_tier: tierMap.get(i.ticket_tier_id)!, quantity: i.quantity })),
    promo,
    production.id
  );
  if (promo && pricing.discountAmount <= 0) {
    return NextResponse.json(
      { error: pricing.rejectedPromoReason ?? "This code doesn't apply to the selected tickets." },
      { status: 400 }
    );
  }
  const { subtotal, discountAmount, total } = pricing;

  // Atomic hold per item (check + increment in one DB statement), same
  // pattern as public checkout - a confirmed walk-in occupies a real seat,
  // so this needs the same race protection as any other booking. Roll back
  // anything already held if a later item in the batch fails.
  const heldSoFar: { tierId: string; quantity: number }[] = [];
  for (const item of items) {
    const tier = tierMap.get(item.ticket_tier_id);
    const { error: holdError } = await holdTicketTier(db, item.ticket_tier_id, item.quantity);
    if (holdError) {
      await releaseTicketTierHolds(db, heldSoFar);
      const message = holdError.message.includes("insufficient_availability")
        ? `"${tier.label}" only has limited availability left.`
        : holdError.message;
      return NextResponse.json({ error: message }, { status: 409 });
    }
    heldSoFar.push({ tierId: item.ticket_tier_id, quantity: item.quantity });
  }

  // Retry on the rare collision, same as the public checkout route.
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

  const { data: reservation, error: reservationError } = await db
    .from("reservations")
    .insert({
      production_id: production.id,
      performance_id: performance.id,
      reference_code: referenceCode,
      buyer_name,
      buyer_email: buyer_email || null,
      buyer_phone: buyer_phone || null,
      subtotal,
      discount_amount: discountAmount,
      total,
      promo_code_id: promo ? promo.id : null,
      promo_uses: promo ? pricing.promoUses : null,
      payment_status: status,
      booking_source: "admin_manual",
      hold_expires_at: status === "pending_review"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
    })
    .select()
    .single();

  if (reservationError || !reservation) {
    await releaseTicketTierHolds(db, heldSoFar);
    return NextResponse.json({ error: reservationError?.message }, { status: 500 });
  }

  if (promo) {
    for (let n = 0; n < Math.max(1, pricing.promoUses); n++) {
      const { error: promoError } = await incrementPromoUsage(db, promo.id);
      if (promoError) {
        console.error(`Promo usage increment failed for ${promo.code}:`, promoError.message);
        break;
      }
    }
  }

  // Optional payment proof. The booking already exists, so a failed upload is
  // reported but does not undo it; staff can add the proof from Reservations.
  let proofWarning: string | undefined;
  if (proofFile && proofFile.size) {
    const up = await uploadPaymentProof(db, reservation.id, proofFile);
    if (up.url) {
      await db.from("reservations").update({ payment_proof_url: up.url }).eq("id", reservation.id);
      reservation.payment_proof_url = up.url;
    } else {
      proofWarning = `Reservation created, but the proof was not saved: ${up.error}`;
    }
  }

  const reservationItemsPayload = items.map((i: { ticket_tier_id: string; quantity: number }) => ({
    reservation_id: reservation.id,
    ticket_tier_id: i.ticket_tier_id,
    quantity: i.quantity,
    unit_price: tierMap.get(i.ticket_tier_id)!.price,
  }));
  const { data: reservationItems, error: itemsInsertError } = await db
    .from("reservation_items")
    .insert(reservationItemsPayload)
    .select("*, ticket_tier:ticket_tiers(*)");

  if (itemsInsertError) {
    await releaseTicketTierHolds(db, heldSoFar);
    return NextResponse.json({ error: itemsInsertError.message }, { status: 500 });
  }

  const ctx = {
    reservation,
    production,
    performance,
    items: reservationItems ?? [],
  };

  if (status === "confirmed") {
    // Generate QR immediately, same as the approval step. This is wrapped
    // because, unlike the approve route (which is idempotent - retrying
    // just re-runs against the same existing reservation id), this route
    // creates a brand-new reservation each call. If QR generation threw
    // here uncaught, an admin seeing a 500 after the reservation/hold were
    // already committed could reasonably retry and create a duplicate
    // booking for the same walk-in. So: log and continue without a QR
    // rather than fail the whole registration over it.
    try {
      const ticketItems = await ensureTicketQrs(db, reservation.id, referenceCode);
      ctx.items = ticketItems;

      // Reservation + QR are already committed at this point - an email
      // failure shouldn't fail the registration itself.
      if (buyer_email) {
        try {
          await sendApprovedEmail(ctx);
          await db
            .from("reservations")
            .update({ approval_email_sent_at: new Date().toISOString() })
            .eq("id", reservation.id);
        } catch (err) {
          console.error("Failed to send approval email for manual registration:", err);
        }
      }
      // No email + no QR delivered: door check-in falls back to reference-code/name lookup for this entry.
    } catch (err) {
      console.error(`QR generation failed for manual registration ${reservation.id}:`, err);
      // The reservation itself is still valid and confirmed - just without
      // a QR yet. It's recoverable: re-approving isn't wired for confirmed
      // reservations, but check-in can fall back to reference-code lookup,
      // and this is a rare failure mode (storage outage) worth surfacing
      // in logs rather than the admin's face as a hard error.
    }
  } else if (buyer_email) {
    try {
      await sendBookingReceivedEmail(ctx);
      await db
        .from("reservations")
        .update({ booking_email_sent_at: new Date().toISOString() })
        .eq("id", reservation.id);
    } catch (err) {
      console.error("Failed to send booking-received email for manual registration:", err);
    }
  }

  return NextResponse.json({ reservation, proofWarning });
}

export const POST = withRefresh(handlePOST);
