import type { MessageBlock } from "@rakazo/contracts";
import type { ComputerStatusChipKind } from "@rakazo/core";
import {
  computerStatusChip,
  isApprovalAskBlock,
  isCenteredAgentEvent,
  messageProviderLabel,
  selectedAskActionLabel,
  shouldInsertThreadTimestamp,
} from "@rakazo/core";
import { t } from "./i18n";

export type AskAction = NonNullable<Extract<MessageBlock, { kind: "ask" }>["actions"]>[number];

export type ComposerRightSlot = "stop" | "send" | "mic" | "stop+send";

export type MessageCardKind =
  | "computer_gate"
  | "ask"
  | "handoff"
  | "peer"
  | "channel"
  | "subagent"
  | "cloud_agent"
  | "child_bot"
  | "app_connect_only"
  | "ask_actions"
  | "attachments"
  | "text";

const COMPUTER_CHIP_MESSAGE: Record<ComputerStatusChipKind, string> = {
  live: "Live",
  sleeping: "Sleeping",
  setting_up: "Setting up…",
  needs_you: "Needs you",
  off: "Off",
};

export function newClientNonce(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatApprovalAnswer(
  answer: string | undefined,
  actions: AskAction[] | undefined,
  approval: boolean,
): string {
  if (!answer) return t("Answered");
  const selectedAction = actions?.find((action) => action.id === answer);
  const outcome = selectedAction?.outcome;
  if (approval && outcome === "created") return t("Created");
  if (approval && outcome === "cancelled") return t("Cancelled");
  if (approval && answer === "allow") return t("Allowed once");
  if (approval && answer === "always") return t("Always allowed");
  if (approval && answer === "deny") return t("Denied");
  return t("Answered: {answer}", { answer: selectedAskActionLabel(answer, actions) });
}

export function formatAttachmentSkip(item: { name: string; reason: string }): string {
  const name = item.name === "camera" ? t("Camera") : item.name;
  if (item.reason === "permission denied") return t("{name} (permission denied)", { name });
  if (item.reason === "over 10 MiB") return t("{name} (over 10 MiB)", { name });
  if (item.reason === "unsupported type") return t("{name} (unsupported type)", { name });
  const maxMatch = /^max (\d+) attachments$/.exec(item.reason);
  if (maxMatch) {
    return t("{name} (max {count} attachments)", { name, count: maxMatch[1] ?? "" });
  }
  return `${name} (${item.reason})`;
}

export function isWorkingStatus(status: string | undefined): boolean {
  return (
    status === "queued" ||
    status === "leased" ||
    status === "running" ||
    status === "waiting_input" ||
    status === "waiting_takeover"
  );
}

export function previewMessageText(message: { blocks: readonly MessageBlock[] }): string {
  const text = message.blocks
    .flatMap((block) => {
      if (block.kind === "channel_message" && block.text) {
        return [
          `${messageProviderLabel(block.provider, block.transport)} · ${block.fromLabel}: ${block.text}`,
        ];
      }
      return block.kind === "text" && block.text ? [block.text] : [];
    })
    .join(" ")
    .trim();
  if (text) return text;
  if (message.blocks.some((block) => block.kind === "image" || block.kind === "file")) {
    return t("Attachment");
  }
  return t("Message");
}

export function memberName(
  members: readonly { botId: string; name: string }[] | undefined,
  botId: string | undefined,
): string | undefined {
  if (!botId || !members) return undefined;
  return members.find((member) => member.botId === botId)?.name;
}

export function composerRightSlot(working: boolean, canSend: boolean): ComposerRightSlot {
  if (working && canSend) return "stop+send";
  if (working) return "stop";
  if (canSend) return "send";
  return "mic";
}

export function shouldShowMessageTimestamp(
  currentIso: string | undefined,
  previousIso?: string,
): boolean {
  if (!currentIso) return false;
  return shouldInsertThreadTimestamp(
    previousIso === undefined ? undefined : { createdAt: previousIso, senderKey: "" },
    { createdAt: currentIso, senderKey: "" },
  );
}

export function threadComputerChip(input: {
  state?: "stopped" | "booting" | "running" | "suspended" | "error";
  takeoverRequested?: boolean;
  runStatus?: string | null;
}): { kind: ComputerStatusChipKind; tone: "muted" | "warning"; label: string } {
  const chip = computerStatusChip(
    {
      state: input.state,
      screenAvailable: input.state === "running",
      takeoverRequested: input.takeoverRequested,
    },
    input.runStatus,
  );
  return { ...chip, label: t(COMPUTER_CHIP_MESSAGE[chip.kind]) };
}

export function workingStatusKind(input: {
  rateLimitSeconds: number | null;
  computerKind: ComputerStatusChipKind;
}): "rate_limit" | "setting_up" | "dots" {
  if (input.rateLimitSeconds) return "rate_limit";
  if (input.computerKind === "setting_up") return "setting_up";
  return "dots";
}

export function sameBubbleSender(
  left: { role: string; botId?: string | null; blocks: readonly MessageBlock[] } | undefined,
  right: { role: string; botId?: string | null; blocks: readonly MessageBlock[] } | undefined,
  fallbackBotId?: string,
): boolean {
  if (!left || !right || left.role !== right.role) return false;
  if (isCenteredAgentEvent(left.blocks) || isCenteredAgentEvent(right.blocks)) return false;
  if (left.role === "user") return true;
  return (left.botId ?? fallbackBotId) === (right.botId ?? fallbackBotId);
}

export function messageCardKind(blocks: readonly MessageBlock[]): MessageCardKind {
  const computerGate = blocks.find(
    (block): block is Extract<MessageBlock, { kind: "computer" }> =>
      block.kind === "computer" && block.state === "Needs you",
  );
  if (computerGate) return "computer_gate";

  const ask = blocks.find(
    (block): block is Extract<MessageBlock, { kind: "ask" }> =>
      block.kind === "ask" && !isApprovalAskBlock(block) && !block.actions?.length,
  );
  if (ask) return "ask";

  if (blocks.some((block) => block.kind === "handoff")) return "handoff";

  if (
    blocks.some(
      (block) => block.kind === "bot_message_sent" || block.kind === "bot_message_received",
    )
  ) {
    return "peer";
  }

  if (blocks.some((block) => block.kind === "channel_message")) return "channel";

  const special = blocks.find(
    (block) =>
      block.kind === "subagent" || block.kind === "child_bot" || block.kind === "cloud_agent",
  );
  if (special?.kind === "subagent") return "subagent";
  if (special?.kind === "cloud_agent") return "cloud_agent";
  if (special?.kind === "child_bot") return "child_bot";

  const appConnectBlocks = blocks.filter((block) => block.kind === "app_connect");
  if (appConnectBlocks.length > 0 && appConnectBlocks.length === blocks.length) {
    return "app_connect_only";
  }

  if (blocks.some((block) => block.kind === "ask" && Boolean(block.actions?.length))) {
    return "ask_actions";
  }

  if (blocks.some((block) => block.kind === "image" || block.kind === "file")) {
    return "attachments";
  }

  return "text";
}
