import type { ReactNode } from "react";

/** Shared text styles so the three notices read the same, in the pop-up and on their own pages. */
export function LegalH({ children }: { children: ReactNode }) {
  return <h3 className="font-black text-sm uppercase tracking-[0.08em] mt-5 mb-1">{children}</h3>;
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="text-sm mb-2">{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="text-sm list-disc pl-5 space-y-1 mb-2">{children}</ul>;
}

export function LegalUpdated() {
  return <p className="text-xs text-muted mt-4 mb-0">Last updated November 2026.</p>;
}

export const LEGAL_EMAIL = "jomari.jacinto@actavenue.org";

export function LegalEmail() {
  return (
    <a href={`mailto:${LEGAL_EMAIL}`} className="underline font-bold">
      {LEGAL_EMAIL}
    </a>
  );
}
