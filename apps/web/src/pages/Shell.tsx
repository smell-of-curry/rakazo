import { Trans, useLingui } from "@lingui/react/macro";
import type { ComputerStatus, Routine, ThreadSnapshot } from "@rakazo/contracts";
import {
  buildComposerMentionOptions,
  isActive,
  latestAnswerableAskMessageId,
  userVisibleMessages,
} from "@rakazo/core";
import { Button, type GroupAvatarMember } from "@rakazo/ui-web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { readActivityMode, writeActivityMode } from "../lib/activity-mode";
import type { ArtifactTarget } from "../lib/artifact-open";
import { authClient } from "../lib/auth";
import { botImageSrc } from "../lib/bot-image-src";
import { readSeenRunErrorIds, rememberSeenRunErrorId } from "../lib/run-error-storage";
import { activeThreadRuns, threadRunError, userHoldsComputerControl } from "../lib/thread-events";
import { memberName } from "./GroupPanel";
import { askBlockFromMessage, latestComputerNeedsYouText } from "./shell/composer-human-gate";
import { embeddableScreenUrl } from "./shell/computer-screen";
import { ShellLayout } from "./shell/shell-layout";
import type { Panel } from "./shell/types";
import { FALLBACK_BOT_COLOR } from "./shell/types";
import { useComputer } from "./shell/use-computer";
import { useOverlays } from "./shell/use-overlays";
import { useRoster } from "./shell/use-roster";
import { useRoutines } from "./shell/use-routines";
import { useSkills } from "./shell/use-skills";
import type { ThreadComputerBridge } from "./shell/use-thread-session";
import { useThreadSession } from "./shell/use-thread-session";

/** Bound Settings leave so a hung voice status refresh cannot block dismissal. */
const VOICE_STATUS_REFRESH_TIMEOUT_MS = 10_000;

function voiceStatusRefreshTimeout(): Promise<never> {
  return new Promise((_, reject) => {
    AbortSignal.timeout(VOICE_STATUS_REFRESH_TIMEOUT_MS).addEventListener("abort", () => {
      reject(new DOMException("Voice status refresh timed out", "TimeoutError"));
    });
  });
}

export function ShellPage() {
  const { t } = useLingui();
  const { botId, groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const {
    pluginsOpen,
    setPluginsOpen,
    settingsOpen,
    setSettingsOpen,
    settingsSection,
    setSettingsSection,
    messagingSettingsOpen,
    setMessagingSettingsOpen,
    messagingSurfaceEnabled,
    messagingProviders,
    memoryProviderConfig,
    setMemoryProviderConfig,
    memoryProviderConfigRevision,
    callOpen,
    setCallOpen,
    voiceStatus,
    setVoiceStatus,
    commandPaletteOpen,
    setCommandPaletteOpen,
    peerConversation,
    setPeerConversation,
    openSettings,
  } = useOverlays(userId);

  const [panel, setPanel] = useState<Panel>(null);
  const [activityMode, setActivityMode] = useState(readActivityMode);
  const toggleActivityMode = useCallback(() => {
    setActivityMode((on) => {
      const next = !on;
      writeActivityMode(next);
      return next;
    });
  }, []);
  const [dismissedRunErrorIds, setDismissedRunErrorIds] =
    useState<ReadonlySet<string>>(readSeenRunErrorIds);
  const [usage, setUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    runs: number;
  } | null>(null);

  const commitSnapshotRef = useRef<(next: ThreadSnapshot | null) => void>(() => undefined);
  const commitComputerRef = useRef<(next: ComputerStatus | null) => void>(() => undefined);
  const computerBridgeRef = useRef<ThreadComputerBridge | null>(null);
  const bootstrappedThread = useRef<ThreadSnapshot | null>(null);
  const refreshThreadRef = useRef<
    (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null | undefined>
  >(async () => null);
  const setRoutinesRef = useRef<(value: Routine[] | ((current: Routine[]) => Routine[])) => void>(
    () => undefined,
  );
  const setRoutinesBotIdRef = useRef<
    (value: string | null | ((current: string | null) => string | null)) => void
  >(() => undefined);
  const activeBotId = useRef<string | undefined>(undefined);

  const roster = useRoster({
    userId,
    botId,
    groupId,
    navigate,
    setPanel,
    activeBotId,
    commitSnapshotRef,
    commitComputerRef,
    bootstrappedThread,
    setRoutinesRef,
    setRoutinesBotIdRef,
    memoryProviderConfigRevision,
    setMemoryProviderConfig,
  });
  const {
    groups,
    setGroups,
    bots,
    setBots,
    botsRef,
    botSections,
    spaces,
    archivedBots,
    archivedGroups,
    archivedOpen,
    setArchivedOpen,
    collapsedSidebarSections,
    query,
    setQuery,
    searchHits,
    searchLoading,
    menuOpen,
    setMenuOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileSidebarSwipeRef,
    draggedBotId,
    setDraggedBotId,
    createMenuOpen,
    setCreateMenuOpen,
    botsSidebarCollapsed,
    botsSidebarEdgeDragRef,
    focusPromptBotIdRef,
    cancelFocusPrompt,
    newSpaceOpen,
    setNewSpaceOpen,
    pickerInfoTopic,
    setPickerInfoTopic,
    botMenu,
    setBotMenu,
    botMenuAnchor,
    closeBotMenu,
    deleteTarget,
    setDeleteTarget,
    deleteGroupTarget,
    setDeleteGroupTarget,
    deleteSpaceTarget,
    setDeleteSpaceTarget,
    spaceMenu,
    setSpaceMenu,
    spaceMenuAnchor,
    closeSpaceMenu,
    clearTarget,
    setClearTarget,
    newSectionTarget,
    setNewSectionTarget,
    initialBotsLoaded,
    bootstrapMe,
    refreshBots,
    markBotRead,
    markBotUnread,
    markBotReadIfVisible,
    notifyBrowserForEvent,
    flushPendingBrowserNotifications,
    manuallyUnread,
    readVisibleGroups,
    sidebarGroups,
    openSpaceChat,
    reorderRosterBot,
    toggleSidebarSection,
    jumpToSearchHit,
    createBot,
    createGroup,
    setBotsSidebarCollapsedPref,
    inGroup,
    active,
    activeGroup,
    showSpaceSearch,
    contextBot,
    contextGroup,
    contextChat,
  } = roster;

  activeBotId.current = inGroup ? undefined : active?.id;

  const {
    routines,
    setRoutines,
    routinesBotId,
    setRoutinesBotId,
    routineDraft,
    setRoutineDraft,
    routineWebhookSecret,
    setRoutineWebhookSecret,
    editingRoutine,
    setEditingRoutine,
    deleteRoutineTarget,
    setDeleteRoutineTarget,
    savingRoutine,
    runningRoutine,
    routineError,
    setRoutineError,
    ensureWebhookSecret,
    saveRoutine,
    testRunRoutine,
  } = useRoutines({
    panel,
    setBots,
    activeBotId,
    refreshThreadRef,
  });
  setRoutinesRef.current = setRoutines;
  setRoutinesBotIdRef.current = setRoutinesBotId;

  const {
    taughtSkills,
    setTaughtSkills,
    taughtSkillsBotId,
    setTaughtSkillsBotId,
    agentSkills,
    setAgentSkills,
    mentionRoutines,
    mentionConnectors,
    teachBusy,
    setTeachBusy,
    refreshAgentSkills,
  } = useSkills(bots, initialBotsLoaded);
  const activeRoutines = !inGroup && routinesBotId === active?.id ? routines : [];
  const activeTaughtSkills = taughtSkillsBotId === active?.id ? taughtSkills : [];
  const recordingSkill = activeTaughtSkills.find((skill) => skill.status === "recording") ?? null;

  const thread = useThreadSession({
    inGroup,
    botId,
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
  });
  const {
    snapshot,
    updateSnapshot,
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
    activeBotId: threadActiveBotId,
    refreshThread,
    refreshGroupThread,
    activeSnapshot,
    activeReplyTarget,
    shellReady,
    openBot,
    loadOlder,
    jumpToReplyMessage,
    answerMessage,
    reactToMessage,
    onAttachmentPick,
    removeAttachment,
    sendMessage,
    followUpMessage,
    stopRun,
    stopTeaching,
    refreshActiveThread,
    refreshActiveTeaching,
    addSkillRoutine,
    speakMessage,
  } = thread;
  activeBotId.current = threadActiveBotId.current;
  commitSnapshotRef.current = thread.commitSnapshot;

  const {
    computer,
    computerRef,
    computerCacheRef,
    cacheComputerFor,
    commitComputer,
    screenUrl,
    setScreenUrl,
    computerOpen,
    setComputerOpen,
    computerViewport,
    computerError,
    setComputerError,
    computerErrorFromScreen,
    setComputerErrorFromScreen,
    booting,
    screenRequest,
    refreshComputerScreen,
    openComputer,
    releaseComputer,
  } = useComputer({
    panel,
    activeId: active?.id,
    activeBotId,
    snapshot,
    refreshThread,
  });
  commitComputerRef.current = commitComputer;
  computerBridgeRef.current = {
    computerRef,
    computerCacheRef,
    commitComputer,
    cacheComputerFor,
    refreshComputerScreen,
    setScreenUrl,
    setComputerError,
    setComputerErrorFromScreen,
    setComputerOpen,
    screenRequest,
  };

  useEffect(() => {
    setEditingRoutine(null);
    setDeleteRoutineTarget(null);
    setPanel((current) => {
      if (!current || current === "create" || current === "create-group") return current;
      if (inGroup) return current === "group-settings" ? current : null;
      return current === "group-settings" || current === "routine" ? null : current;
    });
  }, [active?.id, groupId, inGroup, setDeleteRoutineTarget, setEditingRoutine]);

  const currentRuns = activeThreadRuns(activeSnapshot);
  const answerableAskMessageId = latestAnswerableAskMessageId(activeSnapshot);
  const workingRuns = currentRuns.filter((run) =>
    ["running", "queued", "leased"].includes(run.status),
  );
  const transcriptRunning = workingRuns.length > 0;
  const composerRunning = currentRuns.some((run) => isActive(run.status));
  const needsComputer =
    currentRuns.some((run) => run.status === "waiting_takeover") ||
    Boolean(computer?.takeoverRequested);
  const dockedAskMessage = answerableAskMessageId
    ? activeSnapshot?.messages.find((message) => message.id === answerableAskMessageId)
    : undefined;
  const dockedAsk = askBlockFromMessage(dockedAskMessage);
  const takeoverReason = needsComputer
    ? latestComputerNeedsYouText(activeSnapshot?.messages)
    : undefined;
  const runError = threadRunError(activeSnapshot, dismissedRunErrorIds);
  const displayedRunError = !sendError ? runError : null;
  const displayedRunErrorId = displayedRunError ? (activeSnapshot?.run?.id ?? null) : null;
  const handleRunErrorPresented = useCallback((runId: string) => {
    rememberSeenRunErrorId(runId);
  }, []);
  const transcriptMessages = useMemo(
    () => userVisibleMessages(activeSnapshot?.messages ?? [], { includePeerReceipts: true }),
    [activeSnapshot?.messages],
  );
  const transcriptArtifactTarget = useMemo<ArtifactTarget>(
    () => (inGroup ? { groupId: groupId ?? "" } : { botId: active?.id ?? "" }),
    [active?.id, groupId, inGroup],
  );
  const transcriptMembers = activeSnapshot?.members ?? activeGroup?.members;
  const resolveTranscriptBot = useCallback(
    (id: string) => {
      const bot = bots.find((candidate) => candidate.id === id);
      if (bot) return bot;
      return transcriptMembers?.find((member) => member.botId === id);
    },
    [bots, transcriptMembers],
  );
  const workingBots: GroupAvatarMember[] = workingRuns.map((run) => {
    const bot = resolveTranscriptBot(run.botId);
    return {
      botId: run.botId,
      color: bot?.color ?? FALLBACK_BOT_COLOR,
      shape: bot?.avatarShape,
      name: bot?.name,
      status: run.status,
      imageSrc: bot
        ? botImageSrc({
            id: "id" in bot ? bot.id : run.botId,
            botId: run.botId,
            hasAvatar: "hasAvatar" in bot ? bot.hasAvatar : false,
            updatedAt: "updatedAt" in bot ? bot.updatedAt : undefined,
          })
        : undefined,
    };
  });
  const resolveTranscriptMemberName = useCallback(
    (id: string | undefined) => memberName(transcriptMembers, id),
    [transcriptMembers],
  );
  const replyTargetName = activeReplyTarget
    ? activeReplyTarget.role === "user"
      ? t`You`
      : (resolveTranscriptMemberName(activeReplyTarget.botId) ?? active?.name ?? t`Bot`)
    : undefined;
  const composerMentionTargets = useMemo(
    () =>
      buildComposerMentionOptions({
        query: "",
        includeEveryone: inGroup,
        currentGroupId: groupId,
        bots: bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          color: bot.color,
          hasAvatar: bot.hasAvatar,
        })),
        groups: groups.map((group) => ({ id: group.id, name: group.name })),
        routines: mentionRoutines.map((routine) => ({
          id: routine.id,
          name: routine.name,
          crons: routine.crons,
          botId: routine.botId,
          botName: routine.botName,
        })),
        connectors: mentionConnectors,
      }),
    [bots, groupId, groups, inGroup, mentionConnectors, mentionRoutines],
  );

  function dismissComposerError() {
    const failedRunId = displayedRunErrorId;
    setSendError(null);
    if (failedRunId) {
      rememberSeenRunErrorId(failedRunId);
      setDismissedRunErrorIds((current) => new Set(current).add(failedRunId));
    }
  }

  const embeddedScreenUrl = embeddableScreenUrl(screenUrl);
  const hasControl = userHoldsComputerControl(computer, active?.id);
  const hideScreenLoadError = computerErrorFromScreen && Boolean(embeddedScreenUrl);
  const computerScreenError =
    computerError && !hideScreenLoadError ? (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 text-center text-sm">
        <p className="text-destructive">{computerError}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => active && void refreshComputerScreen(active.id)}
        >
          <Trans>Retry screen</Trans>
        </Button>
      </div>
    ) : null;

  const userName = session.data?.user.name ?? t`You`;
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ShellLayout
      {...roster}
      {...thread}
      panel={panel}
      setPanel={setPanel}
      activityMode={activityMode}
      toggleActivityMode={toggleActivityMode}
      usage={usage}
      setUsage={setUsage}
      userName={userName}
      initials={initials}
      sessionEmail={session.data?.user.email}
      computerScreenError={computerScreenError}
      navigate={navigate}
      groupId={groupId}
      pluginsOpen={pluginsOpen}
      setPluginsOpen={setPluginsOpen}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      settingsSection={settingsSection}
      setSettingsSection={setSettingsSection}
      messagingSettingsOpen={messagingSettingsOpen}
      setMessagingSettingsOpen={setMessagingSettingsOpen}
      messagingSurfaceEnabled={messagingSurfaceEnabled}
      messagingProviders={messagingProviders}
      memoryProviderConfig={memoryProviderConfig}
      setMemoryProviderConfig={setMemoryProviderConfig}
      memoryProviderConfigRevision={memoryProviderConfigRevision}
      callOpen={callOpen}
      setCallOpen={setCallOpen}
      voiceStatus={voiceStatus}
      setVoiceStatus={setVoiceStatus}
      commandPaletteOpen={commandPaletteOpen}
      setCommandPaletteOpen={setCommandPaletteOpen}
      peerConversation={peerConversation}
      setPeerConversation={setPeerConversation}
      openSettings={openSettings}
      voiceStatusRefreshTimeout={voiceStatusRefreshTimeout}
      computer={computer}
      computerOpen={computerOpen}
      setComputerOpen={setComputerOpen}
      computerViewport={computerViewport}
      booting={booting}
      embeddedScreenUrl={embeddedScreenUrl}
      openComputer={openComputer}
      releaseComputer={releaseComputer}
      refreshComputerScreen={refreshComputerScreen}
      hasControl={hasControl}
      setRoutineDraft={setRoutineDraft}
      setRoutineWebhookSecret={setRoutineWebhookSecret}
      setEditingRoutine={setEditingRoutine}
      setRoutineError={setRoutineError}
      activeRoutines={activeRoutines}
      routineDraft={routineDraft}
      editingRoutine={editingRoutine}
      routineWebhookSecret={routineWebhookSecret}
      savingRoutine={savingRoutine}
      runningRoutine={runningRoutine}
      routineError={routineError}
      ensureWebhookSecret={ensureWebhookSecret}
      saveRoutine={saveRoutine}
      testRunRoutine={testRunRoutine}
      setDeleteRoutineTarget={setDeleteRoutineTarget}
      deleteRoutineTarget={deleteRoutineTarget}
      agentSkills={agentSkills}
      setAgentSkills={setAgentSkills}
      refreshAgentSkills={refreshAgentSkills}
      teachBusy={teachBusy}
      recordingSkill={recordingSkill}
      needsComputer={needsComputer}
      composerRunning={composerRunning}
      transcriptRunning={transcriptRunning}
      takeoverReason={takeoverReason}
      dockedAsk={dockedAsk}
      dockedAskMessage={dockedAskMessage}
      displayedRunError={displayedRunError}
      displayedRunErrorId={displayedRunErrorId}
      handleRunErrorPresented={handleRunErrorPresented}
      dismissComposerError={dismissComposerError}
      transcriptMessages={transcriptMessages}
      transcriptArtifactTarget={transcriptArtifactTarget}
      workingBots={workingBots}
      answerableAskMessageId={answerableAskMessageId}
      resolveTranscriptMemberName={resolveTranscriptMemberName}
      resolveTranscriptBot={resolveTranscriptBot}
      replyTargetName={replyTargetName}
      composerMentionTargets={composerMentionTargets}
    />
  );
}
