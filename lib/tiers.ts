import type { TierType } from "@/types/database";

export const TIER_TYPES: { value: TierType; name: string }[] = [
  { value: "regular", name: "Regular" },
  { value: "vip", name: "VIP" },
  { value: "discounted", name: "Discounted" },
  { value: "special", name: "Special" },
];

export function tierTypeName(t: string): string {
  return TIER_TYPES.find((x) => x.value === t)?.name ?? "Regular";
}

export function isTierType(t: unknown): t is TierType {
  return TIER_TYPES.some((x) => x.value === t);
}

/** What the buyer sees: the pseudonym if set, otherwise the type name. */
export function tierDisplayName(t: { tier_type: string; alias?: string | null }): string {
  return t.alias?.trim() || tierTypeName(t.tier_type);
}

export const ID_INSTRUCTION =
  "Discounted tickets need a valid ID (Student, PWD or Senior). Upload a clear photo or scan of your ID before adding to cart. Bring the same ID to the show.";

/** null means every type. A list that covers all four types is stored as null too. */
export function cleanTypes(v: unknown): TierType[] | null {
  if (!Array.isArray(v)) return null;
  const list = [...new Set(v.filter(isTierType))];
  return list.length === 0 || list.length === TIER_TYPES.length ? null : list;
}
