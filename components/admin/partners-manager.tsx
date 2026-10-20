"use client";

import { useCallback, useEffect, useState } from "react";
import { SaveBar } from "@/components/save-bar";
import { EMPTY_IMAGE, StagedImage, imageDirty, type ImageDraft } from "@/components/staged-image";
import { api, fileInit, jsonInit } from "@/lib/api-call";
import { toast } from "@/lib/toast";
import { PARTNER_CATEGORIES, SPONSOR_LEVELS, sortPartners } from "@/lib/partners";
import type { ProductionPartner } from "@/types/database";

const box = "border border-ink/20 px-2 py-1.5 text-sm";

function PartnerCard({ partner, onChanged }: { partner: ProductionPartner; onChanged: () => void }) {
  const base = {
    name: partner.name,
    url: partner.url ?? "",
    category: partner.category,
    level: partner.sponsor_level ?? "major",
    order: String(partner.sort_order),
  };
  const [d, setD] = useState(base);
  const [logo, setLogo] = useState<ImageDraft>(EMPTY_IMAGE);
  const [saving, setSaving] = useState(false);
  const thanks = d.category === "sponsor" && d.level === "special_thanks";
  const dirty = JSON.stringify(d) !== JSON.stringify(base) || imageDirty(logo);

  async function save() {
    setSaving(true);
    try {
      await api(
        `/api/admin/partners/${partner.id}`,
        jsonInit("PATCH", {
          name: d.name,
          url: d.url,
          category: d.category,
          sponsor_level: d.category === "sponsor" ? d.level : null,
          sort_order: Number(d.order) || 0,
          ...(logo.removed || thanks ? { logo_url: null } : {}),
        })
      );
      if (logo.file && !thanks) await api(`/api/admin/partners/${partner.id}/logo`, fileInit(logo.file));
      toast.success("Partner saved.");
      setLogo(EMPTY_IMAGE);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${partner.name}?`)) return;
    try {
      await api(`/api/admin/partners/${partner.id}`, { method: "DELETE" });
      toast.success("Partner removed.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    }
  }

  return (
    <div className="aa-card p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={`${box} font-bold`} aria-label="Partner name" />
        <input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} className={box} placeholder="Company link (https://...)" aria-label="Company link" />
        <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as typeof d.category })} className={box} aria-label="Category">
          {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
        </select>
        {d.category === "sponsor" ? (
          <select value={d.level} onChange={(e) => setD({ ...d, level: e.target.value as typeof d.level })} className={box} aria-label="Sponsor level">
            {SPONSOR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.name}</option>)}
          </select>
        ) : <span />}
        <input type="number" value={d.order} onChange={(e) => setD({ ...d, order: e.target.value })} className={box} aria-label="Order within group" placeholder="Order (0 first)" />
      </div>
      {thanks ? (
        <p className="text-xs text-muted mb-0">Special Thanks to shows the name and link only. No logo.</p>
      ) : (
        <div className="max-w-[220px]">
          <StagedImage label="Logo (optional)" hint="The name shows as text if there is no logo." url={partner.logo_url} fallback="/images/placeholder-banner.png" fallbackText={d.name} aspect="aspect-[3/2]" draft={logo} onChange={setLogo} />
        </div>
      )}
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setD(base); setLogo(EMPTY_IMAGE); }} />
      <button onClick={remove} className="text-xs font-bold uppercase text-danger/70 hover:text-danger">Remove partner</button>
    </div>
  );
}

export function PartnersManager({ productionId }: { productionId: string }) {
  const [partners, setPartners] = useState<ProductionPartner[]>([]);
  const [category, setCategory] = useState<string>("sponsor");

  const load = useCallback(async () => {
    try {
      const d = await api<{ partners: ProductionPartner[] }>(`/api/admin/productions/${productionId}/partners`);
      setPartners(d.partners);
    } catch {
      /* table may not exist until the migration is run */
    }
  }, [productionId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function add(fd: FormData) {
    try {
      await api(`/api/admin/productions/${productionId}/partners`, jsonInit("POST", {
        category: fd.get("category"),
        sponsor_level: fd.get("sponsor_level"),
        name: fd.get("name"),
        url: fd.get("url"),
      }));
      toast.success("Partner added.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black">Partners</h2>
      {PARTNER_CATEGORIES.map((c) => {
        const list = sortPartners(partners.filter((p) => p.category === c.value));
        if (!list.length) return null;
        return (
          <div key={c.value} className="space-y-2">
            <p className="aa-label">{c.name}s</p>
            {list.map((p) => <PartnerCard key={`${p.id}-${p.name}-${p.logo_url}-${p.url}-${p.category}-${p.sponsor_level}-${p.sort_order}`} partner={p} onChanged={load} />)}
          </div>
        );
      })}
      <details className="aa-card p-5">
        <summary className="cursor-pointer font-extrabold">+ Add partner</summary>
        <form action={add} className="grid sm:grid-cols-2 gap-2 mt-3">
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={box} aria-label="Category">
            {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
          </select>
          {category === "sponsor" ? (
            <select name="sponsor_level" defaultValue="major" className={box} aria-label="Sponsor level">
              {SPONSOR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.name}</option>)}
            </select>
          ) : <span />}
          <input name="name" placeholder="Name" required className={box} />
          <input name="url" placeholder="Company link (optional)" className={box} />
          <p className="text-xs text-muted sm:col-span-2 mb-0">Add the logo after the partner is created.</p>
          <button className="sm:col-span-2 py-2 bg-black text-paper text-sm font-bold uppercase">Add partner</button>
        </form>
      </details>
    </section>
  );
}
