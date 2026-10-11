"use client";

import { ManilaDateTimeInput } from "@/components/manila-datetime-input";
import { useState } from "react";
import { SaveBar } from "@/components/save-bar";
import { api, jsonInit } from "@/lib/api-call";
import { fromManilaInput, toManilaInput } from "@/lib/datetime";
import { toast } from "@/lib/toast";

export type Tier = {
  id: string;
  label: string;
  price: number;
  quantity_available: number;
  quantity_held: number;
  is_discount_tier: boolean;
  discount_valid_from: string | null;
  discount_valid_until: string | null;
};

export type Performance = {
  id: string;
  label: string;
  datetime: string;
  venue: string;
  capacity: number;
  ticket_tiers: Tier[];
};

type TierDraft = {
  label: string;
  price: string;
  quantity_available: string;
  is_discount_tier: boolean;
  from: string;
  until: string;
};
type Draft = { label: string; datetime: string; venue: string; capacity: string; tiers: Record<string, TierDraft> };

const toDraft = (perf: Performance): Draft => ({
  label: perf.label,
  datetime: toManilaInput(perf.datetime),
  venue: perf.venue,
  capacity: String(perf.capacity),
  tiers: Object.fromEntries(
    perf.ticket_tiers.map((t) => [
      t.id,
      {
        label: t.label,
        price: String(t.price),
        quantity_available: String(t.quantity_available),
        is_discount_tier: t.is_discount_tier,
        from: t.discount_valid_from ? toManilaInput(t.discount_valid_from) : "",
        until: t.discount_valid_until ? toManilaInput(t.discount_valid_until) : "",
      },
    ])
  ),
});

const box = "border border-ink/20 px-2 py-1.5 text-sm";

/** A performance and its ticket tiers. Edits are staged and saved together. */
export function PerformanceCard({
  perf,
  onSaved,
  onDelete,
  onDeleteTier,
  onAddTier,
}: {
  perf: Performance;
  onSaved: () => void;
  onDelete: (id: string) => void;
  onDeleteTier: (id: string) => void;
  onAddTier: (performanceId: string, form: FormData) => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(perf));
  const [saving, setSaving] = useState(false);
  const base = toDraft(perf);

  const perfChanges: Record<string, unknown> = {};
  if (d.label !== base.label) perfChanges.label = d.label;
  if (d.datetime !== base.datetime) perfChanges.datetime = fromManilaInput(d.datetime);
  if (d.venue !== base.venue) perfChanges.venue = d.venue;
  if (d.capacity !== base.capacity) perfChanges.capacity = Number(d.capacity);

  const tierChanges = perf.ticket_tiers
    .map((t) => {
      const a = d.tiers[t.id] ?? base.tiers[t.id];
      const b = base.tiers[t.id];
      const c: Record<string, unknown> = {};
      if (a.label !== b.label) c.label = a.label;
      if (a.price !== b.price) c.price = Number(a.price);
      if (a.quantity_available !== b.quantity_available) c.quantity_available = Number(a.quantity_available);
      if (a.is_discount_tier !== b.is_discount_tier) c.is_discount_tier = a.is_discount_tier;
      if (a.from !== b.from) c.discount_valid_from = a.from ? fromManilaInput(a.from) : null;
      if (a.until !== b.until) c.discount_valid_until = a.until ? fromManilaInput(a.until) : null;
      return { id: t.id, changes: c };
    })
    .filter((t) => Object.keys(t.changes).length > 0);

  const dirty = Object.keys(perfChanges).length > 0 || tierChanges.length > 0;

  async function save() {
    setSaving(true);
    try {
      if (Object.keys(perfChanges).length) {
        await api(`/api/admin/performances/${perf.id}`, jsonInit("PATCH", perfChanges));
      }
      for (const t of tierChanges) {
        await api(`/api/admin/tiers/${t.id}`, jsonInit("PATCH", t.changes));
      }
      toast.success("Performance saved.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const setTier = (id: string, patch: Partial<TierDraft>) =>
    setD((x) => ({ ...x, tiers: { ...x.tiers, [id]: { ...(x.tiers[id] ?? base.tiers[id]), ...patch } } }));

  return (
    <div className="aa-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="grid sm:grid-cols-2 gap-2 flex-1">
          <input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} className={`${box} font-extrabold`} aria-label="Performance label" />
          <ManilaDateTimeInput value={d.datetime} onChange={(v) => setD({ ...d, datetime: v })} ariaLabel="Performance date and time" defaultTime="19:00" />
          <input value={d.venue} onChange={(e) => setD({ ...d, venue: e.target.value })} className={box} aria-label="Venue" placeholder="Venue" />
          <input type="number" value={d.capacity} onChange={(e) => setD({ ...d, capacity: e.target.value })} className={box} aria-label="Capacity" placeholder="Capacity" />
        </div>
        <button onClick={() => onDelete(perf.id)} className="text-xs font-bold uppercase text-danger/70 hover:text-danger shrink-0">
          Delete
        </button>
      </div>

      <div className="space-y-2">
        {perf.ticket_tiers.map((t) => {
          const td = d.tiers[t.id] ?? base.tiers[t.id];
          return (
            <div key={t.id} className="border-t border-ink/10 pt-3">
              <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input value={td.label} onChange={(e) => setTier(t.id, { label: e.target.value })} className="border border-ink/20 px-2 py-1 text-sm" aria-label="Tier label" />
                <input type="number" step="0.01" value={td.price} onChange={(e) => setTier(t.id, { price: e.target.value })} className="border border-ink/20 px-2 py-1 text-sm w-24 tabular-nums" aria-label="Price" />
                <input type="number" value={td.quantity_available} onChange={(e) => setTier(t.id, { quantity_available: e.target.value })} className="border border-ink/20 px-2 py-1 text-sm w-24 tabular-nums" aria-label="Quantity available" title="Total quantity available" />
                <button onClick={() => onDeleteTier(t.id)} className="text-xs font-bold uppercase text-danger/70 hover:text-danger">
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={td.is_discount_tier} onChange={(e) => setTier(t.id, { is_discount_tier: e.target.checked })} />
                  Discount tier
                </label>
                {td.is_discount_tier && (
                  <>
                    <ManilaDateTimeInput value={td.from} onChange={(v) => setTier(t.id, { from: v })} ariaLabel="Discount valid from" defaultTime="00:00" />
                    <span className="text-muted">to</span>
                    <ManilaDateTimeInput value={td.until} onChange={(v) => setTier(t.id, { until: v })} ariaLabel="Discount valid until" defaultTime="23:59" />
                  </>
                )}
                <span className="text-muted tabular-nums ml-auto">
                  {t.quantity_available - t.quantity_held} left ({t.quantity_held} held/sold)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setD(toDraft(perf))} />

      <details className="text-sm">
        <summary className="cursor-pointer font-bold text-xs uppercase text-danger">+ Add ticket tier</summary>
        <form action={(fd) => onAddTier(perf.id, fd)} className="grid sm:grid-cols-2 gap-2 mt-3">
          <input name="label" placeholder="Label (e.g. VIP)" required className={box} />
          <input name="price" type="number" step="0.01" placeholder="Price" required className={box} />
          <input name="quantity_available" type="number" placeholder="Quantity" required className={box} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="is_discount_tier" /> Time-limited discount tier
          </label>
          <div className="space-y-1"><p className="aa-label mb-0">Discount from</p><ManilaDateTimeInput name="discount_valid_from" ariaLabel="Discount from" defaultTime="00:00" /></div>
          <div className="space-y-1"><p className="aa-label mb-0">Discount until</p><ManilaDateTimeInput name="discount_valid_until" ariaLabel="Discount until" defaultTime="23:59" /></div>
          <button className="sm:col-span-2 py-1.5 bg-black text-paper text-xs font-bold uppercase">Add tier</button>
        </form>
      </details>
    </div>
  );
}
