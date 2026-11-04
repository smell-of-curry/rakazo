/** How many unread rows sit fully above the scrollport. */
export function countUnreadsAbove(containerTop: number, rowBottoms: readonly number[]) {
  // ponytail: one pass over the unread rows on each scroll. A sidebar stays small.
  // Thousands of rows would want an IntersectionObserver instead.
  let count = 0;
  for (const bottom of rowBottoms) if (bottom < containerTop) count += 1;
  return count;
}
