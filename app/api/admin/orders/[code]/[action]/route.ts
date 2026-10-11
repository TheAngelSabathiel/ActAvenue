import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAnyAccess } from "@/lib/admin-auth";
import { POST as approve } from "@/app/api/admin/reservations/[id]/approve/route";
import { POST as reject } from "@/app/api/admin/reservations/[id]/reject/route";
import { POST as reopen } from "@/app/api/admin/reservations/[id]/reopen/route";

// One payment covers a whole order, so staff can approve, reject or reopen
// every booking in it at once. Each booking still goes through the same
// single-reservation logic (QR, emails, inventory) as the per-booking buttons.
const HANDLERS = { approve, reject, reopen } as const;
const FROM_STATUS = {
  approve: ["pending_review"],
  reject: ["pending_review"],
  reopen: ["rejected", "expired"],
} as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string; action: string }> }) {
  // Each booking is access-checked against its own production by the
  // single-reservation handlers below.
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;

  const { code, action } = await params;
  if (!(action in HANDLERS)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const key = action as keyof typeof HANDLERS;
  const body = await req.text();

  const db = createServiceClient();
  const { data: rows } = await db
    .from("reservations")
    .select("id, reference_code, payment_status")
    .eq("order_code", code)
    .in("payment_status", [...FROM_STATUS[key]]);

  const results: { reference_code: string; ok: boolean; error?: string }[] = [];
  for (const r of rows ?? []) {
    const res = await HANDLERS[key](
      new NextRequest(req.url, { method: "POST", headers: req.headers, body: body || undefined }),
      { params: Promise.resolve({ id: r.id }) }
    );
    const data = await res.json().catch(() => ({}));
    results.push({ reference_code: r.reference_code, ok: res.ok, error: data.error });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    return NextResponse.json(
      { error: `${failed.length} of ${results.length} failed: ${failed.map((f) => `${f.reference_code} (${f.error})`).join(", ")}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, count: results.length });
}
