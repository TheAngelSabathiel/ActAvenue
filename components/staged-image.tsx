"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { toast } from "@/lib/toast";
import { validateImageFile } from "@/lib/upload";

/** A picture change waiting for "Save changes": a newly chosen file, or a removal. */
export type ImageDraft = { file: File | null; removed: boolean };
export const EMPTY_IMAGE: ImageDraft = { file: null, removed: false };
export const imageDirty = (d: ImageDraft) => !!d.file || d.removed;

type Props = {
  label: string;
  hint?: string;
  url: string | null;
  fallback: string;
  aspect: string; // tailwind aspect class
  draft: ImageDraft;
  onChange: (draft: ImageDraft) => void;
  /** Hide the Remove button when the server has no way to clear this image. */
  allowRemove?: boolean;
};

/**
 * Image picker that only stages the change. Nothing is uploaded until the
 * parent form's "Save changes" runs, so there is no request per click.
 */
export function StagedImage({ label, hint, url, fallback, aspect, draft, onChange, allowRemove = true }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (draft.file ? URL.createObjectURL(draft.file) : null), [draft.file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = preview ?? (draft.removed ? null : url);
  const dirty = imageDirty(draft);

  function pick(file: File) {
    const invalid = validateImageFile(file);
    if (invalid) return toast.error(invalid);
    onChange({ file, removed: false });
  }

  return (
    <div>
      <p className="aa-label mb-1">{label}</p>
      <div className={`relative w-full ${aspect} bg-soft border border-[#dee2e6] overflow-hidden`}>
        <Image
          key={shown ?? "fallback"}
          src={shown ?? fallback}
          alt={label}
          fill
          unoptimized
          sizes="400px"
          className={`object-cover ${shown ? "" : "opacity-50"}`}
        />
      </div>
      <p className="text-xs text-muted mt-1 mb-2">
        {draft.file
          ? "New image selected. It saves when you press Save changes."
          : draft.removed
            ? "Will be removed when you save."
            : url
              ? "Current image."
              : "No image yet. The default shows on the site."}{" "}
        {hint}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pick(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => input.current?.click()} className="aa-btn aa-btn-sm">
          {shown ? "Replace" : "Upload"}
        </button>
        {shown && allowRemove && (
          <button type="button" onClick={() => onChange({ file: null, removed: true })} className="aa-btn aa-btn-outline aa-btn-sm">
            Remove
          </button>
        )}
        {dirty && (
          <button type="button" onClick={() => onChange(EMPTY_IMAGE)} className="aa-btn aa-btn-outline aa-btn-sm">
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
