import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfPartner } from "@/lib/admin-scope";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfPartner(id), "manager");
  if (gate.error) return gate.error;
  const file = (await req.formData()).get("file") as File | null;
  if (!file || !file.type.startsWith("image/")) return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image is over 5 MB." }, { status: 400 });
  const db = createServiceClient();
  const { data: partner } = await db.from("production_partners").select("sponsor_level").eq("id", id).single();
  if (partner?.sponsor_level === "special_thanks") {
    return NextResponse.json({ error: "Special Thanks entries show names only, no logos." }, { status: 400 });
  }
  const path = `partners/${id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: upErr } = await db.storage
    .from("production-media")
    .upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: url } = db.storage.from("production-media").getPublicUrl(path);
  const { data, error } = await db.from("production_partners").update({ logo_url: url.publicUrl }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}
