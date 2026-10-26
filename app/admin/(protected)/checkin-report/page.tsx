"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { sortByName } from "@/lib/sort";

type Show = { id: string; label: string; datetime: string };
type Production = { id: string; title: string; performances: Show[] };
type Row = { id: string; time: string; staff: string; buyer: string; reference: string; ticket: string; admitted: number; source: string; override: boolean };
type Report = {
  performance: { id: string; label: string; datetime: string; venue: string };
  totals: { scans: number; admitted: number; door: number; manual: number; overrides: number; admittedTotal: number; unlogged: number };
  byStaff: { id: string | null; name: string; scans: number; admitted: number; overrides: number; first: string; last: string }[];
  arrivals: { time: string; admitted: number }[];
  timeline: Row[];
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const safe = (c: string | number) => {
    const s = String(c);
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${safe(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CheckinReportPage() {
  const [productions, setProductions] = useState<Production[] | null>(null);
  const [productionId, setProductionId] = useState("");
  const [performanceId, setPerformanceId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/checkin-report")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .catch(() => setProductions([]));
  }, []);

  const loadReport = useCallback(async (id: string) => {
    if (!id) return setReport(null);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/checkin-report?performance_id=${id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not load.");
      setReport(d);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReport(performanceId);
  }, [performanceId, loadReport]);

  if (!productions) return <Spinner />;
  const shows = (productions.find((p) => p.id === productionId)?.performances ?? []).slice().sort((a, b) => a.datetime.localeCompare(b.datetime));
  const maxArrival = Math.max(1, ...(report?.arrivals ?? []).map((a) => a.admitted));

  function exportCsv() {
    if (!report) return;
    downloadCsv(`checkin-report-${report.performance.label.replace(/\W+/g, "-")}.csv`, [
      ["Time (Manila)", "Staff", "Buyer", "Reference", "Ticket code", "Admitted", "How", "Override"],
      ...report.timeline.slice().reverse().map((r) => [formatDateTime(r.time), r.staff, r.buyer, r.reference, r.ticket, r.admitted, r.source === "scan" ? "Scanner" : "Manual", r.override ? "Yes" : ""]),
    ]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Check-in report</h1>
        <p className="text-sm text-muted mb-0">Who admitted whom at the door, and when. Counts start from the day the scan log was turned on.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={productionId}
          onChange={(e) => {
            setProductionId(e.target.value);
            setPerformanceId("");
          }}
          className="border border-ink/20 px-3 py-2 text-sm min-w-56"
          aria-label="Production"
        >
          <option value="">Choose a production</option>
          {sortByName(productions, (p) => p.title).map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <select
          value={performanceId}
          onChange={(e) => setPerformanceId(e.target.value)}
          disabled={!productionId}
          className="border border-ink/20 px-3 py-2 text-sm min-w-56 disabled:opacity-50"
          aria-label="Show"
        >
          <option value="">Choose a show</option>
          {shows.map((s) => (
            <option key={s.id} value={s.id}>{s.label} · {formatDateTime(s.datetime)}</option>
          ))}
        </select>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-danger font-bold">{error}</p>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Admitted", `${report.totals.admittedTotal}`, "All entries for this show"],
              ["Scans logged", `${report.totals.scans}`, `${report.totals.door} scanner · ${report.totals.manual} manual`],
              ["Overrides", `${report.totals.overrides}`, "Outside the scan window"],
              ["Before the log", `${report.totals.unlogged}`, "Entries with no staff record"],
            ].map(([label, value, sub]) => (
              <div key={label} className="aa-card p-4">
                <p className="aa-label text-muted mb-1">{label}</p>
                <p className="text-2xl font-black mb-0">{value}</p>
                <p className="text-xs text-muted mb-0">{sub}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-xl mb-3">By staff</h2>
            {report.byStaff.length === 0 ? (
              <p className="text-muted">No scans logged for this show yet.</p>
            ) : (
              <div className="aa-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left aa-label text-muted border-b border-[#dee2e6]">
                      <th className="p-3">Staff</th>
                      <th className="p-3 text-right">Scans</th>
                      <th className="p-3 text-right">Admitted</th>
                      <th className="p-3 text-right">Overrides</th>
                      <th className="p-3 whitespace-nowrap">First</th>
                      <th className="p-3 whitespace-nowrap">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byStaff.map((s) => (
                      <tr key={s.id ?? "unknown"} className="border-b border-[#f1f3f5] last:border-0">
                        <td className="p-3 font-bold">{s.name}</td>
                        <td className="p-3 text-right tabular-nums">{s.scans}</td>
                        <td className="p-3 text-right tabular-nums">{s.admitted}</td>
                        <td className="p-3 text-right tabular-nums">{s.overrides}</td>
                        <td className="p-3 whitespace-nowrap">{formatTime(s.first)}</td>
                        <td className="p-3 whitespace-nowrap">{formatTime(s.last)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {report.arrivals.length > 0 && (
            <section>
              <h2 className="text-xl mb-3">Arrivals</h2>
              <div className="aa-card p-4 space-y-1.5">
                {report.arrivals.map((a) => (
                  <div key={a.time} className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="text-muted tabular-nums">{a.time}</span>
                    <div className="h-3 bg-[#e9ecef]"><div className="h-3 bg-black" style={{ width: `${Math.round((a.admitted / maxArrival) * 100)}%` }} /></div>
                    <span className="tabular-nums text-right">{a.admitted}</span>
                  </div>
                ))}
                <p className="text-xs text-muted mt-2 mb-0">People admitted per 15 minutes, Philippine time.</p>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl mb-0">Timeline</h2>
              {report.timeline.length > 0 && (
                <button onClick={exportCsv} className="aa-btn aa-btn-outline aa-btn-sm"><i className="bi bi-download" /> Export CSV</button>
              )}
            </div>
            {report.timeline.length === 0 ? (
              <p className="text-muted">Nothing yet.</p>
            ) : (
              <div className="aa-card divide-y divide-[#f1f3f5] max-h-[32rem] overflow-y-auto">
                {report.timeline.map((r) => (
                  <div key={r.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold mb-0 truncate">{r.buyer || "Unknown buyer"} <span className="font-normal text-muted">· {r.admitted} in</span></p>
                      <p className="text-xs text-muted mb-0">{r.ticket || r.reference} · by {r.staff} · {r.source === "scan" ? "scanner" : "manual"}{r.override ? " · override" : ""}</p>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap">{formatDateTime(r.time)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
