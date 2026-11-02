import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCart } from "@/lib/cart-session";
import { createServiceClient } from "@/lib/supabase/service";
import { calculatePricing } from "@/lib/pricing";
import { lookupCrossSource, crossAllowance } from "@/lib/crossshow";
import { resolvePayment, type PaymentGroup } from "@/lib/payment";
import type { TicketTier } from "@/types/database";

type PaymentProduction = {
  title: string;
  bundle_enabled?: boolean;
  crossshow_enabled?: boolean;
  crossshow_amount?: number;
  crossshow_source_ids?: string[];
  bundle_tiers?: { min: number; percent: number }[];
  gcash_name: string | null;
  gcash_number: string | null;
  gcash_qr_url: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_qr_url: string | null;
};

/**
 * The exact amount the buyer will be charged, using the same per-show pricing
 * as checkout. Shown next to the payment instructions so they pay the right total.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("promo")?.toUpperCase().trim() || null;
  const cart = await getOrCreateCart();
  const db = createServiceClient();

  const { data: items } = await db
    .from("cart_items")
    .select("*, ticket_tier:ticket_tiers(*), performance:performances(production_id, production:productions(id, title, gcash_name, gcash_number, gcash_qr_url, bank_name, bank_account_name, bank_account_number, bank_qr_url, bundle_enabled, bundle_tiers, crossshow_enabled, crossshow_amount, crossshow_source_ids))")
    .eq("cart_id", cart.id);

  // Cross-show discount: only checked once both the booking code and email are given.
  const xref = req.nextUrl.searchParams.get("xref")?.trim() ?? "";
  const xemail = req.nextUrl.searchParams.get("email")?.trim() ?? "";
  let crossError: string | undefined;
  let crossSource: Awaited<ReturnType<typeof lookupCrossSource>>["source"];
  if (xref && xemail) {
    const found = await lookupCrossSource(db, xref, xemail);
    crossError = found.error;
    crossSource = found.source;
  }
  let crossLeft = crossSource?.available ?? 0;
  let crossDiscount = 0;
  let crossUsed = 0;

  const promo = code
    ? (await db.from("promo_codes").select("*").eq("code", code).maybeSingle()).data
    : null;

  type Group = { productionId: string; production: PaymentProduction | null; lines: { ticket_tier: TicketTier; quantity: number }[] };
  const groups = new Map<string, Group>();
  for (const i of items ?? []) {
    const g: Group = groups.get(i.performance_id) ?? { productionId: i.performance.production_id, production: i.performance.production ?? null, lines: [] };
    g.lines.push({ ticket_tier: i.ticket_tier as TicketTier, quantity: i.quantity });
    groups.set(i.performance_id, g);
  }

  let subtotal = 0;
  let discount = 0;
  let total = 0;
  const bundles: { title: string; percent: number; amount: number }[] = [];
  let promoDiscount = 0;
  let promoSkipped = false;
  // Shows that pay into the same account are merged into one payee.
  const payees = new Map<string, PaymentGroup>();
  let promoLeft = promo;
  for (const g of groups.values()) {
    const p = calculatePricing(g.lines, promoLeft, g.productionId, new Date(), g.production, crossAllowance(g.production, crossSource, crossLeft));
    crossLeft -= p.crossshowUses ?? 0;
    if (p.discountSource === "crossshow") {
      crossDiscount += p.discountAmount;
      crossUsed += p.crossshowUses ?? 0;
    }
    if (p.discountSource === "bundle") bundles.push({ title: g.production?.title ?? "", percent: p.bundlePercent ?? 0, amount: p.discountAmount });
    if (p.discountSource === "promo") promoDiscount += p.discountAmount;
    if (p.promoSkipped) promoSkipped = true;
    if (promoLeft) promoLeft = { ...promoLeft, times_used: promoLeft.times_used + p.promoUses };
    subtotal += p.subtotal;
    discount += p.discountAmount;
    total += p.total;

    const details = resolvePayment(g.production);
    const key = JSON.stringify(details);
    const payee = payees.get(key) ?? { titles: [], total: 0, details };
    const title = g.production?.title;
    if (title && !payee.titles.includes(title)) payee.titles.push(title);
    payee.total += p.total;
    payees.set(key, payee);
  }
  return NextResponse.json({ subtotal, discount, total, bundles, promoDiscount, promoSkipped, crossshow: { offered: [...groups.values()].some((g) => g.production?.crossshow_enabled), checked: !!(xref && xemail), error: crossError, available: crossSource?.available ?? 0, used: crossUsed, discount: crossDiscount }, payments: [...payees.values()] });
}
