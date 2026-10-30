import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";
import { ensureTicketQrs } from "@/lib/tickets";
import { sendTransferEmail } from "@/lib/email/send";
import { holdTicketTier, releaseTicketTierHold, releaseTicketTierHolds } from "@/lib/inventory";
import { TRANSFER_PREFIX } from "@/lib/transfer";
import { withRefresh } from "@/lib/refresh-public";

/**
 * Moves a confirmed booking to another show of the same production.
 * POST { performance_id }  (admin, or Manager of the production)
 *
 * The new show must have a ticket tier with the same name and enough seats for
 * every line. The booking gets a new reference code and QR, the old booking is
 * marked Rejected (its QR stops working) and its seats are released.
 */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfReservation(id), "manager");
  if (gate.error) return gate.error;

  const { performance_id } = await req.json().catch(() => ({ performance_id: null }));
  if (!performance_id) return NextResponse.json({ error: "Choose the show to move this booking to." }, { status: 400 });

  const db = createServiceClient();
  const { data: old } = await db
    .from("reservations")
    .select("*, production:productions(*), performance:performances(*)")
    .eq("id", id)
    .maybeSingle();
  if (!old) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (old.payment_status !== "confirmed") {
    return NextResponse.json({ error: "Only confirmed bookings can be transferred." }, { status: 400 });
  }
  if (old.checked_in) {
    return NextResponse.json({ error: "This booking is already checked in and can't be transferred." }, { status: 409 });
  }
  if (old.performance_id === performance_id) {
    return NextResponse.json({ error: "That is the show this booking is already on." }, { status: 400 });
  }

  const { data: target } = await db.from("performances").select("*").eq("id", performance_id).maybeSingle();
  if (!target || target.production_id !== old.production_id) {
    return NextResponse.json({ error: "Choose a show from the same production." }, { status: 400 });
  }

  const { data: oldItems } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("reservation_id", id);
  if (!oldItems?.length) return NextResponse.json({ error: "This booking has no tickets." }, { status: 400 });

  if (oldItems.some((i) => (i.scans_used ?? 0) > 0)) {
    return NextResponse.json({ error: "Some tickets were already scanned at the door, so this booking can't be transferred." }, { status: 409 });
  }

  // Match each ticket line to the tier of the same type on the new show.
  const { data: targetTiers } = await db.from("ticket_tiers").select("*").eq("performance_id", performance_id);
  const plan: { oldItem: (typeof oldItems)[number]; newTierId: string }[] = [];
  for (const item of oldItems) {
    const match = (targetTiers ?? []).find(
      (t) => t.tier_type === item.ticket_tier.tier_type
    );
    if (!match) {
      return NextResponse.json(
        { error: `${target.label} has no "${item.ticket_tier.label}" ticket tier, so this booking can't move there.` },
        { status: 409 }
      );
    }
    plan.push({ oldItem: item, newTierId: match.id });
  }

  // Hold seats on the new show first. Nothing else changes if any tier is full.
  const held: { tierId: string; quantity: number }[] = [];
  for (const p of plan) {
    const { error } = await holdTicketTier(db, p.newTierId, p.oldItem.quantity);
    if (error) {
      await releaseTicketTierHolds(db, held);
      const message = error.message.includes("insufficient_availability")
        ? `No slots available on ${target.label} for "${p.oldItem.ticket_tier.label}". The transfer was not done.`
        : error.message;
      return NextResponse.json({ error: message }, { status: 409 });
    }
    held.push({ tierId: p.newTierId, quantity: p.oldItem.quantity });
  }

  const undo = () => releaseTicketTierHolds(db, held);

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
    await undo();
    return NextResponse.json({ error: "Could not generate a reference code, try again." }, { status: 500 });
  }

  const { data: created, error: insertError } = await db
    .from("reservations")
    .insert({
      production_id: old.production_id,
      performance_id,
      reference_code: referenceCode,
      order_code: old.order_code,
      profile_id: old.profile_id,
      buyer_name: old.buyer_name,
      buyer_email: old.buyer_email,
      buyer_phone: old.buyer_phone,
      promo_code_id: old.promo_code_id,
      promo_uses: old.promo_uses ?? null,
      subtotal: old.subtotal,
      discount_amount: old.discount_amount,
      total: old.total,
      payment_status: "confirmed",
      booking_source: old.booking_source,
      payment_proof_url: old.payment_proof_url,
    })
    .select()
    .single();
  if (insertError || !created) {
    await undo();
    return NextResponse.json({ error: insertError?.message ?? "Could not create the new booking." }, { status: 500 });
  }

  const { data: newItems, error: itemsError } = await db
    .from("reservation_items")
    .insert(
      plan.map((p) => ({
        reservation_id: created.id,
        ticket_tier_id: p.newTierId,
        quantity: p.oldItem.quantity,
        unit_price: p.oldItem.unit_price,
        id_proof_path: p.oldItem.id_proof_path ?? null,
        id_proof_paths: p.oldItem.id_proof_paths ?? [],
      }))
    )
    .select("*, ticket_tier:ticket_tiers(*)");
  if (itemsError) {
    await db.from("reservations").delete().eq("id", created.id);
    await undo();
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // One QR per ticket type on the new booking.
  let finalItems = newItems ?? [];
  try {
    finalItems = await ensureTicketQrs(db, created.id, referenceCode);
  } catch (err) {
    console.error(`QR generation failed for transfer of ${id}:`, err);
  }

  // The new booking now holds the seats. Retire the old one and free its seats.
  // Its promo link moves to the new booking so the code's use is not counted twice.
  const { error: retireError } = await db
    .from("reservations")
    .update({
      payment_status: "rejected",
      rejection_reason: `${TRANSFER_PREFIX}${referenceCode} (${target.label})`,
      promo_code_id: null,
      hold_expires_at: null,
    })
    .eq("id", id);
  if (retireError) console.error(`Could not retire ${old.reference_code} after transfer:`, retireError.message);
  for (const item of oldItems) {
    const { error } = await releaseTicketTierHold(db, item.ticket_tier_id, item.quantity);
    if (error) console.error(`Release failed for tier ${item.ticket_tier_id}:`, error.message);
  }

  let emailed = false;
  try {
    const sent = await sendTransferEmail(
      { reservation: created, production: old.production, performance: target, items: finalItems },
      undefined,
      { referenceCode: old.reference_code, performance: old.performance }
    );
    if (sent) {
      emailed = true;
      await db.from("reservations").update({ approval_email_sent_at: new Date().toISOString() }).eq("id", created.id);
    }
  } catch (err) {
    console.error("Failed to send transfer email:", err);
  }

  return NextResponse.json({ reservation: created, emailed });
}

export const POST = withRefresh(handlePOST);
