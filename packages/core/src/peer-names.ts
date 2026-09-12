/** Unique peer names: `Ken`, `Ken and Ally`, `Ken, Ally, and Dan`. */
export function formatPeerNames(names: readonly string[]): string {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  const head = unique.slice(0, -1).join(", ");
  return `${head}, and ${unique[unique.length - 1]}`;
}
