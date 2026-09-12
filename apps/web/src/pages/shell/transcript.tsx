import { i18n } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import type { MessageReaction, ThreadMessage } from "@rakazo/contracts";
import {
  isComposerDockedAskMessage,
  isPeerReceiptBlocks,
  isToolActivityBlock,
  projectMessageReactions,
} from "@rakazo/core";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web";
import { ArrowDown } from "lucide-react";
import type { RefObject } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActiveBotGlyph } from "../../components/ai/CollaborationMarker";
import type { PeerReceiptPeerLook } from "../../components/ai/PeerReceiptCluster";
import { PeerReceiptCluster } from "../../components/ai/PeerReceiptCluster";
import type { ArtifactTarget } from "../../lib/artifact-open";
import { condensePeerReceipts } from "../../lib/condense-peer-receipts";
import { transcriptIsNearEnd, transcriptMovedDown } from "../../lib/transcript-scroll";
import { MessageHoverActions, MessageView } from "./message-view";

export const Transcript = memo(function Transcript({
  scrollRef,
  artifactTarget,
  messages,
  olderCursor,
  loadingOlder,
  answerableAskMessageId,
  running,
  workingBots,
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
    // Fallback only: onScroll clears autoScrolling once near-end is reached.
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
    // Prepend must not race the messages-driven snap-to-end follow path.
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

  return (
    <div className="relative flex min-h-0 flex-1">
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
          const scrolledDown = transcriptMovedDown(
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
        className="rk-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-5 md:px-7 md:py-6"
      >
        {olderCursor != null ? (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
            className="self-center rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground/75 disabled:opacity-50"
          >
            {loadingOlder ? t`Loading…` : t`Load earlier messages`}
          </button>
        ) : null}
        {condensePeerReceipts(
          reactionView.visibleMessages.filter(
            (message) => !isComposerDockedAskMessage(message, answerableAskMessageId),
          ),
        ).map((row) => {
          if (row.type === "peerCluster") {
            return (
              <div
                key={row.messages[0]!.id}
                data-message-id={row.messages[0]!.id}
                className="relative py-0.5"
              >
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
          return (
            <div
              key={message.id}
              data-message-id={message.id}
              className={peerReceipt ? "relative py-0.5" : "group/message relative hover:z-20"}
            >
              {!peerReceipt && !message.id.startsWith("progress:") ? (
                <time
                  dateTime={message.createdAt}
                  data-testid="message-hover-time"
                  className={cn(
                    "pointer-events-none absolute top-1 z-10 text-xs tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 group-has-[[aria-expanded=true]]/message:opacity-100",
                    message.role === "user" ? "start-0" : "end-0",
                  )}
                >
                  {new Date(message.createdAt).toLocaleTimeString(i18n.locale || "en", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              ) : null}
              <div
                className={
                  peerReceipt
                    ? undefined
                    : `relative flex ${message.role === "user" ? "justify-end" : "justify-start"}`
                }
              >
                <div
                  data-testid={peerReceipt ? undefined : "message-bubble-frame"}
                  className={
                    peerReceipt
                      ? undefined
                      : `relative w-fit min-w-0 ${
                          message.role === "user"
                            ? "max-w-[min(70%,calc(100%_-_6rem))]"
                            : "max-w-[min(74%,calc(100%_-_6rem))]"
                        }`
                  }
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
                    canAnswer={message.id === answerableAskMessageId}
                    onOpenBot={onOpenBot}
                    onOpenPeerMessages={onOpenPeerMessages}
                    onAnswer={onAnswer}
                    speakerName={
                      peerReceipt
                        ? undefined
                        : message.role === "bot"
                          ? memberName?.(message.botId)
                          : undefined
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
                      className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
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
        {running &&
        !messages.some(
          (message) =>
            message.id.startsWith("progress:") &&
            message.blocks.some(
              (block) =>
                block.kind === "progress" && !isToolActivityBlock(block) && Boolean(block.text),
            ),
        ) ? (
          <ActiveBotGlyph bots={workingBots} label={workingLabel} />
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
