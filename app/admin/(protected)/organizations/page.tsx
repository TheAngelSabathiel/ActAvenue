"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/organizations");
    const data = await res.json();
    setOrgs(data.organizations ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNewName("");
    load();
  }

  async function renameOrg(id: string, name: string) {
    await fetch(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  async function uploadLogo(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/admin/organizations/${id}/logo`, { method: "POST", body: formData });
    load();
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-extrabold text-3xl mb-2">Organizations</h1>
      <p className="text-sm text-muted mb-6">
        Most setups only need one. Productions and promo codes are scoped to whichever
        organization you pick when creating them.
      </p>

      <form onSubmit={createOrg} className="aa-card p-5 mb-8 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase text-muted mb-1">Name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Act Avenue"
            required
            className="w-full border border-ink/20  px-3 py-2 text-sm"
          />
        </div>
        <button disabled={creating} className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase">
          {creating ? "Creating..." : "Create"}
        </button>
        {error && <p className="text-sm text-danger w-full">{error}</p>}
      </form>

      <div className="space-y-3">
        {orgs.map((org) => (
          <div key={org.id} className="aa-card p-5 flex flex-wrap items-center gap-4">
            {org.logo_url ? (
              <Image src={org.logo_url} alt="" width={48} height={48} className="rounded object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12  bg-ink/10 shrink-0" />
            )}
            <div className="flex-1 min-w-[180px]">
              <input
                defaultValue={org.name}
                onBlur={(e) => e.target.value !== org.name && renameOrg(org.id, e.target.value)}
                className="font-extrabold text-lg border-b border-transparent hover:border-ink/20 focus:border-danger outline-none bg-transparent w-full"
              />
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <button
                  onClick={() => copyId(org.id)}
                  className="text-xs tabular-nums text-muted hover:text-danger"
                  title="Copy organization ID for use in Productions / Promo codes forms"
                >
                  {copiedId === org.id ? "Copied!" : `${org.id.slice(0, 8)}... (copy ID)`}
                </button>
                <label className="text-xs font-bold uppercase text-danger cursor-pointer">
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadLogo(org.id, e.target.files[0])}
                  />
                </label>
              </div>
            </div>
          </div>
        ))}

        {orgs.length === 0 && <p className="text-sm text-muted">No organizations yet - create one above.</p>}
      </div>
    </div>
  );
}
