import Link from "next/link";

export const CONTACT_EMAIL = "actavenue@gmail.com";

export const SOCIALS = [
  { name: "Facebook", icon: "bi-facebook", href: "https://www.facebook.com/actavenue/" },
  { name: "Instagram", icon: "bi-instagram", href: "https://www.instagram.com/act.avenue/?hl=en" },
  { name: "TikTok", icon: "bi-tiktok", href: "https://www.tiktok.com/@actavenue" },
];

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-4 text-2xl ${className}`}>
      {SOCIALS.map((s) => (
        <a
          key={s.name}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.name}
          className="inline-block transition-transform hover:-translate-y-1"
        >
          <i className={`bi ${s.icon}`} />
        </a>
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-black text-white py-12 mt-auto">
      <div className="aa-container text-center">
        <h3 className="mb-4 tracking-[0.12em]">ACT AVENUE</h3>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[0.08em] mb-6">
          <Link href="/#now-showing" className="hover:underline">Shows</Link>
          <Link href="/actors" className="hover:underline">Cast &amp; Crew</Link>
          <Link href="/account" className="hover:underline">My Tickets</Link>
          <Link href="/cart" className="hover:underline">Cart</Link>
        </nav>
        <SocialLinks className="justify-center mb-4" />
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm opacity-75 hover:opacity-100">{CONTACT_EMAIL}</a>
        <p className="text-xs opacity-50 mt-6 mb-0">© 2026 Act Avenue | Developed by TheAngelSabathiel</p>
      </div>
    </footer>
  );
}
