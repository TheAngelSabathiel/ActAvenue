import { NextRequest, NextResponse } from "next/server";
import { validateImageFile, safeFileName } from "@/lib/upload";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  const invalid = validateImageFile(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const db = createServiceClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Timestamp in the path gives each upload a fresh URL, so a replaced
  // photo shows immediately instead of a cached copy of the old one.
  const path = `actor-photos/${user.id}-${Date.now()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await db.storage
    .from("production-media")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = db.storage.from("production-media").getPublicUrl(path);
  const { data, error } = await db
    .from("profiles")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

/** Clears the main profile photo. The old file stays in storage. */
export async function DELETE() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db.from("profiles").update({ photo_url: null }).eq("id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
