"use client";

import { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/spinner";
import { toManilaInput, fromManilaInput } from "@/lib/datetime";
import { useParams } from "next/navigation";
import Image from "next/image";

type Production = {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  banner_url: string | null;
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
    if (res.ok) setProduction(data.production);
  }

  async function uploadMedia(kind: "poster" | "banner", file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    setSaving(true);
    const res = await fetch(`/api/admin/productions/${id}/media`, { method: "POST", body: formData });
    const data = await res.json();
    setSaving(false);
    if (res.ok) setProduction(data.production);
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-muted mb-1">Banner</label>
            {production.banner_url && (
              <Image
                src={production.banner_url}
                alt="Banner"
                width={300}
                height={150}
                className="rounded mb-2 object-cover w-full h-32"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadMedia("banner", e.target.files[0])}
              className="text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-muted mb-1">Poster</label>
            {production.poster_url && (
              <Image
                src={production.poster_url}
                alt="Poster"
                width={120}
                height={180}
                className="rounded mb-2 object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadMedia("poster", e.target.files[0])}
              className="text-xs"
            />
          </div>
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

      <CastCreditsSection productionId={id} />
    </div>
  );
}

type Actor = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  is_public: boolean;
  is_approved: boolean;
};

type Credit = {
  id: string;
  role_played: string;
  profile: Actor;
};

function CastCreditsSection({ productionId }: { productionId: string }) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedActorId, setSelectedActorId] = useState("");
  const [rolePlayed, setRolePlayed] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [creditsRes, actorsRes] = await Promise.all([
      fetch(`/api/admin/productions/${productionId}/credits`),
      fetch(`/api/admin/actors`),
    ]);
    setCredits((await creditsRes.json()).credits ?? []);
    setActors((await actorsRes.json()).actors ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const res = await fetch(`/api/admin/productions/${productionId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: selectedActorId, role_played: rolePlayed }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setRolePlayed("");
    load();
  }

  async function removeCredit(creditId: string) {
    await fetch(`/api/admin/credits/${creditId}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="space-y-4">
      <h2 className="font-extrabold text-xl">Cast &amp; crew</h2>
      <p className="text-sm text-muted">
        Tag actor accounts to this production with the role they played. Shows on both the
        production page and the actor&apos;s public profile.
      </p>

      {credits.length > 0 && (
        <div className="space-y-2">
          {credits.map((credit) => (
            <div key={credit.id} className="aa-card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-extrabold">{credit.profile.display_name ?? "Untitled profile"}</p>
                <p className="text-xs text-muted tabular-nums">{credit.role_played}</p>
              </div>
              <button
                onClick={() => removeCredit(credit.id)}
                className="text-xs font-bold uppercase text-danger/70 hover:text-danger"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addCredit} className="aa-card p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Actor</label>
          <select
            value={selectedActorId}
            onChange={(e) => setSelectedActorId(e.target.value)}
            required
            className="border border-ink/20  px-3 py-2 text-sm w-56"
          >
            <option value="">Select actor...</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name ?? a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Role played</label>
          <input
            value={rolePlayed}
            onChange={(e) => setRolePlayed(e.target.value)}
            placeholder="e.g. Maria"
            required
            className="border border-ink/20  px-3 py-2 text-sm w-56"
          />
        </div>
        <button
          disabled={submitting || actors.length === 0}
          className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add credit"}
        </button>
        {message && <p className="text-sm text-danger w-full">{message}</p>}
      </form>

      {actors.length === 0 && (
        <p className="text-xs text-muted">
          No actor accounts yet - actors show up here once someone signs up (or upgrades from
          Settings) with an actor profile.
        </p>
      )}
    </section>
  );
}
