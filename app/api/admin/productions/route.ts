import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { accessibleProductionIds, requireAnyAccess, requireStaff } from "@/lib/admin-auth";
import { withRefresh } from "@/lib/refresh-public";

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET() {
  const gate = await requireAnyAccess("foh");
  if (gate.error) return gate.error;

  // Managers and FOH only see the productions they are assigned to.
  const ids = accessibleProductionIds(gate.access, "foh");
  const db = createServiceClient();
  let query = db
    .from("productions")
    .select("*")
    .order("created_at", { ascending: false });
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ productions: data });
}

async function handlePOST(req: NextRequest) {
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

export const POST = withRefresh(handlePOST);
