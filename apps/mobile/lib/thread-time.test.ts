import { describe, expect, it } from "vitest";
import { formatThreadTimestamp, shouldShowThreadTimestamp } from "./thread-time";

const now = new Date(2026, 8, 12, 13, 15, 0);

function local(base: Date, daysAgo: number, hours: number, minutes: number) {
  const date = new Date(base);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

describe("formatThreadTimestamp", () => {
  it("shows the clock for today", () => {
    expect(formatThreadTimestamp(local(now, 0, 11, 23), now)).toBe("11:23 AM");
  });

  it("shows weekday plus clock within the week", () => {
    expect(formatThreadTimestamp(local(now, 4, 11, 23), now)).toBe("Tue 11:23 AM");
  });

  it("shows the full date when older than a week", () => {
    expect(formatThreadTimestamp(local(now, 4 + 7, 11, 23), now)).toBe("Tue, Sep 1 11:23 AM");
  });

  it("returns nothing for an invalid timestamp", () => {
    expect(formatThreadTimestamp("not-a-date", now)).toBe("");
  });
});

describe("shouldShowThreadTimestamp", () => {
  it("shows the first message and a 5-minute gap", () => {
    expect(shouldShowThreadTimestamp(local(now, 0, 11, 23))).toBe(true);
    expect(shouldShowThreadTimestamp(local(now, 0, 11, 23), local(now, 0, 11, 20))).toBe(false);
    expect(shouldShowThreadTimestamp(local(now, 0, 11, 26), local(now, 0, 11, 20))).toBe(true);
  });
});
