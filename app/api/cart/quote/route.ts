import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCart } from "@/lib/cart-session";
import { createServiceClient } from "@/lib/supabase/service";
import { calculatePricing } from "@/lib/pricing";
import { resolvePayment, type PaymentGroup } from "@/lib/payment";
import type { TicketTier } from "@/types/database";

type PaymentProduction = {
  title: string;
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
    .select("*, ticket_tier:ticket_tiers(*), performance:performances(production_id, production:productions(id, title, gcash_name, gcash_number, gcash_qr_url, bank_name, bank_account_name, bank_account_number, bank_qr_url))")
    .eq("cart_id", cart.id);

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
  // Shows that pay into the same account are merged into one payee.
  const payees = new Map<string, PaymentGroup>();
  for (const g of groups.values()) {
    const p = calculatePricing(g.lines, promo, g.productionId);
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
  return NextResponse.json({ subtotal, discount, total, payments: [...payees.values()] });
}
