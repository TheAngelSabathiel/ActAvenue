"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BENEFITS = [
  "Track every order and past show in one place",
  "Pull up your e-tickets and QR codes anytime",
  "Faster checkout next time",
];

/** Shown after checkout to buyers who are not signed in. Opens the sign up lightbox. */
export function GuestSignupPrompt() {
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setGuest(!data.user));
  }, []);

  if (!guest) return null;

  return (
    <div className="aa-card p-6 border-l-[8px] border-accent">
      <p className="aa-label text-muted mb-1">Optional</p>
      <p className="font-black text-xl mb-3">Save this order to an account</p>
      <ul className="space-y-1.5 mb-4 text-sm">
        {BENEFITS.map((b) => (
          <li key={b} className="flex gap-2">
            <i className="bi bi-check2 font-black" /> {b}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="aa-btn aa-btn-sm"
        onClick={() => window.dispatchEvent(new CustomEvent("aa-open-auth", { detail: "signup" }))}
      >
        Create account
      </button>
      <p className="text-xs text-muted mt-3 mb-0">Use the email you booked with and this order links automatically.</p>
    </div>
  );
}
