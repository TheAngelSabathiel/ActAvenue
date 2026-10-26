import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const UUID = /^[0-9a-f-]{36}$/i;

/** Unsubscribes by private token. Used by the unsubscribe page and by the one-click link mail apps show. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(req.nextUrl.searchParams.get("token") ?? body.token ?? "");
  if (!UUID.test(token)) return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  const { error } = await createServiceClient()
    .from("subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("token", token)
    .is("unsubscribed_at", null);
  if (error) return NextResponse.json({ error: "Could not unsubscribe. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
