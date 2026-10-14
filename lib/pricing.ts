import type { TicketTier, PromoCode } from "@/types/database";

export interface CartLineInput {
  ticket_tier: TicketTier;
  quantity: number;
}

export interface PricingResult {
  subtotal: number;
  discountAmount: number;
  total: number;
  discountSource: "promo" | "tier" | "none";
  rejectedPromoReason?: string;
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
 * Percent codes take a percentage off the eligible subtotal and use the code once.
 * Fixed-amount codes take the amount off every eligible ticket (never more than
 * the ticket's price) and use the code once per discounted ticket. If the code
 * has fewer uses left than tickets, only that many tickets are discounted.
 */
function promoDiscount(promo: PromoCode, regularLines: CartLineInput[]): { amount: number; uses: number } {
  const subtotal = regularLines.reduce((sum, l) => sum + l.ticket_tier.price * l.quantity, 0);
  if (subtotal <= 0) return { amount: 0, uses: 0 };

  if (promo.discount_type === "percent") {
    return { amount: Math.round(((subtotal * promo.discount_value) / 100) * 100) / 100, uses: 1 };
  }

  let left = promo.max_uses === null ? Infinity : Math.max(0, promo.max_uses - promo.times_used);
  let amount = 0;
  let uses = 0;
  for (const l of regularLines) {
    const n = Math.min(l.quantity, left);
    amount += Math.min(promo.discount_value, l.ticket_tier.price) * n;
    uses += n;
    left -= n;
  }
  return { amount: Math.round(amount * 100) / 100, uses };
}

/** Uses of a fixed-amount code that a stored discount represents (for giving them back on delete). */
export function promoUsesForDiscount(promo: Pick<PromoCode, "discount_type" | "discount_value">, discountAmount: number): number {
  if (promo.discount_type === "percent" || promo.discount_value <= 0) return 1;
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

/**
 * Business rules baked in here (see MVP doc "Promo code vs. discounted-tier logic"):
 *  - One promo code per reservation, never stacked with anything else.
 *  - Discount-tier line items (is_discount_tier = true, active window) do not
 *    accept a promo code on top of them.
 *  - If a cart mixes discount-tier and regular items, the promo only applies
 *    to the regular-tier subtotal.
 *  - Where it's ambiguous whether the tier discount or the promo gives a
 *    bigger saving on the same items, the larger discount wins - they never stack.
 */
export function calculatePricing(
  lines: CartLineInput[],
  promo: PromoCode | null,
  productionId: string,
  now = new Date()
): PricingResult {
  const subtotal = lines.reduce((sum, l) => sum + l.ticket_tier.price * l.quantity, 0);

  if (!promo) {
    return { subtotal, discountAmount: 0, total: subtotal, discountSource: "none", promoUses: 0 };
  }

  const validity = isPromoCodeValid(promo, productionId, now);
  if (!validity.valid) {
    return {
      subtotal,
      discountAmount: 0,
      total: subtotal,
      discountSource: "none",
      rejectedPromoReason: validity.reason,
      promoUses: 0,
    };
  }

  // Promo only ever applies to the non-discount-tier portion of the cart.
  const regularLines = lines.filter((l) => !isTierDiscountActive(l.ticket_tier, now));
  const { amount: promoAmount, uses } = promoDiscount(promo, regularLines);

  // Nothing to compare against on the discount-tier portion - the tier
  // pricing itself *is* the discount, so just report it as "tier" sourced
  // if that's where all the savings vs. list price already are.
  const total = Math.max(0, subtotal - promoAmount);

  return {
    subtotal,
    discountAmount: promoAmount,
    total,
    discountSource: promoAmount > 0 ? "promo" : "none",
    promoUses: promoAmount > 0 ? uses : 0,
  };
}
