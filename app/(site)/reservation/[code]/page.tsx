import { isTransferred } from "@/lib/transfer";
import { GuestSignupPrompt } from "@/components/guest-signup-prompt";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
import { createServiceClient } from "@/lib/supabase/service";

async function getSiblingCount(orderCode: string | null) {
  if (!orderCode) return 0;
  const db = createServiceClient();
  const { count } = await db.from("reservations").select("id", { count: "exact", head: true }).eq("order_code", orderCode);
  return count ?? 0;
}

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

  const siblings = await getSiblingCount(reservation.order_code);
  const transferred = isTransferred(reservation.rejection_reason);
  const status = transferred
    ? {
        label: "Moved to another show",
        tone: "bg-soft text-muted border border-[#dee2e6]",
        body: `This booking was transferred. ${reservation.rejection_reason?.replace("Transferred to ", "Your new reference code is ")}. This QR code no longer works, please use the new one from your transfer email.`,
      }
    : STATUS_COPY[reservation.payment_status];

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
          {siblings > 1 && (
            <p className="text-sm mt-2 mb-0">
              Part of an order with {siblings} shows.{" "}
              <Link href={`/order/${reservation.order_code}`} className="font-bold underline">View whole order</Link>
            </p>
          )}
        </div>

        <p className="mb-0">{status.body}</p>

        {reservation.payment_status === "confirmed" && (
          <div className="space-y-6 py-4">
            {(reservation.reservation_items as { id: string; quantity: number; qr_code_url?: string | null; ticket_tier: { label: string } }[]).map((item) => {
              const qr = item.qr_code_url ?? reservation.qr_code_url;
              if (!qr) return null;
              return (
                <div key={item.id} className="text-center space-y-2">
                  <p className="font-black mb-0">{item.ticket_tier.label} x {item.quantity}</p>
                  <p className="text-sm text-muted mb-0">
                    {item.quantity === 1 ? "Admits 1 person." : `Admits ${item.quantity} people. This QR scans ${item.quantity} times.`}
                  </p>
                  <div className="flex justify-center">
                    <Image src={qr} alt={`QR code for ${item.ticket_tier.label}`} width={220} height={220} unoptimized className="border-2 border-black" />
                  </div>
                </div>
              );
            })}
            <p className="text-sm font-bold mb-0">
              Share each QR only with the people in your order. It scans only as many times as the quantity, so do not pass it to anyone outside your group.
            </p>
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

        {reservation.payment_status === "rejected" && !transferred && (
          <a href={`/reservation/${reservation.reference_code}/reupload`} className="aa-btn aa-btn-lg w-full">
            Re-upload Payment Proof
          </a>
        )}
      </div>
      <div className="mt-6">
        <GuestSignupPrompt />
      </div>
    </div>
  );
}
