"use client";

import { toast } from "@/lib/toast";

import { useCallback, useEffect, useState } from "react";
import type { CartItemWithDetails } from "@/types/database";

export class CartError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/cart");
    const data = await res.json();
    const list: CartItemWithDetails[] = data.items ?? [];
    setItems(list);
    setLoading(false);
    window.dispatchEvent(
      new CustomEvent("aa-cart-count", { detail: list.reduce((n, i) => n + i.quantity, 0) })
    );
  }, []);

  useEffect(() => {
    // Initial load on mount - intentional, not a derived-state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (ticket_tier_id: string, performance_id: string, quantity: number, idFiles?: File[] | File | null) => {
      let init: RequestInit;
      const files = Array.isArray(idFiles) ? idFiles : idFiles ? [idFiles] : [];
      if (files.length > 0) {
        const fd = new FormData();
        fd.set("ticket_tier_id", ticket_tier_id);
        fd.set("performance_id", performance_id);
        fd.set("quantity", String(quantity));
        for (const f of files) fd.append("id_file", f);
        init = { method: "POST", body: fd };
      } else {
        init = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket_tier_id, performance_id, quantity }),
        };
      }
      const res = await fetch("/api/cart", init);
      const data = await res.json();
      if (!res.ok) throw new CartError(data.error ?? "Could not add to cart", data.code);
      await refresh();
    },
    [refresh]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not update quantity.");
      }
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
      if (res.ok) toast.success("Removed from cart.");
      else toast.error("Could not remove the item.");
      await refresh();
    },
    [refresh]
  );

  const total = items.reduce((sum, i) => sum + i.ticket_tier.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, loading, addItem, updateQuantity, removeItem, refresh, total, count };
}
