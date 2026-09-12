import type { ThreadMessage } from "@rakazo/contracts";
import type { AskBlock } from "../../components/AskCard";
import { AskCard } from "../../components/AskCard";

export { latestComputerNeedsYouText } from "@rakazo/core";

export function askBlockFromMessage(message: ThreadMessage | undefined): AskBlock | undefined {
  return message?.blocks.find(
    (block): block is AskBlock =>
      block.kind === "ask" && block.status !== "answered" && block.status !== "dismissed",
  );
}

export function ComposerHumanGate({
  ask,
  canAnswer,
  onAnswer,
  actorName,
}: {
  ask?: AskBlock;
  canAnswer?: boolean;
  onAnswer?: (text: string) => Promise<void>;
  actorName?: string;
  needsComputer?: boolean;
  takeoverReason?: string;
  onOpenComputer?: () => void;
}) {
  if (ask && onAnswer) {
    return (
      <div data-testid="composer-ask-dock" className="mb-3">
        <AskCard
          block={ask}
          canAnswer={canAnswer !== false}
          onAnswer={onAnswer}
          actorName={actorName}
        />
      </div>
    );
  }
  return null;
}
