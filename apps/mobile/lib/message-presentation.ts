import type { MessageBlock } from "@rakazo/contracts";
import { isToolActivityBlock } from "@rakazo/core";

export function isCenteredAgentEvent(blocks: readonly MessageBlock[]): boolean {
  return blocks.some(
    (block) =>
      block.kind === "handoff" ||
      block.kind === "bot_message_sent" ||
      block.kind === "bot_message_received" ||
      block.kind === "channel_message",
  );
}

export type MessagePresentationSegment = {
  kind: "content";
  blocks: MessageBlock[];
};

export function messagePresentationSegments(
  blocks: readonly MessageBlock[],
): MessagePresentationSegment[] {
  const content = blocks.filter(
    (block) => block.kind !== "app_connect" && !isToolActivityBlock(block),
  );
  return content.length > 0 ? [{ kind: "content", blocks: content }] : [];
}

export function hasVisibleMessagePresentation(blocks: readonly MessageBlock[]): boolean {
  return blocks.some((block) => !isToolActivityBlock(block));
}

/** Empty live `progress:` rows stay off the transcript; working glyph covers them. */
export function isBlankLiveProgress(message: {
  id: string;
  blocks: readonly MessageBlock[];
}): boolean {
  if (!message.id.startsWith("progress:")) return false;
  return !message.blocks.some(
    (block) =>
      !isToolActivityBlock(block) &&
      "text" in block &&
      typeof block.text === "string" &&
      block.text.trim().length > 0,
  );
}
