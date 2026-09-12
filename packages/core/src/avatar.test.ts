import { describe, expect, it } from "vitest";
import {
  AVATAR_COLOR_HEXES,
  AVATAR_COLORS,
  AVATAR_SHAPE_KEYS,
  AVATAR_SHAPES,
  avatarShapePath,
  resolveAvatarColor,
  resolveAvatarColorDef,
  resolveAvatarShape,
} from "./avatar.js";

describe("resolveAvatarShape", () => {
  it("returns a stable hash default for a bot id", () => {
    const first = resolveAvatarShape("bot-research");
    expect(AVATAR_SHAPE_KEYS).toContain(first);
    expect(resolveAvatarShape("bot-research")).toBe(first);
    expect(resolveAvatarShape("bot-health")).not.toBe(first);
  });

  it("prefers an explicit shipped key", () => {
    expect(resolveAvatarShape("bot-research", "cloud")).toBe("cloud");
  });

  it("ignores unknown explicit keys", () => {
    expect(resolveAvatarShape("bot-research", "hex")).toBe(resolveAvatarShape("bot-research"));
  });
});

describe("resolveAvatarColor", () => {
  it("returns a stable palette hex for a bot id", () => {
    const first = resolveAvatarColor("bot-research");
    expect(AVATAR_COLOR_HEXES).toContain(first);
    expect(resolveAvatarColor("bot-research")).toBe(first);
  });

  it("resolves palette hex and id", () => {
    expect(resolveAvatarColor("bot-research", "#8B5CF6")).toBe("#8B5CF6");
    expect(resolveAvatarColor("bot-research", "violet")).toBe("#8B5CF6");
  });

  it("keeps a custom hex and synthesizes a darker stop", () => {
    const custom = resolveAvatarColorDef("bot-research", "#14B8A6");
    expect(custom.hex).toBe("#14B8A6");
    expect(custom.light).toBe("#14B8A6");
    expect(custom.dark).not.toBe("#14B8A6");
    expect(custom.dark.startsWith("#")).toBe(true);
  });
});

describe("avatar geometry", () => {
  it("ships eight shape paths and twelve colors", () => {
    expect(AVATAR_SHAPE_KEYS).toHaveLength(8);
    expect(Object.keys(AVATAR_SHAPES)).toEqual([...AVATAR_SHAPE_KEYS]);
    expect(AVATAR_COLORS).toHaveLength(12);
    for (const key of AVATAR_SHAPE_KEYS) {
      expect(AVATAR_SHAPES[key].startsWith("M")).toBe(true);
      expect(avatarShapePath("bot-1", key)).toBe(AVATAR_SHAPES[key]);
    }
  });
});
