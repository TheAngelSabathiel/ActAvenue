import Image from "next/image";
import Link from "next/link";
import { listPublishedProductions } from "@/lib/data/homepage";
import { IMAGES } from "@/lib/images";
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
          <div className="grid gap-6 md:grid-cols-2">
            {productions.map((p) => (
              <Link key={p.id} href={`/productions/${p.slug}`} className="aa-featured block">
                <Image
                  src={p.banner_url ?? p.poster_url ?? IMAGES.bannerPlaceholder}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="aa-featured-img"
                />
                <div className="aa-featured-overlay">
                  <h3 className="text-2xl text-white mb-1">{p.title}</h3>
                  {p.description && <p className="text-sm text-white line-clamp-2">{p.description}</p>}
                  <span className="aa-btn aa-btn-accent aa-btn-sm mt-2">Get Tickets</span>
                </div>
              </Link>
            ))}
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
              Act Avenue builds actors through the ABCD Framework, so every workshop and show has a clear structure:
            </p>
            <strong>Authenticity, Believability, Creativity, and Development.</strong>
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
