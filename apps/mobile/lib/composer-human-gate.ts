import type { MessageBlock } from "@rakazo/contracts";
import { isOpenGateStatus, isWaitingTakeover, latestComputerNeedsYouText } from "@rakazo/core";
import type { MobileMessage } from "./api";

export { isWaitingTakeover, latestComputerNeedsYouText };

export function unansweredAskBlock(
  message: MobileMessage | undefined,
): Extract<MessageBlock, { kind: "ask" }> | undefined {
  return message?.blocks.find(
    (block): block is Extract<MessageBlock, { kind: "ask" }> =>
      block.kind === "ask" && isOpenGateStatus(block.status),
  );
}

const PENDING_ASK_SEND_ERROR = "Answer the pending ask first.";
const TAKEOVER_SEND_ERROR = "Open the computer first.";

export function isHumanGateComposerError(message: string | null | undefined): boolean {
  return message === PENDING_ASK_SEND_ERROR || message === TAKEOVER_SEND_ERROR;
}
