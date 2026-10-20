"use client";

import { toast } from "@/lib/toast";

import { useState } from "react";
import { formatDateTime } from "@/lib/datetime";

type Result = {
  id: string;
  reference_code: string;
  buyer_name: string;
  payment_status: string;
  checked_in: boolean;
  checked_in_at: string | null;
  reservation_items: { id: string; quantity: number; scans_used?: number; ticket_code?: string | null; ticket_tier: { label: string } }[];
};

export default function CheckinPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/checkin?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setMatched(data.matched_item_id ?? null);
    setLoading(false);
  }

  async function checkIn(itemId: string, count: number) {
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, count }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Check-in failed.");
      setMessage(data.error);
      return;
    }
    toast.success(`Admitted ${data.admitted} for ${data.reservation.buyer_name}.`);
    setMessage(null);
    search();
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-extrabold text-3xl mb-6">Door check-in</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Reference code or name"
          className="flex-1 border border-ink/20  px-3 py-2 tabular-nums"
        />
        <button
          onClick={search}
          disabled={loading}
          className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase"
        >
          Search
        </button>
      </div>

      {message && <p className="text-sm mb-4 text-danger">{message}</p>}

      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.id} className="aa-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-extrabold">{r.buyer_name}</p>
              <p className="text-xs tabular-nums text-muted break-words">
                {r.reference_code} · {r.reservation_items.map((i) => `${i.quantity}× ${i.ticket_tier.label}`).join(", ")}
              </p>
              <p className="text-xs text-muted">Status: {r.payment_status}</p>
            </div>
            <div className="w-full space-y-2">
              {r.reservation_items.map((i) => {
                const used = i.scans_used ?? 0;
                const left = i.quantity - used;
                return (
                  <div key={i.id} className={`flex flex-wrap items-center justify-between gap-2 border p-2 ${matched === i.id ? "border-black border-2" : "border-ink/10"}`}>
                    <p className="text-sm mb-0">
                      <strong>{i.ticket_tier.label}</strong> · admitted {used}/{i.quantity}
                      {matched === i.id && <span className="aa-label bg-accent px-2 py-0.5 ml-2">Scanned</span>}
                    </p>
                    {left <= 0 ? (
                      <span className="text-xs font-bold uppercase text-green-700">Fully used</span>
                    ) : (
                      <span className="flex gap-2">
                        <button onClick={() => checkIn(i.id, 1)} disabled={r.payment_status !== "confirmed"} className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold uppercase disabled:opacity-40">Admit 1</button>
                        {left > 1 && (
                          <button onClick={() => checkIn(i.id, left)} disabled={r.payment_status !== "confirmed"} className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase disabled:opacity-40">Admit all {left}</button>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
              {r.checked_in && <p className="text-xs font-bold uppercase text-green-700 mb-0">Everyone admitted {r.checked_in_at ? formatDateTime(r.checked_in_at) : ""}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
