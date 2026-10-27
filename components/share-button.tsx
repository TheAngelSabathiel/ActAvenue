"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

/** Share a page: the phone's share sheet where there is one, otherwise copy the link. */
export function ShareButton({ title, path, text }: { title: string; path: string; text?: string | null }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    setBusy(true);
    try {
      if (navigator.share) {
        await navigator.share(text ? { title, text, url } : { title, url });
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

/** Copies the page link, ready to paste into a post. */
export function CopyLinkButton({ path, className = "aa-btn aa-btn-light aa-btn-sm" }: { path: string; className?: string }) {
  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  }
  return (
    <button type="button" onClick={copy} className={className}>
      <i className="bi bi-link-45deg" /> Copy link
    </button>
  );
}
