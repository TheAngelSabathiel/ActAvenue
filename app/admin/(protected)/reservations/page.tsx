"use client";

import { toast } from "@/lib/toast";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { useAdminAccess } from "@/components/admin/access-context";
import { QuantityEditor } from "@/components/admin/quantity-editor";
import { TransferDialog } from "@/components/admin/transfer-dialog";
import { isTransferred } from "@/lib/transfer";
import { idPaths } from "@/lib/id-proofs";
import { formatDateTime } from "@/lib/datetime";
import { sortByName } from "@/lib/sort";

type Row = {
  id: string;
  production_id: string;
  performance_id: string;
  rejection_reason: string | null;
  checked_in: boolean;
  reference_code: string;
  order_code: string | null;
  order_count: number;
  buyer_name: string;
  buyer_email: string | null;
  payment_status: "pending_review" | "confirmed" | "rejected" | "expired";
  booking_source: string;
  total: number;
  payment_proof_url: string | null;
  production: { title: string };
  performance: { label: string; datetime: string };
  reservation_items: { id: string; quantity: number; id_proof_path?: string | null; id_proof_paths?: string[]; scans_used?: number; ticket_tier: { label: string; tier_type: string } }[];
};

const STATUS_TABS = ["all", "pending_review", "confirmed", "rejected", "expired"] as const;

const STATUS_STYLE: Record<string, string> = {
  pending_review: "bg-accent/20 text-danger",
  confirmed: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
  expired: "bg-ink/10 text-ink/60",
};

const PAGE_SIZE = 20;

export default function AdminReservationsPage() {
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("pending_review");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState<Row | null>(null);

  // Search and filters.
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [productionId, setProductionId] = useState("");
  const [performanceId, setPerformanceId] = useState("");
  const [productions, setProductions] = useState<{ id: string; title: string }[]>([]);
  const [shows, setShows] = useState<{ id: string; label: string; datetime: string }[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/admin/productions")
      .then((r) => r.json())
      .then((d) => setProductions(sortByName<{ id: string; title: string }>(d.productions ?? [], (p) => p.title)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!productionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShows([]);
      return;
    }
    let alive = true;
    fetch(`/api/admin/productions/${productionId}/performances`)
      .then((r) => r.json())
      .then((d) => alive && setShows(d.performances ?? []))
      .catch(() => alive && setShows([]));
    return () => {
      alive = false;
    };
  }, [productionId]);

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next !== q) {
        setQ(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, q]);

  const filtered = !!(q || productionId || performanceId);
  function clearFilters() {
    setSearch("");
    setQ("");
    setProductionId("");
    setPerformanceId("");
    setPage(1);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: tab, page: String(page), pageSize: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    if (productionId) params.set("production_id", productionId);
    if (performanceId) params.set("performance_id", performanceId);
    const res = await fetch(`/api/admin/reservations?${params}`);
    const data = await res.json();
    setTabCounts(data.tabCounts ?? {});
    setRows(data.reservations ?? []);
    setTotalPages(data.pagination?.totalPages ?? 1);
    setTotal(data.pagination?.total ?? 0);
    setLoading(false);
  }, [tab, page, q, productionId, performanceId]);

  useEffect(() => {
    // Refetch on mount and whenever the status tab or page changes - intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function selectTab(s: (typeof STATUS_TABS)[number]) {
    setTab(s);
    setPage(1); // reset to first page whenever the filter changes
  }

  async function uploadProof(id: string, file: File | undefined) {
    if (!file) return;
    setBusyId(id);
    const fd = new FormData();
    fd.set("payment_proof", file);
    const res = await fetch(`/api/admin/reservations/${id}/proof`, { method: "POST", body: fd });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save the proof.");
      return;
    }
    toast.success("Proof of payment saved.");
    load();
  }

  async function act(id: string, action: "approve" | "reject" | "reopen" | "resend-email") {
    setBusyId(id);
    const reason =
      action === "reject" ? window.prompt("Rejection reason (optional):") ?? undefined : undefined;
    const res = await fetch(`/api/admin/reservations/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason }) : undefined,
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Action failed");
      return;
    }
    toast.success(
      { approve: "Reservation approved. E-ticket emailed.", reject: "Reservation rejected. Buyer emailed.", reopen: "Reservation reopened.", "resend-email": "Email resent." }[action]
    );
    // If this action moved the last row on this page out of the current
    // filter (e.g. approving the only item on page 2), step back a page
    // rather than leaving an empty page displayed. resend-email doesn't
    // change payment_status, so it never needs this correction.
    if (action !== "resend-email" && rows.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      load();
    }
  }

  async function remove(r: Row) {
    const warning =
      r.payment_status === "confirmed"
        ? "This booking is CONFIRMED and its QR will stop working. "
        : "";
    if (!confirm(`${warning}Permanently delete ${r.reference_code} (${r.buyer_name})? This cannot be undone.`)) return;
    setBusyId(r.id);
    const res = await fetch(`/api/admin/reservations/${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      toast.error(data.error ?? "Could not delete.");
      return;
    }
    toast.success(`Reservation ${r.reference_code} deleted.`);
    if (rows.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  }

  async function actOrder(r: Row, action: "approve" | "reject" | "reopen") {
    if (!r.order_code) return;
    const reason = action === "reject" ? window.prompt("Rejection reason (optional):") ?? undefined : undefined;
    if (!confirm(`${action[0].toUpperCase() + action.slice(1)} all bookings in order ${r.order_code}?`)) return;
    setBusyId(r.id);
    const res = await fetch(`/api/admin/orders/${r.order_code}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason }) : undefined,
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) toast.error(data.error ?? "Action failed");
    else toast.success(`Order ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "reopened"} (${data.count} bookings).`);
    load();
  }

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-6">Reservations</h1>

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr] mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone or code"
          aria-label="Search reservations"
          className="border border-ink/20 px-3 py-2 text-sm w-full min-w-0"
        />
        <select
          value={productionId}
          onChange={(e) => {
            setProductionId(e.target.value);
            setPerformanceId("");
            setPage(1);
          }}
          aria-label="Filter by production"
          className="border border-ink/20 px-3 py-2 text-sm w-full min-w-0"
        >
          <option value="">All productions</option>
          {productions.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <select
          value={performanceId}
          onChange={(e) => {
            setPerformanceId(e.target.value);
            setPage(1);
          }}
          disabled={!productionId}
          aria-label="Filter by show"
          className="border border-ink/20 px-3 py-2 text-sm w-full min-w-0 disabled:opacity-50"
        >
          <option value="">{productionId ? "All shows" : "Pick a production first"}</option>
          {shows.map((s) => (
            <option key={s.id} value={s.id}>{s.label} - {formatDateTime(s.datetime)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => selectTab(s)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border ${
              tab === s ? "bg-danger text-paper border-danger" : "border-ink/20 text-ink/60"
            }`}
          >
            {s.replace("_", " ")}
            {tabCounts[s] !== undefined && <span className="ml-1.5 tabular-nums opacity-80">{tabCounts[s]}</span>}
          </button>
        ))}
        {filtered && (
          <button onClick={clearFilters} className="text-xs font-bold uppercase underline ml-1">
            Clear search
          </button>
        )}
      </div>

      {loading && <Spinner className="!py-12" />}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="aa-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 break-words">
                <span
                  className={`inline-block px-2 py-0.5  text-xs font-bold uppercase mb-2 ${STATUS_STYLE[r.payment_status]}`}
                >
                  {isTransferred(r.rejection_reason) ? "transferred" : r.payment_status.replace("_", " ")}
                </span>
                {isTransferred(r.rejection_reason) && (
                  <p className="text-xs font-bold text-muted mb-1">{r.rejection_reason}. This QR no longer works.</p>
                )}
                <p className="font-extrabold text-lg">{r.buyer_name}</p>
                <p className="text-xs text-muted tabular-nums">
                  {r.reference_code} · {r.buyer_email ?? "no email (walk-in)"} · {r.booking_source}
                </p>
                {r.order_count > 1 && (
                  <p className="text-xs font-bold text-danger">
                    Order {r.order_code} · {r.order_count} shows, one payment
                  </p>
                )}
                <p className="text-sm mt-1">
                  {r.production.title} - {r.performance.label}
                </p>
                <p className="text-xs text-muted">
                  {r.reservation_items.map((i) => `${i.quantity}× ${i.ticket_tier.label}`).join(", ")}
                  {" · "}
                  <span className="tabular-nums">₱{r.total.toFixed(2)}</span>
                  {r.reservation_items.flatMap((i) => {
                    const ids = idPaths(i);
                    return ids.map((_, n) => (
                      <span key={`${i.id}-${n}`}>
                        {" · "}
                        <a href={`/api/admin/reservations/${r.id}/id-proof?item=${i.id}&n=${n + 1}`} target="_blank" rel="noopener noreferrer" className="underline font-bold">
                          View ID{ids.length > 1 ? ` ${n + 1} of ${ids.length}` : ""} ({i.ticket_tier.label})
                        </a>
                      </span>
                    ));
                  })}
                </p>
                {["pending_review", "confirmed"].includes(r.payment_status) && !isTransferred(r.rejection_reason) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-bold uppercase underline">Edit quantity</summary>
                    <QuantityEditor reservationId={r.id} items={r.reservation_items} confirmed={r.payment_status === "confirmed"} onChanged={load} />
                  </details>
                )}
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                {r.payment_proof_url && (
                  <a
                    href={r.payment_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold uppercase text-danger underline"
                  >
                    View proof
                  </a>
                )}
                {["pending_review", "confirmed"].includes(r.payment_status) && !isTransferred(r.rejection_reason) && (
                  <label className={`text-xs font-bold uppercase underline cursor-pointer ${busyId === r.id ? "opacity-50 pointer-events-none" : ""}`}>
                    {r.payment_proof_url ? "Replace proof" : "Add proof"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        uploadProof(r.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <div className="flex flex-wrap justify-start sm:justify-end gap-2">
                  {r.payment_status === "pending_review" && (
                    <>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "approve")}
                        className="px-3 py-1.5  bg-green-700 text-white text-xs font-bold uppercase disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => act(r.id, "reject")}
                        className="px-3 py-1.5  bg-danger text-white text-xs font-bold uppercase disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.payment_status === "confirmed" && !r.checked_in && can(r.production_id, "manager") && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => setTransferring(r)}
                      className="px-3 py-1.5 border border-ink/30 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      Transfer
                    </button>
                  )}
                  {["rejected", "expired"].includes(r.payment_status) && !isTransferred(r.rejection_reason) && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "reopen")}
                      className="px-3 py-1.5  bg-ink/10 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                  {r.order_count > 1 && r.payment_status === "pending_review" && (
                    <>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => actOrder(r, "approve")}
                        className="px-3 py-1.5 border border-green-700 text-green-700 text-xs font-bold uppercase disabled:opacity-50"
                      >
                        Approve order
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => actOrder(r, "reject")}
                        className="px-3 py-1.5 border border-danger text-danger text-xs font-bold uppercase disabled:opacity-50"
                      >
                        Reject order
                      </button>
                    </>
                  )}
                  {r.order_count > 1 && ["rejected", "expired"].includes(r.payment_status) && !isTransferred(r.rejection_reason) && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => actOrder(r, "reopen")}
                      className="px-3 py-1.5 border border-ink/20 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      Reopen order
                    </button>
                  )}
                  {!isTransferred(r.rejection_reason) && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "resend-email")}
                    className="px-3 py-1.5  border border-ink/20 text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Resend email
                  </button>
                  )}
                  {can(r.production_id, "manager") && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => remove(r)}
                      className="px-3 py-1.5 border border-danger text-danger text-xs font-bold uppercase disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && rows.length === 0 && (
          <p className="text-muted text-sm">{filtered ? "No reservations match your search. Try another status tab or clear the search." : "No reservations in this view."}</p>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-6 text-sm">
          <p className="text-muted">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5  border border-ink/20 text-xs font-bold uppercase disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5  border border-ink/20 text-xs font-bold uppercase disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {transferring && (
        <TransferDialog
          reservation={transferring}
          onClose={() => setTransferring(null)}
          onDone={() => {
            setTransferring(null);
            load();
          }}
        />
      )}
    </div>
  );
}
