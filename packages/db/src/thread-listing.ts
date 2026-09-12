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

function blockKind(block: unknown): string | undefined {
  if (!block || typeof block !== "object" || !("kind" in block)) return undefined;
  return typeof block.kind === "string" ? block.kind : undefined;
}

function blockText(block: unknown): string {
  if (!block || typeof block !== "object" || !("text" in block)) return "";
  return typeof block.text === "string" ? block.text : "";
}

function peerName(block: unknown): string {
  if (!block || typeof block !== "object" || !("toBotName" in block)) return "";
  return typeof block.toBotName === "string" ? block.toBotName.trim() : "";
}

export function isOutboundBotMessage(blocks: unknown): boolean {
  const rows = Array.isArray(blocks) ? blocks : [];
  return rows.some((block) => blockKind(block) === "bot_message_sent");
}

export function previewFromBlocks(blocks: unknown): string {
  const rows = Array.isArray(blocks) ? blocks : [];
  for (const block of rows) {
    if (blockKind(block) === "bot_message_sent") {
      const text = blockText(block);
      const name = peerName(block);
      if (name && text) return `Messaged ${name}: ${text}`;
      if (text) return text;
      continue;
    }
    const text = blockText(block);
    if (text) return text;
  }
  return "";
}

export function previewFromGroupMessage(
  message:
    | {
        blocks: unknown;
        role?: string | null;
        botId?: string | null;
      }
    | undefined,
  members: ReadonlyArray<{ bot: { id: string; name: string } }>,
): string {
  const preview = previewFromBlocks(message?.blocks);
  if (!preview || !message || preview.startsWith("Messaged ")) return preview;
  if (message.role !== "bot" || !message.botId) return preview;
  const sender = members.find((member) => member.bot.id === message.botId)?.bot.name.trim();
  return sender ? `${sender}: ${preview}` : preview;
}
