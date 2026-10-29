import { NextRequest, NextResponse } from "next/server";
import { cleanEmail } from "@/lib/mailing";
import { sendContactEmail } from "@/lib/email/send";

// Best-effort limit per visitor (resets when the server restarts): 5 messages an hour.
const hits = new Map<string, number[]>();
const WINDOW = 60 * 60 * 1000;
const MAX = 5;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Hidden field that only bots fill in.
  if (body.website) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= MAX) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
  }

  const name = text(body.name, 120);
  const email = cleanEmail(body.email);
  const phone = text(body.phone, 40);
  const subject = text(body.subject, 150).replace(/\n/g, " ");
  const message = text(body.message, 3000);

  if (!name || !subject || !message) {
    return NextResponse.json({ error: "Fill in your name, subject and message." }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (body.consent !== true) {
    return NextResponse.json({ error: "Please tick the Data Privacy box to send your message." }, { status: 400 });
  }

  try {
    await sendContactEmail({ name, email, phone, subject, message });
  } catch (err) {
    console.error("Contact email failed:", err);
    return NextResponse.json({ error: "Could not send your message right now. Please try again later." }, { status: 500 });
  }
  recent.push(now);
  hits.set(ip, recent);
  return NextResponse.json({ ok: true });
}
