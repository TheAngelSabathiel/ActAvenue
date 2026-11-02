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

/** Splits a typed list of booking codes (commas, spaces or new lines), uppercased, without repeats. */
export function parseRefs(raw: string | null | undefined): string[] {
  return [...new Set((raw ?? "").toUpperCase().split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 10);
}

/**
 * Finds the booking a buyer wants to earn a cross-show discount from. It must be
 * confirmed, carry the same email (not case sensitive), and belong to a show that
 * is on sale now. The error is the same whether the code or the email is wrong,
 * so codes can't be probed.
 */
async function lookupOne(db: SupabaseClient, code: string, email: string): Promise<{ source?: CrossSource; error?: string }> {
  const mail = email.trim().toLowerCase();
  if (!code || !mail) return { error: CROSSSHOW_MISMATCH };
  const { data: r } = await db
    .from("reservations")
    .select("id, production_id, buyer_email, payment_status")
    .eq("reference_code", code)
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

/** Looks up every code typed. Several bookings under the same email add up. */
export async function lookupCrossSources(
  db: SupabaseClient,
  raw: string,
  email: string
): Promise<{ sources: CrossSource[]; error?: string }> {
  const sources = new Map<string, CrossSource>();
  for (const code of parseRefs(raw)) {
    const found = await lookupOne(db, code, email);
    if (found.error || !found.source) return { sources: [], error: `${code}: ${found.error ?? CROSSSHOW_MISMATCH}` };
    sources.set(found.source.id, found.source);
  }
  return { sources: [...sources.values()] };
}

/** What a production's cross-show discount allows from these sources, or null. */
export function crossAllowance(
  production: CrossProduction | null | undefined,
  sources: CrossSource[],
  left: Map<string, number>
): { amount: number; uses: number; eligible: CrossSource[] } | null {
  if (!production?.crossshow_enabled) return null;
  const list = production.crossshow_source_ids ?? [];
  const eligible = sources.filter((s) => list.includes(s.production_id));
  const uses = eligible.reduce((n, s) => n + (left.get(s.id) ?? 0), 0);
  const amount = Number(production.crossshow_amount);
  return amount > 0 && uses > 0 ? { amount, uses, eligible } : null;
}

/** Takes `uses` from the eligible sources in order and records what is left of each. */
export function allocateCross(eligible: CrossSource[], left: Map<string, number>, uses: number): { sourceId: string; uses: number }[] {
  const out: { sourceId: string; uses: number }[] = [];
  let need = uses;
  for (const s of eligible) {
    if (need <= 0) break;
    const take = Math.min(left.get(s.id) ?? 0, need);
    if (take > 0) {
      out.push({ sourceId: s.id, uses: take });
      left.set(s.id, (left.get(s.id) ?? 0) - take);
      need -= take;
    }
  }
  return out;
}

export const sourceLeft = (sources: CrossSource[]) => new Map(sources.map((s) => [s.id, s.available]));
