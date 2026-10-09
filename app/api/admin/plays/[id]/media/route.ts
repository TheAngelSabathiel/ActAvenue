import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { safeFileName } from "@/lib/upload";

const MAX = 5 * 1024 * 1024;

// POST /api/admin/plays/[id]/media  (form field "file") sets the display photo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const file = (await req.formData()).get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Image is over 5 MB." }, { status: 400 });

  const db = createServiceClient();
  // Timestamped path gives each replacement a fresh URL (no stale cache).
  const path = `plays/${id}-${Date.now()}-${safeFileName(file.name)}`;
  const { error: upErr } = await db.storage
    .from("production-media")
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: url } = db.storage.from("production-media").getPublicUrl(path);
  const { data, error } = await db.from("plays").update({ photo_url: url.publicUrl }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ play: data });
}

// DELETE clears the photo so the site shows the placeholder.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createServiceClient();
  const { data, error } = await db.from("plays").update({ photo_url: null }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ play: data });
}
