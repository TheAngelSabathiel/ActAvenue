import Link from "next/link";
import { listPublishedProductions } from "@/lib/data/homepage";
import { IMAGES } from "@/lib/images";
import { ProductionCarousel } from "@/components/production-carousel";
import { CONTACT_EMAIL, SocialLinks } from "@/components/site-footer";

const STEPS = [
  { icon: "bi-ticket-perforated", title: "Pick a show", text: "Choose a date and your seats." },
  { icon: "bi-phone", title: "Send payment", text: "Upload your proof at checkout." },
  { icon: "bi-patch-check", title: "We verify", text: "Our team reviews it within 24 hours." },
  { icon: "bi-qr-code", title: "Get your QR", text: "Your e-ticket arrives by email." },
];

export default async function HomePage() {
  const productions = await listPublishedProductions();

  return (
    <>
      <section className="bg-black text-white py-24 text-center">
        <div className="aa-container">
          <h1 className="text-5xl md:text-7xl mb-4">Book Your Seat</h1>
          <p className="text-lg opacity-75 tracking-[0.08em] mb-8">Tickets for Act Avenue productions</p>
          <Link href="#now-showing" className="aa-btn aa-btn-light aa-btn-lg">Browse Shows</Link>
        </div>
      </section>

      <section id="now-showing" className="aa-container py-16">
        <h2 className="text-3xl mb-2">Current Productions</h2>
        <hr className="aa-divider" />
        {productions.length === 0 ? (
          <div className="aa-card p-10 text-center">
            <p className="font-bold uppercase tracking-[0.08em] mb-1">No current productions</p>
            <p className="text-muted mb-0">New productions are announced on our socials.</p>
          </div>
        ) : (
          <div className="pb-8">
            <ProductionCarousel
              productions={productions.map((p) => ({
                id: p.id,
                slug: p.slug,
                title: p.title,
                description: p.description,
                image: p.banner_url ?? p.poster_url ?? IMAGES.bannerPlaceholder,
              }))}
            />
          </div>
        )}
      </section>

      <section className="py-16">
        <div className="aa-container">
          <h2 className="text-3xl mb-2">How Booking Works</h2>
          <hr className="aa-divider" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-10">
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

      <section id="about" className="py-16">
        <div className="aa-container grid gap-10 md:grid-cols-2">
          <div className="border-l-[5px] border-black pl-6">
            <h2 className="text-2xl mb-3">About</h2>
            <p className="text-lg">
              Founded in 2019, <strong>ACT AVENUE</strong>, is a young, fast-running,
and multi-awarded theater group in the country today.
We aim to promote the value of arts and cultural
performances by providing an <strong>avenue</strong> and a <strong>safe spacce</strong> for artists where they can freely discover and
hone their full potential.
            </p>
          </div>
          <div id="contact">
            <h2 className="text-2xl mb-3">Get In Touch</h2>
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold">{CONTACT_EMAIL}</a>
            <SocialLinks className="mt-4" />
          </div>
        </div>
      </section>
    </>
  );
}
