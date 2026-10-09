import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import type { Play } from "@/types/database";

export async function listPlays(): Promise<Play[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("plays").select("*");
  return (data ?? []).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export interface ShowingPerson {
  id: string;
  name: string;
  photo_url: string | null;
  role: string;
}

export interface PlayShowing {
  production_id: string;
  slug: string;
  title: string;
  poster_url: string | null;
  /** Only published productions have a public page to link to. */
  linkable: boolean;
  first: string | null;
  last: string | null;
  isCurrent: boolean;
  writers: ShowingPerson[];
  directors: ShowingPerson[];
  cast: ShowingPerson[];
}

export interface PlayDetail {
  play: Play;
  current: PlayShowing[];
  past: PlayShowing[];
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/**
 * A play with every production that staged it. Closed productions are
 * included so the history stays complete; drafts never show. Only public,
 * approved profiles are listed as cast.
 */
export async function getPlayDetail(id: string): Promise<PlayDetail | null> {
  const db = createServiceClient();

  const { data: play } = await db.from("plays").select("*").eq("id", id).maybeSingle();
  if (!play) return null;

  const { data: rows } = await db
    .from("production_plays")
    .select("production:productions(id, slug, title, status, poster_url, performances(datetime))")
    .eq("play_id", id);

  const productions = (rows ?? [])
    .map((r) => one(r.production))
    .filter((p): p is NonNullable<typeof p> => !!p && p.status !== "draft");

  const ids = productions.map((p) => p.id);
  const { data: creditRows } = ids.length
    ? await db
        .from("production_credits")
        .select("production_id, role_played, credit_type, sort_order, profile:profiles(id, display_name, photo_url, is_public, is_approved)")
        .eq("play_id", id)
        .eq("section", "artistic")
        .eq("is_discredited", false)
        .in("production_id", ids)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const now = Date.now();
  const showings: PlayShowing[] = productions.map((p) => {
    const times = (p.performances ?? []).map((x: { datetime: string }) => x.datetime).sort();
    const people = (creditRows ?? [])
      .filter((c) => c.production_id === p.id)
      .map((c) => ({ c, profile: one(c.profile) }))
      .filter(({ profile }) => profile && profile.is_public && profile.is_approved)
      .map(({ c, profile }) => ({
        type: c.credit_type as string | null,
        person: { id: profile!.id, name: profile!.display_name ?? "Cast member", photo_url: profile!.photo_url, role: c.role_played },
      }));
    const ofType = (t: string) => people.filter((x) => x.type === t).map((x) => x.person);
    return {
      production_id: p.id,
      slug: p.slug,
      title: p.title,
      poster_url: p.poster_url,
      linkable: p.status === "published",
      first: times[0] ?? null,
      last: times[times.length - 1] ?? null,
      isCurrent: p.status === "published" && (times.length === 0 || new Date(times[times.length - 1]).getTime() >= now),
      writers: ofType("writer"),
      directors: ofType("director"),
      cast: people.filter((x) => x.type === "actor" || !x.type).map((x) => x.person),
    };
  });

  const byDate = (a: PlayShowing, b: PlayShowing) => (a.first ?? "").localeCompare(b.first ?? "");
  return {
    play,
    current: showings.filter((s) => s.isCurrent).sort(byDate),
    past: showings.filter((s) => !s.isCurrent).sort((a, b) => byDate(b, a)),
  };
}
