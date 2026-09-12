import { i18n } from "@lingui/core";
import type { ThreadMessage } from "@rakazo/contracts";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { PeerReceiptCluster } from "./PeerReceiptCluster";

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

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

describe("PeerReceiptCluster", () => {
  it("keeps a text trigger and does not expand receipt chips", () => {
    const html = renderToString(
      <PeerReceiptCluster
        messages={[
          message("m_1", [
            {
              kind: "bot_message_received",
              fromBotId: "b_1",
              fromBotName: "Scout",
              text: "429 rate-limited",
            },
          ]),
          message("m_2", [
            { kind: "bot_message_sent", toBotId: "b_2", toBotName: "Analyst", text: "go" },
          ]),
        ]}
        sentOnly={false}
        peerBot={(id) =>
          id === "b_1"
            ? { color: "#14B8A6", hasAvatar: true, updatedAt: "2026-09-10T00:00:00.000Z" }
            : { color: "#8B5CF6" }
        }
        onOpenPeer={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="peer-receipt-cluster"');
    expect(html).toContain("/api/bots/b_1/avatar?v=2026-09-10T00:00:00.000Z");
    expect(html).not.toContain("peer-receipt-chip");
    expect(html).not.toContain("Message from");
    expect(html).not.toContain("rate-limited");
  });
});
