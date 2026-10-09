import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { generateQrPngBuffer } from "@/lib/qr";
import { sendApprovedEmail } from "@/lib/email/send";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Generate + upload QR code encoding just the reference code (see lib/qr.ts).
  // This route is idempotent (operates on an existing reservation id, still
  // pending_review until this succeeds), so unlike manual registration,
  // it's safe for an admin to just retry "Approve" if this fails.
  let qrUrlData: { publicUrl: string };
  try {
    const qrBuffer = await generateQrPngBuffer(reservation.reference_code);
    const qrPath = `qr-codes/${reservation.reference_code}.png`;
    const { error: qrUploadError } = await db.storage
      .from("e-tickets")
      .upload(qrPath, qrBuffer, { contentType: "image/png", upsert: true });

    if (qrUploadError) throw new Error(qrUploadError.message);
    qrUrlData = db.storage.from("e-tickets").getPublicUrl(qrPath).data;
  } catch (err) {
    console.error(`QR generation failed for reservation ${id}:`, err);
    return NextResponse.json({ error: "Failed to generate QR code. Please try approving again." }, { status: 500 });
  }

  const { data: updated, error: updateError } = await db
    .from("reservations")
    .update({
      payment_status: "confirmed",
      qr_code_url: qrUrlData.publicUrl,
    })
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
