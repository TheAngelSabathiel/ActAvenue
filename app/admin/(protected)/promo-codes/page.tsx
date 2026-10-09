"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PromoCode = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  production: { title: string } | null;
};

type Organization = { id: string; name: string };
type Production = { id: string; title: string };

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this promo code?")) return;
    await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-extrabold text-3xl mb-6">Promo codes</h1>
      <p className="text-sm text-muted mb-6">
        One code applies per reservation. Codes never stack with each other or with a
        tier&apos;s own time-limited discount pricing - see the pricing rules in the MVP doc.
      </p>

      {organizations.length === 0 && (
        <p className="text-sm text-danger mb-4">
          No organizations yet -{" "}
          <Link href="/admin/organizations" className="underline">
            create one first
          </Link>
          .
        </p>
      )}

      <form action={createCode} className="aa-card p-5 mb-8 grid sm:grid-cols-2 gap-3">
        <select
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          required
          className="border border-ink/20  px-3 py-2 text-sm sm:col-span-2"
        >
          <option value="">Select organization...</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input name="code" placeholder="CODE" required className="border border-ink/20  px-3 py-2 text-sm uppercase" />
        <select name="discount_type" className="border border-ink/20  px-3 py-2 text-sm">
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off</option>
        </select>
        <input name="discount_value" type="number" step="0.01" placeholder="Value" required className="border border-ink/20  px-3 py-2 text-sm" />
        <select name="applies_to_production_id" className="border border-ink/20  px-3 py-2 text-sm">
          <option value="">Applies org-wide</option>
          {productions.map((p) => (
            <option key={p.id} value={p.id}>
              Only for: {p.title}
            </option>
          ))}
        </select>
        <input name="max_uses" type="number" placeholder="Max uses (optional)" className="border border-ink/20  px-3 py-2 text-sm" />
        <input name="valid_until" type="datetime-local" className="border border-ink/20  px-3 py-2 text-sm sm:col-span-2" />
        <button
          disabled={creating || organizations.length === 0}
          className="sm:col-span-2 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create code"}
        </button>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </form>

      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="aa-card p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="tabular-nums">{c.code}</p>
              <p className="text-xs text-muted">
                {c.discount_type === "percent" ? `${c.discount_value}% off` : `₱${c.discount_value} off`}
                {" · "}
                {c.production?.title ?? "org-wide"}
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
      </div>
    </div>
  );
}
