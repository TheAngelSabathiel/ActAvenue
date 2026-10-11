"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";

const DURATION: Record<ToastMessage["kind"], number> = { success: 4000, info: 4000, error: 7000 };
// Inline SVGs rather than the icon font: font glyphs sit on the text baseline
// and drift off the text's center line. An SVG centers exactly.
function Icon({ kind }: { kind: ToastMessage["kind"] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className: "block shrink-0", "aria-hidden": true } as const;
  if (kind === "success")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="8" />
        <path d="M6.5 10.3l2.4 2.4 4.6-4.9" />
      </svg>
    );
  if (kind === "error")
    return (
      <svg {...common}>
        <path d="M10 2.8l8 14H2l8-14z" />
        <path d="M10 8v4" />
        <path d="M10 14.6v.1" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5" />
      <path d="M10 6.2v.1" />
    </svg>
  );
}

const TONE: Record<ToastMessage["kind"], string> = {
  success: "bg-success text-white",
  error: "bg-danger text-white",
  info: "bg-black text-white",
};

/** Mounted once in the root layout. Shows pop-up messages from lib/toast. */
export function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToasts((t) => {
      setItems((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), DURATION[t.kind]);
    });
  }, []);

  return (
    <div
      className="fixed z-[60] bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:w-96 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 [&_p]:m-0 shadow-[0_.5rem_1.5rem_rgba(0,0,0,.25)] ${TONE[t.kind]}`}
        >
          <Icon kind={t.kind} />
          <p className="flex-1 text-sm font-bold leading-5 mb-0">{t.text}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className="flex h-5 w-5 shrink-0 items-center justify-center opacity-75 hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="block" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
