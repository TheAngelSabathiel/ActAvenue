"use client";

import { useCallback, useEffect, useState } from "react";

const PRIVACY_EMAIL = "jomari.jacinto@actavenue.org";

/**
 * Data Privacy Notice in a centered box over a dimmed page (same look as sign in).
 * Written for the Data Privacy Act of 2012 (Republic Act No. 10173).
 */
export function PrivacyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const h = "font-black text-sm uppercase tracking-[0.08em] mt-5 mb-1";
  const p = "text-sm mb-2";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Data Privacy Notice">
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
          <h2 className="text-2xl mb-2 pr-8">Data Privacy Notice</h2>
          <hr className="aa-divider !mb-0" />
        </div>
        <div className="px-6 sm:px-8 pb-6 overflow-y-auto">
          <p className={p}>
            Act Avenue respects your privacy and handles your personal information in line with the Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.
          </p>

          <h3 className={h}>What we collect</h3>
          <ul className="text-sm list-disc pl-5 space-y-1 mb-2">
            <li>Your name, email address and phone number when you book tickets, sign up or send us a message.</li>
            <li>Payment proof (such as a transfer receipt) when you pay for tickets.</li>
            <li>A photo of a valid ID (Student, PWD or Senior) when you buy a discounted ticket that needs one.</li>
            <li>The message you write in our contact form.</li>
            <li>Profile details you choose to add, such as a photo, bio and links, if you join our cast and crew directory.</li>
          </ul>

          <h3 className={h}>Why we collect it</h3>
          <ul className="text-sm list-disc pl-5 space-y-1 mb-2">
            <li>To process your booking, confirm your payment and send your e-ticket and QR code.</li>
            <li>To check that you qualify for a discounted ticket and admit you at the door.</li>
            <li>To answer your questions and send you important notices about your booking.</li>
            <li>To send news of upcoming Act Avenue shows, only if you chose to receive them.</li>
            <li>To keep our site secure and prevent misuse.</li>
          </ul>

          <h3 className={h}>Who sees it</h3>
          <p className={p}>
            Only the Act Avenue team and the production staff handling your show can see your booking details. We use trusted service providers to run the site, store data and send email. They process data for us only for these purposes. Your data may be stored on servers outside the Philippines. We do not sell your personal information.
          </p>

          <h3 className={h}>How long we keep it</h3>
          <p className={p}>
            We keep your information only as long as needed for the purposes above and for any legal, tax or accounting requirement. After that, we delete or anonymize it.
          </p>

          <h3 className={h}>How we protect it</h3>
          <p className={p}>
            We use access controls, private storage for IDs and payment proof, and secure connections. No system is perfectly secure. If a breach affecting your data occurs, we will notify you and the National Privacy Commission as the law requires.
          </p>

          <h3 className={h}>Your rights</h3>
          <p className={p}>Under the Data Privacy Act, you have the right to:</p>
          <ul className="text-sm list-disc pl-5 space-y-1 mb-2">
            <li>be informed about how your data is used;</li>
            <li>access your data and ask for a copy;</li>
            <li>object to processing, or withdraw your consent;</li>
            <li>correct data that is wrong or out of date;</li>
            <li>ask us to suspend, remove or destroy your data;</li>
            <li>move your data to another service in a common format;</li>
            <li>claim damages if you were harmed by misuse of your data; and</li>
            <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
          </ul>

          <h3 className={h}>Newsletter</h3>
          <p className={p}>
            If you subscribe to show news, every email has an unsubscribe link. You can leave the list at any time.
          </p>

          <h3 className={h}>Your consent</h3>
          <p className={p}>
            By ticking the box next to this notice, you confirm that you have read it and you agree to the collection and use of your personal information as described.
          </p>

          <h3 className={h}>Contact us about your data</h3>
          <p className={p}>
            To use any of your rights or ask a question, email{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="underline font-bold">{PRIVACY_EMAIL}</a>.
          </p>
          <p className="text-xs text-muted mb-0">Last updated October 2026.</p>
        </div>
        <div className="p-4 border-t border-black/10 shrink-0 text-right">
          <button type="button" onClick={onClose} className="aa-btn aa-btn-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

/** Text that opens the notice. */
export function PrivacyLink({ children = "Data Privacy Notice", className = "underline font-bold" }: { children?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <PrivacyModal open={open} onClose={close} />
    </>
  );
}

/** Required consent tick box with a clickable link to the full notice. */
export function PrivacyConsent({ name = "privacy", required = true }: { name?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name={name} required={required} className="mt-1" />
        <span>
          I have read the{" "}
          <button type="button" onClick={() => setOpen(true)} className="underline font-bold">
            Data Privacy Notice
          </button>{" "}
          and I agree to the collection and use of my personal information as described, in line with the Data Privacy Act of 2012.
        </span>
      </label>
      {/* Outside the label, so clicks inside the notice never tick the box. */}
      <PrivacyModal open={open} onClose={close} />
    </>
  );
}
