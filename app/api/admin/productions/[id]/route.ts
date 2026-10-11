import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db.from("productions").select("*").eq("id", id).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ production: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const allowed = ["title", "description", "poster_url", "banner_url", "status"] as const;
  const paymentFields = [
    "gcash_name", "gcash_number", "bank_name", "bank_account_name", "bank_account_number",
  ] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  // Blank payment fields clear back to the site default.
  for (const key of paymentFields) {
    if (key in body) update[key] = typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("productions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ production: data });
}
