import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireStaff } from "@/lib/admin-auth";
import { withRefresh } from "@/lib/refresh-public";

/** Sets the landing page carousel order. POST { ids: string[] } first to last. */
async function handlePOST(req: NextRequest) {
  const authError = await requireStaff();
  if (authError) return authError;

  const { ids } = await req.json().catch(() => ({ ids: null }));
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return NextResponse.json({ error: "ids must be a list of production ids." }, { status: 400 });
  }

  const db = createServiceClient();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await db.from("productions").update({ carousel_order: i * 10 }).eq("id", ids[i]);
    if (error) {
      const message = /carousel_order/.test(error.message)
        ? "Run supabase/migration-carousel-order.sql in the Supabase SQL Editor first."
        : error.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

export const POST = withRefresh(handlePOST);
