"use client";

import { useState } from "react";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function go() {
    setState("working");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <p className="mb-0">You are unsubscribed. We will not send you show news.</p>;
  return (
    <div className="space-y-4">
      <p className="mb-0">Stop getting show news from Act Avenue? Booking emails for tickets you buy will still arrive.</p>
      <button onClick={go} disabled={state === "working"} className="aa-btn aa-btn-lg w-full">
        {state === "working" ? "Working..." : "Unsubscribe"}
      </button>
      {state === "error" && <p className="text-sm text-danger font-bold mb-0">Could not unsubscribe. Try again.</p>}
    </div>
  );
}
