import { describe, expect, it } from "vitest";
import { pageWindow } from "./web-limits.js";

describe("web fetch Unicode page windows", () => {
  it("reassembles pages without splitting surrogate pairs or skipping text", () => {
    const body = `${"a".repeat(99)}😀${"b".repeat(99)}🚀tail`;
    let offset = 0;
    let combined = "";
    while (offset < body.length) {
      const result = pageWindow(body.slice(offset), 100, offset);
      expect(result.text).not.toMatch(/[\uD800-\uDFFF]/u);
      if (!result.truncated) {
        combined += result.text;
        break;
      }
      const content = result.text.split("\n\n[Content truncated;")[0] ?? "";
      expect(content.length).toBeLessThanOrEqual(100);
      combined += content;
      const next = Number(result.text.match(/continue with offset (\d+)/)?.[1]);
      expect(next).toBe(offset + content.length);
      expect(next).toBeGreaterThan(offset);
      offset = next;
    }
    expect(combined).toBe(body);
  });

  it("uses the actual Unicode window length for the read limit", () => {
    expect(pageWindow("a😀tail", 2, 9, 10)).toEqual({
      text: "a\n\n[Content truncated; continue with offset 10]",
      truncated: true,
    });
    expect(pageWindow("a😀tail", 2, 10, 10)).toEqual({
      text: "a\n\n[Content truncated; stopped at the read limit]",
      truncated: true,
    });
  });

  it("does not suggest the same offset when no complete character fits", () => {
    expect(pageWindow("😀tail", 1, 4)).toEqual({
      text: "\n\n[Content truncated; stopped at the read limit]",
      truncated: true,
    });
  });

  it("preserves complete and ASCII pages", () => {
    expect(pageWindow("😀", 2)).toEqual({ text: "😀", truncated: false });
    expect(pageWindow("abcd", 2, 3)).toEqual({
      text: "ab\n\n[Content truncated; continue with offset 5]",
      truncated: true,
    });
  });
});
