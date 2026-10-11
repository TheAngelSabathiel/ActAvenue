"use client";

import { toast } from "@/lib/toast";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import Image from "next/image";

type Actor = {
  id: string;
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  is_public: boolean;
  is_approved: boolean;
  created_at: string;
  role: string;
  email: string | null;
};

const TABS = ["pending", "members", "audience"] as const;
const TAB_LABEL = { pending: "Pending review", members: "Cast and Crew", audience: "Audience accounts" } as const;

export default function AdminActorsPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/actors?group=${tab}`);
    const data = await res.json();
    setActors(data.actors ?? []);
    setSelected(new Set());
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    const res = await fetch(`/api/admin/actors/${id}/${action}`, { method: "POST" });
    setBusyId(null);
    if (res.ok) toast.success(action === "approve" ? "Profile approved." : "Profile taken down.");
    else toast.error("Action failed. Try again.");
    load();
  }

  async function setMember(a: Actor, member: boolean) {
    const name = a.display_name ?? a.email ?? "this account";
    if (!member && !confirm(`Move ${name} back to Audience accounts? Their profile comes off the public Cast and Crew page.`)) return;
    setBusyId(a.id);
    const res = await fetch(`/api/admin/actors/${a.id}/membership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member }),
    });
    setBusyId(null);
    if (res.ok) toast.success(member ? `${name} added to Cast and Crew.` : `${name} moved to Audience accounts.`);
    else toast.error("Could not update. Try again.");
    load();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }

  // Bulk approve only makes sense for selected actors that are actually
  // pending (is_public && !is_approved); bulk take-down only for ones
  // currently approved. Silently no-ops on selections that don't apply,
  // rather than erroring, since a mixed selection is a normal thing to have.
  async function bulkAct(action: "approve" | "reject") {
    const targets = actors.filter((a) => {
      if (!selected.has(a.id)) return false;
      return action === "approve" ? a.is_public && !a.is_approved : a.is_approved;
    });
    if (targets.length === 0) return;

    setBulkBusy(true);
    const results = await Promise.all(targets.map((a) => fetch(`/api/admin/actors/${a.id}/${action}`, { method: "POST" })));
    setBulkBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed) toast.error(`${failed} of ${targets.length} failed.`);
    else toast.success(`${targets.length} profile${targets.length === 1 ? "" : "s"} ${action === "approve" ? "approved" : "taken down"}.`);
    load();
  }

  const q = search.trim().toLowerCase();
  const shown = q
    ? actors.filter((a) => `${a.display_name ?? ""} ${a.email ?? ""}`.toLowerCase().includes(q))
    : actors;

  const selectableIds = shown
    .filter((a) => (a.is_public && !a.is_approved) || a.is_approved)
    .map((a) => a.id);
  const selectedApprovable = actors.filter((a) => selected.has(a.id) && a.is_public && !a.is_approved).length;
  const selectedTakeDownable = actors.filter((a) => selected.has(a.id) && a.is_approved).length;

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-6">Cast and Crew</h1>
      <p className="text-sm text-muted mb-6">
        Profiles only appear at <code>/actors</code> once the member has opted in
        (&quot;show my profile publicly&quot; in their settings) <em>and</em> you&apos;ve approved
        them here. Approving or taking down also emails them. Audience accounts are kept
        separate. Add one to Cast and Crew any time, or just credit them on a production.
      </p>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5  text-xs font-bold uppercase tracking-wide border ${
                tab === t ? "bg-danger text-paper border-danger" : "border-ink/20 text-ink/60"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-muted">{selected.size} selected</span>
            {selectedApprovable > 0 && (
              <button
                onClick={() => bulkAct("approve")}
                disabled={bulkBusy}
                className="px-3 py-1.5  bg-green-700 text-white text-xs font-bold uppercase disabled:opacity-50"
              >
                Approve selected ({selectedApprovable})
              </button>
            )}
            {selectedTakeDownable > 0 && (
              <button
                onClick={() => bulkAct("reject")}
                disabled={bulkBusy}
                className="px-3 py-1.5  bg-danger text-white text-xs font-bold uppercase disabled:opacity-50"
              >
                Take down selected ({selectedTakeDownable})
              </button>
            )}
          </div>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email..."
        className="border border-ink/20 px-3 py-2 text-sm w-full sm:w-72 mb-4"
      />

      {loading && <Spinner className="!py-12" />}

      {!loading && selectableIds.length > 0 && (
        <label className="flex items-center gap-2 text-xs font-bold uppercase text-muted mb-3">
          <input
            type="checkbox"
            checked={selected.size === selectableIds.length}
            onChange={() => toggleSelectAll(selectableIds)}
          />
          Select all
        </label>
      )}

      <div className="space-y-3">
        {shown.map((actor) => {
          const selectable = (actor.is_public && !actor.is_approved) || actor.is_approved;
          return (
            <div key={actor.id} className="aa-card p-5 flex items-center gap-3">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selected.has(actor.id)}
                    onChange={() => toggleSelected(actor.id)}
                    className="shrink-0"
                  />
                )}
                {actor.photo_url ? (
                  <Image src={actor.photo_url} alt="" width={56} height={56} className=" object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14  bg-ink/10 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-extrabold text-lg truncate">{actor.display_name ?? "No name yet"}</p>
                  {actor.email && <p className="text-xs text-muted truncate">{actor.email}</p>}
                  {actor.bio && <p className="text-xs text-muted line-clamp-1">{actor.bio}</p>}
                  <span
                    className={`inline-block mt-1 px-2 py-0.5  text-xs font-bold uppercase ${
                      !actor.is_public
                        ? "bg-ink/10 text-ink/60"
                        : actor.is_approved
                          ? "bg-success/10 text-success"
                          : "bg-accent/20 text-danger"
                    }`}
                  >
                    {actor.role === "public"
                      ? "Audience"
                      : !actor.is_public
                        ? "Not requesting listing"
                        : actor.is_approved
                          ? "Live"
                          : "Pending review"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0 ml-auto w-36">
                {actor.role === "public" && (
                  <button
                    disabled={busyId === actor.id}
                    onClick={() => setMember(actor, true)}
                    className="w-full px-3 py-1.5 bg-black text-white text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Add to Cast and Crew
                  </button>
                )}
                {actor.is_public && !actor.is_approved && actor.role !== "public" && (
                  <button
                    disabled={busyId === actor.id}
                    onClick={() => act(actor.id, "approve")}
                    className="w-full px-3 py-1.5 bg-green-700 text-white text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {actor.is_approved && (
                  <button
                    disabled={busyId === actor.id}
                    onClick={() => act(actor.id, "reject")}
                    className="w-full px-3 py-1.5 bg-danger text-white text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Take down
                  </button>
                )}
                {actor.role === "actor" && tab === "members" && (
                  <button
                    disabled={busyId === actor.id}
                    onClick={() => setMember(actor, false)}
                    className="w-full px-3 py-1.5 border border-ink/30 text-ink/70 text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Move to audience
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && shown.length === 0 && (
          <p className="text-muted text-sm">
            {q
              ? "No matches."
              : tab === "pending"
                ? "Nothing waiting for review."
                : tab === "members"
                  ? "No cast or crew yet."
                  : "No audience accounts."}
          </p>
        )}
      </div>
    </div>
  );
}
