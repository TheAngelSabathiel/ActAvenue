"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";

type Row = {
  id: string;
  reference_code: string;
  buyer_name: string;
  buyer_email: string | null;
  payment_status: "pending_review" | "confirmed" | "rejected" | "expired";
  booking_source: string;
  total: number;
  payment_proof_url: string | null;
  production: { title: string };
  performance: { label: string; datetime: string };
  reservation_items: { id: string; quantity: number; ticket_tier: { label: string } }[];
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
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("pending_review");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/reservations?status=${tab}&page=${page}&pageSize=${PAGE_SIZE}`);
    const data = await res.json();
    setRows(data.reservations ?? []);
    setTotalPages(data.pagination?.totalPages ?? 1);
    setTotal(data.pagination?.total ?? 0);
    setLoading(false);
  }, [tab, page]);

  useEffect(() => {
    // Refetch on mount and whenever the status tab or page changes - intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function selectTab(s: (typeof STATUS_TABS)[number]) {
    setTab(s);
    setPage(1); // reset to first page whenever the filter changes
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
      alert(data.error ?? "Action failed");
      return;
    }
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

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-6">Reservations</h1>

      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => selectTab(s)}
            className={`px-3 py-1.5  text-xs font-bold uppercase tracking-wide border ${
              tab === s ? "bg-danger text-paper border-danger" : "border-ink/20 text-ink/60"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <Spinner className="!py-12" />}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="aa-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 break-words">
                <span
                  className={`inline-block px-2 py-0.5  text-xs font-bold uppercase mb-2 ${STATUS_STYLE[r.payment_status]}`}
                >
                  {r.payment_status.replace("_", " ")}
                </span>
                <p className="font-extrabold text-lg">{r.buyer_name}</p>
                <p className="text-xs text-muted tabular-nums">
                  {r.reference_code} · {r.buyer_email ?? "no email (walk-in)"} · {r.booking_source}
                </p>
                <p className="text-sm mt-1">
                  {r.production.title} - {r.performance.label}
                </p>
                <p className="text-xs text-muted">
                  {r.reservation_items.map((i) => `${i.quantity}× ${i.ticket_tier.label}`).join(", ")}
                  {" · "}
                  <span className="tabular-nums">₱{r.total.toFixed(2)}</span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
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
                <div className="flex flex-wrap justify-end gap-2">
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
                  {["rejected", "expired"].includes(r.payment_status) && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "reopen")}
                      className="px-3 py-1.5  bg-ink/10 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "resend-email")}
                    className="px-3 py-1.5  border border-ink/20 text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Resend email
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && rows.length === 0 && (
          <p className="text-muted text-sm">No reservations in this view.</p>
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
    </div>
  );
}
