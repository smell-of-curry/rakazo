import type { CondensedTranscriptRow } from "@rakazo/core";
import type { RefObject } from "react";
import type { ScrollView } from "react-native";
import { View } from "react-native";
import type { MobileMessage } from "../../lib/api";
import { botAvatarSrc } from "../../lib/bot-avatar-src";
import { PeerReceiptCluster } from "../peer-receipt-cluster";

export function PeerRow({
  row,
  enableJump,
  jumpScrollTarget,
  pinnedScroll,
  peerLook,
  onOpenPeer,
}: {
  row: Extract<CondensedTranscriptRow<MobileMessage>, { type: "peerCluster" }>;
  enableJump?: boolean;
  jumpScrollTarget: RefObject<string | null>;
  pinnedScroll: RefObject<ScrollView | null>;
  peerLook: (id: string) => {
    color?: string;
    shape?: string | null;
    status?: string;
    imageSrc?: string;
  };
  onOpenPeer: (peer: { peerBotId: string; peerBotName: string }) => void;
}) {
  const firstId = row.messages[0]?.id;
  return (
    <View
      onLayout={
        enableJump
          ? (event) => {
              if (!firstId || jumpScrollTarget.current !== firstId) return;
              const y = Math.max(0, event.nativeEvent.layout.y - 24);
              requestAnimationFrame(() => {
                if (jumpScrollTarget.current !== firstId) return;
                pinnedScroll.current?.scrollTo({ y, animated: true });
                jumpScrollTarget.current = null;
              });
            }
          : undefined
      }
      style={{ marginTop: 12, width: "100%", alignItems: "center" }}
    >
      <PeerReceiptCluster
        messages={row.messages}
        sentOnly={row.sentOnly}
        peerLook={peerLook}
        onOpenPeer={onOpenPeer}
      />
    </View>
  );
}

export function peerLookFromRosters(
  id: string,
  mentionBots: readonly {
    id: string;
    color?: string;
    avatarShape?: string | null;
    status?: string;
    hasAvatar?: boolean;
  }[],
  members:
    | readonly {
        botId: string;
        color?: string;
        avatarShape?: string | null;
        status?: string;
        hasAvatar?: boolean;
      }[]
    | undefined,
) {
  const bot = mentionBots.find((item) => item.id === id);
  const member = members?.find((item) => item.botId === id);
  return {
    color: bot?.color ?? member?.color,
    shape: bot?.avatarShape ?? member?.avatarShape,
    status: bot?.status ?? member?.status,
    imageSrc: botAvatarSrc(
      bot ?? (member ? { botId: member.botId, hasAvatar: member.hasAvatar } : undefined),
    ),
  };
}
