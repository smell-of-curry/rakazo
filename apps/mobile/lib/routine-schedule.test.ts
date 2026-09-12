import { describe, expect, it } from "vitest";
import { describeRoutineSchedule } from "./routine-schedule";

describe("describeRoutineSchedule", () => {
  it("uses formatCron for an everyday and weekday schedule", () => {
    expect(describeRoutineSchedule(["0 8 * * *"])).toBe("Every day at 8:00 AM");
    expect(describeRoutineSchedule(["0 18 * * 1-5"])).toMatch(/Weekdays at 6:00 PM/);
  });

  it("returns Paused when inactive or empty", () => {
    expect(describeRoutineSchedule(["0 8 * * *"], false)).toBe("Paused");
    expect(describeRoutineSchedule([])).toBe("Paused");
  });
});
