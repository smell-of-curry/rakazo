import { describe, expect, it } from "vitest";
import { bubbleCluster, bubbleRadiusClass } from "./thread-time";

describe("bubble grouping classes", () => {
  it("collapses inner corners on clustered bubbles", () => {
    expect(bubbleCluster(false, false)).toBe("single");
    expect(bubbleRadiusClass("user", "first")).toContain("rounded-br-[6px]");
    expect(bubbleRadiusClass("bot", "last")).toContain("rounded-tl-[6px]");
    expect(bubbleRadiusClass("user", "single")).toBe("rounded-[18px]");
  });
});
