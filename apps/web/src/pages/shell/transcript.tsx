import { useLingui } from "@lingui/react/macro";
import type { MessageReaction, ThreadMessage } from "@rakazo/contracts";
import {
  bubbleCluster,
  formatThreadTimestamp,
  isComposerDockedAskMessage,
  isPeerReceiptBlocks,
  isRateLimitError,
  isToolActivityBlock,
  parseRateLimitRetrySeconds,
  projectMessageReactions,
  shouldInsertThreadTimestamp,
  threadMovedDown,
  threadSenderKey,
} from "@rakazo/core";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web";
import { ArrowDown } from "lucide-react";
import type { RefObject } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActiveBotGlyph } from "../../components/ai/CollaborationMarker";
import type { PeerReceiptPeerLook } from "../../components/ai/PeerReceiptCluster";
import { PeerReceiptCluster } from "../../components/ai/PeerReceiptCluster";
import { messageHoverRevealClass } from "../../components/MessageHoverMetadata";
import type { ArtifactTarget } from "../../lib/artifact-open";
import { condensePeerReceipts } from "../../lib/condense-peer-receipts";
import { transcriptIsNearEnd } from "../../lib/transcript-scroll";
import { collectFindMatches, type FindableMessage, FindInChat } from "./find-in-chat";
import { MessageHoverActions, MessageView, previewMessageText } from "./message-view";

export const Transcript = memo(function Transcript({
  scrollRef,
  artifactTarget,
  messages,
  olderCursor,
  loadingOlder,
  answerableAskMessageId,
  running,
  workingBots,
  isGroup = false,
  computerBooting = false,
  botName,
  findOpen,
  onFindOpenChange,
  onOpenComputer,
  onLoadOlder,
  onOpenBot,
  onAnswer,
  onReply,
  onReact,
  onJumpToMessage,
  onOpenPeerMessages,
  memberName,
  peerBot,
  onRefresh,
  onBotChanged,
  onAddRoutine,
  voiceReady,
  speakingMessageId,
  onSpeak,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  artifactTarget: ArtifactTarget;
  messages: ThreadMessage[];
  olderCursor: number | null;
  loadingOlder: boolean;
  answerableAskMessageId: string | null;
  running: boolean;
  workingBots: GroupAvatarMember[];
  isGroup?: boolean;
  computerBooting?: boolean;
  botName?: string;
  findOpen?: boolean;
  onFindOpenChange?: (open: boolean) => void;
  onOpenComputer?: () => void;
  onLoadOlder: () => void | Promise<void>;
  onOpenBot: (botId: string) => void;
  onAnswer: (message: ThreadMessage, text: string) => Promise<void>;
  onReply: (message: ThreadMessage) => void;
  onReact: (message: ThreadMessage, reaction: MessageReaction) => Promise<void>;
  onJumpToMessage: (messageId: string) => void;
  onOpenPeerMessages: (peer: { peerBotId: string; peerBotName: string }) => void;
  memberName?: (botId: string | undefined) => string | undefined;
  peerBot: (botId: string) => PeerReceiptPeerLook | undefined;
  onRefresh: () => Promise<void>;
  onBotChanged: () => Promise<void>;
  onAddRoutine: (name: string, prompt: string) => void;
  voiceReady: boolean;
  speakingMessageId: string | null;
  onSpeak: (message: ThreadMessage) => void;
}) {
  const { t } = useLingui();
  const [atEnd, setAtEnd] = useState(true);
  const following = useRef(true);
  const autoScrolling = useRef(false);
  const lastScrollTop = useRef<number | null>(null);
  const autoScrollTimer = useRef<number | undefined>(undefined);
  const jumpButtonRef = useRef<HTMLButtonElement>(null);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const reactionView = useMemo(() => projectMessageReactions(messages), [messages]);
  const workingBotName = workingBots.length === 1 ? workingBots[0]?.name : undefined;
  const workingLabel =
    workingBotName != null && workingBotName !== ""
      ? t`${workingBotName} is working`
      : t`Bots are working`;
  const visibleMessages = useMemo(
    () =>
      reactionView.visibleMessages.filter(
        (message) => !isComposerDockedAskMessage(message, answerableAskMessageId),
      ),
    [answerableAskMessageId, reactionView.visibleMessages],
  );
  const rows = useMemo(() => condensePeerReceipts(visibleMessages), [visibleMessages]);
  const findables = useMemo<FindableMessage[]>(
    () =>
      visibleMessages.map((message) => ({
        id: message.id,
        text: previewMessageText(message),
      })),
    [visibleMessages],
  );
  const findMatches = useMemo(
    () => collectFindMatches(findables, findQuery),
    [findables, findQuery],
  );
  const activeFindId = findMatches[findIndex];

  useEffect(() => {
    if (!activeFindId) return;
    const node = scrollRef.current?.querySelector(`[data-message-id="${activeFindId}"]`);
    node?.scrollIntoView({ block: "center" });
  }, [activeFindId, scrollRef]);

  const rateLimitText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message?.id.startsWith("progress:")) continue;
      for (const block of message.blocks) {
        if (block.kind === "progress" && isRateLimitError(block.text)) return block.text;
      }
    }
    return null;
  }, [messages]);
  const [retryLeft, setRetryLeft] = useState<number | undefined>();
  useEffect(() => {
    if (!rateLimitText) {
      setRetryLeft(undefined);
      return;
    }
    setRetryLeft(parseRateLimitRetrySeconds(rateLimitText));
  }, [rateLimitText]);
  const retryTicking = retryLeft != null && retryLeft > 0;
  useEffect(() => {
    if (!retryTicking) return;
    const timer = window.setInterval(() => {
      setRetryLeft((current) => (current == null || current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryTicking]);

  const snapToEnd = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    following.current = true;
    autoScrolling.current = false;
    setAtEnd(true);
    element.scrollTo({ top: element.scrollHeight, behavior: "auto" });
  }, [scrollRef]);

  const jumpToLatest = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    following.current = true;
    autoScrolling.current = !reducedMotion;
    setAtEnd(true);
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    window.clearTimeout(autoScrollTimer.current);
    autoScrollTimer.current = window.setTimeout(
      () => {
        autoScrolling.current = false;
      },
      reducedMotion ? 0 : 2_000,
    );
  }, [scrollRef]);

  useLayoutEffect(() => {
    if (following.current) snapToEnd();
  }, [messages, running, snapToEnd]);

  useLayoutEffect(() => {
    const button = jumpButtonRef.current;
    if (atEnd && button && document.activeElement === button) {
      button.blur();
    }
  }, [atEnd]);

  const loadOlder = useCallback(() => {
    const wasFollowing = following.current;
    following.current = false;
    autoScrolling.current = false;
    const pending = onLoadOlder();
    if (!pending) return;
    return Promise.resolve(pending).catch((error) => {
      const element = scrollRef.current;
      if (wasFollowing && element && transcriptIsNearEnd(element)) {
        following.current = true;
        setAtEnd(true);
      }
      throw error;
    });
  }, [onLoadOlder, scrollRef]);

  useEffect(
    () => () => {
      window.clearTimeout(autoScrollTimer.current);
    },
    [],
  );

  const hasProgressText = messages.some(
    (message) =>
      message.id.startsWith("progress:") &&
      message.blocks.some(
        (block) => block.kind === "progress" && !isToolActivityBlock(block) && Boolean(block.text),
      ),
  );

  return (
    <div className="relative flex min-h-0 flex-1">
      <FindInChat
        open={Boolean(findOpen)}
        query={findQuery}
        onQuery={(value) => {
          setFindQuery(value);
          setFindIndex(0);
        }}
        matches={findMatches}
        activeIndex={findIndex}
        onActiveIndex={setFindIndex}
        onClose={() => onFindOpenChange?.(false)}
      />
      <div
        ref={scrollRef}
        data-testid="transcript"
        onPointerDown={(event) => {
          lastScrollTop.current = event.currentTarget.scrollTop;
          autoScrolling.current = false;
          following.current = false;
        }}
        onTouchStart={(event) => {
          lastScrollTop.current = event.currentTarget.scrollTop;
          autoScrolling.current = false;
          following.current = false;
        }}
        onWheel={(event) => {
          if (event.deltaY < 0) {
            lastScrollTop.current = event.currentTarget.scrollTop;
            autoScrolling.current = false;
            following.current = false;
          }
        }}
        onScroll={(event) => {
          const scrolledDown = threadMovedDown(
            lastScrollTop.current,
            event.currentTarget.scrollTop,
          );
          lastScrollTop.current = event.currentTarget.scrollTop;
          const nearEnd = transcriptIsNearEnd(event.currentTarget);
          setAtEnd(nearEnd);
          if (nearEnd) {
            if (scrolledDown) following.current = true;
            if (autoScrolling.current) {
              autoScrolling.current = false;
              window.clearTimeout(autoScrollTimer.current);
            }
          } else if (!autoScrolling.current) {
            following.current = false;
          }
        }}
        className="rk-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 md:px-7 md:py-6"
      >
        {olderCursor != null ? (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
            className="self-center rounded-lg px-3 py-1.5 text-body text-muted-foreground hover:bg-muted hover:text-foreground/75 disabled:opacity-50"
          >
            {loadingOlder ? t`Loading…` : t`Load earlier messages`}
          </button>
        ) : null}
        {rows.map((row, index) => {
          if (row.type === "peerCluster") {
            const first = row.messages[0]!;
            const stamp = rowTimestamp(rows, index, first, (message) =>
              isPeerReceiptBlocks(message.blocks),
            );
            return (
              <div key={first.id} data-message-id={first.id} className="py-0.5">
                {stamp}
                <PeerReceiptCluster
                  messages={row.messages}
                  sentOnly={row.sentOnly}
                  peerBot={peerBot}
                  onOpenPeer={onOpenPeerMessages}
                />
              </div>
            );
          }
          const message = row.message;
          if (!message.blocks.some((block) => !isToolActivityBlock(block))) return null;
          const peerReceipt = isPeerReceiptBlocks(message.blocks);
          const messageReactions = reactionView.reactions.get(message.id);
          const prevMessage = previousBubble(rows, index);
          const nextMessage = nextBubble(rows, index);
          const senderKey = threadSenderKey(message);
          const cluster = bubbleCluster(
            Boolean(prevMessage && threadSenderKey(prevMessage) === senderKey && !peerReceipt),
            Boolean(nextMessage && threadSenderKey(nextMessage) === senderKey && !peerReceipt),
          );
          const findHit = findQuery.trim() && findMatches.includes(message.id);
          const stamp = rowTimestamp(rows, index, message, (candidate) =>
            isPeerReceiptBlocks(candidate.blocks),
          );
          return (
            <div
              key={message.id}
              data-message-id={message.id}
              data-find-hit={findHit ? "" : undefined}
              data-find-active={activeFindId === message.id ? "" : undefined}
              className={cn(
                peerReceipt ? "py-0.5" : "group/message relative",
                cluster === "first" || cluster === "single" ? "mt-2" : "mt-0.5",
                findHit && "[&_mark]:bg-warning/30",
              )}
            >
              {stamp}
              <div
                className={
                  peerReceipt
                    ? undefined
                    : `relative flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`
                }
              >
                {peerReceipt ? null : (
                  <time
                    data-testid="message-hover-time"
                    dateTime={message.createdAt}
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-caption text-muted-foreground ${messageHoverRevealClass} ${
                      message.role === "user" ? "start-0" : "end-0"
                    }`}
                  >
                    {formatThreadTimestamp(new Date(message.createdAt))}
                  </time>
                )}
                <div
                  data-testid={peerReceipt ? undefined : "message-bubble-frame"}
                  className={peerReceipt ? undefined : "relative w-fit min-w-0 max-w-[72%]"}
                >
                  {peerReceipt ? null : (
                    <MessageHoverActions
                      message={message}
                      side={message.role === "user" ? "start" : "end"}
                      onReply={onReply}
                      onReact={onReact}
                    />
                  )}
                  <MessageView
                    artifactTarget={artifactTarget}
                    message={message}
                    cluster={cluster}
                    isGroup={isGroup}
                    highlightQuery={findQuery}
                    canAnswer={message.id === answerableAskMessageId}
                    onOpenBot={onOpenBot}
                    onOpenPeerMessages={onOpenPeerMessages}
                    onOpenComputer={onOpenComputer}
                    onAnswer={onAnswer}
                    speakerName={
                      peerReceipt || message.role !== "bot" || !isGroup
                        ? undefined
                        : memberName?.(message.botId)
                    }
                    memberName={memberName}
                    peerBot={peerBot}
                    replyPreview={
                      message.replyToMessageId
                        ? messageById.get(message.replyToMessageId)
                        : undefined
                    }
                    replyToMessageId={message.replyToMessageId}
                    onJumpToMessage={onJumpToMessage}
                    onRefresh={onRefresh}
                    onBotChanged={onBotChanged}
                    onAddRoutine={onAddRoutine}
                    voiceReady={voiceReady}
                    speaking={speakingMessageId === message.id}
                    onSpeak={() => onSpeak(message)}
                  />
                </div>
              </div>
              {!peerReceipt && messageReactions ? (
                <div
                  data-testid="message-reactions"
                  className={cn(
                    "mt-1 flex flex-wrap gap-1",
                    message.role === "user" && "justify-end",
                  )}
                >
                  {[...messageReactions].map(([emoji, count]) => (
                    <span
                      key={emoji}
                      className="rounded-full border border-border bg-muted px-2 py-0.5 text-caption"
                    >
                      {emoji}
                      {count > 1 ? ` ${count}` : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {running && rateLimitText ? (
          <div data-testid="rate-limit-status" className="mt-2 flex justify-start" role="status">
            <div className="max-w-[72%] rounded-[18px] bg-muted px-3 py-2 text-body text-foreground">
              {retryLeft != null
                ? t`Rate limited · retrying in ${retryLeft}s`
                : t`Rate limited · retrying…`}
            </div>
          </div>
        ) : running && computerBooting ? (
          <div className="mt-2 flex justify-start" role="status">
            <div className="max-w-[72%] rounded-[18px] bg-muted px-3 py-2 text-body text-foreground">
              {t`Setting up ${botName ?? "Bot"}'s computer…`}
            </div>
          </div>
        ) : running && !hasProgressText ? (
          <div className="mt-2">
            <ActiveBotGlyph bots={workingBots} label={workingLabel} />
          </div>
        ) : null}
      </div>
      <button
        ref={jumpButtonRef}
        type="button"
        aria-label={t`Jump to latest`}
        aria-hidden={atEnd}
        tabIndex={atEnd ? -1 : 0}
        onClick={jumpToLatest}
        className={`absolute bottom-4 left-1/2 z-20 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-border bg-muted/95 text-foreground/75 shadow-md backdrop-blur transition-[opacity,transform,background-color] duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:bg-border motion-reduce:transition-none ${
          atEnd ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <ArrowDown size={17} strokeWidth={1.8} />
      </button>
    </div>
  );
});

function previousBubble(
  rows: ReturnType<typeof condensePeerReceipts<ThreadMessage>>,
  index: number,
): ThreadMessage | undefined {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const row = rows[cursor];
    if (row?.type === "message" && !isPeerReceiptBlocks(row.message.blocks)) return row.message;
  }
  return undefined;
}

function nextBubble(
  rows: ReturnType<typeof condensePeerReceipts<ThreadMessage>>,
  index: number,
): ThreadMessage | undefined {
  for (let cursor = index + 1; cursor < rows.length; cursor += 1) {
    const row = rows[cursor];
    if (row?.type === "message" && !isPeerReceiptBlocks(row.message.blocks)) return row.message;
  }
  return undefined;
}

function rowTimestamp(
  rows: ReturnType<typeof condensePeerReceipts<ThreadMessage>>,
  index: number,
  current: ThreadMessage,
  skip: (message: ThreadMessage) => boolean,
) {
  let previous: ThreadMessage | undefined;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const row = rows[cursor];
    if (!row) continue;
    const message = row.type === "peerCluster" ? row.messages[0] : row.message;
    if (!message || skip(message)) continue;
    previous = message;
    break;
  }
  const show = shouldInsertThreadTimestamp(
    previous ? { createdAt: previous.createdAt, senderKey: threadSenderKey(previous) } : undefined,
    { createdAt: current.createdAt, senderKey: threadSenderKey(current) },
  );
  if (!show) return null;
  return (
    <time
      dateTime={current.createdAt}
      data-testid="thread-timestamp"
      className="mb-2 block text-center text-caption text-muted-foreground"
    >
      {formatThreadTimestamp(new Date(current.createdAt))}
    </time>
  );
}
