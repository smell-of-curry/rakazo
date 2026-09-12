import type { Bot, Group, ProductEvent, ThreadSnapshot } from "@rakazo/contracts";
import { isRunTerminalEvent, runThreadSubscription } from "@rakazo/core";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";
import { rpc } from "../../lib/rpc";
import { isComputerStatusEvent } from "../../lib/thread-events";
import { applyThreadEvent, threadSnapshotSignal } from "./thread-events";
import type { ComputerCacheEntry } from "./use-computer";

export type UseThreadSubscriptionArgs = {
  active: Bot | undefined;
  activeGroup: Group | undefined;
  groupId: string | undefined;
  searchParamsRef: MutableRefObject<URLSearchParams>;
  pinnedAroundRef: MutableRefObject<unknown>;
  screenRequest: MutableRefObject<number>;
  setComputerError: Dispatch<SetStateAction<string | null>>;
  setComputerErrorFromScreen: Dispatch<SetStateAction<boolean>>;
  computerCacheRef: MutableRefObject<Map<string, ComputerCacheEntry>>;
  setScreenUrl: Dispatch<SetStateAction<string | null>>;
  commitComputer: (next: import("@rakazo/contracts").ComputerStatus | null) => void;
  expandedHistoryThread: MutableRefObject<string | null>;
  historyEpoch: MutableRefObject<number>;
  bootstrappedThread: MutableRefObject<ThreadSnapshot | null>;
  refreshThread: (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null>;
  refreshGroupThread: (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null>;
  snapshotRef: MutableRefObject<ThreadSnapshot | null>;
  terminalRunReceipts: MutableRefObject<Set<string>>;
  commitSnapshot: (next: ThreadSnapshot | null) => void;
  computerRef: MutableRefObject<import("@rakazo/contracts").ComputerStatus | null>;
  botsRef: MutableRefObject<Bot[]>;
  notifyBrowserForEvent: (
    event: Pick<ProductEvent, "id" | "type" | "threadId" | "seq" | "botId" | "payload">,
    subscribedThreadId: string | undefined,
    initialCursor: number,
    streamReady: boolean,
    botName: string,
    enabled: boolean,
    groupNotification: boolean,
  ) => void;
  setBots: Dispatch<SetStateAction<Bot[]>>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
  markBotReadIfVisible: (id: string) => void;
  refreshComputerScreen: (id: string) => Promise<unknown>;
  manuallyUnread: MutableRefObject<Set<string>>;
  readVisibleGroups: MutableRefObject<Set<string>>;
};

export function useThreadSubscription(args: UseThreadSubscriptionArgs) {
  const {
    active,
    activeGroup,
    groupId,
    searchParamsRef,
    pinnedAroundRef,
    screenRequest,
    setComputerError,
    setComputerErrorFromScreen,
    computerCacheRef,
    setScreenUrl,
    commitComputer,
    expandedHistoryThread,
    historyEpoch,
    bootstrappedThread,
    refreshThread,
    refreshGroupThread,
    snapshotRef,
    terminalRunReceipts,
    commitSnapshot,
    computerRef,
    botsRef,
    notifyBrowserForEvent,
    setBots,
    setGroups,
    refreshBots,
    markBotReadIfVisible,
    refreshComputerScreen,
    manuallyUnread,
    readVisibleGroups,
  } = args;

  useEffect(() => {
    if (!active) return;
    const pendingJump = searchParamsRef.current.get("m");
    if (!pendingJump) {
      pinnedAroundRef.current = null;
    }
    screenRequest.current += 1;
    setComputerError(null);
    setComputerErrorFromScreen(false);
    const cached = computerCacheRef.current.get(active.id);
    if (cached) {
      setScreenUrl(cached.screenUrl);
      commitComputer(cached.computer);
    } else {
      setScreenUrl(null);
    }
    expandedHistoryThread.current = null;
    historyEpoch.current += 1;
    const abort = new AbortController();
    void runThreadSubscription({
      signal: abort.signal,
      loadInitial: async () => {
        const primed = bootstrappedThread.current;
        bootstrappedThread.current = null;
        return primed?.botId === active.id
          ? primed
          : pendingJump
            ? rpc.threads.get({ botId: active.id }, { signal: threadSnapshotSignal(abort.signal) })
            : refreshThread(active.id, threadSnapshotSignal(abort.signal));
      },
      loadHead: () =>
        rpc.threads.head({ botId: active.id }, { signal: threadSnapshotSignal(abort.signal) }),
      refresh: () => refreshThread(active.id, threadSnapshotSignal(abort.signal)),
      currentSnapshot: () => snapshotRef.current,
      subscribe: (cursor) =>
        rpc.threads.subscribe({ botId: active.id, cursor }, { signal: abort.signal }),
      beforeEvent: (event) => {
        if (isRunTerminalEvent(event) && event.runId) {
          terminalRunReceipts.current.add(event.runId);
          if (terminalRunReceipts.current.size > 100) {
            const oldest = terminalRunReceipts.current.values().next().value;
            if (oldest !== undefined) terminalRunReceipts.current.delete(oldest);
          }
        }
      },
      applyEvent: (event) =>
        applyThreadEvent(event, commitSnapshot, commitComputer, snapshotRef, computerRef),
      onEvent: (event, initial) => {
        const currentBot = botsRef.current.find((bot) => bot.id === active.id);
        notifyBrowserForEvent(
          event,
          initial.threadId,
          initial.cursor,
          true,
          currentBot?.name ?? active.name,
          currentBot?.notifyOnFinish ?? false,
          false,
        );
        if (event.type === "thread.cleared") {
          expandedHistoryThread.current = null;
          pinnedAroundRef.current = null;
          historyEpoch.current += 1;
        }
        if (event.type === "run.waiting_input" || event.type === "computer.takeover.requested") {
          const waiting = event.type === "run.waiting_input" ? "waiting_input" : "waiting_takeover";
          if (event.botId) {
            setBots((current) =>
              current.map((bot) =>
                bot.id === event.botId && bot.status !== waiting
                  ? { ...bot, status: waiting }
                  : bot,
              ),
            );
          }
        }
        if (event.type === "bot.archived") {
          void refreshBots(true).catch(() => undefined);
        } else if (
          event.type === "bot.spawned" ||
          event.type === "bot.deleted" ||
          event.type === "run.started" ||
          isRunTerminalEvent(event) ||
          event.type === "thread.cleared" ||
          event.type === "run.waiting_input" ||
          event.type === "computer.takeover.requested"
        ) {
          void refreshBots().catch(() => undefined);
        }
        if (event.type === "thread.message.created") {
          const blocks = (event.payload.blocks as Array<{ kind?: string }>) ?? [];
          if (blocks.some((block) => block.kind === "child_bot")) {
            void refreshBots().catch(() => undefined);
          }
          if (event.payload.role === "bot") markBotReadIfVisible(active.id);
        }
        if (
          isRunTerminalEvent(event) ||
          event.type === "run.waiting_input" ||
          event.type === "skill.teaching.stopped"
        ) {
          void refreshThread(active.id).catch(() => undefined);
        } else if (isComputerStatusEvent(event)) {
          void refreshComputerScreen(active.id).catch(() => undefined);
        }
      },
    });
    return () => {
      abort.abort();
    };
  }, [active?.id, markBotReadIfVisible, notifyBrowserForEvent]);

  useEffect(() => {
    if (!groupId || !activeGroup) return;
    manuallyUnread.current.delete(activeGroup.id);
    readVisibleGroups.current.delete(groupId);
    const markVisibleGroupRead = () => {
      if (
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        readVisibleGroups.current.has(groupId)
      )
        return;
      readVisibleGroups.current.add(groupId);
      void rpc.threads
        .markRead({ groupId })
        .then(() => {
          setGroups((current) => {
            const group = current.find((candidate) => candidate.id === groupId);
            if (!group?.unread) return current;
            return current.map((candidate) =>
              candidate.id === groupId ? { ...candidate, unread: false } : candidate,
            );
          });
        })
        .catch(() => {
          readVisibleGroups.current.delete(groupId);
        });
    };
    markVisibleGroupRead();
    window.addEventListener("focus", markVisibleGroupRead);
    document.addEventListener("visibilitychange", markVisibleGroupRead);
    const pendingJump = searchParamsRef.current.get("m");
    if (!pendingJump) {
      pinnedAroundRef.current = null;
      expandedHistoryThread.current = null;
    }
    historyEpoch.current += 1;
    const abort = new AbortController();
    void runThreadSubscription({
      signal: abort.signal,
      loadInitial: () =>
        pendingJump
          ? rpc.threads.get({ groupId }, { signal: threadSnapshotSignal(abort.signal) })
          : refreshGroupThread(groupId, threadSnapshotSignal(abort.signal)),
      loadHead: () => rpc.threads.head({ groupId }, { signal: threadSnapshotSignal(abort.signal) }),
      refresh: () => refreshGroupThread(groupId, threadSnapshotSignal(abort.signal)),
      currentSnapshot: () => snapshotRef.current,
      subscribe: (cursor) => rpc.threads.subscribe({ groupId, cursor }, { signal: abort.signal }),
      applyEvent: (event) =>
        applyThreadEvent(event, commitSnapshot, commitComputer, snapshotRef, computerRef),
      onEvent: (event, initial) => {
        const eventBot = botsRef.current.find((bot) => bot.id === event.botId);
        notifyBrowserForEvent(
          event,
          initial.threadId,
          initial.cursor,
          true,
          eventBot?.name ?? activeGroup.name,
          true,
          true,
        );
        if (event.type === "thread.message.created" && event.payload.role === "bot") {
          readVisibleGroups.current.delete(groupId);
          markVisibleGroupRead();
        }
        if (event.type === "run.waiting_input" || event.type === "computer.takeover.requested") {
          const waiting = event.type === "run.waiting_input" ? "waiting_input" : "waiting_takeover";
          if (event.botId) {
            setBots((current) =>
              current.map((bot) =>
                bot.id === event.botId && bot.status !== waiting
                  ? { ...bot, status: waiting }
                  : bot,
              ),
            );
          }
        }
        if (
          event.type === "run.started" ||
          isRunTerminalEvent(event) ||
          event.type === "run.waiting_input" ||
          event.type === "computer.takeover.requested"
        ) {
          void refreshBots().catch(() => undefined);
        }
        if (isRunTerminalEvent(event) || event.type === "run.waiting_input") {
          void refreshGroupThread(groupId).catch(() => undefined);
        }
      },
    });
    return () => {
      window.removeEventListener("focus", markVisibleGroupRead);
      document.removeEventListener("visibilitychange", markVisibleGroupRead);
      abort.abort();
    };
  }, [activeGroup?.id, groupId, notifyBrowserForEvent]);
}
