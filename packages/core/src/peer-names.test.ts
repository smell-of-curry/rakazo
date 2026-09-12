import { describe, expect, it } from "vitest";
import { peerNameParts } from "./peer-names.js";

describe("peerNameParts", () => {
  it("keeps first-seen order and drops blanks and repeats", () => {
    expect(peerNameParts([" Ken ", "Ally", "Ken", "", "Dan"])).toEqual({
      names: ["Ken", "Ally", "Dan"],
      first: "Ken",
      second: "Ally",
      overflow: 1,
    });
  });

  it("covers one, two, many, and empty", () => {
    expect(peerNameParts(["Ken"])).toEqual({
      names: ["Ken"],
      first: "Ken",
      second: undefined,
      overflow: 0,
    });
    expect(peerNameParts(["Ken", "Ally"])).toEqual({
      names: ["Ken", "Ally"],
      first: "Ken",
      second: "Ally",
      overflow: 0,
    });
    expect(peerNameParts(["Ken", "Ally", "Jo", "Pat"])).toEqual({
      names: ["Ken", "Ally", "Jo", "Pat"],
      first: "Ken",
      second: "Ally",
      overflow: 2,
    });
    expect(peerNameParts([])).toEqual({
      names: [],
      first: undefined,
      second: undefined,
      overflow: 0,
    });
  });
});
