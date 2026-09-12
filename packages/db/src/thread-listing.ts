import { ACTIVE_RUN_STATUSES, isNeedsYou } from "@rakazo/core";

export const activeRunStatuses = [...ACTIVE_RUN_STATUSES];

export const activeRunSelection = {
  where: { status: { in: activeRunStatuses } },
  orderBy: { createdAt: "desc" as const },
  // Enough rows to see a waiting gate hidden under a later peer/busy run.
  take: 8,
  select: { status: true },
} as const;

export function preferredActiveRunStatus(
  runs: ReadonlyArray<{ status: string }>,
): string | undefined {
  return runs.find((run) => isNeedsYou(run.status))?.status ?? runs[0]?.status;
}

export function previewFromBlocks(blocks: unknown): string {
  const rows = Array.isArray(blocks) ? blocks : [];
  for (const block of rows) {
    if (
      block &&
      typeof block === "object" &&
      "text" in block &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      return (block as { text: string }).text;
    }
  }
  return "";
}
