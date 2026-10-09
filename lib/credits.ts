export type CreditSection = "artistic" | "production";
export type CreditType = "writer" | "director" | "actor";

export const CREDIT_TYPE_RANK: Record<CreditType, number> = { writer: 0, director: 1, actor: 2 };
export const CREDIT_TYPE_LABEL: Record<CreditType, string> = { writer: "Writer", director: "Director", actor: "Actor" };

/** Role text used when a writer or director credit is saved without one. */
export function defaultRole(type: CreditType | null | undefined) {
  return type ? CREDIT_TYPE_LABEL[type] : "";
}
