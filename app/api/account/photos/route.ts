import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_GALLERY_PHOTOS = 8;

export async function GET() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("actor_photos")
    .select("*")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: data });
}

export async function POST(req: NextRequest) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) || null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const db = createServiceClient();

  const { count } = await db
    .from("actor_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if ((count ?? 0) >= MAX_GALLERY_PHOTOS) {
    return NextResponse.json(
      { error: `You can have up to ${MAX_GALLERY_PHOTOS} gallery photos.` },
      { status: 409 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `actor-photos/${user.id}-gallery-${Date.now()}-${file.name}`;
  const { error: uploadError } = await db.storage
    .from("production-media")
    .upload(path, bytes, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = db.storage.from("production-media").getPublicUrl(path);
  const { data, error } = await db
    .from("actor_photos")
    .insert({
      profile_id: user.id,
      photo_url: urlData.publicUrl,
      caption,
      sort_order: count ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}
