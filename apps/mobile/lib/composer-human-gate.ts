import type { MessageBlock } from "@rakazo/contracts";
import type { MobileMessage } from "./api";

const PENDING_ASK_SEND_ERROR = "Answer the pending ask first.";
const TAKEOVER_SEND_ERROR = "Open the computer first.";

export function latestComputerNeedsYouText(
  messages: readonly MobileMessage[] | undefined,
): string | undefined {
  if (!messages) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    for (let blockIndex = message.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = message.blocks[blockIndex];
      if (block?.kind === "computer" && block.state === "Needs you" && block.text.trim()) {
        return block.text;
      }
    }
  }
  return undefined;
}

export function unansweredAskBlock(
  message: MobileMessage | undefined,
): Extract<MessageBlock, { kind: "ask" }> | undefined {
  return message?.blocks.find(
    (block): block is Extract<MessageBlock, { kind: "ask" }> =>
      block.kind === "ask" && block.status !== "answered",
  );
}

export function isWaitingTakeover(
  snapshot: {
    run?: { status: string } | null;
    activeRuns?: readonly { status: string }[];
  } | null,
): boolean {
  if (!snapshot) return false;
  if (snapshot.run?.status === "waiting_takeover") return true;
  return snapshot.activeRuns?.some((run) => run.status === "waiting_takeover") ?? false;
}

export function isHumanGateComposerError(message: string | null | undefined): boolean {
  return message === PENDING_ASK_SEND_ERROR || message === TAKEOVER_SEND_ERROR;
}
