import { useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView, useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarkdownArtifactPreview } from "../components/markdown-artifact-preview";
import { ThreadComposer } from "../components/thread/composer";
import { ThreadHeader } from "../components/thread/header";
import { ThreadTranscriptList } from "../components/thread/transcript-list";
import { useThreadSession } from "../components/thread/use-thread-session";
import { selectedSpaceId, selectSpace } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useMobileTokens } from "../lib/native";

type NotificationRouteState = "loading" | "ready" | "failed";

export default function ThreadRoute() {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  const router = useRouter();
  const { spaceId } = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const requestedSpaceId = typeof spaceId === "string" && spaceId ? spaceId : null;
  const invalidSpaceId = spaceId !== undefined && requestedSpaceId === null;
  const routeMatchesSelectedSpace =
    requestedSpaceId === null || selectedSpaceId() === requestedSpaceId;
  const [routeState, setRouteState] = useState<NotificationRouteState>(() => {
    if (invalidSpaceId) return "failed";
    return routeMatchesSelectedSpace ? "ready" : "loading";
  });

  useEffect(() => {
    let cancelled = false;
    if (invalidSpaceId) {
      setRouteState("failed");
      return () => {
        cancelled = true;
      };
    }
    if (!requestedSpaceId || selectedSpaceId() === requestedSpaceId) {
      setRouteState("ready");
      return () => {
        cancelled = true;
      };
    }
    setRouteState("loading");
    void selectSpace(requestedSpaceId).then((selected) => {
      if (!cancelled) setRouteState(selected ? "ready" : "failed");
    });
    return () => {
      cancelled = true;
    };
  }, [invalidSpaceId, requestedSpaceId]);

  if (routeState === "ready" && !invalidSpaceId && routeMatchesSelectedSpace) return <Thread />;
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.background,
      }}
    >
      {routeState === "loading" ? (
        <ActivityIndicator color={tokens.foreground} />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")}>
          <Text style={{ color: tokens.foreground, fontSize: 16 }}>{t("Return to inbox")}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Thread() {
  const tokens = mobileTokens();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const session = useThreadSession();
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      behavior="height"
      keyboardVerticalOffset={headerHeight}
      style={{ flex: 1, backgroundColor: tokens.background, paddingHorizontal: 20 }}
    >
      <ThreadHeader
        botId={session.botId}
        groupId={session.groupId}
        inGroup={session.inGroup}
        displayName={session.displayName}
        currentBot={session.currentBot}
        computerKind={session.computerKind}
        botActions={session.botActions}
        botActionsOpen={session.botActionsOpen}
        onCloseBotActions={() => session.setBotActionsOpen(false)}
        onShowBotActions={session.showBotActions}
      />
      {session.runError ? (
        <Text style={{ color: tokens.destructive, marginTop: 12 }}>{session.runError}</Text>
      ) : null}
      <ThreadTranscriptList
        threadKey={session.threadKey}
        botId={session.botId}
        groupId={session.groupId}
        inGroup={session.inGroup}
        displayName={session.displayName}
        currentBot={session.currentBot}
        currentBotStatus={session.currentBotStatus}
        mentionBots={session.mentionBots}
        members={session.snap?.members}
        hasLiveProgress={session.hasLiveProgress}
        workingGroupBots={session.workingGroupBots}
        rateLimitSeconds={session.rateLimitSeconds}
        computerKind={session.computerKind}
        showPinnedPage={session.showPinnedPage}
        jumpScrollTarget={session.jumpScrollTarget}
        pinnedAroundRef={session.pinnedAroundRef}
        pinnedScroll={session.pinnedScroll}
        scroll={session.scroll}
        scrollBehavior={session.scrollBehavior}
        liveRows={session.liveRows}
        transcriptRows={session.transcriptRows}
        latestMessageId={session.latestMessageId}
        snapThreadId={session.snap?.threadId}
        answerableAskMessageId={session.answerableAskMessageId}
        messagesById={session.messagesById}
        reactionView={session.reactionView}
        olderCursor={session.snap?.olderCursor}
        loadingOlder={session.loadingOlder}
        onLoadOlder={() => void session.loadOlderMessages()}
        userDragging={session.userDragging}
        loadingOlderContent={session.loadingOlderContent}
        expandedHistoryThread={session.expandedHistoryThread}
        performScroll={session.performScroll}
        updateUserScroll={session.updateUserScroll}
        threadScrollState={session.threadScrollState}
        setThreadScrollState={session.setThreadScrollState}
        messageActionProps={session.messageActionProps}
        peerLook={session.peerLook}
        onAnswer={session.answerMessage}
        onOpenBot={session.openBot}
        onPreviewMarkdown={session.setMarkdownPreview}
      />
      <View style={{ paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom + 12, 24) }}>
        <ThreadComposer
          displayName={session.displayName}
          colorScheme={session.colorScheme}
          replyTarget={session.replyTarget}
          onCancelReply={() => session.setReplyTarget(null)}
          attachmentNotice={session.attachmentNotice}
          pendingAttachments={session.activePendingAttachments}
          onRemoveAttachment={(id) =>
            session.setPendingAttachments((current) => current.filter((item) => item.id !== id))
          }
          mentionOptions={session.mentionOptions}
          onInsertMention={session.insertMention}
          slashSkillOptions={session.slashSkillOptions}
          slashActionOptions={session.slashActionOptions}
          onInsertSkill={session.insertSkill}
          onRunSlashAction={session.runSlashAction}
          selectedSkill={session.selectedSkill}
          onClearSkill={() => session.setSelectedSkill(null)}
          draft={session.draft}
          onDraftChange={session.updateDraft}
          onRemoveLastChip={session.removeLastChip}
          onAttach={session.showAttachMenu}
          working={session.working}
          canSend={session.canSend}
          sending={session.sending}
          onSend={() => void session.send()}
          onStop={() => void session.stop()}
          onVoice={() => router.push("/voice")}
          error={session.error}
          hideComposerError={session.hideComposerError}
        />
      </View>
      {session.markdownPreview && session.artifactTarget ? (
        <MarkdownArtifactPreview
          threadTarget={session.artifactTarget}
          target={session.markdownPreview}
          onClose={() => session.setMarkdownPreview(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
