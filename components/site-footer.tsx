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
    <footer className="bg-black text-white py-10 mt-auto">
      <div className="aa-container text-center">
        <h3 className="mb-1 tracking-[0.12em]">ACT AVENUE</h3>
        <p className="text-sm opacity-75 mb-5">Ang Paborito Mong Tambayan.</p>
        <SocialLinks className="justify-center !text-3xl !gap-6 mb-5" />
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm opacity-75 hover:opacity-100">{CONTACT_EMAIL}</a>
        <p className="text-xs opacity-50 mt-6 mb-0">© 2026 Act Avenue | Developed by TheAngelSabathiel</p>
      </div>
    </footer>
  );
}
