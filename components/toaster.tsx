"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastMessage } from "@/lib/toast";

const DURATION: Record<ToastMessage["kind"], number> = { success: 4000, info: 4000, error: 7000 };
const ICON: Record<ToastMessage["kind"], string> = {
  success: "bi-check-circle-fill",
  error: "bi-exclamation-triangle-fill",
  info: "bi-info-circle-fill",
};
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
      className="fixed z-[60] top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 shadow-[0_.5rem_1.5rem_rgba(0,0,0,.25)] ${TONE[t.kind]}`}
        >
          <i className={`bi ${ICON[t.kind]} mt-0.5`} />
          <p className="flex-1 text-sm font-bold mb-0">{t.text}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className="opacity-75 hover:opacity-100"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      ))}
    </div>
  );
}
