import Link from "next/link";
import { listPublishedProductions, listHomeShows } from "@/lib/data/homepage";
import { IMAGES } from "@/lib/images";
import { ProductionCarousel } from "@/components/production-carousel";
import { HomeShows } from "@/components/home-shows";
import { PH_TZ } from "@/lib/datetime";
import { CONTACT_EMAIL, SocialLinks } from "@/components/site-footer";

// Saved by the CDN for a minute; admin edits refresh it right away.
export const revalidate = 60;

const STEPS = [
  { icon: "bi-ticket-perforated", title: "Pick a show", text: "Choose a date and your seats." },
  { icon: "bi-phone", title: "Send payment", text: "Upload your proof at checkout." },
  { icon: "bi-patch-check", title: "We verify", text: "Our team reviews it within 24 hours." },
  { icon: "bi-qr-code", title: "Get your QR", text: "Your e-ticket arrives by email." },
];

/** "Nov 14 to 15, 2026", or one date when the run is a single day. */
function dateSpan(first: string | null, last: string | null) {
  if (!first || !last) return null;
  const part = (iso: string) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-PH", { timeZone: PH_TZ, month: "short", day: "numeric", year: "numeric" })
        .formatToParts(new Date(iso))
        .map((x) => [x.type, x.value])
    );
    return { month: p.month, day: p.day, year: p.year };
  };
  const a = part(first);
  const b = part(last);
  if (a.month === b.month && a.day === b.day && a.year === b.year) return `${a.month} ${a.day}, ${a.year}`;
  if (a.month === b.month && a.year === b.year) return `${a.month} ${a.day} to ${b.day}, ${a.year}`;
  return `${a.month} ${a.day}, ${a.year} to ${b.month} ${b.day}, ${b.year}`;
}

export default async function HomePage() {
  const productions = await listPublishedProductions();
  const shows = await listHomeShows(productions.map((p) => p.id));

  return (
    <>
      {productions.length === 0 ? (
        <section className="aa-container pt-12 pb-6">
          <div className="aa-card p-10 text-center">
            <p className="font-bold uppercase tracking-[0.08em] mb-1">No current productions</p>
            <p className="text-muted mb-0">New productions are announced on our socials.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="pt-5 md:pt-8 pb-6">
            <ProductionCarousel
              productions={productions.map((p) => ({
                id: p.id,
                slug: p.slug,
                title: p.title,
                description: p.description,
                image: p.banner_url ?? p.poster_url ?? IMAGES.bannerPlaceholder,
              }))}
            />
          </section>

          <section id="now-showing" className="aa-container pt-6 pb-10">
            <h2 className="text-3xl mb-2">Current Productions</h2>
            <hr className="aa-divider" />
            <HomeShows
              shows={productions.map((p) => ({
                id: p.id,
                slug: p.slug,
                title: p.title,
                image: p.banner_url ?? p.poster_url ?? IMAGES.bannerPlaceholder,
                venue: shows[p.id]?.venue ?? null,
                dates: dateSpan(shows[p.id]?.firstAt ?? null, shows[p.id]?.lastAt ?? null),
              }))}
            />
          </section>
        </>
      )}

      <section className="py-6">
        <div className="aa-container">
          <h2 className="text-3xl mb-2">How Booking Works</h2>
          <hr className="aa-divider" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
            {STEPS.map((s) => (
              <div key={s.title} className="aa-box shadow-sm p-6 md:p-8">
                <i className={`bi ${s.icon} text-3xl block mb-3`} />
                <p className="font-black uppercase tracking-[0.08em] mb-1">{s.title}</p>
                <p className="text-sm opacity-75 mb-0">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <Link href="/actors" className="aa-box shadow-sm p-8 font-bold uppercase tracking-[0.08em]">Cast &amp; Crew</Link>
            <Link href="/account" className="aa-box shadow-sm p-8 font-bold uppercase tracking-[0.08em]">My Tickets</Link>
          </div>
        </div>
      </section>

      <section id="about" className="pt-6 pb-14">
        <div className="aa-container grid gap-10 md:grid-cols-2">
          <div className="border-l-[5px] border-black pl-6">
            <h2 className="text-2xl mb-3">About</h2>
            <p className="text-lg">
              Founded in 2019, <strong>ACT AVENUE</strong>, is a young, fast-running,
              and multi-awarded theater group in the country today.
              We aim to promote the value of arts and cultural
              performances by providing an <strong>avenue</strong> and a <strong>safe space</strong> for artists where they can freely discover and
              hone their full potential.
            </p>
            <Link href="/about" className="font-bold underline">Read more about us</Link>
          </div>
          <div id="contact">
            <h2 className="text-2xl mb-3">Get In Touch</h2>
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold">{CONTACT_EMAIL}</a>
            <p className="mt-3 mb-0"><Link href="/contact" className="aa-btn aa-btn-sm">Contact us</Link></p>
            <SocialLinks className="mt-4" />
          </div>
        </div>
      </section>
    </>
  );
}
