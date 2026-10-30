import { idPaths } from "@/lib/id-proofs";
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
    .select("id_proof_path, id_proof_paths")
    .eq("id", itemId ?? "")
    .eq("reservation_id", id)
    .maybeSingle();
  // `n` is which ID of the line to open (1 is the first).
  const n = Math.max(1, Number(req.nextUrl.searchParams.get("n")) || 1);
  const path = item ? idPaths(item)[n - 1] : undefined;
  if (!path) return NextResponse.json({ error: "No ID on file." }, { status: 404 });
  const { data, error } = await db.storage.from("id-proofs").createSignedUrl(path, 300);
  if (error || !data) return NextResponse.json({ error: "Could not open the ID." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
