import type { ThreadMessage } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { copyableMessageText, messageProviderLabel } from "./message-text.js";

function message(blocks: ThreadMessage["blocks"]): Pick<ThreadMessage, "blocks"> {
  return { blocks };
}

describe("messageProviderLabel", () => {
  it("prefers a known sendblue transport and falls back to the provider name", () => {
    expect(messageProviderLabel("sendblue", "RCS")).toBe("RCS");
    expect(messageProviderLabel("sendblue", "email")).toBe("iMessage");
    expect(messageProviderLabel("slack")).toBe("Slack");
    expect(messageProviderLabel("unknown-app")).toBe("unknown-app");
  });
});

describe("copyableMessageText", () => {
  it("joins text, progress, and ask blocks without chrome", () => {
    expect(
      copyableMessageText(
        message([
          { kind: "text", text: "first" },
          { kind: "progress", text: "working" },
          { kind: "ask", text: "question?" },
        ]),
      ),
    ).toBe("first\nworking\nquestion?");
  });

  it("includes channel messages with their chat attribution", () => {
    expect(
      copyableMessageText(
        message([
          {
            kind: "channel_message",
            provider: "sendblue",
            transport: "RCS",
            channelId: "ch-1",
            fromAddress: "+15551234567",
            fromLabel: "Alice",
            text: "dinner at 7?",
            hop: 0,
          },
        ]),
      ),
    ).toBe("RCS · Alice: dinner at 7?");
  });

  it("falls back to the provider label for unknown transport values", () => {
    expect(
      copyableMessageText(
        message([
          {
            kind: "channel_message",
            provider: "sendblue",
            transport: "email",
            channelId: "ch-1",
            fromAddress: "+15551234567",
            fromLabel: "Alice",
            text: "hello",
          },
        ]),
      ),
    ).toBe("iMessage · Alice: hello");
  });

  it("omits card chrome", () => {
    expect(
      copyableMessageText(
        message([
          { kind: "text", text: "Hello" },
          {
            kind: "channel_message",
            provider: "sendblue",
            transport: "SMS",
            channelId: "ch-1",
            fromAddress: "+15551234567",
            fromLabel: "Sender",
            text: "Reply",
          },
          { kind: "card", lines: [] },
        ]),
      ),
    ).toBe("Hello\nSMS · Sender: Reply");
  });
});
