"use client";

import { useEffect, useState, useCallback } from "react";
import { CREDIT_TYPE_LABEL, type CreditSection, type CreditType } from "@/lib/credits";

type Person = {
  id: string;
  display_name: string | null;
  is_public: boolean;
  is_approved: boolean;
};

type Credit = {
  id: string;
  role_played: string;
  section: CreditSection;
  credit_type: CreditType | null;
  play_id: string | null;
  sort_order: number;
  is_discredited: boolean;
  profile: Person;
};

type Play = { id: string; title: string; sort_order: number };

const field = "border border-ink/20 px-3 py-2 text-sm";
const mini = "text-xs font-bold uppercase text-muted hover:text-ink disabled:opacity-30";

export function CreditsManager({ productionId }: { productionId: string }) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [newPlay, setNewPlay] = useState("");
  const [personId, setPersonId] = useState("");
  const [section, setSection] = useState<CreditSection>("artistic");
  const [type, setType] = useState<CreditType>("actor");
  const [playId, setPlayId] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, p, a] = await Promise.all([
      fetch(`/api/admin/productions/${productionId}/credits`).then((r) => r.json()),
      fetch(`/api/admin/productions/${productionId}/plays`).then((r) => r.json()),
      fetch(`/api/admin/actors`).then((r) => r.json()),
    ]);
    setCredits(c.credits ?? []);
    setPlays(p.plays ?? []);
    setPeople(a.actors ?? []);
  }, [productionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMessage(data.error ?? "Something went wrong.");
    else setMessage(null);
    await load();
    return res.ok;
  }

  async function addPlay(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlay.trim()) return;
    if (await send(`/api/admin/productions/${productionId}/plays`, "POST", { title: newPlay.trim() })) setNewPlay("");
  }

  async function movePlay(index: number, dir: -1 | 1) {
    const ids = plays.map((p) => p.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await send(`/api/admin/productions/${productionId}/reorder`, "POST", { table: "plays", ids });
  }

  async function deletePlay(p: Play) {
    if (!confirm(`Delete "${p.title}"? Its credits stay, but move to "no specific play".`)) return;
    await send(`/api/admin/plays/${p.id}`, "DELETE");
  }

  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await send(`/api/admin/productions/${productionId}/credits`, "POST", {
      profile_id: personId,
      section,
      credit_type: section === "artistic" ? type : null,
      play_id: section === "artistic" && playId ? playId : null,
      role_played: role,
    });
    setBusy(false);
    setRole("");
  }

  const sameGroup = (a: Credit, b: Credit) =>
    a.section === b.section &&
    (a.section === "production" || (a.play_id === b.play_id && a.credit_type === b.credit_type));

  async function move(c: Credit, dir: -1 | 1) {
    const peers = credits.filter((x) => sameGroup(x, c)).sort((a, b) => a.sort_order - b.sort_order);
    const i = peers.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= peers.length) return;
    const ids = peers.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await send(`/api/admin/productions/${productionId}/reorder`, "POST", { table: "credits", ids });
  }

  const artistic = credits.filter((c) => c.section === "artistic");
  const crew = credits.filter((c) => c.section === "production").sort((a, b) => a.sort_order - b.sort_order);
  const unlisted = (p: Person) => !p.is_public || !p.is_approved;

  function Row({ c }: { c: Credit }) {
    const [text, setText] = useState(c.role_played);
    const peers = credits.filter((x) => sameGroup(x, c)).sort((a, b) => a.sort_order - b.sort_order);
    const idx = peers.findIndex((x) => x.id === c.id);
    return (
      <div className={`aa-card p-3 flex flex-wrap items-center gap-3 ${c.is_discredited ? "opacity-50" : ""}`}>
        <div className="flex flex-col">
          <button className={mini} disabled={idx === 0} onClick={() => move(c, -1)} aria-label="Move up">▲</button>
          <button className={mini} disabled={idx === peers.length - 1} onClick={() => move(c, 1)} aria-label="Move down">▼</button>
        </div>
        <div className="min-w-40 flex-1">
          <p className="font-extrabold">
            {c.profile.display_name ?? "Untitled profile"}
            {c.is_discredited && <span className="ml-2 text-xs uppercase text-danger">Discredited</span>}
          </p>
          {unlisted(c.profile) && (
            <p className="text-xs text-danger">Profile is not public and approved, so this credit is hidden on the site.</p>
          )}
        </div>
        {c.section === "artistic" && (
          <>
            <select
              value={c.credit_type ?? "actor"}
              onChange={(e) => send(`/api/admin/credits/${c.id}`, "PATCH", { credit_type: e.target.value })}
              className={field}
            >
              {(Object.keys(CREDIT_TYPE_LABEL) as CreditType[]).map((t) => (
                <option key={t} value={t}>{CREDIT_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <select
              value={c.play_id ?? ""}
              onChange={(e) => send(`/api/admin/credits/${c.id}`, "PATCH", { play_id: e.target.value || null })}
              className={field}
            >
              <option value="">No specific play</option>
              {plays.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== c.role_played && send(`/api/admin/credits/${c.id}`, "PATCH", { role_played: text })}
          className={`${field} w-48`}
          aria-label={c.section === "artistic" ? "Character" : "Involvement"}
        />
        <button
          className={mini}
          onClick={() => send(`/api/admin/credits/${c.id}`, "PATCH", { is_discredited: !c.is_discredited })}
        >
          {c.is_discredited ? "Restore" : "Discredit"}
        </button>
        <button
          className="text-xs font-bold uppercase text-danger/70 hover:text-danger"
          onClick={() => confirm("Remove this credit?") && send(`/api/admin/credits/${c.id}`, "DELETE")}
        >
          Delete
        </button>
      </div>
    );
  }

  const groups: { key: string; title: string; items: Credit[] }[] = [
    { key: "none", title: "No specific play", items: artistic.filter((c) => !c.play_id) },
    ...plays.map((p) => ({ key: p.id, title: p.title, items: artistic.filter((c) => c.play_id === p.id) })),
  ];
  const rank = { writer: 0, director: 1, actor: 2 } as const;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-extrabold text-xl">Cast &amp; crew</h2>
        <p className="text-sm text-muted">
          The artistic team shows first, per play, then Production &amp; Crew in the order set here.
          A person can hold several credits.
        </p>
      </div>
      {message && <p className="text-sm text-danger">{message}</p>}

      <div className="space-y-2">
        <h3 className="font-extrabold">Plays</h3>
        {plays.map((p, i) => (
          <PlayRow key={p.id + p.title} p={p} i={i} n={plays.length} onMove={movePlay} onDelete={deletePlay}
            onRename={(t) => send(`/api/admin/plays/${p.id}`, "PATCH", { title: t })} />
        ))}
        <form onSubmit={addPlay} className="flex gap-2">
          <input value={newPlay} onChange={(e) => setNewPlay(e.target.value)} placeholder="Play title" className={`${field} w-64`} />
          <button className="px-4 py-2 bg-black text-paper text-sm font-bold uppercase">Add play</button>
        </form>
      </div>

      <form onSubmit={addCredit} className="aa-card p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Person</label>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} required className={`${field} w-56`}>
            <option value="">Select person...</option>
            {people.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name ?? a.id.slice(0, 8)}{unlisted(a) ? " (not public)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Section</label>
          <select value={section} onChange={(e) => setSection(e.target.value as CreditSection)} className={field}>
            <option value="artistic">Artistic team</option>
            <option value="production">Production &amp; Crew</option>
          </select>
        </div>
        {section === "artistic" && (
          <>
            <div>
              <label className="block text-xs font-bold uppercase text-muted mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as CreditType)} className={field}>
                {(Object.keys(CREDIT_TYPE_LABEL) as CreditType[]).map((t) => (
                  <option key={t} value={t}>{CREDIT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-muted mb-1">Play</label>
              <select value={playId} onChange={(e) => setPlayId(e.target.value)} className={field}>
                <option value="">No specific play</option>
                {plays.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">
            {section === "artistic" ? (type === "actor" ? "Character" : "Label (optional)") : "Involvement"}
          </label>
          <input value={role} onChange={(e) => setRole(e.target.value)} required={section === "production" || type === "actor"}
            placeholder={section === "production" ? "e.g. Stage Manager" : "e.g. Maria"} className={`${field} w-56`} />
        </div>
        <button disabled={busy || !personId} className="px-4 py-2 bg-black text-paper text-sm font-bold uppercase disabled:opacity-50">
          {busy ? "Adding..." : "Add credit"}
        </button>
      </form>

      <div className="space-y-4">
        <h3 className="font-extrabold">Artistic team</h3>
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.key} className="space-y-2">
              <p className="text-xs font-bold uppercase text-muted">{g.title}</p>
              {[...g.items]
                .sort((a, b) => rank[a.credit_type ?? "actor"] - rank[b.credit_type ?? "actor"] || a.sort_order - b.sort_order)
                .map((c) => <Row key={c.id + c.role_played + c.credit_type + c.play_id + c.is_discredited} c={c} />)}
            </div>
          ),
        )}
        {artistic.length === 0 && <p className="text-sm text-muted">No artistic credits yet.</p>}
      </div>

      <div className="space-y-2">
        <h3 className="font-extrabold">Production &amp; Crew</h3>
        <p className="text-xs text-muted">Top of the list shows first on the production page.</p>
        {crew.map((c) => <Row key={c.id + c.role_played + c.is_discredited} c={c} />)}
        {crew.length === 0 && <p className="text-sm text-muted">No crew credits yet.</p>}
      </div>
    </section>
  );
}

function PlayRow({ p, i, n, onMove, onDelete, onRename }: {
  p: Play; i: number; n: number;
  onMove: (i: number, d: -1 | 1) => void;
  onDelete: (p: Play) => void;
  onRename: (t: string) => void;
}) {
  const [t, setT] = useState(p.title);
  return (
    <div className="aa-card p-3 flex items-center gap-3">
      <div className="flex flex-col">
        <button className={mini} disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Move up">▲</button>
        <button className={mini} disabled={i === n - 1} onClick={() => onMove(i, 1)} aria-label="Move down">▼</button>
      </div>
      <input value={t} onChange={(e) => setT(e.target.value)} onBlur={() => t.trim() && t !== p.title && onRename(t.trim())}
        className={`${field} flex-1`} />
      <button className="text-xs font-bold uppercase text-danger/70 hover:text-danger" onClick={() => onDelete(p)}>Delete</button>
    </div>
  );
}
