"use client";

import { sortByName } from "@/lib/sort";
import { toast } from "@/lib/toast";
import { useToastOn } from "@/lib/use-toast-on";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ManilaDateTimeInput } from "@/components/manila-datetime-input";
import { TIER_TYPES, tierTypeName } from "@/lib/tiers";
import { useAdminAccess } from "@/components/admin/access-context";

type PromoCode = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  applicable_tier_types: string[] | null;
  production: { title: string } | null;
};

type Organization = { id: string; name: string };
type Production = { id: string; title: string };

export default function PromoCodesPage() {
  const { isAdmin } = useAdminAccess();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  useToastOn(error, "error");
  const [creating, setCreating] = useState(false);

  async function load() {
    const [cRes, oRes, pRes] = await Promise.all([
      fetch("/api/admin/promo-codes"),
      fetch("/api/admin/organizations"),
      fetch("/api/admin/productions"),
    ]);
    const cData = await cRes.json();
    const oData = await oRes.json();
    const pData = await pRes.json();
    setCodes(cData.promo_codes ?? []);
    setOrganizations(oData.organizations ?? []);
    setProductions(pData.productions ?? []);
    if (oData.organizations?.length === 1) setOrgId(oData.organizations[0].id);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function createCode(formData: FormData) {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: orgId,
        code: formData.get("code"),
        discount_type: formData.get("discount_type"),
        discount_value: Number(formData.get("discount_value")),
        applies_to_production_id: formData.get("applies_to_production_id") || null,
        valid_until: formData.get("valid_until") || null,
        max_uses: formData.get("max_uses") ? Number(formData.get("max_uses")) : null,
        applicable_tier_types: formData.getAll("tier_types"),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    toast.success("Promo code created.");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this promo code?")) return;
    const res = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Promo code deleted.");
    else toast.error("Could not delete the promo code.");
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-extrabold text-3xl mb-6">Promo codes</h1>
      <p className="text-sm text-muted mb-6">
        One code applies per reservation. Codes never stack with each other or with a
        tier&apos;s own time-limited discount pricing - see the pricing rules in the MVP doc.
      </p>

      {isAdmin && organizations.length === 0 && (
        <p className="text-sm text-danger mb-4">
          No organizations yet -{" "}
          <Link href="/admin/organizations" className="underline">
            create one first
          </Link>
          .
        </p>
      )}

      <form action={createCode} className="aa-card p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 [&>*]:min-w-0">
        {isAdmin && (
        <select
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          required
          className="w-full border border-ink/20 px-3 py-2 text-sm sm:col-span-2"
        >
          <option value="">Select organization...</option>
          {sortByName(organizations, (o) => o.name).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        )}
        <input name="code" placeholder="CODE" required className="w-full border border-ink/20 px-3 py-2 text-sm uppercase" />
        <select name="discount_type" className="w-full border border-ink/20 px-3 py-2 text-sm">
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off per ticket</option>
        </select>
        <input name="discount_value" type="number" step="0.01" placeholder="Value" required className="w-full border border-ink/20 px-3 py-2 text-sm" />
        <select name="applies_to_production_id" required={!isAdmin} className={`w-full border border-ink/20 px-3 py-2 text-sm ${isAdmin ? "" : "sm:col-span-2"}`}>
          {isAdmin ? <option value="">Applies org-wide</option> : <option value="">Select production...</option>}
          {sortByName(productions, (p) => p.title).map((p) => (
            <option key={p.id} value={p.id}>
              Only for: {p.title}
            </option>
          ))}
        </select>
        <input name="max_uses" type="number" placeholder="Max uses (optional)" className="w-full border border-ink/20 px-3 py-2 text-sm" />
        <fieldset className="sm:col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="sr-only">Ticket types this code applies to</legend>
          <span className="text-xs font-bold uppercase text-muted">Applies to</span>
          {[...TIER_TYPES].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
            <label key={t.value} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="tier_types" value={t.value} defaultChecked /> {t.name}
            </label>
          ))}
        </fieldset>
        <div className="sm:col-span-2 flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 [&>*]:max-w-full">
          <span className="text-xs font-bold uppercase text-muted">Valid until (optional)</span>
          <ManilaDateTimeInput name="valid_until" defaultTime="23:59" ariaLabel="Valid until" />
        </div>
        <button
          disabled={creating || (isAdmin ? organizations.length === 0 : productions.length === 0)}
          className="sm:col-span-2 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create code"}
        </button>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </form>

      <div className="space-y-8">
        {(() => {
          const groups = new Map<string, PromoCode[]>();
          for (const c of codes) {
            const k = c.production?.title ?? "";
            groups.set(k, [...(groups.get(k) ?? []), c]);
          }
          const keys = sortByName([...groups.keys()].filter(Boolean), (k) => k);
          if (groups.has("")) keys.push("");
          return keys.map((k) => (
            <section key={k || "org"} className="space-y-2">
              <h2 className="text-lg font-black">{k || "Organization-wide"}</h2>
              {groups.get(k)!.map((c) => (
                <div key={c.id} className="aa-card p-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="tabular-nums">{c.code}</p>
                    <p className="text-xs text-muted">
                      {c.discount_type === "percent" ? `${c.discount_value}% off` : `₱${c.discount_value} off per ticket`}
                      {" · "}
                      {c.applicable_tier_types?.length ? c.applicable_tier_types.map(tierTypeName).join(", ") : "all ticket types"}
                      {" · "}
                      used {c.times_used}
                      {c.max_uses ? `/${c.max_uses}` : ""}
                    </p>
                  </div>
                  <button onClick={() => remove(c.id)} className="text-xs font-bold uppercase text-danger">
                    Delete
                  </button>
                </div>
              ))}
            </section>
          ));
        })()}
      </div>
    </div>
  );
}
