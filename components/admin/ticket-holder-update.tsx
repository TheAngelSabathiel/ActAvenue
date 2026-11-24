"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/datetime";

type Perf = { id: string; label: string; datetime: string; venue: string };
type Counts = Record<string, { confirmed: number; pending: number }>;

const field = "border border-ink/20 px-3 py-2 text-sm";

/**
 * Production editor section (managers and admins): email everyone booked for
 * one or more shows, e.g. a venue change or show reminders. Goes out under the
 * same subject as their booking email, with their current show details.
 */
export function TicketHolderUpdate({ productionId, performances }: { productionId: string; performances: Perf[] }) {
  const [counts, setCounts] = useState<Counts>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [includePending, setIncludePending] = useState(false);
  const [withQr, setWithQr] = useState(true);
  const [sending, setSending] = useState<"" | "test" | "all">("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/productions/${productionId}/notify`);
    if (res.ok) setCounts((await res.json()).counts ?? {});
  }, [productionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const total = picked.reduce((n, id) => n + (counts[id]?.confirmed ?? 0) + (includePending ? counts[id]?.pending ?? 0 : 0), 0);
  const allPicked = performances.length > 0 && picked.length === performances.length;

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function send(test: boolean) {
    if (!picked.length) return toast.error("Pick at least one show.");
    if (!message.trim()) return toast.error("Write the update first.");
    if (!test && !confirm(`Email ${total} booking${total === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setSending(test ? "test" : "all");
    try {
      const res = await fetch(`/api/admin/productions/${productionId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ performance_ids: picked, message, include_pending: includePending, with_qr: withQr, test }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not send.");
      toast.success(test ? `Test sent to ${d.to}.` : `Sent to ${d.sent} booking${d.sent === 1 ? "" : "s"}.`);
      if (!test) setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending("");
    }
  }

  return (
    <section className="aa-card p-5 space-y-3">
      <div>
        <h2 className="font-extrabold text-xl mb-1">Email ticket holders</h2>
        <p className="text-sm text-muted mb-0">
          Venue change, reminders, show instructions. It goes out under the same subject as their booking email, with each show&apos;s current date, time and venue. Changed the venue? Save it in Performances first.
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase text-muted">Shows</span>
          <button
            type="button"
            onClick={() => setPicked(allPicked ? [] : performances.map((p) => p.id))}
            className="text-xs font-bold uppercase underline"
            disabled={!performances.length}
          >
            {allPicked ? "Clear" : "Select all"}
          </button>
        </div>
        {performances.length === 0 && <p className="text-sm text-muted mb-0">Add a performance first.</p>}
        {performances.map((p) => {
          const c = counts[p.id] ?? { confirmed: 0, pending: 0 };
          return (
            <label key={p.id} className="flex items-start gap-2 text-sm border border-ink/10 p-2">
              <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} className="mt-1" />
              <span className="min-w-0">
                <span className="font-bold">{p.label}</span>
                <span className="block text-xs text-muted">
                  {formatDateTime(p.datetime)} · {p.venue} · {c.confirmed} confirmed{c.pending ? `, ${c.pending} pending` : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={7}
        placeholder="Your update. Leave a blank line between paragraphs. Links turn clickable. Each email starts with Hi (name) and ends with their show details."
        className={`${field} w-full`}
      />

      <div className="space-y-1 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={withQr} onChange={(e) => setWithQr(e.target.checked)} />
          Include their QR codes again
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} />
          Also email pending bookings (no QR yet)
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => send(true)} disabled={!!sending || total === 0} className="aa-btn aa-btn-outline aa-btn-sm">
          {sending === "test" ? "Sending..." : "Send test to me"}
        </button>
        <button type="button" onClick={() => send(false)} disabled={!!sending || total === 0} className="aa-btn aa-btn-sm">
          {sending === "all" ? "Sending..." : `Send to ${total}`}
        </button>
      </div>
    </section>
  );
}
