"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Spinner } from "@/components/spinner";

const MAX_MB = 5;

type Props = {
  productionId: string;
  kind: "poster" | "banner";
  label: string;
  hint: string;
  url: string | null;
  fallback: string;
  aspect: string; // tailwind aspect class
  onChange: (production: unknown) => void;
};

export function MediaUploader({ productionId, kind, label, hint, url, fallback, aspect, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file (PNG, JPG or WebP).");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Image is over ${MAX_MB} MB. Compress it and try again.`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/productions/${productionId}/media`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Upload failed.");
      else onChange(data.production);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!confirm(`Remove the ${kind}? The site will show the default placeholder.`)) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/productions/${productionId}/media?kind=${kind}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not remove.");
      else onChange(data.production);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="aa-label mb-1">{label}</p>
      <div className={`relative w-full ${aspect} bg-soft border border-[#dee2e6] overflow-hidden`}>
        <Image
          key={url ?? "fallback"}
          src={url ?? fallback}
          alt={label}
          fill
          sizes="400px"
          className={`object-cover ${url ? "" : "opacity-50"}`}
        />
        {busy && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Spinner label="Working" className="!py-0" />
          </div>
        )}
      </div>
      <p className="text-xs text-muted mt-1 mb-2">
        {url ? "Current image." : "No image yet. The default placeholder shows on the site."} {hint}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="aa-btn aa-btn-sm">
          {url ? "Replace" : "Upload"}
        </button>
        {url && (
          <button type="button" disabled={busy} onClick={remove} className="aa-btn aa-btn-outline aa-btn-sm">
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger font-bold mt-2 mb-0">{error}</p>}
    </div>
  );
}
