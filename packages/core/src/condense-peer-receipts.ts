import type { MessageBlock } from "@rakazo/contracts";
import { isPeerReceiptBlocks } from "./message-visibility.js";

type ReceiptMessage = { blocks: readonly MessageBlock[] };

export type CondensedTranscriptRow<T extends ReceiptMessage = ReceiptMessage> =
  | { type: "message"; message: T }
  | {
      type: "peerCluster";
      messages: T[];
      sentOnly: boolean;
    };

export type PeerReceiptPeer = { id: string; name: string };

type PeerBlock = Extract<MessageBlock, { kind: "bot_message_sent" | "bot_message_received" }>;

export function isPeerBlock(block: MessageBlock): block is PeerBlock {
  return block.kind === "bot_message_sent" || block.kind === "bot_message_received";
}

export function uniquePeersFromCluster(messages: readonly ReceiptMessage[]): PeerReceiptPeer[] {
  const seen = new Set<string>();
  const peers: PeerReceiptPeer[] = [];
  for (const message of messages) {
    for (const block of message.blocks) {
      if (!isPeerBlock(block)) continue;
      const id = block.kind === "bot_message_sent" ? block.toBotId : block.fromBotId;
      if (seen.has(id)) continue;
      seen.add(id);
      peers.push({
        id,
        name: block.kind === "bot_message_sent" ? block.toBotName : block.fromBotName,
      });
    }
  }
  return peers;
}

export function condensePeerReceipts<T extends ReceiptMessage>(
  messages: readonly T[],
): CondensedTranscriptRow<T>[] {
  const rows: CondensedTranscriptRow<T>[] = [];
  let pending: T[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    if (pending.length === 1) {
      rows.push({ type: "message", message: pending[0]! });
    } else {
      rows.push({
        type: "peerCluster",
        messages: pending,
        sentOnly: pending.every((message) =>
          message.blocks.every((block) => block.kind !== "bot_message_received"),
        ),
      });
    }
    pending = [];
  };

  for (const message of messages) {
    if (isPeerReceiptBlocks(message.blocks)) {
      pending.push(message);
      continue;
    }
    flush();
    rows.push({ type: "message", message });
  }
  flush();
  return rows;
}
