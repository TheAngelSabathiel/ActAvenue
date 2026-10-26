import type { Metadata } from "next";
import { IMAGES } from "@/lib/images";

const clip = (s: string | null | undefined, n = 180) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Link preview details (Facebook, Messenger, Viber, X, iMessage) for one page. */
export function shareMetadata(opts: { title: string; description?: string | null; image?: string | null; path: string }): Metadata {
  const description = clip(opts.description) || "Tickets and stories from Act Avenue.";
  // Always give a preview image, so link previews never have to guess one.
  const image = opts.image || IMAGES.logo;
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
      images: [{ url: image, alt: opts.title }],
    },
    twitter: {
      card: opts.image ? "summary_large_image" : "summary",
      title: opts.title,
      description,
      images: [image],
    },
  };
}
