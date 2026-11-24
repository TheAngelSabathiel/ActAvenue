import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { requireProduction } from "@/lib/admin-auth";
import { sendBulkEmails, updateMessage } from "@/lib/email/send";

export const maxDuration = 60;

type Status = "confirmed" | "pending_review";

/** Bookings with an email for the chosen shows of this production. */
async function recipients(productionId: string, performanceIds: string[] | null, statuses: Status[]) {
  const db = createServiceClient();
  let q = db
    .from("reservations")
    .select("*, performance:performances(*), items:reservation_items(*, ticket_tier:ticket_tiers(*))")
    .eq("production_id", productionId)
    .in("payment_status", statuses)
    .not("buyer_email", "is", null)
    .order("created_at", { ascending: true });
  if (performanceIds) q = q.in("performance_id", performanceIds);
  const { data, error } = await q;
  return { rows: (data ?? []).filter((r) => String(r.buyer_email ?? "").trim()), error };
}

/** GET: how many bookings per show would get an update. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const { rows, error } = await recipients(id, null, ["confirmed", "pending_review"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts: Record<string, { confirmed: number; pending: number }> = {};
  for (const r of rows) {
    const c = (counts[r.performance_id] ??= { confirmed: 0, pending: 0 });
    if (r.payment_status === "confirmed") c.confirmed++;
    else c.pending++;
  }
  return NextResponse.json({ counts });
}

/**
 * POST { performance_ids, message, include_pending, with_qr, test? }
 * Emails everyone booked for those shows, one email per booking, under the
 * same subject as the booking email they already have. test sends one sample
 * (built from the first booking) to the signed-in staff member only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  const performanceIds: string[] = Array.isArray(body.performance_ids) ? body.performance_ids.map(String) : [];
  const statuses: Status[] = body.include_pending ? ["confirmed", "pending_review"] : ["confirmed"];
  const withQr = body.with_qr !== false;
  if (!message) return NextResponse.json({ error: "Write the update first." }, { status: 400 });
  if (message.length > 8000) return NextResponse.json({ error: "That is too long." }, { status: 400 });
  if (!performanceIds.length) return NextResponse.json({ error: "Pick at least one show." }, { status: 400 });

  const db = createServiceClient();
  const { data: production } = await db.from("productions").select("*").eq("id", id).single();
  if (!production) return NextResponse.json({ error: "Production not found" }, { status: 404 });

  const { rows, error } = await recipients(id, performanceIds, statuses);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows.length) return NextResponse.json({ error: "Nobody with an email is booked for those shows." }, { status: 400 });

  const ctx = (r: (typeof rows)[number]) => ({
    reservation: r,
    production,
    performance: Array.isArray(r.performance) ? r.performance[0] : r.performance,
    items: r.items ?? [],
  });

  try {
    if (body.test) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return NextResponse.json({ error: "Your account has no email to send a test to." }, { status: 400 });
      const sample = rows.find((r) => r.payment_status === "confirmed") ?? rows[0];
      await sendBulkEmails([updateMessage(ctx(sample), message, { withQr, to: user.email, test: true })]);
      return NextResponse.json({ ok: true, sent: 1, to: user.email });
    }
    const sent = await sendBulkEmails(rows.map((r) => updateMessage(ctx(r), message, { withQr })));
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("Show update failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send." }, { status: 500 });
  }
}
