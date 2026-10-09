import { createClient } from "@/lib/supabase/server";
import type { Production } from "@/types/database";

export async function listPublishedProductions(): Promise<Production[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("productions")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return data ?? [];
}
