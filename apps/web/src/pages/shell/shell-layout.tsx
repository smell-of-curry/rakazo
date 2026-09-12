import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { Plus, Settings, X } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { ComputerUpdateProgress } from "../../components/ComputerUpdateProgress";
import { rpc } from "../../lib/rpc";
import { HostComputerPrompt } from "../HostComputerPrompt";
import { Composer } from "./composer";
import { ComputerOverlay } from "./computer-overlay";
import { ComputerPane } from "./computer-pane";
import { CreateBotPane, CreateGroupPane } from "./create-pane";
import { RoutinePane } from "./routine-pane";
import { BotSettingsPane, GroupSettingsPane } from "./settings-pane";
import { ShellDialogs } from "./shell-dialogs";
import type { ShellLayoutProps } from "./shell-layout-props";
import { ShellSidebar } from "./sidebar";
import { ThreadHeader } from "./thread-header";
import { Transcript } from "./transcript";
import { FALLBACK_BOT_COLOR } from "./types";

const MessagingSettingsOverlay = lazy(() =>
  import("../MessagingSettingsOverlay").then((module) => ({
    default: module.MessagingSettingsOverlay,
  })),
);
const SettingsOverlay = lazy(() =>
  import("../SettingsOverlay").then((module) => ({ default: module.SettingsOverlay })),
);
const PeerMessagesOverlay = lazy(() =>
  import("../PeerMessagesOverlay").then((module) => ({ default: module.PeerMessagesOverlay })),
);
const PluginsOverlay = lazy(() =>
  import("../PluginsOverlay").then((module) => ({ default: module.PluginsOverlay })),
);
const CallView = lazy(() => import("../CallView").then((module) => ({ default: module.CallView })));

const MOBILE_SIDEBAR_SWIPE_EDGE_PX = 32;
const MOBILE_SIDEBAR_SWIPE_DISTANCE_PX = 56;

export function ShellLayout(props: ShellLayoutProps) {
  const { t } = useLingui();
  const {
    groups,
    setGroups,
    bots,
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
    snapshot,
    updateSnapshot,
    setReplyTarget,
    sending,
    sendError,
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
    panel,
    setPanel,
    activityMode,
    toggleActivityMode,
    usage,
    setUsage,
    userName,
    initials,
    sessionEmail,
    computerScreenError,
    navigate,
    groupId,
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
    voiceStatusRefreshTimeout,
    computer,
    computerOpen,
    setComputerOpen,
    computerViewport,
    booting,
    embeddedScreenUrl,
    openComputer,
    releaseComputer,
    hasControl,
    setRoutineDraft,
    setRoutineWebhookSecret,
    setEditingRoutine,
    setRoutineError,
    activeRoutines,
    routineDraft,
    editingRoutine,
    routineWebhookSecret,
    savingRoutine,
    runningRoutine,
    routineError,
    ensureWebhookSecret,
    saveRoutine,
    testRunRoutine,
    setDeleteRoutineTarget,
    deleteRoutineTarget,
    agentSkills,
    setAgentSkills,
    refreshAgentSkills,
    teachBusy,
    recordingSkill,
    needsComputer,
    composerRunning,
    transcriptRunning,
    takeoverReason,
    dockedAsk,
    dockedAskMessage,
    displayedRunError,
    displayedRunErrorId,
    handleRunErrorPresented,
    dismissComposerError,
    transcriptMessages,
    transcriptArtifactTarget,
    workingBots,
    answerableAskMessageId,
    resolveTranscriptMemberName,
    resolveTranscriptBot,
    replyTargetName,
    composerMentionTargets,
  } = props;
  const [findOpen, setFindOpen] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-testid="shell-root"
      data-ready={shellReady}
      className="relative flex h-full min-w-0 overflow-hidden bg-background text-foreground/90"
      onTouchStartCapture={(event) => {
        if (
          mobileSidebarOpen ||
          event.touches.length !== 1 ||
          window.matchMedia("(min-width: 768px)").matches
        ) {
          mobileSidebarSwipeRef.current = null;
          return;
        }
        const touch = event.touches[0];
        if (!touch) return;
        const rtl = document.documentElement.getAttribute("dir") === "rtl";
        const startsAtEdge = rtl
          ? touch.clientX >= window.innerWidth - MOBILE_SIDEBAR_SWIPE_EDGE_PX
          : touch.clientX <= MOBILE_SIDEBAR_SWIPE_EDGE_PX;
        mobileSidebarSwipeRef.current = startsAtEdge
          ? { startX: touch.clientX, startY: touch.clientY }
          : null;
      }}
      onTouchEndCapture={(event) => {
        const swipe = mobileSidebarSwipeRef.current;
        mobileSidebarSwipeRef.current = null;
        const touch = event.changedTouches[0];
        if (
          !swipe ||
          !touch ||
          mobileSidebarOpen ||
          window.matchMedia("(min-width: 768px)").matches
        ) {
          return;
        }
        const rtl = document.documentElement.getAttribute("dir") === "rtl";
        const horizontal = rtl ? swipe.startX - touch.clientX : touch.clientX - swipe.startX;
        const vertical = Math.abs(touch.clientY - swipe.startY);
        if (horizontal >= MOBILE_SIDEBAR_SWIPE_DISTANCE_PX && horizontal > vertical * 1.25) {
          setMobileSidebarOpen(true);
        }
      }}
      onTouchCancelCapture={() => {
        mobileSidebarSwipeRef.current = null;
      }}
    >
      <ComputerUpdateProgress
        onCompleted={() => {
          if (active) void refreshThread(active.id);
        }}
      />
      {bootstrapMe !== undefined ? (
        <HostComputerPrompt initialMe={bootstrapMe ?? undefined} />
      ) : null}
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label={t`Close navigation`}
          onClick={() => setMobileSidebarOpen(false)}
          className="absolute inset-y-0 end-0 start-[min(calc(100%-48px),280px)] z-30 bg-overlay md:hidden"
        />
      ) : null}
      {!mobileSidebarOpen ? (
        <div
          data-testid="mobile-sidebar-swipe-edge"
          aria-hidden="true"
          className="absolute bottom-20 start-0 top-16 z-20 w-8 touch-none md:hidden"
        />
      ) : null}
      <ShellSidebar
        botsSidebarCollapsed={botsSidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        activityMode={activityMode}
        toggleActivityMode={toggleActivityMode}
        setBotsSidebarCollapsedPref={setBotsSidebarCollapsedPref}
        createMenuOpen={createMenuOpen}
        setCreateMenuOpen={setCreateMenuOpen}
        bots={bots}
        setMobileSidebarOpen={setMobileSidebarOpen}
        navigate={navigate}
        setPanel={setPanel}
        setNewSpaceOpen={setNewSpaceOpen}
        setPickerInfoTopic={setPickerInfoTopic}
        query={query}
        setQuery={setQuery}
        showSpaceSearch={showSpaceSearch}
        searchHits={searchHits}
        searchLoading={searchLoading}
        jumpToSearchHit={jumpToSearchHit}
        sidebarGroups={sidebarGroups}
        inGroup={inGroup}
        active={active}
        activeGroup={activeGroup}
        activeSnapshotGroupId={activeSnapshot?.groupId}
        activeSnapshotMembers={activeSnapshot?.members}
        activeSnapshotBotId={activeSnapshot?.botId}
        activeSnapshotRunStatus={activeSnapshot?.run?.status}
        draggedBotId={draggedBotId}
        setDraggedBotId={setDraggedBotId}
        reorderRosterBot={reorderRosterBot}
        openSpaceChat={openSpaceChat}
        bootstrapMe={bootstrapMe}
        botMenuAnchor={botMenuAnchor}
        setBotMenu={setBotMenu}
        collapsedSidebarSections={collapsedSidebarSections}
        toggleSidebarSection={toggleSidebarSection}
        spaceMenuAnchor={spaceMenuAnchor}
        setSpaceMenu={setSpaceMenu}
        archivedBots={archivedBots}
        archivedGroups={archivedGroups}
        archivedOpen={archivedOpen}
        setArchivedOpen={setArchivedOpen}
        refreshBots={refreshBots}
        setDeleteTarget={setDeleteTarget}
        setDeleteGroupTarget={setDeleteGroupTarget}
        setPluginsOpen={setPluginsOpen}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        initials={initials}
        userName={userName}
        setCommandPaletteOpen={setCommandPaletteOpen}
        openSettings={openSettings}
        setUsage={setUsage}
        botsSidebarEdgeDragRef={botsSidebarEdgeDragRef}
      />

      <main
        aria-hidden={mobileSidebarOpen || undefined}
        inert={mobileSidebarOpen}
        className="flex min-w-0 flex-1 flex-col bg-background"
      >
        <ThreadHeader
          botsSidebarCollapsed={botsSidebarCollapsed}
          setMobileSidebarOpen={setMobileSidebarOpen}
          setBotsSidebarCollapsedPref={setBotsSidebarCollapsedPref}
          inGroup={inGroup}
          active={active}
          activeGroup={activeGroup}
          activeSnapshot={activeSnapshot}
          setPanel={setPanel}
          panel={panel}
          needsComputer={needsComputer}
          computerLive={computer?.state === "running"}
          refreshThread={refreshThread}
          onFindInChat={() => setFindOpen(true)}
        />
        {!active && !activeGroup && initialBotsLoaded ? (
          <div className="grid flex-1 place-items-center">
            <Button onClick={() => setPanel("create")}>
              <Plus size={16} aria-hidden="true" />
              <Trans>Create new Bot</Trans>
            </Button>
          </div>
        ) : (
          <Transcript
            key={activeSnapshot?.threadId}
            scrollRef={messageScroll}
            artifactTarget={transcriptArtifactTarget}
            messages={transcriptMessages}
            olderCursor={activeSnapshot?.olderCursor ?? null}
            loadingOlder={loadingOlder}
            answerableAskMessageId={answerableAskMessageId}
            running={transcriptRunning}
            workingBots={workingBots}
            isGroup={inGroup}
            computerBooting={booting || computer?.state === "booting"}
            botName={active?.name}
            findOpen={findOpen}
            onFindOpenChange={setFindOpen}
            onOpenComputer={() => {
              setPanel("computer");
              if (active) {
                void refreshThread(active.id).catch(() => undefined);
              }
            }}
            onLoadOlder={loadOlder}
            onOpenBot={openBot}
            onAnswer={answerMessage}
            onReply={setReplyTarget}
            onReact={reactToMessage}
            onJumpToMessage={jumpToReplyMessage}
            onOpenPeerMessages={(peer) => {
              setPeerConversation(peer);
            }}
            memberName={resolveTranscriptMemberName}
            peerBot={resolveTranscriptBot}
            onRefresh={refreshActiveThread}
            onBotChanged={refreshBots}
            onAddRoutine={addSkillRoutine}
            voiceReady={Boolean(voiceStatus?.ready)}
            speakingMessageId={speakingMessageId}
            onSpeak={speakMessage}
          />
        )}
        {recordingSkill ? (
          <div className="px-6 pb-2 text-center text-body text-destructive">
            <Trans>Teaching in progress. Stop teaching before sending a new message.</Trans>
          </div>
        ) : null}
        {active || activeGroup ? (
          <Composer
            key={inGroup ? `group:${groupId}` : `bot:${active?.id}`}
            threadId={activeSnapshot?.threadId ?? (inGroup ? `group:${groupId}` : active?.id)}
            activeName={inGroup ? (activeGroup?.name ?? activeSnapshot?.groupName) : active?.name}
            running={composerRunning}
            needsComputer={needsComputer}
            takeoverReason={takeoverReason}
            dockedAsk={dockedAsk}
            onAnswerAsk={
              dockedAskMessage ? (text) => answerMessage(dockedAskMessage, text) : undefined
            }
            onOpenComputer={() => {
              setPanel("computer");
              if (active) {
                void refreshThread(active.id).catch(() => undefined);
              }
            }}
            disabled={Boolean(recordingSkill)}
            pendingAttachments={activePendingAttachments}
            attachmentNotice={attachmentNotice}
            sendError={sendError}
            runError={displayedRunError}
            runErrorId={displayedRunErrorId}
            onRunErrorPresented={handleRunErrorPresented}
            onDismissError={dismissComposerError}
            sending={sending}
            fileInputRef={fileInputRef}
            onAttachmentPick={onAttachmentPick}
            onRemoveAttachment={removeAttachment}
            onSend={sendMessage}
            onStop={stopRun}
            onVoice={
              !inGroup && active
                ? () => {
                    if (!voiceStatus?.ready) {
                      openSettings("voice");
                      return;
                    }
                    setCallOpen(true);
                  }
                : undefined
            }
            replyTarget={activeReplyTarget}
            replyTargetName={replyTargetName}
            onClearReply={() => setReplyTarget(null)}
            mentionTargets={composerMentionTargets}
            agentSkills={agentSkills}
            onSlashOpen={refreshAgentSkills}
            onSlashAction={(action) => {
              if (action === "chat-settings") {
                setPanel(inGroup ? "group-settings" : "settings");
                return;
              }
              if (action === "settings-general") {
                openSettings("general");
                return;
              }
              if (action === "settings-usage") {
                void rpc.usage
                  .summary()
                  .then(setUsage)
                  .catch(() => undefined);
                openSettings("usage");
              }
            }}
          />
        ) : null}
      </main>

      <aside
        data-testid="side-panel"
        data-panel={panel ?? "closed"}
        className={`absolute inset-y-0 end-0 z-20 flex min-h-0 shrink-0 flex-col overflow-hidden bg-background transition-[width] duration-150 ease-out md:relative ${
          panel && (active || activeGroup || panel === "create")
            ? "w-full max-w-[384px] border-s border-sidebar-border md:w-[384px] md:max-w-none"
            : "pointer-events-none w-0"
        }`}
      >
        {panel && (active || activeGroup || panel === "create") ? (
          <div className="rk-scroll h-full w-full overflow-y-auto px-5 py-[17px] md:w-[384px]">
            {panel === "settings" ? (
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[13.5px] text-muted-foreground">
                  <Trans>Settings</Trans>
                </span>
                <div className="flex gap-1">
                  {active ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t`Show computer`}
                      onClick={() => setPanel("computer")}
                      className="text-foreground"
                    >
                      <Settings size={16} strokeWidth={1.7} />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t`Close panel`}
                    onClick={() => setPanel(null)}
                  >
                    <X size={16} strokeWidth={1.8} />
                  </Button>
                </div>
              </div>
            ) : null}
            {panel === "computer" && active ? (
              <ComputerPane
                active={active}
                computerOpen={computerOpen}
                computer={computer}
                booting={booting}
                embeddedScreenUrl={embeddedScreenUrl}
                computerScreenError={computerScreenError}
                bootstrapMe={bootstrapMe}
                openComputer={openComputer}
                setRoutineDraft={setRoutineDraft}
                setRoutineWebhookSecret={setRoutineWebhookSecret}
                setEditingRoutine={setEditingRoutine}
                setRoutineError={setRoutineError}
                setPanel={setPanel}
                activeRoutines={activeRoutines}
                snapshot={snapshot}
                stopRun={stopRun}
              />
            ) : null}
            {panel === "create-group" ? (
              <CreateGroupPane
                bots={bots}
                setPanel={setPanel}
                onCreate={(input) => createGroup(input)}
              />
            ) : null}
            {panel === "group-settings" && activeGroup ? (
              <GroupSettingsPane
                activeGroup={activeGroup}
                bots={bots}
                groups={groups}
                setGroups={setGroups}
                setPanel={setPanel}
                navigate={navigate}
                refreshBots={refreshBots}
                refreshGroupThread={refreshGroupThread}
              />
            ) : null}
            {panel === "create" ? (
              <CreateBotPane
                onCancel={() => setPanel(null)}
                onCreate={(input) => createBot(input)}
              />
            ) : null}
            {panel === "settings" && active ? (
              <BotSettingsPane
                active={active}
                memoryProviderConfigured={memoryProviderConfig != null}
                onSkillsChange={setAgentSkills}
                onAvatarChange={() => refreshBots()}
                onClear={() => setClearTarget({ kind: "bot", chat: active })}
                refreshBots={refreshBots}
              />
            ) : null}
            {panel === "routine" && active ? (
              <RoutinePane
                active={active}
                routineDraft={routineDraft}
                setRoutineDraft={setRoutineDraft}
                editingRoutine={editingRoutine}
                routineWebhookSecret={routineWebhookSecret}
                messagingProviders={messagingProviders}
                savingRoutine={savingRoutine}
                runningRoutine={runningRoutine}
                routineError={routineError}
                setPanel={setPanel}
                ensureWebhookSecret={ensureWebhookSecret}
                saveRoutine={saveRoutine}
                testRunRoutine={testRunRoutine}
                setDeleteRoutineTarget={setDeleteRoutineTarget}
              />
            ) : null}
          </div>
        ) : null}
      </aside>

      <Suspense fallback={null}>
        <ShellDialogs
          contextChat={contextChat}
          contextBot={contextBot}
          contextGroup={contextGroup}
          botMenu={botMenu}
          closeBotMenu={closeBotMenu}
          botSections={botSections}
          setBotMenu={setBotMenu}
          refreshBots={refreshBots}
          markBotUnread={markBotUnread}
          markBotRead={markBotRead}
          setGroups={setGroups}
          setNewSectionTarget={setNewSectionTarget}
          navigate={navigate}
          setPanel={setPanel}
          setClearTarget={setClearTarget}
          setDeleteTarget={setDeleteTarget}
          setDeleteGroupTarget={setDeleteGroupTarget}
          spaceMenu={spaceMenu}
          closeSpaceMenu={closeSpaceMenu}
          spaces={spaces}
          setDeleteSpaceTarget={setDeleteSpaceTarget}
          setSpaceMenu={setSpaceMenu}
          deleteTarget={deleteTarget}
          deleteGroupTarget={deleteGroupTarget}
          deleteSpaceTarget={deleteSpaceTarget}
          bootstrapMe={bootstrapMe}
          newSectionTarget={newSectionTarget}
          commandPaletteOpen={commandPaletteOpen}
          setCommandPaletteOpen={setCommandPaletteOpen}
          bots={bots}
          setMobileSidebarOpen={setMobileSidebarOpen}
          newSpaceOpen={newSpaceOpen}
          setNewSpaceOpen={setNewSpaceOpen}
          pickerInfoTopic={pickerInfoTopic}
          setPickerInfoTopic={setPickerInfoTopic}
          clearTarget={clearTarget}
          active={active}
          activeGroup={activeGroup}
          expandedHistoryThread={expandedHistoryThread}
          pinnedAroundRef={pinnedAroundRef}
          historyEpoch={historyEpoch}
          updateSnapshot={updateSnapshot}
          deleteRoutineTarget={deleteRoutineTarget}
          setDeleteRoutineTarget={setDeleteRoutineTarget}
          setEditingRoutine={setEditingRoutine}
          activeBotId={threadActiveBotId}
          refreshThread={refreshThread}
        />
        {pluginsOpen ? (
          <PluginsOverlay
            activeBotId={threadActiveBotId.current}
            onClose={() => setPluginsOpen(false)}
          />
        ) : null}
        {messagingSettingsOpen ? (
          <MessagingSettingsOverlay onClose={() => setMessagingSettingsOpen(false)} />
        ) : null}
      </Suspense>

      <Suspense fallback={null}>
        {settingsOpen ? (
          <SettingsOverlay
            name={userName}
            email={sessionEmail}
            usage={usage}
            initialSection={settingsSection}
            isDeploymentOwner={bootstrapMe?.isDeploymentOwner === true}
            sandboxProvider={bootstrapMe?.sandboxProvider}
            messagingEnabled={messagingSurfaceEnabled}
            onOpenMessaging={() => {
              setSettingsOpen(false);
              setMessagingSettingsOpen(true);
            }}
            memoryConfig={memoryProviderConfig}
            onMemoryConfigChange={(config) => {
              memoryProviderConfigRevision.current += 1;
              setMemoryProviderConfig(config);
            }}
            onVoiceStatusMaybeChanged={async () => {
              try {
                setVoiceStatus(
                  await Promise.race([rpc.voice.status(), voiceStatusRefreshTimeout()]),
                );
              } catch {
                // Prefer reopening Voice settings over CallView with stale readiness.
                setVoiceStatus(null);
              }
            }}
            onClose={() => {
              setSettingsOpen(false);
              setSettingsSection("general");
            }}
          />
        ) : null}
        {peerConversation && active ? (
          <PeerMessagesOverlay
            botId={active.id}
            botName={active.name}
            botColor={active.color}
            peerBotId={peerConversation.peerBotId}
            peerBotName={peerConversation.peerBotName}
            peerBotColor={
              resolveTranscriptBot(peerConversation.peerBotId)?.color ?? FALLBACK_BOT_COLOR
            }
            onClose={() => setPeerConversation(null)}
          />
        ) : null}
        {callOpen && active ? (
          <CallView
            botId={active.id}
            botName={active.name}
            transcribe={Boolean(voiceStatus?.transcribe)}
            snapshot={activeSnapshot}
            onSend={sendMessage}
            onFollowUp={followUpMessage}
            onAnswer={answerMessage}
            onClose={() => setCallOpen(false)}
          />
        ) : null}
      </Suspense>

      <ComputerOverlay
        booting={booting}
        active={active}
        computerOpen={computerOpen}
        computerViewport={computerViewport}
        computer={computer}
        embeddedScreenUrl={embeddedScreenUrl}
        computerScreenError={computerScreenError}
        recordingSkill={recordingSkill}
        teachBusy={teachBusy}
        stopTeaching={stopTeaching}
        hasControl={hasControl}
        releaseComputer={releaseComputer}
        composerRunning={composerRunning}
        sending={sending}
        stopRun={stopRun}
        refreshActiveTeaching={refreshActiveTeaching}
        refreshThread={refreshThread}
        sendError={sendError}
        needsComputer={needsComputer}
        dockedAsk={dockedAsk}
        setComputerOpen={setComputerOpen}
      />
    </div>
  );
}
