import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanEmail, subscribe } from "@/lib/mailing";

/** Public sign up for show news. Always answers the same, so it cannot be used to check who is on the list. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Hidden field that only bots fill in.
  if (body.website) return NextResponse.json({ ok: true });
  if (body.consent !== true) return NextResponse.json({ error: "Please tick the Data Privacy box to subscribe." }, { status: 400 });
  const email = cleanEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    await subscribe(createServiceClient(), { email, name: typeof body.name === "string" ? body.name.slice(0, 120) : null, source: "footer" });
  } catch (err) {
    console.error("Subscribe failed:", err);
    return NextResponse.json({ error: "Could not sign you up right now. Try again later." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
