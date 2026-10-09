// Client-safe helper mirroring supabase/schema.sql's generate_reference_code().
// The DB function is the source of truth (used on insert); this is only for
// any client-side preview/formatting needs, e.g. showing "e.g. K7XPTQ2" copy.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 ambiguity

export function formatReferenceCode(code: string): string {
  return code.toUpperCase().trim();
}

export function isValidReferenceCodeFormat(code: string): boolean {
  const c = code.toUpperCase().trim();
  if (c.length !== 7) return false;
  return [...c].every((ch) => CHARS.includes(ch));
}
