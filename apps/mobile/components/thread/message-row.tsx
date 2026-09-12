import { ChatMarkdown } from "@rakazo/chat-ui/native";
import type { MessageBlock } from "@rakazo/contracts";
import type { CondensedTranscriptRow } from "@rakazo/core";
import {
  cloudAgentHttpsUrl,
  isCenteredAgentEvent,
  isRateLimitError,
  messagePresentationSegments,
  messageProviderLabel,
} from "@rakazo/core";
import { memo, type RefObject, useState } from "react";
import { Alert, Linking, Pressable, type ScrollView, Text, View } from "react-native";
import { blockText, type MobileBot, type MobileMessage, type MobileSnapshot } from "../../lib/api";
import { mobileTokens, typeScale } from "../../lib/appearance";
import type { MobileArtifactTarget } from "../../lib/artifact-open";
import { openMobileArtifact } from "../../lib/artifact-open";
import { botAvatarSrc } from "../../lib/bot-avatar-src";
import { useI18n } from "../../lib/i18n";
import { useResolvedAppearance } from "../../lib/native";
import {
  memberName,
  messageCardKind,
  previewMessageText,
  sameBubbleSender,
  shouldShowMessageTimestamp,
} from "../../lib/thread-ui";
import { AppConnectCard } from "../AppConnectCard";
import { BotAvatar } from "../bot-avatar";
import type { MarkdownArtifactPreviewTarget } from "../markdown-artifact-preview";
import { ApprovalAskCard, AskBlock, ComputerGateCard } from "./gate-cards";
import { TimestampDivider } from "./timestamp-divider";
import type { MessageActionProps } from "./types";

export function neighborMessage(row?: CondensedTranscriptRow<MobileMessage>) {
  return row?.type === "message" ? row.message : undefined;
}

export function MessageRow({
  message,
  older,
  newer,
  enableJump,
  jumpScrollTarget,
  pinnedScroll,
  botId,
  groupId,
  inGroup,
  displayName,
  mentionBots,
  members,
  currentBot,
  messagesById,
  reactionView,
  answerableAskMessageId,
  onAnswer,
  onOpenBot,
  onPreviewMarkdown,
  actionProps,
  peerLook,
}: {
  message: MobileMessage;
  older?: MobileMessage;
  newer?: MobileMessage;
  enableJump?: boolean;
  jumpScrollTarget: RefObject<string | null>;
  pinnedScroll: RefObject<ScrollView | null>;
  botId?: string;
  groupId?: string;
  inGroup: boolean;
  displayName?: string;
  mentionBots: MobileBot[];
  members?: MobileSnapshot["members"];
  currentBot?: MobileBot;
  messagesById: Map<string, MobileMessage>;
  reactionView: { reactions: Map<string, Map<string, number>> };
  answerableAskMessageId: string | null;
  onAnswer: (message: MobileMessage, answer: string) => Promise<void>;
  onOpenBot: (botId: string, name: string) => void;
  onPreviewMarkdown: (target: MarkdownArtifactPreviewTarget) => void;
  actionProps: MessageActionProps;
  peerLook: (id: string) => { imageSrc?: string };
}) {
  const tokens = mobileTokens();
  const messageReactions = reactionView.reactions.get(message.id);
  const activityBotId =
    !inGroup && message.role === "bot" && message.id.startsWith("progress:")
      ? (message.botId ?? botId)
      : undefined;
  const activityBot = activityBotId
    ? (members?.find((member) => member.botId === activityBotId) ??
      (currentBot?.id === activityBotId ? currentBot : undefined))
    : undefined;
  const groupedWithOlder = sameBubbleSender(message, older, botId);
  const groupedWithNewer = sameBubbleSender(message, newer, botId);
  const showTimestamp = shouldShowMessageTimestamp(message.createdAt, older?.createdAt);
  const userBubble = message.role === "user";
  return (
    <View
      onLayout={
        enableJump
          ? (event) => {
              if (jumpScrollTarget.current !== message.id) return;
              const y = Math.max(0, event.nativeEvent.layout.y - 24);
              requestAnimationFrame(() => {
                if (jumpScrollTarget.current !== message.id) return;
                pinnedScroll.current?.scrollTo({ y, animated: true });
                jumpScrollTarget.current = null;
              });
            }
          : undefined
      }
      style={{
        marginTop: groupedWithNewer ? 2 : 12,
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        justifyContent: userBubble ? "flex-end" : "flex-start",
      }}
    >
      {activityBotId ? (
        <View style={{ paddingTop: 22 }}>
          <BotAvatar
            color={activityBot?.color ?? tokens.mutedForeground}
            shape={activityBot?.avatarShape}
            identity={activityBotId}
            size={inGroup ? 20 : 28}
            imageSrc={peerLook(activityBotId).imageSrc}
          />
        </View>
      ) : null}
      <View
        style={{
          width: isCenteredAgentEvent(message.blocks) ? "100%" : undefined,
          maxWidth: isCenteredAgentEvent(message.blocks)
            ? "100%"
            : activityBotId
              ? undefined
              : "90%",
          flex: activityBotId ? 1 : undefined,
          flexShrink: 1,
        }}
      >
        {showTimestamp && message.createdAt ? (
          <TimestampDivider createdAt={message.createdAt} />
        ) : null}
        <Pressable accessible={false} onLongPress={actionProps.onLongPress}>
          <MessageBubble
            botId={botId ?? members?.[0]?.botId ?? ""}
            groupId={groupId}
            message={message}
            botName={displayName}
            bots={mentionBots}
            members={members}
            groupedWithOlder={groupedWithOlder}
            groupedWithNewer={groupedWithNewer}
            replyPreview={
              message.replyToMessageId ? messagesById.get(message.replyToMessageId) : undefined
            }
            canAnswer={message.id === answerableAskMessageId}
            onAnswer={onAnswer}
            onOpenBot={onOpenBot}
            onPreviewMarkdown={onPreviewMarkdown}
            actionProps={actionProps}
          />
        </Pressable>
        {messageReactions ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 4,
              justifyContent: message.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            {[...messageReactions].map(([emoji, count]) => (
              <Text
                key={emoji}
                style={{
                  color: tokens.foreground,
                  backgroundColor: tokens.muted,
                  borderColor: tokens.border,
                  borderWidth: 1,
                  borderRadius: 16,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  fontSize: 13,
                }}
              >
                {emoji}
                {count > 1 ? ` ${count}` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(function MessageBubble({
  botId,
  botName,
  bots,
  groupId,
  message,
  members,
  replyPreview,
  canAnswer,
  onAnswer,
  onOpenBot,
  onPreviewMarkdown,
  groupedWithOlder,
  groupedWithNewer,
  actionProps,
}: {
  botId: string;
  botName?: string;
  bots: MobileBot[];
  groupId?: string;
  message: MobileMessage;
  members?: MobileSnapshot["members"];
  replyPreview?: MobileMessage;
  groupedWithOlder?: boolean;
  groupedWithNewer?: boolean;
  canAnswer: boolean;
  onAnswer: (message: MobileMessage, answer: string) => Promise<void>;
  onOpenBot: (botId: string, name: string) => void;
  onPreviewMarkdown: (target: MarkdownArtifactPreviewTarget) => void;
  actionProps: MessageActionProps;
}) {
  const colorScheme = useResolvedAppearance();
  const tokens = mobileTokens();
  const { t } = useI18n();
  const [peerExpanded, setPeerExpanded] = useState(false);
  const artifactTarget: MobileArtifactTarget = groupId ? { groupId } : { botId };
  const cardBotId = message.botId ?? botId;
  const appConnectBlocks = message.blocks.filter(
    (block): block is Extract<MessageBlock, { kind: "app_connect" }> =>
      block.kind === "app_connect",
  );
  const cardKind = messageCardKind(message.blocks);

  if (cardKind === "computer_gate") {
    const computerGate = message.blocks.find(
      (block): block is Extract<MessageBlock, { kind: "computer" }> =>
        block.kind === "computer" && block.state === "Needs you",
    );
    if (computerGate) {
      return <ComputerGateCard block={computerGate} botId={cardBotId} botName={botName} />;
    }
  }

  if (cardKind === "ask") {
    const ask = message.blocks.find(
      (block): block is Extract<MessageBlock, { kind: "ask" }> =>
        block.kind === "ask" && !block.actions?.length,
    );
    if (ask) {
      return (
        <View style={{ gap: 8, width: "100%" }}>
          <AskBlock
            ask={ask}
            actionProps={actionProps}
            canAnswer={canAnswer}
            onAnswer={(answer) => onAnswer(message, answer)}
          />
          {appConnectBlocks.map((block, index) => (
            <AppConnectCard
              key={`${block.provider}-${index}`}
              botId={cardBotId}
              block={block}
              accessibilityActions={actionProps.accessibilityActions}
              onAccessibilityAction={actionProps.onAccessibilityAction}
            />
          ))}
        </View>
      );
    }
  }

  if (cardKind === "handoff") {
    const handoff = message.blocks.find((block) => block.kind === "handoff");
    if (handoff && handoff.kind === "handoff") {
      const from = memberName(members, handoff.fromBotId) ?? t("bot");
      const to = memberName(members, handoff.toBotId) ?? t("bot");
      return (
        <AgentEventLabel
          actionProps={actionProps}
          label={t("{from} messaged {to}", { from, to })}
          detail={handoff.text}
          expanded={peerExpanded}
          onToggle={() => setPeerExpanded((expanded) => !expanded)}
        />
      );
    }
  }

  if (cardKind === "peer") {
    const peerMessage = message.blocks.find(
      (
        block,
      ): block is Extract<MessageBlock, { kind: "bot_message_sent" | "bot_message_received" }> =>
        block.kind === "bot_message_sent" || block.kind === "bot_message_received",
    );
    if (peerMessage) {
      const sent = peerMessage.kind === "bot_message_sent";
      const peer = sent ? peerMessage.toBotName : peerMessage.fromBotName;
      const peerBotId = sent ? peerMessage.toBotId : peerMessage.fromBotId;
      const label =
        peerMessage.text && isRateLimitError(peerMessage.text)
          ? t("{peer} rate-limited", { peer: peer ?? t("Bot") })
          : sent
            ? t("Messaged {peer}", { peer: peer ?? t("Bot") })
            : t("Message from {peer}", { peer: peer ?? t("Bot") });
      const peerColor =
        bots.find((bot) => bot.id === peerBotId)?.color ??
        members?.find((member) => member.botId === peerBotId)?.color ??
        tokens.mutedForeground;
      return (
        <Pressable
          {...actionProps}
          accessible
          accessibilityLabel={label}
          style={{
            width: "100%",
            paddingVertical: 4,
            alignItems: "center",
            justifyContent: "flex-start",
            flexDirection: "row",
            gap: 6,
          }}
        >
          <BotAvatar
            color={peerColor}
            identity={peerBotId}
            size={16}
            imageSrc={botAvatarSrc(
              bots.find((bot) => bot.id === peerBotId) ??
                (members?.find((member) => member.botId === peerBotId)
                  ? {
                      botId: peerBotId,
                      hasAvatar: members.find((member) => member.botId === peerBotId)?.hasAvatar,
                    }
                  : undefined),
            )}
          />
          <Text
            numberOfLines={1}
            style={{ color: tokens.mutedForeground, fontSize: 13.5, flexShrink: 1 }}
          >
            {label}
          </Text>
        </Pressable>
      );
    }
  }

  if (cardKind === "channel") {
    const channelMessage = message.blocks.find(
      (block): block is Extract<MessageBlock, { kind: "channel_message" }> =>
        block.kind === "channel_message",
    );
    if (channelMessage) {
      return (
        <Pressable
          {...actionProps}
          style={{ width: "100%", paddingVertical: 4, alignItems: "center" }}
        >
          <Text style={{ color: tokens.mutedForeground, fontSize: 13.5, textAlign: "center" }}>
            {messageProviderLabel(channelMessage.provider, channelMessage.transport)} ·{" "}
            {channelMessage.fromLabel}: {channelMessage.text}
          </Text>
        </Pressable>
      );
    }
  }

  const special = message.blocks.find(
    (block) =>
      block.kind === "subagent" || block.kind === "child_bot" || block.kind === "cloud_agent",
  );
  if (cardKind === "subagent" && special?.kind === "subagent") {
    const running = special.status === "running";
    const failed = special.status === "failed";
    return (
      <Pressable
        {...actionProps}
        style={{
          width: "90%",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: "600" }}>
            {special.name || t("subagent")}
          </Text>
          <Text
            style={{
              color: failed ? tokens.destructive : running ? tokens.warning : tokens.success,
              fontSize: 13,
            }}
          >
            {running
              ? t("Running")
              : special.status === "failed"
                ? t("Failed")
                : special.status === "completed"
                  ? t("Completed")
                  : special.status}
          </Text>
        </View>
        {special.task ? (
          <Text style={{ color: tokens.mutedForeground, marginTop: 8, fontSize: 13.5 }}>
            {special.task}
          </Text>
        ) : null}
        {special.result || special.progress ? (
          <View style={{ marginTop: 8 }}>
            <ChatMarkdown palette={tokens} colorScheme={colorScheme} streaming={running}>
              {special.result || special.progress || ""}
            </ChatMarkdown>
          </View>
        ) : null}
      </Pressable>
    );
  }

  if (cardKind === "cloud_agent" && special?.kind === "cloud_agent") {
    const title = special.title || t("Cloud agent");
    const statusLabel =
      special.status === "running"
        ? t("running")
        : special.status === "finished"
          ? t("finished")
          : special.status === "cancelled"
            ? t("cancelled")
            : t("failed");
    const running = special.status === "running";
    const failed = special.status === "failed" || special.status === "cancelled";
    const prHref = cloudAgentHttpsUrl(special.prUrl);
    const href = prHref ?? cloudAgentHttpsUrl(special.url);
    return (
      <Pressable
        onPress={() => {
          if (href) Linking.openURL(href).catch(() => undefined);
        }}
        testID="cloud-agent-card"
        accessibilityRole={href ? "link" : "text"}
        accessibilityLabel={`${title}: ${statusLabel}`}
        disabled={!href}
        style={{
          width: "90%",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: tokens.cardForeground, fontSize: 15, fontWeight: "600" }}>
            {title}
          </Text>
          <Text
            style={{
              color: failed ? tokens.destructive : running ? tokens.warning : tokens.success,
              fontSize: 13,
            }}
          >
            {statusLabel}
          </Text>
        </View>
        {prHref ? (
          <Text style={{ color: tokens.mutedForeground, marginTop: 8, fontSize: 14.5 }}>
            {t("Pull request")}
          </Text>
        ) : special.branch ? (
          <Text style={{ color: tokens.mutedForeground, marginTop: 8, fontSize: 13.5 }}>
            {special.branch}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  if (cardKind === "child_bot" && special?.kind === "child_bot") {
    const removed = special.status === "deleted" || special.status === "archived";
    return (
      <Pressable
        {...actionProps}
        onPress={
          removed ? undefined : () => onOpenBot(special.botId ?? "", special.name ?? t("Bot"))
        }
        style={{
          width: "90%",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          paddingHorizontal: 16,
          paddingVertical: 14,
          opacity: removed ? 0.6 : 1,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: "600" }}>
            {special.name || t("Bot")}
          </Text>
          <Text style={{ color: removed ? tokens.destructive : tokens.success, fontSize: 13 }}>
            {special.status === "archived"
              ? t("archived")
              : special.status === "deleted"
                ? t("deleted")
                : t("bot")}
          </Text>
        </View>
        <Text
          style={{
            color: tokens.mutedForeground,
            marginTop: 8,
            fontSize: 14.5,
            lineHeight: 21,
          }}
        >
          {removed
            ? special.status === "archived"
              ? t("Archived. Chat, memory, and files kept.")
              : t("Removed with chat, computer, and memory.")
            : special.title || t("Opened its thread.")}
        </Text>
      </Pressable>
    );
  }

  if (cardKind === "app_connect_only") {
    return (
      <View style={{ gap: 8, width: "100%" }}>
        {appConnectBlocks.map((block, index) => (
          <AppConnectCard
            key={`${block.provider}-${index}`}
            botId={cardBotId}
            block={block}
            accessibilityActions={actionProps.accessibilityActions}
            onAccessibilityAction={actionProps.onAccessibilityAction}
          />
        ))}
      </View>
    );
  }

  if (cardKind === "ask_actions") {
    const askBlock = message.blocks.find(
      (block): block is Extract<MessageBlock, { kind: "ask" }> =>
        block.kind === "ask" && Boolean(block.actions?.length),
    );
    if (askBlock) {
      return (
        <View style={{ gap: 8, width: "100%" }}>
          <ApprovalAskCard
            askBlock={askBlock}
            message={message}
            canAnswer={canAnswer}
            onAnswer={onAnswer}
            actionProps={actionProps}
          />
          {appConnectBlocks.map((block, index) => (
            <AppConnectCard
              key={`${block.provider}-${index}`}
              botId={cardBotId}
              block={block}
              accessibilityActions={actionProps.accessibilityActions}
              onAccessibilityAction={actionProps.onAccessibilityAction}
            />
          ))}
        </View>
      );
    }
  }

  if (cardKind === "attachments") {
    const attachments = message.blocks.filter(
      (block) => block.kind === "image" || block.kind === "file",
    );
    const caption = message.blocks
      .flatMap((block) => {
        if (block.kind === "channel_message" && block.text) {
          return [
            `${messageProviderLabel(block.provider, block.transport)} · ${block.fromLabel}: ${block.text}`,
          ];
        }
        return block.kind === "text" && block.text ? [block.text] : [];
      })
      .join("\n");
    const speaker =
      message.role === "bot" ? (memberName(members, message.botId) ?? botName) : undefined;
    return (
      <View
        style={{
          maxWidth: "100%",
          borderRadius: 20,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: message.role === "user" ? tokens.secondary : tokens.muted,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        {speaker ? (
          <Text style={{ color: tokens.mutedForeground, fontSize: 12.5, fontWeight: "600" }}>
            {speaker}
          </Text>
        ) : null}
        {replyPreview ? (
          <Text
            style={{
              color: message.role === "user" ? tokens.secondaryForeground : tokens.mutedForeground,
              fontSize: 12.5,
            }}
            numberOfLines={2}
          >
            {previewMessageText(replyPreview)}
          </Text>
        ) : null}
        {caption ? (
          <Text
            style={{
              color: message.role === "user" ? tokens.secondaryForeground : tokens.foreground,
              fontSize: 15,
            }}
          >
            {caption}
          </Text>
        ) : null}
        {attachments.map((attachment, index) =>
          attachment.kind === "image" ? (
            <Pressable
              {...actionProps}
              key={`${attachment.artifactId ?? attachment.name ?? "image"}-${index}`}
              onPress={() =>
                attachment.artifactId
                  ? void openMobileArtifact(
                      artifactTarget,
                      attachment.artifactId,
                      attachment.name ?? t("Image"),
                      attachment.mimeType ?? "image/png",
                    ).catch((err) =>
                      Alert.alert(
                        t("Could not open image"),
                        err instanceof Error ? err.message : t("Try again."),
                      ),
                    )
                  : undefined
              }
            >
              <Text
                style={{
                  color: message.role === "user" ? tokens.secondaryForeground : tokens.foreground,
                  fontSize: 15,
                }}
              >
                🖼 {attachment.name ?? t("Image")}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              {...actionProps}
              key={`${attachment.artifactId ?? attachment.name ?? "file"}-${index}`}
              onPress={() =>
                attachment.artifactId
                  ? attachment.mimeType === "text/markdown"
                    ? onPreviewMarkdown({
                        artifactId: attachment.artifactId,
                        name: attachment.name ?? t("Markdown file"),
                        mimeType: attachment.mimeType,
                      })
                    : void openMobileArtifact(
                        artifactTarget,
                        attachment.artifactId,
                        attachment.name ?? t("File"),
                        attachment.mimeType ?? "text/plain",
                      ).catch((err) =>
                        Alert.alert(
                          t("Could not open file"),
                          err instanceof Error ? err.message : t("Try again."),
                        ),
                      )
                  : undefined
              }
            >
              <Text
                style={{
                  color: message.role === "user" ? tokens.secondaryForeground : tokens.foreground,
                  fontSize: 15,
                }}
              >
                📎 {attachment.name ?? t("File")}
              </Text>
              {attachment.size ? (
                <Text
                  style={{
                    color:
                      message.role === "user" ? tokens.secondaryForeground : tokens.mutedForeground,
                    marginTop: 4,
                    fontSize: 13,
                  }}
                >
                  {attachment.mimeType ?? "file"} · {attachment.size} bytes
                </Text>
              ) : null}
            </Pressable>
          ),
        )}
        {appConnectBlocks.map((block, index) => (
          <AppConnectCard
            key={`${block.provider}-${index}`}
            botId={cardBotId}
            block={block}
            accessibilityActions={actionProps.accessibilityActions}
            onAccessibilityAction={actionProps.onAccessibilityAction}
          />
        ))}
      </View>
    );
  }

  const segments = messagePresentationSegments(message.blocks);
  const speaker =
    message.role === "bot" ? (memberName(members, message.botId) ?? botName) : undefined;
  const firstContent = segments.findIndex((segment) => segment.kind === "content");
  return (
    <View style={{ gap: 8, width: "100%" }}>
      {segments.map((segment, index) => (
        <MessageTextCard
          key={`${message.id}-content-${index}`}
          message={{ ...message, blocks: segment.blocks }}
          speaker={index === firstContent ? speaker : undefined}
          replyPreview={index === firstContent ? replyPreview : undefined}
          groupedWithOlder={groupedWithOlder}
          groupedWithNewer={groupedWithNewer}
          actionProps={actionProps}
        />
      ))}
      {appConnectBlocks.map((block, index) => (
        <AppConnectCard
          key={`${block.provider}-${index}`}
          botId={cardBotId}
          block={block}
          accessibilityActions={actionProps.accessibilityActions}
          onAccessibilityAction={actionProps.onAccessibilityAction}
        />
      ))}
    </View>
  );
});

function MessageTextCard({
  message,
  speaker,
  replyPreview,
  groupedWithOlder,
  groupedWithNewer,
  actionProps,
}: {
  message: MobileMessage;
  speaker?: string;
  replyPreview?: MobileMessage;
  groupedWithOlder?: boolean;
  groupedWithNewer?: boolean;
  actionProps: MessageActionProps;
}) {
  const colorScheme = useResolvedAppearance();
  const tokens = mobileTokens();
  const contentText = blockText(message);
  if (!contentText) return null;
  const userBubble = message.role === "user";
  const radius = 18;
  const inner = 6;
  return (
    <Pressable
      {...actionProps}
      style={{
        flexShrink: 1,
        minWidth: 0,
        maxWidth: "72%",
        backgroundColor: userBubble ? tokens.chatUser : tokens.muted,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius,
        borderTopLeftRadius: !userBubble && groupedWithOlder ? inner : radius,
        borderBottomLeftRadius: !userBubble && groupedWithNewer ? inner : radius,
        borderTopRightRadius: userBubble && groupedWithOlder ? inner : radius,
        borderBottomRightRadius: userBubble && groupedWithNewer ? inner : radius,
      }}
    >
      {speaker ? (
        <Text
          style={{
            color: tokens.mutedForeground,
            ...typeScale.captionMedium,
            marginBottom: 4,
          }}
        >
          {speaker}
        </Text>
      ) : null}
      {replyPreview ? (
        <Text
          style={{
            color: userBubble ? tokens.chatUserForeground : tokens.mutedForeground,
            ...typeScale.caption,
            marginBottom: 6,
          }}
          numberOfLines={2}
        >
          {previewMessageText(replyPreview)}
        </Text>
      ) : null}
      {userBubble ? (
        <Text style={{ color: tokens.chatUserForeground, ...typeScale.thread }}>{contentText}</Text>
      ) : (
        <ChatMarkdown
          palette={tokens}
          colorScheme={colorScheme}
          streaming={message.id.startsWith("progress:")}
        >
          {contentText}
        </ChatMarkdown>
      )}
    </Pressable>
  );
}

function AgentEventLabel({
  label,
  detail,
  expanded,
  onToggle,
  actionProps,
}: {
  label: string;
  detail?: string;
  expanded: boolean;
  onToggle: () => void;
  actionProps: MessageActionProps;
}) {
  const colorScheme = useResolvedAppearance();
  const tokens = mobileTokens();
  const { t } = useI18n();
  return (
    <Pressable
      {...actionProps}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={expanded ? t("Hide {label}", { label }) : t("Show {label}", { label })}
      style={{ width: "100%", paddingVertical: 4, alignItems: "center" }}
    >
      <Text style={{ color: tokens.mutedForeground, fontSize: 13.5, textAlign: "center" }}>
        ↔ {label}
      </Text>
      {expanded && detail ? (
        <View
          style={{
            width: "100%",
            marginTop: 6,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <ChatMarkdown palette={tokens} colorScheme={colorScheme}>
            {detail}
          </ChatMarkdown>
        </View>
      ) : null}
    </Pressable>
  );
}
