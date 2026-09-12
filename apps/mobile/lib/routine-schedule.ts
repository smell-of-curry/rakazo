import { formatCron } from "@rakazo/core";

/**
 * Human schedule line for a routine row.
 * Prefer `@rakazo/core` `describeRoutineSchedule` if that export lands;
 * this is the mobile stand-in (`Every day at 8:00 AM`, `Paused`).
 */
export function describeRoutineSchedule(crons: readonly string[], active = true): string {
  if (!active || crons.length === 0) return "Paused";
  return crons.map((cron) => formatCron(cron)).join(" · ");
}
