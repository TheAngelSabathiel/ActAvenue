import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { productionOfReservation } from "@/lib/admin-scope";

/** Redirects staff to a short-lived link for the ID a buyer uploaded. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(await productionOfReservation(id), "foh");
  if (gate.error) return gate.error;
  const itemId = req.nextUrl.searchParams.get("item");
  const db = createServiceClient();
  const { data: item } = await db
    .from("reservation_items")
    .select("id_proof_path")
    .eq("id", itemId ?? "")
    .eq("reservation_id", id)
    .maybeSingle();
  if (!item?.id_proof_path) return NextResponse.json({ error: "No ID on file." }, { status: 404 });
  const { data, error } = await db.storage.from("id-proofs").createSignedUrl(item.id_proof_path, 300);
  if (error || !data) return NextResponse.json({ error: "Could not open the ID." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
