"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { IMAGES } from "@/lib/images";
import { validateImageFile } from "@/lib/upload";
import type { Play } from "@/types/database";

const field = "border border-ink/20 px-3 py-2 text-sm";

export default function AdminPlaysPage() {
  const [plays, setPlays] = useState<Play[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/plays");
    setPlays((await res.json()).plays ?? []);
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
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error);
    setMessage(null);
    setTitle("");
    setDescription("");
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
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-bold uppercase text-muted mb-1">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} w-full`} />
        </div>
        <button className="px-4 py-2 bg-black text-paper text-sm font-bold uppercase">Add play</button>
      </form>

      <div className="space-y-3">
        {plays.map((p) => (
          <PlayCard key={p.id} play={p} onChange={load} onError={setMessage} />
        ))}
        {plays.length === 0 && <p className="text-sm text-muted">No plays yet.</p>}
      </div>
    </div>
  );
}

function PlayCard({ play, onChange, onError }: { play: Play; onChange: () => void; onError: (m: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(play.title);
  const [description, setDescription] = useState(play.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save(body: Record<string, string>) {
    const res = await fetch(`/api/admin/plays/${play.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    onError(res.ok ? null : data.error);
    onChange();
  }

  async function upload(file: File) {
    const err = validateImageFile(file);
    if (err) return onError(err);
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    const res = await fetch(`/api/admin/plays/${play.id}/media`, { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    onError(res.ok ? null : data.error);
    if (input.current) input.current.value = "";
    onChange();
  }

  async function removePhoto() {
    if (!confirm("Remove the display photo?")) return;
    setBusy(true);
    await fetch(`/api/admin/plays/${play.id}/media`, { method: "DELETE" });
    setBusy(false);
    onChange();
  }

  async function remove() {
    if (!confirm(`Delete "${play.title}"? It leaves every production, and its credits become "no specific play".`)) return;
    await fetch(`/api/admin/plays/${play.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="aa-card p-4 flex flex-wrap gap-4">
      <div className="space-y-2">
        <div className="relative h-24 w-32 bg-black/5">
          <Image src={play.photo_url ?? IMAGES.posterPlaceholder} alt="" fill sizes="128px" className="object-cover" />
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <div className="flex gap-3">
          <button disabled={busy} onClick={() => input.current?.click()} className="text-xs font-bold uppercase text-muted hover:text-ink">
            {busy ? "Working..." : play.photo_url ? "Replace" : "Upload"}
          </button>
          {play.photo_url && (
            <button disabled={busy} onClick={removePhoto} className="text-xs font-bold uppercase text-danger/70 hover:text-danger">
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-56 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== play.title && save({ title })}
          className={`${field} w-full font-bold`}
          aria-label="Title"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (play.description ?? "") && save({ description })}
          rows={3}
          placeholder="Description"
          className={`${field} w-full`}
        />
      </div>
      <button onClick={remove} className="text-xs font-bold uppercase text-danger/70 hover:text-danger self-start">
        Delete
      </button>
    </div>
  );
}
