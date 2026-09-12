import { describe, expect, it } from "vitest";
import { formatPeerNames } from "./peer-names";

describe("formatPeerNames", () => {
  it("joins one, two, and many names", () => {
    expect(formatPeerNames(["Ken"])).toBe("Ken");
    expect(formatPeerNames(["Ken", "Ally"])).toBe("Ken and Ally");
    expect(formatPeerNames(["Ken", "Ally", "Dan"])).toBe("Ken, Ally, and Dan");
  });
});
