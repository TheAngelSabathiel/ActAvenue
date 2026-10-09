import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { generateQrPngBuffer } from "@/lib/qr";
import { sendApprovedEmail, sendBookingReceivedEmail } from "@/lib/email/send";
import { holdTicketTier, releaseTicketTierHolds } from "@/lib/inventory";

export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const {
    performance_id,
    buyer_name,
    buyer_email, // optional - walk-ins may have none
    buyer_phone,
    status, // "confirmed" | "pending_review" - admin decides
    items, // [{ ticket_tier_id, quantity }]
  } = await req.json();

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

  const tierIds = items.map((i: { ticket_tier_id: string }) => i.ticket_tier_id);
  const { data: tiers } = await db.from("ticket_tiers").select("*").in("id", tierIds);
  const tierMap = new Map((tiers ?? []).map((t) => [t.id, t]));

  for (const item of items) {
    if (!tierMap.get(item.ticket_tier_id)) {
      return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });
    }
  }
  const subtotal = items.reduce(
    (sum: number, item: { ticket_tier_id: string; quantity: number }) =>
      sum + tierMap.get(item.ticket_tier_id)!.price * item.quantity,
    0
  );

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
      discount_amount: 0,
      total: subtotal,
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
      const qrBuffer = await generateQrPngBuffer(referenceCode);
      const qrPath = `qr-codes/${referenceCode}.png`;
      const { error: qrUploadError } = await db.storage.from("e-tickets").upload(qrPath, qrBuffer, {
        contentType: "image/png",
        upsert: true,
      });
      if (qrUploadError) throw new Error(qrUploadError.message);

      const { data: qrUrlData } = db.storage.from("e-tickets").getPublicUrl(qrPath);
      await db
        .from("reservations")
        .update({ qr_code_url: qrUrlData.publicUrl })
        .eq("id", reservation.id);

      // Reservation + QR are already committed at this point - an email
      // failure shouldn't fail the registration itself.
      if (buyer_email) {
        try {
          await sendApprovedEmail(ctx, qrUrlData.publicUrl);
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

  return NextResponse.json({ reservation });
}
