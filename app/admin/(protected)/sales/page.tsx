"use client";

import { useCallback, useEffect, useState } from "react";

type Totals = {
  revenue: number;
  discountGiven: number;
  ticketsSold: number;
  reservationsConfirmed: number;
  onlineBookings: number;
  walkInBookings: number;
};

type ByProduction = { title: string; revenue: number; tickets: number };
type ByPerformance = { label: string; production: string; revenue: number; tickets: number };
type ByTier = { label: string; revenue: number; tickets: number };
type ByPromo = { code: string; uses: number; discountGiven: number };

type Production = { id: string; title: string };

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
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
  const [byProduction, setByProduction] = useState<ByProduction[]>([]);
  const [byPerformance, setByPerformance] = useState<ByPerformance[]>([]);
  const [byTier, setByTier] = useState<ByTier[]>([]);
  const [byPromo, setByPromo] = useState<ByPromo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (productionId) params.set("production_id", productionId);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const res = await fetch(`/api/admin/sales-summary?${params.toString()}`);
    const data = await res.json();
    setTotals(data.totals);
    setByProduction(data.byProduction ?? []);
    setByPerformance(data.byPerformance ?? []);
    setByTier(data.byTier ?? []);
    setByPromo(data.byPromo ?? []);
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

  function exportCsv() {
    const rows: (string | number)[][] = [["Section", "Label", "Revenue", "Tickets"]];
    byProduction.forEach((p) => rows.push(["Production", p.title, p.revenue.toFixed(2), p.tickets]));
    byPerformance.forEach((p) =>
      rows.push(["Performance", `${p.production} - ${p.label}`, p.revenue.toFixed(2), p.tickets])
    );
    byTier.forEach((t) => rows.push(["Ticket tier", t.label, t.revenue.toFixed(2), t.tickets]));
    rows.push([]);
    rows.push(["Promo code", "Uses", "Discount given", ""]);
    byPromo.forEach((p) => rows.push(["", p.code, p.uses, p.discountGiven.toFixed(2)]));
    downloadCsv(`sales-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-extrabold text-3xl">Sales summary</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={productionId}
            onChange={(e) => setProductionId(e.target.value)}
            className="border border-ink/20  px-3 py-2 text-sm"
          >
            <option value="">All productions</option>
            {productions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-ink/20  px-3 py-2 text-sm"
            aria-label="From date"
          />
          <span className="text-muted text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-ink/20  px-3 py-2 text-sm"
            aria-label="To date"
          />
          {(fromDate || toDate || productionId) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
                setProductionId("");
              }}
              className="text-xs font-bold uppercase text-danger underline"
            >
              Clear
            </button>
          )}
          <button
            onClick={exportCsv}
            disabled={loading || !totals}
            className="px-4 py-2  bg-black text-paper text-sm font-bold uppercase disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <p className="text-xs text-muted mb-6">
        Figures count <strong>confirmed</strong> reservations only - pending, rejected, and expired
        bookings aren&apos;t revenue yet.{" "}
        {(fromDate || toDate) && "Filtered by when the booking was made (not the show date)."}
      </p>

      {loading && <p className="text-muted">Loading...</p>}

      {totals && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <StatCard label="Revenue" value={`₱${totals.revenue.toFixed(2)}`} />
            <StatCard label="Tickets sold" value={totals.ticketsSold} />
            <StatCard label="Confirmed orders" value={totals.reservationsConfirmed} />
            <StatCard label="Discounts given" value={`₱${totals.discountGiven.toFixed(2)}`} />
            <StatCard label="Online bookings" value={totals.onlineBookings} />
            <StatCard label="Walk-in bookings" value={totals.walkInBookings} />
          </div>

          <SummaryTable
            key={`production-${productionId}-${fromDate}-${toDate}`}
            title="By production"
            rows={byProduction.map((p) => [p.title, p.tickets, `₱${p.revenue.toFixed(2)}`])}
          />
          <SummaryTable
            key={`performance-${productionId}-${fromDate}-${toDate}`}
            title="By performance"
            rows={byPerformance.map((p) => [`${p.production} - ${p.label}`, p.tickets, `₱${p.revenue.toFixed(2)}`])}
          />
          <SummaryTable
            key={`tier-${productionId}-${fromDate}-${toDate}`}
            title="By ticket tier"
            rows={byTier.map((t) => [t.label, t.tickets, `₱${t.revenue.toFixed(2)}`])}
          />

          <div className="aa-card p-5 mt-6">
            <h2 className="font-extrabold text-lg mb-3">Promo code usage</h2>
            {byPromo.length === 0 && <p className="text-sm text-muted">No promo codes used yet.</p>}
            {byPromo.length > 0 && (
              <PaginatedRows
                key={`promo-${productionId}-${fromDate}-${toDate}`}
                items={byPromo}
                pageSize={10}
                renderItem={(p) => (
                  <div
                    key={p.code}
                    className="flex justify-between text-sm py-1 border-t border-ink/10 first:border-t-0"
                  >
                    <span className="tabular-nums">{p.code}</span>
                    <span>
                      {p.uses} use{p.uses !== 1 ? "s" : ""} · ₱{p.discountGiven.toFixed(2)} given
                    </span>
                  </div>
                )}
              />
            )}
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

const TABLE_PAGE_SIZE = 10;

function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
  total,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between mt-3 pt-2 border-t border-ink/10 text-xs">
      <span className="text-muted">
        Page {page} of {totalPages} · {total} rows
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-2 py-1  border border-ink/20 font-bold uppercase disabled:opacity-40"
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="px-2 py-1  border border-ink/20 font-bold uppercase disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: (string | number)[][] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE);

  return (
    <div className="aa-card p-5 mb-6">
      <h2 className="font-extrabold text-lg mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted">No sales yet.</p>}
      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="text-left text-xs font-bold uppercase text-muted border-b border-ink/10">
                  <th className="py-1.5 font-normal">Label</th>
                  <th className="py-1.5 font-normal text-right">Tickets</th>
                  <th className="py-1.5 font-normal text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0">
                    <td className="py-1.5 pr-3">{row[0]}</td>
                    <td className="py-1.5 text-right tabular-nums">{row[1]}</td>
                    <td className="py-1.5 text-right tabular-nums">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > TABLE_PAGE_SIZE && (
            <Pager
              page={page}
              totalPages={totalPages}
              total={rows.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Generic client-side-paginated list for non-tabular rows (e.g. promo code usage). */
function PaginatedRows<T>({
  items,
  pageSize,
  renderItem,
}: {
  items: T[];
  pageSize: number;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      {pageItems.map(renderItem)}
      {items.length > pageSize && (
        <Pager
          page={page}
          totalPages={totalPages}
          total={items.length}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      )}
    </>
  );
}
