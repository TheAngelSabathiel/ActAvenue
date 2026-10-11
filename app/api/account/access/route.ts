import { NextResponse } from "next/server";
import { getAccess } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/service";

/** What the signed-in person can manage. Drives the admin nav and the site header link. */
export async function GET() {
  const access = await getAccess();
  if (!access) return NextResponse.json({ signedIn: false, isAdmin: false, assignments: [] });

  const ids = Object.keys(access.assignments);
  let titles = new Map<string, string>();
  if (ids.length) {
    const { data } = await createServiceClient().from("productions").select("id, title").in("id", ids);
    titles = new Map((data ?? []).map((p) => [p.id, p.title]));
  }
  const assignments = ids
    .map((id) => ({ production_id: id, title: titles.get(id) ?? "Production", role: access.assignments[id] }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({ signedIn: true, isAdmin: access.isAdmin, assignments });
}
