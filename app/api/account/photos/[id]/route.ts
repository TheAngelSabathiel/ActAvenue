import { NextRequest, NextResponse } from "next/server";
import { validateImageFile, safeFileName } from "@/lib/upload";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function checkOwnership(db: ReturnType<typeof createServiceClient>, photoId: string, userId: string) {
  const { data: photo } = await db.from("actor_photos").select("profile_id").eq("id", photoId).maybeSingle();
  if (!photo) return { ok: false, status: 404, error: "Photo not found." };

  if (photo.profile_id !== userId) {
    const { data: profile } = await db.from("profiles").select("role").eq("id", userId).single();
    if (!profile || !["admin", "organizer"].includes(profile.role)) {
      return { ok: false, status: 403, error: "Not authorized." };
    }
  }
  return { ok: true };
}

/** Used to reorder a gallery - sets this photo's sort_order directly. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const { sort_order } = await req.json();
  if (typeof sort_order !== "number") {
    return NextResponse.json({ error: "sort_order must be a number" }, { status: 400 });
  }

  const db = createServiceClient();
  const ownership = await checkOwnership(db, id, user.id);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  const { data, error } = await db
    .from("actor_photos")
    .update({ sort_order })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const db = createServiceClient();

  const ownership = await checkOwnership(db, id, user.id);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  const { error } = await db.from("actor_photos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Replaces the image of an existing gallery photo, keeping its position and caption. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  const invalid = validateImageFile(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const db = createServiceClient();
  const ownership = await checkOwnership(db, id, user.id);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `actor-photos/${user.id}-gallery-${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await db.storage
    .from("production-media")
    .upload(path, bytes, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = db.storage.from("production-media").getPublicUrl(path);
  const { data, error } = await db
    .from("actor_photos")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}
