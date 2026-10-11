import { Resend } from "resend";
import { formatDateTimeLong } from "@/lib/datetime";
import type { Performance, Production, Reservation, ReservationItem, TicketTier } from "@/types/database";

// Lazily constructed: `new Resend(undefined)` throws immediately if
// RESEND_API_KEY isn't set, and Next.js evaluates every route module during
// `next build`'s page-data-collection step - a top-level `new Resend(...)`
// here would fail the ENTIRE production build for anyone who hasn't set up
// email yet (a very plausible first-run state), not just the routes that
// actually send email. Deferring construction to first use means the build
// succeeds regardless, and a genuinely missing key only surfaces when an
// email is actually attempted - which every call site already wraps in
// try/catch, consistent with the rest of this app's email-failure handling.
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM = process.env.EMAIL_FROM ?? "tickets@yourtheater.example";

type ReservationEmailContext = {
  reservation: Reservation;
  production: Production;
  performance: Performance;
  items: (ReservationItem & { ticket_tier: TicketTier })[];
};

function money(n: number) {
  return `PHP ${n.toFixed(2)}`;
}

function itemsList(items: ReservationEmailContext["items"]) {
  return items
    .map((i) => `  - ${i.quantity} x ${i.ticket_tier.label} @ ${money(i.unit_price)}`)
    .join("\n");
}

function showDetails(production: Production, performance: Performance) {
  const when = formatDateTimeLong(performance.datetime);
  return `${production.title}\n${performance.label} - ${when}\n${performance.venue}`;
}

/**
 * Email 1 - sent immediately on booking. No QR yet, status is pending review.
 * One checkout can hold several shows, so it takes one context per show and
 * sends a single email covering all of them.
 */
export async function sendBookingReceivedEmail(input: ReservationEmailContext | ReservationEmailContext[]) {
  const ctxs = Array.isArray(input) ? input : [input];
  const first = ctxs[0];
  const to = first?.reservation.buyer_email;
  if (!first || !to) return null; // admin_manual walk-ins may have no email

  const { reservation, production } = first;
  const grandTotal = ctxs.reduce((sum, c) => sum + c.reservation.total, 0);
  const blocks = ctxs
    .map(
      (c) => `Reference code: ${c.reservation.reference_code}

${showDetails(c.production, c.performance)}

${itemsList(c.items)}

Subtotal for this show: ${money(c.reservation.total)}`
    )
    .join("\n\n----------\n\n");

  const multi = ctxs.length > 1;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: multi
      ? `Booking received - ${ctxs.length} shows (pending confirmation)`
      : `Booking received - ${production.title} (pending confirmation)`,
    text: `Hi ${reservation.buyer_name},

We've received your booking and your payment proof. We confirm payment first. Your e-tickets are sent only after that, in a second email with your QR code${multi ? "s, one per show" : ""}.

${blocks}

${multi ? `Order total: ${money(grandTotal)}\n\n` : ""}${multi ? "Each show gets its own QR code. " : ""}If we can't verify payment within 24 hours, the hold is released automatically.

- Act Avenue`,
  });
}

/** Email 2 - sent when admin approves. Includes QR/e-ticket + full show details. */
export async function sendApprovedEmail(
  ctx: ReservationEmailContext,
  qrCodeUrl: string
) {
  const { reservation, production, performance, items } = ctx;
  if (!reservation.buyer_email) return null;

  return getResend().emails.send({
    from: FROM,
    to: reservation.buyer_email,
    subject: `You're confirmed - ${production.title}`,
    html: `<p>Hi ${reservation.buyer_name},</p>
<p>Your booking is confirmed. Show this QR code at the door.</p>
<p><img src="${qrCodeUrl}" alt="QR code" width="240" height="240" /></p>
<p><strong>Reference code:</strong> ${reservation.reference_code}</p>
<pre>${showDetails(production, performance)}

${itemsList(items)}

Total: ${money(reservation.total)}</pre>
<p>See you at the show!</p>`,
    text: `Hi ${reservation.buyer_name},

Your booking is confirmed! Reference code: ${reservation.reference_code}

${showDetails(production, performance)}

${itemsList(items)}

Total: ${money(reservation.total)}

Your QR e-ticket is attached/embedded in this email - show it at the door.`,
  });
}

/** Email 3 - sent when admin rejects. Asks buyer to re-submit payment proof. */
export async function sendRejectedEmail(ctx: ReservationEmailContext, reuploadUrl: string) {
  const { reservation, production } = ctx;
  if (!reservation.buyer_email) return null;

  return getResend().emails.send({
    from: FROM,
    to: reservation.buyer_email,
    subject: `Action needed - payment proof for ${production.title}`,
    text: `Hi ${reservation.buyer_name},

We weren't able to verify the payment proof for your booking (reference code ${reservation.reference_code}).${
      reservation.rejection_reason ? `\n\nReason: ${reservation.rejection_reason}` : ""
    }

Please re-upload a clear payment proof here:
${reuploadUrl}

Your reserved slot is held while you do this, but may be released if we don't hear back - please act soon.

- ${production.title} team`,
  });
}

/** Reminder - sent ~12h before the 24h hold expires, if still pending_review. */
export async function sendHoldReminderEmail(ctx: ReservationEmailContext) {
  const { reservation, production } = ctx;
  if (!reservation.buyer_email) return null;

  return getResend().emails.send({
    from: FROM,
    to: reservation.buyer_email,
    subject: `Reminder - your ${production.title} booking is still pending`,
    text: `Hi ${reservation.buyer_name},

Just a reminder that your booking (reference code ${reservation.reference_code}) is still pending payment confirmation. Your held tickets will be released if we don't verify payment soon.

- ${production.title} team`,
  });
}

/** Sent when an admin approves an actor's public directory listing. */
export async function sendActorApprovedEmail(email: string, displayName: string | null) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Your profile is live in the cast & crew directory",
    text: `Hi ${displayName ?? "there"},

Your actor profile has been approved and is now visible publicly.

${siteUrl}/actors

You can keep editing your bio, photos, and links any time from Account Settings.

- Act Avenue team`,
  });
}

/** Sent when an admin takes down an actor's public directory listing. */
export async function sendActorTakenDownEmail(email: string, displayName: string | null) {
  return getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Your directory listing has been taken down",
    text: `Hi ${displayName ?? "there"},

Your profile has been removed from the public cast & crew directory. Your profile data itself hasn't been deleted - you can review it any time from Account Settings, and it can be re-approved later.

If you have questions, feel free to reach out to us directly.

- Act Avenue team`,
  });
}
