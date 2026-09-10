import type { MessageBlock } from "@rakazo/contracts";
import { isPeerBlock, isRateLimitError, uniquePeersFromCluster } from "@rakazo/core";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { t } from "../lib/i18n";
import { BotAvatar } from "./bot-avatar";
import { GroupAvatar } from "./group-avatar";

export type PeerReceiptLook = {
  color?: string;
  status?: string;
  imageSrc?: string;
};

export function PeerReceiptCluster({
  messages,
  sentOnly,
  peerLook,
  onOpenPeer,
}: {
  messages: { id: string; blocks: readonly MessageBlock[] }[];
  sentOnly: boolean;
  peerLook: (id: string) => PeerReceiptLook | undefined;
  onOpenPeer?: (peer: { peerBotId: string; peerBotName: string }) => void;
}) {
  const tokens = mobileTokens();
  const [expanded, setExpanded] = useState(false);
  const peers = uniquePeersFromCluster(messages);
  const prefix = sentOnly
    ? t("Messaged")
    : t("{count} messages with", { count: messages.length });
  const suffix = t("{count} Bots", { count: peers.length });
  const label = `${prefix} ${suffix}`;

  return (
    <View style={{ width: "100%", gap: 4, alignItems: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>{prefix}</Text>
        <GroupAvatar
          members={peers.slice(0, 3).map((peer) => ({
            botId: peer.id,
            name: peer.name,
            color: peerLook(peer.id)?.color ?? tokens.mutedForeground,
            status: peerLook(peer.id)?.status,
            imageSrc: peerLook(peer.id)?.imageSrc,
          }))}
          size={22}
        />
        <Text style={{ color: tokens.mutedForeground, fontSize: 12 }}>{suffix}</Text>
      </Pressable>
      {expanded
        ? messages.flatMap((message) =>
            message.blocks.flatMap((block, index) => {
              if (!isPeerBlock(block)) return [];
              const sent = block.kind === "bot_message_sent";
              const peerName = sent ? block.toBotName : block.fromBotName;
              const peerBotId = sent ? block.toBotId : block.fromBotId;
              const chip =
                block.text && isRateLimitError(block.text)
                  ? t("{peer} rate-limited", { peer: peerName || t("Bot") })
                  : sent
                    ? t("Messaged {peer}", { peer: peerName || t("Bot") })
                    : t("Message from {peer}", { peer: peerName || t("Bot") });
              return [
                <Pressable
                  key={`${message.id}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={chip}
                  onPress={
                    onOpenPeer
                      ? () => onOpenPeer({ peerBotId, peerBotName: peerName || t("Bot") })
                      : undefined
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 3,
                  }}
                >
                  <BotAvatar
                    color={peerLook(peerBotId)?.color ?? tokens.mutedForeground}
                    identity={peerBotId}
                    size={16}
                    imageSrc={peerLook(peerBotId)?.imageSrc}
                  />
                  <Text style={{ color: tokens.mutedForeground, fontSize: 13.5 }}>{chip}</Text>
                </Pressable>,
              ];
            }),
          )
        : null}
    </View>
  );
}
