/**
 * Everything the app shows or accepts is Philippine time (UTC+8, no DST).
 * Vercel servers run in UTC, so never call toLocale*() without a timeZone.
 */
export const PH_TZ = "Asia/Manila";

const base = { timeZone: PH_TZ } as const;

/** Thu, Oct 9, 2026, 7:00 PM */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    ...base,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Thursday, October 9, 2026 at 7:00 PM (for emails) */
export function formatDateTimeLong(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { ...base, dateStyle: "full", timeStyle: "short" });
}

/** Oct 9, 2026 */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { ...base, year: "numeric", month: "short", day: "numeric" });
}

/** 7:00 PM */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { ...base, hour: "numeric", minute: "2-digit" });
}

/** ISO timestamp -> value for <input type="datetime-local">, in Manila time. */
export function toManilaInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (Manila time) -> ISO timestamp. */
export function fromManilaInput(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}

/** Start of a Manila calendar day (YYYY-MM-DD) as ISO. */
export function manilaDayStart(day: string) {
  return new Date(`${day}T00:00:00+08:00`).toISOString();
}

/** End of a Manila calendar day (YYYY-MM-DD) as ISO. */
export function manilaDayEnd(day: string) {
  return new Date(`${day}T23:59:59.999+08:00`).toISOString();
}

/** Today's date in Manila, YYYY-MM-DD. */
export function manilaToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
