import { createServiceClient } from "@/lib/supabase/service";
import type { ProductionPartner } from "@/types/database";

export async function getPartners(productionId: string): Promise<ProductionPartner[]> {
  const { data, error } = await createServiceClient()
    .from("production_partners")
    .select("*")
    .eq("production_id", productionId);
  if (error) return [];
  return (data ?? []) as ProductionPartner[];
}
