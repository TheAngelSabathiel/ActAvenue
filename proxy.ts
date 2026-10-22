import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Required by @supabase/ssr: without this, the session cookie set at login
// never gets refreshed on subsequent requests, so admins can get silently
// logged out mid-session even though their refresh token is still valid.
// See https://supabase.com/docs/guides/auth/server-side/nextjs
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually triggers the refresh when the
  // access token is stale - just reading cookies isn't enough.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  // Only routes that need the signed-in session. Public pages skip this so the
  // CDN can serve them without waiting on a session check.
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/account/:path*",
    "/checkout/:path*",
    "/cart/:path*",
    "/reservation/:path*",
    "/order/:path*",
    "/t/:path*",
  ],
};
