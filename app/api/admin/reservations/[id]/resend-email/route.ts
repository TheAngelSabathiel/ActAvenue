import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";
import { ensureTicketQrs } from "@/lib/tickets";
import { sendApprovedEmail, sendBookingReceivedEmail, sendRejectedEmail } from "@/lib/email/send";
import { withRefresh } from "@/lib/refresh-public";

async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfReservation(id), "foh");
  if (gate.error) return gate.error;
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
      try {
        ctx.items = await ensureTicketQrs(db, id, reservation.reference_code);
      } catch {
        return NextResponse.json({ error: "Could not prepare the QR codes." }, { status: 500 });
      }
      await sendApprovedEmail(ctx);
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

export const POST = withRefresh(handlePOST);
