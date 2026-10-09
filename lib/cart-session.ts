import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { Cart } from "@/types/database";

const COOKIE_NAME = "cart_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches carts.expires_at default

/** Gets the current cart for this browser session, creating one if needed. */
export async function getOrCreateCart(): Promise<Cart> {
  const cookieStore = await cookies();
  const db = createServiceClient();

  let token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const { data: existing } = await db
      .from("carts")
      .select("*")
      .eq("session_token", token)
      .eq("status", "active")
      .maybeSingle();

    if (existing) return existing as Cart;
  }

  token = randomUUID();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  const { data: created, error } = await db
    .from("carts")
    .insert({ session_token: token })
    .select("*")
    .single();

  if (error || !created) throw new Error(`Failed to create cart: ${error?.message}`);
  return created as Cart;
}
