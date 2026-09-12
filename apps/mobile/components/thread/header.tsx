import type { ComputerStatusChipKind } from "@rakazo/core";
import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import type { MobileBot } from "../../lib/api";
import { typeScale } from "../../lib/appearance";
import { botAvatarSrc } from "../../lib/bot-avatar-src";
import { useI18n } from "../../lib/i18n";
import { useMobileTokens } from "../../lib/native";
import { BotAvatar } from "../bot-avatar";
import { NativeSymbol } from "../native-symbol";
import type { BotAction } from "./types";

export function ThreadHeader({
  botId,
  groupId,
  inGroup,
  displayName,
  currentBot,
  computerKind,
  botActions,
  botActionsOpen,
  onCloseBotActions,
  onShowBotActions,
}: {
  botId?: string;
  groupId?: string;
  inGroup: boolean;
  displayName?: string;
  currentBot?: MobileBot;
  computerKind: ComputerStatusChipKind;
  botActions: BotAction[];
  botActionsOpen: boolean;
  onCloseBotActions: () => void;
  onShowBotActions: () => void;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  const navigation = useNavigation();
  const router = useRouter();
  const onShowBotActionsRef = useRef(onShowBotActions);
  onShowBotActionsRef.current = onShowBotActions;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: displayName || t("Thread"),
      headerTitle: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={!inGroup && botId ? t("Chat settings") : displayName || t("Thread")}
          disabled={inGroup || !botId}
          onPress={() => {
            if (!botId || inGroup) return;
            router.push({ pathname: "/bot-settings", params: { botId } });
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            maxWidth: 220,
          }}
        >
          {!inGroup && currentBot ? (
            <BotAvatar
              color={currentBot.color}
              shape={currentBot.avatarShape}
              identity={currentBot.id}
              size={24}
              muted={!currentBot.notifyOnFinish}
              imageSrc={botAvatarSrc(currentBot)}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={{ color: tokens.foreground, ...typeScale.body, fontWeight: "500" }}
          >
            {displayName || t("Thread")}
          </Text>
        </Pressable>
      ),
      headerRight: () =>
        inGroup ? (
          <Pressable
            accessibilityLabel={t("Group settings")}
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: "/group-settings",
                params: { groupId: groupId ?? "" },
              })
            }
          >
            <NativeSymbol
              ios="gearshape"
              android="settings-outline"
              size={21}
              color={tokens.foreground}
            />
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              accessibilityLabel={t("Open computer")}
              hitSlop={8}
              onPress={() =>
                router.push({
                  pathname: "/computer",
                  params: { botId: botId ?? "", name: displayName ?? t("Bot") },
                })
              }
            >
              <NativeSymbol
                ios="desktopcomputer"
                android="desktop-outline"
                size={20}
                color={computerKind === "live" ? tokens.primary : tokens.mutedForeground}
              />
            </Pressable>
            <Pressable
              accessibilityLabel={t("Bot actions")}
              hitSlop={8}
              onPress={() => onShowBotActionsRef.current()}
            >
              <NativeSymbol
                ios="ellipsis"
                android="ellipsis-horizontal"
                size={21}
                color={tokens.foreground}
              />
            </Pressable>
          </View>
        ),
    });
  }, [
    botId,
    computerKind,
    currentBot,
    displayName,
    groupId,
    inGroup,
    navigation,
    router,
    t,
    tokens,
  ]);

  return (
    <Modal
      visible={botActionsOpen}
      transparent
      animationType="fade"
      onRequestClose={onCloseBotActions}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: tokens.overlay,
        }}
      >
        <Pressable
          accessibilityLabel={t("Cancel")}
          onPress={onCloseBotActions}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: tokens.popover, borderRadius: 24, paddingVertical: 12 }}
        >
          {botActions.map((action) => (
            <Pressable
              key={action.text}
              accessibilityRole="button"
              onPress={() => {
                onCloseBotActions();
                action.onPress();
              }}
              style={{ minHeight: 56, justifyContent: "center", paddingHorizontal: 24 }}
            >
              <Text
                style={{
                  color: action.destructive ? tokens.destructive : tokens.popoverForeground,
                  fontSize: 16,
                }}
              >
                {action.text}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
