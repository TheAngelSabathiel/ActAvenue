import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPlayDetail, type PlayShowing, type ShowingPerson } from "@/lib/data/plays";
import { formatDate } from "@/lib/datetime";
import { IMAGES } from "@/lib/images";

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
          <Link href={`/actors/${p.id}`} className="font-bold underline">{p.name}</Link>
        </span>
      ))}
    </p>
  );
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
            <Link key={p.id + i} href={`/actors/${p.id}`} className="flex items-center gap-3">
              <Image
                src={p.photo_url ?? IMAGES.headshotPlaceholder}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-sm mb-0">{p.name}</p>
                <p className="aa-label text-muted mb-0">{p.role}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlayDetail(id);
  if (!detail) notFound();
  const { play, current, past } = detail;

  return (
    <div className="aa-container py-16 space-y-12">
      <div>
        <Link href="/plays" className="aa-label text-muted hover:underline">All plays</Link>
        <div className="grid gap-8 md:grid-cols-[320px_1fr] mt-4">
          <div className="relative aspect-[4/3] bg-black/5">
            <Image
              src={play.photo_url ?? IMAGES.posterPlaceholder}
              alt=""
              fill
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-4xl mb-2">{play.title}</h1>
            <hr className="aa-divider" />
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
