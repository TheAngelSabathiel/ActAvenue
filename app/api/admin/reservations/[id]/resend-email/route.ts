import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { sendApprovedEmail, sendBookingReceivedEmail, sendRejectedEmail } from "@/lib/email/send";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();

  const { data: reservation, error } = await db
    .from("reservations")
    .select("*, production:productions(*), performance:performances(*)")
    .eq("id", id)
    .single();

  if (error || !reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const { data: items } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("reservation_id", id);

  const ctx = {
    reservation,
    production: reservation.production,
    performance: reservation.performance,
    items: items ?? [],
  };

  // Stage-aware: resend whichever template matches the CURRENT status,
  // not a separate "resend" template (per the MVP spec).
  switch (reservation.payment_status) {
    case "pending_review":
      await sendBookingReceivedEmail(ctx);
      break;
    case "confirmed":
      if (!reservation.qr_code_url) {
        return NextResponse.json(
          { error: "No QR code on file for this confirmed reservation." },
          { status: 400 }
        );
      }
      await sendApprovedEmail(ctx, reservation.qr_code_url);
      break;
    case "rejected": {
      const reuploadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reservation/${reservation.reference_code}/reupload`;
      await sendRejectedEmail(ctx, reuploadUrl);
      break;
    }
    default:
      return NextResponse.json(
        { error: `No email template for status "${reservation.payment_status}".` },
        { status: 400 }
      );
  }

  return NextResponse.json({ ok: true, resent_for_status: reservation.payment_status });
}
