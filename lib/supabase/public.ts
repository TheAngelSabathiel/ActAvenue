import { createClient } from "@supabase/supabase-js";

/**
 * Anonymous, cookie-free client for public pages. Because it never reads the
 * visitor's cookies, pages that use it can be saved by Vercel's CDN and served
 * without running a function. Row level security still applies, so it only ever
 * sees what the public may see.
 */
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
