import { isTransferred } from "@/lib/transfer";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { holdTicketTier, releaseTicketTierHolds } from "@/lib/inventory";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const formData = await req.formData();
  const proofFile = formData.get("payment_proof") as File | null;

  if (!proofFile) {
    return NextResponse.json({ error: "Payment proof is required." }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: reservation } = await db
    .from("reservations")
    .select("*")
    .eq("reference_code", code.toUpperCase())
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }
  if (reservation.payment_status !== "rejected") {
    return NextResponse.json(
      { error: "Only rejected reservations can re-upload proof here." },
      { status: 400 }
    );
  }

  // One payment proof covers the whole order, so re-uploading reopens every
  // rejected booking that shares this order. Rejection released their holds,
  // so each needs to be re-checked and re-applied - the atomic hold RPC
  // (check + increment in one DB statement) prevents racing a concurrent buyer.
  if (isTransferred(reservation.rejection_reason)) {
    return NextResponse.json(
      { error: "This booking was moved to another show. Please use the new QR code from your transfer email." },
      { status: 400 }
    );
  }

  let targets = [reservation];
  if (reservation.order_code) {
    const { data: siblings } = await db
      .from("reservations")
      .select("*")
      .eq("order_code", reservation.order_code)
      .eq("payment_status", "rejected");
    const live = (siblings ?? []).filter((s) => !isTransferred(s.rejection_reason));
    if (live.length) targets = live;
  }

  const { data: items } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .in("reservation_id", targets.map((t) => t.id));

  const heldSoFar: { tierId: string; quantity: number }[] = [];
  for (const item of items ?? []) {
    const { error: holdError } = await holdTicketTier(db, item.ticket_tier_id, item.quantity);
    if (holdError) {
      await releaseTicketTierHolds(db, heldSoFar);
      const message = holdError.message.includes("insufficient_availability")
        ? `Sorry - "${item.ticket_tier.label}" no longer has enough availability. Please contact us directly.`
        : holdError.message;
      return NextResponse.json({ error: message }, { status: 409 });
    }
    heldSoFar.push({ tierId: item.ticket_tier_id, quantity: item.quantity });
  }

  const proofBytes = new Uint8Array(await proofFile.arrayBuffer());
  const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const proofPath = `payment-proofs/${reservation.id}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await db.storage
    .from("payment-proofs")
    .upload(proofPath, proofBytes, { contentType: proofFile.type });

  if (uploadError) {
    await releaseTicketTierHolds(db, heldSoFar);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: proofUrlData } = db.storage.from("payment-proofs").getPublicUrl(proofPath);

  // Buyer re-submitting proof reopens it for admin review - same state as
  // the admin-initiated "Reopen" action, just triggered from the buyer side.
  const { data: updatedRows, error } = await db
    .from("reservations")
    .update({
      payment_proof_url: proofUrlData.publicUrl,
      payment_status: "pending_review",
      reopened_at: new Date().toISOString(),
      hold_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .in("id", targets.map((t) => t.id))
    .select();

  if (error) {
    await releaseTicketTierHolds(db, heldSoFar);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservation: updatedRows?.find((r) => r.id === reservation.id) ?? updatedRows?.[0] });
}
