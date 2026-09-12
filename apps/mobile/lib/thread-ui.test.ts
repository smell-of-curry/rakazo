import type { MessageBlock } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  composerRightSlot,
  formatApprovalAnswer,
  formatAttachmentSkip,
  isWorkingStatus,
  messageCardKind,
  sameBubbleSender,
  shouldShowMessageTimestamp,
  threadComputerChip,
  workingStatusKind,
} from "./thread-ui";

describe("composerRightSlot", () => {
  it("shows stop and send while a run is active and the draft can send", () => {
    expect(composerRightSlot(true, true)).toBe("stop+send");
  });

  it("shows stop while a run is active and the draft is empty", () => {
    expect(composerRightSlot(true, false)).toBe("stop");
  });

  it("shows send when the draft has content", () => {
    expect(composerRightSlot(false, true)).toBe("send");
  });

  it("shows mic when idle and empty", () => {
    expect(composerRightSlot(false, false)).toBe("mic");
  });
});

describe("formatApprovalAnswer", () => {
  const actions = [
    { id: "allow", label: "Allow once", outcome: "created" as const },
    { id: "always", label: "Always allow" },
    { id: "deny", label: "Deny", outcome: "cancelled" as const },
  ];

  it("maps approval outcomes", () => {
    expect(formatApprovalAnswer("allow", actions, true)).toBe("Created");
    expect(formatApprovalAnswer("deny", actions, true)).toBe("Cancelled");
    expect(formatApprovalAnswer("always", actions, true)).toBe("Always allowed");
    expect(formatApprovalAnswer(undefined, actions, true)).toBe("Answered");
  });

  it("falls back to the action label for non-approval asks", () => {
    expect(formatApprovalAnswer("allow", actions, false)).toBe("Answered: Allow once");
  });
});

describe("formatAttachmentSkip", () => {
  it("localizes known skip reasons", () => {
    expect(formatAttachmentSkip({ name: "camera", reason: "permission denied" })).toBe(
      "Camera (permission denied)",
    );
    expect(formatAttachmentSkip({ name: "shot.png", reason: "over 10 MiB" })).toBe(
      "shot.png (over 10 MiB)",
    );
    expect(formatAttachmentSkip({ name: "clip.mov", reason: "unsupported type" })).toBe(
      "clip.mov (unsupported type)",
    );
    expect(formatAttachmentSkip({ name: "extra.pdf", reason: "max 5 attachments" })).toBe(
      "extra.pdf (max 5 attachments)",
    );
  });

  it("keeps unknown reasons verbatim", () => {
    expect(formatAttachmentSkip({ name: "note.txt", reason: "disk full" })).toBe(
      "note.txt (disk full)",
    );
  });
});

describe("isWorkingStatus", () => {
  it("treats queued through waiting states as working", () => {
    expect(isWorkingStatus("queued")).toBe(true);
    expect(isWorkingStatus("leased")).toBe(true);
    expect(isWorkingStatus("running")).toBe(true);
    expect(isWorkingStatus("waiting_input")).toBe(true);
    expect(isWorkingStatus("waiting_takeover")).toBe(true);
  });

  it("treats idle and failed as not working", () => {
    expect(isWorkingStatus("succeeded")).toBe(false);
    expect(isWorkingStatus("failed")).toBe(false);
    expect(isWorkingStatus(undefined)).toBe(false);
  });
});

describe("shouldShowMessageTimestamp", () => {
  it("inserts the first timestamp and skips a short same-day gap", () => {
    expect(shouldShowMessageTimestamp("2026-09-08T15:00:00.000Z")).toBe(true);
    expect(shouldShowMessageTimestamp("2026-09-08T15:10:00.000Z", "2026-09-08T15:00:00.000Z")).toBe(
      false,
    );
  });

  it("inserts after 15 minutes or a missing current time", () => {
    expect(shouldShowMessageTimestamp("2026-09-08T15:16:00.000Z", "2026-09-08T15:00:00.000Z")).toBe(
      true,
    );
    expect(shouldShowMessageTimestamp(undefined, "2026-09-08T15:00:00.000Z")).toBe(false);
  });
});

describe("threadComputerChip", () => {
  it("maps a live desktop and a boot wait", () => {
    expect(
      threadComputerChip({
        state: "running",
        takeoverRequested: false,
        runStatus: "running",
      }).kind,
    ).toBe("live");
    expect(
      threadComputerChip({
        state: "booting",
        takeoverRequested: false,
        runStatus: "running",
      }).kind,
    ).toBe("setting_up");
  });

  it("prefers takeover over the raw run status", () => {
    expect(
      threadComputerChip({
        state: "running",
        takeoverRequested: true,
        runStatus: "waiting_takeover",
      }).kind,
    ).toBe("needs_you");
  });
});

describe("workingStatusKind", () => {
  it("prefers rate-limit copy, then computer setup, then the dots", () => {
    expect(workingStatusKind({ rateLimitSeconds: 4, computerKind: "setting_up" })).toBe(
      "rate_limit",
    );
    expect(workingStatusKind({ rateLimitSeconds: null, computerKind: "setting_up" })).toBe(
      "setting_up",
    );
    expect(workingStatusKind({ rateLimitSeconds: null, computerKind: "live" })).toBe("dots");
  });
});

describe("messageCardKind", () => {
  it("picks the same card branch the bubble used to", () => {
    expect(
      messageCardKind([{ kind: "computer", state: "Needs you", text: "Sign in" } as MessageBlock]),
    ).toBe("computer_gate");
    expect(
      messageCardKind([{ kind: "ask", text: "Which org?", status: "pending" } as MessageBlock]),
    ).toBe("ask");
    expect(
      messageCardKind([
        {
          kind: "ask",
          text: "Allow?",
          approvalEffectId: "rule-1",
          actions: [
            { id: "allow", label: "Allow once" },
            { id: "deny", label: "Deny" },
          ],
        } as MessageBlock,
      ]),
    ).toBe("ask_actions");
    expect(
      messageCardKind([{ kind: "handoff", fromBotId: "a", toBotId: "b" } as MessageBlock]),
    ).toBe("handoff");
    expect(
      messageCardKind([
        { kind: "bot_message_sent", toBotId: "p", toBotName: "Peer" } as MessageBlock,
      ]),
    ).toBe("peer");
    expect(messageCardKind([{ kind: "text", text: "hi" } as MessageBlock])).toBe("text");
  });
});

describe("sameBubbleSender", () => {
  it("clusters consecutive user or same-bot bubbles", () => {
    expect(
      sameBubbleSender(
        { role: "user", blocks: [{ kind: "text", text: "a" } as MessageBlock] },
        { role: "user", blocks: [{ kind: "text", text: "b" } as MessageBlock] },
      ),
    ).toBe(true);
    expect(
      sameBubbleSender(
        { role: "bot", botId: "a", blocks: [] },
        { role: "bot", botId: "a", blocks: [] },
      ),
    ).toBe(true);
    expect(
      sameBubbleSender(
        { role: "bot", botId: "a", blocks: [] },
        { role: "bot", botId: "b", blocks: [] },
      ),
    ).toBe(false);
  });

  it("does not cluster centered agent events", () => {
    expect(
      sameBubbleSender(
        { role: "bot", botId: "a", blocks: [{ kind: "handoff" } as MessageBlock] },
        { role: "bot", botId: "a", blocks: [{ kind: "text", text: "hi" } as MessageBlock] },
      ),
    ).toBe(false);
  });
});
