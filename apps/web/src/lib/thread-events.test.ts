import { describe, expect, it } from "vitest";
import { applyThreadEvents, reduceThreadSnapshot } from "./thread-events.js";

describe("thread-events adapter", () => {
  it("re-exports the shared snapshot reducer", () => {
    const initial = {
      botId: "bot-1",
      threadId: "thread-1",
      cursor: 3,
      messages: [] as { id: string; role: "bot"; blocks: never[] }[],
      olderCursor: null,
      run: null,
    };
    const event = {
      type: "thread.message.created",
      seq: 4,
      payload: { messageId: "m-1", role: "bot", blocks: [{ kind: "text", text: "Hi" }] },
    };

    const next = reduceThreadSnapshot(initial, event);
    expect(next?.messages[0]).toMatchObject({ id: "m-1", blocks: [{ kind: "text", text: "Hi" }] });
    expect(applyThreadEvents(initial, [event])?.cursor).toBe(4);
  });
});
