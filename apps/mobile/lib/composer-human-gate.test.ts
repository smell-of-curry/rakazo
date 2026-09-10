import { describe, expect, it } from "vitest";
import type { MobileMessage } from "./api";
import {
  isHumanGateComposerError,
  isWaitingTakeover,
  latestComputerNeedsYouText,
  unansweredAskBlock,
} from "./composer-human-gate";

describe("composer human gate", () => {
  it("finds the latest Needs you computer reason", () => {
    const messages = [
      {
        id: "old",
        role: "bot",
        blocks: [{ kind: "computer", state: "Needs you", text: "Old" }],
      },
      {
        id: "new",
        role: "bot",
        blocks: [{ kind: "computer", state: "Needs you", text: "Sign into Sentry Issues" }],
      },
    ] as MobileMessage[];
    expect(latestComputerNeedsYouText(messages)).toBe("Sign into Sentry Issues");
  });

  it("finds a pending ask and ignores answered ones", () => {
    expect(
      unansweredAskBlock({
        id: "ask-1",
        role: "bot",
        blocks: [{ kind: "ask", text: "Which org?", status: "pending" }],
      } as MobileMessage)?.text,
    ).toBe("Which org?");
    expect(
      unansweredAskBlock({
        id: "ask-2",
        role: "bot",
        blocks: [{ kind: "ask", text: "Done", status: "answered" }],
      } as MobileMessage),
    ).toBeUndefined();
  });

  it("detects takeover waits and composer gate errors", () => {
    expect(isWaitingTakeover({ run: { status: "waiting_takeover" } })).toBe(true);
    expect(
      isWaitingTakeover({
        run: { status: "running" },
        activeRuns: [{ status: "waiting_takeover" }],
      }),
    ).toBe(true);
    expect(isWaitingTakeover({ run: { status: "waiting_input" } })).toBe(false);
    expect(isHumanGateComposerError("Answer the pending ask first.")).toBe(true);
    expect(isHumanGateComposerError("Open the computer first.")).toBe(true);
    expect(isHumanGateComposerError("Failed to send message")).toBe(false);
  });
});
