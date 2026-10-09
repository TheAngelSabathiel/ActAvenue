import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { calculatePricing, isPromoCodeValid } from "@/lib/pricing";
import type { TicketTier } from "@/types/database";

export async function POST(req: NextRequest) {
  const { code, production_id, lines } = await req.json() as {
    code: string;
    production_id: string;
    lines: { ticket_tier_id: string; quantity: number }[];
  };

  if (!code || !production_id || !lines?.length) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: promo } = await db
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (!promo) {
    return NextResponse.json({ valid: false, reason: "Code not found." });
  }

  const validity = isPromoCodeValid(promo, production_id);
  if (!validity.valid) {
    return NextResponse.json({ valid: false, reason: validity.reason });
  }

  const tierIds = lines.map((l) => l.ticket_tier_id);
  const { data: tiers } = await db.from("ticket_tiers").select("*").in("id", tierIds);
  const tierMap = new Map((tiers ?? []).map((t: TicketTier) => [t.id, t]));

  const cartLines = lines
    .map((l) => ({ ticket_tier: tierMap.get(l.ticket_tier_id)!, quantity: l.quantity }))
    .filter((l) => l.ticket_tier);

  const pricing = calculatePricing(cartLines, promo, production_id);

  if (pricing.discountAmount === 0) {
    return NextResponse.json({
      valid: false,
      reason: "This code doesn't apply to any items in your cart (discounted-tier tickets don't accept promo codes).",
    });
  }

  return NextResponse.json({ valid: true, pricing });
}
