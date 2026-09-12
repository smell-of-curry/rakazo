import { describe, expect, it } from "vitest";
import {
  isOutboundBotMessage,
  preferredActiveRunStatus,
  previewFromBlocks,
  previewFromGroupMessage,
} from "./thread-listing.js";

describe("preferredActiveRunStatus", () => {
  it("prefers a waiting gate over a newer busy run", () => {
    expect(
      preferredActiveRunStatus([
        { status: "running" },
        { status: "waiting_input" },
        { status: "queued" },
      ]),
    ).toBe("waiting_input");
    expect(preferredActiveRunStatus([{ status: "queued" }, { status: "waiting_takeover" }])).toBe(
      "waiting_takeover",
    );
  });

  it("falls back to the newest active run when nothing is waiting", () => {
    expect(preferredActiveRunStatus([{ status: "running" }, { status: "queued" }])).toBe("running");
    expect(preferredActiveRunStatus([])).toBeUndefined();
  });
});

describe("previewFromBlocks", () => {
  it("returns the first text block for a DM", () => {
    expect(previewFromBlocks([{ kind: "text", text: "Ship it" }])).toBe("Ship it");
  });

  it("prefixes an outbound bot_message with Messaged {Peer}", () => {
    expect(
      previewFromBlocks([
        {
          kind: "bot_message_sent",
          toBotId: "bot-2",
          toBotName: "Ken",
          text: "check marks",
        },
      ]),
    ).toBe("Messaged Ken: check marks");
    expect(
      isOutboundBotMessage([
        { kind: "bot_message_sent", toBotId: "bot-2", toBotName: "Ken", text: "go" },
      ]),
    ).toBe(true);
  });

  it("prefixes a group bot sender without wrapping Messaged previews", () => {
    const members = [{ bot: { id: "bot-2", name: "Ken" } }];
    expect(
      previewFromGroupMessage(
        { blocks: [{ kind: "text", text: "hello" }], role: "bot", botId: "bot-2" },
        members,
      ),
    ).toBe("Ken: hello");
    expect(
      previewFromGroupMessage(
        { blocks: [{ kind: "text", text: "hello" }], role: "user", botId: null },
        members,
      ),
    ).toBe("hello");
    expect(
      previewFromGroupMessage(
        {
          blocks: [
            { kind: "bot_message_sent", toBotId: "bot-2", toBotName: "Ken", text: "check marks" },
          ],
          role: "bot",
          botId: "bot-1",
        },
        members,
      ),
    ).toBe("Messaged Ken: check marks");
  });
});
