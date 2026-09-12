import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ThreadMessage } from "@rakazo/contracts";
import { needsYou } from "@rakazo/core";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""),
        "",
      ),
  }),
}));

import { askBlockFromMessage, ComposerHumanGate } from "./composer-human-gate";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("composer human gate", () => {
  it("docks a pending ask card and never a Needs you banner", () => {
    const message = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which org?", status: "pending" }],
    } as ThreadMessage;
    const ask = askBlockFromMessage(message);
    render(wrap(<ComposerHumanGate ask={ask} canAnswer onAnswer={async () => undefined} />));
    expect(screen.getByTestId("composer-ask-dock")).toBeInTheDocument();
    expect(screen.getByText("Which org?")).toBeInTheDocument();
    expect(screen.queryByTestId("composer-takeover-dock")).toBeNull();
    expect(screen.queryByText("Needs you")).toBeNull();
  });

  it("renders no banner when needsYou is a takeover", () => {
    const snapshot = {
      run: { id: "run-1", status: "waiting_takeover" },
      messages: [
        {
          id: "m1",
          runId: "run-1",
          blocks: [{ kind: "computer", state: "Needs you", text: "Sign in", status: "pending" }],
        },
      ],
    };
    expect(needsYou(snapshot).kind).toBe("takeover");
    const { container } = render(
      wrap(
        <ComposerHumanGate
          needsComputer
          takeoverReason="Sign in"
          onOpenComputer={() => undefined}
        />,
      ),
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("composer-takeover-dock")).toBeNull();
    expect(screen.queryByText("Needs you")).toBeNull();
  });

  it("does not dock an answered ask", () => {
    const message = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which org?", status: "answered", answer: "Acme" }],
    } as ThreadMessage;
    expect(askBlockFromMessage(message)).toBeUndefined();
  });
});
