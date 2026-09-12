import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AskActions", () => {
  it("keeps a free-text field on choice cards", () => {
    const src = readFileSync(new URL("../components/AskActions.tsx", import.meta.url), "utf8");
    expect(src).toContain("allowOther");
    expect(src).toContain('testID="ask-other"');
    expect(src).toContain("Type your answer");
  });
});
