import { i18n } from "@lingui/core";
import type { ThreadMessage } from "@rakazo/contracts";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { formatPeerNames, PeerReceiptCluster, peerReceiptLabel } from "./PeerReceiptCluster";

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

function message(id: string, name: string, peerId: string): ThreadMessage {
  return {
    id,
    threadId: "t_1",
    seq: 1,
    role: "bot",
    blocks: [{ kind: "bot_message_sent", toBotId: peerId, toBotName: name, text: "go" }],
    createdAt: "2026-08-25T10:00:00.000Z",
  };
}

describe("peer row copy", () => {
  it("names one, two, and many peers", () => {
    expect(formatPeerNames(["Ken"])).toBe("Ken");
    expect(formatPeerNames(["Ken", "Ally"])).toBe("Ken and Ally");
    expect(formatPeerNames(["Ken", "Ally", "Jo", "Pat"])).toBe("Ken, Ally and 2 more");
    expect(peerReceiptLabel(2, ["Ken"])).toContain("2 messages with");
    expect(peerReceiptLabel(2, ["Ken"])).toContain("Ken");
  });
});

describe("PeerReceiptCluster", () => {
  it("renders a centered row for one peer", () => {
    render(
      <PeerReceiptCluster
        messages={[message("m_1", "Ken", "b_1")]}
        sentOnly
        peerBot={() => ({ color: "#14B8A6" })}
        onOpenPeer={() => undefined}
      />,
    );
    const trigger = screen.getByTestId("peer-receipt-cluster");
    expect(trigger).toHaveTextContent("1 messages with");
    expect(trigger).toHaveTextContent("Ken");
    expect(trigger.className).toContain("text-caption");
  });

  it("renders two peer names with and", () => {
    render(
      <PeerReceiptCluster
        messages={[message("m_1", "Ken", "b_1"), message("m_2", "Ally", "b_2")]}
        sentOnly={false}
        peerBot={() => ({ color: "#14B8A6" })}
        onOpenPeer={() => undefined}
      />,
    );
    expect(screen.getByTestId("peer-receipt-cluster")).toHaveTextContent("Ken and Ally");
  });

  it("collapses three or more peers", () => {
    render(
      <PeerReceiptCluster
        messages={[
          message("m_1", "Ken", "b_1"),
          message("m_2", "Ally", "b_2"),
          message("m_3", "Jo", "b_3"),
        ]}
        sentOnly={false}
        peerBot={() => ({ color: "#14B8A6" })}
        onOpenPeer={() => undefined}
      />,
    );
    expect(screen.getByTestId("peer-receipt-cluster")).toHaveTextContent("Ken, Ally and 1 more");
  });
});
