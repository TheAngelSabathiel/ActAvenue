import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Credits a play's writers in a production that stages it. Skips anyone who
 * already has a writer credit for that play there (including credits you
 * entered by hand, and discredited ones), so nothing is duplicated or revived.
 */
export async function creditWriters(db: SupabaseClient, opts: { playId: string; productionId?: string }) {
  const { playId, productionId } = opts;
  const { data: writers } = await db.from("play_writers").select("profile_id").eq("play_id", playId).order("sort_order");
  if (!writers?.length) return;

  let productionIds: string[];
  if (productionId) productionIds = [productionId];
  else {
    const { data } = await db.from("production_plays").select("production_id").eq("play_id", playId);
    productionIds = (data ?? []).map((r) => r.production_id as string);
  }
  if (!productionIds.length) return;

  const profileIds = writers.map((w) => w.profile_id as string);
  // Credited writers join Cast and Crew, same as crediting them by hand.
  await db.from("profiles").update({ role: "actor" }).in("id", profileIds).eq("role", "public");

  for (const pid of productionIds) {
    const { data: existing } = await db
      .from("production_credits")
      .select("profile_id")
      .eq("production_id", pid)
      .eq("play_id", playId)
      .eq("credit_type", "writer")
      .in("profile_id", profileIds);
    const have = new Set((existing ?? []).map((r) => r.profile_id as string));
    const missing = profileIds.filter((id) => !have.has(id));
    if (!missing.length) continue;

    const { data: last } = await db
      .from("production_credits")
      .select("sort_order")
      .eq("production_id", pid)
      .eq("section", "artistic")
      .eq("play_id", playId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let order = last?.sort_order ?? 0;
    await db.from("production_credits").insert(
      missing.map((profile_id) => ({
        production_id: pid,
        profile_id,
        role_played: "Writer",
        section: "artistic",
        credit_type: "writer",
        play_id: playId,
        sort_order: (order += 10),
      }))
    );
  }
}

/** Replaces a play's writers with the given people, then credits them in its productions. */
export async function setPlayWriters(db: SupabaseClient, playId: string, profileIds: string[]) {
  const ids = [...new Set(profileIds)];
  await db.from("play_writers").delete().eq("play_id", playId);
  if (ids.length) {
    const { error } = await db.from("play_writers").insert(ids.map((profile_id, i) => ({ play_id: playId, profile_id, sort_order: (i + 1) * 10 })));
    if (error) throw new Error(error.message);
  }
  await creditWriters(db, { playId });
}
