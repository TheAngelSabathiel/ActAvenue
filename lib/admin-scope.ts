import { createServiceClient } from "@/lib/supabase/service";

/** Resolve which production a child record belongs to, for access checks. */

export async function productionOfReservation(id: string): Promise<string | null> {
  const { data } = await createServiceClient().from("reservations").select("production_id").eq("id", id).maybeSingle();
  return data?.production_id ?? null;
}

export async function productionOfPerformance(id: string): Promise<string | null> {
  const { data } = await createServiceClient().from("performances").select("production_id").eq("id", id).maybeSingle();
  return data?.production_id ?? null;
}

export async function productionOfTier(id: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from("ticket_tiers")
    .select("performance:performances(production_id)")
    .eq("id", id)
    .maybeSingle();
  const perf = Array.isArray(data?.performance) ? data?.performance[0] : data?.performance;
  return perf?.production_id ?? null;
}

export async function productionOfCredit(id: string): Promise<string | null> {
  const { data } = await createServiceClient().from("production_credits").select("production_id").eq("id", id).maybeSingle();
  return data?.production_id ?? null;
}

export async function productionOfPromo(id: string): Promise<string | null> {
  const { data } = await createServiceClient().from("promo_codes").select("applies_to_production_id").eq("id", id).maybeSingle();
  return data?.applies_to_production_id ?? null;
}
