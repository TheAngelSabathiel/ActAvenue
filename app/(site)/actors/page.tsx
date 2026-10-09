import Image from "next/image";
import Link from "next/link";
import { listPublicActors } from "@/lib/data/actors";
import { IMAGES } from "@/lib/images";

export default async function ActorsDirectoryPage() {
  const actors = await listPublicActors();

  return (
    <div className="aa-container py-16">
      <h1 className="text-4xl mb-2">Cast &amp; Crew</h1>
      <hr className="aa-divider" />

      {actors.length === 0 && (
        <div className="aa-card p-10 text-center">
          <p className="font-bold uppercase tracking-[0.08em] mb-0">No public profiles yet</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {actors.map((actor) => (
          <Link key={actor.id} href={`/actors/${actor.id}`} className="aa-card aa-lift p-5 flex items-center gap-4">
            <Image
              src={actor.photo_url ?? IMAGES.headshotPlaceholder}
              alt={actor.display_name ?? ""}
              width={64}
              height={64}
              className="h-16 w-16 object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-black text-lg mb-0">{actor.display_name ?? "Cast member"}</p>
              {actor.bio && <p className="text-xs text-muted line-clamp-2 mb-0">{actor.bio}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
