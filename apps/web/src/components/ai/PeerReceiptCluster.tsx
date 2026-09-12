import { i18n } from "@lingui/core";
import type { ThreadMessage } from "@rakazo/contracts";
import { peerNameParts, uniquePeersFromCluster } from "@rakazo/core";
import { darkTokens } from "@rakazo/ui-tokens";
import {
  BotAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { botImageSrc } from "../../lib/bot-image-src";

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

export function formatPeerNames(names: readonly string[]): string {
  const { first, second, overflow } = peerNameParts(names);
  if (!first) return "";
  if (!second) return first;
  if (overflow === 0) {
    return i18n._({
      id: "{first} and {second}",
      message: "{first} and {second}",
      values: { first, second },
    });
  }
  return i18n._({
    id: "{first}, {second} and {n} more",
    message: "{first}, {second} and {n} more",
    values: { first, second, n: overflow },
  });
}

export function peerReceiptLabel(messageCount: number, names: readonly string[]): string {
  const who = formatPeerNames(names);
  return i18n._({
    id: "{messageCount} messages with {who}",
    message: "{messageCount} messages with {who}",
    values: { messageCount, who },
  });
}

export function PeerReceiptCluster({
  messages,
  sentOnly: _sentOnly,
  peerBot,
  onOpenPeer,
}: PeerReceiptClusterProps) {
  const peers = uniquePeersFromCluster(messages);
  const names = peers.map((peer) => peer.name);
  const first = peers[0];
  const look = first ? peerBot(first.id) : undefined;
  const label = peerReceiptLabel(messages.length, names);

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="peer-receipt-cluster"
          aria-label={label}
          className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent py-1 text-caption text-muted-foreground shadow-none outline-none hover:text-foreground"
        >
          <span>
            {i18n._({
              id: "{messageCount} messages with",
              message: "{messageCount} messages with",
              values: { messageCount: messages.length },
            })}
          </span>
          {first ? (
            <BotAvatar
              color={look?.color ?? darkTokens.mutedForeground}
              shape={look?.avatarShape}
              identity={first.id}
              size={14}
              imageSrc={botImageSrc({
                id: first.id,
                hasAvatar: look?.hasAvatar,
                updatedAt: look?.updatedAt,
              })}
            />
          ) : null}
          <span>{formatPeerNames(names)}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-auto min-w-44 rounded-2xl px-1.5 py-1.5 shadow-lg"
        >
          {peers.map((peer) => {
            const itemLook = peerBot(peer.id);
            return (
              <DropdownMenuItem
                key={peer.id}
                data-testid="peer-receipt-peer"
                className="gap-2 rounded-lg px-2 py-1.5 text-body"
                onClick={() => onOpenPeer({ peerBotId: peer.id, peerBotName: peer.name })}
              >
                <BotAvatar
                  color={itemLook?.color ?? darkTokens.mutedForeground}
                  identity={peer.id}
                  size={14}
                  imageSrc={botImageSrc({
                    id: peer.id,
                    hasAvatar: itemLook?.hasAvatar,
                    updatedAt: itemLook?.updatedAt,
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
