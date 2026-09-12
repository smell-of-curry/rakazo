import type { AgentSkillCatalogEntry } from "@rakazo/contracts";
import type { ComposerMention, SlashActionId } from "@rakazo/core";
import { mentionChipKey, type SLASH_ACTIONS, truncateSlashDescription } from "@rakazo/core";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import type { MobileMessage } from "../../lib/api";
import { typeScale } from "../../lib/appearance";
import { botAvatarSrc } from "../../lib/bot-avatar-src";
import { useI18n } from "../../lib/i18n";
import { useMobileTokens } from "../../lib/native";
import { composerRightSlot, previewMessageText } from "../../lib/thread-ui";
import { BotAvatar } from "../bot-avatar";
import { NativeSymbol } from "../native-symbol";
import type { PendingAttachment } from "./types";

export function MentionOptionIcon({ mention }: { mention: ComposerMention }) {
  const tokens = useMobileTokens();
  if (mention.kind === "routine") {
    return (
      <NativeSymbol ios="clock" android="time-outline" size={16} color={tokens.mutedForeground} />
    );
  }
  if (mention.kind === "connector") {
    return (
      <NativeSymbol
        ios="puzzlepiece.extension"
        android="extension-puzzle-outline"
        size={16}
        color={tokens.mutedForeground}
      />
    );
  }
  if (mention.kind === "group") {
    return (
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: tokens.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: tokens.foreground, fontSize: 9 }}>G</Text>
      </View>
    );
  }
  if (mention.kind === "everyone") {
    return (
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: tokens.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: tokens.foreground, fontSize: 9 }}>@</Text>
      </View>
    );
  }
  return (
    <BotAvatar
      color={mention.color ?? tokens.mutedForeground}
      identity={mention.id}
      size={20}
      imageSrc={botAvatarSrc(mention)}
    />
  );
}

export function ThreadComposer({
  displayName,
  colorScheme,
  replyTarget,
  onCancelReply,
  attachmentNotice,
  pendingAttachments,
  onRemoveAttachment,
  mentionOptions,
  onInsertMention,
  slashSkillOptions,
  slashActionOptions,
  onInsertSkill,
  onRunSlashAction,
  selectedSkill,
  onClearSkill,
  draft,
  onDraftChange,
  onRemoveLastChip,
  onAttach,
  working,
  canSend,
  sending,
  onSend,
  onStop,
  onVoice,
  error,
  hideComposerError,
}: {
  displayName?: string;
  colorScheme: "light" | "dark";
  replyTarget: MobileMessage | null;
  onCancelReply: () => void;
  attachmentNotice: string | null;
  pendingAttachments: PendingAttachment[];
  onRemoveAttachment: (id: string) => void;
  mentionOptions: ComposerMention[];
  onInsertMention: (mention: ComposerMention) => void;
  slashSkillOptions: AgentSkillCatalogEntry[];
  slashActionOptions: ReadonlyArray<(typeof SLASH_ACTIONS)[number]>;
  onInsertSkill: (skill: AgentSkillCatalogEntry) => void;
  onRunSlashAction: (action: SlashActionId) => void;
  selectedSkill: AgentSkillCatalogEntry | null;
  onClearSkill: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onRemoveLastChip: () => void;
  onAttach: () => void;
  working: boolean;
  canSend: boolean;
  sending: boolean;
  onSend: () => void;
  onStop: () => void;
  onVoice: () => void;
  error: string | null;
  hideComposerError: boolean;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  const rightSlot = composerRightSlot(working, canSend);

  return (
    <>
      {replyTarget ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>{t("Replying to")}</Text>
            <Text style={{ color: tokens.foreground, fontSize: 13 }} numberOfLines={1}>
              {previewMessageText(replyTarget)}
            </Text>
          </View>
          <Pressable accessibilityLabel={t("Cancel reply")} onPress={onCancelReply}>
            <Text style={{ color: tokens.mutedForeground }}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      {attachmentNotice ? (
        <Text style={{ color: tokens.warning, marginTop: 12, fontSize: 13 }}>
          {attachmentNotice}
        </Text>
      ) : null}
      {pendingAttachments.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          {pendingAttachments.map((attachment) => (
            <View
              key={attachment.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.card,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              {attachment.previewUri ? (
                <Image
                  source={{ uri: attachment.previewUri }}
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                />
              ) : (
                <Text style={{ color: tokens.foreground }}>📎</Text>
              )}
              <Text style={{ color: tokens.foreground, maxWidth: 140 }} numberOfLines={1}>
                {attachment.name}
              </Text>
              <Pressable
                accessibilityLabel={t("Remove {name}", { name: attachment.name })}
                onPress={() => onRemoveAttachment(attachment.id)}
              >
                <NativeSymbol
                  ios="xmark"
                  android="close"
                  size={14}
                  color={tokens.mutedForeground}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {mentionOptions.length ? (
        <View
          testID="mention-picker"
          style={{
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
            overflow: "hidden",
          }}
        >
          {mentionOptions.map((mention) => (
            <Pressable
              key={mentionChipKey(mention)}
              accessibilityLabel={t("@{name}", { name: mention.name })}
              onPress={() => onInsertMention(mention)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <MentionOptionIcon mention={mention} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: tokens.foreground, fontSize: 14 }}>@{mention.name}</Text>
                {mention.subtitle ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: tokens.mutedForeground,
                      fontSize: 12.5,
                      marginTop: 2,
                    }}
                  >
                    {mention.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {slashSkillOptions.length || slashActionOptions.length ? (
        <View
          testID="slash-picker"
          style={{
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.card,
            overflow: "hidden",
          }}
        >
          {slashSkillOptions.map((skill) => (
            <Pressable
              key={skill.id}
              accessibilityLabel={t("Skill {name}", { name: skill.name })}
              onPress={() => onInsertSkill(skill)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <NativeSymbol
                ios="cube"
                android="cube-outline"
                size={16}
                color={tokens.mutedForeground}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: tokens.foreground, fontSize: 14 }}>{skill.name}</Text>
                <Text
                  numberOfLines={1}
                  style={{ color: tokens.mutedForeground, fontSize: 12.5, marginTop: 2 }}
                >
                  {truncateSlashDescription(skill.description)}
                </Text>
              </View>
            </Pressable>
          ))}
          {slashActionOptions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityLabel={t(action.label)}
              onPress={() => onRunSlashAction(action.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <NativeSymbol
                ios="gearshape"
                android="settings-outline"
                size={16}
                color={tokens.mutedForeground}
              />
              <Text style={{ color: tokens.foreground, fontSize: 14 }}>{t(action.label)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 8,
          alignItems: "center",
          minHeight: 40,
          backgroundColor: tokens.card,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 999,
          paddingHorizontal: 6,
        }}
      >
        <Pressable
          accessibilityLabel={t("Attach file")}
          onPress={onAttach}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NativeSymbol ios="plus" android="add" size={16} color={tokens.mutedForeground} />
        </Pressable>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            minHeight: 40,
            paddingVertical: 4,
          }}
        >
          {selectedSkill ? (
            <View
              testID="skill-chip"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: tokens.muted,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
                maxWidth: "100%",
              }}
            >
              <NativeSymbol
                ios="cube"
                android="cube-outline"
                size={13}
                color={tokens.mutedForeground}
              />
              <Text
                numberOfLines={1}
                style={{ color: tokens.foreground, fontSize: 13, flexShrink: 1 }}
              >
                {selectedSkill.name}
              </Text>
              <Pressable
                accessibilityLabel={t("Remove skill {name}", { name: selectedSkill.name })}
                hitSlop={8}
                onPress={onClearSkill}
              >
                <NativeSymbol
                  ios="xmark"
                  android="close"
                  size={12}
                  color={tokens.mutedForeground}
                />
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={onDraftChange}
            accessibilityLabel={
              displayName ? t("Message {name}", { name: displayName }) : t("Message")
            }
            onKeyPress={(event) => {
              if (
                event.nativeEvent.key === "Backspace" &&
                draft.length === 0 &&
                selectedSkill !== null
              ) {
                onRemoveLastChip();
              }
            }}
            placeholder={
              selectedSkill
                ? undefined
                : displayName
                  ? t("Message {name}", { name: displayName })
                  : t("Message…")
            }
            placeholderTextColor={tokens.mutedForeground}
            keyboardAppearance={colorScheme}
            multiline
            textAlignVertical="center"
            blurOnSubmit={false}
            style={{
              flexGrow: 1,
              flexShrink: 1,
              minWidth: 96,
              color: tokens.foreground,
              ...typeScale.body,
              paddingVertical: 2,
              maxHeight: 100,
              writingDirection: "auto",
            }}
          />
        </View>
        {rightSlot === "stop" || rightSlot === "stop+send" ? (
          <Pressable
            accessibilityLabel={t("Stop")}
            disabled={sending}
            onPress={onStop}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: tokens.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: sending ? 0.5 : 1,
            }}
          >
            <NativeSymbol
              ios="stop.fill"
              android="stop"
              size={12}
              color={tokens.primaryForeground}
            />
          </Pressable>
        ) : rightSlot === "send" ? (
          <Pressable
            accessibilityLabel={t("Send")}
            disabled={sending}
            onPress={onSend}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: tokens.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: sending ? 0.5 : 1,
            }}
          >
            <NativeSymbol
              ios="arrow.up"
              android="arrow-up"
              size={14}
              color={tokens.primaryForeground}
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel={t("Voice")}
            onPress={onVoice}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: tokens.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NativeSymbol ios="mic.fill" android="mic" size={14} color={tokens.primaryForeground} />
          </Pressable>
        )}
        {rightSlot === "stop+send" ? (
          <Pressable
            accessibilityLabel={t("Send")}
            disabled={sending}
            onPress={onSend}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: tokens.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: sending ? 0.5 : 1,
            }}
          >
            <NativeSymbol
              ios="arrow.up"
              android="arrow-up"
              size={14}
              color={tokens.primaryForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {error && !hideComposerError ? (
        <Text style={{ color: tokens.destructive, ...typeScale.small, marginTop: 6 }}>{error}</Text>
      ) : null}
    </>
  );
}
