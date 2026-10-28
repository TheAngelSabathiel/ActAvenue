"use client";

import { toast } from "@/lib/toast";
import { useToastOn } from "@/lib/use-toast-on";

import { useEffect, useState, useCallback } from "react";
import { IMAGES } from "@/lib/images";
import { CreditsManager } from "@/components/credits-manager";
import { PartnersManager } from "@/components/admin/partners-manager";
import { ProductionSection } from "@/components/admin/production-section";
import { PerformanceCard, type Performance } from "@/components/admin/performance-card";
import { Spinner } from "@/components/spinner";
import { ManilaDateTimeInput } from "@/components/manila-datetime-input";
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
  email_note: string | null;
  status: "draft" | "published" | "closed";
  slug: string;
};

export default function ProductionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [production, setProduction] = useState<Production | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
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
        tier_type: formData.get("tier_type"),
        alias: formData.get("alias"),
        description: formData.get("description"),
        require_id: formData.get("require_id") === "on",
        price: Number(formData.get("price")),
        quantity_available: Number(formData.get("quantity_available")),
        pool_tier_id: formData.get("pool_tier_id") || null,
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
          /{production.slug}
        </p>
      </div>

      <ProductionSection
        productionId={id}
        production={production}
        title="Landing page content"
        onSaved={(p) => setProduction(p as unknown as Production)}
        groups={[
          {
            images: [
              { kind: "banner", urlKey: "banner_url", label: "Banner", hint: "Wide image, 1600x600 recommended. JPG, PNG or WebP, up to 5 MB.", fallback: IMAGES.bannerPlaceholder, aspect: "aspect-[8/3]" },
              { kind: "poster", urlKey: "poster_url", label: "Main poster", hint: "Portrait image, 600x900 (2:3) recommended. Up to 5 MB.", fallback: IMAGES.posterPlaceholder, aspect: "aspect-[2/3]" },
            ],
            imagesClassName: "grid sm:grid-cols-[2fr_1fr] gap-6",
          },
          {
            fields: [
              { key: "description", label: "Description", type: "textarea" },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { value: "draft", label: "Draft (not visible to public)" },
                  { value: "published", label: "Published" },
                  { value: "closed", label: "Closed" },
                ],
              },
            ],
          },
        ]}
      />

      <ProductionSection
        productionId={id}
        production={production}
        title="Payment details"
        intro="Shown to buyers at checkout. Leave a field or image empty to use the site default."
        columns="grid sm:grid-cols-2 gap-6"
        onSaved={(p) => setProduction(p as unknown as Production)}
        groups={[
          {
            heading: "GCash",
            fields: [
              { key: "gcash_name", label: "Account name" },
              { key: "gcash_number", label: "GCash number" },
            ],
            images: [{ kind: "gcash_qr", urlKey: "gcash_qr_url", label: "GCash QR", hint: "Square image, 600x600 recommended.", fallback: IMAGES.paymentGcash, aspect: "aspect-square" }],
          },
          {
            heading: "Bank transfer",
            fields: [
              { key: "bank_name", label: "Bank name" },
              { key: "bank_account_name", label: "Account name" },
              { key: "bank_account_number", label: "Account number" },
            ],
            images: [{ kind: "bank_qr", urlKey: "bank_qr_url", label: "Bank QR", hint: "Square image, 600x600 recommended.", fallback: IMAGES.paymentBank, aspect: "aspect-square" }],
          },
        ]}
      />

      <ProductionSection
        productionId={id}
        production={production}
        title="Email notes"
        intro="Extra information added to the confirmation email and the show transfer email, just before the closing line. Leave empty for none."
        onSaved={(p) => setProduction(p as unknown as Production)}
        groups={[
          {
            fields: [{ key: "email_note", label: "Note for buyers (for example: arrival time, venue reminders, house rules)", type: "textarea", rows: 5 }],
          },
        ]}
      />

      {/* ---- Performances + tiers ---- */}
      <section className="space-y-4">
        <h2 className="font-extrabold text-xl">Performances</h2>
        {message && <p className="text-sm text-danger">{message}</p>}

        {performances.map((perf) => (
          <PerformanceCard
            key={perf.id}
            perf={perf}
            onSaved={load}
            onDelete={deletePerformance}
            onDeleteTier={deleteTier}
            onAddTier={addTier}
          />
        ))}

        <details className="aa-card p-5">
          <summary className="cursor-pointer font-extrabold">+ Add performance</summary>
          <form action={addPerformance} className="grid sm:grid-cols-2 gap-2 mt-3">
            <input name="label" placeholder="Label (e.g. Matinee - Aug 20)" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <ManilaDateTimeInput name="datetime" required ariaLabel="Performance" defaultTime="19:00" />
            <input name="venue" placeholder="Venue" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <input name="capacity" type="number" placeholder="Capacity" required className="border border-ink/20  px-2 py-1.5 text-sm" />
            <button className="sm:col-span-2 py-2  bg-black text-paper text-sm font-bold uppercase">
              Add performance
            </button>
          </form>
        </details>
      </section>

      <CreditsManager productionId={id} />

      <PartnersManager productionId={id} />
    </div>
  );
}
