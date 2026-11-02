import type { TicketTier, PromoCode } from "@/types/database";

export interface CartLineInput {
  ticket_tier: TicketTier;
  quantity: number;
}

export interface PricingResult {
  subtotal: number;
  discountAmount: number;
  total: number;
  discountSource: "promo" | "tier" | "bundle" | "none";
  rejectedPromoReason?: string;
  /** Set when a group discount applied (percent off the Regular tickets). */
  bundlePercent?: number;
  /** A promo code was entered but the group discount was bigger, so only that applied. */
  promoSkipped?: boolean;
  /** How many uses of the code this order consumes (a fixed-amount code uses one per discounted ticket). */
  promoUses: number;
}

/** Is a tier's time-limited discount window currently active? */
export function isTierDiscountActive(tier: TicketTier, now = new Date()): boolean {
  if (!tier.is_discount_tier) return false;
  const from = tier.discount_valid_from ? new Date(tier.discount_valid_from) : null;
  const until = tier.discount_valid_until ? new Date(tier.discount_valid_until) : null;
  if (from && now < from) return false;
  if (until && now > until) return false;
  return true;
}

/**
 * A code discounts each eligible ticket on its own and uses up one use per
 * discounted ticket, whoever ordered them. Percent codes take the percentage
 * off each ticket; fixed codes take the amount off each ticket (never more
 * than its price). If the code has fewer uses left than tickets, only that
 * many tickets are discounted.
 */
function promoDiscount(promo: PromoCode, regularLines: CartLineInput[]): { amount: number; uses: number } {
  let left = promo.max_uses === null ? Infinity : Math.max(0, promo.max_uses - promo.times_used);
  let amount = 0;
  let uses = 0;
  for (const l of regularLines) {
    if (l.ticket_tier.price <= 0) continue;
    const n = Math.min(l.quantity, left);
    const each =
      promo.discount_type === "percent"
        ? (l.ticket_tier.price * promo.discount_value) / 100
        : Math.min(promo.discount_value, l.ticket_tier.price);
    amount += each * n;
    uses += n;
    left -= n;
  }
  return { amount: Math.round(amount * 100) / 100, uses };
}

/** Tickets in these lines that the code could discount (ignoring remaining uses). */
export function eligibleTicketCount(lines: CartLineInput[], promo: PromoCode, now = new Date()): number {
  const types = promo.applicable_tier_types;
  return lines
    .filter((l) => !isTierDiscountActive(l.ticket_tier, now))
    .filter((l) => !types || !types.length || types.includes(l.ticket_tier.tier_type))
    .filter((l) => l.ticket_tier.price > 0)
    .reduce((n, l) => n + l.quantity, 0);
}

/** Uses of a fixed-amount code that a stored discount represents (for giving them back on delete). */
export function promoUsesForDiscount(promo: Pick<PromoCode, "discount_type" | "discount_value">, discountAmount: number): number {
  if (promo.discount_type === "percent" || promo.discount_value <= 0) return 1; // older bookings only; new ones store promo_uses
  return Math.max(1, Math.round(discountAmount / promo.discount_value));
}

export function isPromoCodeValid(
  promo: PromoCode,
  productionId: string,
  now = new Date()
): { valid: boolean; reason?: string } {
  if (promo.valid_from && now < new Date(promo.valid_from)) {
    return { valid: false, reason: "This code isn't active yet." };
  }
  if (promo.valid_until && now > new Date(promo.valid_until)) {
    return { valid: false, reason: "This code has expired." };
  }
  if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
    return { valid: false, reason: "This code has reached its usage limit." };
  }
  if (promo.applies_to_production_id && promo.applies_to_production_id !== productionId) {
    return { valid: false, reason: "This code isn't valid for this production." };
  }
  return { valid: true };
}

export type BundleTier = { min: number; percent: number };
export type BundleConfig = { bundle_enabled?: boolean | null; bundle_tiers?: BundleTier[] | null };

export const DEFAULT_BUNDLE_TIERS: BundleTier[] = [
  { min: 3, percent: 5 },
  { min: 5, percent: 8 },
  { min: 10, percent: 12 },
];

/** Cleans stored or submitted tiers: whole counts of 2 or more, percent 1 to 90, no repeats, lowest first. */
export function cleanBundleTiers(v: unknown): BundleTier[] {
  if (!Array.isArray(v)) return DEFAULT_BUNDLE_TIERS;
  const out = new Map<number, number>();
  for (const t of v) {
    const min = Math.floor(Number((t as BundleTier)?.min));
    const percent = Number((t as BundleTier)?.percent);
    if (min >= 2 && percent > 0 && percent <= 90) out.set(min, Math.round(percent * 100) / 100);
  }
  return [...out.entries()].map(([min, percent]) => ({ min, percent })).sort((a, b) => a.min - b.min);
}

/** Regular tickets in these lines that a group discount counts (no active tier discount, not free). */
function bundleLines(lines: CartLineInput[], now: Date) {
  return lines.filter((l) => l.ticket_tier.tier_type === "regular" && !isTierDiscountActive(l.ticket_tier, now) && l.ticket_tier.price > 0);
}

/** The group discount for one show: the biggest step the Regular ticket count reaches. */
export function bundleDiscount(
  lines: CartLineInput[],
  config: BundleConfig | null | undefined,
  now = new Date()
): { amount: number; percent: number; count: number } {
  if (!config?.bundle_enabled) return { amount: 0, percent: 0, count: 0 };
  const eligible = bundleLines(lines, now);
  const count = eligible.reduce((n, l) => n + l.quantity, 0);
  const step = cleanBundleTiers(config.bundle_tiers ?? DEFAULT_BUNDLE_TIERS)
    .filter((t) => count >= t.min)
    .pop();
  if (!step) return { amount: 0, percent: 0, count };
  const base = eligible.reduce((n, l) => n + l.ticket_tier.price * l.quantity, 0);
  return { amount: Math.round(base * step.percent) / 100, percent: step.percent, count };
}

/** The next group step above the current Regular count, for "add 1 more" hints. */
export function nextBundleStep(count: number, config: BundleConfig | null | undefined): BundleTier | null {
  if (!config?.bundle_enabled) return null;
  return cleanBundleTiers(config.bundle_tiers ?? DEFAULT_BUNDLE_TIERS).find((t) => t.min > count) ?? null;
}

/**
 * Business rules baked in here (see MVP doc "Promo code vs. discounted-tier logic"):
 *  - One discount per reservation, never stacked: a promo code or the group
 *    (bundle) discount, whichever saves more. A tie goes to the group discount
 *    so no code use is spent.
 *  - Discount-tier line items (is_discount_tier = true, active window) do not
 *    accept a promo code or a group discount on top of them.
 *  - If a cart mixes discount-tier and regular items, the discount only applies
 *    to the regular-tier subtotal. The group discount only counts Regular tickets.
 */
export function calculatePricing(
  lines: CartLineInput[],
  promo: PromoCode | null,
  productionId: string,
  now = new Date(),
  bundle?: BundleConfig | null
): PricingResult {
  const subtotal = lines.reduce((sum, l) => sum + l.ticket_tier.price * l.quantity, 0);
  const none = (extra: Partial<PricingResult> = {}): PricingResult => ({
    subtotal, discountAmount: 0, total: subtotal, discountSource: "none", promoUses: 0, ...extra,
  });

  // Promo side
  let promoAmount = 0;
  let promoUses = 0;
  let rejectedPromoReason: string | undefined;
  if (promo) {
    const validity = isPromoCodeValid(promo, productionId, now);
    if (!validity.valid) {
      rejectedPromoReason = validity.reason;
    } else {
      const regularLines = lines.filter((l) => !isTierDiscountActive(l.ticket_tier, now));
      const types = promo.applicable_tier_types;
      const eligibleLines = types && types.length ? regularLines.filter((l) => types.includes(l.ticket_tier.tier_type)) : regularLines;
      if (types && types.length && regularLines.length > 0 && eligibleLines.length === 0) {
        rejectedPromoReason = "Promo code not valid for this ticket type / show.";
      } else {
        const r = promoDiscount(promo, eligibleLines);
        promoAmount = r.amount;
        promoUses = r.uses;
      }
    }
  }

  // Group side
  const b = bundleDiscount(lines, bundle, now);

  if (b.amount > 0 && b.amount >= promoAmount) {
    return none({
      discountAmount: b.amount,
      total: Math.max(0, subtotal - b.amount),
      discountSource: "bundle",
      bundlePercent: b.percent,
      promoSkipped: !!promo && promoAmount > 0,
      rejectedPromoReason: promo && promoAmount === 0 ? rejectedPromoReason : undefined,
    });
  }
  if (promoAmount > 0) {
    return none({ discountAmount: promoAmount, total: Math.max(0, subtotal - promoAmount), discountSource: "promo", promoUses });
  }
  return none({ rejectedPromoReason });
}
