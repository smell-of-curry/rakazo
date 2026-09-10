import type { ThreadMessage } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { condensePeerReceipts, uniquePeersFromCluster } from "./condense-peer-receipts.js";

function message(id: string, blocks: ThreadMessage["blocks"]): ThreadMessage {
  return {
    id,
    threadId: "t_1",
    seq: 1,
    role: "bot",
    blocks,
    createdAt: "2026-08-25T10:00:00.000Z",
  };
}

const sent = (id: string, botId = "b_2", name = "Analyst") =>
  message(id, [{ kind: "bot_message_sent", toBotId: botId, toBotName: name, text: "go" }]);

const received = (id: string, botId = "b_2", name = "Analyst") =>
  message(id, [
    { kind: "bot_message_received", fromBotId: botId, fromBotName: name, text: "done" },
  ]);

const text = (id: string) => message(id, [{ kind: "text", text: "hello" }]);

describe("condensePeerReceipts", () => {
  it("returns nothing for an empty transcript", () => {
    expect(condensePeerReceipts([])).toEqual([]);
  });

  it("leaves ordinary messages alone", () => {
    const rows = [text("m_1"), text("m_2")];
    expect(condensePeerReceipts(rows)).toEqual([
      { type: "message", message: rows[0] },
      { type: "message", message: rows[1] },
    ]);
  });

  it("keeps a single receipt as a message", () => {
    const row = sent("m_1");
    expect(condensePeerReceipts([row])).toEqual([{ type: "message", message: row }]);
  });

  it("clusters three consecutive receipts", () => {
    const rows = [sent("m_1", "b_1", "A"), sent("m_2", "b_2", "B"), sent("m_3", "b_3", "C")];
    expect(condensePeerReceipts(rows)).toEqual([
      { type: "peerCluster", messages: rows, sentOnly: true },
    ]);
  });

  it("does not merge receipts across a text message", () => {
    const first = sent("m_1");
    const middle = text("m_2");
    const last = received("m_3");
    expect(condensePeerReceipts([first, middle, last])).toEqual([
      { type: "message", message: first },
      { type: "message", message: middle },
      { type: "message", message: last },
    ]);
  });

  it("marks mixed sent and received clusters as not sent-only", () => {
    const rows = [sent("m_1"), received("m_2")];
    expect(condensePeerReceipts(rows)).toEqual([
      { type: "peerCluster", messages: rows, sentOnly: false },
    ]);
  });
});

describe("uniquePeersFromCluster", () => {
  it("collects unique peers in first-seen order", () => {
    expect(
      uniquePeersFromCluster([
        sent("m_1", "b_1", "Scout"),
        received("m_2", "b_1", "Scout"),
        sent("m_3", "b_2", "Analyst"),
        sent("m_4", "b_1", "Scout"),
      ]),
    ).toEqual([
      { id: "b_1", name: "Scout" },
      { id: "b_2", name: "Analyst" },
    ]);
  });
});
