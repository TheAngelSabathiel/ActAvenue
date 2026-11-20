"use client";

import { useCallback, useState } from "react";
import { LegalModal } from "@/components/legal/legal-modal";
import { PrivacyContent } from "@/components/legal/privacy-content";
import { TermsContent } from "@/components/legal/terms-content";
import { CookieContent } from "@/components/legal/cookie-content";

/** Data Privacy Notice in a centered box over a dimmed page (same look as sign in). */
export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LegalModal open={open} onClose={onClose} title="Data Privacy Notice">
      <PrivacyContent />
    </LegalModal>
  );
}

export function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LegalModal open={open} onClose={onClose} title="Terms of Service">
      <TermsContent />
    </LegalModal>
  );
}

export function CookieModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LegalModal open={open} onClose={onClose} title="Cookie Policy">
      <CookieContent />
    </LegalModal>
  );
}

type LinkProps = { children?: React.ReactNode; className?: string };

/** Text that opens the Data Privacy Notice. */
export function PrivacyLink({ children = "Data Privacy Notice", className = "underline font-bold" }: LinkProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <PrivacyModal open={open} onClose={close} />
    </>
  );
}

/** Text that opens the Terms of Service. */
export function TermsLink({ children = "Terms of Service", className = "underline font-bold" }: LinkProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <TermsModal open={open} onClose={close} />
    </>
  );
}

/** Text that opens the Cookie Policy. */
export function CookieLink({ children = "Cookie Policy", className = "underline font-bold" }: LinkProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <CookieModal open={open} onClose={close} />
    </>
  );
}

/**
 * Required consent tick box with clickable links to the full notices.
 * With `terms`, it also covers the Terms of Service (used at checkout).
 */
export function PrivacyConsent({ name = "privacy", required = true, terms = false }: { name?: string; required?: boolean; terms?: boolean }) {
  const [open, setOpen] = useState<"privacy" | "terms" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name={name} required={required} className="mt-1" />
        <span>
          I have read the{" "}
          {terms && (
            <>
              <button type="button" onClick={() => setOpen("terms")} className="underline font-bold">
                Terms of Service
              </button>{" "}
              and the{" "}
            </>
          )}
          <button type="button" onClick={() => setOpen("privacy")} className="underline font-bold">
            Data Privacy Notice
          </button>
          {terms ? ", I agree to the terms, and " : " and "}I agree to the collection and use of my personal information as described, in line with the Data Privacy Act of 2012.
        </span>
      </label>
      {/* Outside the label, so clicks inside the notices never tick the box. */}
      <PrivacyModal open={open === "privacy"} onClose={close} />
      <TermsModal open={open === "terms"} onClose={close} />
    </>
  );
}
