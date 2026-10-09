"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import Link from "next/link";

type Production = {
  id: string;
  title: string;
  slug: string;
  status: string;
  poster_url: string | null;
};

type Organization = { id: string; name: string };

export default function AdminProductionsPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [orgId, setOrgId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pRes, oRes] = await Promise.all([
      fetch("/api/admin/productions"),
      fetch("/api/admin/organizations"),
    ]);
    const pData = await pRes.json();
    const oData = await oRes.json();
    setProductions(pData.productions ?? []);
    setOrganizations(oData.organizations ?? []);
    if (oData.organizations?.length === 1) setOrgId(oData.organizations[0].id);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function createProduction(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/productions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, organization_id: orgId }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNewTitle("");
    load();
  }

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-6">Productions</h1>

      {!loading && organizations.length === 0 && (
        <p className="text-sm text-danger mb-4">
          No organizations yet -{" "}
          <Link href="/admin/organizations" className="underline">
            create one first
          </Link>
          .
        </p>
      )}

      <form onSubmit={createProduction} className="aa-card p-5 mb-8 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Organization</label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
            className="border border-ink/20  px-3 py-2 text-sm w-64"
          >
            <option value="">Select...</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Title</label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New production title"
            required
            className="border border-ink/20  px-3 py-2 text-sm w-72"
          />
        </div>
        <button
          disabled={creating || organizations.length === 0}
          className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create"}
        </button>
        {error && <p className="text-sm text-danger w-full">{error}</p>}
      </form>

      {loading && <Spinner className="!py-12" />}

      <div className="grid sm:grid-cols-2 gap-4">
        {productions.map((p) => (
          <Link
            key={p.id}
            href={`/admin/productions/${p.id}`}
            className="aa-card p-5 block hover:shadow-md transition-shadow"
          >
            <span
              className={`inline-block px-2 py-0.5  text-xs font-bold uppercase mb-2 ${
                p.status === "published" ? "bg-success/10 text-success" : "bg-ink/10 text-ink/60"
              }`}
            >
              {p.status}
            </span>
            <p className="font-extrabold text-lg">{p.title}</p>
            <p className="text-xs text-muted tabular-nums">/{p.slug}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
