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

  // Rejection released this reservation's inventory hold, so re-uploading
  // needs to re-check and re-apply it - the atomic hold RPC (check +
  // increment in one DB statement) prevents this from racing against a
  // concurrent booking for the same tier in the meantime.
  const { data: items } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("reservation_id", reservation.id);

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
  const proofPath = `payment-proofs/${reservation.id}-${Date.now()}-${proofFile.name}`;
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
  const { data: updated, error } = await db
    .from("reservations")
    .update({
      payment_proof_url: proofUrlData.publicUrl,
      payment_status: "pending_review",
      reopened_at: new Date().toISOString(),
      hold_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", reservation.id)
    .select()
    .single();

  if (error) {
    await releaseTicketTierHolds(db, heldSoFar);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservation: updated });
}
