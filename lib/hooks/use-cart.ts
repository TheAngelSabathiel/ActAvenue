"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItemWithDetails } from "@/types/database";

export function useCart() {
  const [items, setItems] = useState<CartItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/cart");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial load on mount - intentional, not a derived-state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (ticket_tier_id: string, performance_id: string, quantity: number) => {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_tier_id, performance_id, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add to cart");
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
      if (!res.ok) throw new Error("Could not update quantity");
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  const total = items.reduce((sum, i) => sum + i.ticket_tier.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, loading, addItem, updateQuantity, removeItem, refresh, total, count };
}
