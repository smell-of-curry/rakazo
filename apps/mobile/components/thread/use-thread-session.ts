import type {
  AgentSkillCatalogEntry,
  Connection,
  ConnectionCatalogItem,
  Routine,
} from "@rakazo/contracts";
import {
  canReactToThreadMessage,
  MESSAGE_REACTIONS,
  type MessageReaction,
} from "@rakazo/contracts";
import type {
  ComposerMention,
  CondensedTranscriptRow,
  SlashActionId,
  ThreadScrollAction,
  ThreadScrollState,
} from "@rakazo/core";
import {
  abortableDelay,
  attachmentsForThread,
  buildComposerMentionOptions,
  condensePeerReceipts,
  copyableMessageText,
  hasVisibleMessagePresentation,
  isBlankLiveProgress,
  isRateLimitError,
  isRunTerminalEvent,
  latestAnswerableAskMessageId,
  mentionChipKey,
  mentionStillInPrompt,
  needsYou,
  projectMessageReactions,
  rateLimitRetryDelayMs,
  resolveComposerSendPlan,
  SLASH_ACTIONS,
  serializeComposerPrompt,
  ThreadScrollBehavior,
  userVisibleMessages,
} from "@rakazo/core";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  AppState,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type ScrollView,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  applyMobileThreadEvent,
  blockText,
  currentApiBase,
  loadSessionToken,
  type MobileBot,
  type MobileGroup,
  type MobileMessage,
  type MobileMessagePage,
  type MobileSnapshot,
  mergeMobileSnapshot,
  prependMobileMessagePage,
  rpc,
  selectedSpaceId,
  shouldApplyMobileThreadRefresh,
  subscribeThread,
} from "../../lib/api";
import type { MobileArtifactTarget } from "../../lib/artifact-open";
import { botAvatarSrc } from "../../lib/bot-avatar-src";
import { confirmDeleteBot } from "../../lib/bot-lifecycle";
import { isHumanGateComposerError } from "../../lib/composer-human-gate";
import type { ComputerStatus } from "../../lib/computer";
import { cancelFocusPrompt, focusPromptThreadActive } from "../../lib/focus-prompt";
import { dateLocaleForUi, t, useI18n } from "../../lib/i18n";
import { saveLastBotId } from "../../lib/last-bot";
import {
  dismissThreadNotifications,
  resumeLiveNotifications,
  setOpenNotificationThread,
} from "../../lib/live-notifications";
import { presentMessageActionSheet } from "../../lib/message-action-sheet";
import { useResolvedAppearance } from "../../lib/native";
import {
  type PickedAttachment,
  pickDocuments,
  pickFromLibrary,
  takePhoto,
} from "../../lib/pick-attachments";
import { threadRefreshDelayMs } from "../../lib/refresh";
import {
  formatAttachmentSkip,
  isWorkingStatus,
  newClientNonce,
  threadComputerChip,
} from "../../lib/thread-ui";
import { speakText } from "../../lib/voice";
import type { MarkdownArtifactPreviewTarget } from "../markdown-artifact-preview";
import type { MessageActionProps, PendingAttachment } from "./types";

export function useThreadSession() {
  const colorScheme = useResolvedAppearance();
  const [botActionsOpen, setBotActionsOpen] = useState(false);
  const { t } = useI18n();
  const navigation = useNavigation();
  const router = useRouter();
  const { botId, groupId, name, messageId } = useLocalSearchParams<{
    botId?: string;
    groupId?: string;
    name?: string;
    messageId?: string;
  }>();
  const inGroup = Boolean(groupId);
  const scroll = useRef<FlatList<CondensedTranscriptRow<MobileMessage>>>(null);
  const pinnedScroll = useRef<ScrollView>(null);
  const scrollBehavior = useRef(new ThreadScrollBehavior());
  const userDragging = useRef(false);
  const loadingOlderContent = useRef(false);
  const expandedHistoryThread = useRef<string | null>(null);
  const historyEpoch = useRef(0);
  const jumpGeneration = useRef(0);
  const pinnedAroundRef = useRef<{
    botId?: string;
    groupId?: string;
    messageId: string;
    threadId: string;
    messages: readonly MobileMessage[];
    olderCursor: number | null;
  } | null>(null);
  const jumpScrollTarget = useRef<string | null>(null);
  const activeBotId = useRef(botId);
  activeBotId.current = botId;
  const activeGroupId = useRef(groupId);
  activeGroupId.current = groupId;
  const routeName = useRef(name);
  routeName.current = name;
  const mentionBotsRefreshGeneration = useRef(0);
  const mentionBotsAppliedGeneration = useRef(0);
  const readVisibleTarget = useRef<string | null>(null);
  const threadKey = groupId ?? botId;
  const [threadScrollState, setThreadScrollState] = useState<ThreadScrollState>(() =>
    scrollBehavior.current.state(),
  );
  useLayoutEffect(() => {
    scrollBehavior.current.openThread(threadKey ?? "");
    expandedHistoryThread.current = null;
    pinnedAroundRef.current = null;
    jumpScrollTarget.current = null;
    loadingOlderContent.current = false;
    setThreadScrollState(scrollBehavior.current.state());
  }, [threadKey]);
  const reducedMotion = useReducedMotion();
  const artifactTarget: MobileArtifactTarget | undefined = groupId
    ? { groupId }
    : botId
      ? { botId }
      : undefined;
  const [snap, setSnap] = useState<MobileSnapshot | null>(null);
  const activeThreadId = useRef<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [agentSkills, setAgentSkills] = useState<AgentSkillCatalogEntry[]>([]);
  const [mentionBots, setMentionBots] = useState<MobileBot[]>([]);
  const [mentionGroups, setMentionGroups] = useState<MobileGroup[]>([]);
  const [mentionRoutines, setMentionRoutines] = useState<Array<Routine & { botName?: string }>>([]);
  const [mentionConnectors, setMentionConnectors] = useState<
    Array<{
      id: string;
      name: string;
      authStatus: "connected" | "needs_auth";
      connectionId?: string;
    }>
  >([]);
  const [selectedMentions, setSelectedMentions] = useState<ComposerMention[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<AgentSkillCatalogEntry | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyTarget, setReplyTarget] = useState<MobileMessage | null>(null);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computer, setComputer] = useState<ComputerStatus | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState<MarkdownArtifactPreviewTarget | null>(
    null,
  );
  const reactionView = useMemo(
    () =>
      projectMessageReactions(
        userVisibleMessages(snap?.messages ?? [], { includePeerReceipts: true }).filter(
          (message) =>
            hasVisibleMessagePresentation(message.blocks) && !isBlankLiveProgress(message),
        ),
      ),
    [snap?.messages],
  );
  const visibleMessages = reactionView.visibleMessages;
  const latestMessageId = visibleMessages.at(-1)?.id ?? null;
  const activePendingAttachments = attachmentsForThread(pendingAttachments, threadKey);
  const composerMentionTargets = useMemo(
    () =>
      buildComposerMentionOptions({
        query: "",
        includeEveryone: inGroup,
        currentGroupId: groupId,
        bots: mentionBots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          color: bot.color,
          hasAvatar: bot.hasAvatar,
        })),
        groups: mentionGroups.map((group) => ({
          id: group.id,
          name: group.name,
        })),
        routines: mentionRoutines.map((routine) => ({
          id: routine.id,
          name: routine.name,
          crons: routine.crons,
          botId: routine.botId,
          botName: routine.botName,
        })),
        connectors: mentionConnectors,
      }),
    [groupId, inGroup, mentionBots, mentionConnectors, mentionGroups, mentionRoutines],
  );
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null || composerMentionTargets.length === 0) return [];
    const query = mentionQuery.trim().toLowerCase();
    return composerMentionTargets
      .filter((target) => !query || target.name.toLowerCase().startsWith(query))
      .slice(0, 10);
  }, [composerMentionTargets, mentionQuery]);
  const slashQueryNormalized = slashQuery?.trim().toLowerCase() ?? null;
  const slashSkillOptions =
    slashQuery !== null && mentionQuery === null
      ? agentSkills
          .filter((skill) => {
            if (!slashQueryNormalized) return true;
            return (
              skill.name.toLowerCase().includes(slashQueryNormalized) ||
              skill.description.toLowerCase().includes(slashQueryNormalized)
            );
          })
          .slice(0, 8)
      : [];
  const slashActionOptions =
    slashQuery !== null && mentionQuery === null
      ? SLASH_ACTIONS.filter((action) => {
          if (!slashQueryNormalized) return true;
          const label = t(action.label);
          return (
            action.label.toLowerCase().includes(slashQueryNormalized) ||
            label.toLowerCase().includes(slashQueryNormalized)
          );
        })
      : [];
  const currentBot = botId ? mentionBots.find((bot) => bot.id === botId) : undefined;
  const displayName = currentBot?.name ?? name;
  const notificationThreadId = snap?.threadId ?? currentBot?.threadId;
  activeThreadId.current = notificationThreadId;
  const currentBotStatus = snap ? snap.run?.status : currentBot?.status;
  const hasLiveProgress = visibleMessages.some((message) => message.id.startsWith("progress:"));
  const workingGroupBots = useMemo(() => {
    if (!inGroup) return [];
    const seen = new Set<string>();
    const working = snap?.activeRuns ?? (snap?.run ? [snap.run] : []);
    return working.flatMap((run) => {
      if (!run.botId || seen.has(run.botId) || !isWorkingStatus(run.status)) return [];
      const member = snap?.members?.find((candidate) => candidate.botId === run.botId);
      if (!member) return [];
      seen.add(run.botId);
      return [{ ...member, status: run.status }];
    });
  }, [inGroup, snap?.activeRuns, snap?.members, snap?.run]);
  const working = inGroup ? workingGroupBots.length > 0 : isWorkingStatus(currentBotStatus);

  useEffect(() => {
    void rpc<AgentSkillCatalogEntry[]>("agentSkills/list")
      .then(setAgentSkills)
      .catch(() => setAgentSkills([]));
  }, []);

  useEffect(() => {
    setThreadScrollState(scrollBehavior.current.state());
  }, [threadKey]);

  const refreshMentionBots = useCallback(async () => {
    if (!botId && !groupId) return;
    const generation = ++mentionBotsRefreshGeneration.current;
    const targetBotId = botId;
    try {
      const bots = await rpc<MobileBot[]>("bots/list");
      // Apply any successful response that is still the newest applied so far.
      // A later failed refresh must not discard an earlier success.
      if (generation < mentionBotsAppliedGeneration.current) return;
      if (targetBotId !== activeBotId.current) return;
      mentionBotsAppliedGeneration.current = generation;
      setMentionBots(bots);
      if (targetBotId) {
        const next = bots.find((bot) => bot.id === targetBotId);
        // Read the route name from a ref so renaming does not recreate this
        // callback (and restart the SSE subscription that depends on it).
        if (next?.name && next.name !== routeName.current) {
          router.setParams({ name: next.name });
        }
      }
    } catch {
      // Keep the last known roster if refresh fails.
    }
  }, [botId, groupId, router]);

  useEffect(() => {
    void refreshMentionBots();
    void rpc<MobileGroup[]>("groups/list")
      .then(setMentionGroups)
      .catch(() => setMentionGroups([]));
  }, [refreshMentionBots]);

  useEffect(() => {
    if (mentionBots.length === 0) {
      setMentionRoutines([]);
      setMentionConnectors([]);
      return;
    }
    let cancelled = false;
    const botNameById = new Map(mentionBots.map((bot) => [bot.id, bot.name]));
    void Promise.all(
      mentionBots.map((bot) =>
        rpc<Routine[]>("routines/list", { botId: bot.id })
          .then((rows) =>
            rows.map((routine) => ({
              ...routine,
              botName: botNameById.get(bot.id) ?? bot.name,
            })),
          )
          .catch(() => [] as Array<Routine & { botName?: string }>),
      ),
    ).then((lists) => {
      if (!cancelled) setMentionRoutines(lists.flat());
    });
    void Promise.all([
      rpc<Connection[]>("connections/list").catch(() => [] as Connection[]),
      rpc<ConnectionCatalogItem[]>("connections/catalog", {}).catch(
        () => [] as ConnectionCatalogItem[],
      ),
    ]).then(([connections, catalog]) => {
      if (cancelled) return;
      const connected = connections.filter((row) => row.status === "connected");
      const options: Array<{
        id: string;
        name: string;
        authStatus: "connected" | "needs_auth";
        connectionId?: string;
      }> = connected.map((row) => ({
        id: row.id,
        name: row.displayName,
        authStatus: "connected" as const,
        connectionId: row.id,
      }));
      for (const item of catalog) {
        if (item.connected || item.noAuth) continue;
        if (
          connected.some(
            (row) =>
              row.provider.toLowerCase() === item.slug.toLowerCase() ||
              row.displayName.toLowerCase() === item.name.toLowerCase(),
          )
        ) {
          continue;
        }
        options.push({
          id: `catalog:${item.connectorId}:${item.slug}`,
          name: item.name,
          authStatus: "needs_auth",
        });
      }
      setMentionConnectors(options);
    });
    return () => {
      cancelled = true;
    };
  }, [mentionBots]);

  function isCurrentTarget(targetBotId: string | undefined, targetGroupId: string | undefined) {
    return activeBotId.current === targetBotId && activeGroupId.current === targetGroupId;
  }

  const computerChip = threadComputerChip({
    state: computer?.state,
    takeoverRequested: computer?.takeoverRequested,
    runStatus: currentBotStatus,
  });

  useEffect(() => {
    if (!botId || inGroup) {
      setComputer(null);
      return;
    }
    let cancelled = false;
    void rpc<ComputerStatus>("computer/status", { botId })
      .then((next) => {
        if (!cancelled) setComputer(next);
      })
      .catch(() => {
        if (!cancelled) setComputer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [botId, currentBotStatus, inGroup]);

  function leaveBot() {
    router.dismissAll();
    router.replace("/");
  }

  function clearConversation() {
    if (!botId) return;
    setError(null);
    void rpc("threads/clear", { botId })
      .then(() => {
        expandedHistoryThread.current = null;
        pinnedAroundRef.current = null;
        historyEpoch.current += 1;
        setSnap((current) =>
          current ? { ...current, messages: [], olderCursor: null, run: null } : current,
        );
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : t("Could not clear conversation")),
      );
  }

  const botActions = [
    {
      text: t("Chat settings"),
      onPress: () =>
        router.push({
          pathname: "/bot-settings",
          params: { botId: botId ?? "" },
        }),
    },
    {
      text: t("Open computer"),
      onPress: () =>
        router.push({
          pathname: "/computer",
          params: { botId: botId ?? "", name: displayName ?? t("Bot") },
        }),
    },
    {
      text: t("Clear conversation"),
      destructive: true,
      onPress: () =>
        Alert.alert(
          t("Clear conversation?"),
          t(
            "This removes every message and stops current work. The bot, computer, memory, and routines are kept.",
          ),
          [
            { text: t("Cancel"), style: "cancel" },
            { text: t("Clear"), style: "destructive", onPress: clearConversation },
          ],
        ),
    },
    {
      text: t("Archive"),
      onPress: () =>
        void rpc("bots/archive", { botId })
          .then(leaveBot)
          .catch((error) =>
            Alert.alert(
              t("Could not archive bot"),
              error instanceof Error ? error.message : t("Try again."),
            ),
          ),
    },
    {
      text: t("Delete…"),
      destructive: true,
      onPress: () => confirmDeleteBot({ id: botId ?? "", name: displayName || t("Bot") }, leaveBot),
    },
  ];

  function showBotActions() {
    if (!botId) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: name || t("Bot"),
          userInterfaceStyle: colorScheme,
          options: [...botActions.map((action) => action.text), t("Cancel")],
          cancelButtonIndex: botActions.length,
          destructiveButtonIndex: botActions.flatMap((action, index) =>
            action.destructive ? [index] : [],
          ),
        },
        (index) => botActions[index]?.onPress(),
      );
      return;
    }
    setBotActionsOpen(true);
  }

  async function refresh() {
    if (!botId && !groupId) return;
    const targetBotId = botId;
    const targetGroupId = groupId;
    const epoch = historyEpoch.current;
    const next = await rpc<MobileSnapshot>(
      "threads/get",
      targetGroupId ? { groupId: targetGroupId } : { botId: targetBotId! },
    );
    if (
      !shouldApplyMobileThreadRefresh({
        requestEpoch: epoch,
        currentEpoch: historyEpoch.current,
        targetBotId,
        targetGroupId,
        activeBotId: activeBotId.current,
        activeGroupId: activeGroupId.current,
      })
    )
      return next;
    setSnap((prev) =>
      mergeMobileSnapshot(prev, next, expandedHistoryThread.current === next.threadId),
    );
    return next;
  }

  async function applyMessageJump(target: { botId?: string; groupId?: string; messageId: string }) {
    const threadTarget = target.groupId ? { groupId: target.groupId } : { botId: target.botId! };
    const epoch = historyEpoch.current;
    jumpGeneration.current += 1;
    const jumpId = jumpGeneration.current;
    const [snap, page] = await Promise.all([
      rpc<MobileSnapshot>("threads/get", threadTarget),
      rpc<MobileMessagePage>("threads/messages", {
        ...threadTarget,
        around: { messageId: target.messageId },
      }),
    ]);
    // The epoch check drops a jump that raced a conversation clear (or a bot switch); the
    // generation check drops an older same-thread jump that finished after a newer one.
    if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
    if (target.groupId && activeGroupId.current !== target.groupId) return;
    if (target.botId && activeBotId.current !== target.botId) return;
    const targetInPage = page.messages.some((message) => message.id === target.messageId);
    expandedHistoryThread.current = targetInPage ? page.threadId : null;
    pinnedAroundRef.current = targetInPage
      ? {
          ...threadTarget,
          messageId: target.messageId,
          threadId: page.threadId,
          messages: [...page.messages],
          olderCursor: page.olderCursor,
        }
      : null;
    jumpScrollTarget.current = targetInPage ? target.messageId : null;
    setSnap({
      ...snap,
      messages: targetInPage ? [...page.messages] : snap.messages,
      olderCursor: targetInPage ? page.olderCursor : snap.olderCursor,
    });
  }

  async function loadOlderMessages() {
    if ((!botId && !groupId) || snap?.olderCursor == null || loadingOlder) return;
    loadingOlderContent.current = true;
    setLoadingOlder(true);
    const epoch = historyEpoch.current;
    try {
      const page = await rpc<MobileMessagePage>("threads/messages", {
        ...(groupId ? { groupId } : { botId: botId! }),
        before: snap.olderCursor,
        includePeerReceipts: true,
      });
      if (epoch !== historyEpoch.current) {
        loadingOlderContent.current = false;
        return;
      }
      expandedHistoryThread.current = page.threadId;
      setSnap((prev) => prependMobileMessagePage(prev, page));
    } catch (err) {
      loadingOlderContent.current = false;
      setError(err instanceof Error ? err.message : t("Could not load earlier messages"));
    } finally {
      setLoadingOlder(false);
    }
  }

  const markReadIfVisible = useCallback(() => {
    if (AppState.currentState !== "active" || !navigation.isFocused()) return;
    const target = groupId ?? botId;
    if (!target || readVisibleTarget.current === target) return;
    readVisibleTarget.current = target;
    if (activeThreadId.current) {
      void dismissThreadNotifications({ threadId: activeThreadId.current }).catch(() => undefined);
    }
    if (groupId) {
      void rpc("threads/markRead", { groupId }).catch(() => {
        if (readVisibleTarget.current === target) readVisibleTarget.current = null;
      });
      return;
    }
    void rpc("threads/markRead", { botId: botId! }).catch(() => {
      if (readVisibleTarget.current === target) readVisibleTarget.current = null;
    });
  }, [botId, groupId, navigation]);

  useEffect(() => {
    if (!notificationThreadId || AppState.currentState !== "active" || !navigation.isFocused())
      return;
    void setOpenNotificationThread({ botId, threadId: notificationThreadId }).catch(
      () => undefined,
    );
    void dismissThreadNotifications({ threadId: notificationThreadId }).catch(() => undefined);
  }, [botId, navigation, notificationThreadId]);

  // Cancel delayed setup only when leaving this bot's thread (unmount or botId
  // change). Blur alone is not leave — settings/computer push must keep the timer.
  useEffect(() => {
    if (!botId) return;
    return () => {
      cancelFocusPrompt(botId);
    };
  }, [botId]);

  // Covers returning from a pushed screen; the AppState listener covers returning from background.
  useFocusEffect(
    useCallback(() => {
      if (botId) {
        focusPromptThreadActive(botId);
        void saveLastBotId(botId).catch(() => undefined);
      } else {
        // Group thread focus: prior bot screen may stay mounted, so clear any delayed setup.
        cancelFocusPrompt();
      }
      if (AppState.currentState === "active" && notificationThreadId) {
        void setOpenNotificationThread({
          botId,
          threadId: notificationThreadId,
        }).catch(() => undefined);
      }
      void refreshMentionBots();
      markReadIfVisible();
      return () => {
        void setOpenNotificationThread(null).catch(() => undefined);
      };
    }, [botId, markReadIfVisible, notificationThreadId, refreshMentionBots]),
  );

  useEffect(() => {
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (!navigation.isFocused() || !notificationThreadId) return;
        void setOpenNotificationThread({
          botId,
          threadId: notificationThreadId,
        }).catch(() => undefined);
        markReadIfVisible();
        return;
      }
      void setOpenNotificationThread(null).catch(() => undefined);
    });
    return () => appState.remove();
  }, [botId, markReadIfVisible, navigation, notificationThreadId]);

  useEffect(() => {
    if (!botId && !groupId) return;
    if (!messageId) {
      pinnedAroundRef.current = null;
      jumpScrollTarget.current = null;
    }
    expandedHistoryThread.current = null;
    historyEpoch.current += 1;
    const abort = new AbortController();
    void (async () => {
      // Pending search jumps load the around-page separately; avoid replacing it with latest.
      const next = messageId
        ? await rpc<MobileSnapshot>("threads/get", groupId ? { groupId } : { botId: botId! }).catch(
            (err: Error) => {
              setError(err.message);
              return null;
            },
          )
        : await refresh().catch((err: Error) => {
            setError(err.message);
            return null;
          });
      if (abort.signal.aborted) return;
      let cursor = next?.cursor ?? -1;
      let retryMs = 250;
      while (!abort.signal.aborted) {
        try {
          await subscribeThread(
            groupId ? { groupId } : { botId: botId! },
            cursor,
            (event) => {
              cursor = Math.max(cursor, event.seq ?? -1);
              retryMs = 250;
              if (
                event.type === "thread.progress" ||
                event.type === "agent.tool.called" ||
                event.type === "agent.tool.completed" ||
                event.type === "thread.message.created" ||
                event.type === "thread.message.updated" ||
                event.type === "thread.message.reaction" ||
                event.type === "thread.subagent" ||
                event.type === "thread.cloud_agent" ||
                event.type === "thread.cleared" ||
                event.type === "run.waiting_input" ||
                event.type === "computer.takeover.requested" ||
                isRunTerminalEvent(event)
              ) {
                if (event.type === "thread.cleared") {
                  expandedHistoryThread.current = null;
                  pinnedAroundRef.current = null;
                  historyEpoch.current += 1;
                }
                setSnap((prev) => applyMobileThreadEvent(prev, event));
              }
              if (event.type === "bot.updated") {
                void refreshMentionBots();
              }
              if (event.type === "thread.message.created" && event.payload?.role === "bot") {
                readVisibleTarget.current = null;
                markReadIfVisible();
              }
              if (isRunTerminalEvent(event)) {
                void refreshMentionBots();
                if (!jumpScrollTarget.current && !expandedHistoryThread.current) {
                  void refresh().catch(() => undefined);
                }
              }
            },
            abort.signal,
          );
        } catch {
          // A full refresh reconciles visible state; the event cursor still resumes without gaps.
        }
        if (abort.signal.aborted) break;
        if (!jumpScrollTarget.current && !expandedHistoryThread.current) {
          await refresh().catch(() => undefined);
        }
        await abortableDelay(retryMs, abort.signal);
        retryMs = Math.min(retryMs * 2, 5_000);
      }
    })();
    return () => {
      abort.abort();
    };
  }, [botId, groupId, markReadIfVisible, refreshMentionBots]);

  useEffect(() => {
    if (!botId && !groupId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (
        AppState.currentState === "active" &&
        navigation.isFocused() &&
        !jumpScrollTarget.current &&
        !expandedHistoryThread.current
      ) {
        await refresh().catch(() => undefined);
      }
      if (!cancelled) {
        timer = setTimeout(() => void tick(), threadRefreshDelayMs(snap?.run?.status));
      }
    };
    timer = setTimeout(() => void tick(), threadRefreshDelayMs(snap?.run?.status));
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [botId, groupId, navigation, snap?.run?.status]);

  useEffect(() => {
    if ((!botId && !groupId) || !messageId) return;
    void applyMessageJump(groupId ? { groupId, messageId } : { botId: botId!, messageId }).catch(
      (err) => {
        setError(err instanceof Error ? err.message : t("Could not open message"));
      },
    );
  }, [botId, groupId, messageId]);

  useEffect(() => {
    setPendingAttachments((current) => attachmentsForThread(current, threadKey));
    setDraft("");
    setMentionQuery(null);
    setSlashQuery(null);
    setSelectedSkill(null);
    setSelectedMentions([]);
    setReplyTarget(null);
    setAttachmentNotice(null);
    setError(null);
  }, [threadKey]);

  function updateDraft(value: string) {
    setDraft(value);
    setSelectedMentions((current) =>
      current.filter((mention) => mentionStillInPrompt(value, mention)),
    );
    const match = /(?:^|\s)@([\w-]*)$/.exec(value);
    setMentionQuery(match ? (match[1] ?? "") : null);
    const slashMatch = selectedSkill === null ? /^\/([^\n]*)$/.exec(value) : null;
    setSlashQuery(slashMatch ? (slashMatch[1] ?? "") : null);
  }

  function insertMention(mention: ComposerMention) {
    setDraft((current) => current.replace(/@([\w-]*)$/, `@${mention.name} `));
    setMentionQuery(null);
    setSelectedMentions((current) =>
      current.some((selected) => mentionChipKey(selected) === mentionChipKey(mention))
        ? current
        : [...current, mention],
    );
  }

  function insertSkill(skill: AgentSkillCatalogEntry) {
    setSelectedSkill(skill);
    setDraft("");
    setSlashQuery(null);
  }

  function removeLastChip() {
    if (selectedSkill) setSelectedSkill(null);
  }

  function serializeComposerPromptText(): string {
    return serializeComposerPrompt(draft, selectedSkill, selectedMentions);
  }

  function runSlashAction(action: SlashActionId) {
    setDraft("");
    setSlashQuery(null);
    if (action === "chat-settings") {
      if (inGroup && groupId) {
        router.push({ pathname: "/group-settings", params: { groupId } });
      } else if (botId) {
        router.push({ pathname: "/bot-settings", params: { botId } });
      }
      return;
    }
    router.push({
      pathname: "/account",
      params: action === "settings-usage" ? { focus: "usage" } : undefined,
    });
  }

  const canSend =
    Boolean(draft.trim()) ||
    selectedSkill !== null ||
    selectedMentions.length > 0 ||
    activePendingAttachments.length > 0;

  async function send() {
    const initialBotTarget = botId;
    const initialGroupTarget = groupId;
    if ((!initialBotTarget && !initialGroupTarget) || sending) return;
    const originThreadKey = initialGroupTarget ?? initialBotTarget;
    const attachments = attachmentsForThread(pendingAttachments, originThreadKey);
    const plan = resolveComposerSendPlan({
      text: serializeComposerPromptText(),
      mentions: selectedMentions,
      hasAttachments: attachments.length > 0,
    });
    if (plan.isNoOp) return;
    const reroutedToGroup = Boolean(
      plan.rerouteGroupId && plan.rerouteGroupId !== initialGroupTarget,
    );
    const groupTarget = plan.rerouteGroupId ?? initialGroupTarget;
    const botTarget = reroutedToGroup ? undefined : initialBotTarget;
    const trimmed = plan.trimmed;
    const dropDelayedSetup = () => {
      // Only after successful engagement so a failed upload/send keeps the setup card.
      // Covers group-mention reroute while the bot thread stays mounted underneath.
      if (initialBotTarget) cancelFocusPrompt(initialBotTarget);
    };
    setSending(true);
    setError(null);
    try {
      if (plan.shouldRunRoutines) {
        const sendNonce = newClientNonce();
        await Promise.all(
          plan.routineIds.map((routineId) =>
            rpc("routines/testRun", {
              routineId,
              clientNonce: `routine-mention:${sendNonce}:${routineId}`,
            }),
          ),
        );
      }
      const clearOriginComposer = () => {
        setPendingAttachments((current) =>
          current.filter((attachment) => attachment.threadKey !== originThreadKey),
        );
        setDraft("");
        setMentionQuery(null);
        setSlashQuery(null);
        setSelectedSkill(null);
        setSelectedMentions([]);
        setReplyTarget(null);
        setAttachmentNotice(null);
      };
      if (!plan.shouldSend) {
        dropDelayedSetup();
        clearOriginComposer();
        if (reroutedToGroup && groupTarget) {
          router.push({
            pathname: "/group-thread",
            params: {
              groupId: groupTarget,
              name: plan.rerouteGroupName ?? t("Group"),
            },
          });
          return;
        }
        if (isCurrentTarget(botTarget, groupTarget)) {
          await refresh();
        }
        return;
      }
      const artifactIds: string[] = [];
      for (const pending of attachments) {
        const artifact = await rpc<{ id: string }>("artifacts/create", {
          ...(groupTarget ? { groupId: groupTarget } : { botId: botTarget! }),
          name: pending.name,
          mimeType: pending.mimeType,
          contentBase64: pending.contentBase64,
        });
        artifactIds.push(artifact.id);
      }
      const clientNonce = newClientNonce();
      await rpc(
        "threads/send",
        groupTarget
          ? {
              groupId: groupTarget,
              clientNonce,
              text: trimmed || undefined,
              mentions: plan.mentionPayload.length ? plan.mentionPayload : undefined,
              artifactIds: artifactIds.length ? artifactIds : undefined,
              replyToMessageId: reroutedToGroup ? undefined : replyTarget?.id,
            }
          : {
              botId: botTarget!,
              clientNonce,
              text: trimmed || undefined,
              mentions: plan.mentionPayload.length ? plan.mentionPayload : undefined,
              artifactIds: artifactIds.length ? artifactIds : undefined,
              replyToMessageId: replyTarget?.id,
            },
      );
      dropDelayedSetup();
      void loadSessionToken()
        .then((token) => resumeLiveNotifications(currentApiBase(), token, selectedSpaceId() ?? ""))
        .catch(() => undefined);
      clearOriginComposer();
      if (reroutedToGroup && groupTarget) {
        router.push({
          pathname: "/group-thread",
          params: {
            groupId: groupTarget,
            name: plan.rerouteGroupName ?? t("Group"),
          },
        });
        return;
      }
      if (isCurrentTarget(botTarget, groupTarget)) {
        await refresh();
      }
    } catch (err) {
      if (reroutedToGroup && groupTarget) {
        setError(err instanceof Error ? err.message : t("Failed to send message"));
      } else if (isCurrentTarget(botTarget, groupTarget)) {
        setError(err instanceof Error ? err.message : t("Failed to send message"));
      }
    } finally {
      setSending(false);
    }
  }

  async function stop() {
    const targetBotId = botId;
    const targetGroupId = groupId;
    if ((!targetBotId && !targetGroupId) || sending) return;
    setSending(true);
    setError(null);
    try {
      await rpc(
        "threads/stop",
        targetGroupId ? { groupId: targetGroupId } : { botId: targetBotId! },
      );
    } catch (err) {
      if (isCurrentTarget(targetBotId, targetGroupId)) {
        setError(err instanceof Error ? err.message : t("Failed to stop work"));
      }
      setSending(false);
      return;
    }
    try {
      await refresh();
    } catch (err) {
      if (isCurrentTarget(targetBotId, targetGroupId)) {
        const detail = err instanceof Error ? err.message : t("Failed to refresh");
        setError(t("Work stopped, but the thread could not refresh: {detail}", { detail }));
      }
    } finally {
      setSending(false);
    }
  }

  const answerMessage = useCallback(
    async (message: MobileMessage, answer: string) => {
      const targetBotId = botId;
      const targetGroupId = groupId;
      if ((!targetBotId && !targetGroupId) || !message.runId) return;
      await rpc("threads/answer", {
        ...(targetGroupId ? { groupId: targetGroupId } : { botId: targetBotId! }),
        runId: message.runId,
        messageId: message.id,
        answer,
      });
      if (isCurrentTarget(targetBotId, targetGroupId)) await refresh();
    },
    [botId, groupId],
  );

  const openBot = useCallback(
    (id: string, botName: string) =>
      router.push({ pathname: "/thread", params: { botId: id, name: botName } }),
    [router],
  );

  const speak = useCallback(
    (message: MobileMessage) =>
      void speakMessage(message.botId ?? botId ?? snap?.members?.[0]?.botId ?? "", message).catch(
        (err) =>
          Alert.alert(t("Could not speak"), err instanceof Error ? err.message : t("Try again.")),
      ),
    [botId, snap?.members],
  );

  function showAttachMenu() {
    Alert.alert(t("Attach"), undefined, [
      {
        text: t("Photo library"),
        onPress: () => void addAttachments(pickFromLibrary),
      },
      { text: t("Camera"), onPress: () => void addAttachments(takePhoto) },
      { text: t("File"), onPress: () => void addAttachments(pickDocuments) },
      { text: t("Cancel"), style: "cancel" },
    ]);
  }

  async function addAttachments(
    picker: (existingCount: number) => Promise<{
      attachments: PickedAttachment[];
      skipped: Array<{ name: string; reason: string }>;
    }>,
  ) {
    const targetKey = groupId ?? botId;
    if (!targetKey) return;
    const result = await picker(activePendingAttachments.length);
    if ((groupId ?? botId) !== targetKey) return;
    if (result.attachments.length) {
      setPendingAttachments((current) => [
        ...current,
        ...result.attachments.map((attachment) => ({
          ...attachment,
          threadKey: targetKey,
        })),
      ]);
    }
    setAttachmentNotice(
      result.skipped.length
        ? t("Skipped {items}", {
            items: result.skipped.map((item) => formatAttachmentSkip(item)).join(", "),
          })
        : null,
    );
  }

  const answerableAskMessageId = latestAnswerableAskMessageId(snap);
  const gate = needsYou(snap);
  const hideComposerError = gate.kind !== null && isHumanGateComposerError(error);
  const runError = snap?.run?.status === "failed" ? (snap.run.error ?? null) : null;
  const transcriptRows = useMemo(() => condensePeerReceipts(visibleMessages), [visibleMessages]);
  const liveRows = useMemo(() => [...transcriptRows].reverse(), [transcriptRows]);
  const messagesById = useMemo(
    () => new Map((snap?.messages ?? []).map((message) => [message.id, message])),
    [snap?.messages],
  );
  const pinnedTarget = pinnedAroundRef.current;
  const showPinnedPage = Boolean(
    jumpScrollTarget.current ||
      (pinnedTarget &&
        ((pinnedTarget.botId && pinnedTarget.botId === botId) ||
          (pinnedTarget.groupId && pinnedTarget.groupId === groupId))),
  );

  function performScroll(action: ThreadScrollAction) {
    if (!action || showPinnedPage) return;
    scroll.current?.scrollToOffset({
      offset: 0,
      animated: action === "smooth" && !reducedMotion,
    });
  }

  function updateUserScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    // Inverted FlatList: contentOffset.y is distance from the latest messages.
    setThreadScrollState(
      scrollBehavior.current.onUserScroll(Math.max(0, event.nativeEvent.contentOffset.y)),
    );
  }

  async function reactToMessage(message: MobileMessage, reaction: MessageReaction) {
    const targetBotId = botId;
    const targetGroupId = groupId;
    if (!targetBotId && !targetGroupId) return;
    try {
      await rpc("threads/react", {
        ...(targetGroupId ? { groupId: targetGroupId } : { botId: targetBotId! }),
        messageId: message.id,
        reaction,
        clientNonce: newClientNonce(),
      });
    } catch (err) {
      if (!isCurrentTarget(targetBotId, targetGroupId)) return;
      setError(err instanceof Error ? err.message : t("Could not update reaction"));
    }
  }

  function messageActionProps(message: MobileMessage): MessageActionProps {
    const actions = [
      { name: "reply", text: t("Reply"), onPress: () => setReplyTarget(message) },
      ...(canReactToThreadMessage(message)
        ? [
            {
              name: "react",
              text: t("React"),
              onPress: () =>
                presentMessageActionSheet({
                  cancel: t("Cancel"),
                  more: t("More"),
                  colorScheme,
                  actions: MESSAGE_REACTIONS.map((emoji) => ({
                    name: emoji,
                    text: emoji,
                    onPress: () => void reactToMessage(message, emoji),
                  })),
                }),
            },
          ]
        : []),
      ...(message.role === "bot" && blockText(message)
        ? [{ name: "speak", text: t("Speak message"), onPress: () => void speak(message) }]
        : []),
      {
        name: "copy",
        text: t("Copy"),
        onPress: () => {
          const text = copyableMessageText(message);
          if (text) void Clipboard.setStringAsync(text).catch(() => undefined);
        },
      },
    ];
    return {
      onLongPress: () =>
        presentMessageActionSheet({
          actions,
          title: message.createdAt
            ? new Date(message.createdAt).toLocaleTimeString(dateLocaleForUi(), {
                hour: "numeric",
                minute: "2-digit",
              })
            : undefined,
          cancel: t("Cancel"),
          more: t("More"),
          colorScheme,
        }),
      accessibilityActions: actions.map((action) => ({ name: action.name, label: action.text })),
      onAccessibilityAction: (event) => {
        actions.find((action) => action.name === event.nativeEvent.actionName)?.onPress();
      },
    };
  }

  function peerLook(id: string) {
    const bot = mentionBots.find((item) => item.id === id);
    const member = snap?.members?.find((item) => item.botId === id);
    return {
      color: bot?.color ?? member?.color,
      shape: bot?.avatarShape ?? member?.avatarShape,
      status: bot?.status ?? member?.status,
      imageSrc: botAvatarSrc(
        bot ?? (member ? { botId: member.botId, hasAvatar: member.hasAvatar } : undefined),
      ),
    };
  }
  const rateLimitError =
    snap?.run?.error && isRateLimitError(snap.run.error) ? snap.run.error : null;
  const rateLimitSeconds = rateLimitError
    ? Math.max(1, Math.round(rateLimitRetryDelayMs(rateLimitError, 1) / 1000))
    : null;

  return {
    colorScheme,
    botId,
    groupId,
    inGroup,
    displayName,
    currentBot,
    currentBotStatus,
    computerKind: computerChip.kind,
    botActions,
    botActionsOpen,
    setBotActionsOpen,
    showBotActions,
    snap,
    mentionBots,
    working,
    workingGroupBots,
    hasLiveProgress,
    rateLimitSeconds,
    runError,
    error,
    hideComposerError,
    sending,
    canSend,
    draft,
    updateDraft,
    selectedSkill,
    setSelectedSkill,
    mentionOptions,
    insertMention,
    slashSkillOptions,
    slashActionOptions,
    insertSkill,
    runSlashAction,
    removeLastChip,
    replyTarget,
    setReplyTarget,
    attachmentNotice,
    activePendingAttachments,
    setPendingAttachments,
    showAttachMenu,
    send,
    stop,
    answerMessage,
    openBot,
    artifactTarget,
    markdownPreview,
    setMarkdownPreview,
    threadKey,
    scroll,
    pinnedScroll,
    scrollBehavior,
    userDragging,
    loadingOlderContent,
    jumpScrollTarget,
    pinnedAroundRef,
    expandedHistoryThread,
    threadScrollState,
    setThreadScrollState,
    showPinnedPage,
    liveRows,
    transcriptRows,
    latestMessageId,
    loadingOlder,
    loadOlderMessages,
    performScroll,
    updateUserScroll,
    answerableAskMessageId,
    messagesById,
    reactionView,
    messageActionProps,
    peerLook,
  };
}

async function speakMessage(botId: string, message: MobileMessage) {
  const text = blockText(message);
  if (!text.trim()) return;
  if (!(await speakText(text, { botId }))) {
    throw new Error(t("Add a voice provider in Voice settings."));
  }
}
