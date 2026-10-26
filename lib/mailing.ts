import type { SupabaseClient } from "@supabase/supabase-js";
import type { BulkMessage } from "@/lib/email/send";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanEmail(v: unknown): string | null {
  const e = String(v ?? "").trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/** Adds someone to the list, or re-subscribes them if they had left. */
export async function subscribe(db: SupabaseClient, input: { email: string; name?: string | null; source: "footer" | "checkout" | "manual" }) {
  const email = cleanEmail(input.email);
  if (!email) return false;
  const { data: existing } = await db.from("subscribers").select("id, name").ilike("email", email).maybeSingle();
  if (existing) {
    await db
      .from("subscribers")
      .update({ unsubscribed_at: null, name: existing.name ?? input.name ?? null })
      .eq("id", existing.id);
  } else {
    await db.from("subscribers").insert({ email, name: input.name?.trim() || null, source: input.source });
  }
  return true;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/** Plain text to simple HTML: paragraphs, line breaks and clickable links. */
function bodyHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`)
    .join("\n");
}

export function campaignMessage(subject: string, body: string, to: string, token: string): BulkMessage {
  const unsubPage = `${siteUrl()}/unsubscribe/${token}`;
  return {
    to,
    subject,
    html: `${bodyHtml(body)}\n<hr style="margin:24px 0;border:0;border-top:1px solid #ddd">\n<p style="font-size:12px;color:#666">You get this because you signed up for Act Avenue news. <a href="${unsubPage}">Unsubscribe</a></p>`,
    text: `${body}\n\n--\nYou get this because you signed up for Act Avenue news. Unsubscribe: ${unsubPage}`,
    headers: {
      "List-Unsubscribe": `<${siteUrl()}/api/unsubscribe?token=${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
