"use client";

import { useState } from "react";
import { PrivacyConsent } from "@/components/privacy-notice";

const label = "block text-xs font-bold uppercase text-muted mb-1";

export function ContactForm() {
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          subject: fd.get("subject"),
          message: fd.get("message"),
          consent: fd.get("privacy") === "on",
          website: trap,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Could not send your message.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="aa-card p-8 text-center">
        <p className="font-black text-xl mb-2">Message sent</p>
        <p className="text-muted mb-0">Salamat. We will reply to your email soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-name">Full name</label>
          <input id="c-name" name="name" required maxLength={120} autoComplete="name" className="aa-input" />
        </div>
        <div>
          <label className={label} htmlFor="c-email">Email</label>
          <input id="c-email" type="email" name="email" required maxLength={200} autoComplete="email" className="aa-input" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-phone">Phone (optional)</label>
          <input id="c-phone" name="phone" maxLength={40} autoComplete="tel" className="aa-input" />
        </div>
        <div>
          <label className={label} htmlFor="c-subject">Subject</label>
          <input id="c-subject" name="subject" required maxLength={150} className="aa-input" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="c-message">Message</label>
        <textarea id="c-message" name="message" required rows={6} maxLength={3000} className="aa-input" />
      </div>
      {/* Hidden from people, filled by bots. */}
      <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" aria-hidden="true" name="website" />

      <PrivacyConsent />

      {error && <p className="text-sm text-danger font-bold mb-0">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="aa-btn aa-btn-lg w-full sm:w-auto">
        {state === "sending" ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
