import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const allowed = ["label", "datetime", "venue", "capacity"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("performances")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ performance: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();

  // Guard against deleting a performance that already has reservations -
  // per the no-hard-deletes rule, bookings must always be traceable to a
  // real performance record.
  const { count } = await db
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("performance_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Can't delete a performance with existing reservations." },
      { status: 409 }
    );
  }

  const { error } = await db.from("performances").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
