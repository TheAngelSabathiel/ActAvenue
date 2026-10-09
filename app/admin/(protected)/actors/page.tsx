"use client";

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
};

const TABS = ["pending", "all"] as const;

export default function AdminActorsPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = tab === "pending" ? "?pending=true" : "";
    const res = await fetch(`/api/admin/actors${qs}`);
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
    await fetch(`/api/admin/actors/${id}/${action}`, { method: "POST" });
    setBusyId(null);
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
    await Promise.all(targets.map((a) => fetch(`/api/admin/actors/${a.id}/${action}`, { method: "POST" })));
    setBulkBusy(false);
    load();
  }

  const selectableIds = actors
    .filter((a) => (a.is_public && !a.is_approved) || a.is_approved)
    .map((a) => a.id);
  const selectedApprovable = actors.filter((a) => selected.has(a.id) && a.is_public && !a.is_approved).length;
  const selectedTakeDownable = actors.filter((a) => selected.has(a.id) && a.is_approved).length;

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-6">Cast &amp; crew directory</h1>
      <p className="text-sm text-muted mb-6">
        Actor profiles only appear at <code>/actors</code> once both the actor has opted in
        (&quot;show my profile publicly&quot; in their settings) <em>and</em> you&apos;ve approved
        them here. Approving or taking down also emails the actor.
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
              {t === "pending" ? "Pending review" : "All actors"}
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
        {actors.map((actor) => {
          const selectable = (actor.is_public && !actor.is_approved) || actor.is_approved;
          return (
            <div key={actor.id} className="aa-card p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
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
                  <p className="font-extrabold text-lg">{actor.display_name ?? "Untitled profile"}</p>
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
                    {!actor.is_public ? "Not requesting listing" : actor.is_approved ? "Live" : "Pending review"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {actor.is_public && !actor.is_approved && (
                  <button
                    disabled={busyId === actor.id}
                    onClick={() => act(actor.id, "approve")}
                    className="px-3 py-1.5  bg-green-700 text-white text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {actor.is_approved && (
                  <button
                    disabled={busyId === actor.id}
                    onClick={() => act(actor.id, "reject")}
                    className="px-3 py-1.5  bg-danger text-white text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Take down
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && actors.length === 0 && (
          <p className="text-muted text-sm">
            {tab === "pending" ? "Nothing waiting for review." : "No actor accounts yet."}
          </p>
        )}
      </div>
    </div>
  );
}
