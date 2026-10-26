import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin-auth";
import { sendBulkEmails } from "@/lib/email/send";
import { campaignMessage } from "@/lib/mailing";

export const maxDuration = 60;

/**
 * POST { subject, body, test? }
 * test: true sends only to the signed-in admin. Otherwise sends to everyone
 * still subscribed, and records the announcement.
 */
export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { subject, body, test } = await req.json().catch(() => ({}));
  const subj = String(subject ?? "").trim();
  const text = String(body ?? "").trim();
  if (!subj || !text) return NextResponse.json({ error: "Add a subject and a message." }, { status: 400 });
  if (subj.length > 150 || text.length > 8000) return NextResponse.json({ error: "That is too long." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    if (test) {
      if (!user?.email) return NextResponse.json({ error: "Your account has no email to send a test to." }, { status: 400 });
      await sendBulkEmails([campaignMessage(`[Test] ${subj}`, text, user.email, "00000000-0000-0000-0000-000000000000")]);
      return NextResponse.json({ ok: true, sent: 1, to: user.email });
    }

    const db = createServiceClient();
    const { data: subs, error } = await db.from("subscribers").select("email, token").is("unsubscribed_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs?.length) return NextResponse.json({ error: "Nobody is subscribed yet." }, { status: 400 });

    const sent = await sendBulkEmails(subs.map((s) => campaignMessage(subj, text, s.email, s.token)));
    await db.from("mailing_campaigns").insert({ subject: subj, body: text, sent_count: sent, sent_by: user?.id ?? null });
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("Announcement failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send." }, { status: 500 });
  }
}
