/** Keep the existing UTF-16 budget without cutting an emoji or combining sequence. */
export function truncatePreviewText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  // Older clients can still use their native/CSS line clamp. Keeping the text is
  // safer than guessing grapheme boundaries without a Unicode segmenter.
  if (typeof Intl.Segmenter !== "function") return text;
  let end = 0;
  for (const { segment, index } of new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    if (index + segment.length > maxLength) break;
    end = index + segment.length;
  }
  return text.slice(0, end);
}
