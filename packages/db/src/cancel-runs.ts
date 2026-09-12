import type { Prisma } from "./client.js";

type GateBlock = { kind?: unknown; status?: unknown; state?: unknown };

function dismissGateBlocks(blocks: unknown): { next: unknown; changed: boolean } {
  if (!Array.isArray(blocks)) return { next: blocks, changed: false };
  let changed = false;
  const next = blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const row = block as GateBlock;
    if (row.kind === "ask" && row.status !== "answered" && row.status !== "dismissed") {
      changed = true;
      return { ...row, status: "dismissed" };
    }
    if (row.kind === "computer" && row.state === "Needs you" && row.status !== "dismissed") {
      changed = true;
      return { ...row, status: "dismissed" };
    }
    return block;
  });
  return { next, changed };
}

/** The caller selects authorized runs and owns the surrounding transaction and cleanup. */
export async function cancelRunsInTransaction(
  tx: Pick<Prisma.TransactionClient, "run" | "attempt" | "task" | "message">,
  runs: ReadonlyArray<{ id: string; taskId: string }>,
  cancelledAt: Date,
): Promise<void> {
  if (runs.length === 0) return;
  const runIds = runs.map((run) => run.id);
  await tx.run.updateMany({
    where: { id: { in: runIds } },
    data: {
      status: "cancelled",
      completedAt: cancelledAt,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  await tx.attempt.updateMany({
    where: { runId: { in: runIds }, status: "running" },
    data: { status: "cancelled", finishedAt: cancelledAt },
  });
  await tx.task.updateMany({
    where: { id: { in: runs.map((run) => run.taskId) } },
    data: { status: "cancelled" },
  });
  const messages = await tx.message.findMany({
    where: { runId: { in: runIds } },
    select: { id: true, blocks: true },
  });
  for (const message of messages) {
    const { next, changed } = dismissGateBlocks(message.blocks);
    if (!changed) continue;
    await tx.message.update({
      where: { id: message.id },
      data: { blocks: next as Prisma.InputJsonValue },
    });
  }
}
