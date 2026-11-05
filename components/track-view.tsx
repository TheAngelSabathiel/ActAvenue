"use client";

import { useEffect } from "react";

/** Counts one anonymous visit per browser session. A random id is kept in this browser; nothing personal is sent. */
export function TrackView({ event, productionId }: { event: "visit" | "production_view"; productionId?: string }) {
  useEffect(() => {
    try {
      const key = `aa_seen_${event}_${productionId ?? "home"}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      let vid = localStorage.getItem("aa_vid");
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem("aa_vid", vid);
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, production_id: productionId, visitor_id: vid }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* storage blocked: skip counting */
    }
  }, [event, productionId]);
  return null;
}
