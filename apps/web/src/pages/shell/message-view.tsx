import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { MessageReaction, ThreadMessage } from "@rakazo/contracts";
import { canReactToThreadMessage, MESSAGE_REACTIONS } from "@rakazo/contracts";
import { isRateLimitError, isToolActivityBlock, resolveAvatarColor } from "@rakazo/core";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import { Copy, MemoryStick, Monitor, MoreHorizontal, RefreshCw, Reply, Smile } from "lucide-react";
import { memo, type ReactNode, useRef, useState } from "react";
import { ArtifactFileCard } from "../../components/ArtifactFileCard";
import { AskCard } from "../../components/AskCard";
import { CollaborationMarker } from "../../components/ai/CollaborationMarker";
import type { PeerReceiptPeerLook } from "../../components/ai/PeerReceiptCluster";
import { CloudAgentCard } from "../../components/CloudAgentCard";
import { MessageHoverMetadata } from "../../components/MessageHoverMetadata";
import { SkillDraftCard } from "../../components/teach/SkillDraftCard";
import type { ArtifactTarget } from "../../lib/artifact-open";
import { botImageSrc } from "../../lib/bot-image-src";
import { copyableMessageText } from "../../lib/message-text";
import { messageProviderLabel } from "../../lib/messaging";
import type { BubbleCluster } from "../../lib/thread-time";
import { bubbleRadiusClass } from "../../lib/thread-time";
import { highlightQuery } from "./find-in-chat";
import {
  AppConnectCard,
  ArtifactImage,
  ChartBlockView,
  ChoiceCard,
  ComputerHandoffCard,
  McpApprovalCard,
} from "./message-cards";

export function previewMessageText(message: ThreadMessage): string {
  const text = message.blocks
    .map((block) => (block.kind === "text" || block.kind === "channel_message" ? block.text : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  if (text) return text;
  if (message.blocks.some((block) => block.kind === "image" || block.kind === "file")) {
    return t`Attachment`;
  }
  return t`Message`;
}

export function MessageHoverActions({
  message,
  side,
  onReply,
  onReact,
}: {
  message: ThreadMessage;
  side: "start" | "end";
  onReply: (message: ThreadMessage) => void;
  onReact: (message: ThreadMessage, reaction: MessageReaction) => Promise<void>;
}) {
  const { t } = useLingui();
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);

  // Streaming progress bubbles keep hover free for selection / stop clicks.
  if (message.id.startsWith("progress:")) return null;

  function copyMessage() {
    const text = copyableMessageText(message);
    if (!text || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).catch(() => undefined);
  }

  const iconButtonClass =
    "grid h-7 w-7 place-items-center text-muted-foreground transition-colors hover:text-foreground";

  return (
    <MessageHoverMetadata pinned={moreOpen || reactionsOpen} side={side}>
      <div data-testid="message-hover-actions" className="flex items-center gap-0.5">
        {canReactToThreadMessage(message) ? (
          <Popover open={reactionsOpen} onOpenChange={setReactionsOpen}>
            <PopoverTrigger
              aria-label={t`React`}
              className={cn(
                iconButtonClass,
                "h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-7 [@media(hover:hover)_and_(pointer:fine)]:w-7",
              )}
            >
              <Smile size={15} strokeWidth={1.7} />
            </PopoverTrigger>
            <PopoverContent
              align={side === "end" ? "start" : "end"}
              className="w-auto flex-row gap-0 rounded-2xl p-1.5"
              aria-label={t`Reactions`}
            >
              {MESSAGE_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={emoji}
                  className="grid h-11 w-11 place-items-center rounded-xl text-2xl hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => {
                    setReactionsOpen(false);
                    void onReact(message, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
        <button
          type="button"
          aria-label={t`Reply`}
          onClick={() => onReply(message)}
          className={`${iconButtonClass} hidden [@media(hover:hover)_and_(pointer:fine)]:grid`}
        >
          <Reply size={15} strokeWidth={1.7} />
        </button>
        <DropdownMenu
          modal={false}
          open={moreOpen}
          onOpenChange={(open) => {
            setMoreOpen(open);
            if (!open) moreTriggerRef.current?.focus();
          }}
        >
          <DropdownMenuTrigger
            ref={moreTriggerRef}
            aria-label={t`More`}
            className={cn(
              iconButtonClass,
              "h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-7 [@media(hover:hover)_and_(pointer:fine)]:w-7",
            )}
          >
            <MoreHorizontal size={15} strokeWidth={1.7} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align={side === "end" ? "start" : "end"}>
            <DropdownMenuItem
              className="[@media(hover:hover)_and_(pointer:fine)]:hidden"
              onClick={() => onReply(message)}
            >
              <Reply size={15} />
              <Trans>Reply</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyMessage}>
              <Copy size={14} strokeWidth={1.7} />
              <Trans>Copy</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </MessageHoverMetadata>
  );
}

function SystemRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1 text-caption text-muted-foreground">
      <span className="inline-flex size-3 shrink-0 items-center justify-center [&>svg]:size-3">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

export const MessageView = memo(function MessageView({
  artifactTarget,
  canAnswer,
  message,
  cluster = "single",
  isGroup = false,
  highlightQuery: findQuery = "",
  onAnswer,
  onOpenBot,
  onOpenPeerMessages,
  onOpenComputer,
  speakerName,
  memberName,
  peerBot,
  replyPreview,
  replyToMessageId,
  onJumpToMessage,
  onRefresh,
  onBotChanged,
  onAddRoutine,
  voiceReady,
  speaking,
  onSpeak,
}: {
  artifactTarget: ArtifactTarget;
  canAnswer: boolean;
  message: ThreadMessage;
  cluster?: BubbleCluster;
  isGroup?: boolean;
  highlightQuery?: string;
  onAnswer: (message: ThreadMessage, text: string) => Promise<void>;
  onOpenBot: (botId: string) => void;
  onOpenPeerMessages: (peer: { peerBotId: string; peerBotName: string }) => void;
  onOpenComputer?: () => void;
  speakerName?: string;
  memberName?: (botId: string | undefined) => string | undefined;
  peerBot: (botId: string) => PeerReceiptPeerLook | undefined;
  replyPreview?: ThreadMessage;
  replyToMessageId?: string;
  onJumpToMessage?: (messageId: string) => void;
  onRefresh: () => Promise<void>;
  onBotChanged: () => Promise<void>;
  onAddRoutine: (name: string, prompt: string) => void;
  voiceReady: boolean;
  speaking: boolean;
  onSpeak: () => void;
}) {
  const { t } = useLingui();
  const isNarration =
    message.role === "bot" &&
    message.blocks.length > 0 &&
    message.blocks.every(
      (block) => block.kind === "text" || block.kind === "progress" || block.kind === "steps",
    );
  const isLive = message.id.startsWith("progress:");
  const visibleNarrationBlocks = message.blocks.filter((block) => !isToolActivityBlock(block));
  const parentJumpId = replyPreview?.id ?? replyToMessageId;
  const messageContext = (
    <>
      {speakerName && isGroup ? (
        <div className="mb-1 text-caption font-medium text-muted-foreground" dir="auto">
          {speakerName}
        </div>
      ) : null}
      {parentJumpId ? (
        <button
          type="button"
          data-testid="reply-parent-preview"
          aria-label={t`Jump to replied message`}
          onClick={() => onJumpToMessage?.(parentJumpId)}
          className="mb-2 block max-w-[72%] truncate rounded-lg border border-border bg-background px-3 py-2 text-start text-caption text-muted-foreground hover:border-border hover:text-foreground/75"
          dir="auto"
        >
          {replyPreview ? previewMessageText(replyPreview) : t`Earlier message`}
        </button>
      ) : null}
    </>
  );
  if (isNarration) {
    if (visibleNarrationBlocks.length === 0) return null;
    return (
      <>
        {messageContext}
        <div className="flex w-fit max-w-full justify-start">
          <div
            data-testid="message-bot-bubble"
            className={cn(
              "max-w-full space-y-2 bg-muted px-3 py-2 text-body text-foreground",
              bubbleRadiusClass("bot", cluster),
            )}
            dir="auto"
          >
            {visibleNarrationBlocks.map((block, i) => {
              if (block.kind === "text" || block.kind === "progress") {
                return (
                  <div key={`${message.id}:${i}`}>
                    <ChatMarkdown streaming={block.kind === "progress"}>{block.text}</ChatMarkdown>
                  </div>
                );
              }
              return null;
            })}
            {!isLive && voiceReady && message.blocks.some((block) => block.kind === "text") ? (
              <button
                type="button"
                aria-label={speaking ? t`Stop speaking` : t`Speak this reply`}
                onClick={onSpeak}
                className="text-caption text-muted-foreground hover:text-foreground"
              >
                {speaking ? <Trans>Stop</Trans> : <Trans>Speak</Trans>}
              </button>
            ) : null}
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {messageContext}
      {message.blocks.map((block, i) => {
        if (isToolActivityBlock(block)) return null;
        if (block.kind === "handoff") {
          const from = memberName?.(block.fromBotId) ?? t`bot`;
          const to = memberName?.(block.toBotId) ?? t`bot`;
          return (
            <SystemRow key={`${message.id}:${i}`} icon="↪">
              {to} ← {from} {block.text}
            </SystemRow>
          );
        }
        if (block.kind === "bot_message_sent" || block.kind === "bot_message_received") {
          const sent = block.kind === "bot_message_sent";
          const peer = sent ? block.toBotName : block.fromBotName;
          const peerBotId = sent ? block.toBotId : block.fromBotId;
          const look = peerBot(peerBotId);
          const label =
            block.text && isRateLimitError(block.text)
              ? t`${peer} rate-limited`
              : sent
                ? t`Messaged ${peer}`
                : t`Message from ${peer}`;
          return (
            <CollaborationMarker
              key={`${message.id}:${i}`}
              ariaLabel={label}
              color={resolveAvatarColor(peerBotId, look?.color)}
              shape={look?.avatarShape}
              identity={peerBotId}
              imageSrc={botImageSrc({
                id: peerBotId,
                hasAvatar: look?.hasAvatar,
                updatedAt: look?.updatedAt,
              })}
              label={label}
              onClick={() => onOpenPeerMessages({ peerBotId, peerBotName: peer })}
            />
          );
        }
        if (block.kind === "channel_message") {
          return (
            <SystemRow key={`${message.id}:${i}`} icon="·">
              {messageProviderLabel(block.provider, block.transport)} · {block.fromLabel}:{" "}
              {block.text}
            </SystemRow>
          );
        }
        if (block.kind === "meta") {
          const routine = /routine/i.test(block.text);
          const memory = /memory/i.test(block.text);
          return (
            <SystemRow
              key={`${message.id}:${i}`}
              icon={
                routine ? (
                  <RefreshCw strokeWidth={2} />
                ) : memory ? (
                  <MemoryStick strokeWidth={2} />
                ) : (
                  <RefreshCw strokeWidth={2} />
                )
              }
            >
              {block.text}
            </SystemRow>
          );
        }
        if (block.kind === "progress") {
          return (
            <div key={`${message.id}:${i}`} className="flex w-fit max-w-full justify-start">
              <div
                data-testid="message-bot-bubble"
                className={cn(
                  "max-w-full bg-muted px-3 py-2 text-body text-foreground",
                  bubbleRadiusClass("bot", cluster),
                )}
                dir="auto"
              >
                <ChatMarkdown streaming>{block.text}</ChatMarkdown>
              </div>
            </div>
          );
        }
        if (block.kind === "subagent") {
          const running = block.status === "running";
          const failed = block.status === "failed";
          return (
            <div
              key={`${message.id}:${i}`}
              className="w-[min(420px,90%)] rounded-[18px] border border-border bg-muted px-[18px] py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-foreground" dir="auto">
                  {block.name}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-small ${
                    failed
                      ? "bg-destructive/15 text-destructive"
                      : running
                        ? "bg-warning/15 text-warning"
                        : "bg-success/15 text-success"
                  }`}
                  style={{
                    animation: running ? "rkPulse 1.2s ease-in-out infinite" : undefined,
                  }}
                >
                  {running ? <Trans>subagent</Trans> : block.status}
                </span>
              </div>
              <div className="mt-2 text-small text-muted-foreground">{block.task}</div>
              {block.progress || block.result ? (
                <div className="mt-2.5 text-body text-foreground/75">
                  <ChatMarkdown streaming={running}>
                    {block.result || block.progress || ""}
                  </ChatMarkdown>
                </div>
              ) : null}
            </div>
          );
        }
        if (block.kind === "child_bot") {
          const removed = block.status === "deleted" || block.status === "archived";
          return (
            <button
              key={`${message.id}:${i}`}
              type="button"
              disabled={removed}
              onClick={() => onOpenBot(block.botId)}
              className="w-[min(340px,90%)] rounded-[18px] border border-border bg-muted px-[18px] py-4 text-start disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-foreground" dir="auto">
                  {block.name}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-small ${
                    removed ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                  }`}
                >
                  {block.status === "archived" ? (
                    <Trans>archived</Trans>
                  ) : block.status === "deleted" ? (
                    <Trans>deleted</Trans>
                  ) : (
                    <Trans>bot</Trans>
                  )}
                </span>
              </div>
              <div className="mt-2 text-body text-foreground/75" dir="auto">
                {removed
                  ? block.status === "archived"
                    ? t`Archived. Chat, memory, and files kept.`
                    : t`Removed with chat, computer, and memory.`
                  : block.title || t`Opened its thread.`}
              </div>
            </button>
          );
        }
        if (block.kind === "choice") {
          const botId = "botId" in artifactTarget ? artifactTarget.botId : message.botId;
          if (!botId) return null;
          return (
            <ChoiceCard
              key={`${message.id}:${i}`}
              botId={botId}
              block={block}
              onBotChanged={onBotChanged}
            />
          );
        }
        if (block.kind === "app_connect") {
          const botId = "botId" in artifactTarget ? artifactTarget.botId : message.botId;
          if (!botId) return null;
          return (
            <div key={`${message.id}:${i}`} className="flex justify-start pb-2">
              <AppConnectCard botId={botId} block={block} />
            </div>
          );
        }
        if (block.kind === "chart") {
          return (
            <div key={`${message.id}:${i}`} className="flex justify-start">
              <ChartBlockView name={block.name} spec={block.spec} data={block.data} />
            </div>
          );
        }
        if (block.kind === "mcp_approval") {
          return (
            <div key={`${message.id}:${i}`} className="flex justify-start">
              <McpApprovalCard
                botId={"botId" in artifactTarget ? artifactTarget.botId : message.botId}
                name={block.name}
                serverId={block.serverId}
                transport={block.transport}
                endpoint={block.endpoint}
                needsOAuth={block.needsOAuth}
              />
            </div>
          );
        }
        if (block.kind === "image") {
          return (
            <div
              key={`${message.id}:${i}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <ArtifactImage
                target={artifactTarget}
                artifactId={block.artifactId}
                name={block.name}
              />
            </div>
          );
        }
        if (block.kind === "file") {
          return (
            <div
              key={`${message.id}:${i}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <ArtifactFileCard
                target={artifactTarget}
                artifactId={block.artifactId}
                name={block.name}
                mimeType={block.mimeType}
                size={block.size}
              />
            </div>
          );
        }
        if (block.kind === "text" && message.role === "user") {
          return (
            <div key={`${message.id}:${i}`} className="flex w-fit max-w-full justify-end">
              <div
                data-testid="message-user-bubble"
                className={cn(
                  "max-w-full whitespace-pre-wrap wrap-anywhere bg-chat-user px-3 py-2 text-body text-chat-user-foreground",
                  bubbleRadiusClass("user", cluster),
                )}
                dir="auto"
              >
                {findQuery ? highlightQuery(block.text, findQuery) : block.text}
              </div>
            </div>
          );
        }
        if (block.kind === "text") {
          return (
            <div key={`${message.id}:${i}`} className="flex w-fit max-w-full justify-start">
              <div
                data-testid="message-bot-bubble"
                className={cn(
                  "max-w-full bg-muted px-3 py-2 text-body text-foreground",
                  bubbleRadiusClass("bot", cluster),
                )}
                dir="auto"
              >
                <ChatMarkdown>{block.text}</ChatMarkdown>
                {voiceReady ? (
                  <button
                    type="button"
                    aria-label={speaking ? t`Stop speaking` : t`Speak this reply`}
                    onClick={onSpeak}
                    className="mt-2 text-caption text-muted-foreground hover:text-foreground"
                  >
                    {speaking ? <Trans>Stop</Trans> : <Trans>Speak</Trans>}
                  </button>
                ) : null}
              </div>
            </div>
          );
        }
        if (block.kind === "card") {
          return (
            <div key={`${message.id}:${i}`} className="flex justify-start">
              <div className="flex flex-col gap-2 rounded-[20px] bg-muted px-5 py-4">
                {block.lines.map((line) => (
                  <div key={line.k} className="flex items-baseline gap-2.5 text-body">
                    <span className="text-success">✓</span>
                    <span className="font-semibold text-foreground">{line.k}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{line.v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (block.kind === "ask") {
          return (
            <AskCard
              key={`${message.id}:${i}`}
              block={block}
              canAnswer={canAnswer}
              actorName={speakerName}
              onAnswer={(text) => onAnswer(message, text)}
            />
          );
        }
        if (block.kind === "cloud_agent")
          return <CloudAgentCard key={`${message.id}:${i}`} block={block} />;
        if (block.kind === "skill_draft") {
          return (
            <div key={`${message.id}:${i}`} className="flex justify-start">
              <SkillDraftCard block={block} onRefresh={onRefresh} onAddRoutine={onAddRoutine} />
            </div>
          );
        }
        if (block.kind === "computer") {
          const gate =
            block.state === "Needs you" ||
            block.status === "answered" ||
            block.status === "dismissed";
          if (gate) {
            return (
              <ComputerHandoffCard
                key={`${message.id}:${i}`}
                text={block.text}
                status={block.status}
                onOpenComputer={onOpenComputer}
              />
            );
          }
          return (
            <SystemRow key={`${message.id}:${i}`} icon={<Monitor strokeWidth={2} />}>
              {block.text || block.state}
            </SystemRow>
          );
        }
        return null;
      })}
    </>
  );
});
