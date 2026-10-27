"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/spinner";
import { formatDateTime } from "@/lib/datetime";
import { sortByName } from "@/lib/sort";

type Tier = { label: string; capacity: number; sold: number; pending: number };
type Perf = {
  id: string; label: string; datetime: string; venue: string;
  capacity: number; sold: number; pending: number; remaining: number; revenue: number;
  admitted: number; started: boolean; noShows: number | null; tiers: Tier[];
};
type Data = {
  productions: { id: string; title: string }[];
  production?: { id: string; title: string };
  performances?: Perf[];
  salesByDay?: { day: string; tickets: number; revenue: number }[];
  status?: Record<string, number>;
  totals?: { revenue: number; sold: number; pending: number; capacity: number; online: number; walkIn: number };
  promos?: { code: string; uses: number; discount: number }[];
};

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const dayLabel = (d: string) => new Date(`${d}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

function Stat({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="aa-label text-muted mb-1">{label}</p>
      <p className="text-2xl font-black mb-0">{value}</p>
      {sub && <p className="text-xs text-muted mb-0">{sub}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="aa-card p-4 block hover:border-black transition-colors">
        {body}
      </Link>
    );
  }
  return <div className="aa-card p-4">{body}</div>;
}

function SeatBar({ sold, pending, capacity }: { sold: number; pending: number; capacity: number }) {
  return (
    <div className="h-4 w-full bg-[#e9ecef] flex overflow-hidden" role="img" aria-label={`${sold} sold, ${pending} pending of ${capacity}`}>
      <div className="bg-black" style={{ width: `${pct(sold, capacity)}%` }} />
      <div className="bg-accent" style={{ width: `${pct(pending, capacity)}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const [productionId, setProductionId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard${id ? `?production_id=${id}` : ""}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not load.");
      if (!id && d.productions?.length) {
        // First visit: open the most recent production.
        setProductionId(d.productions[0].id);
        return;
      }
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(productionId);
  }, [productionId, load]);

  if (!data && loading) return <Spinner />;
  const t = data?.totals;
  const maxDay = Math.max(1, ...(data?.salesByDay ?? []).map((d) => d.tickets));
  const pending = data?.status?.pending_review ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-muted mb-0">Seats, sales and attendance. Confirmed payments count as sold.</p>
        </div>
        {data && data.productions.length > 0 && (
          <select
            value={productionId}
            onChange={(e) => setProductionId(e.target.value)}
            className="border border-ink/20 px-3 py-2 text-sm min-w-56"
            aria-label="Production"
          >
            {sortByName(data.productions, (p) => p.title).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-danger font-bold">{error}</p>}
      {data && data.productions.length === 0 && <p className="text-muted">No productions yet.</p>}

      {data?.performances && t && (
        <>
          {pending > 0 && (
            <Link href="/admin/reservations?status=pending_review" className="aa-card p-4 flex items-center justify-between border-l-[8px] border-accent">
              <span className="font-bold"><i className="bi bi-hourglass-split" /> {pending} booking{pending === 1 ? "" : "s"} waiting for payment review</span>
              <span className="aa-label mb-0">Review <i className="bi bi-arrow-right" /></span>
            </Link>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Revenue" value={peso(t.revenue)} sub="Confirmed bookings" />
            <Stat label="Tickets sold" value={`${t.sold}`} sub={`${pct(t.sold, t.capacity)}% of ${t.capacity} seats`} />
            <Stat label="Pending" value={`${t.pending}`} sub="Awaiting payment review" href="/admin/reservations?status=pending_review" />
            <Stat label="Online / walk-in" value={`${t.online} / ${t.walkIn}`} sub="Tickets by source" />
          </div>

          <section className="space-y-4">
            <h2 className="text-xl">Shows</h2>
            {data.performances.length === 0 && <p className="text-muted">No shows yet.</p>}
            {data.performances.map((p) => (
              <div key={p.id} className="aa-card p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-lg mb-0">{p.label}</p>
                    <p className="text-sm text-muted mb-0">{formatDateTime(p.datetime)} · {p.venue}</p>
                  </div>
                  <p className="font-black text-lg mb-0">{peso(p.revenue)}</p>
                </div>

                <div className="space-y-1.5">
                  <SeatBar sold={p.sold} pending={p.pending} capacity={p.capacity} />
                  <p className="text-sm mb-0">
                    <strong>{p.sold}</strong> sold · <strong>{p.pending}</strong> pending · <strong>{p.remaining}</strong> left of {p.capacity}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="aa-label text-muted mb-2">Attendance</p>
                    {p.sold === 0 ? (
                      <p className="text-sm text-muted mb-0">No confirmed tickets yet.</p>
                    ) : (
                      <>
                        <p className="text-sm mb-1">
                          <strong>{p.admitted}</strong> of {p.sold} admitted ({pct(p.admitted, p.sold)}%)
                        </p>
                        <p className="text-sm text-muted mb-0">
                          {p.started ? `${p.noShows} no-show${p.noShows === 1 ? "" : "s"}` : `${p.sold - p.admitted} not yet arrived`}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="aa-label text-muted mb-2">By ticket</p>
                    <div className="space-y-1 text-sm">
                      {p.tiers.map((x) => (
                        <div key={x.label} className="flex justify-between gap-3">
                          <span>{x.label}</span>
                          <span className="tabular-nums text-right">
                            {x.sold}{x.pending > 0 ? ` (+${x.pending})` : ""} / {x.capacity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2 className="text-xl mb-3">Sales by booking day</h2>
            {(data.salesByDay ?? []).length === 0 ? (
              <p className="text-muted">No confirmed sales yet.</p>
            ) : (
              <div className="aa-card p-4 space-y-1.5 max-h-96 overflow-y-auto">
                {data.salesByDay!.map((d) => (
                  <div key={d.day} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
                    <span className="text-muted">{dayLabel(d.day)}</span>
                    <div className="h-3 bg-[#e9ecef]">
                      <div className="h-3 bg-black" style={{ width: `${pct(d.tickets, maxDay)}%` }} />
                    </div>
                    <span className="tabular-nums text-right whitespace-nowrap">{d.tickets} · {peso(d.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h2 className="text-xl mb-3">Bookings</h2>
              <div className="aa-card p-4 space-y-1 text-sm">
                {[
                  ["Confirmed", data.status?.confirmed ?? 0],
                  ["Pending review", data.status?.pending_review ?? 0],
                  ["Rejected", data.status?.rejected ?? 0],
                  ["Expired", data.status?.expired ?? 0],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums font-bold">{v}</span></div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-xl mb-3">Promo codes used</h2>
              {(data.promos ?? []).length === 0 ? (
                <p className="text-muted">None yet.</p>
              ) : (
                <div className="aa-card p-4 space-y-1 text-sm max-h-72 overflow-y-auto">
                  {data.promos!.map((p) => (
                    <div key={p.code} className="flex justify-between gap-3">
                      <span className="font-bold break-all">{p.code}</span>
                      <span className="tabular-nums whitespace-nowrap">{p.uses} ticket{p.uses === 1 ? "" : "s"} · {peso(p.discount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
