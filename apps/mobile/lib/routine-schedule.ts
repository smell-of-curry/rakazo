import { describeRoutineSchedule as describeCoreRoutineSchedule } from "@rakazo/core";

export function describeRoutineSchedule(crons: readonly string[], active = true): string {
  return describeCoreRoutineSchedule({ active, crons });
}
