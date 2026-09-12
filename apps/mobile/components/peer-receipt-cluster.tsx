import type { MessageBlock } from "@rakazo/contracts";
import { peerNameParts, uniquePeersFromCluster } from "@rakazo/core";
import { ActionSheetIOS, Platform, Pressable, Text } from "react-native";
import { mobileTokens, typeScale } from "../lib/appearance";
import { t } from "../lib/i18n";
import { presentMessageActionSheet } from "../lib/message-action-sheet";
import { useResolvedAppearance } from "../lib/native";
import { BotAvatar } from "./bot-avatar";

export type PeerReceiptLook = {
  color?: string;
  shape?: string | null;
  status?: string;
  imageSrc?: string;
};

function formatPeerNames(names: readonly string[]): string {
  const { first, second, overflow } = peerNameParts(names);
  if (!first) return "";
  if (!second) return first;
  if (overflow === 0) return t("{first} and {second}", { first, second });
  return t("{first}, {second} and {n} more", { first, second, n: overflow });
}

export function PeerReceiptCluster({
  messages,
  sentOnly: _sentOnly,
  peerLook,
  onOpenPeer,
}: {
  messages: { id: string; blocks: readonly MessageBlock[] }[];
  sentOnly: boolean;
  peerLook: (id: string) => PeerReceiptLook | undefined;
  onOpenPeer?: (peer: { peerBotId: string; peerBotName: string }) => void;
}) {
  const tokens = mobileTokens();
  const colorScheme = useResolvedAppearance();
  const peers = uniquePeersFromCluster(messages);
  const names = formatPeerNames(peers.map((peer) => peer.name || t("Bot")));
  const label = t("{count} messages with {name}", { count: messages.length, name: names });
  const first = peers[0];

  function openPeers() {
    const options = peers.map((peer) => peer.name || t("Bot"));
    if (options.length === 0) return;
    const openAt = (index: number) => {
      const peer = peers[index];
      if (!peer) return;
      onOpenPeer?.({ peerBotId: peer.id, peerBotName: peer.name || t("Bot") });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          userInterfaceStyle: colorScheme,
          options: [...options, t("Cancel")],
          cancelButtonIndex: options.length,
        },
        (index) => {
          if (index === undefined || index === options.length) return;
          openAt(index);
        },
      );
      return;
    }
    presentMessageActionSheet({
      colorScheme,
      cancel: t("Cancel"),
      more: t("More"),
      actions: peers.map((peer, index) => ({
        name: peer.id,
        text: peer.name || t("Bot"),
        onPress: () => openAt(index),
      })),
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={openPeers}
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: tokens.mutedForeground, ...typeScale.caption, textAlign: "center" }}>
        {t("{count} messages with", { count: messages.length })}
      </Text>
      {first ? (
        <BotAvatar
          color={peerLook(first.id)?.color ?? tokens.mutedForeground}
          shape={peerLook(first.id)?.shape}
          identity={first.id}
          size={16}
          imageSrc={peerLook(first.id)?.imageSrc}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          color: tokens.mutedForeground,
          ...typeScale.caption,
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {names}
      </Text>
    </Pressable>
  );
}
