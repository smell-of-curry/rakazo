import type {
  Bot,
  ComputerStatus,
  Group,
  ProductEvent,
  Routine,
  TaughtSkill,
  ThreadMessage,
  ThreadSnapshot,
  VoiceStatus,
} from "@rakazo/contracts";
import {
  attachmentsForThread,
  searchHitThreadTarget,
  speechFromBlocks,
  userVisibleMessages,
} from "@rakazo/core";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction, SetURLSearchParams } from "react-router-dom";
import { revokePendingAttachmentPreviews } from "../../lib/pending-attachments";
import { markAfterPaint, markOnce } from "../../lib/performance";
import { rpc } from "../../lib/rpc";
import { prependThreadMessagePage, reconcileRefreshedThread } from "../../lib/thread-events";
import { transcriptCanSnapAfterFrame, transcriptIsNearEnd } from "../../lib/transcript-scroll";
import { speaker } from "../../lib/tts";
import { draftFromRoutine, type RoutineDraftState } from "../RoutineEditor";
import type { Panel, PendingAttachment } from "./types";
import type { ComputerCacheEntry } from "./use-computer";
import { useThreadSend } from "./use-thread-send";
import { useThreadSubscription } from "./use-thread-subscription";

export type ThreadComputerBridge = {
  computerRef: MutableRefObject<ComputerStatus | null>;
  computerCacheRef: MutableRefObject<Map<string, ComputerCacheEntry>>;
  commitComputer: (next: ComputerStatus | null) => void;
  cacheComputerFor: (botId: string, patch: Partial<ComputerCacheEntry>) => void;
  refreshComputerScreen: (id: string) => Promise<unknown>;
  setScreenUrl: Dispatch<SetStateAction<string | null>>;
  setComputerError: Dispatch<SetStateAction<string | null>>;
  setComputerErrorFromScreen: Dispatch<SetStateAction<boolean>>;
  setComputerOpen: Dispatch<SetStateAction<boolean>>;
  screenRequest: MutableRefObject<number>;
};

export type UseThreadSessionArgs = {
  inGroup: boolean;
  botId: string | undefined;
  groupId: string | undefined;
  active: Bot | undefined;
  activeGroup: Group | undefined;
  bots: Bot[];
  botsRef: MutableRefObject<Bot[]>;
  setBots: Dispatch<SetStateAction<Bot[]>>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
  markBotReadIfVisible: (id: string) => void;
  notifyBrowserForEvent: (
    event: Pick<ProductEvent, "id" | "type" | "threadId" | "seq" | "botId" | "payload">,
    subscribedThreadId: string | undefined,
    initialCursor: number,
    streamReady: boolean,
    botName: string,
    enabled: boolean,
    groupNotification: boolean,
  ) => void;
  flushPendingBrowserNotifications: () => void;
  callOpen: boolean;
  setVoiceStatus: Dispatch<SetStateAction<VoiceStatus | null>>;
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  searchParamsRef: MutableRefObject<URLSearchParams>;
  setPanel: Dispatch<SetStateAction<Panel>>;
  computerBridgeRef: MutableRefObject<ThreadComputerBridge | null>;
  setRoutines: Dispatch<SetStateAction<Routine[]>>;
  setRoutinesBotId: Dispatch<SetStateAction<string | null>>;
  routines: Routine[];
  routinesBotId: string | null;
  setTaughtSkills: Dispatch<SetStateAction<TaughtSkill[]>>;
  setTaughtSkillsBotId: Dispatch<SetStateAction<string | null>>;
  taughtSkills: TaughtSkill[];
  taughtSkillsBotId: string | null;
  teachBusy: boolean;
  setTeachBusy: Dispatch<SetStateAction<boolean>>;
  setRoutineDraft: Dispatch<SetStateAction<RoutineDraftState>>;
  setRoutineWebhookSecret: Dispatch<SetStateAction<string | null>>;
  setEditingRoutine: Dispatch<SetStateAction<Routine | null>>;
  bootstrappedThread: MutableRefObject<ThreadSnapshot | null>;
  refreshThreadRef: MutableRefObject<
    (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null | undefined>
  >;
  cancelFocusPrompt: () => void;
  focusPromptBotIdRef: MutableRefObject<string | null>;
  initialBotsLoaded: boolean;
  manuallyUnread: MutableRefObject<Set<string>>;
  readVisibleGroups: MutableRefObject<Set<string>>;
};

function bridgeRef<T>(
  computerBridgeRef: MutableRefObject<ThreadComputerBridge | null>,
  read: (bridge: ThreadComputerBridge) => MutableRefObject<T>,
  fallback: T,
): MutableRefObject<T> {
  return {
    get current() {
      const bridge = computerBridgeRef.current;
      return bridge ? read(bridge).current : fallback;
    },
    set current(value) {
      const bridge = computerBridgeRef.current;
      if (bridge) read(bridge).current = value;
    },
  };
}

export function useThreadSession(args: UseThreadSessionArgs) {
  const {
    inGroup,
    groupId,
    active,
    activeGroup,
    bots,
    botsRef,
    setBots,
    setGroups,
    refreshBots,
    markBotReadIfVisible,
    notifyBrowserForEvent,
    flushPendingBrowserNotifications,
    callOpen,
    setVoiceStatus,
    navigate,
    searchParams,
    setSearchParams,
    searchParamsRef,
    setPanel,
    computerBridgeRef,
    setRoutines,
    setRoutinesBotId,
    routines,
    routinesBotId,
    setTaughtSkills,
    setTaughtSkillsBotId,
    taughtSkills,
    taughtSkillsBotId,
    teachBusy,
    setTeachBusy,
    setRoutineDraft,
    setRoutineWebhookSecret,
    setEditingRoutine,
    bootstrappedThread,
    refreshThreadRef,
    cancelFocusPrompt,
    focusPromptBotIdRef,
    initialBotsLoaded,
    manuallyUnread,
    readVisibleGroups,
  } = args;

  const [snapshot, setSnapshot] = useState<ThreadSnapshot | null>(null);
  const snapshotRef = useRef<ThreadSnapshot | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyTarget, setReplyTarget] = useState<ThreadMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadRefreshEpoch = useRef(0);
  const groupRefreshEpoch = useRef(0);
  const terminalRunReceipts = useRef(new Set<string>());

  function commitSnapshot(next: ThreadSnapshot | null) {
    snapshotRef.current = next;
    setSnapshot(next);
  }

  function updateSnapshot(update: (prev: ThreadSnapshot | null) => ThreadSnapshot | null) {
    commitSnapshot(update(snapshotRef.current));
  }

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const expandedHistoryThread = useRef<string | null>(null);
  const historyEpoch = useRef(0);
  const jumpGeneration = useRef(0);
  const initiallyScrolledThread = useRef<string | null>(null);
  const messageScroll = useRef<HTMLDivElement>(null);
  const pinnedAroundRef = useRef<{
    botId?: string;
    groupId?: string;
    messageId: string;
    threadId: string;
    messages: ThreadMessage[];
    olderCursor: number | null;
  } | null>(null);
  const autoSpoken = useRef<string | null>(null);
  const autoSpokenBotId = useRef<string | null>(null);

  const activePendingAttachments = useMemo(
    () => attachmentsForThread(pendingAttachments, inGroup ? groupId : active?.id),
    [active?.id, groupId, inGroup, pendingAttachments],
  );
  const activeBotId = useRef<string | undefined>(inGroup ? undefined : active?.id);
  activeBotId.current = inGroup ? undefined : active?.id;
  const activeGroupId = useRef<string | undefined>(groupId);
  activeGroupId.current = groupId;

  function commitComputer(next: ComputerStatus | null) {
    computerBridgeRef.current?.commitComputer(next);
  }
  function cacheComputerFor(botId: string, patch: Partial<ComputerCacheEntry>) {
    computerBridgeRef.current?.cacheComputerFor(botId, patch);
  }
  function refreshComputerScreen(id: string) {
    return computerBridgeRef.current?.refreshComputerScreen(id) ?? Promise.resolve(null);
  }
  const computerRef = bridgeRef(computerBridgeRef, (bridge) => bridge.computerRef, null);
  const computerCacheRef = bridgeRef(
    computerBridgeRef,
    (bridge) => bridge.computerCacheRef,
    new Map<string, ComputerCacheEntry>(),
  );
  const screenRequest = bridgeRef(computerBridgeRef, (bridge) => bridge.screenRequest, 0);
  const setScreenUrl: Dispatch<SetStateAction<string | null>> = (value) => {
    computerBridgeRef.current?.setScreenUrl(value);
  };
  const setComputerError: Dispatch<SetStateAction<string | null>> = (value) => {
    computerBridgeRef.current?.setComputerError(value);
  };
  const setComputerErrorFromScreen: Dispatch<SetStateAction<boolean>> = (value) => {
    computerBridgeRef.current?.setComputerErrorFromScreen(value);
  };

  function snapTranscriptToEndAfterFrame() {
    const queuedElement = messageScroll.current;
    if (!queuedElement) return;
    const queuedScrollTop = queuedElement.scrollTop;
    window.requestAnimationFrame(() => {
      const element = messageScroll.current;
      if (transcriptCanSnapAfterFrame(element, queuedElement, queuedScrollTop)) {
        queuedElement.scrollTop = queuedElement.scrollHeight;
      }
    });
  }

  async function refreshGroupThread(id: string, signal?: AbortSignal) {
    const scrollElement = messageScroll.current;
    const stickToEnd = !scrollElement || transcriptIsNearEnd(scrollElement);
    markOnce("rk:renderer:thread-request-start");
    const request = ++groupRefreshEpoch.current;
    const snap = await rpc.threads.get({ groupId: id }, signal ? { signal } : undefined);
    markOnce("rk:renderer:thread-response");
    if (activeGroupId.current !== id || request !== groupRefreshEpoch.current) return snap;
    const reconciled = reconcileRefreshedThread(
      snapshotRef.current,
      snap,
      computerRef.current,
      expandedHistoryThread.current === snap.threadId,
    );
    commitSnapshot(reconciled.snapshot);
    commitComputer(null);
    setRoutines([]);
    setRoutinesBotId(null);
    if (
      stickToEnd &&
      (!scrollElement || transcriptIsNearEnd(scrollElement)) &&
      expandedHistoryThread.current !== snap.threadId
    ) {
      snapTranscriptToEndAfterFrame();
    }
    return snap;
  }

  async function refreshThread(id: string, signal?: AbortSignal) {
    const scrollElement = messageScroll.current;
    const stickToEnd = !scrollElement || transcriptIsNearEnd(scrollElement);
    markOnce("rk:renderer:thread-request-start");
    const epoch = historyEpoch.current;
    const request = ++threadRefreshEpoch.current;
    const snap = await rpc.threads.get({ botId: id }, signal ? { signal } : undefined);
    markOnce("rk:renderer:thread-response");
    if (
      activeBotId.current !== id ||
      epoch !== historyEpoch.current ||
      request !== threadRefreshEpoch.current
    ) {
      return snap;
    }
    const reconciled = reconcileRefreshedThread(
      snapshotRef.current,
      snap,
      computerRef.current,
      expandedHistoryThread.current === snap.threadId,
    );
    commitSnapshot(reconciled.snapshot);
    commitComputer(reconciled.computer);
    cacheComputerFor(id, { computer: reconciled.computer });
    if (
      stickToEnd &&
      (!scrollElement || transcriptIsNearEnd(scrollElement)) &&
      expandedHistoryThread.current === snap.threadId
    ) {
      snapTranscriptToEndAfterFrame();
    }
    void Promise.all([
      rpc.routines.list({ botId: id }).catch(() => null),
      rpc.skills.list({ botId: id }).catch(() => null),
      refreshComputerScreen(id).catch(() => null),
    ]).then(([nextRoutines, skills]) => {
      if (
        activeBotId.current !== id ||
        epoch !== historyEpoch.current ||
        request !== threadRefreshEpoch.current
      ) {
        return;
      }
      if (nextRoutines) {
        setRoutines(nextRoutines);
        setRoutinesBotId(id);
      }
      if (skills) {
        setTaughtSkills(skills);
        setTaughtSkillsBotId(id);
      }
    });
    return snap;
  }

  async function loadOlderMessages() {
    const targetBotId = inGroup ? undefined : active?.id;
    const targetGroupId = inGroup ? groupId : undefined;
    const snapshotMatchesTarget = targetGroupId
      ? snapshot?.groupId === targetGroupId
      : snapshot?.botId === targetBotId;
    if (
      (!targetBotId && !targetGroupId) ||
      !snapshotMatchesTarget ||
      snapshot?.olderCursor == null ||
      loadingOlder
    )
      return;
    pinnedAroundRef.current = null;
    const scrollElement = messageScroll.current;
    const previousHeight = scrollElement?.scrollHeight ?? 0;
    const epoch = historyEpoch.current;
    const before = snapshot.olderCursor;
    setLoadingOlder(true);
    try {
      const page = await rpc.threads.messages({
        ...(targetGroupId ? { groupId: targetGroupId } : { botId: targetBotId! }),
        before,
      });
      if (
        epoch !== historyEpoch.current ||
        activeBotId.current !== targetBotId ||
        activeGroupId.current !== targetGroupId
      )
        return;
      expandedHistoryThread.current = page.threadId;
      updateSnapshot((prev) => prependThreadMessagePage(prev, page));
      window.requestAnimationFrame(() => {
        const element = messageScroll.current;
        if (element) element.scrollTop += element.scrollHeight - previousHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    void rpc.voice
      .status()
      .then(setVoiceStatus)
      .catch(() => undefined);
    const unsubSpeech = speaker.subscribe((state) => {
      setSpeakingMessageId(state.status === "idle" ? null : (state.messageId ?? null));
    });
    return () => {
      unsubSpeech();
    };
  }, []);

  useEffect(() => {
    if (!active || !snapshot || snapshot.botId !== active.id) return;
    const lastBot = [...snapshot.messages].reverse().find((message) => message.role === "bot");
    if (autoSpokenBotId.current !== active.id) {
      autoSpokenBotId.current = active.id;
      autoSpoken.current = lastBot?.id ?? null;
      return;
    }
    if (callOpen || !active.autoSpeak) {
      autoSpoken.current = lastBot?.id ?? null;
      return;
    }
    if (snapshot.run && ["running", "queued", "leased"].includes(snapshot.run.status)) return;
    if (!lastBot || lastBot.id === autoSpoken.current) return;
    const text = speechFromBlocks(lastBot.blocks);
    if (!text) return;
    autoSpoken.current = lastBot.id;
    void speaker.speak(text, { botId: active.id, messageId: lastBot.id });
  }, [
    snapshot?.messages,
    snapshot?.run?.status,
    snapshot?.botId,
    active?.autoSpeak,
    active?.id,
    callOpen,
  ]);

  useEffect(() => {
    if (!active) return;
    manuallyUnread.current.delete(active.id);
    const markVisibleBotRead = () => {
      markBotReadIfVisible(active.id);
    };
    markVisibleBotRead();
    window.addEventListener("focus", markVisibleBotRead);
    document.addEventListener("visibilitychange", markVisibleBotRead);
    return () => {
      window.removeEventListener("focus", markVisibleBotRead);
      document.removeEventListener("visibilitychange", markVisibleBotRead);
    };
  }, [active?.id, markBotReadIfVisible, manuallyUnread]);

  useThreadSubscription({
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
  });

  async function jumpToMessage(target: { botId?: string; groupId?: string; messageId: string }) {
    const threadTarget = searchHitThreadTarget(target);
    const epoch = historyEpoch.current;
    jumpGeneration.current += 1;
    const jumpId = jumpGeneration.current;
    const [snap, page] = await Promise.all([
      rpc.threads.get(threadTarget),
      rpc.threads.messages({ ...threadTarget, around: { messageId: target.messageId } }),
    ]);
    if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
    if (target.groupId && activeGroupId.current !== target.groupId) return;
    if (target.botId && activeBotId.current !== target.botId) return;
    const targetInPage = userVisibleMessages(page.messages, { includePeerReceipts: true }).some(
      (message) => message.id === target.messageId,
    );
    expandedHistoryThread.current = targetInPage ? page.threadId : null;
    pinnedAroundRef.current = targetInPage
      ? {
          ...threadTarget,
          messageId: target.messageId,
          threadId: page.threadId,
          messages: page.messages,
          olderCursor: page.olderCursor,
        }
      : null;
    if (targetInPage) initiallyScrolledThread.current = page.threadId;
    commitSnapshot({
      ...snap,
      messages: targetInPage ? page.messages : snap.messages,
      olderCursor: targetInPage ? page.olderCursor : snap.olderCursor,
    });
    if (threadTarget.botId) {
      commitComputer(snap.computer ?? null);
      void rpc.routines
        .list({ botId: threadTarget.botId })
        .then((nextRoutines) => {
          if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
          if (activeBotId.current !== threadTarget.botId) return;
          setRoutines(nextRoutines);
          setRoutinesBotId(threadTarget.botId);
        })
        .catch(() => undefined);
    } else {
      commitComputer(null);
      setRoutines([]);
      setRoutinesBotId(null);
    }
    window.requestAnimationFrame(() => {
      if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
      if (!targetInPage) {
        const element = messageScroll.current;
        if (element) {
          element.scrollTop = element.scrollHeight;
          initiallyScrolledThread.current = page.threadId;
        }
        return;
      }
      document
        .querySelector(`[data-message-id="${target.messageId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  useEffect(() => {
    const messageId = searchParams.get("m");
    const routineId = searchParams.get("routine");
    if (inGroup && groupId && messageId) {
      void jumpToMessage({ groupId, messageId }).finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("m");
        setSearchParams(next, { replace: true });
      });
      return;
    }
    if (!active) return;
    if (routineId && routinesBotId === active.id) {
      const routine = routines.find((item) => item.id === routineId);
      if (routine) {
        setRoutineDraft(draftFromRoutine(routine));
        setRoutineWebhookSecret(null);
        setEditingRoutine(routine);
        setPanel("routine");
      } else {
        setPanel("computer");
      }
      const next = new URLSearchParams(searchParams);
      next.delete("routine");
      setSearchParams(next, { replace: true });
    }
    if (messageId) {
      void jumpToMessage({ botId: active.id, messageId }).finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("m");
        setSearchParams(next, { replace: true });
      });
    }
  }, [active?.id, groupId, inGroup, routines, routinesBotId, searchParams, setSearchParams]);

  const activeSnapshot = inGroup
    ? snapshot?.groupId === groupId
      ? snapshot
      : null
    : snapshot?.botId === active?.id
      ? snapshot
      : null;
  const activeReplyTarget =
    replyTarget && activeSnapshot?.messages.some((message) => message.id === replyTarget.id)
      ? replyTarget
      : null;

  refreshThreadRef.current = refreshThread;
  const refreshGroupThreadRef = useRef(refreshGroupThread);
  refreshGroupThreadRef.current = refreshGroupThread;
  const loadOlderMessagesRef = useRef(loadOlderMessages);
  loadOlderMessagesRef.current = loadOlderMessages;
  const jumpToMessageRef = useRef(jumpToMessage);
  jumpToMessageRef.current = jumpToMessage;

  const shellReady =
    initialBotsLoaded &&
    (inGroup
      ? Boolean(activeGroup && activeSnapshot)
      : bots.length === 0 || Boolean(active && activeSnapshot));

  useLayoutEffect(() => {
    if (initialBotsLoaded) {
      markOnce("rk:renderer:bots-committed");
      markAfterPaint("rk:renderer:bots-painted");
    }
    if (active && snapshot?.botId === active.id) {
      markOnce("rk:renderer:thread-committed");
      markAfterPaint("rk:renderer:thread-painted");
    }
    if (shellReady) {
      markOnce("rk:renderer:shell-ready");
      markAfterPaint("rk:renderer:shell-painted");
    }
  }, [active, initialBotsLoaded, shellReady, snapshot?.botId]);

  useLayoutEffect(() => {
    const pin = pinnedAroundRef.current;
    if (inGroup) {
      if (!groupId || !snapshot || snapshot.groupId !== groupId) return;
      if (initiallyScrolledThread.current === snapshot.threadId) return;
      if (expandedHistoryThread.current === snapshot.threadId) return;
      if (pin?.groupId === groupId) return;
    } else {
      if (!active || !snapshot || snapshot.botId !== active.id) return;
      if (initiallyScrolledThread.current === snapshot.threadId) return;
      if (expandedHistoryThread.current === snapshot.threadId) return;
      if (pin?.botId === active.id) return;
    }
    const element = messageScroll.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    initiallyScrolledThread.current = snapshot.threadId;
  }, [active, groupId, inGroup, snapshot?.botId, snapshot?.groupId, snapshot?.threadId]);

  const openBot = useCallback((id: string) => navigate(`/app/${id}`), [navigate]);
  const loadOlder = useCallback(() => loadOlderMessagesRef.current(), []);
  const jumpToReplyMessage = useCallback((messageId: string) => {
    const existing = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (existing) {
      jumpGeneration.current += 1;
      existing.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const nextGroupId = activeGroupId.current;
    if (nextGroupId) {
      void jumpToMessageRef.current({ groupId: nextGroupId, messageId });
      return;
    }
    const nextBotId = activeBotId.current;
    if (nextBotId) void jumpToMessageRef.current({ botId: nextBotId, messageId });
  }, []);

  const send = useThreadSend({
    navigate,
    activeBotId,
    activeGroupId,
    botsRef,
    sending,
    setSending,
    setSendError,
    pendingAttachments,
    setPendingAttachments,
    setAttachmentNotice,
    fileInputRef,
    setReplyTarget,
    activeReplyTarget,
    refreshThreadRef,
    refreshGroupThreadRef,
    updateSnapshot,
    terminalRunReceipts,
    flushPendingBrowserNotifications,
    refreshBots,
    cancelFocusPrompt,
    focusPromptBotIdRef,
    teachBusy,
    setTeachBusy,
    taughtSkills,
    taughtSkillsBotId,
    setTaughtSkills,
    setTaughtSkillsBotId,
    setComputerOpen: (value) => {
      computerBridgeRef.current?.setComputerOpen(value);
    },
    setRoutineDraft,
    setRoutineWebhookSecret,
    setEditingRoutine,
    setPanel,
    computerRef,
    commitComputer,
    speakingMessageId,
  });

  useEffect(() => {
    const threadKey = inGroup ? groupId : active?.id;
    setPendingAttachments((current) => {
      const stale = current.filter((attachment) => attachment.threadKey !== threadKey);
      revokePendingAttachmentPreviews(stale);
      return attachmentsForThread(current, threadKey);
    });
    setReplyTarget(null);
    setAttachmentNotice(null);
    setSendError(null);
  }, [active?.id, groupId, inGroup]);

  return {
    snapshot,
    snapshotRef,
    commitSnapshot,
    updateSnapshot,
    pendingAttachments,
    setPendingAttachments,
    replyTarget,
    setReplyTarget,
    sending,
    sendError,
    setSendError,
    attachmentNotice,
    fileInputRef,
    speakingMessageId,
    loadingOlder,
    messageScroll,
    expandedHistoryThread,
    pinnedAroundRef,
    historyEpoch,
    activePendingAttachments,
    activeBotId,
    activeGroupId,
    refreshThread,
    refreshGroupThread,
    activeSnapshot,
    activeReplyTarget,
    shellReady,
    openBot,
    loadOlder,
    jumpToReplyMessage,
    ...send,
  };
}
