/** Alphabetical, case-insensitive, locale-aware. Use for every name-based dropdown. */
export function sortByName<T>(list: T[], pick: (item: T) => string | null | undefined): T[] {
  return [...list].sort((a, b) =>
    (pick(a) ?? "").localeCompare(pick(b) ?? "", undefined, { sensitivity: "base", numeric: true })
  );
}
