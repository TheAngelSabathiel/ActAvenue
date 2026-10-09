import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPublicActor } from "@/lib/data/actors";
import { IMAGES } from "@/lib/images";

export default async function ActorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPublicActor(id);
  if (!actor) notFound();

  return (
    <div className="aa-container max-w-xl py-16 space-y-10">
      <div className="aa-card p-8 text-center">
        <Image
          src={actor.photo_url ?? IMAGES.headshotPlaceholder}
          alt={actor.display_name ?? ""}
          width={160}
          height={160}
          className="h-40 w-40 object-cover mx-auto mb-6 border-2 border-black"
        />
        <h1 className="text-3xl mb-4">{actor.display_name ?? "Cast member"}</h1>
        {actor.bio && <p className="mb-0">{actor.bio}</p>}

        {(actor.resume_url || actor.reel_url) && (
          <div className="flex justify-center gap-3 mt-6">
            {actor.resume_url && (
              <a href={actor.resume_url} target="_blank" rel="noreferrer" className="aa-btn aa-btn-outline aa-btn-sm">Resume</a>
            )}
            {actor.reel_url && (
              <a href={actor.reel_url} target="_blank" rel="noreferrer" className="aa-btn aa-btn-outline aa-btn-sm">Reel</a>
            )}
          </div>
        )}
      </div>

      {actor.actor_photos.length > 0 && (
        <section>
          <h2 className="text-xl mb-2">Gallery</h2>
          <hr className="aa-divider" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {actor.actor_photos.map((photo) => (
              <div key={photo.id} className="relative aspect-[3/4] overflow-hidden bg-soft">
                <Image src={photo.photo_url} alt={photo.caption ?? ""} fill sizes="200px" className="object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {actor.production_credits.length > 0 && (
        <section>
          <h2 className="text-xl mb-2">Productions</h2>
          <hr className="aa-divider" />
          <div className="space-y-2">
            {actor.production_credits.map((credit) => (
              <Link
                key={credit.id}
                href={`/productions/${credit.production.slug}`}
                className="aa-card aa-lift p-4 flex justify-between items-center"
              >
                <span className="font-black">{credit.production.title}</span>
                <span className="aa-label text-muted">{credit.role_played}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
