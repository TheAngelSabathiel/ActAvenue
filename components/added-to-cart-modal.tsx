"use client";

import { useEffect } from "react";
import Link from "next/link";

export type AddedItem = { tier: string; show: string; performance: string };

export function AddedToCartModal({ item, onClose }: { item: AddedItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="added-title"
        className="aa-card w-full max-w-md p-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="aa-label text-muted mb-1">Added to cart</p>
          <h2 id="added-title" className="text-2xl mb-1">{item.tier}</h2>
          <p className="text-sm text-muted mb-0">
            {item.show} - {item.performance}
          </p>
        </div>
        <p className="mb-0">Ready to check out?</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/cart" className="aa-btn flex-1">Go to checkout</Link>
          <button onClick={onClose} className="aa-btn aa-btn-outline flex-1">Keep browsing</button>
        </div>
      </div>
    </div>
  );
}
