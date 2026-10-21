/** Scanning rules shared by the scanner and its API. */
export const SCAN_OPENS_MINUTES_BEFORE = 60;
export const SCAN_CLOSES_MINUTES_AFTER = 180;

/** Is `now` inside the scan window for a show starting at `startIso`? */
export function inScanWindow(startIso: string, now = Date.now()): { ok: boolean; opensAt: number; closesAt: number } {
  const start = new Date(startIso).getTime();
  const opensAt = start - SCAN_OPENS_MINUTES_BEFORE * 60_000;
  const closesAt = start + SCAN_CLOSES_MINUTES_AFTER * 60_000;
  return { ok: now >= opensAt && now <= closesAt, opensAt, closesAt };
}

/**
 * What goes inside a new ticket QR. A link, so any phone camera lands on the
 * ticket page. Falls back to the bare code when no site URL is configured.
 */
export function ticketQrText(code: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return base ? `${base}/t/${encodeURIComponent(code)}` : code;
}

/**
 * Reads what a scanner saw: a ticket link (new QRs), a ticket code, or a bare
 * reference code (QRs sent before the update). Returns the code, upper-cased.
 */
export function parseScanned(text: string): string {
  const t = text.trim();
  try {
    const u = new URL(t);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("t");
    if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1]).trim().toUpperCase();
  } catch {
    /* not a URL, so it is a plain code */
  }
  return t.toUpperCase();
}
