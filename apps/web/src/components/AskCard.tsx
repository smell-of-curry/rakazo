import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { ThreadMessage } from "@rakazo/contracts";
import { isApprovalAskBlock, isSecretAskBlock, selectedAskActionLabel } from "@rakazo/core";
import { Button, cn, Input } from "@rakazo/ui-web";
import { Check } from "lucide-react";
import { useState } from "react";

export type AskBlock = Extract<ThreadMessage["blocks"][number], { kind: "ask" }>;

function approvalActionLabel(id: string, fallback: string): string {
  if (id === "allow") return t`Allow once`;
  if (id === "always") return t`Always allow`;
  if (id === "deny") return t`Deny`;
  return fallback;
}

function approvalOutcomeLabel(
  answer: string | undefined,
  actions: AskBlock["actions"],
  hasAlways: boolean,
): string {
  const selected = actions?.find((action) => action.id === answer);
  if (selected?.outcome === "created") return t`Created`;
  if (selected?.outcome === "cancelled") return t`Cancelled`;
  if (hasAlways && answer === "allow") return t`Allowed once`;
  if (answer === "always") return t`Always allowed`;
  if (hasAlways && answer === "deny") return t`Denied`;
  return selectedAskActionLabel(answer ?? "", actions);
}

export function AskCard({
  block,
  canAnswer,
  onAnswer,
  actorName,
}: {
  block: AskBlock;
  canAnswer: boolean;
  onAnswer: (text: string) => Promise<void>;
  actorName?: string;
}) {
  const { t } = useLingui();
  const [answer, setAnswer] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitting = pendingAction !== null;
  const answered = block.status === "answered";
  const dismissed = block.status === "dismissed";
  const settled = answered || dismissed;
  const approval = isApprovalAskBlock(block);
  const secretInput = isSecretAskBlock(block);
  const askActions = block.actions;
  const hasAlways = Boolean(askActions?.some((action) => action.id === "always"));
  const choiceOther = Boolean(askActions?.length) && !approval && !secretInput;
  const customChoiceAnswer =
    answered &&
    choiceOther &&
    Boolean(block.answer) &&
    !askActions?.some((action) => action.id === block.answer);

  async function submitAnswer(value: string) {
    if (submitting) return;
    if (secretInput ? value.length === 0 : !value.trim()) return;
    const submitValue = secretInput ? value : value.trim();
    setPendingAction(secretInput ? "submit" : submitValue);
    setError(null);
    if (secretInput) setAnswer("");
    try {
      await onAnswer(submitValue);
    } catch (err) {
      setError(
        !secretInput && err instanceof Error ? err.message : t`Could not submit this answer`,
      );
    } finally {
      setPendingAction(null);
    }
  }

  const actor = actorName?.trim() ? actorName : t`Bot`;
  const heading = approval ? t`${actor} wants to ${block.text}` : block.text;
  const secretLabel =
    block.purpose === "password" ? t`Password` : block.purpose === "api_key" ? t`API key` : t`Code`;

  return (
    <div
      data-testid={secretInput ? "secret-ask-card" : "ask-card"}
      data-ask-state={dismissed ? "dismissed" : answered ? "answered" : "pending"}
      className={cn(
        "max-w-[72%] rounded-lg border border-border bg-card p-3 text-body",
        settled && "opacity-60",
      )}
    >
      <div className={cn("text-body", settled ? "text-muted-foreground" : "text-foreground")}>
        {approval ? heading : <ChatMarkdown>{block.text}</ChatMarkdown>}
      </div>
      {secretInput ? (
        <div className="mt-2 text-small text-muted-foreground">
          {secretLabel}
          {block.credential ? <div className="break-all">{block.credential.origin}</div> : null}
        </div>
      ) : null}
      {block.detail && !secretInput ? (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted px-3 py-2 font-mono text-small text-muted-foreground">
          {block.detail}
        </pre>
      ) : null}
      {askActions?.length ? (
        <div className="mt-3 space-y-1.5">
          {askActions.map((action) => {
            const selected = answered && block.answer === action.id;
            const label =
              approval && hasAlways ? approvalActionLabel(action.id, action.label) : action.label;
            return (
              <Button
                key={action.id}
                variant="outline"
                aria-pressed={settled ? selected : undefined}
                className={cn(
                  "h-auto w-full justify-start gap-3 whitespace-normal px-3 py-2 text-start font-normal text-body",
                  selected &&
                    "justify-between bg-background font-medium text-foreground disabled:opacity-100",
                  settled && !selected && "opacity-40 disabled:opacity-40",
                )}
                disabled={settled || !canAnswer || submitting}
                onClick={() => void submitAnswer(action.id)}
              >
                <span>{pendingAction === action.id ? <Trans>Sending…</Trans> : label}</span>
                {selected ? <Check size={16} strokeWidth={2} aria-hidden /> : null}
              </Button>
            );
          })}
        </div>
      ) : null}
      {secretInput && settled ? (
        <div className="mt-3 space-y-1">
          <div className="text-body font-medium text-muted-foreground">
            {dismissed ? <Trans>Dismissed</Trans> : <Trans>Saved</Trans>}
          </div>
          {answered ? (
            <p className="text-caption text-muted-foreground">
              <Trans>Stored securely, never shown to your bot</Trans>
            </p>
          ) : null}
        </div>
      ) : dismissed ? (
        <div className="mt-3 text-caption text-muted-foreground">
          <Trans>Dismissed</Trans>
        </div>
      ) : customChoiceAnswer ? (
        <div className="mt-3 text-body text-muted-foreground">{block.answer}</div>
      ) : answered && !askActions?.length ? (
        <div className="mt-3 text-body text-muted-foreground">{block.answer}</div>
      ) : !canAnswer && !settled ? (
        <div className="mt-3 text-small text-muted-foreground">
          <Trans>No longer active</Trans>
        </div>
      ) : secretInput && canAnswer ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer(answer);
          }}
        >
          <Input
            aria-label={secretLabel}
            type="password"
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={t`Paste value`}
          />
          <Button type="submit" className="self-start" disabled={answer.length === 0 || submitting}>
            {submitting ? <Trans>Saving…</Trans> : <Trans>Save securely</Trans>}
          </Button>
        </form>
      ) : !approval && !settled && canAnswer ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer(answer);
          }}
        >
          <Input
            data-testid="ask-other"
            aria-label={t`Answer`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={t`Type an answer`}
            disabled={submitting}
          />
          <Button type="submit" className="self-start" disabled={!answer.trim() || submitting}>
            {submitting ? <Trans>Sending…</Trans> : <Trans>Send</Trans>}
          </Button>
        </form>
      ) : answered && approval ? (
        <div className="mt-3 text-small text-muted-foreground">
          {approvalOutcomeLabel(block.answer, askActions, hasAlways)}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-small text-destructive">{error}</p> : null}
    </div>
  );
}
