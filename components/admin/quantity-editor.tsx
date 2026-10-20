"use client";

import { useState } from "react";
import { api, jsonInit } from "@/lib/api-call";
import { toast } from "@/lib/toast";

type Item = { id: string; quantity: number; scans_used?: number; ticket_tier: { label: string } };

/** Change how many tickets a line holds. Applies on press, adjusts availability, emails the buyer when confirmed. */
export function QuantityEditor({
  reservationId,
  items,
  confirmed,
  onChanged,
}: {
  reservationId: string;
  items: Item[];
  confirmed: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function apply(item: Item) {
    const next = Number(draft[item.id]);
    if (!Number.isFinite(next) || next < 1 || next === item.quantity) return;
    const word = next > item.quantity ? "increase" : "reduce";
    const mail = confirmed ? " The buyer will be emailed." : "";
    if (!confirm(`${word[0].toUpperCase()}${word.slice(1)} ${item.ticket_tier.label} from ${item.quantity} to ${next}? Availability is adjusted.${mail}`)) return;
    setBusy(item.id);
    try {
      await api(`/api/admin/reservations/${reservationId}/items/${item.id}`, jsonInit("PATCH", { quantity: next }));
      toast.success(confirmed ? "Quantity updated. Buyer emailed." : "Quantity updated.");
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== item.id)));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 space-y-1">
      {items.map((i) => {
        const value = draft[i.id] ?? String(i.quantity);
        const dirty = value !== String(i.quantity);
        return (
          <div key={i.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold min-w-24">{i.ticket_tier.label}</span>
            <input
              type="number"
              min={Math.max(1, i.scans_used ?? 0)}
              value={value}
              onChange={(e) => setDraft((d) => ({ ...d, [i.id]: e.target.value }))}
              className="border border-ink/20 px-2 py-1 w-20 tabular-nums"
              aria-label={`Quantity for ${i.ticket_tier.label}`}
            />
            <button
              onClick={() => apply(i)}
              disabled={!dirty || busy === i.id}
              className="px-3 py-1 bg-black text-white font-bold uppercase disabled:opacity-40"
            >
              {busy === i.id ? "Applying..." : "Apply"}
            </button>
            {(i.scans_used ?? 0) > 0 && <span className="text-muted">{i.scans_used} scanned</span>}
          </div>
        );
      })}
    </div>
  );
}
