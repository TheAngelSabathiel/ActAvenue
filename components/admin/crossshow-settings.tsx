"use client";

import { useEffect, useState } from "react";
import { SaveBar } from "@/components/save-bar";
import { api, jsonInit } from "@/lib/api-call";
import { sortByName } from "@/lib/sort";
import { toast } from "@/lib/toast";

type Draft = { enabled: boolean; amount: string; ids: string[] };
type Prod = { id: string; title: string };

const toDraft = (enabled?: boolean, amount?: number | string, ids?: string[]): Draft => ({
  enabled: !!enabled,
  amount: String(amount ?? 100),
  ids: ids ?? [],
});

/** Cross-show discount for one production. Off by default. Staged with Save changes. */
export function CrossshowSettings({
  productionId,
  enabled,
  amount,
  sourceIds,
  onSaved,
}: {
  productionId: string;
  enabled?: boolean;
  amount?: number | string;
  sourceIds?: string[];
  onSaved: (p: { crossshow_enabled?: boolean; crossshow_amount?: number; crossshow_source_ids?: string[] }) => void;
}) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(enabled, amount, sourceIds));
  const [d, setD] = useState<Draft>(saved);
  const [others, setOthers] = useState<Prod[]>([]);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify({ ...d, ids: [...d.ids].sort() }) !== JSON.stringify({ ...saved, ids: [...saved.ids].sort() });

  useEffect(() => {
    fetch("/api/admin/productions")
      .then((r) => r.json())
      .then((j) => setOthers(((j.productions ?? []) as Prod[]).filter((p) => p.id !== productionId)))
      .catch(() => {});
  }, [productionId]);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ production: { crossshow_enabled: boolean; crossshow_amount: number; crossshow_source_ids: string[] } }>(
        `/api/admin/productions/${productionId}`,
        jsonInit("PATCH", { crossshow_enabled: d.enabled, crossshow_amount: Number(d.amount), crossshow_source_ids: d.ids })
      );
      const next = toDraft(r.production.crossshow_enabled, r.production.crossshow_amount, r.production.crossshow_source_ids);
      setSaved(next);
      setD(next);
      toast.success("Cross-show discount saved.");
      onSaved(r.production);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="aa-card p-5 space-y-4">
      <div>
        <h2 className="font-extrabold text-xl">Cross-show discount</h2>
        <p className="text-sm text-muted mb-0">
          Buyers of the shows you pick get a fixed amount off Regular tickets here. Only shows currently on sale qualify: once a show is closed, archived or has no upcoming date, its bookings stop earning the discount. Each paid ticket from a confirmed booking earns one discounted ticket, once. The buyer enters that booking code at checkout and must use the same email. Only one discount applies per order. Off by default.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
        Cross-show discount is on
      </label>

      <div className={`space-y-4 ${d.enabled ? "" : "opacity-60"}`}>
        <label className="block max-w-[12rem]">
          <span className="block text-xs font-bold uppercase text-muted mb-1">Amount off per ticket (PHP)</span>
          <input type="number" min={1} step="0.01" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} className="w-full border border-ink/20 px-3 py-2 text-sm tabular-nums" />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase text-muted mb-1">Buyers of these shows qualify</legend>
          {others.length === 0 && <p className="text-sm text-muted mb-0">No other productions yet.</p>}
          {sortByName(others, (p) => p.title).map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.ids.includes(p.id)}
                onChange={(e) => setD({ ...d, ids: e.target.checked ? [...d.ids, p.id] : d.ids.filter((x) => x !== p.id) })}
              />
              {p.title}
            </label>
          ))}
        </fieldset>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setD(saved)} />
    </section>
  );
}
