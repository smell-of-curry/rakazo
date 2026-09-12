import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { ComputerHandoffCard } from "../pages/shell/message-cards";
import { type AskBlock, AskCard } from "./AskCard";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

const question = (status: AskBlock["status"] = "pending", answer?: string): AskBlock => ({
  kind: "ask",
  text: "Which city?",
  status,
  answer,
  actions: [
    { id: "berlin", label: "Berlin" },
    { id: "seoul", label: "Seoul" },
  ],
});

const secret = (status: AskBlock["status"] = "pending"): AskBlock => ({
  kind: "ask",
  text: "Need an API key",
  input: "secret",
  purpose: "api_key",
  credential: { name: "example_api", origin: "https://api.example.test", auth: { type: "bearer" } },
  status,
  answer: status === "answered" ? "saved" : undefined,
});

const approval = (status: AskBlock["status"] = "pending", answer?: string): AskBlock => ({
  kind: "ask",
  text: "send email",
  approvalEffectId: "effect-1",
  status,
  answer,
  actions: [
    { id: "allow", label: "Allow once" },
    { id: "always", label: "Always allow" },
    { id: "deny", label: "Deny" },
  ],
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("AskCard question", () => {
  it("shows options, free text, and Send while pending", () => {
    render(wrap(<AskCard block={question()} canAnswer onAnswer={vi.fn()} />));
    expect(screen.getByRole("button", { name: "Berlin" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type an answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByTestId("ask-card")).toHaveAttribute("data-ask-state", "pending");
    expect(screen.getByTestId("ask-card").className).not.toContain("opacity-60");
  });

  it("dims the answered card and checks the chosen option", () => {
    render(
      wrap(<AskCard block={question("answered", "seoul")} canAnswer={false} onAnswer={vi.fn()} />),
    );
    expect(screen.getByTestId("ask-card")).toHaveAttribute("data-ask-state", "answered");
    expect(screen.getByTestId("ask-card").className).toContain("opacity-60");
    expect(screen.getByRole("button", { name: "Seoul" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Berlin" }).className).toContain("opacity-40");
  });

  it("keeps a free-text answer visible", () => {
    render(
      wrap(<AskCard block={question("answered", "Lisbon")} canAnswer={false} onAnswer={vi.fn()} />),
    );
    expect(screen.getByText("Lisbon")).toBeInTheDocument();
  });

  it("shows Dismissed on a dismissed question", () => {
    render(wrap(<AskCard block={question("dismissed")} canAnswer={false} onAnswer={vi.fn()} />));
    expect(screen.getByTestId("ask-card")).toHaveAttribute("data-ask-state", "dismissed");
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(screen.getByTestId("ask-card").className).toContain("opacity-60");
  });
});

describe("AskCard secret", () => {
  it("masks the pending field", () => {
    render(wrap(<AskCard block={secret()} canAnswer onAnswer={vi.fn()} />));
    expect(screen.getByTestId("secret-ask-card")).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste value")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Save securely" })).toBeInTheDocument();
  });

  it("shows Saved and the secure footer after answering", () => {
    render(wrap(<AskCard block={secret("answered")} canAnswer={false} onAnswer={vi.fn()} />));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Stored securely, never shown to your bot")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Paste value")).toBeNull();
  });

  it("shows Dismissed when the secret gate is dismissed", () => {
    render(wrap(<AskCard block={secret("dismissed")} canAnswer={false} onAnswer={vi.fn()} />));
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
  });
});

describe("AskCard approval", () => {
  it("renders Allow once, Always allow, and Deny", () => {
    render(wrap(<AskCard block={approval()} canAnswer onAnswer={vi.fn()} actorName="Scout" />));
    expect(screen.getByText("Scout wants to send email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Allow once" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Always allow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
  });

  it("dims an answered approval", () => {
    render(
      wrap(<AskCard block={approval("answered", "allow")} canAnswer={false} onAnswer={vi.fn()} />),
    );
    expect(screen.getByText("Allowed once")).toBeInTheDocument();
    expect(screen.getByTestId("ask-card").className).toContain("opacity-60");
  });

  it("shows Dismissed on a dismissed approval", () => {
    render(wrap(<AskCard block={approval("dismissed")} canAnswer={false} onAnswer={vi.fn()} />));
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
  });
});

describe("ComputerHandoffCard", () => {
  it("shows the reason and Open computer while pending", () => {
    render(
      wrap(
        <ComputerHandoffCard text="Sign into Sentry" status="pending" onOpenComputer={vi.fn()} />,
      ),
    );
    expect(screen.getByTestId("computer-handoff-card")).toHaveAttribute(
      "data-ask-state",
      "pending",
    );
    expect(screen.getByText("Sign into Sentry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open computer" })).toBeInTheDocument();
    expect(screen.getByTestId("computer-handoff-card").className).not.toContain("opacity-60");
  });

  it("dims an answered handoff", () => {
    render(wrap(<ComputerHandoffCard text="Sign into Sentry" status="answered" />));
    expect(screen.getByTestId("computer-handoff-card")).toHaveAttribute(
      "data-ask-state",
      "answered",
    );
    expect(screen.getByTestId("computer-handoff-card").className).toContain("opacity-60");
    expect(screen.queryByRole("button", { name: "Open computer" })).toBeNull();
  });

  it("shows Dismissed on a dismissed handoff", () => {
    render(wrap(<ComputerHandoffCard text="Sign into Sentry" status="dismissed" />));
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(screen.getByTestId("computer-handoff-card").className).toContain("opacity-60");
  });
});

describe("AskCard submit", () => {
  it("submits the chosen option", async () => {
    const onAnswer = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(wrap(<AskCard block={question()} canAnswer onAnswer={onAnswer} />));
    await user.click(screen.getByRole("button", { name: "Berlin" }));
    expect(onAnswer).toHaveBeenCalledWith("berlin");
  });
});
