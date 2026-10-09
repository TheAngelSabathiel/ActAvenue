import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

export async function GET() {
  const authError = await requireStaff();
  if (authError) return authError;

  const db = createServiceClient();
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organizations: data });
}

export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { name, logo_url } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("organizations")
    .insert({ name, logo_url: logo_url || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organization: data });
}
