import type { MessageBlock } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  hasVisibleMessagePresentation,
  isBlankLiveProgress,
  isCenteredAgentEvent,
  isWaitingTakeover,
  messagePresentationSegments,
  unansweredAskBlock,
} from "./message-presentation.js";
import { userVisibleMessages } from "./message-visibility.js";

describe("message presentation", () => {
  it("centers handoffs, inter-agent messages, and channel mirrors", () => {
    const blocks = [
      { kind: "handoff", fromBotId: "a", toBotId: "b", text: "Go" },
      { kind: "bot_message_sent", toBotId: "b", toBotName: "Research", text: "Go" },
      {
        kind: "bot_message_received",
        fromBotId: "b",
        fromBotName: "Research",
        text: "Done",
      },
      {
        kind: "channel_message",
        provider: "sendblue",
        channelId: "ch-1",
        fromAddress: "+15551234567",
        fromLabel: "Alex",
        text: "Hello from the group",
      },
    ] as MessageBlock[];

    for (const block of blocks) expect(isCenteredAgentEvent([block])).toBe(true);
    expect(isCenteredAgentEvent([{ kind: "text", text: "Hello" }])).toBe(false);
  });

  it("hides completed tool activity", () => {
    const blocks = [
      {
        kind: "steps",
        steps: [
          { label: "Read file", count: 1 },
          { label: "Message bot", count: 1 },
        ],
      },
      { kind: "bot_message_sent", toBotId: "b", toBotName: "Research", text: "Go" },
    ] as MessageBlock[];

    expect(messagePresentationSegments(blocks)).toEqual([
      {
        kind: "content",
        blocks: [{ kind: "bot_message_sent", toBotId: "b", toBotName: "Research", text: "Go" }],
      },
    ]);
    expect(
      hasVisibleMessagePresentation([
        { kind: "steps", steps: [{ label: "Message bot", count: 1 }] },
      ]),
    ).toBe(false);
  });

  it("hides marked activity without treating Using narration as a tool", () => {
    const activity = { kind: "progress", text: "Using browser", activity: true } as const;
    const narration = { kind: "progress", text: "Using browser is optional." } as const;

    expect(messagePresentationSegments([activity, narration])).toEqual([
      { kind: "content", blocks: [narration] },
    ]);

    const mixed: Extract<MessageBlock, { kind: "progress" }> = {
      kind: "progress",
      text: "Let me check",
      pendingToolNames: ["browser"],
    };
    expect(messagePresentationSegments([mixed])).toEqual([{ kind: "content", blocks: [mixed] }]);
  });

  it("treats empty live progress as blank", () => {
    expect(isBlankLiveProgress({ id: "progress:run_1", blocks: [] })).toBe(true);
    expect(
      isBlankLiveProgress({
        id: "progress:run_1",
        blocks: [{ kind: "progress", text: "   " }],
      }),
    ).toBe(true);
    expect(
      isBlankLiveProgress({
        id: "progress:run_1",
        blocks: [{ kind: "progress", text: "Checking." }],
      }),
    ).toBe(false);
    expect(
      isBlankLiveProgress({
        id: "m_1",
        blocks: [{ kind: "progress", text: "" }],
      }),
    ).toBe(false);
  });

  it("keeps only response content around tool activity", () => {
    const tool: Extract<MessageBlock, { kind: "steps" }> = {
      kind: "steps",
      steps: [{ label: "Read file", count: 1 }],
    };

    expect(
      messagePresentationSegments([
        { kind: "text", text: "Checking." },
        tool,
        { kind: "text", text: "Done." },
      ]),
    ).toEqual([
      {
        kind: "content",
        blocks: [
          { kind: "text", text: "Checking." },
          { kind: "text", text: "Done." },
        ],
      },
    ]);

    expect(
      messagePresentationSegments([
        { kind: "steps", steps: [{ label: "Message bot", count: 1 }] },
        { kind: "text", text: "Done." },
      ]),
    ).toEqual([{ kind: "content", blocks: [{ kind: "text", text: "Done." }] }]);
  });

  it("finds a pending ask and ignores answered or dismissed ones", () => {
    expect(
      unansweredAskBlock({
        blocks: [{ kind: "ask", text: "Which org?", status: "pending" }],
      })?.text,
    ).toBe("Which org?");
    expect(
      unansweredAskBlock({
        blocks: [{ kind: "ask", text: "Done", status: "answered" }],
      }),
    ).toBeUndefined();
    expect(
      unansweredAskBlock({
        blocks: [{ kind: "ask", text: "Old", status: "dismissed" }],
      }),
    ).toBeUndefined();
  });

  it("detects takeover waits on the primary or a member run", () => {
    expect(isWaitingTakeover({ run: { status: "waiting_takeover" } })).toBe(true);
    expect(
      isWaitingTakeover({
        run: { status: "running" },
        activeRuns: [{ status: "waiting_takeover" }],
      }),
    ).toBe(true);
    expect(isWaitingTakeover({ run: { status: "waiting_input" } })).toBe(false);
    expect(isWaitingTakeover(null)).toBe(false);
  });

  it("keeps userVisibleMessages as the transcript filter", () => {
    const messages = [
      {
        id: "user",
        runId: "run-user",
        blocks: [{ kind: "text" as const, text: "Go" }],
      },
      {
        id: "sent",
        runId: "run-user",
        blocks: [{ kind: "bot_message_sent" as const, toBotId: "b", toBotName: "B", text: "Go" }],
      },
    ];
    expect(userVisibleMessages(messages).map((item) => item.id)).toEqual(["user"]);
    expect(
      userVisibleMessages(messages, { includePeerReceipts: true }).map((item) => item.id),
    ).toEqual(["user", "sent"]);
  });
});
