import type { ComputerStatusChipKind } from "@rakazo/core";
import { Text, View } from "react-native";
import type { MobileBot } from "../../lib/api";
import { mobileTokens, typeScale } from "../../lib/appearance";
import { botAvatarSrc } from "../../lib/bot-avatar-src";
import { useI18n } from "../../lib/i18n";
import { isWorkingStatus, workingStatusKind } from "../../lib/thread-ui";
import { BotAvatar } from "../bot-avatar";

export type WorkingGroupBot = {
  botId: string;
  name: string;
  color: string;
  avatarShape?: string | null;
  hasAvatar?: boolean;
  status?: string;
};

export function StatusBubble({
  inGroup,
  currentBot,
  currentBotStatus,
  hasLiveProgress,
  workingGroupBots,
  mentionBots,
  rateLimitSeconds,
  computerKind,
}: {
  inGroup: boolean;
  currentBot?: MobileBot;
  currentBotStatus?: string;
  hasLiveProgress: boolean;
  workingGroupBots: WorkingGroupBot[];
  mentionBots: MobileBot[];
  rateLimitSeconds: number | null;
  computerKind: ComputerStatusChipKind;
}) {
  const tokens = mobileTokens();
  const { t } = useI18n();
  const statusKind = workingStatusKind({ rateLimitSeconds, computerKind });
  const workingStatusText =
    statusKind === "rate_limit" && rateLimitSeconds
      ? t("Rate limited · retrying in {s}s", { s: rateLimitSeconds })
      : statusKind === "setting_up"
        ? t("Setting up {name}'s computer…", { name: currentBot?.name ?? t("Bot") })
        : null;

  return !inGroup && currentBot && isWorkingStatus(currentBotStatus) && !hasLiveProgress ? (
    <View
      accessibilityLabel={t("{name} is working", { name: currentBot.name })}
      accessibilityRole="text"
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        minHeight: 40,
        marginTop: 12,
        gap: 8,
      }}
    >
      <BotAvatar
        color={currentBot.color}
        shape={currentBot.avatarShape}
        identity={currentBot.id}
        size={28}
        imageSrc={botAvatarSrc(currentBot)}
      />
      <View
        style={{
          backgroundColor: tokens.muted,
          borderRadius: 18,
          paddingHorizontal: 12,
          paddingVertical: 8,
          maxWidth: "72%",
        }}
      >
        {workingStatusText ? (
          <Text style={{ color: tokens.mutedForeground, ...typeScale.small }}>
            {workingStatusText}
          </Text>
        ) : (
          <View style={{ flexDirection: "row", gap: 4, paddingVertical: 2 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.mutedForeground,
              }}
            />
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.mutedForeground,
                opacity: 0.6,
              }}
            />
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.mutedForeground,
                opacity: 0.3,
              }}
            />
          </View>
        )}
      </View>
      <Text style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}>
        {t("{name} is working", { name: currentBot.name })}
      </Text>
    </View>
  ) : inGroup && workingGroupBots.length > 0 ? (
    <View
      accessibilityLabel={
        workingGroupBots.length === 1
          ? t("{name} is working", { name: workingGroupBots[0]?.name ?? t("Agent") })
          : t("{count} agents working", { count: workingGroupBots.length })
      }
      accessibilityRole="text"
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 40,
        marginTop: 12,
      }}
    >
      <View style={{ flexDirection: "row", paddingRight: 8 }}>
        {workingGroupBots.map((bot, index) => (
          <View
            key={bot.botId}
            style={{
              marginLeft: index === 0 ? 0 : -8,
              zIndex: workingGroupBots.length - index,
            }}
          >
            <BotAvatar
              color={bot.color}
              shape={bot.avatarShape}
              identity={bot.botId}
              size={28}
              imageSrc={botAvatarSrc(
                mentionBots.find((item) => item.id === bot.botId) ?? {
                  botId: bot.botId,
                  hasAvatar: bot.hasAvatar,
                },
              )}
            />
          </View>
        ))}
      </View>
      <Text style={{ color: tokens.mutedForeground, fontSize: 13.5 }}>
        {workingGroupBots.length === 1
          ? t("{name} is working", { name: workingGroupBots[0]?.name ?? t("Agent") })
          : t("{count} agents working", { count: workingGroupBots.length })}
      </Text>
    </View>
  ) : null;
}
