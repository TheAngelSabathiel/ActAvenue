"use client";

import { useState } from "react";

/** Footer sign up for show news. */
export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: trap }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not sign you up.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you up.");
      setState("idle");
    }
  }

  if (state === "done") return <p className="text-sm mb-0">You are on the list. See you at the next show.</p>;
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto">
      <p className="aa-label opacity-75 mb-2">Get the latest news on the next shows.</p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          autoComplete="email"
          className="flex-1 min-w-0 px-3 py-2 text-sm text-black bg-white border border-white"
          aria-label="Email"
        />
        {/* Hidden from people, filled by bots. */}
        <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" aria-hidden="true" name="website" />
        <button disabled={state === "working"} className="aa-btn aa-btn-light aa-btn-sm shrink-0">
          {state === "working" ? "..." : "Subscribe"}
        </button>
      </div>
      {error && <p className="text-sm text-danger font-bold mt-2 mb-0">{error}</p>}
    </form>
  );
}
