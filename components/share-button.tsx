"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

/** Share a page: the phone's share sheet where there is one, otherwise copy the link. */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    setBusy(true);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied.");
      }
    } catch {
      /* closed the share sheet */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={busy} className="aa-btn aa-btn-light aa-btn-sm">
      <i className="bi bi-share" /> Share
    </button>
  );
}
