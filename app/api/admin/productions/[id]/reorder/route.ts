import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProduction } from "@/lib/admin-auth";
import { withRefresh } from "@/lib/refresh-public";

// POST { table: "credits" | "plays", ids: string[] }
// Sets sort_order from the position in `ids` (first = shown first).
const TABLES = { credits: "production_credits", plays: "production_plays" } as const;

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireProduction(id, "manager");
  if (gate.error) return gate.error;
  const { table, ids } = await req.json();
  if (!(table in TABLES) || !Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "table and ids are required" }, { status: 400 });
  }

  const db = createServiceClient();
  const results = await Promise.all(
    (ids as string[]).map((rowId, i) =>
      db
        .from(TABLES[table as keyof typeof TABLES])
        .update({ sort_order: (i + 1) * 10 })
        .eq("production_id", id)
        .eq(table === "plays" ? "play_id" : "id", rowId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const POST = withRefresh(handlePOST);
