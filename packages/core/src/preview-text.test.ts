import { describe, expect, it, vi } from "vitest";
import { messageReplyPreview } from "./message-quote.js";
import { truncatePreviewText } from "./preview-text.js";

const clusters = ["😀", "👩‍💻", "🇧🇷", "👍🏽", "e\u0301", "1️⃣", "👨‍👩‍👧‍👦"];

describe("reply preview grapheme boundaries", () => {
  it("keeps short text and the existing ASCII budget", () => {
    expect(truncatePreviewText("", 120)).toBe("");
    expect(truncatePreviewText("Short 😀", 120)).toBe("Short 😀");
    expect(truncatePreviewText("x".repeat(121), 120)).toBe("x".repeat(120));
    expect(truncatePreviewText("x", 0)).toBe("");
  });

  it.each(clusters)("never retains part of %s at either preview budget", (cluster) => {
    for (const budget of [120, 280]) {
      for (let part = 1; part < cluster.length; part++) {
        const prefix = "x".repeat(budget - part);
        expect(truncatePreviewText(`${prefix}${cluster}tail`, budget)).toBe(prefix);
      }
      const prefix = "x".repeat(budget - cluster.length);
      expect(truncatePreviewText(`${prefix}${cluster}tail`, budget)).toBe(`${prefix}${cluster}`);
    }
  });

  it.each(clusters)("shares intact server preview text with web and native for %s", (cluster) => {
    const prefix = "x".repeat(279);
    const preview = messageReplyPreview(
      [{ kind: "text", text: `${prefix}${cluster}tail` }],
      "user",
    );
    expect(preview.text).toBe(prefix);
  });

  it("preserves the full text for client line clamping without Intl.Segmenter", () => {
    const segmenter = Intl.Segmenter;
    try {
      Object.defineProperty(Intl, "Segmenter", { configurable: true, value: undefined });
      const text = `${"x".repeat(119)}👩‍💻tail`;
      expect(truncatePreviewText(text, 120)).toBe(text);
    } finally {
      Object.defineProperty(Intl, "Segmenter", { configurable: true, value: segmenter });
      vi.restoreAllMocks();
    }
  });
});
