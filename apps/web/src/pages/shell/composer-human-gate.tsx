import { i18n } from "@lingui/core";
import type { ThreadMessage } from "@rakazo/contracts";
import type { AskBlock } from "../../components/AskCard";
import { AskCard } from "../../components/AskCard";

export function latestComputerNeedsYouText(
  messages: readonly ThreadMessage[] | undefined,
): string | undefined {
  if (!messages) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    for (let blockIndex = message.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = message.blocks[blockIndex];
      if (block?.kind === "computer" && block.state === "Needs you" && block.text?.trim()) {
        return block.text;
      }
    }
  }
  return undefined;
}

export function askBlockFromMessage(message: ThreadMessage | undefined): AskBlock | undefined {
  return message?.blocks.find(
    (block): block is AskBlock => block.kind === "ask" && block.status !== "answered",
  );
}

export function ComposerHumanGate({
  ask,
  canAnswer,
  onAnswer,
  needsComputer,
  takeoverReason,
  onOpenComputer,
}: {
  ask?: AskBlock;
  canAnswer?: boolean;
  onAnswer?: (text: string) => Promise<void>;
  needsComputer?: boolean;
  takeoverReason?: string;
  onOpenComputer?: () => void;
}) {
  if (ask && onAnswer) {
    return (
      <div data-testid="composer-ask-dock" className="mb-3">
        <AskCard block={ask} canAnswer={canAnswer !== false} onAnswer={onAnswer} />
      </div>
    );
  }
  if (needsComputer) {
    return (
      <button
        type="button"
        data-testid="composer-takeover-dock"
        onClick={onOpenComputer}
        className="mb-3 w-full rounded-[14px] bg-warning/15 px-4 py-2 text-start text-[13px] text-warning"
      >
        {i18n._({ id: "Needs you", message: "Needs you" })}
        {takeoverReason ? (
          <span className="mt-1 block text-[12px] text-warning/80">{takeoverReason}</span>
        ) : null}
      </button>
    );
  }
  return null;
}
