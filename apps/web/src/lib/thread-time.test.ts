import { describe, expect, it } from "vitest";
import {
  bubbleCluster,
  bubbleRadiusClass,
  formatThreadTimestamp,
  parseRateLimitRetrySeconds,
  shouldInsertThreadTimestamp,
} from "./thread-time";

const now = new Date(2026, 8, 12, 15, 0, 0);

describe("formatThreadTimestamp", () => {
  it("shows time only for today", () => {
    expect(formatThreadTimestamp(new Date(2026, 8, 12, 15, 23, 0), now)).toMatch(/3:23\sPM|15:23/);
  });

  it("shows weekday plus time within six days", () => {
    const stamp = formatThreadTimestamp(new Date(2026, 8, 8, 15, 23, 0), now);
    expect(stamp).toMatch(/^Tue /);
    expect(stamp).not.toContain("Sep");
  });

  it("shows weekday, month, and day when older", () => {
    expect(formatThreadTimestamp(new Date(2026, 8, 1, 15, 23, 0), now)).toMatch(/^Tue, Sep 1 /);
  });
});

describe("shouldInsertThreadTimestamp", () => {
  const user = { createdAt: "2026-09-12T15:00:00.000Z", senderKey: "user" };

  it("inserts the first row", () => {
    expect(shouldInsertThreadTimestamp(undefined, user)).toBe(true);
  });

  it("skips a short same-sender gap", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: "2026-09-12T15:10:00.000Z",
        senderKey: "user",
      }),
    ).toBe(false);
  });

  it("inserts after fifteen minutes", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: "2026-09-12T15:16:00.000Z",
        senderKey: "user",
      }),
    ).toBe(true);
  });

  it("inserts when the sender changes", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: "2026-09-12T15:01:00.000Z",
        senderKey: "bot:1",
      }),
    ).toBe(true);
  });

  it("inserts when the day changes", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: "2026-09-13T10:00:00.000Z",
        senderKey: "user",
      }),
    ).toBe(true);
  });
});

describe("bubble grouping classes", () => {
  it("collapses inner corners on clustered bubbles", () => {
    expect(bubbleCluster(false, false)).toBe("single");
    expect(bubbleCluster(false, true)).toBe("first");
    expect(bubbleCluster(true, true)).toBe("middle");
    expect(bubbleCluster(true, false)).toBe("last");
    expect(bubbleRadiusClass("user", "first")).toContain("rounded-br-[6px]");
    expect(bubbleRadiusClass("bot", "last")).toContain("rounded-tl-[6px]");
    expect(bubbleRadiusClass("user", "single")).toBe("rounded-[18px]");
  });
});

describe("parseRateLimitRetrySeconds", () => {
  it("reads the delay the API already emits", () => {
    expect(parseRateLimitRetrySeconds("Rate limited. Retrying in 45s.")).toBe(45);
    expect(parseRateLimitRetrySeconds("Rate limited. Retrying.")).toBeUndefined();
  });
});
