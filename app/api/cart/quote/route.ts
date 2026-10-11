import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCart } from "@/lib/cart-session";
import { createServiceClient } from "@/lib/supabase/service";
import { calculatePricing } from "@/lib/pricing";
import type { TicketTier } from "@/types/database";

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
    .select("*, ticket_tier:ticket_tiers(*), performance:performances(production_id)")
    .eq("cart_id", cart.id);

  const promo = code
    ? (await db.from("promo_codes").select("*").eq("code", code).maybeSingle()).data
    : null;

  type Group = { productionId: string; lines: { ticket_tier: TicketTier; quantity: number }[] };
  const groups = new Map<string, Group>();
  for (const i of items ?? []) {
    const g: Group = groups.get(i.performance_id) ?? { productionId: i.performance.production_id, lines: [] };
    g.lines.push({ ticket_tier: i.ticket_tier as TicketTier, quantity: i.quantity });
    groups.set(i.performance_id, g);
  }

  let subtotal = 0;
  let discount = 0;
  let total = 0;
  for (const g of groups.values()) {
    const p = calculatePricing(g.lines, promo, g.productionId);
    subtotal += p.subtotal;
    discount += p.discountAmount;
    total += p.total;
  }
  return NextResponse.json({ subtotal, discount, total });
}
