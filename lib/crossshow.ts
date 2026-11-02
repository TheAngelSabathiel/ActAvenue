import type { SupabaseClient } from "@supabase/supabase-js";

export type CrossSource = { id: string; production_id: string; available: number };

type CrossProduction = {
  crossshow_enabled?: boolean | null;
  crossshow_amount?: number | string | null;
  crossshow_source_ids?: string[] | null;
};

export const CROSSSHOW_ENDED =
  "That show is no longer on sale, so its bookings can't earn this discount. Only shows currently on sale qualify.";

export const CROSSSHOW_MISMATCH =
  "We couldn't match that code to this email. Use the booking code and the same email from a paid, confirmed booking.";

/**
 * Finds the booking a buyer wants to earn a cross-show discount from. It must be
 * confirmed and carry the same email (not case sensitive). The error is the same
 * whether the code or the email is wrong, so codes can't be probed.
 */
export async function lookupCrossSource(
  db: SupabaseClient,
  code: string,
  email: string
): Promise<{ source?: CrossSource; error?: string }> {
  const ref = code.toUpperCase().trim();
  const mail = email.trim().toLowerCase();
  if (!ref || !mail) return { error: CROSSSHOW_MISMATCH };
  const { data: r } = await db
    .from("reservations")
    .select("id, production_id, buyer_email, payment_status")
    .eq("reference_code", ref)
    .maybeSingle();
  if (!r || r.payment_status !== "confirmed" || (r.buyer_email ?? "").trim().toLowerCase() !== mail) {
    return { error: CROSSSHOW_MISMATCH };
  }
  // Only shows on sale now qualify: published, and still with a show date ahead.
  const { data: prod } = await db.from("productions").select("status").eq("id", r.production_id).maybeSingle();
  const { count: upcoming } = await db
    .from("performances")
    .select("id", { count: "exact", head: true })
    .eq("production_id", r.production_id)
    .gt("datetime", new Date().toISOString());
  if (prod?.status !== "published" || !upcoming) return { error: CROSSSHOW_ENDED };
  const { data: avail } = await db.rpc("crossshow_available", { p_source: r.id });
  return { source: { id: r.id, production_id: r.production_id, available: Number(avail) || 0 } };
}

/** What a production's cross-show discount allows for this source booking, or null. */
export function crossAllowance(
  production: CrossProduction | null | undefined,
  source: CrossSource | undefined,
  usesLeft: number
): { amount: number; uses: number } | null {
  if (!production?.crossshow_enabled || !source) return null;
  if (!(production.crossshow_source_ids ?? []).includes(source.production_id)) return null;
  const amount = Number(production.crossshow_amount);
  return amount > 0 && usesLeft > 0 ? { amount, uses: usesLeft } : null;
}
