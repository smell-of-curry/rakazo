import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  currentApiBase: vi.fn(() => "https://rakazo.example"),
}));

import { currentApiBase } from "./api";
import { botAvatarSrc, withMemberAvatarSrc } from "./bot-avatar-src";

describe("botAvatarSrc", () => {
  afterEach(() => {
    vi.mocked(currentApiBase).mockReturnValue("https://rakazo.example");
  });

  it("returns nothing without a photo", () => {
    expect(botAvatarSrc({ id: "b_1", hasAvatar: false, updatedAt: "t1" })).toBeUndefined();
    expect(botAvatarSrc({ id: "b_1" })).toBeUndefined();
    expect(botAvatarSrc()).toBeUndefined();
  });

  it("builds a cache-busted url from id + updatedAt", () => {
    expect(
      botAvatarSrc({ id: "b_1", hasAvatar: true, updatedAt: "2026-09-10T12:00:00.000Z" }),
    ).toBe("https://rakazo.example/api/bots/b_1/avatar?v=2026-09-10T12%3A00%3A00.000Z");
  });

  it("accepts botId when id is missing", () => {
    expect(botAvatarSrc({ botId: "b_2", hasAvatar: true })).toBe(
      "https://rakazo.example/api/bots/b_2/avatar",
    );
  });
});

describe("withMemberAvatarSrc", () => {
  it("attaches imageSrc only for members with photos", () => {
    expect(
      withMemberAvatarSrc([
        { botId: "b_1", hasAvatar: true },
        { botId: "b_2", hasAvatar: false },
      ]),
    ).toEqual([
      { botId: "b_1", hasAvatar: true, imageSrc: "https://rakazo.example/api/bots/b_1/avatar" },
      { botId: "b_2", hasAvatar: false, imageSrc: undefined },
    ]);
  });
});
