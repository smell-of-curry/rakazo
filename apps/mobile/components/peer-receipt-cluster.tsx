import type { MessageBlock } from "@rakazo/contracts";
import { uniquePeersFromCluster } from "@rakazo/core";
import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
  const triggerRef = useRef<View>(null);
  const [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const peers = uniquePeersFromCluster(messages);
  const prefix = sentOnly ? t("Messaged") : t("{count} messages with", { count: messages.length });
  const suffix = t("{count} Bots", { count: peers.length });
  const label = `${prefix} ${suffix}`;

  function close() {
    setExpanded(false);
  }

  function toggle() {
    if (expanded) {
      close();
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setExpanded(true);
    });
  }

  return (
    <View style={styles.root}>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded }}
          onPress={toggle}
          style={styles.trigger}
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
      </View>
      <Modal transparent visible={expanded} animationType="fade" onRequestClose={close}>
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable accessible={false} onPress={close} style={StyleSheet.absoluteFill} />
          <View
            style={[
              styles.menu,
              {
                top: anchor.y + anchor.height + 4,
                backgroundColor: tokens.popover,
                borderColor: tokens.border,
                shadowColor: tokens.foreground,
              },
            ]}
          >
            {peers.map((peer) => {
              const name = peer.name || t("Bot");
              const look = peerLook(peer.id);
              return (
                <Pressable
                  key={peer.id}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  onPress={() => {
                    onOpenPeer?.({ peerBotId: peer.id, peerBotName: name });
                    close();
                  }}
                  style={styles.row}
                >
                  <BotAvatar
                    color={look?.color ?? tokens.mutedForeground}
                    identity={peer.id}
                    size={20}
                    imageSrc={look?.imageSrc}
                  />
                  <Text numberOfLines={1} style={{ color: tokens.popoverForeground, fontSize: 14 }}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    alignItems: "center",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  overlay: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    alignSelf: "center",
    minWidth: 148,
    maxWidth: 220,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});
