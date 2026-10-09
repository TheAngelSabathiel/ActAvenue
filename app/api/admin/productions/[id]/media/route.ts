import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";

// POST /api/admin/productions/[id]/media  (form field "file", "kind" = "poster" | "banner")
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const kind = formData.get("kind") as string;

  if (!file || !["poster", "banner"].includes(kind)) {
    return NextResponse.json({ error: "file and kind (poster|banner) are required" }, { status: 400 });
  }

  const db = createServiceClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image is over 5 MB." }, { status: 400 });
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Timestamp in the path gives every upload a fresh URL, so replacements
  // show immediately instead of serving a cached copy of the old image.
  const path = `${kind}s/${id}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await db.storage
    .from("production-media")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = db.storage.from("production-media").getPublicUrl(path);
  const column = kind === "poster" ? "poster_url" : "banner_url";

  const { data, error } = await db
    .from("productions")
    .update({ [column]: urlData.publicUrl })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ production: data });
}

// DELETE /api/admin/productions/[id]/media?kind=poster|banner
// Clears the image so the site falls back to the default placeholder.
// The old file stays in storage (no hard deletes).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("kind");
  if (!kind || !["poster", "banner"].includes(kind)) {
    return NextResponse.json({ error: "kind (poster|banner) is required" }, { status: 400 });
  }

  const db = createServiceClient();
  const column = kind === "poster" ? "poster_url" : "banner_url";
  const { data, error } = await db.from("productions").update({ [column]: null }).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ production: data });
}
