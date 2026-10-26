import type { SupabaseClient } from "@supabase/supabase-js";

/** Records an admit for the staff check-in report. Never blocks the door if logging fails. */
export async function logScan(
  db: SupabaseClient,
  entry: {
    reservation_id: string;
    performance_id: string | null;
    production_id: string | null;
    ticket_code?: string | null;
    admitted: number;
    source: "scan" | "manual";
    override?: boolean;
    scanned_by: string;
  }
) {
  try {
    await db.from("scan_log").insert({ ...entry, ticket_code: entry.ticket_code ?? null, override: entry.override ?? false });
  } catch (err) {
    console.error("Could not write scan log:", err);
  }
}
