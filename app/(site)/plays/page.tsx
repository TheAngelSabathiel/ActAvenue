import Image from "next/image";
import Link from "next/link";
import { listPlays } from "@/lib/data/plays";
import { IMAGES } from "@/lib/images";

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
              <Image
                src={play.photo_url ?? IMAGES.posterPlaceholder}
                alt=""
                fill
                sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <p className="font-black text-lg mb-0">{play.title}</p>
              {play.description && <p className="text-xs text-muted line-clamp-2 mt-1 mb-0">{play.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
