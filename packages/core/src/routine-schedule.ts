import { formatCron } from "./cron.js";

export type RoutineScheduleInput = {
  active: boolean;
  crons: readonly string[];
  webhookEnabled?: boolean;
  githubEnabled?: boolean;
  messageProvider?: string | null;
};

/** Human schedule line for a routine row. Never prefixes unparsed cron with "Cron". */
export function describeRoutineSchedule(routine: RoutineScheduleInput): string {
  if (!routine.active) return "Paused";
  const parts: string[] = [];
  if (routine.webhookEnabled) parts.push("When a webhook fires");
  if (routine.githubEnabled) parts.push("Git event");
  if (routine.messageProvider === "slack") parts.push("Slack message");
  else if (routine.messageProvider === "teams") parts.push("Teams message");
  else if (routine.messageProvider) parts.push("Message event");
  for (const cron of routine.crons) parts.push(formatCron(cron));
  return parts.length > 0 ? parts.join(" · ") : "No trigger";
}
