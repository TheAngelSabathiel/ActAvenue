import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY. Never import this into a Client Component or expose the key
// to the browser. This bypasses RLS, which is exactly why checkout,
// promo-code validation, inventory holds, and admin actions all route
// through server code that uses this client instead of the anon client.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
