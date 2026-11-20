"use client";

import { useEffect, useState } from "react";

/**
 * A legal notice in a centered box over a dimmed page (same look as sign in).
 * Used for the Terms of Service, Data Privacy Notice and Cookie Policy.
 */
export function LegalModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 350);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-2xl bg-white text-black text-left border-2 border-black shadow-2xl transition-all duration-300 ease-out max-h-[calc(100dvh-2rem)] flex flex-col ${
          shown ? "translate-y-0 opacity-100" : "-translate-y-24 opacity-0"
        }`}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-2xl leading-none p-1 z-10">
          <i className="bi bi-x-lg" />
        </button>
        <div className="p-6 sm:p-8 pb-3 shrink-0">
          <h2 className="text-2xl mb-2 pr-8">{title}</h2>
          <hr className="aa-divider !mb-0" />
        </div>
        <div className="px-6 sm:px-8 pb-6 overflow-y-auto">{children}</div>
        <div className="p-4 border-t border-black/10 shrink-0 text-right">
          <button type="button" onClick={onClose} className="aa-btn aa-btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
