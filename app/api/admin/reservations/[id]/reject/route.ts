import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { sendRejectedEmail } from "@/lib/email/send";
import { releaseTicketTierHold } from "@/lib/inventory";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({ reason: null }));

  const db = createServiceClient();

  const { data: reservation, error } = await db
    .from("reservations")
    .select("*, production:productions(*), performance:performances(*)")
    .eq("id", id)
    .single();

  if (error || !reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await db
    .from("reservations")
    .update({ payment_status: "rejected", rejection_reason: reason ?? null })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message }, { status: 500 });
  }

  const { data: items } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("reservation_id", id);

  // Release the inventory hold immediately on rejection. A rejected
  // reservation may sit indefinitely if the buyer never re-uploads proof -
  // the hold-expiry cron only scans `pending_review` reservations, so a
  // rejected one would otherwise hold a seat forever. Reopening (by admin
  // or via buyer reupload) re-checks and re-applies the hold at that point.
  // Uses the atomic release RPC rather than read-then-write arithmetic in
  // application code, which would race against a concurrent hold/release
  // on the same tier.
  for (const item of items ?? []) {
    const { error: releaseError } = await releaseTicketTierHold(db, item.ticket_tier_id, item.quantity);
    if (releaseError) console.error(`Failed to release hold for tier ${item.ticket_tier_id}:`, releaseError.message);
  }

  const reuploadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reservation/${updated.reference_code}/reupload`;

  // Rejection (and its inventory release) is already committed - an email
  // failure shouldn't fail the rejection itself.
  try {
    await sendRejectedEmail(
      {
        reservation: updated,
        production: reservation.production,
        performance: reservation.performance,
        items: items ?? [],
      },
      reuploadUrl
    );
    await db
      .from("reservations")
      .update({ rejection_email_sent_at: new Date().toISOString() })
      .eq("id", id);
  } catch (err) {
    console.error("Failed to send rejection email:", err);
  }

  return NextResponse.json({ reservation: updated });
}
