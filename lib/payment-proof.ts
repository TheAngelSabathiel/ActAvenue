import type { SupabaseClient } from "@supabase/supabase-js";

export const PROOF_MAX_BYTES = 8 * 1024 * 1024;

/** Uploads a payment proof image/PDF to the payment-proofs bucket and returns its URL. */
export async function uploadPaymentProof(
  db: SupabaseClient,
  reservationKey: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  if (file.size > PROOF_MAX_BYTES) return { error: "Proof must be 8 MB or smaller." };
  if (!/^image\/|^application\/pdf$/.test(file.type)) return { error: "Proof must be an image or PDF." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `payment-proofs/${reservationKey}-${Date.now()}-${safeName}`;
  const { error } = await db.storage.from("payment-proofs").upload(path, bytes, { contentType: file.type });
  if (error) return { error: error.message };
  return { url: db.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl };
}
