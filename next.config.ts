import type { NextConfig } from "next";

// next/image requires every external image host to be explicitly allow-listed.
// This app renders posters, banners, org logos, and QR codes from Supabase
// Storage public URLs (production_media / e-tickets / payment-proofs buckets),
// so those hosts need to be here or every <Image> using them will throw at
// runtime with "hostname is not configured under images".
function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseHostname();

const nextConfig: NextConfig = {
  images: {
    // Fewer sizes and one format means fewer image transformations on Vercel
    // (the free tier allows 5,000 a month), and a long cache means each is made once.
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 31,
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [64, 128, 256, 384],
    remotePatterns: [
      // Covers the actual project host from env when set at build time.
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
      // Fallback: hosted Supabase's standard domain pattern, in case
      // NEXT_PUBLIC_SUPABASE_URL isn't available at build time (e.g. some
      // CI setups only inject env vars at runtime, not build time).
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
