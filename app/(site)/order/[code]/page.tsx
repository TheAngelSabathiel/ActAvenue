import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
import { createServiceClient } from "@/lib/supabase/service";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending confirmation",
  confirmed: "Confirmed",
  rejected: "Payment not verified",
  expired: "Hold expired",
};

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = createServiceClient();
  const { data } = await db
    .from("reservations")
    .select("*, production:productions(title), performance:performances(label, datetime, venue), reservation_items(id, quantity, ticket_tier:ticket_tiers(label))")
    .eq("order_code", code.toUpperCase())
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) notFound();

  const total = data.reduce((sum, r) => sum + r.total, 0);
  const pending = data.some((r) => r.payment_status === "pending_review");

  return (
    <div className="aa-container max-w-xl py-12 space-y-6">
      <div>
        <h1 className="text-3xl mb-2">Your Order</h1>
        <hr className="aa-divider" />
        <p className="mb-0">
          {pending
            ? "We confirm your payment first. Your e-tickets are emailed only after that, usually within a day."
            : "Open each booking below to see its QR code."}
        </p>
      </div>

      {data.map((r) => (
        <Link key={r.id} href={`/reservation/${r.reference_code}`} className="aa-card aa-lift p-6 block space-y-1">
          <p className="aa-label text-muted mb-1">{STATUS_LABEL[r.payment_status]}</p>
          <p className="font-black text-xl mb-0">{r.production.title}</p>
          <p className="font-bold mb-0">{r.performance.label}</p>
          <p className="text-sm mb-2">{formatDateTime(r.performance.datetime)} - {r.performance.venue}</p>
          <p className="text-sm text-muted mb-0">
            {r.reservation_items.map((i: { quantity: number; ticket_tier: { label: string } }) => `${i.quantity} × ${i.ticket_tier.label}`).join(", ")}
          </p>
          <p className="aa-label text-muted mb-0">Reference code: {r.reference_code}</p>
        </Link>
      ))}

      <div className="flex justify-between text-xl font-black border-t-4 border-black pt-3">
        <span className="uppercase tracking-[0.08em]">Order total</span>
        <span>₱{total.toFixed(2)}</span>
      </div>
    </div>
  );
}
