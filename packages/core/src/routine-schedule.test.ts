import { describe, expect, it } from "vitest";
import { describeRoutineSchedule } from "./routine-schedule.js";

function routine(
  partial: Partial<Parameters<typeof describeRoutineSchedule>[0]> & { crons?: string[] } = {},
) {
  return {
    active: true,
    crons: [],
    webhookEnabled: false,
    githubEnabled: false,
    messageProvider: null,
    ...partial,
  };
}

describe("describeRoutineSchedule", () => {
  it("returns Paused when the routine is disabled", () => {
    expect(describeRoutineSchedule(routine({ active: false, crons: ["0 8 * * *"] }))).toBe(
      "Paused",
    );
  });

  it("describes everyday language crons", () => {
    expect(describeRoutineSchedule(routine({ crons: ["0 8 * * *"] }))).toBe("Every day at 8:00 AM");
    expect(describeRoutineSchedule(routine({ crons: ["0 18 * * 1-5"] }))).toBe(
      "Weekdays at 6:00 PM",
    );
    expect(describeRoutineSchedule(routine({ crons: ["0 10 * * 1"] }))).toBe(
      "Every Monday at 10:00 AM",
    );
    expect(describeRoutineSchedule(routine({ crons: ["0 */6 * * *"] }))).toBe("Every 6 hours");
    expect(describeRoutineSchedule(routine({ crons: ["*/15 * * * *"] }))).toBe("Every 15 minutes");
    expect(describeRoutineSchedule(routine({ crons: ["0 * * * *"] }))).toBe("Every hour");
    expect(describeRoutineSchedule(routine({ crons: ["0 0 * * *"] }))).toBe(
      "Every day at 12:00 AM",
    );
    expect(describeRoutineSchedule(routine({ crons: ["30 14 * * *"] }))).toBe(
      "Every day at 2:30 PM",
    );
    expect(describeRoutineSchedule(routine({ crons: ["0 9 1 * *"] }))).toBe(
      "Monthly on the 1st at 9:00 AM",
    );
    expect(describeRoutineSchedule(routine({ crons: ["*/5 * * * *"] }))).toBe("Every 5 minutes");
  });

  it("falls back to the raw expression when the cron is unparseable", () => {
    expect(describeRoutineSchedule(routine({ crons: ["7 */6 * * *"] }))).toBe("7 */6 * * *");
    expect(describeRoutineSchedule(routine({ crons: ["0 9 * * 0"] }))).toBe("0 9 * * 0");
  });

  it("names webhook and message triggers", () => {
    expect(describeRoutineSchedule(routine({ webhookEnabled: true }))).toBe("When a webhook fires");
    expect(describeRoutineSchedule(routine({ webhookEnabled: true, crons: ["0 8 * * *"] }))).toBe(
      "When a webhook fires · Every day at 8:00 AM",
    );
  });

  it("returns No trigger when nothing is configured", () => {
    expect(describeRoutineSchedule(routine())).toBe("No trigger");
  });
});
