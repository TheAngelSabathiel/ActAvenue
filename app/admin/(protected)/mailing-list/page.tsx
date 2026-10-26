"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Spinner } from "@/components/spinner";
import { formatDateTime } from "@/lib/datetime";

type Sub = { id: string; email: string; name: string | null; source: string; subscribed_at: string; unsubscribed_at: string | null };
type Campaign = { id: string; subject: string; sent_count: number; created_at: string };

const field = "border border-ink/20 px-3 py-2 text-sm";

function downloadCsv(filename: string, rows: string[][]) {
  const safe = (c: string) => (/^[=+\-@\t\r]/.test(c) ? `'${c}` : c);
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${safe(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MailingListPage() {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState<"" | "test" | "all">("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mailing-list");
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "Could not load.");
      setSubs([]);
      return;
    }
    setError(null);
    setSubs(d.subscribers ?? []);
    setCampaigns(d.campaigns ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!subs) return <Spinner />;
  const active = subs.filter((s) => !s.unsubscribed_at);
  const shown = subs.filter((s) => !q.trim() || `${s.email} ${s.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/mailing-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail, name: addName }),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error ?? "Could not add.");
    toast.success("Added.");
    setAddEmail("");
    setAddName("");
    load();
  }

  async function remove(s: Sub) {
    if (!confirm(`Remove ${s.email} from the list?`)) return;
    const res = await fetch(`/api/admin/mailing-list?id=${s.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Could not remove.");
    toast.success("Removed.");
    load();
  }

  async function send(test: boolean) {
    if (!subject.trim() || !body.trim()) return toast.error("Add a subject and a message.");
    if (!test && !confirm(`Send this to ${active.length} subscriber${active.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setSending(test ? "test" : "all");
    try {
      const res = await fetch("/api/admin/mailing-list/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, test }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not send.");
      toast.success(test ? `Test sent to ${d.to}.` : `Sent to ${d.sent}.`);
      if (!test) {
        setSubject("");
        setBody("");
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending("");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Mailing list</h1>
        <p className="text-sm text-muted mb-0">People who chose to hear about new shows. Every email has an unsubscribe link.</p>
      </div>
      {error && <p className="text-sm text-danger font-bold">{error}</p>}

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="aa-card p-4"><p className="aa-label text-muted mb-1">Subscribed</p><p className="text-2xl font-black mb-0">{active.length}</p></div>
        <div className="aa-card p-4"><p className="aa-label text-muted mb-1">Unsubscribed</p><p className="text-2xl font-black mb-0">{subs.length - active.length}</p></div>
      </div>

      <section className="aa-card p-5 space-y-3">
        <h2 className="text-xl mb-0">Send an announcement</h2>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={150} className={`${field} w-full`} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Message. Leave a blank line between paragraphs. Links turn clickable." className={`${field} w-full`} />
        <div className="flex flex-wrap gap-3">
          <button onClick={() => send(true)} disabled={!!sending} className="aa-btn aa-btn-outline aa-btn-sm">
            {sending === "test" ? "Sending..." : "Send test to me"}
          </button>
          <button onClick={() => send(false)} disabled={!!sending || active.length === 0} className="aa-btn aa-btn-sm">
            {sending === "all" ? "Sending..." : `Send to ${active.length}`}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl mb-0">Subscribers</h2>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${field} w-48`} aria-label="Search" />
            <button
              onClick={() =>
                downloadCsv("mailing-list.csv", [
                  ["Email", "Name", "Source", "Subscribed", "Status"],
                  ...subs.map((s) => [s.email, s.name ?? "", s.source, formatDateTime(s.subscribed_at), s.unsubscribed_at ? "Unsubscribed" : "Subscribed"]),
                ])
              }
              className="aa-btn aa-btn-outline aa-btn-sm"
              disabled={subs.length === 0}
            >
              <i className="bi bi-download" /> CSV
            </button>
          </div>
        </div>

        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input type="email" required value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Add an email" className={`${field} w-64`} />
          <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name (optional)" className={`${field} w-48`} />
          <button className="aa-btn aa-btn-outline aa-btn-sm">Add</button>
        </form>

        {shown.length === 0 ? (
          <p className="text-muted">{subs.length === 0 ? "Nobody has subscribed yet." : "No matches."}</p>
        ) : (
          <div className="aa-card divide-y divide-[#f1f3f5] max-h-[30rem] overflow-y-auto">
            {shown.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold mb-0 truncate">{s.email}{s.unsubscribed_at && <span className="ml-2 aa-label bg-soft px-2 py-0.5 text-muted">Unsubscribed</span>}</p>
                  <p className="text-xs text-muted mb-0">{s.name ? `${s.name} · ` : ""}{s.source} · {formatDateTime(s.subscribed_at)}</p>
                </div>
                <button onClick={() => remove(s)} className="text-xs font-bold uppercase text-danger/70 hover:text-danger shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {campaigns.length > 0 && (
        <section>
          <h2 className="text-xl mb-3">Sent</h2>
          <div className="aa-card divide-y divide-[#f1f3f5]">
            {campaigns.map((c) => (
              <div key={c.id} className="p-3 flex justify-between gap-3 text-sm">
                <span className="font-bold truncate">{c.subject}</span>
                <span className="text-muted whitespace-nowrap">{c.sent_count} · {formatDateTime(c.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
