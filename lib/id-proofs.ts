/** Every ID uploaded for one cart or booking line (older lines may only have the single path). */
export function idPaths(item: { id_proof_paths?: string[] | null; id_proof_path?: string | null }): string[] {
  if (item.id_proof_paths && item.id_proof_paths.length > 0) return item.id_proof_paths;
  return item.id_proof_path ? [item.id_proof_path] : [];
}
