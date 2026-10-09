import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const allowed = [
    "label",
    "price",
    "quantity_available",
    "is_discount_tier",
    "discount_valid_from",
    "discount_valid_until",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("ticket_tiers")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();

  const { count } = await db
    .from("reservation_items")
    .select("id", { count: "exact", head: true })
    .eq("ticket_tier_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Can't delete a tier that already has reservations against it." },
      { status: 409 }
    );
  }

  const { error } = await db.from("ticket_tiers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
