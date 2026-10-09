"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/hooks/use-cart";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/datetime";
import { isTierDiscountActive } from "@/lib/pricing";
import type { PerformanceWithTiers, TicketTier } from "@/types/database";

export function PerformancePicker({
  performances: initialPerformances,
}: {
  performances: PerformanceWithTiers[];
}) {
  const { addItem } = useCart();
  const [performances, setPerformances] = useState(initialPerformances);
  const [activeId, setActiveId] = useState(initialPerformances[0]?.id);
  const [status, setStatus] = useState<Record<string, "idle" | "adding" | "added" | "error">>({});

  // Live remaining-quantity counts: subscribe to ticket_tiers changes so
  // the count updates as other buyers check out or holds expire, without
  // needing a page refresh. Requires `ticket_tiers` to be added to the
  // `supabase_realtime` publication - see supabase/schema.sql.
  useEffect(() => {
    const tierIds = new Set(
      initialPerformances.flatMap((p) => p.ticket_tiers.map((t) => t.id))
    );
    if (tierIds.size === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel("ticket-tier-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ticket_tiers" },
        (payload) => {
          const updated = payload.new as TicketTier;
          if (!tierIds.has(updated.id)) return;

          setPerformances((prev) =>
            prev.map((perf) => ({
              ...perf,
              ticket_tiers: perf.ticket_tiers.map((tier) =>
                tier.id === updated.id
                  ? {
                      ...tier,
                      quantity_available: updated.quantity_available,
                      quantity_held: updated.quantity_held,
                      remaining: updated.quantity_available - updated.quantity_held,
                      discount_active: isTierDiscountActive(updated),
                    }
                  : tier
              ),
            }))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialPerformances]);

  const active = performances.find((p) => p.id === activeId);

  async function handleAdd(tierId: string, performanceId: string) {
    setStatus((s) => ({ ...s, [tierId]: "adding" }));
    try {
      await addItem(tierId, performanceId, 1);
      setStatus((s) => ({ ...s, [tierId]: "added" }));
      setTimeout(() => setStatus((s) => ({ ...s, [tierId]: "idle" })), 1500);
    } catch {
      setStatus((s) => ({ ...s, [tierId]: "error" }));
    }
  }

  if (!performances.length) {
    return (
      <div className="aa-card p-8 text-center">
        <p className="font-bold uppercase tracking-[0.08em] mb-0">No performances scheduled yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {performances.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`aa-btn aa-btn-sm ${activeId === p.id ? "aa-btn-black" : "aa-btn-outline"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="space-y-4">
          <p className="text-muted mb-0">
            {formatDateTime(active.datetime)} - {active.venue}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {active.ticket_tiers.map((tier) => {
              const s = status[tier.id] ?? "idle";
              const soldOut = tier.remaining <= 0;
              const low = !soldOut && tier.remaining <= 10;
              return (
                <div key={tier.id} className="aa-card aa-lift flex flex-col sm:flex-row">
                  <div className="flex-1 p-5">
                    <p className="font-black text-lg mb-1">{tier.label}</p>
                    {tier.discount_active && (
                      <span className="aa-label bg-accent px-2 py-0.5 inline-block">Limited-time price</span>
                    )}
                    <p className={`text-sm mt-2 mb-0 ${low ? "text-danger font-bold" : "text-muted"}`}>
                      {soldOut ? "Sold out" : `${tier.remaining} left`}
                    </p>
                  </div>
                  <div className="aa-perforation p-5 flex flex-col justify-between gap-3 sm:w-44">
                    <p className="font-black text-2xl mb-0">₱{tier.price.toFixed(2)}</p>
                    <button
                      disabled={soldOut || s === "adding"}
                      onClick={() => handleAdd(tier.id, active.id)}
                      className="aa-btn aa-btn-sm w-full"
                    >
                      {soldOut ? "Sold out" : s === "added" ? "Added" : s === "adding" ? "Adding..." : "Add to cart"}
                    </button>
                    {s === "error" && (
                      <p className="text-danger text-xs font-bold mb-0">Could not add. Try again.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
