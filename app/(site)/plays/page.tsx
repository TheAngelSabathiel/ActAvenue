import Link from "next/link";
import { PlayCover } from "@/components/play-cover";
import { listPlays } from "@/lib/data/plays";

// Saved by the CDN for a minute; admin edits refresh it right away.
export const revalidate = 60;

export const metadata = { title: "Plays" };

export default async function PlaysPage() {
  const plays = await listPlays();

  return (
    <div className="aa-container py-16">
      <h1 className="text-4xl mb-2">Plays</h1>
      <hr className="aa-divider" />

      {plays.length === 0 && (
        <div className="aa-card p-10 text-center">
          <p className="font-bold uppercase tracking-[0.08em] mb-0">No plays yet</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {plays.map((play) => (
          <Link key={play.id} href={`/plays/${play.id}`} className="aa-card aa-lift overflow-hidden flex flex-col">
            <div className="relative aspect-[4/3] bg-black/5">
              <PlayCover title={play.title} photoUrl={play.photo_url} sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw" />
            </div>
            <div className="p-5">
              <p className="font-black text-lg mb-0">{play.title}</p>
              {play.writers.length > 0 && (
                <p className="aa-label text-muted mt-1 mb-0">By {play.writers.map((w) => w.name).join(", ")}</p>
              )}
              {play.description && <p className="text-xs text-muted line-clamp-2 mt-1 mb-0">{play.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
