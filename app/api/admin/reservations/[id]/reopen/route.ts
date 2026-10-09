import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { holdTicketTier, releaseTicketTierHolds } from "@/lib/inventory";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();

  const { data: reservation } = await db.from("reservations").select("*").eq("id", id).single();

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (!["rejected", "expired"].includes(reservation.payment_status)) {
    return NextResponse.json(
      { error: "Only rejected or expired reservations can be reopened." },
      { status: 400 }
    );
  }

  // Both rejected and expired reservations release their inventory hold
  // (rejected: immediately on rejection; expired: via the hold-expiry cron).
  // Reopening either needs to re-check and re-apply the hold, since someone
  // else may have since booked those seats in the meantime. Uses the atomic
  // hold RPC (check + increment in one DB statement) rather than a separate
  // read-then-write pair, so this can't race against a concurrent booking
  // for the same tier the way the old two-step version could.
  const { data: items } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("reservation_id", id);

  const heldSoFar: { tierId: string; quantity: number }[] = [];
  for (const item of items ?? []) {
    const { error: holdError } = await holdTicketTier(db, item.ticket_tier_id, item.quantity);
    if (holdError) {
      await releaseTicketTierHolds(db, heldSoFar);
      const message = holdError.message.includes("insufficient_availability")
        ? `Can't reopen - "${item.ticket_tier.label}" no longer has enough availability.`
        : holdError.message;
      return NextResponse.json({ error: message }, { status: 409 });
    }
    heldSoFar.push({ tierId: item.ticket_tier_id, quantity: item.quantity });
  }

  const { data: updated, error } = await db
    .from("reservations")
    .update({
      payment_status: "pending_review",
      reopened_at: new Date().toISOString(),
      hold_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    await releaseTicketTierHolds(db, heldSoFar);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservation: updated });
}
