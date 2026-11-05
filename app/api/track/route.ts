import { NextRequest, NextResponse } from "next/server";
import { logFunnel } from "@/lib/funnel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

/** POST /api/track { event: "visit" | "production_view", production_id?, visitor_id } */
export async function POST(req: NextRequest) {
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  let body: { event?: string; production_id?: string; visitor_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const { event, production_id, visitor_id } = body;
  if (event !== "visit" && event !== "production_view") return new NextResponse(null, { status: 204 });
  if (!visitor_id || visitor_id.length < 8 || visitor_id.length > 64) return new NextResponse(null, { status: 204 });
  if (event === "production_view" && !(production_id && UUID.test(production_id))) return new NextResponse(null, { status: 204 });
  await logFunnel(event, event === "visit" ? null : production_id!, visitor_id);
  return new NextResponse(null, { status: 204 });
}
