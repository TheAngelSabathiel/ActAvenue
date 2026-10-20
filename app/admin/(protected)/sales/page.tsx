"use client";

import { sortByName } from "@/lib/sort";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { formatDateTime, manilaToday } from "@/lib/datetime";

type Totals = {
  revenue: number;
  discountGiven: number;
  ticketsSold: number;
  reservationsConfirmed: number;
  onlineBookings: number;
  walkInBookings: number;
};
type Tier = { id: string; label: string; price: number; tickets: number; gross: number; discount: number; revenue: number };
type Perf = { id: string; label: string; datetime: string; venue: string; tickets: number; gross: number; discount: number; revenue: number; tiers: Tier[] };
type Prod = { id: string; title: string; tickets: number; gross: number; discount: number; revenue: number; performances: Perf[] };
type ByPromo = { code: string; uses: number; discountGiven: number };
type Production = { id: string; title: string };

const peso = (n: number) => `₱${n.toFixed(2)}`;

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = "﻿" + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SalesSummaryPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [productionId, setProductionId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [data, setData] = useState<Prod[]>([]);
  const [byPromo, setByPromo] = useState<ByPromo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (productionId) params.set("production_id", productionId);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const res = await fetch(`/api/admin/sales-summary?${params.toString()}`);
    const d = await res.json();
    setTotals(d.totals ?? null);
    setData(d.productions ?? []);
    setByPromo(d.byPromo ?? []);
    setLoading(false);
  }, [productionId, fromDate, toDate]);

  useEffect(() => {
    fetch("/api/admin/productions")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function exportUrl(kind: "orders" | "participants", performanceId?: string) {
    const p = new URLSearchParams({ kind });
    if (performanceId) p.set("performance_id", performanceId);
    else if (productionId) p.set("production_id", productionId);
    if (!performanceId) {
      if (fromDate) p.set("from", fromDate);
      if (toDate) p.set("to", toDate);
    }
    return `/api/admin/exports?${p.toString()}`;
  }

  function exportSummary() {
    const rows: (string | number)[][] = [
      ["Production", "Show", "Show date and time (PHT)", "Ticket type", "Price", "Tickets", "Gross", "Discounts", "Revenue"],
    ];
    for (const p of data) {
      for (const pf of p.performances) {
        for (const t of pf.tiers) {
          rows.push([p.title, pf.label, formatDateTime(pf.datetime), t.label, t.price.toFixed(2), t.tickets, t.gross.toFixed(2), t.discount.toFixed(2), t.revenue.toFixed(2)]);
        }
        rows.push([p.title, pf.label, formatDateTime(pf.datetime), "SHOW TOTAL", "", pf.tickets, pf.gross.toFixed(2), pf.discount.toFixed(2), pf.revenue.toFixed(2)]);
      }
      rows.push([p.title, "PRODUCTION TOTAL", "", "", "", p.tickets, p.gross.toFixed(2), p.discount.toFixed(2), p.revenue.toFixed(2)]);
    }
    rows.push([]);
    rows.push(["Promo code", "Tickets using code", "Discount given"]);
    byPromo.forEach((p) => rows.push([p.code, p.uses, p.discountGiven.toFixed(2)]));
    downloadCsv(`sales-summary-${manilaToday()}.csv`, rows);
  }

  const btn = "px-4 py-2 text-sm font-bold uppercase disabled:opacity-50";

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-extrabold text-3xl">Sales summary</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={productionId} onChange={(e) => setProductionId(e.target.value)} className="border border-ink/20 px-3 py-2 text-sm">
            <option value="">All productions</option>
            {sortByName(productions, (p) => p.title).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-ink/20 px-3 py-2 text-sm" aria-label="From date" />
          <span className="text-muted text-sm">to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-ink/20 px-3 py-2 text-sm" aria-label="To date" />
          <span className="text-xs font-bold uppercase text-muted">PHT</span>
          {(fromDate || toDate || productionId) && (
            <button onClick={() => { setFromDate(""); setToDate(""); setProductionId(""); }} className="text-xs font-bold uppercase text-danger underline">Clear</button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={exportSummary} disabled={loading || !totals} className={`${btn} bg-black text-paper`}>Summary CSV</button>
        <a href={exportUrl("orders")} className={`${btn} border border-black`}>Orders CSV (full details)</a>
        <a href={exportUrl("participants")} className={`${btn} border border-black`}>Participants CSV</a>
      </div>

      <p className="text-xs text-muted mb-6">
        Sales figures count <strong>confirmed</strong> bookings only. Every show and ticket type is listed, even with no sales yet.{" "}
        {(fromDate || toDate) && "Filtered by when the booking was made (not the show date)."}
      </p>

      {loading && <Spinner className="!py-12" />}

      {totals && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <StatCard label="Revenue" value={peso(totals.revenue)} />
            <StatCard label="Tickets sold" value={totals.ticketsSold} />
            <StatCard label="Confirmed orders" value={totals.reservationsConfirmed} />
            <StatCard label="Discounts given" value={peso(totals.discountGiven)} />
            <StatCard label="Online bookings" value={totals.onlineBookings} />
            <StatCard label="Walk-in bookings" value={totals.walkInBookings} />
          </div>

          {data.map((p) => (
            <section key={p.id} className="mb-10">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-4 border-black pb-2 mb-4">
                <h2 className="font-extrabold text-2xl">{p.title}</h2>
                <p className="text-sm mb-0 tabular-nums">
                  <strong>{p.tickets}</strong> tickets · discounts {peso(p.discount)} · revenue <strong>{peso(p.revenue)}</strong>
                </p>
              </div>
              {p.performances.length === 0 && <p className="text-sm text-muted">No shows scheduled yet.</p>}
              {p.performances.map((pf) => (
                <div key={pf.id} className="aa-card p-5 mb-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-extrabold text-lg mb-0">{pf.label}</h3>
                      <p className="text-sm text-muted mb-0">{formatDateTime(pf.datetime)} · {pf.venue}</p>
                    </div>
                    <a href={exportUrl("participants", pf.id)} className="text-xs font-bold uppercase underline">Download participant list</a>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="text-xs font-bold uppercase text-muted border-b border-ink/10">
                          <th className="py-1.5 font-normal text-left">Ticket type</th>
                          <th className="py-1.5 font-normal text-right">Price</th>
                          <th className="py-1.5 font-normal text-right">Tickets</th>
                          <th className="py-1.5 font-normal text-right">Gross</th>
                          <th className="py-1.5 font-normal text-right">Discounts</th>
                          <th className="py-1.5 font-normal text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pf.tiers.map((t) => (
                          <tr key={t.id} className="border-b border-ink/5">
                            <td className="py-1.5 pr-3">{t.label}</td>
                            <td className="py-1.5 text-right tabular-nums">{peso(t.price)}</td>
                            <td className="py-1.5 text-right tabular-nums">{t.tickets}</td>
                            <td className="py-1.5 text-right tabular-nums">{peso(t.gross)}</td>
                            <td className="py-1.5 text-right tabular-nums">{peso(t.discount)}</td>
                            <td className="py-1.5 text-right tabular-nums">{peso(t.revenue)}</td>
                          </tr>
                        ))}
                        <tr className="font-extrabold">
                          <td className="py-1.5" colSpan={2}>Show total</td>
                          <td className="py-1.5 text-right tabular-nums">{pf.tickets}</td>
                          <td className="py-1.5 text-right tabular-nums">{peso(pf.gross)}</td>
                          <td className="py-1.5 text-right tabular-nums">{peso(pf.discount)}</td>
                          <td className="py-1.5 text-right tabular-nums">{peso(pf.revenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          ))}

          <div className="aa-card p-5 mt-6">
            <h2 className="font-extrabold text-lg mb-1">Promo code usage</h2>
            <p className="text-xs text-muted mb-3">One use per discounted ticket.</p>
            {byPromo.length === 0 && <p className="text-sm text-muted">No promo codes used yet.</p>}
            {byPromo.map((p) => (
              <div key={p.code} className="flex justify-between text-sm py-1 border-t border-ink/10 first:border-t-0">
                <span className="tabular-nums">{p.code}</span>
                <span>{p.uses} ticket{p.uses !== 1 ? "s" : ""} · {peso(p.discountGiven)} given</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="aa-card p-4">
      <p className="text-xs font-bold uppercase text-muted mb-1">{label}</p>
      <p className="font-extrabold text-2xl">{value}</p>
    </div>
  );
}
