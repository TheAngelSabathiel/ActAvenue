"use client";

import { toast } from "@/lib/toast";
import { useToastOn } from "@/lib/use-toast-on";

import { useEffect, useState } from "react";
import { StagedImage, EMPTY_IMAGE, imageDirty, type ImageDraft } from "@/components/staged-image";
import { SaveBar } from "@/components/save-bar";
import { api, fileInit, jsonInit } from "@/lib/api-call";

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
  useToastOn(error, "error");
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
    toast.success("Organization created.");
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
          <OrgCard key={org.id} org={org} onSaved={load} onCopy={copyId} copied={copiedId === org.id} />
        ))}

        {orgs.length === 0 && <p className="text-sm text-muted">No organizations yet - create one above.</p>}
      </div>
    </div>
  );
}

function OrgCard({ org, onSaved, onCopy, copied }: { org: Organization; onSaved: () => void; onCopy: (id: string) => void; copied: boolean }) {
  const [name, setName] = useState(org.name);
  const [logo, setLogo] = useState<ImageDraft>(EMPTY_IMAGE);
  const [saving, setSaving] = useState(false);
  const dirty = name !== org.name || imageDirty(logo);

  async function save() {
    if (!name.trim()) return toast.error("An organization needs a name.");
    setSaving(true);
    try {
      if (logo.file) await api(`/api/admin/organizations/${org.id}/logo`, fileInit(logo.file));
      if (name !== org.name) await api(`/api/admin/organizations/${org.id}`, jsonInit("PATCH", { name }));
      toast.success("Organization saved.");
      setLogo(EMPTY_IMAGE);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="aa-card p-5 space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-32">
          <StagedImage
            label="Logo"
            url={org.logo_url}
            fallback="/images/AA_logo.png"
            aspect="aspect-square"
            draft={logo}
            onChange={setLogo}
            allowRemove={false}
          />
        </div>
        <div className="flex-1 min-w-[180px] space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-ink/20 px-3 py-2 font-extrabold text-lg"
            aria-label="Organization name"
          />
          <button
            onClick={() => onCopy(org.id)}
            className="text-xs tabular-nums text-muted hover:text-danger"
            title="Copy organization ID for use in Productions / Promo codes forms"
          >
            {copied ? "Copied!" : `${org.id.slice(0, 8)}... (copy ID)`}
          </button>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => { setName(org.name); setLogo(EMPTY_IMAGE); }} />
    </div>
  );
}
