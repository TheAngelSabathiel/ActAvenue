import type { ProductionPartner } from "@/types/database";

export const PARTNER_CATEGORIES = [
  { value: "sponsor", name: "Sponsor" },
  { value: "media", name: "Media Partner" },
  { value: "organization", name: "Partner Organization" },
] as const;

export const SPONSOR_LEVELS = [
  { value: "co_presenter", name: "Co-Presenter" },
  { value: "major", name: "Major" },
  { value: "minor", name: "Minor" },
  { value: "special_thanks", name: "Special Thanks to" },
] as const;

export const levelRank = (l: string | null) => SPONSOR_LEVELS.findIndex((x) => x.value === l);

export function sortPartners<T extends Pick<ProductionPartner, "sponsor_level" | "sort_order" | "name">>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => levelRank(a.sponsor_level) - levelRank(b.sponsor_level) || a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
}

/** Adds https:// when missing. Returns null for blank or non-web input. */
export function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = v.trim();
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
