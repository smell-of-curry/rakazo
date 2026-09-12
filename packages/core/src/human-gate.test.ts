import { describe, expect, it } from "vitest";
import {
  latestComputerNeedsYouText,
  needsYou,
  shouldContinueForHumanGate,
  textLooksLikeHumanGate,
} from "./human-gate.js";

describe("textLooksLikeHumanGate", () => {
  it("flags secret and login asks", () => {
    expect(textLooksLikeHumanGate("Please paste your API key")).toBe(true);
    expect(textLooksLikeHumanGate("Sign in at https://sentry.example.com")).toBe(true);
    expect(textLooksLikeHumanGate("Which org should I use?")).toBe(true);
  });

  it("ignores reports and empty text", () => {
    expect(
      textLooksLikeHumanGate("Sentry login is present. I continued without another takeover."),
    ).toBe(false);
    expect(textLooksLikeHumanGate("Here is the weekly report for the site.")).toBe(false);
    expect(textLooksLikeHumanGate("")).toBe(false);
  });
});

describe("shouldContinueForHumanGate", () => {
  it("allows one continue on a prose ask", () => {
    expect(shouldContinueForHumanGate({ assembled: "Please paste your API key" })).toBe(true);
    expect(
      shouldContinueForHumanGate({
        assembled: "Please paste your API key",
        alreadyContinued: true,
      }),
    ).toBe(false);
    expect(
      shouldContinueForHumanGate({
        assembled: "Please paste your API key",
        scripted: true,
      }),
    ).toBe(false);
    expect(shouldContinueForHumanGate({ assembled: "Done. Calendar is connected." })).toBe(false);
  });
});

describe("needsYou", () => {
  it("classifies the latest open ask, secret, approval, and takeover", () => {
    expect(
      needsYou({
        run: { id: "run-1", status: "waiting_input" },
        messages: [
          {
            id: "ask-1",
            runId: "run-1",
            blocks: [{ kind: "ask", text: "Which city?", status: "pending" }],
          },
        ],
      }),
    ).toEqual({ kind: "ask", messageId: "ask-1", text: "Which city?" });
    expect(
      needsYou({
        run: { id: "run-1", status: "waiting_input" },
        messages: [
          {
            id: "secret-1",
            runId: "run-1",
            blocks: [{ kind: "ask", text: "API key", input: "secret", status: "pending" }],
          },
        ],
      }),
    ).toEqual({ kind: "secret", messageId: "secret-1", text: "API key" });
    expect(
      needsYou({
        run: { id: "run-1", status: "waiting_input" },
        messages: [
          {
            id: "approval-1",
            runId: "run-1",
            blocks: [
              {
                kind: "ask",
                text: "Allow browser?",
                approvalEffectId: "effect-1",
                status: "pending",
                actions: [
                  { id: "allow", label: "Allow" },
                  { id: "deny", label: "Deny" },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual({ kind: "approval", messageId: "approval-1", text: "Allow browser?" });
    expect(
      needsYou({
        run: { id: "run-1", status: "waiting_takeover" },
        messages: [
          {
            id: "takeover-1",
            runId: "run-1",
            blocks: [{ kind: "computer", state: "Needs you", text: "Sign into Sentry" }],
          },
        ],
      }),
    ).toEqual({ kind: "takeover", messageId: "takeover-1", text: "Sign into Sentry" });
  });

  it("ignores answered and dismissed gates", () => {
    expect(
      needsYou({
        run: { id: "run-1", status: "waiting_input" },
        messages: [
          {
            id: "ask-1",
            runId: "run-1",
            blocks: [{ kind: "ask", text: "Which city?", status: "dismissed" }],
          },
        ],
      }),
    ).toEqual({ kind: null });
    expect(
      needsYou({
        run: { id: "run-1", status: "running" },
        messages: [
          {
            id: "ask-1",
            runId: "run-1",
            blocks: [{ kind: "ask", text: "Which city?", status: "pending" }],
          },
        ],
      }),
    ).toEqual({ kind: null });
  });

  it("prefers a waiting run over a newer busy run", () => {
    expect(
      needsYou({
        run: { id: "run-newer", status: "running" },
        activeRuns: [
          { id: "run-newer", status: "running" },
          { id: "run-waiting", status: "waiting_input" },
        ],
        messages: [
          {
            id: "ask-1",
            runId: "run-waiting",
            blocks: [{ kind: "ask", text: "Which org?", status: "pending" }],
          },
        ],
      }),
    ).toEqual({ kind: "ask", messageId: "ask-1", text: "Which org?" });
  });

  it("reads the latest computer Needs you text", () => {
    expect(
      latestComputerNeedsYouText([
        {
          id: "old",
          runId: "run-1",
          blocks: [{ kind: "computer", state: "Needs you", text: "Old" }],
        },
        {
          id: "new",
          runId: "run-1",
          blocks: [{ kind: "computer", state: "Needs you", text: "Sign into Sentry Issues" }],
        },
      ]),
    ).toBe("Sign into Sentry Issues");
    expect(
      latestComputerNeedsYouText([
        {
          id: "gone",
          runId: "run-1",
          blocks: [{ kind: "computer", state: "Needs you", text: "Sign in", status: "dismissed" }],
        },
      ]),
    ).toBeUndefined();
  });
});
