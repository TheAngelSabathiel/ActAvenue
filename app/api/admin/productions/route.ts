import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET() {
  const authError = await requireStaff();
  if (authError) return authError;

  const db = createServiceClient();
  const { data, error } = await db
    .from("productions")
    .select("id, title, slug, status, poster_url, banner_url")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ productions: data });
}

export async function POST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { title, description, organization_id } = await req.json();
  if (!title || !organization_id) {
    return NextResponse.json({ error: "title and organization_id are required" }, { status: 400 });
  }

  const db = createServiceClient();
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;

  // Ensure slug uniqueness
  while (true) {
    const { data: clash } = await db.from("productions").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const { data, error } = await db
    .from("productions")
    .insert({ title, description: description ?? null, organization_id, slug, status: "draft" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ production: data });
}
