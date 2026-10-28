import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { getPlayDetail as fetchPlay, type PlayShowing, type ShowingPerson } from "@/lib/data/plays";
import { shareMetadata } from "@/lib/share-meta";
import { formatDate } from "@/lib/datetime";
import { IMAGES } from "@/lib/images";
import { PlayPhotoFull } from "@/components/play-cover";
import { ShareButton, CopyLinkButton } from "@/components/share-button";

// Saved by the CDN for a minute; admin edits refresh it right away.
export const revalidate = 60;
// No pages built ahead of time; each is built on first visit, then saved.
export function generateStaticParams() {
  return [];
}

function dateRange(s: PlayShowing) {
  if (!s.first) return "Dates to be announced";
  const a = formatDate(s.first);
  const b = s.last ? formatDate(s.last) : a;
  return a === b ? a : `${a} to ${b}`;
}

function Names({ label, people }: { label: string; people: ShowingPerson[] }) {
  if (people.length === 0) return null;
  return (
    <p className="mb-2">
      <span className="aa-label text-muted mr-3">{people.length > 1 ? `${label}s` : label}</span>
      {people.map((p, i) => (
        <span key={p.id + i}>
          {i > 0 && ", "}
          {p.listed ? <Link href={`/actors/${p.id}`} className="font-bold underline">{p.name}</Link> : <span className="font-bold">{p.name}</span>}
        </span>
      ))}
    </p>
  );
}

function PersonRow({ p, children }: { p: ShowingPerson; children: React.ReactNode }) {
  const cls = "flex items-center gap-3";
  return p.listed ? <Link href={`/actors/${p.id}`} className={cls}>{children}</Link> : <div className={cls}>{children}</div>;
}

function Showing({ s }: { s: PlayShowing }) {
  const head = (
    <div className="flex items-center gap-4">
      <Image
        src={s.poster_url ?? IMAGES.posterPlaceholder}
        alt=""
        width={72}
        height={108}
        className="h-[108px] w-[72px] object-cover shrink-0"
      />
      <div>
        <p className="font-black text-xl mb-1">{s.title}</p>
        <p className="aa-label text-muted mb-0">{dateRange(s)}</p>
      </div>
    </div>
  );
  return (
    <div className="aa-card p-5 space-y-4">
      {s.linkable ? <Link href={`/productions/${s.slug}`} className="block hover:opacity-80">{head}</Link> : head}
      <div>
        <Names label="Writer" people={s.writers} />
        <Names label="Director" people={s.directors} />
      </div>
      {s.cast.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {s.cast.map((p, i) => (
            <PersonRow key={p.id + i} p={p}>
              <Image
                src={p.photo_url ?? IMAGES.headshotPlaceholder}
                alt=""
                width={44}
                height={44}
                sizes="128px"
                className="h-11 w-11 object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-sm mb-0">{p.name}</p>
                <p className="aa-label text-muted mb-0">{p.role}</p>
              </div>
            </PersonRow>
          ))}
        </div>
      )}
    </div>
  );
}

const getPlayDetail = cache(fetchPlay);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await getPlayDetail(id);
  if (!d) return {};
  const by = d.writers.length ? `By ${d.writers.map((w) => w.name).join(", ")}. ` : "";
  return shareMetadata({
    title: d.play.title,
    description: d.play.logline ? `${d.play.logline} ${by}`.trim() : `${by}${d.play.description ?? ""}`,
    image: d.play.photo_url,
    path: `/plays/${id}`,
  });
}

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlayDetail(id);
  if (!detail) notFound();
  const { play, writers, current, past } = detail;

  return (
    <div className="aa-container py-16 space-y-12">
      <div>
        <Link href="/plays" className="aa-label text-muted hover:underline">All plays</Link>
        <div className="grid gap-8 md:grid-cols-[320px_1fr] items-start mt-4">
          <div>
            <PlayPhotoFull title={play.title} photoUrl={play.photo_url} sizes="(min-width: 768px) 320px, 100vw" priority />
          </div>
          <div>
            <h1 className="text-4xl mb-2">{play.title}</h1>
            {play.logline && <p className="text-xl italic mb-3">{play.logline}</p>}
            <div className="flex flex-wrap gap-2 mb-2">
              <ShareButton title={play.title} text={play.logline} path={`/plays/${play.id}`} />
              <CopyLinkButton path={`/plays/${play.id}`} />
            </div>
            <hr className="aa-divider" />
            {writers.length > 0 && (
              <p className="mb-3">
                <span className="aa-label text-muted mr-3">{writers.length > 1 ? "Writers" : "Writer"}</span>
                {writers.map((w, i) => (
                  <span key={w.id}>
                    {i > 0 && ", "}
                    {w.listed ? <Link href={`/actors/${w.id}`} className="font-bold underline">{w.name}</Link> : <span className="font-bold">{w.name}</span>}
                  </span>
                ))}
              </p>
            )}
            {play.description && <p className="whitespace-pre-line mb-0">{play.description}</p>}
          </div>
        </div>
      </div>

      {current.length > 0 && (
        <section>
          <h2 className="text-2xl mb-2">Now Showing</h2>
          <hr className="aa-divider" />
          <div className="space-y-4">{current.map((s) => <Showing key={s.production_id} s={s} />)}</div>
        </section>
      )}

      <section>
        <h2 className="text-2xl mb-2">Past Showings</h2>
        <hr className="aa-divider" />
        {past.length === 0 ? (
          <p className="text-muted">{current.length > 0 ? "No earlier showings yet." : "No showings yet."}</p>
        ) : (
          <div className="space-y-4">{past.map((s) => <Showing key={s.production_id} s={s} />)}</div>
        )}
      </section>
    </div>
  );
}
