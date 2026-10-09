"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/hooks/use-cart";
import { createClient } from "@/lib/supabase/client";

// useSearchParams() requires a Suspense boundary in the App Router - without
// it, `next build` fails prerendering this route entirely (not just a
// runtime warning). CheckoutForm is split out so Suspense can wrap just the
// part that needs it, with everything above the fold (header) rendering
// immediately.
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutForm />
    </Suspense>
  );
}

function CheckoutFallback() {
  return (
    <div className="aa-container max-w-2xl py-12">
      <p className="text-muted">Loading...</p>
    </div>
  );
}

function CheckoutForm() {
  const { items, total } = useCart();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string>("");

  // If the buyer is signed in, prefill their details - still editable, and
  // still not required to be signed in at all (guest checkout always works,
  // email is required either way to receive the booking/e-ticket).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setAccountEmail(data.user.email ?? null);
        setAccountName((data.user.user_metadata?.display_name as string) ?? "");
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const promo = searchParams.get("promo");
    if (promo) formData.set("promo_code", promo);

    const res = await fetch("/api/checkout", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    router.push(`/reservation/${data.reservation.reference_code}`);
  }

  const label = "aa-label block mb-1";
  return (
    <div className="aa-container max-w-2xl py-12">
      <h1 className="text-3xl mb-2">Checkout</h1>
      <hr className="aa-divider" />
      <p className="text-muted mb-8">
        {accountEmail
          ? "You are signed in. This booking links to your account."
          : "Add your details and payment proof in one step. No account needed."}
      </p>

      <div className="aa-card p-6 mb-8">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm py-1">
            <span>{item.quantity} × {item.ticket_tier.label}</span>
            <span className="font-bold">₱{(item.ticket_tier.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between text-xl font-black pt-3 mt-3 border-t-4 border-black">
          <span className="uppercase tracking-[0.08em]">Total</span>
          <span>₱{total.toFixed(2)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" encType="multipart/form-data">
        <div>
          <label className={label}>Full name</label>
          <input name="buyer_name" defaultValue={accountName} key={accountName} required className="aa-input" />
        </div>
        <div>
          <label className={label}>Email</label>
          <input type="email" name="buyer_email" defaultValue={accountEmail ?? ""} key={accountEmail} required className="aa-input" />
          <p className="text-xs text-muted mt-1 mb-0">Your confirmation and e-ticket QR go here.</p>
        </div>
        <div>
          <label className={label}>Phone</label>
          <input name="buyer_phone" className="aa-input" />
        </div>
        <div>
          <label className={label}>Payment proof</label>
          <input type="file" name="payment_proof" accept="image/*,application/pdf" required className="aa-input" />
          <p className="text-xs text-muted mt-1 mb-0">
            Screenshot of your GCash or bank transfer. We review it, then email you either way.
          </p>
        </div>

        {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}

        <button type="submit" disabled={submitting || items.length === 0} className="aa-btn aa-btn-lg w-full">
          {submitting ? "Submitting..." : "Submit Booking"}
        </button>
      </form>
    </div>
  );
}
