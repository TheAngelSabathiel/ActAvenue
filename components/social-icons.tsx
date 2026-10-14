import { SOCIALS, socialHref, socialText, type SocialKey } from "@/lib/social-links";

const PATHS: Record<SocialKey, React.ReactNode> = {
  contact_email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </>
  ),
  facebook_url: (
    <path
      fill="currentColor"
      d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.3c0-.8.2-1.4 1.4-1.4h1.5V5.4c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.700V11H8.300v2.800h2.400V21h2.800Z"
    />
  ),
  instagram_url: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.500" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.700" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.800" cy="7.200" r="1.100" fill="currentColor" />
    </>
  ),
  x_url: <path fill="currentColor" d="M17.800 4h2.900l-6.300 7.200L21.800 20h-5.800l-4.500-5.900L6.300 20H3.400l6.700-7.700L2.900 4h5.900l4.100 5.400L17.800 4Zm-1 14.300h1.600L7.900 5.600H6.200l10.600 12.700Z" />,
  tiktok_url: (
    <path
      fill="currentColor"
      d="M16.600 3h-2.900v11.600a2.500 2.500 0 1 1-2.500-2.500c.3 0 .5 0 .8.100V9.200a5.400 5.400 0 1 0 4.600 5.400V9.100a6.500 6.500 0 0 0 3.800 1.200V7.400A3.800 3.800 0 0 1 16.600 3Z"
    />
  ),
};

export function SocialIcon({ name, className = "h-5 w-5" }: { name: SocialKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Icon then link, one per row. Renders nothing when no links are filled in. */
export function SocialLinksList({ values }: { values: Partial<Record<SocialKey, string | null>> }) {
  const rows = SOCIALS.filter((s) => values[s.key]);
  if (rows.length === 0) return null;
  return (
    <ul className="mt-6 space-y-2 text-left inline-block">
      {rows.map((s) => {
        const value = values[s.key] as string;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <SocialIcon name={s.key} />
            <a
              href={socialHref(s.key, value)}
              target={s.key === "contact_email" ? undefined : "_blank"}
              rel="noreferrer noopener"
              className="text-sm font-bold underline break-all"
              aria-label={`${s.label}: ${socialText(s.key, value)}`}
            >
              {socialText(s.key, value)}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
