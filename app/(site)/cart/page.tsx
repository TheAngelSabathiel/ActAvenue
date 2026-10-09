"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/hooks/use-cart";

export default function CartPage() {
  const { items, loading, updateQuantity, removeItem, total } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<
    { valid: boolean; reason?: string; pricing?: { discountAmount: number; total: number } } | null
  >(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  async function checkPromo() {
    if (!promoCode.trim() || !items.length) return;
    setCheckingPromo(true);
    const res = await fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: promoCode,
        production_id: items[0]?.performance.production_id,
        lines: items.map((i) => ({ ticket_tier_id: i.ticket_tier_id, quantity: i.quantity })),
      }),
    });
    const data = await res.json();
    setPromoResult(data);
    setCheckingPromo(false);
  }

  return (
    <div className="aa-container max-w-3xl py-12">
      <h1 className="text-3xl mb-2">Your Cart</h1>
      <hr className="aa-divider" />

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && items.length === 0 && (
        <div className="aa-card p-10 text-center">
          <p className="font-bold uppercase tracking-[0.08em] mb-4">Your cart is empty</p>
          <Link href="/#now-showing" className="aa-btn">Browse Shows</Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="aa-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-black mb-0">{item.ticket_tier.label}</p>
                <p className="text-sm text-muted mb-0">
                  {item.performance.label} - ₱{item.ticket_tier.price.toFixed(2)} each
                </p>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                  className="aa-input !w-20"
                  aria-label="Quantity"
                />
                <button onClick={() => removeItem(item.id)} className="aa-btn aa-btn-outline aa-btn-sm">
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="pt-6 border-t-4 border-black space-y-4">
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="PROMO CODE"
                className="aa-input flex-1 uppercase"
              />
              <button onClick={checkPromo} disabled={checkingPromo} className="aa-btn aa-btn-outline">
                Apply
              </button>
            </div>
            {promoResult && !promoResult.valid && (
              <p className="text-sm text-danger font-bold mb-0">{promoResult.reason}</p>
            )}
            {promoResult?.valid && promoResult.pricing && (
              <p className="text-sm text-success font-bold mb-0">
                Code applied. You save ₱{promoResult.pricing.discountAmount.toFixed(2)}
              </p>
            )}

            <div className="flex items-center justify-between text-2xl font-black">
              <span className="uppercase tracking-[0.08em]">Total</span>
              <span>₱{(promoResult?.valid ? promoResult.pricing?.total ?? total : total).toFixed(2)}</span>
            </div>

            <Link
              href={`/checkout?promo=${encodeURIComponent(promoResult?.valid ? promoCode : "")}`}
              className="aa-btn aa-btn-lg w-full"
            >
              Proceed to Checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
