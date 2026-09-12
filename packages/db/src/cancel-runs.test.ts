import { describe, expect, it, vi } from "vitest";
import { cancelRunsInTransaction } from "./cancel-runs.js";
import type { Prisma } from "./client.js";

describe("cancelRunsInTransaction", () => {
  it("marks pending ask and computer Needs you blocks dismissed", async () => {
    const tx = {
      run: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      message: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-ask",
            blocks: [{ kind: "ask", text: "Which city?", status: "pending" }],
          },
          {
            id: "message-takeover",
            blocks: [{ kind: "computer", state: "Needs you", text: "Sign in" }],
          },
          {
            id: "message-done",
            blocks: [{ kind: "ask", text: "Old", status: "answered", answer: "Paris" }],
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await cancelRunsInTransaction(
      tx as unknown as Pick<Prisma.TransactionClient, "run" | "attempt" | "task" | "message">,
      [{ id: "run-1", taskId: "task-1" }],
      new Date("2026-09-12T16:00:00.000Z"),
    );

    expect(tx.message.update).toHaveBeenCalledTimes(2);
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-ask" },
      data: { blocks: [{ kind: "ask", text: "Which city?", status: "dismissed" }] },
    });
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-takeover" },
      data: {
        blocks: [{ kind: "computer", state: "Needs you", text: "Sign in", status: "dismissed" }],
      },
    });
  });
});
