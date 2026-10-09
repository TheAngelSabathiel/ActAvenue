import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const status = req.nextUrl.searchParams.get("status"); // optional filter
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const db = createServiceClient();

  let query = db
    .from("reservations")
    .select(
      "*, production:productions(title), performance:performances(label, datetime), reservation_items(*, ticket_tier:ticket_tiers(label))",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("payment_status", status);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    reservations: data,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 1,
    },
  });
}
