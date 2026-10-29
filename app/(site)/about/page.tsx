import Link from "next/link";
import { CONTACT_EMAIL, SocialLinks } from "@/components/site-footer";

export const metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="aa-container max-w-3xl py-16 space-y-12">
      <div>
        <h1 className="text-4xl mb-2">About us</h1>
        <hr className="aa-divider" />
        <div className="border-l-[5px] border-black pl-6">
          <p className="text-lg mb-4">
            Founded in 2019, <strong>ACT AVENUE</strong> is a young, fast-running, and multi-awarded theater group in the
            country today.
          </p>
          <p className="text-lg mb-0">
            We aim to promote the value of arts and cultural performances by providing an <strong>avenue</strong> and a{" "}
            <strong>safe space</strong> for artists where they can freely discover and hone their full potential.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl mb-2">Explore</h2>
        <hr className="aa-divider" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/#now-showing" className="aa-card aa-lift p-5 block">
            <p className="font-black mb-1">Shows</p>
            <p className="text-sm text-muted mb-0">See what is on and book your seat.</p>
          </Link>
          <Link href="/plays" className="aa-card aa-lift p-5 block">
            <p className="font-black mb-1">Plays</p>
            <p className="text-sm text-muted mb-0">The stories we have staged.</p>
          </Link>
          <Link href="/actors" className="aa-card aa-lift p-5 block">
            <p className="font-black mb-1">Cast &amp; Crew</p>
            <p className="text-sm text-muted mb-0">Meet the people behind the shows.</p>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-2xl mb-2">Get in touch</h2>
        <hr className="aa-divider" />
        <p className="mb-4">
          Questions or want to work with us? Send a message or follow us.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/contact" className="aa-btn">Contact us</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold">{CONTACT_EMAIL}</a>
        </div>
        <SocialLinks className="mt-5" />
      </div>
    </div>
  );
}
