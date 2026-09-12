import type {
  ComputerStatusChipKind,
  CondensedTranscriptRow,
  ThreadScrollAction,
  ThreadScrollBehavior,
  ThreadScrollState,
} from "@rakazo/core";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { MobileBot, MobileMessage, MobileSnapshot } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { native, useMobileTokens } from "../../lib/native";
import type { MarkdownArtifactPreviewTarget } from "../markdown-artifact-preview";
import { NativeSymbol } from "../native-symbol";
import { MessageRow, neighborMessage } from "./message-row";
import { PeerRow } from "./peer-row";
import { StatusBubble } from "./status-bubble";
import type { MessageActionProps } from "./types";

export function ThreadTranscriptList({
  threadKey,
  botId,
  groupId,
  inGroup,
  displayName,
  currentBot,
  currentBotStatus,
  mentionBots,
  members,
  hasLiveProgress,
  workingGroupBots,
  rateLimitSeconds,
  computerKind,
  showPinnedPage,
  jumpScrollTarget,
  pinnedAroundRef,
  pinnedScroll,
  scroll,
  scrollBehavior,
  liveRows,
  transcriptRows,
  latestMessageId,
  snapThreadId,
  answerableAskMessageId,
  messagesById,
  reactionView,
  olderCursor,
  loadingOlder,
  onLoadOlder,
  userDragging,
  loadingOlderContent,
  expandedHistoryThread,
  performScroll,
  updateUserScroll,
  threadScrollState,
  setThreadScrollState,
  messageActionProps,
  peerLook,
  onAnswer,
  onOpenBot,
  onPreviewMarkdown,
}: {
  threadKey?: string;
  botId?: string;
  groupId?: string;
  inGroup: boolean;
  displayName?: string;
  currentBot?: MobileBot;
  currentBotStatus?: string;
  mentionBots: MobileBot[];
  members?: MobileSnapshot["members"];
  hasLiveProgress: boolean;
  workingGroupBots: Array<{
    botId: string;
    name: string;
    color: string;
    avatarShape?: string | null;
    hasAvatar?: boolean;
    status?: string;
  }>;
  rateLimitSeconds: number | null;
  computerKind: ComputerStatusChipKind;
  showPinnedPage: boolean;
  jumpScrollTarget: RefObject<string | null>;
  pinnedAroundRef: RefObject<{
    botId?: string;
    groupId?: string;
    messageId: string;
    threadId: string;
    messages: readonly MobileMessage[];
    olderCursor: number | null;
  } | null>;
  pinnedScroll: RefObject<ScrollView | null>;
  scroll: RefObject<FlatList<CondensedTranscriptRow<MobileMessage>> | null>;
  scrollBehavior: RefObject<ThreadScrollBehavior>;
  liveRows: CondensedTranscriptRow<MobileMessage>[];
  transcriptRows: CondensedTranscriptRow<MobileMessage>[];
  latestMessageId: string | null;
  snapThreadId?: string;
  answerableAskMessageId: string | null;
  messagesById: Map<string, MobileMessage>;
  reactionView: { reactions: Map<string, Map<string, number>> };
  olderCursor: number | null | undefined;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  userDragging: RefObject<boolean>;
  loadingOlderContent: RefObject<boolean>;
  expandedHistoryThread: RefObject<string | null>;
  performScroll: (action: ThreadScrollAction) => void;
  updateUserScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  threadScrollState: ThreadScrollState;
  setThreadScrollState: Dispatch<SetStateAction<ThreadScrollState>>;
  messageActionProps: (message: MobileMessage) => MessageActionProps;
  peerLook: (id: string) => { imageSrc?: string };
  onAnswer: (message: MobileMessage, answer: string) => Promise<void>;
  onOpenBot: (botId: string, name: string) => void;
  onPreviewMarkdown: (target: MarkdownArtifactPreviewTarget) => void;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  const workingFooter = (
    <StatusBubble
      inGroup={inGroup}
      currentBot={currentBot}
      currentBotStatus={currentBotStatus}
      hasLiveProgress={hasLiveProgress}
      workingGroupBots={workingGroupBots}
      mentionBots={mentionBots}
      rateLimitSeconds={rateLimitSeconds}
      computerKind={computerKind}
    />
  );
  const loadEarlierControl =
    olderCursor != null ? (
      <Pressable
        disabled={loadingOlder}
        onPress={onLoadOlder}
        style={{
          alignSelf: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: tokens.mutedForeground, fontSize: 13 }}>
          {loadingOlder ? t("Loading…") : t("Load earlier messages")}
        </Text>
      </Pressable>
    ) : null;

  function renderTranscriptRow(
    row: CondensedTranscriptRow<MobileMessage>,
    options?: { enableJump?: boolean },
    neighbors?: {
      older?: CondensedTranscriptRow<MobileMessage>;
      newer?: CondensedTranscriptRow<MobileMessage>;
    },
  ) {
    if (row.type === "peerCluster") {
      const firstId = row.messages[0]?.id;
      return (
        <PeerRow
          key={firstId ? `cluster-${firstId}` : "cluster"}
          row={row}
          enableJump={options?.enableJump}
          jumpScrollTarget={jumpScrollTarget}
          pinnedScroll={pinnedScroll}
          peerLook={peerLook}
          onOpenPeer={({ peerBotId, peerBotName }) => onOpenBot(peerBotId, peerBotName)}
        />
      );
    }
    return (
      <MessageRow
        key={row.message.id}
        message={row.message}
        older={neighborMessage(neighbors?.older)}
        newer={neighborMessage(neighbors?.newer)}
        enableJump={options?.enableJump}
        jumpScrollTarget={jumpScrollTarget}
        pinnedScroll={pinnedScroll}
        botId={botId}
        groupId={groupId}
        inGroup={inGroup}
        displayName={displayName}
        mentionBots={mentionBots}
        members={members}
        currentBot={currentBot}
        messagesById={messagesById}
        reactionView={reactionView}
        answerableAskMessageId={answerableAskMessageId}
        onAnswer={onAnswer}
        onOpenBot={onOpenBot}
        onPreviewMarkdown={onPreviewMarkdown}
        actionProps={messageActionProps(row.message)}
        peerLook={peerLook}
      />
    );
  }

  return (
    <View style={{ flex: 1, position: "relative" }}>
      {showPinnedPage ? (
        <ScrollView
          key={jumpScrollTarget.current ?? pinnedAroundRef.current?.messageId ?? threadKey}
          ref={pinnedScroll}
          style={{ flex: 1, marginTop: 8 }}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        >
          {loadEarlierControl}
          {transcriptRows.map((row, index) =>
            renderTranscriptRow(
              row,
              { enableJump: true },
              {
                older: transcriptRows[index - 1],
                newer: transcriptRows[index + 1],
              },
            ),
          )}
          {workingFooter}
        </ScrollView>
      ) : (
        <FlatList<CondensedTranscriptRow<MobileMessage>>
          key={threadKey}
          ref={scroll}
          data={liveRows}
          inverted
          keyExtractor={(row) =>
            row.type === "peerCluster" ? `cluster-${row.messages[0]?.id}` : row.message.id
          }
          extraData={answerableAskMessageId}
          style={{ flex: 1, marginTop: 8 }}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            userDragging.current = true;
          }}
          onScroll={(event) => {
            if (userDragging.current) updateUserScroll(event);
          }}
          onScrollEndDrag={(event) => {
            updateUserScroll(event);
            userDragging.current = false;
          }}
          onMomentumScrollEnd={updateUserScroll}
          onLayout={() => performScroll(scrollBehavior.current.onLayout())}
          onContentSizeChange={() => {
            if (loadingOlderContent.current) {
              loadingOlderContent.current = false;
              return;
            }
            const blocked = Boolean(
              jumpScrollTarget.current ||
                (pinnedAroundRef.current &&
                  ((pinnedAroundRef.current.botId && pinnedAroundRef.current.botId === botId) ||
                    (pinnedAroundRef.current.groupId &&
                      pinnedAroundRef.current.groupId === groupId))) ||
                expandedHistoryThread.current === snapThreadId,
            );
            performScroll(scrollBehavior.current.onContentChanged(blocked, latestMessageId));
            setThreadScrollState(scrollBehavior.current.state());
          }}
          ListFooterComponent={loadEarlierControl}
          ListHeaderComponent={workingFooter}
          renderItem={({ item, index }) =>
            renderTranscriptRow(item, undefined, {
              older: liveRows[index + 1],
              newer: liveRows[index - 1],
            })
          }
        />
      )}
      {!showPinnedPage && threadScrollState.detached ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            threadScrollState.unread ? t("Jump to latest, new messages") : t("Jump to latest")
          }
          onPress={() => {
            performScroll(scrollBehavior.current.jumpToLatest());
            setThreadScrollState(scrollBehavior.current.state());
          }}
          style={{
            position: "absolute",
            left: "50%",
            marginLeft: -21,
            bottom: 12,
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1,
            borderColor: native.fillPressed,
            backgroundColor: native.fill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NativeSymbol ios="arrow.down" android="arrow-down" size={18} color={tokens.foreground} />
          {threadScrollState.unread ? (
            <View
              style={{
                position: "absolute",
                top: 3,
                right: 3,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: tokens.primary,
              }}
            />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
