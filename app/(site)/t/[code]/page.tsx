import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccess, canAccess } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { parseScanned } from "@/lib/ticket-code";

export const metadata = { title: "Act Avenue", robots: { index: false } };

/**
 * What a phone camera opens when it scans a ticket QR. Shows nothing private.
 * Door staff who are signed in go straight to the scanner with this ticket.
 */
export default async function TicketLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = parseScanned(decodeURIComponent(raw));

  const access = await getAccess();
  if (access) {
    const { data: item } = await createServiceClient()
      .from("reservation_items")
      .select("reservation:reservations(production_id)")
      .eq("ticket_code", code)
      .maybeSingle();
    const res = Array.isArray(item?.reservation) ? item?.reservation[0] : item?.reservation;
    if (res && canAccess(access, res.production_id, "scanner")) {
      redirect(`/admin/scan?code=${encodeURIComponent(code)}`);
    }
  }

  return (
    <div className="aa-container py-20 text-center max-w-md">
      <h1 className="text-3xl mb-3">Act Avenue</h1>
      <p className="text-lg">This is an e-ticket QR code. Show it at the door of the show.</p>
      <p className="text-sm text-muted">Only door staff can scan it. Scanning it with your own phone does not use up your ticket.</p>
      <Link href="/admin/login" className="aa-btn aa-btn-outline aa-btn-sm mt-4">Staff sign in</Link>
    </div>
  );
}
