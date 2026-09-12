export type PeerNameParts = {
  names: string[];
  first: string | undefined;
  second: string | undefined;
  overflow: number;
};

/** Unique names in first-seen order, plus the first two and overflow count. */
export function peerNameParts(names: readonly string[]): PeerNameParts {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  return {
    names: unique,
    first: unique[0],
    second: unique[1],
    overflow: Math.max(0, unique.length - 2),
  };
}
