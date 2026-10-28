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

export type StockTier = {
  id: string;
  quantity_available: number;
  quantity_held: number;
  pool_tier_id?: string | null;
  pool_capped?: boolean | null;
};

/**
 * Seats left for a tier. A tier with no link has its own stock. Tiers linked to
 * a main tier share its total, and a linked tier with a cap is also held to it.
 * `all` is every tier of the same show.
 */
export function tierRemaining(t: StockTier, all: StockTier[]): number {
  const rootId = t.pool_tier_id ?? t.id;
  const root = rootId === t.id ? t : all.find((x) => x.id === rootId);
  if (!root) return Math.max(0, t.quantity_available - t.quantity_held);
  const members = all.filter((x) => x.id === rootId || x.pool_tier_id === rootId);
  if (!members.some((m) => m.id === t.id)) members.push(t);
  const used = members.reduce((n, m) => n + m.quantity_held, 0);
  const poolLeft = root.quantity_available - used;
  const ownLeft = t.pool_tier_id && t.pool_capped ? t.quantity_available - t.quantity_held : Infinity;
  return Math.max(0, Math.min(poolLeft, ownLeft));
}

/** Adds `remaining` to every tier of one show. */
export function applyRemaining<T extends StockTier>(tiers: T[]): (T & { remaining: number })[] {
  return tiers.map((t) => ({ ...t, remaining: tierRemaining(t, tiers) }));
}
