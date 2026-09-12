import { describe, expect, it } from "vitest";
import {
  bubbleCluster,
  formatThreadTimestamp,
  parseRateLimitRetrySeconds,
  shouldInsertThreadTimestamp,
  threadSenderKey,
} from "./thread-time.js";

const now = new Date(2026, 8, 12, 15, 0, 0);

function localIso(year: number, month: number, day: number, hours: number, minutes: number) {
  return new Date(year, month, day, hours, minutes, 0).toISOString();
}

describe("formatThreadTimestamp", () => {
  it("shows time only for today", () => {
    expect(formatThreadTimestamp(new Date(2026, 8, 12, 11, 23, 0), now)).toBe("11:23 AM");
  });

  it("shows weekday plus time within six days", () => {
    expect(formatThreadTimestamp(new Date(2026, 8, 8, 11, 23, 0), now)).toBe("Tue 11:23 AM");
  });

  it("shows weekday, month, and day when older", () => {
    expect(formatThreadTimestamp(new Date(2026, 8, 1, 11, 23, 0), now)).toBe("Tue, Sep 1 11:23 AM");
  });

  it("accepts an ISO string and returns nothing for an invalid stamp", () => {
    expect(formatThreadTimestamp(new Date(2026, 8, 12, 11, 23, 0).toISOString(), now)).toBe(
      "11:23 AM",
    );
    expect(formatThreadTimestamp("not-a-date", now)).toBe("");
  });
});

describe("shouldInsertThreadTimestamp", () => {
  const user = { createdAt: localIso(2026, 8, 12, 15, 0), senderKey: "user" };

  it("inserts the first row", () => {
    expect(shouldInsertThreadTimestamp(undefined, user)).toBe(true);
  });

  it("skips a short same-sender gap", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: localIso(2026, 8, 12, 15, 10),
        senderKey: "user",
      }),
    ).toBe(false);
  });

  it("inserts after fifteen minutes", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: localIso(2026, 8, 12, 15, 16),
        senderKey: "user",
      }),
    ).toBe(true);
  });

  it("does not insert when only the sender changes", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: localIso(2026, 8, 12, 15, 1),
        senderKey: "bot:1",
      }),
    ).toBe(false);
  });

  it("inserts when the day changes", () => {
    expect(
      shouldInsertThreadTimestamp(user, {
        createdAt: localIso(2026, 8, 13, 10, 0),
        senderKey: "user",
      }),
    ).toBe(true);
  });
});

describe("threadSenderKey", () => {
  it("keys users and bots", () => {
    expect(threadSenderKey({ role: "user" })).toBe("user");
    expect(threadSenderKey({ role: "bot", botId: "1" })).toBe("bot:1");
    expect(threadSenderKey({ role: "bot" })).toBe("bot:");
  });
});

describe("bubbleCluster", () => {
  it("names single, first, middle, and last", () => {
    expect(bubbleCluster(false, false)).toBe("single");
    expect(bubbleCluster(false, true)).toBe("first");
    expect(bubbleCluster(true, true)).toBe("middle");
    expect(bubbleCluster(true, false)).toBe("last");
  });
});

describe("parseRateLimitRetrySeconds", () => {
  it("reads the delay the API already emits", () => {
    expect(parseRateLimitRetrySeconds("Rate limited. Retrying in 45s.")).toBe(45);
    expect(parseRateLimitRetrySeconds("Rate limited. Retrying.")).toBeUndefined();
  });
});
