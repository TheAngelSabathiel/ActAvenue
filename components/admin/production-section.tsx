"use client";

import { useState } from "react";
import { StagedImage, EMPTY_IMAGE, imageDirty, type ImageDraft } from "@/components/staged-image";
import { SaveBar } from "@/components/save-bar";
import { api, jsonInit } from "@/lib/api-call";
import { toast } from "@/lib/toast";

export type FieldCfg = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  rows?: number;
  options?: { value: string; label: string }[];
};
export type ImageCfg = {
  kind: "poster" | "banner" | "gcash_qr" | "bank_qr";
  urlKey: string;
  label: string;
  hint?: string;
  fallback: string;
  aspect: string;
};
export type Group = { heading?: string; images?: ImageCfg[]; imagesClassName?: string; fields?: FieldCfg[] };

type Row = Record<string, unknown>;

/**
 * One editable block of a production. Text and pictures are staged locally;
 * everything is sent when "Save changes" is pressed.
 */
export function ProductionSection({
  productionId,
  production,
  title,
  intro,
  groups,
  columns = "",
  onSaved,
}: {
  productionId: string;
  production: Row;
  title: string;
  intro?: string;
  groups: Group[];
  columns?: string;
  onSaved: (production: Row) => void;
}) {
  const fields = groups.flatMap((g) => g.fields ?? []);
  const images = groups.flatMap((g) => g.images ?? []);

  const fromProduction = (p: Row) => Object.fromEntries(fields.map((f) => [f.key, String(p[f.key] ?? "")]));
  const [values, setValues] = useState<Record<string, string>>(() => fromProduction(production));
  const [pics, setPics] = useState<Record<string, ImageDraft>>({});
  const [saving, setSaving] = useState(false);

  const changedFields = fields.filter((f) => values[f.key] !== String(production[f.key] ?? ""));
  const dirty = changedFields.length > 0 || images.some((i) => imageDirty(pics[i.kind] ?? EMPTY_IMAGE));

  function discard() {
    setValues(fromProduction(production));
    setPics({});
  }

  async function save() {
    setSaving(true);
    try {
      let latest = production;
      for (const img of images) {
        const d = pics[img.kind] ?? EMPTY_IMAGE;
        if (d.file) {
          const form = new FormData();
          form.append("file", d.file);
          form.append("kind", img.kind);
          const r = await api<{ production: Row }>(`/api/admin/productions/${productionId}/media`, { method: "POST", body: form });
          latest = r.production;
        } else if (d.removed) {
          const r = await api<{ production: Row }>(`/api/admin/productions/${productionId}/media?kind=${img.kind}`, { method: "DELETE" });
          latest = r.production;
        }
      }
      if (changedFields.length) {
        const patch = Object.fromEntries(changedFields.map((f) => [f.key, values[f.key]]));
        const r = await api<{ production: Row }>(`/api/admin/productions/${productionId}`, jsonInit("PATCH", patch));
        latest = r.production;
      }
      toast.success(`${title} saved.`);
      setValues(fromProduction(latest));
      setPics({});
      onSaved(latest);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full border border-ink/20 px-3 py-2 text-sm";

  return (
    <section className="aa-card p-6 space-y-5">
      <div>
        <h2 className="font-extrabold text-xl">{title}</h2>
        {intro && <p className="text-sm text-muted mb-0">{intro}</p>}
      </div>

      <div className={columns || "space-y-5"}>
        {groups.map((g, gi) => (
          <div key={gi} className="space-y-3">
            {g.heading && <p className="aa-label mb-0">{g.heading}</p>}
            {g.images && (
              <div className={g.imagesClassName ?? "space-y-3"}>
                {g.images.map((img) => (
                  <StagedImage
                    key={img.kind}
                    label={img.label}
                    hint={img.hint}
                    url={(production[img.urlKey] as string | null) ?? null}
                    fallback={img.fallback}
                    aspect={img.aspect}
                    draft={pics[img.kind] ?? EMPTY_IMAGE}
                    onChange={(d) => setPics((p) => ({ ...p, [img.kind]: d }))}
                  />
                ))}
              </div>
            )}
            {g.fields?.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-bold uppercase text-muted mb-1">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    rows={f.rows ?? 3}
                    className={input}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="border border-ink/20 px-3 py-2 text-sm"
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className={input}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </section>
  );
}
