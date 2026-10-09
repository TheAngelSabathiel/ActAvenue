import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Act Avenue",
  description: "Reserve tickets for upcoming Act Avenue productions.",
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
      </body>
    </html>
  );
}
