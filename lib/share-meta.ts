import type { Metadata } from "next";

const clip = (s: string | null | undefined, n = 180) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Link preview details (Facebook, Messenger, Viber, X, iMessage) for one page. */
export function shareMetadata(opts: { title: string; description?: string | null; image?: string | null; path: string }): Metadata {
  const description = clip(opts.description) || "Tickets and stories from Act Avenue.";
  return {
    title: opts.title,
    description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: "website",
      siteName: "Act Avenue",
      title: opts.title,
      description,
      url: opts.path,
      ...(opts.image ? { images: [{ url: opts.image, alt: opts.title }] } : {}),
    },
    twitter: {
      card: opts.image ? "summary_large_image" : "summary",
      title: opts.title,
      description,
      ...(opts.image ? { images: [opts.image] } : {}),
    },
  };
}
