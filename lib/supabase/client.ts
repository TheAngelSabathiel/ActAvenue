import { createBrowserClient } from "@supabase/ssr";

// Used in Client Components. Only ever talks to Supabase with the anon key,
// so it's bound by the RLS policies in supabase/schema.sql.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
