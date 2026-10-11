import Image from "next/image";
import { resolvePayment, type PaymentGroup } from "@/lib/payment";

function Accounts({ group }: { group: PaymentGroup }) {
  const { gcash, bank } = group.details;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="aa-label mb-0">GCash</p>
        <Image src={gcash.qr} alt="GCash QR code" width={600} height={600} unoptimized className="w-full max-w-[240px] border-2 border-black" />
        <p className="mb-0">
          {gcash.name}
          <br />
          <span className="font-bold tabular-nums">{gcash.number}</span>
        </p>
      </div>
      <div className="space-y-2">
        <p className="aa-label mb-0">Bank transfer</p>
        <Image src={bank.qr} alt="Bank transfer QR code" width={600} height={600} unoptimized className="w-full max-w-[240px] border-2 border-black" />
        <p className="mb-0">
          {bank.bankName}
          <br />
          {bank.accountName}
          <br />
          <span className="font-bold tabular-nums">{bank.accountNumber}</span>
        </p>
      </div>
    </div>
  );
}

export function PaymentInstructions({ total, payments }: { total: number; payments?: PaymentGroup[] }) {
  const groups: PaymentGroup[] = payments?.length
    ? payments
    : [{ titles: [], total, details: resolvePayment(null) }];
  const split = groups.length > 1;

  return (
    <details open className="aa-card group">
      <summary className="flex items-center justify-between cursor-pointer select-none p-5 font-black uppercase tracking-[0.08em]">
        <span>How to pay</span>
        <i className="bi bi-chevron-down transition-transform group-open:rotate-180" />
      </summary>

      <div className="px-5 pb-5 space-y-5 text-sm">
        <ol className="list-decimal pl-5 space-y-1 mb-0">
          <li>
            {split ? "Pay each amount below to its own account. Total: " : "Pay the exact total: "}
            <span className="font-black">₱{total.toFixed(2)}</span>
          </li>
          <li>Pay by GCash or bank transfer. Scan a QR or use the account details.</li>
          <li>Screenshot the receipt or confirmation screen.{split && " Put all your receipts in one screenshot or PDF."}</li>
          <li>Upload that file in the Payment proof field below.</li>
        </ol>

        {groups.map((g, i) => (
          <div key={i} className="space-y-3">
            {split && (
              <p className="font-black mb-0">
                {g.titles.join(", ") || "Your shows"}: ₱{g.total.toFixed(2)}
              </p>
            )}
            <Accounts group={g} />
          </div>
        ))}

        <div className="border-t-2 border-black pt-4 space-y-2">
          <p className="font-bold mb-0">Your proof must show</p>
          <ul className="list-disc pl-5 space-y-1 mb-0">
            <li>The amount paid</li>
            <li>The date and time</li>
            <li>The reference or transaction number</li>
          </ul>
        </div>

        <p className="bg-accent px-4 py-3 font-bold mb-0">
          We confirm your payment first. Tickets are sent only after that. You get a booking email now, then your e-tickets once payment is confirmed, usually within 24 hours.
        </p>
      </div>
    </details>
  );
}
