"use client";

import { useState } from "react";
import { SaveBar } from "@/components/save-bar";
import { api, jsonInit } from "@/lib/api-call";
import { toast } from "@/lib/toast";
import { DEFAULT_BUNDLE_TIERS, type BundleTier } from "@/lib/pricing";

type Draft = { enabled: boolean; tiers: { min: string; percent: string }[] };

const toDraft = (enabled?: boolean, tiers?: BundleTier[]): Draft => ({
  enabled: !!enabled,
  tiers: (tiers?.length ? tiers : DEFAULT_BUNDLE_TIERS).map((t) => ({ min: String(t.min), percent: String(t.percent) })),
});

/** Group (bundle) discount for one production. Off by default. Staged with Save changes. */
export function BundleSettings({
  productionId,
  enabled,
  tiers,
  onSaved,
}: {
  productionId: string;
  enabled?: boolean;
  tiers?: BundleTier[];
  onSaved: (p: { bundle_enabled?: boolean; bundle_tiers?: BundleTier[] }) => void;
}) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(enabled, tiers));
  const [d, setD] = useState<Draft>(saved);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const box = "w-full border border-ink/20 px-3 py-2 text-sm";

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ production: { bundle_enabled: boolean; bundle_tiers: BundleTier[] } }>(
        `/api/admin/productions/${productionId}`,
        jsonInit("PATCH", {
          bundle_enabled: d.enabled,
          bundle_tiers: d.tiers.map((t) => ({ min: Number(t.min), percent: Number(t.percent) })),
        })
      );
      const next = toDraft(r.production.bundle_enabled, r.production.bundle_tiers);
      setSaved(next);
      setD(next);
      toast.success("Group discount saved.");
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
        <h2 className="font-extrabold text-xl">Group discount</h2>
        <p className="text-sm text-muted mb-0">
          Applies automatically to Regular tickets bought for the same show. Only one discount applies per order: the group discount or a promo code, whichever saves more. Off by default.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
        Group discount is on
      </label>

      <div className={`space-y-2 ${d.enabled ? "" : "opacity-60"}`}>
        {d.tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <label className="block min-w-0">
              <span className="block text-xs font-bold uppercase text-muted mb-1">Regular tickets (or more)</span>
              <input type="number" min={2} value={t.min} onChange={(e) => setD({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)) })} className={box} />
            </label>
            <label className="block min-w-0">
              <span className="block text-xs font-bold uppercase text-muted mb-1">Percent off</span>
              <input type="number" min={1} max={90} step="0.5" value={t.percent} onChange={(e) => setD({ ...d, tiers: d.tiers.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)) })} className={box} />
            </label>
            <button type="button" onClick={() => setD({ ...d, tiers: d.tiers.filter((_, j) => j !== i) })} disabled={d.tiers.length <= 1} className="text-xs font-bold uppercase text-danger/70 hover:text-danger pb-2.5 disabled:opacity-30">
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setD({ ...d, tiers: [...d.tiers, { min: "", percent: "" }] })} className="text-xs font-bold uppercase underline">
          + Add step
        </button>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setD(saved)} />
    </section>
  );
}
