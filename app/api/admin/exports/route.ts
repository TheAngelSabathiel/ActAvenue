import { NextRequest, NextResponse } from "next/server";
import { manilaDayStart, manilaDayEnd, formatDateTime, manilaToday } from "@/lib/datetime";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, canAccess, requireAnyAccess } from "@/lib/admin-auth";
import { isTransferred } from "@/lib/transfer";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // keeps spreadsheets from running text as formulas
  return `"${s.replace(/"/g, '""')}"`;
}
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";

/**
 * GET /api/admin/exports?kind=orders|participants
 *   &production_id=<id> | performance_id=<id>  &from=<date> &to=<date> (booking date)
 * orders: every ticket line of every booking, full registration details.
 * participants: confirmed bookings, one row per booking, with reference codes.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "participants" ? "participants" : "orders";
  const performanceId = sp.get("performance_id");
  let productionId = sp.get("production_id");
  const db = createServiceClient();

  let name = "all-productions";
  if (performanceId) {
    const { data: perf } = await db.from("performances").select("label, production_id, production:productions(title)").eq("id", performanceId).maybeSingle();
    if (!perf) return NextResponse.json({ error: "Show not found." }, { status: 404 });
    productionId = perf.production_id;
    name = `${slug(one(perf.production)?.title ?? "show")}-${slug(perf.label)}`;
  } else if (productionId) {
    const { data: prod } = await db.from("productions").select("title").eq("id", productionId).maybeSingle();
    name = slug(prod?.title ?? "production");
  }
  if (productionId && !canAccess(gate.access, productionId, "foh")) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  let q = db
    .from("reservations")
    .select(
      `id, reference_code, order_code, created_at, payment_status, rejection_reason, booking_source,
       buyer_name, buyer_email, buyer_phone, subtotal, discount_amount, total, promo_uses, checked_in,
       production:productions(title),
       performance:performances(label, datetime, venue),
       promo_code:promo_codes(code),
       reservation_items(quantity, unit_price, ticket_code, scans_used, ticket_tier:ticket_tiers(label, tier_type))`
    );
  if (performanceId) q = q.eq("performance_id", performanceId);
  else if (productionId) q = q.eq("production_id", productionId);
  else {
    const ids = accessibleProductionIds(gate.access, "foh");
    if (ids) q = q.in("production_id", ids);
  }
  if (kind === "participants") q = q.eq("payment_status", "confirmed");
  const from = sp.get("from");
  const to = sp.get("to");
  if (from) q = q.gte("created_at", manilaDayStart(from));
  if (to) q = q.lte("created_at", manilaDayEnd(to));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type R = NonNullable<typeof data>[number];
  const perfTime = (r: R) => new Date(one(r.performance)?.datetime ?? 0).getTime();
  const list = [...(data ?? [])].sort((a, b) => perfTime(a) - perfTime(b) || a.buyer_name.localeCompare(b.buyer_name));
  const status = (r: R) => (isTransferred(r.rejection_reason) ? "transferred" : r.payment_status);

  let rows: unknown[][];
  if (kind === "participants") {
    rows = [["Production", "Show", "Show date and time (PHT)", "Venue", "Participant", "Email", "Phone", "Tickets", "Total tickets", "Reference code", "Ticket codes", "Admitted", "Checked in"]];
    for (const r of list) {
      const items = r.reservation_items ?? [];
      const perf = one(r.performance);
      rows.push([
        one(r.production)?.title,
        perf?.label,
        perf ? formatDateTime(perf.datetime) : "",
        perf?.venue,
        r.buyer_name,
        r.buyer_email,
        r.buyer_phone,
        items.map((i) => `${i.quantity} x ${one(i.ticket_tier)?.label}`).join("; "),
        items.reduce((n, i) => n + i.quantity, 0),
        r.reference_code,
        items.map((i) => i.ticket_code).filter(Boolean).join("; "),
        `${items.reduce((n, i) => n + (i.scans_used ?? 0), 0)}/${items.reduce((n, i) => n + i.quantity, 0)}`,
        r.checked_in ? "Yes" : "No",
      ]);
    }
  } else {
    rows = [[
      "Order code", "Reference code", "Booked on (PHT)", "Status", "Source", "Production", "Show", "Show date and time (PHT)", "Venue",
      "Buyer", "Email", "Phone", "Ticket type", "Quantity", "Unit price", "Line total", "Ticket code", "Admitted",
      "Promo code", "Promo uses", "Booking discount", "Booking total",
    ]];
    for (const r of list) {
      const perf = one(r.performance);
      for (const i of r.reservation_items ?? []) {
        rows.push([
          r.order_code, r.reference_code, formatDateTime(r.created_at), status(r), r.booking_source,
          one(r.production)?.title, perf?.label, perf ? formatDateTime(perf.datetime) : "", perf?.venue,
          r.buyer_name, r.buyer_email, r.buyer_phone,
          one(i.ticket_tier)?.label, i.quantity, Number(i.unit_price).toFixed(2), (Number(i.unit_price) * i.quantity).toFixed(2),
          i.ticket_code, `${i.scans_used ?? 0}/${i.quantity}`,
          one(r.promo_code)?.code, r.promo_uses ?? "", Number(r.discount_amount).toFixed(2), Number(r.total).toFixed(2),
        ]);
      }
    }
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${name}-${manilaToday()}.csv"`,
    },
  });
}
