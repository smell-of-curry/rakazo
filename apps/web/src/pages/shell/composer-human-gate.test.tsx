import { i18n } from "@lingui/core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "@rakazo/contracts";

vi.mock("../../components/AskCard", () => ({
  AskCard: ({ block }: { block: { text?: string } }) => (
    <div data-testid="ask-card">{block.text}</div>
  ),
}));

import {
  askBlockFromMessage,
  ComposerHumanGate,
  latestComputerNeedsYouText,
} from "./composer-human-gate";

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("composer human gate", () => {
  it("finds the latest Needs you computer reason", () => {
    const messages = [
      {
        id: "old",
        blocks: [{ kind: "computer", state: "Needs you", text: "Old" }],
      },
      {
        id: "new",
        blocks: [{ kind: "computer", state: "Needs you", text: "Sign into Sentry Issues" }],
      },
    ] as ThreadMessage[];
    expect(latestComputerNeedsYouText(messages)).toBe("Sign into Sentry Issues");
  });

  it("docks a pending ask card", () => {
    const message = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which org?", status: "pending" }],
    } as ThreadMessage;
    const ask = askBlockFromMessage(message);
    const html = renderToStaticMarkup(
      <ComposerHumanGate ask={ask} canAnswer onAnswer={async () => undefined} />,
    );
    expect(html).toContain("composer-ask-dock");
    expect(html).toContain("Which org?");
  });

  it("docks takeover with the computer reason", () => {
    const html = renderToStaticMarkup(
      <ComposerHumanGate
        needsComputer
        takeoverReason="Sign into Sentry Issues"
        onOpenComputer={() => undefined}
      />,
    );
    expect(html).toContain("composer-takeover-dock");
    expect(html).toContain("Needs you");
    expect(html).toContain("Sign into Sentry Issues");
  });
});
