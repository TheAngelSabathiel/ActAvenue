import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPublicActor, type ActorProfileWithDetails } from "@/lib/data/actors";
import { IMAGES } from "@/lib/images";
import { SocialLinksList } from "@/components/social-icons";
import { CREDIT_TYPE_RANK, CREDIT_TYPE_LABEL, type CreditType } from "@/lib/credits";

type Credits = ActorProfileWithDetails["production_credits"];

type Line = { id: string; label: string; detail: string };

/** One card per production: artistic roles and management roles listed separately. */
function groupByProduction(credits: Credits) {
  const byProduction = new Map<
    string,
    { id: string; title: string; slug: string; published: boolean; artistic: (Line & { rank: number })[]; management: Line[] }
  >();
  for (const c of credits) {
    const card = byProduction.get(c.production_id) ?? {
      id: c.production_id,
      title: c.production.title,
      slug: c.production.slug,
      published: c.production.status === "published",
      artistic: [],
      management: [],
    };
    if (c.section === "artistic") {
      const type = (c.credit_type ?? "actor") as CreditType;
      const generic = c.role_played === CREDIT_TYPE_LABEL[type] || c.role_played === "Actor";
      // "Actor · Maria, Play Title". The character and the play are each left out when there is none.
      const detail = [generic ? "" : c.role_played, c.play?.title ?? ""].filter(Boolean).join(", ");
      card.artistic.push({ id: c.id, label: CREDIT_TYPE_LABEL[type], detail, rank: CREDIT_TYPE_RANK[type] });
    } else {
      card.management.push({ id: c.id, label: c.role_played, detail: "" });
    }
    byProduction.set(c.production_id, card);
  }
  return [...byProduction.values()].map((card) => ({ ...card, artistic: card.artistic.sort((a, b) => a.rank - b.rank) }));
}

function RoleGroup({ heading, lines }: { heading: string; lines: Line[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-3 first-of-type:mt-0">
      <p className="aa-label text-muted mb-1">{heading}</p>
      <ul className="space-y-1 text-sm">
        {lines.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-black" aria-hidden="true" />
            <span>
              <span className="font-bold">{l.label}</span>
              {l.detail && <span className="text-muted">{` · ${l.detail}`}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ActorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPublicActor(id);
  if (!actor) notFound();
  const productionCards = groupByProduction(actor.production_credits);

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
        {actor.bio && <p className="mb-0 text-justify hyphens-auto whitespace-pre-line" lang="en">{actor.bio}</p>}
        <SocialLinksList values={actor} />

        {(actor.resume_url || actor.reel_url) && (
          <div className="flex justify-center gap-3 mt-6">
            {actor.resume_url && (
              <a href={actor.resume_url} target="_blank" rel="noopener noreferrer" className="aa-btn aa-btn-outline aa-btn-sm">Resume</a>
            )}
            {actor.reel_url && (
              <a href={actor.reel_url} target="_blank" rel="noopener noreferrer" className="aa-btn aa-btn-outline aa-btn-sm">Reel</a>
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

      {productionCards.length > 0 && (
        <section>
          <h2 className="text-xl mb-2">Productions</h2>
          <hr className="aa-divider" />
          <div className="space-y-4">
            {productionCards.map((card) => {
              const body = (
                <>
                  <p className="font-black text-lg mb-3">{card.title}</p>
                  <RoleGroup heading="Artistic" lines={card.artistic} />
                  <RoleGroup heading="Management" lines={card.management} />
                </>
              );
              return card.published ? (
                <Link key={card.id} href={`/productions/${card.slug}`} className="aa-card aa-lift p-5 block">
                  {body}
                </Link>
              ) : (
                <div key={card.id} className="aa-card p-5">
                  {body}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
