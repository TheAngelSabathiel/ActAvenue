"use client";

import { toast } from "@/lib/toast";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { sortByName } from "@/lib/sort";
import { formatDate } from "@/lib/datetime";
import Image from "next/image";
import Link from "next/link";

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
  orders: number;
  staff: { id: string; production_id: string; title: string; staff_role: "manager" | "foh" | "scanner" }[];
};

type ProductionOption = { id: string; title: string };

const TABS = ["pending", "members", "audience"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { pending: "Pending review", members: "Cast and Crew", audience: "Audience accounts" };
const PAGE = 30;

const groupOf = (a: Actor): Tab => (a.role === "public" ? "audience" : a.is_public && !a.is_approved ? "pending" : "members");
// Pending people are also cast and crew, so they stay in that tab's count.
const inTab = (a: Actor, t: Tab) => (t === "members" ? a.role !== "public" : groupOf(a) === t);

export default function AdminActorsPage() {
  const [all, setAll] = useState<Actor[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "newest">("name");
  const [limit, setLimit] = useState(PAGE);
  const [productions, setProductions] = useState<ProductionOption[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickProduction, setPickProduction] = useState("");
  const [pickRole, setPickRole] = useState<"manager" | "foh" | "scanner">("manager");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // One request loads every account. Tabs, search and counts are worked out here,
  // so switching tabs is instant.
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/actors?group=all");
    const data = await res.json().catch(() => ({}));
    const list: Actor[] = data.actors ?? [];
    setAll(list);
    setSelected(new Set());
    setLoading(false);
    // First load: open on Pending only when something is waiting.
    setTab((t) => t ?? (list.some((a) => groupOf(a) === "pending") ? "pending" : "members"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/productions")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .catch(() => {});
  }, []);

  async function assign(a: Actor) {
    if (!pickProduction) return;
    setBusyId(a.id);
    const res = await fetch("/api/admin/production-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: a.id, production_id: pickProduction, staff_role: pickRole }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok) {
      toast.success(`${a.display_name ?? "Account"} is now ${pickRole === "manager" ? "a Manager" : pickRole === "scanner" ? "a Scanner" : "FOH"} for that production.`);
      setPickProduction("");
    } else toast.error(data.error ?? "Could not assign.");
    load();
  }

  async function unassign(staffId: string) {
    const res = await fetch(`/api/admin/production-staff/${staffId}`, { method: "DELETE" });
    if (res.ok) toast.success("Access removed.");
    else toast.error("Could not remove access.");
    load();
  }

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
    const targets = all.filter((a) => {
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

  const counts: Record<Tab, number> = {
    pending: all.filter((a) => inTab(a, "pending")).length,
    members: all.filter((a) => inTab(a, "members")).length,
    audience: all.filter((a) => inTab(a, "audience")).length,
  };
  const q = search.trim().toLowerCase();
  // Searching looks across every group, so you do not need to know where someone is.
  const pool = q
    ? all.filter((a) => `${a.display_name ?? ""} ${a.email ?? ""}`.toLowerCase().includes(q))
    : all.filter((a) => inTab(a, tab ?? "members"));
  const sorted = [...pool].sort((a, b) =>
    sort === "newest"
      ? b.created_at.localeCompare(a.created_at)
      : (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? "", undefined, { sensitivity: "base" })
  );
  const shown = sorted.slice(0, limit);

  const selectableIds = shown.map((a) => a.id);
  const sel = all.filter((a) => selected.has(a.id));
  const selectedApprovable = sel.filter((a) => a.role !== "public" && a.is_public && !a.is_approved).length;
  const selectedTakeDownable = sel.filter((a) => a.is_approved).length;
  const selectedAddable = sel.filter((a) => a.role === "public").length;

  async function bulkAdd() {
    const targets = sel.filter((a) => a.role === "public");
    if (!targets.length) return;
    setBulkBusy(true);
    const results = await Promise.all(
      targets.map((a) =>
        fetch(`/api/admin/actors/${a.id}/membership`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member: true }),
        })
      )
    );
    setBulkBusy(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed) toast.error(`${failed} of ${targets.length} failed.`);
    else toast.success(`${targets.length} added to Cast and Crew.`);
    load();
  }

  if (loading) return <Spinner className="!py-12" />;

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-2">People</h1>
      <p className="text-sm text-muted mb-6">
        Cast and crew show on the public site once they opt in and you approve. Audience accounts are people who booked tickets.
      </p>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setLimit(PAGE);
                setSelected(new Set());
                setSearch("");
              }}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border ${
                tab === t && !q ? "bg-black text-white border-black" : "border-ink/20 text-ink/60 hover:border-black"
              }`}
            >
              {TAB_LABEL[t]} <span className="tabular-nums opacity-75">({counts[t]})</span>
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-muted">{selected.size} selected</span>
            {selectedApprovable > 0 && (
              <button onClick={() => bulkAct("approve")} disabled={bulkBusy} className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold uppercase disabled:opacity-50">
                Approve ({selectedApprovable})
              </button>
            )}
            {selectedTakeDownable > 0 && (
              <button onClick={() => bulkAct("reject")} disabled={bulkBusy} className="px-3 py-1.5 bg-danger text-white text-xs font-bold uppercase disabled:opacity-50">
                Take down ({selectedTakeDownable})
              </button>
            )}
            {selectedAddable > 0 && (
              <button onClick={bulkAdd} disabled={bulkBusy} className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase disabled:opacity-50">
                Add to Cast and Crew ({selectedAddable})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search everyone by name or email..."
          className="border border-ink/20 px-3 py-2 text-sm w-full sm:w-80"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as "name" | "newest")} className="border border-ink/20 px-3 py-2 text-sm" aria-label="Sort">
          <option value="name">A to Z</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {shown.length > 0 && (
        <label className="flex items-center gap-2 text-xs font-bold uppercase text-muted mb-3">
          <input
            type="checkbox"
            checked={selected.size === selectableIds.length && selectableIds.length > 0}
            onChange={() => toggleSelectAll(selectableIds)}
          />
          Select all shown
        </label>
      )}

      <div className="space-y-3">
        {shown.map((actor) => {
          const group = groupOf(actor);
          return (
            <div key={actor.id} className="aa-card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={selected.has(actor.id)}
                  onChange={() => toggleSelected(actor.id)}
                  className="shrink-0"
                  aria-label={`Select ${actor.display_name ?? actor.email ?? "account"}`}
                />
                {actor.photo_url ? (
                  <Image src={actor.photo_url} alt="" width={56} height={56} className=" object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14  bg-ink/10 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-extrabold text-lg truncate">{actor.display_name ?? "No name yet"}</p>
                  {actor.email && <p className="text-xs text-muted truncate">{actor.email}</p>}
                  {actor.bio && <p className="text-xs text-muted line-clamp-1">{actor.bio}</p>}
                  <p className="text-xs text-muted mb-0">
                    Joined {formatDate(actor.created_at)}
                    {actor.orders > 0 ? ` · ${actor.orders} booking${actor.orders === 1 ? "" : "s"}` : ""}
                    {q ? ` · ${TAB_LABEL[group === "pending" ? "members" : group]}` : ""}
                  </p>
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
                        ? "Private profile"
                        : actor.is_approved
                          ? "Live"
                          : "Pending review"}
                  </span>
                </div>
              </div>

              <div className="flex flex-row flex-wrap sm:flex-col gap-2 shrink-0 sm:ml-auto w-full sm:w-36 [&>button]:flex-1 sm:[&>button]:flex-none">
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
                {actor.role !== "public" && (
                  <button
                    onClick={() => setOpenId(openId === actor.id ? null : actor.id)}
                    className="w-full px-3 py-1.5 border border-ink/30 text-ink/70 text-xs font-bold uppercase"
                  >
                    Production access{actor.staff.length > 0 ? ` (${actor.staff.length})` : ""}
                  </button>
                )}
                {actor.is_approved && (
                  <Link
                    href={`/actors/${actor.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-3 py-1.5 border border-ink/30 text-ink/70 text-xs font-bold uppercase text-center"
                  >
                    View profile
                  </Link>
                )}
                {actor.role === "actor" && (
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
            {openId === actor.id && (
              <div className="mt-4 pt-4 border-t border-ink/10 space-y-3">
                <p className="text-xs text-muted">
                  Manager: edits the production, plays and credits, promo codes, sales, reservations, new reservations and check-in for that production.
                  FOH: sales, reservations, new reservations and check-in only.
                </p>
                {actor.staff.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sortByName(actor.staff, (x) => x.title).map((x) => (
                      <span key={x.id} className="inline-flex items-center gap-2 bg-ink/5 px-2 py-1 text-xs">
                        <strong>{x.title}</strong>
                        <span className="uppercase text-muted">{x.staff_role === "manager" ? "Manager" : x.staff_role === "scanner" ? "Scanner" : "FOH"}</span>
                        <button onClick={() => unassign(x.id)} aria-label="Remove access" className="font-bold text-danger">
                          Remove
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={pickProduction}
                    onChange={(e) => setPickProduction(e.target.value)}
                    className="border border-ink/20 px-3 py-2 text-sm w-56"
                  >
                    <option value="">Select production...</option>
                    {sortByName(productions, (p) => p.title).map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <select
                    value={pickRole}
                    onChange={(e) => setPickRole(e.target.value as "manager" | "foh" | "scanner")}
                    className="border border-ink/20 px-3 py-2 text-sm"
                  >
                    <option value="manager">Manager</option>
                    <option value="foh">FOH</option>
                    <option value="scanner">Scanner</option>
                  </select>
                  <button
                    disabled={!pickProduction || busyId === actor.id}
                    onClick={() => assign(actor)}
                    className="px-4 py-2 bg-black text-white text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            )}
          </div>
          );
        })}

        {shown.length === 0 && (
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
        {sorted.length > shown.length && (
          <button onClick={() => setLimit((n) => n + PAGE)} className="aa-btn aa-btn-outline aa-btn-sm w-full sm:w-auto">
            Show more ({sorted.length - shown.length} left)
          </button>
        )}
      </div>
    </div>
  );
}
