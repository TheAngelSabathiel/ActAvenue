import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
import { createServiceClient } from "@/lib/supabase/service";

async function getReservation(code: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("reservations")
    .select("*, production:productions(*), performance:performances(*), reservation_items(*, ticket_tier:ticket_tiers(*))")
    .eq("reference_code", code.toUpperCase())
    .maybeSingle();
  return data;
}

const STATUS_COPY: Record<string, { label: string; tone: string; body: string }> = {
  pending_review: {
    label: "Pending confirmation",
    tone: "bg-accent text-black",
    body: "We are verifying your payment. Your e-ticket QR arrives by email once it is approved, usually within a day.",
  },
  confirmed: {
    label: "Confirmed",
    tone: "bg-success text-white",
    body: "You are all set. Show the QR code below at the door.",
  },
  rejected: {
    label: "Payment not verified",
    tone: "bg-danger text-white",
    body: "We could not verify your payment proof. Please re-upload a clearer copy.",
  },
  expired: {
    label: "Hold expired",
    tone: "bg-soft text-muted border border-[#dee2e6]",
    body: "This hold expired before payment was confirmed. Contact us if you still want these tickets.",
  },
};

export default async function ReservationStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const reservation = await getReservation(code);

  if (!reservation) notFound();

  const status = STATUS_COPY[reservation.payment_status];

  return (
    <div className="aa-container max-w-xl py-12">
      <div className="aa-card p-8 space-y-6">
        <div>
          <span className={`aa-label inline-block px-3 py-1 ${status.tone}`}>{status.label}</span>
          <h1 className="text-2xl mt-4 mb-1">{reservation.production.title}</h1>
          <p className="font-bold mb-0">{reservation.performance.label}</p>
          <p className="mb-0">
            <i className="bi bi-calendar-event" /> {formatDateTime(reservation.performance.datetime)}
          </p>
          <p className="mb-2">
            <i className="bi bi-geo-alt" /> {reservation.performance.venue}
          </p>
          <p className="aa-label text-muted mb-0">Reference code: {reservation.reference_code}</p>
        </div>

        <p className="mb-0">{status.body}</p>

        {reservation.payment_status === "confirmed" && reservation.qr_code_url && (
          <div className="flex justify-center py-4">
            <Image
              src={reservation.qr_code_url}
              alt="E-ticket QR code"
              width={220}
              height={220}
              className="border-2 border-black"
            />
          </div>
        )}

        <div className="border-t-4 border-black pt-4 space-y-1 text-sm">
          {reservation.reservation_items.map((item: { id: string; quantity: number; ticket_tier: { label: string } }) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.quantity} × {item.ticket_tier.label}</span>
            </div>
          ))}
          <div className="flex justify-between text-xl font-black pt-2">
            <span className="uppercase tracking-[0.08em]">Total</span>
            <span>₱{reservation.total.toFixed(2)}</span>
          </div>
        </div>

        {reservation.payment_status === "rejected" && (
          <a href={`/reservation/${reservation.reference_code}/reupload`} className="aa-btn aa-btn-lg w-full">
            Re-upload Payment Proof
          </a>
        )}
      </div>
    </div>
  );
}
