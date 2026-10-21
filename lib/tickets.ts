import type { createServiceClient } from "@/lib/supabase/service";
import { generateQrPngBuffer } from "@/lib/qr";
import { ticketQrText } from "@/lib/ticket-code";
import type { ReservationItem, TicketTier } from "@/types/database";

type Db = ReturnType<typeof createServiceClient>;
export type TicketItem = ReservationItem & { ticket_tier: TicketTier };

/**
 * Makes sure every ticket line of a reservation has its own code and QR.
 * One QR per ticket type per show; it scans as many times as the quantity.
 * Safe to call again: lines that already have a QR are left alone.
 */
export async function ensureTicketQrs(db: Db, reservationId: string, referenceCode: string): Promise<TicketItem[]> {
  const { data } = await db
    .from("reservation_items")
    .select("*, ticket_tier:ticket_tiers(*)")
    .eq("reservation_id", reservationId)
    .order("id", { ascending: true });
  const items = (data ?? []) as TicketItem[];

  let n = items.filter((i) => i.ticket_code).length;
  for (const item of items) {
    if (!item.ticket_code) {
      n += 1;
      item.ticket_code = `${referenceCode}-${n}`;
      await db.from("reservation_items").update({ ticket_code: item.ticket_code }).eq("id", item.id);
    }
    if (!item.qr_code_url) {
      const buffer = await generateQrPngBuffer(ticketQrText(item.ticket_code));
      const path = `qr-codes/${item.ticket_code}.png`;
      const { error } = await db.storage.from("e-tickets").upload(path, buffer, { contentType: "image/png", upsert: true });
      if (error) throw new Error(error.message);
      item.qr_code_url = db.storage.from("e-tickets").getPublicUrl(path).data.publicUrl;
      await db.from("reservation_items").update({ qr_code_url: item.qr_code_url }).eq("id", item.id);
    }
  }
  if (items[0]?.qr_code_url) {
    await db.from("reservations").update({ qr_code_url: items[0].qr_code_url }).eq("id", reservationId);
  }
  return items;
}
