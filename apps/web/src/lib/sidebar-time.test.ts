import { describe, expect, it } from "vitest";

import { formatSidebarTime } from "./sidebar-time.js";

const now = new Date(2026, 8, 9, 21, 53, 0);

describe("formatSidebarTime", () => {
  it("shows a locale clock for today", () => {
    expect(formatSidebarTime(local(now, 0, 8, 43), now)).toBe("8:43 AM");
  });

  it("shows Yesterday for the previous day", () => {
    expect(formatSidebarTime(local(now, 1, 16, 5), now)).toBe("Yesterday");
  });

  it("shows the weekday within the past week", () => {
    expect(formatSidebarTime(local(now, 2, 10, 0), now)).toBe("Monday");
  });

  it("shows a short date when older than a week", () => {
    expect(formatSidebarTime(local(now, 20, 9, 0), now)).toBe("Aug 20");
  });

  it("returns nothing for an invalid timestamp", () => {
    expect(formatSidebarTime("not-a-date", now)).toBe("");
  });
});

function local(base: Date, daysAgo: number, hours: number, minutes: number) {
  const date = new Date(base);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}
