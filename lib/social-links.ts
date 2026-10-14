export const SOCIALS = [
  { key: "contact_email", label: "Email", placeholder: "you@example.com" },
  { key: "facebook_url", label: "Facebook", placeholder: "facebook.com/yourname" },
  { key: "instagram_url", label: "Instagram", placeholder: "@yourhandle" },
  { key: "x_url", label: "X", placeholder: "@yourhandle" },
  { key: "tiktok_url", label: "TikTok", placeholder: "@yourhandle" },
] as const;

export type SocialKey = (typeof SOCIALS)[number]["key"];

const HOSTS: Record<Exclude<SocialKey, "contact_email">, string> = {
  facebook_url: "https://facebook.com/",
  instagram_url: "https://instagram.com/",
  x_url: "https://x.com/",
  tiktok_url: "https://tiktok.com/@",
};

/**
 * Turns what a person typed (a link, a bare domain link, or a handle) into a
 * safe https link, or an email into a bare address. Returns null when empty
 * and undefined when the value is not acceptable.
 */
export function normalizeSocial(key: SocialKey, raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 200) return undefined;

  if (key === "contact_email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined;
  }

  if (/^https?:\/\//i.test(v)) {
    try {
      return new URL(v).toString();
    } catch {
      return undefined;
    }
  }
  if (/^[\w-]+(\.[\w-]+)+\//.test(v) || /^(www\.)?(facebook|instagram|x|twitter|tiktok)\.com/i.test(v)) {
    try {
      return new URL(`https://${v}`).toString();
    } catch {
      return undefined;
    }
  }
  const handle = v.replace(/^@/, "");
  if (!/^[\w.-]+$/.test(handle)) return undefined;
  return `${HOSTS[key]}${handle}`;
}

/** What to show next to the icon. */
export function socialText(key: SocialKey, value: string): string {
  if (key === "contact_email") return value;
  try {
    const u = new URL(value);
    const path = u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return value;
  }
}

export function socialHref(key: SocialKey, value: string): string {
  return key === "contact_email" ? `mailto:${value}` : value;
}
