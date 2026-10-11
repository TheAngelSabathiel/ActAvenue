"use client";

import { toast } from "@/lib/toast";
import { useToastOn } from "@/lib/use-toast-on";

import { useEffect, useState, useCallback } from "react";
import { MediaUploader } from "@/components/media-uploader";
import { IMAGES } from "@/lib/images";
import { CreditsManager } from "@/components/credits-manager";
import { Spinner } from "@/components/spinner";
import { toManilaInput, fromManilaInput } from "@/lib/datetime";
import { useParams } from "next/navigation";

type Production = {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  banner_url: string | null;
  gcash_name: string | null;
  gcash_number: string | null;
  gcash_qr_url: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_qr_url: string | null;
  status: "draft" | "published" | "closed";
  slug: string;
};

type Tier = {
  id: string;
  label: string;
  price: number;
  quantity_available: number;
  quantity_held: number;
  is_discount_tier: boolean;
  discount_valid_from: string | null;
  discount_valid_until: string | null;
};

type Performance = {
  id: string;
  label: string;
  datetime: string;
  venue: string;
  capacity: number;
  ticket_tiers: Tier[];
};

export default function ProductionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [production, setProduction] = useState<Production | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useToastOn(message, "error");

  const load = useCallback(async () => {
    const [pRes, perfRes] = await Promise.all([
      fetch(`/api/admin/productions/${id}`),
      fetch(`/api/admin/productions/${id}/performances`),
    ]);
    setProduction((await pRes.json()).production);
    setPerformances((await perfRes.json()).performances ?? []);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveField(field: keyof Production, value: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/productions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setProduction(data.production);
      toast.success("Saved.");
    } else {
      toast.error(data.error ?? "Could not save.");
    }
  }

  async function addPerformance(formData: FormData) {
    const res = await fetch(`/api/admin/productions/${id}/performances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: formData.get("label"),
        datetime: formData.get("datetime"),
        venue: formData.get("venue"),
        capacity: Number(formData.get("capacity")),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    toast.success("Performance added.");
    load();
  }

  async function updatePerformance(performanceId: string, field: keyof Performance, value: string | number) {
    setMessage(null);
    const res = await fetch(`/api/admin/performances/${performanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    toast.success("Performance updated.");
    load();
  }

  async function deletePerformance(performanceId: string) {
    if (!confirm("Delete this performance? This can't be undone.")) return;
    setMessage(null);
    const res = await fetch(`/api/admin/performances/${performanceId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    toast.success("Performance deleted.");
    load();
  }

  async function addTier(performanceId: string, formData: FormData) {
    const isDiscount = formData.get("is_discount_tier") === "on";
    const res = await fetch(`/api/admin/performances/${performanceId}/tiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: formData.get("label"),
        price: Number(formData.get("price")),
        quantity_available: Number(formData.get("quantity_available")),
        is_discount_tier: isDiscount,
        discount_valid_from: isDiscount ? formData.get("discount_valid_from") || null : null,
        discount_valid_until: isDiscount ? formData.get("discount_valid_until") || null : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    toast.success("Ticket tier added.");
    load();
  }

  async function updateTier(tierId: string, field: keyof Tier, value: string | number | boolean | null) {
    setMessage(null);
    const res = await fetch(`/api/admin/tiers/${tierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    toast.success("Ticket tier updated.");
    load();
  }

  async function deleteTier(tierId: string) {
    if (!confirm("Delete this ticket tier? This can't be undone.")) return;
    setMessage(null);
    const res = await fetch(`/api/admin/tiers/${tierId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    toast.success("Ticket tier deleted.");
    load();
  }

  if (!production) return <Spinner className="!py-12" />;

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="font-extrabold text-3xl mb-1">{production.title}</h1>
        <p className="text-xs tabular-nums text-muted">
          /{production.slug} {saving && "· saving..."}
        </p>
      </div>

      {/* ---- Banner / poster / description / status ---- */}
      <section className="aa-card p-6 space-y-5">
        <h2 className="font-extrabold text-xl">Landing page content</h2>

        <div className="grid sm:grid-cols-[2fr_1fr] gap-6">
          <MediaUploader
            productionId={id}
            kind="banner"
            label="Banner"
            hint="Wide image, 1600x600 recommended. JPG, PNG or WebP, up to 5 MB."
            url={production.banner_url}
            fallback={IMAGES.bannerPlaceholder}
            aspect="aspect-[8/3]"
            onChange={(p) => setProduction(p as Production)}
          />
          <MediaUploader
            productionId={id}
            kind="poster"
            label="Main poster"
            hint="Portrait image, 600x900 (2:3) recommended. Up to 5 MB."
            url={production.poster_url}
            fallback={IMAGES.posterPlaceholder}
            aspect="aspect-[2/3]"
            onChange={(p) => setProduction(p as Production)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Description</label>
          <textarea
            defaultValue={production.description ?? ""}
            onBlur={(e) => saveField("description", e.target.value)}
            rows={3}
            className="w-full border border-ink/20  px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Status</label>
          <select
            value={production.status}
            onChange={(e) => saveField("status", e.target.value)}
            className="border border-ink/20  px-3 py-2 text-sm"
          >
            <option value="draft">Draft (not visible to public)</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </section>

      {/* ---- Payment details ---- */}
      <section className="aa-card p-6 space-y-5">
        <div>
          <h2 className="font-extrabold text-xl">Payment details</h2>
          <p className="text-sm text-muted mb-0">
            Shown to buyers at checkout. Leave a field or image empty to use the site default.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="aa-label mb-0">GCash</p>
            {(
              [
                ["gcash_name", "Account name"],
                ["gcash_number", "GCash number"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-bold uppercase text-muted mb-1">{label}</label>
                <input
                  defaultValue={production[field] ?? ""}
                  onBlur={(e) => e.target.value !== (production[field] ?? "") && saveField(field, e.target.value)}
                  className="w-full border border-ink/20 px-3 py-2 text-sm"
                />
              </div>
            ))}
            <MediaUploader
              productionId={id}
              kind="gcash_qr"
              label="GCash QR"
              hint="Square image, 600x600 recommended."
              url={production.gcash_qr_url}
              fallback={IMAGES.paymentGcash}
              aspect="aspect-square"
              onChange={(p) => setProduction(p as Production)}
            />
          </div>

          <div className="space-y-3">
            <p className="aa-label mb-0">Bank transfer</p>
            {(
              [
                ["bank_name", "Bank name"],
                ["bank_account_name", "Account name"],
                ["bank_account_number", "Account number"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-bold uppercase text-muted mb-1">{label}</label>
                <input
                  defaultValue={production[field] ?? ""}
                  onBlur={(e) => e.target.value !== (production[field] ?? "") && saveField(field, e.target.value)}
                  className="w-full border border-ink/20 px-3 py-2 text-sm"
                />
              </div>
            ))}
            <MediaUploader
              productionId={id}
              kind="bank_qr"
              label="Bank QR"
              hint="Square image, 600x600 recommended."
              url={production.bank_qr_url}
              fallback={IMAGES.paymentBank}
              aspect="aspect-square"
              onChange={(p) => setProduction(p as Production)}
            />
          </div>
        </div>
      </section>

      {/* ---- Performances + tiers ---- */}
      <section className="space-y-4">
        <h2 className="font-extrabold text-xl">Performances</h2>
        {message && <p className="text-sm text-danger">{message}</p>}

        {performances.map((perf) => (
          <div key={perf.id} className="aa-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="grid sm:grid-cols-2 gap-2 flex-1">
                <input
                  defaultValue={perf.label}
                  onBlur={(e) => e.target.value !== perf.label && updatePerformance(perf.id, "label", e.target.value)}
                  className="border border-ink/20  px-2 py-1.5 text-sm font-extrabold"
                  aria-label="Performance label"
                />
                <input
                  type="datetime-local"
                  defaultValue={toManilaInput(perf.datetime)}
                  onBlur={(e) => updatePerformance(perf.id, "datetime", fromManilaInput(e.target.value))}
                  className="border border-ink/20  px-2 py-1.5 text-sm"
                  aria-label="Performance date and time"
                />
                <input
                  defaultValue={perf.venue}
                  onBlur={(e) => e.target.value !== perf.venue && updatePerformance(perf.id, "venue", e.target.value)}
                  className="border border-ink/20  px-2 py-1.5 text-sm"
                  aria-label="Venue"
                  placeholder="Venue"
                />
                <input
                  type="number"
                  defaultValue={perf.capacity}
                  onBlur={(e) => Number(e.target.value) !== perf.capacity && updatePerformance(perf.id, "capacity", Number(e.target.value))}
                  className="border border-ink/20  px-2 py-1.5 text-sm"
                  aria-label="Capacity"
                  placeholder="Capacity"
                />
              </div>
              <button
                onClick={() => deletePerformance(perf.id)}
                className="text-xs font-bold uppercase text-danger/70 hover:text-danger shrink-0"
              >
                Delete
              </button>
            </div>

            <div className="space-y-2">
              {perf.ticket_tiers.map((t) => (
                <div key={t.id} className="border-t border-ink/10 pt-3">
                  <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <input
                      defaultValue={t.label}
                      onBlur={(e) => e.target.value !== t.label && updateTier(t.id, "label", e.target.value)}
                      className="border border-ink/20  px-2 py-1 text-sm"
                      aria-label="Tier label"
                    />
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={t.price}
                      onBlur={(e) => Number(e.target.value) !== t.price && updateTier(t.id, "price", Number(e.target.value))}
                      className="border border-ink/20  px-2 py-1 text-sm w-24 tabular-nums"
                      aria-label="Price"
                    />
                    <input
                      type="number"
                      defaultValue={t.quantity_available}
                      onBlur={(e) =>
                        Number(e.target.value) !== t.quantity_available &&
                        updateTier(t.id, "quantity_available", Number(e.target.value))
                      }
                      className="border border-ink/20  px-2 py-1 text-sm w-24 tabular-nums"
                      aria-label="Quantity available"
                      title="Total quantity available"
                    />
                    <button
                      onClick={() => deleteTier(t.id)}
                      className="text-xs font-bold uppercase text-danger/70 hover:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        defaultChecked={t.is_discount_tier}
                        onChange={(e) => updateTier(t.id, "is_discount_tier", e.target.checked)}
                      />
                      Discount tier
                    </label>
                    {t.is_discount_tier && (
                      <>
                        <input
                          type="datetime-local"
                          defaultValue={t.discount_valid_from ? toManilaInput(t.discount_valid_from) : ""}
                          onBlur={(e) =>
                            updateTier(
                              t.id,
                              "discount_valid_from",
                              e.target.value ? fromManilaInput(e.target.value) : null
                            )
                          }
                          className="border border-ink/20  px-2 py-1 text-xs"
                          aria-label="Discount valid from"
                        />
                        <span className="text-muted">to</span>
                        <input
                          type="datetime-local"
                          defaultValue={t.discount_valid_until ? toManilaInput(t.discount_valid_until) : ""}
                          onBlur={(e) =>
                            updateTier(
                              t.id,
                              "discount_valid_until",
                              e.target.value ? fromManilaInput(e.target.value) : null
                            )
                          }
                          className="border border-ink/20  px-2 py-1 text-xs"
                          aria-label="Discount valid until"
                        />
                      </>
                    )}
                    <span className="text-muted tabular-nums ml-auto">
                      {t.quantity_available - t.quantity_held} left ({t.quantity_held} held/sold)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-xs uppercase text-danger">
                + Add ticket tier
              </summary>
              <form
                action={(fd) => addTier(perf.id, fd)}
                className="grid sm:grid-cols-2 gap-2 mt-3"
              >
                <input name="label" placeholder="Label (e.g. VIP)" required className="border border-ink/20  px-2 py-1.5 text-sm" />
                <input name="price" type="number" step="0.01" placeholder="Price" required className="border border-ink/20  px-2 py-1.5 text-sm" />
                <input name="quantity_available" type="number" placeholder="Quantity" required className="border border-ink/20  px-2 py-1.5 text-sm" />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="is_discount_tier" /> Time-limited discount tier
                </label>
                <input name="discount_valid_from" type="datetime-local" className="border border-ink/20  px-2 py-1.5 text-sm" />
                <input name="discount_valid_until" type="datetime-local" className="border border-ink/20  px-2 py-1.5 text-sm" />
                <button className="sm:col-span-2 py-1.5  bg-black text-paper text-xs font-bold uppercase">
                  Add tier
                </button>
              </form>
            </details>
          </div>
        ))}

        <details className="aa-card p-5">
          <summary className="cursor-pointer font-extrabold">+ Add performance</summary>
          <form action={addPerformance} className="grid sm:grid-cols-2 gap-2 mt-3">
            <input name="label" placeholder="Label (e.g. Matinee - Aug 20)" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <input name="datetime" type="datetime-local" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <input name="venue" placeholder="Venue" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <input name="capacity" type="number" placeholder="Capacity" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <button className="sm:col-span-2 py-2  bg-black text-paper text-sm font-bold uppercase">
              Add performance
            </button>
          </form>
        </details>
      </section>

      <CreditsManager productionId={id} />
    </div>
  );
}
