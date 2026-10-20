"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/datetime";

type Perf = {
  id: string;
  label: string;
  datetime: string;
  venue: string;
  ticket_tiers: { id: string; label: string; tier_type: string; quantity_available: number; quantity_held: number }[];
};

export type TransferTarget = {
  id: string;
  production_id: string;
  performance_id: string;
  reference_code: string;
  buyer_name: string;
  performance: { label: string; datetime: string };
  reservation_items: { id: string; quantity: number; ticket_tier: { label: string; tier_type: string } }[];
};

/** Pick a new show for a confirmed booking, with a clear warning before it happens. */
export function TransferDialog({
  reservation,
  onClose,
  onDone,
}: {
  reservation: TransferTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const [perfs, setPerfs] = useState<Perf[] | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/productions/${reservation.production_id}/performances`)
      .then((r) => r.json())
      .then((d) => alive && setPerfs(d.performances ?? []))
      .catch(() => alive && setPerfs([]));
    return () => {
      alive = false;
    };
  }, [reservation.production_id]);

  const options = (perfs ?? []).filter((p) => p.id !== reservation.performance_id);
  const chosen = options.find((p) => p.id === target);

  // Left for each ticket line on the chosen show (same tier type).
  const lines = chosen
    ? reservation.reservation_items.map((i) => {
        const tier = chosen.ticket_tiers.find((t) => t.tier_type === i.ticket_tier.tier_type);
        const left = tier ? tier.quantity_available - tier.quantity_held : null;
        return { label: i.ticket_tier.label, quantity: i.quantity, left };
      })
    : [];
  const blocked = lines.some((l) => l.left === null || l.left < l.quantity);

  async function confirmTransfer() {
    setBusy(true);
    const res = await fetch(`/api/admin/reservations/${reservation.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ performance_id: target }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Transfer failed.");
      return;
    }
    toast.success(
      data.emailed
        ? `Transferred. New reference ${data.reservation.reference_code}, email sent.`
        : `Transferred. New reference ${data.reservation.reference_code}. No email was sent.`
    );
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Transfer booking">
      <div className="bg-white w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-extrabold text-xl mb-0">Transfer booking</h2>
        <p className="text-sm mb-0">
          <strong>{reservation.reference_code}</strong> ({reservation.buyer_name}) is on{" "}
          <strong>{reservation.performance.label}</strong>, {formatDateTime(reservation.performance.datetime)}.
        </p>

        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Move to</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={perfs === null || busy}
            className="w-full border border-ink/20 px-3 py-2 text-sm"
          >
            <option value="">{perfs === null ? "Loading shows..." : options.length ? "Select a show..." : "No other shows"}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} - {formatDateTime(p.datetime)}
              </option>
            ))}
          </select>
        </div>

        {chosen && (
          <ul className="text-sm space-y-1">
            {lines.map((l) => (
              <li key={l.label} className={l.left === null || l.left < l.quantity ? "text-danger font-bold" : ""}>
                {l.quantity} x {l.label}:{" "}
                {l.left === null ? "no matching tier on that show" : l.left < l.quantity ? `only ${l.left} left` : `${l.left} left`}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted mb-0">
          The buyer gets a new reference code and QR by email. The current QR stops working and this booking is marked
          Rejected. Seats are released here and held on the new show. If the new show has no slots left for the same
          ticket tier, nothing changes.
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 border border-ink/20 text-sm font-bold uppercase">
            Cancel
          </button>
          <button
            onClick={confirmTransfer}
            disabled={!target || busy || blocked}
            className="px-4 py-2 bg-black text-white text-sm font-bold uppercase disabled:opacity-50"
          >
            {busy ? "Transferring..." : "Confirm transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
