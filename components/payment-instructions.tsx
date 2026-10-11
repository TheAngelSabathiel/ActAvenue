import Image from "next/image";
import { IMAGES } from "@/lib/images";
import { PAYMENT } from "@/lib/payment";

export function PaymentInstructions({ total }: { total: number }) {
  return (
    <details open className="aa-card group">
      <summary className="flex items-center justify-between cursor-pointer select-none p-5 font-black uppercase tracking-[0.08em]">
        <span>How to pay</span>
        <i className="bi bi-chevron-down transition-transform group-open:rotate-180" />
      </summary>

      <div className="px-5 pb-5 space-y-5 text-sm">
        <ol className="list-decimal pl-5 space-y-1 mb-0">
          <li>
            Pay the exact total: <span className="font-black">₱{total.toFixed(2)}</span>
          </li>
          <li>Pay by GCash or bank transfer. Scan a QR below or use the account details.</li>
          <li>Screenshot the receipt or confirmation screen.</li>
          <li>Upload that screenshot in the Payment proof field below.</li>
        </ol>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="aa-label mb-0">GCash</p>
            <Image src={IMAGES.paymentGcash} alt="GCash QR code" width={600} height={600} className="w-full max-w-[240px] border-2 border-black" />
            <p className="mb-0">
              {PAYMENT.gcash.name}
              <br />
              <span className="font-bold tabular-nums">{PAYMENT.gcash.number}</span>
            </p>
          </div>
          <div className="space-y-2">
            <p className="aa-label mb-0">Bank transfer</p>
            <Image src={IMAGES.paymentBank} alt="Bank transfer QR code" width={600} height={600} className="w-full max-w-[240px] border-2 border-black" />
            <p className="mb-0">
              {PAYMENT.bank.bankName}
              <br />
              {PAYMENT.bank.accountName}
              <br />
              <span className="font-bold tabular-nums">{PAYMENT.bank.accountNumber}</span>
            </p>
          </div>
        </div>

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
