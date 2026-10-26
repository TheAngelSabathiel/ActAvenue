import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { cleanEmail, subscribe } from "@/lib/mailing";

const setupHint = (m: string) =>
  /subscribers|mailing_campaigns|schema cache|does not exist/i.test(m)
    ? "The mailing list is not set up yet. Run supabase/migration-dashboard-mailing.sql in the Supabase SQL Editor."
    : m;

export async function GET() {
  const authError = await requireStaff();
  if (authError) return authError;
  const db = createServiceClient();
  const [subs, campaigns] = await Promise.all([
    db.from("subscribers").select("id, email, name, source, subscribed_at, unsubscribed_at").order("subscribed_at", { ascending: false }),
    db.from("mailing_campaigns").select("id, subject, sent_count, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (subs.error) return NextResponse.json({ error: setupHint(subs.error.message) }, { status: 500 });
  return NextResponse.json({ subscribers: subs.data ?? [], campaigns: campaigns.data ?? [] });
}

/** Add someone by hand, for example a person who asked in person. */
export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;
  const body = await req.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    await subscribe(createServiceClient(), { email, name: typeof body.name === "string" ? body.name : null, source: "manual" });
  } catch (err) {
    return NextResponse.json({ error: setupHint(err instanceof Error ? err.message : "Could not add.") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error } = await createServiceClient().from("subscribers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
