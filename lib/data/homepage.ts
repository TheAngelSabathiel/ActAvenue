import { createPublicClient } from "@/lib/supabase/public";
import type { Production } from "@/types/database";

export async function listPublishedProductions(): Promise<Production[]> {
  const supabase = createPublicClient();
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

export interface HomeShow {
  productionId: string;
  venue: string | null;
  firstAt: string | null;
  lastAt: string | null;
}

/** Venue and date span per published production, for the home page cards. */
export async function listHomeShows(ids: string[]): Promise<Record<string, HomeShow>> {
  const out: Record<string, HomeShow> = {};
  if (ids.length === 0) return out;
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("performances")
    .select("production_id, datetime, venue")
    .in("production_id", ids)
    .order("datetime", { ascending: true });
  const now = Date.now();
  for (const r of data ?? []) {
    const cur = out[r.production_id];
    if (!cur) {
      out[r.production_id] = { productionId: r.production_id, venue: r.venue, firstAt: r.datetime, lastAt: r.datetime };
      continue;
    }
    cur.lastAt = r.datetime;
    // Show the venue of the next upcoming performance when there is one.
    if (new Date(cur.firstAt!).getTime() < now && new Date(r.datetime).getTime() >= now) cur.venue = r.venue;
  }
  return out;
}
