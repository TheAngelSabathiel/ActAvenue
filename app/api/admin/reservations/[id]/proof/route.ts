import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";
import { uploadPaymentProof } from "@/lib/payment-proof";
import { withRefresh } from "@/lib/refresh-public";

/** Staff attach (or replace) the payment proof on a pending or confirmed reservation. */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfReservation(id), "foh");
  if (gate.error) return gate.error;

  const file = (await req.formData()).get("payment_proof") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });

  const db = createServiceClient();
  const { data: reservation } = await db.from("reservations").select("id, payment_status").eq("id", id).maybeSingle();
  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (!["pending_review", "confirmed"].includes(reservation.payment_status)) {
    return NextResponse.json({ error: "Reopen this reservation before adding proof." }, { status: 400 });
  }

  const up = await uploadPaymentProof(db, id, file);
  if (up.error) return NextResponse.json({ error: up.error }, { status: 500 });
  const { error } = await db.from("reservations").update({ payment_proof_url: up.url }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment_proof_url: up.url });
}

export const POST = withRefresh(handlePOST);
