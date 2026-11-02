import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { calculatePricing } from "@/lib/pricing";
import { lookupCrossSource, crossAllowance } from "@/lib/crossshow";
import type { TicketTier } from "@/types/database";

/** Live total for the staff New reservation form: same pricing as the booking itself. */
export async function POST(req: NextRequest) {
  const { performance_id, items, promo_code, crossshow_ref, buyer_email } = await req.json();
  if (!performance_id || !Array.isArray(items) || !items.length) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const db = createServiceClient();
  const { data: performance } = await db.from("performances").select("id, production_id").eq("id", performance_id).maybeSingle();
  if (!performance) return NextResponse.json({ error: "Performance not found" }, { status: 404 });
  const gate = await requireProduction(performance.production_id, "foh");
  if (gate.error) return gate.error;

  const { data: production } = await db.from("productions").select("*").eq("id", performance.production_id).single();
  const { data: tiers } = await db.from("ticket_tiers").select("*").in("id", items.map((i: { ticket_tier_id: string }) => i.ticket_tier_id));
  const tierMap = new Map((tiers ?? []).map((t: TicketTier) => [t.id, t]));
  const lines = items
    .map((i: { ticket_tier_id: string; quantity: number }) => ({ ticket_tier: tierMap.get(i.ticket_tier_id)!, quantity: Number(i.quantity) || 0 }))
    .filter((l: { ticket_tier?: TicketTier; quantity: number }) => l.ticket_tier && l.quantity > 0);
  if (!lines.length) return NextResponse.json({ error: "Pick a ticket first." }, { status: 400 });

  let promo = null;
  let promoError: string | undefined;
  if (promo_code?.trim()) {
    const { data } = await db.from("promo_codes").select("*").eq("code", String(promo_code).toUpperCase().trim()).maybeSingle();
    promo = data;
    if (!data) promoError = "Promo code not found.";
  }
  let crossError: string | undefined;
  let source;
  if (crossshow_ref?.trim()) {
    const found = await lookupCrossSource(db, crossshow_ref, buyer_email ?? "");
    crossError = found.error;
    source = found.source;
  }
  const pricing = calculatePricing(lines, promo, production!.id, new Date(), production, crossAllowance(production, source, source?.available ?? 0));
  return NextResponse.json({ pricing, promoError: promoError ?? (promo && pricing.discountSource === "none" ? pricing.rejectedPromoReason : undefined), crossError });
}
