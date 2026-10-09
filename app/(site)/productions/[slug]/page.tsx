import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getProductionBySlug } from "@/lib/data/productions";
import { PerformancePicker } from "@/components/performance-picker";
import { IMAGES } from "@/lib/images";

export default async function ProductionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const production = await getProductionBySlug(slug);
  if (!production) notFound();

  return (
    <>
      <section className="relative bg-black text-white overflow-hidden">
        <Image
          src={production.banner_url ?? IMAGES.bannerPlaceholder}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="aa-container relative py-16 md:py-24 flex flex-col md:flex-row gap-8 md:items-end">
          <div className="relative w-40 md:w-52 aspect-[2/3] shrink-0 border-2 border-white shadow-2xl">
            <Image
              src={production.poster_url ?? IMAGES.posterPlaceholder}
              alt={`${production.title} poster`}
              fill
              sizes="208px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="aa-label opacity-75 mb-2">Act Avenue</p>
            <h1 className="text-4xl md:text-6xl text-white">{production.title}</h1>
          </div>
        </div>
      </section>

      <div className="aa-container py-12 space-y-12">
        {production.description && (
          <p className="w-full text-lg text-justify hyphens-auto whitespace-pre-line border-l-[5px] border-black pl-6 mb-0 pb-8">
            {production.description}
          </p>
        )}

        <section>
          <h2 className="text-2xl mb-2">Performances &amp; Tickets</h2>
          <hr className="aa-divider" />
          <PerformancePicker performances={production.performances} />
        </section>

        {production.credits.length > 0 && (
          <section>
            <h2 className="text-2xl mb-2">Cast &amp; Crew</h2>
            <hr className="aa-divider" />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {production.credits.map((credit) => (
                <Link
                  key={credit.id}
                  href={`/actors/${credit.profile.id}`}
                  className="aa-card aa-lift p-4 flex items-center gap-3"
                >
                  <Image
                    src={credit.profile.photo_url ?? IMAGES.headshotPlaceholder}
                    alt={credit.profile.display_name ?? ""}
                    width={56}
                    height={56}
                    className="h-14 w-14 object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-black mb-0">{credit.profile.display_name ?? "Cast member"}</p>
                    <p className="aa-label text-muted mb-0">{credit.role_played}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
