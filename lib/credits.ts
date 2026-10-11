export type CreditSection = "artistic" | "production";
export type CreditType = "writer" | "director" | "actor" | "choreographer" | "dancer";

export const CREDIT_TYPES: CreditType[] = ["writer", "director", "actor", "choreographer", "dancer"];
export const CREDIT_TYPE_RANK: Record<CreditType, number> = { writer: 0, director: 1, actor: 2, choreographer: 3, dancer: 4 };
export const CREDIT_TYPE_LABEL: Record<CreditType, string> = {
  writer: "Writer",
  director: "Director",
  actor: "Actor",
  choreographer: "Choreographer",
  dancer: "Dancer",
};

/** Choreographers and dancers belong to the production's Dancers group, not to a play. */
export function isDanceType(type: CreditType | string | null | undefined) {
  return type === "choreographer" || type === "dancer";
}

/** Role text used when a credit other than an actor is saved without one. */
export function defaultRole(type: CreditType | null | undefined) {
  return type && type !== "actor" ? CREDIT_TYPE_LABEL[type] : "";
}
