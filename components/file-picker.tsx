"use client";

import { useRef, useState } from "react";

/**
 * A button that opens the file chooser, with the chosen file name beside it.
 * The real input stays in the form (visually hidden, not display:none) so it
 * still submits with the form and `required` still works.
 */
export function FilePicker({
  name,
  accept,
  required,
  label = "Choose file",
  changeLabel = "Change file",
}: {
  name: string;
  accept?: string;
  required?: boolean;
  label?: string;
  changeLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        name={name}
        accept={accept}
        required={required}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <button type="button" onClick={() => input.current?.click()} className="aa-btn aa-btn-sm">
        {fileName ? changeLabel : label}
      </button>
      <span className="text-sm text-muted break-all">{fileName ?? "No file chosen"}</span>
    </div>
  );
}
