import { notFound } from "next/navigation";
import Image from "next/image";
import { getProductionBySlug } from "@/lib/data/productions";
import { CreditsDisplay } from "@/components/credits-display";
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

        <CreditsDisplay plays={production.plays} credits={production.credits} />
      </div>
    </>
  );
}
