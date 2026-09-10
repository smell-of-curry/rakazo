import { useLingui } from "@lingui/react/macro";
import type { ThreadMessage } from "@rakazo/contracts";
import { darkTokens } from "@rakazo/ui-tokens";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import { GroupAvatar } from "@rakazo/ui-web";
import { useState } from "react";
import { isRateLimitError } from "@rakazo/core";
import { uniquePeersFromCluster } from "../../lib/condense-peer-receipts";
import { isPeerBlock } from "../../lib/peer-messages";
import { CollaborationMarker } from "./CollaborationMarker";

export type PeerReceiptPeerLook = {
  color: string;
  status?: string;
  hasAvatar?: boolean;
  updatedAt?: string;
};

export type PeerReceiptClusterProps = {
  messages: ThreadMessage[];
  sentOnly: boolean;
  peerBot: (id: string) => PeerReceiptPeerLook | undefined;
  onOpenPeer: (peer: { peerBotId: string; peerBotName: string }) => void;
  onToggle?: (expanded: boolean) => void;
};

export function PeerReceiptCluster({
  messages,
  sentOnly,
  peerBot,
  onOpenPeer,
  onToggle,
}: PeerReceiptClusterProps) {
  const { t } = useLingui();
  const [expanded, setExpanded] = useState(false);
  const peers = uniquePeersFromCluster(messages);
  const members: GroupAvatarMember[] = peers.map((peer) => {
    const look = peerBot(peer.id);
    return {
      botId: peer.id,
      name: peer.name,
      color: look?.color ?? darkTokens.mutedForeground,
      status: look?.status,
      imageSrc: look?.hasAvatar
        ? `/api/bots/${peer.id}/avatar${look.updatedAt ? `?v=${look.updatedAt}` : ""}`
        : undefined,
    };
  });
  const messageCount = messages.length;
  const peerCount = peers.length;
  const prefix = sentOnly ? t`Messaged` : t`${messageCount} messages with`;
  const suffix = t`${peerCount} Bots`;
  const label = `${prefix} ${suffix}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-center">
        <button
          type="button"
          data-testid="peer-receipt-cluster"
          aria-label={label}
          aria-expanded={expanded}
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            onToggle?.(next);
          }}
          className="inline-flex items-center gap-1.5 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground/75"
        >
          <span>{prefix}</span>
          <GroupAvatar members={members.slice(0, 3)} size={22} />
          <span>{suffix}</span>
        </button>
      </div>
      {expanded
        ? messages.flatMap((message) =>
            message.blocks.flatMap((block, i) => {
              if (!isPeerBlock(block)) return [];
              const sent = block.kind === "bot_message_sent";
              const peer = sent ? block.toBotName : block.fromBotName;
              const peerBotId = sent ? block.toBotId : block.fromBotId;
              const chipLabel =
                block.text && isRateLimitError(block.text)
                  ? t`${peer} rate-limited`
                  : sent
                    ? t`Messaged ${peer}`
                    : t`Message from ${peer}`;
              return [
                <CollaborationMarker
                  key={`${message.id}-${i}`}
                  ariaLabel={chipLabel}
                  color={peerBot(peerBotId)?.color ?? darkTokens.mutedForeground}
                  identity={peerBotId}
                  label={chipLabel}
                  onClick={() => onOpenPeer({ peerBotId, peerBotName: peer })}
                />,
              ];
            }),
          )
        : null}
    </div>
  );
}
