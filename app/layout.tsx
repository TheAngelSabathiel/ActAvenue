import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/lora/400.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/caveat/400.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { IMAGES } from "@/lib/images";
import { Toaster } from "@/components/toaster";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.actavenue.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Act Avenue", template: "%s | Act Avenue" },
  description: "Reserve tickets for upcoming Act Avenue productions.",
  openGraph: {
    type: "website",
    siteName: "Act Avenue",
    title: "Act Avenue",
    description: "Reserve tickets for upcoming Act Avenue productions.",
    images: [{ url: IMAGES.logo, alt: "Act Avenue" }],
  },
  twitter: { card: "summary", title: "Act Avenue", images: [IMAGES.logo] },
  icons: {
    icon: [{ url: IMAGES.logo, type: "image/png" }],
    shortcut: IMAGES.logo,
    apple: IMAGES.logo,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="aa-page min-h-screen flex flex-col text-black"
        style={{ backgroundImage: `url(${IMAGES.background})` }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
