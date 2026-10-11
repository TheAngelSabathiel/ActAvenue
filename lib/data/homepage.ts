import { createClient } from "@/lib/supabase/server";
import type { Production } from "@/types/database";

export async function listPublishedProductions(): Promise<Production[]> {
  const supabase = await createClient();
  const ordered = await supabase
    .from("productions")
    .select("*")
    .eq("status", "published")
    .order("carousel_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (!ordered.error) return ordered.data ?? [];

  // carousel_order column not added yet (migration-carousel-order.sql): newest first.
  const { data } = await supabase
    .from("productions")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return data ?? [];
}
