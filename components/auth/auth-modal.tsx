"use client";

import { useEffect, useState } from "react";
import { LoginForm, SignupForm } from "@/components/auth/auth-forms";

export type AuthMode = "login" | "signup";

/**
 * Sign in / sign up lightbox. Pans down from the top on open and back up when
 * closed with X, the backdrop or Escape.
 */
export function AuthModal({ mode, onMode, onClose }: { mode: AuthMode | null; onMode: (m: AuthMode) => void; onClose: () => void }) {
  // `shown` drives the CSS transition; `last` keeps the content while it slides away.
  const [shown, setShown] = useState(false);
  const [last, setLast] = useState<AuthMode>("login");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLast(mode);
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 350);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mode, onClose]);

  if (!mounted) return null;
  const m = mode ?? last;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={m === "login" ? "Sign in" : "Create account"}>
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`relative mx-auto mt-0 w-full max-w-md bg-white border-x-2 border-b-2 border-black shadow-2xl transition-transform duration-300 ease-out max-h-screen overflow-y-auto ${
          shown ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-2xl leading-none p-1">
          <i className="bi bi-x-lg" />
        </button>
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl mb-2">{m === "login" ? "Sign In" : "Create Account"}</h2>
          <hr className="aa-divider" />
          <p className="text-muted text-sm mb-5">
            {m === "login" ? "See your tickets and past orders in one place." : "Optional. Your tickets and orders, all in one place."}
          </p>
          {m === "login" ? (
            <LoginForm
              onDone={onClose}
              footer={
                <p className="text-sm text-muted mt-5 mb-0">
                  No account yet?{" "}
                  <button type="button" onClick={() => onMode("signup")} className="text-black font-bold underline">Create one</button>
                </p>
              }
            />
          ) : (
            <SignupForm
              onDone={onClose}
              footer={
                <p className="text-sm text-muted mt-5 mb-0">
                  Already have an account?{" "}
                  <button type="button" onClick={() => onMode("login")} className="text-black font-bold underline">Sign in</button>
                </p>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
