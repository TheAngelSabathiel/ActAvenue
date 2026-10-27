"use client";

import { toast } from "@/lib/toast";
import { useToastOn } from "@/lib/use-toast-on";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { IMAGES } from "@/lib/images";
import { StagedImage, EMPTY_IMAGE, imageDirty, type ImageDraft } from "@/components/staged-image";
import { SaveBar } from "@/components/save-bar";
import { api, fileInit, jsonInit } from "@/lib/api-call";
import { CopyLinkButton } from "@/components/share-button";
import type { Play } from "@/types/database";

type Person = { id: string; display_name: string | null; email?: string | null };
type AdminPlay = Play & { play_writers?: { profile_id: string; sort_order: number }[] };

const personName = (p: Person) => p.display_name || p.email || "Unnamed account";

function WriterPicker({ people, value, onChange }: { people: Person[]; value: string[]; onChange: (ids: string[]) => void }) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const options = people
    .filter((p) => !value.includes(p.id))
    .sort((a, b) => personName(a).localeCompare(personName(b), undefined, { sensitivity: "base" }));
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase text-muted">Writers (optional)</label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-2 bg-black text-white text-xs font-bold px-2.5 py-1">
              {byId.get(id) ? personName(byId.get(id)!) : "Unknown"}
              <button type="button" aria-label="Remove writer" onClick={() => onChange(value.filter((x) => x !== id))}>
                <i className="bi bi-x-lg" />
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        value=""
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className={`${field} w-full max-w-xs`}
        aria-label="Add a writer"
      >
        <option value="">{value.length ? "Add another writer" : "Add a writer"}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>{personName(p)}</option>
        ))}
      </select>
    </div>
  );
}

const field = "border border-ink/20 px-3 py-2 text-sm";

export default function AdminPlaysPage() {
  const [plays, setPlays] = useState<AdminPlay[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [writerIds, setWriterIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useToastOn(message, "error");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logline, setLogline] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/plays");
    setPlays((await res.json()).plays ?? []);
    try {
      const r = await fetch("/api/admin/actors?group=all");
      setPeople((await r.json()).actors ?? []);
    } catch {
      /* writers picker stays empty */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, logline, writer_ids: writerIds }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error);
    setMessage(null);
    toast.success("Play added.");
    setTitle("");
    setDescription("");
    setLogline("");
    setWriterIds([]);
    load();
  }

  if (!plays) return <Spinner />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Plays</h1>
        <p className="text-sm text-muted">
          Every Act Avenue play lives here once. Productions pick from this list in their Cast &amp; crew section.
        </p>
      </div>
      {message && <p className="text-sm text-danger">{message}</p>}

      <form onSubmit={add} className="aa-card p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold uppercase text-muted mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`${field} w-64`} />
        </div>
        <div className="w-full">
          <label className="block text-xs font-bold uppercase text-muted mb-1">Logline (optional, one line)</label>
          <input value={logline} onChange={(e) => setLogline(e.target.value)} maxLength={200} className={`${field} w-full`} />
        </div>
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-bold uppercase text-muted mb-1">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} w-full`} />
        </div>
        <div className="w-full">
          <WriterPicker people={people} value={writerIds} onChange={setWriterIds} />
        </div>
        <button className="px-4 py-2 bg-black text-paper text-sm font-bold uppercase">Add play</button>
      </form>

      <div className="space-y-3">
        {plays.map((p) => (
          <PlayCard key={p.id} play={p} people={people} onChange={load} onError={setMessage} />
        ))}
        {plays.length === 0 && <p className="text-sm text-muted">No plays yet.</p>}
      </div>
    </div>
  );
}

function PlayCard({ play, people, onChange, onError }: { play: AdminPlay; people: Person[]; onChange: () => void; onError: (m: string | null) => void }) {
  const [title, setTitle] = useState(play.title);
  const [description, setDescription] = useState(play.description ?? "");
  const [logline, setLogline] = useState(play.logline ?? "");
  const [photo, setPhoto] = useState<ImageDraft>(EMPTY_IMAGE);
  const savedWriters = (play.play_writers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map((w) => w.profile_id);
  const [writers, setWriters] = useState<string[]>(savedWriters);
  const [saving, setSaving] = useState(false);

  const writersDirty = writers.join(",") !== savedWriters.join(",");
  const dirty = title !== play.title || description !== (play.description ?? "") || logline !== (play.logline ?? "") || imageDirty(photo) || writersDirty;

  function discard() {
    setTitle(play.title);
    setDescription(play.description ?? "");
    setLogline(play.logline ?? "");
    setPhoto(EMPTY_IMAGE);
    setWriters(savedWriters);
  }

  async function save() {
    if (!title.trim()) return toast.error("A play needs a title.");
    setSaving(true);
    onError(null);
    try {
      if (photo.file) await api(`/api/admin/plays/${play.id}/media`, fileInit(photo.file));
      else if (photo.removed) await api(`/api/admin/plays/${play.id}/media`, { method: "DELETE" });
      const patch: Record<string, string | string[]> = {};
      if (writersDirty) patch.writer_ids = writers;
      if (title !== play.title) patch.title = title;
      if (description !== (play.description ?? "")) patch.description = description;
      if (logline !== (play.logline ?? "")) patch.logline = logline;
      if (Object.keys(patch).length) await api(`/api/admin/plays/${play.id}`, jsonInit("PATCH", patch));
      toast.success("Play saved.");
      setPhoto(EMPTY_IMAGE);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${play.title}"? It leaves every production, and its credits become "no specific play".`)) return;
    await fetch(`/api/admin/plays/${play.id}`, { method: "DELETE" });
    toast.success("Play deleted.");
    onChange();
  }

  return (
    <div className="aa-card p-4 space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-40">
          <StagedImage
            label="Display photo"
            url={play.photo_url}
            fallback={IMAGES.posterPlaceholder}
            fallbackText={title || play.title}
            aspect="aspect-[4/3]"
            draft={photo}
            onChange={setPhoto}
          />
        </div>
        <div className="flex-1 min-w-56 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} w-full font-bold`} aria-label="Title" />
          <input value={logline} onChange={(e) => setLogline(e.target.value)} maxLength={200} placeholder="Logline (one line hook for sharing)" className={`${field} w-full italic`} aria-label="Logline" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description" className={`${field} w-full`} />
          <WriterPicker people={people} value={writers} onChange={setWriters} />
          <div className="flex flex-wrap gap-2 pt-2">
            <CopyLinkButton path={`/plays/${play.id}`} className="aa-btn aa-btn-outline aa-btn-sm" />
            <button type="button" onClick={remove} className="aa-btn aa-btn-outline aa-btn-sm !text-danger !border-danger">
              <i className="bi bi-trash" /> Delete
            </button>
          </div>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
