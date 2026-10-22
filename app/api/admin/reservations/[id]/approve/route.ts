import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";
import { ensureTicketQrs } from "@/lib/tickets";
import { sendApprovedEmail } from "@/lib/email/send";
import { withRefresh } from "@/lib/refresh-public";

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // One QR per ticket type (see lib/tickets.ts). Idempotent, so an admin can
  // simply press Approve again if this fails.
  let ticketItems;
  try {
    ticketItems = await ensureTicketQrs(db, id, reservation.reference_code);
  } catch (err) {
    console.error(`QR generation failed for reservation ${id}:`, err);
    return NextResponse.json({ error: "Failed to generate QR code. Please try approving again." }, { status: 500 });
  }
  const qrUrlData = { publicUrl: ticketItems[0]?.qr_code_url ?? "" };

  const { data: updated, error: updateError } = await db
    .from("reservations")
    .update({
      payment_status: "confirmed",
      qr_code_url: qrUrlData.publicUrl || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message }, { status: 500 });
  }

  const items = ticketItems;

  // The approval (status + QR) is already committed at this point - an
  // email failure shouldn't fail the approval itself; recoverable via the
  // admin "Resend email" button.
  try {
    await sendApprovedEmail(
      {
        reservation: updated,
        production: reservation.production,
        performance: reservation.performance,
        items: items ?? [],
      },
      qrUrlData.publicUrl
    );
    await db
      .from("reservations")
      .update({ approval_email_sent_at: new Date().toISOString() })
      .eq("id", id);
  } catch (err) {
    console.error("Failed to send approval email:", err);
  }

  return NextResponse.json({ reservation: updated });
}

export const POST = withRefresh(handlePOST);
