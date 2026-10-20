"use client";

import { toast } from "@/lib/toast";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { formatDayLong, formatTime } from "@/lib/datetime";
import Link from "next/link";
import { useCart } from "@/lib/hooks/use-cart";

export default function CartPage() {
  const { items, loading, updateQuantity, removeItem, total } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<
    { valid: boolean; reason?: string; discount: number } | null
  >(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  // Promo codes are per production, so check each production in the cart
  // separately and add up what the code saves.
  async function checkPromo() {
    if (!promoCode.trim() || !items.length) return;
    setCheckingPromo(true);
    const byProduction = new Map<string, typeof items>();
    for (const i of items) {
      const key = i.performance.production_id;
      byProduction.set(key, [...(byProduction.get(key) ?? []), i]);
    }
    let discount = 0;
    let reason: string | undefined;
    for (const [production_id, group] of byProduction) {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode,
          production_id,
          lines: group.map((i) => ({ ticket_tier_id: i.ticket_tier_id, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (data.valid && data.pricing) discount += data.pricing.discountAmount;
      else reason = reason ?? data.reason ?? data.error;
    }
    setPromoResult(discount > 0 ? { valid: true, discount } : { valid: false, reason, discount: 0 });
    if (discount > 0) toast.success(`Promo code applied. You save ₱${discount.toFixed(2)}.`);
    else toast.error(reason ?? "That code can't be used here.");
    setCheckingPromo(false);
  }

  // Group lines by show so a mixed cart reads clearly.
  const shows = new Map<string, { title: string; performance: string; when: string; venue: string; lines: typeof items }>();
  for (const i of items) {
    const entry = shows.get(i.performance_id) ?? {
      title: i.performance.production?.title ?? "",
      performance: i.performance.label,
      when: `${formatDayLong(i.performance.datetime)}, ${formatTime(i.performance.datetime)}`,
      venue: i.performance.venue,
      lines: [],
    };
    entry.lines.push(i);
    shows.set(i.performance_id, entry);
  }
  const discount = promoResult?.valid ? promoResult.discount : 0;

  return (
    <div className="aa-container max-w-3xl py-12">
      <h1 className="text-3xl mb-2">Your Cart</h1>
      <hr className="aa-divider" />

      {loading && <Spinner label="Loading cart" className="!py-12" />}

      {!loading && items.length === 0 && (
        <div className="aa-card p-10 text-center">
          <p className="font-bold uppercase tracking-[0.08em] mb-4">Your cart is empty</p>
          <Link href="/#now-showing" className="aa-btn">Browse Shows</Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          {[...shows.entries()].map(([performanceId, show]) => (
            <div key={performanceId} className="space-y-2">
              <div className="bg-black text-white px-6 py-3">
                <p className="aa-label opacity-75 mb-0">{show.title ? `${show.title} - ` : ""}{show.performance}</p>
                <p className="font-black text-lg mb-0">{show.when}</p>
                <p className="mb-0 text-sm">{show.venue}</p>
              </div>
              {show.lines.map((item) => (
                <div key={item.id} className="aa-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-black mb-0">{item.ticket_tier.label}</p>
                    <p className="text-sm text-muted mb-0">₱{item.ticket_tier.price.toFixed(2)} each</p>
                    {item.ticket_tier.require_id && (
                      <p className="text-xs font-bold mb-0">{item.id_proof_path ? "ID uploaded" : "ID needed. Remove and re-add this ticket to upload."}</p>
                    )}
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
            {promoResult?.valid && (
              <p className="text-sm text-success font-bold mb-0">
                Code applied. You save ₱{promoResult.discount.toFixed(2)}
              </p>
            )}

            <div className="flex items-center justify-between text-2xl font-black">
              <span className="uppercase tracking-[0.08em]">Total</span>
              <span>₱{Math.max(0, total - discount).toFixed(2)}</span>
            </div>

            {shows.size > 1 && (
              <p className="text-xs text-muted mb-0">
                You are booking {shows.size} shows. Each show gets its own booking and QR code, and you pay once.
              </p>
            )}

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
