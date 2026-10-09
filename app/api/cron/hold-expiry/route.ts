import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendHoldReminderEmail } from "@/lib/email/send";
import { releaseTicketTierHold } from "@/lib/inventory";

/**
 * Vercel Cron calls this with GET and sends `Authorization: Bearer $CRON_SECRET`
 * automatically when CRON_SECRET is set. POST is kept for manual triggers
 * (cron-job.org, curl). Without CRON_SECRET the route refuses every request.
 *
 * vercel.json ships a daily schedule because the Hobby plan allows one run
 * per day. On Pro, change it to "*\/30 * * * *".
 */
async function handler(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const now = new Date();
  const remindAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // reminder ~12h before expiry

  // --- Reminders: pending_review, hold expires within the next 12h, not yet reminded ---
  const { data: dueForReminder } = await db
    .from("reservations")
    .select("*, production:productions(*), performance:performances(*)")
    .eq("payment_status", "pending_review")
    .is("reminder_email_sent_at", null)
    .lte("hold_expires_at", remindAt.toISOString())
    .gt("hold_expires_at", now.toISOString());

  for (const reservation of dueForReminder ?? []) {
    const { data: items } = await db
      .from("reservation_items")
      .select("*, ticket_tier:ticket_tiers(*)")
      .eq("reservation_id", reservation.id);

    // Catch per-reservation: one failed send (bad email, Resend hiccup)
    // shouldn't stop the reminder pass for the rest of the batch, or
    // prevent the expiry pass below from running at all.
    try {
      await sendHoldReminderEmail({
        reservation,
        production: reservation.production,
        performance: reservation.performance,
        items: items ?? [],
      });
      await db
        .from("reservations")
        .update({ reminder_email_sent_at: now.toISOString() })
        .eq("id", reservation.id);
    } catch (err) {
      console.error(`Failed to send hold reminder for reservation ${reservation.id}:`, err);
    }
  }

  // --- Expiry: pending_review, hold_expires_at has passed -> release inventory ---
  const { data: expired } = await db
    .from("reservations")
    .select("*, reservation_items(*, ticket_tier:ticket_tiers(*))")
    .eq("payment_status", "pending_review")
    .lte("hold_expires_at", now.toISOString());

  for (const reservation of expired ?? []) {
    for (const item of reservation.reservation_items) {
      const { error: releaseError } = await releaseTicketTierHold(db, item.ticket_tier_id, item.quantity);
      if (releaseError) {
        console.error(`Failed to release expired hold for tier ${item.ticket_tier_id}:`, releaseError.message);
      }
    }
    // Record stays forever (no hard delete) and remains reopenable by admin.
    await db.from("reservations").update({ payment_status: "expired" }).eq("id", reservation.id);
  }

  return NextResponse.json({
    reminded: dueForReminder?.length ?? 0,
    expired: expired?.length ?? 0,
  });
}

export const GET = handler;
export const POST = handler;
