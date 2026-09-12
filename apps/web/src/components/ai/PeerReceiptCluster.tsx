import { i18n } from "@lingui/core";
import type { ThreadMessage } from "@rakazo/contracts";
import { darkTokens } from "@rakazo/ui-tokens";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import {
  BotAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GroupAvatar,
} from "@rakazo/ui-web";
import { botImageSrc } from "../../lib/bot-image-src";
import { uniquePeersFromCluster } from "../../lib/condense-peer-receipts";

export type PeerReceiptPeerLook = {
  color: string;
  avatarShape?: string | null;
  status?: string;
  hasAvatar?: boolean;
  updatedAt?: string;
};

export type PeerReceiptClusterProps = {
  messages: ThreadMessage[];
  sentOnly: boolean;
  peerBot: (id: string) => PeerReceiptPeerLook | undefined;
  onOpenPeer: (peer: { peerBotId: string; peerBotName: string }) => void;
};

export function PeerReceiptCluster({
  messages,
  sentOnly,
  peerBot,
  onOpenPeer,
}: PeerReceiptClusterProps) {
  const peers = uniquePeersFromCluster(messages);
  const members: GroupAvatarMember[] = peers.map((peer) => {
    const look = peerBot(peer.id);
    return {
      botId: peer.id,
      name: peer.name,
      color: look?.color ?? darkTokens.mutedForeground,
      shape: look?.avatarShape,
      status: look?.status,
      imageSrc: botImageSrc({
        id: peer.id,
        hasAvatar: look?.hasAvatar,
        updatedAt: look?.updatedAt,
      }),
    };
  });
  const messageCount = messages.length;
  const peerCount = peers.length;
  const prefix = sentOnly
    ? i18n._({ id: "Messaged", message: "Messaged" })
    : i18n._({
        id: "{messageCount} messages with",
        message: "{messageCount} messages with",
        values: { messageCount },
      });
  const suffix = i18n._({
    id: "{peerCount} Bots",
    message: "{peerCount} Bots",
    values: { peerCount },
  });
  const label = `${prefix} ${suffix}`;

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="peer-receipt-cluster"
          aria-label={label}
          className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1 text-[12px] text-muted-foreground shadow-none outline-none transition-colors hover:text-foreground/75"
        >
          <span>{prefix}</span>
          <GroupAvatar members={members.slice(0, 3)} size={22} />
          <span>{suffix}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-auto min-w-44 rounded-2xl px-1.5 py-1.5 shadow-lg"
        >
          {peers.map((peer) => {
            const look = peerBot(peer.id);
            return (
              <DropdownMenuItem
                key={peer.id}
                data-testid="peer-receipt-peer"
                className="gap-2 rounded-lg px-2 py-1.5 text-[13.5px]"
                onClick={() => onOpenPeer({ peerBotId: peer.id, peerBotName: peer.name })}
              >
                <BotAvatar
                  color={look?.color ?? darkTokens.mutedForeground}
                  identity={peer.id}
                  size={22}
                  imageSrc={botImageSrc({
                    id: peer.id,
                    hasAvatar: look?.hasAvatar,
                    updatedAt: look?.updatedAt,
                  })}
                />
                <span className="truncate">{peer.name}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
