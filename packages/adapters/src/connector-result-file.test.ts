import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { preserveConnectorResult } from "./connector-result-file.js";
import type { RunContext } from "./run-context.js";

function setup() {
  const writeFile = vi.fn(
    async (
      _computer: unknown,
      _file: { path: string; content: Uint8Array },
      _context: unknown,
    ) => {},
  );
  const get = vi.fn(async () => ({ id: "computer" }));
  const markDirty = vi.fn();
  const ctx = {
    bot: { id: "bot-1", computer: { id: "computer" } },
    tools: { disabled: new Set<string>() },
    secrets: ["fixture-secret-value"],
    computer: { mode: "team", get, checkpoint: { markDirty } },
    deps: { sandbox: { writeFile } },
    context: { signal: new AbortController().signal },
  } as unknown as RunContext;
  return { ctx, writeFile, get, markDirty };
}
const large = () => ({ content: [{ type: "text", text: `${"line\n".repeat(10_000)}END` }] });

describe("large connector response files", () => {
  it("preserves the complete response with a scoped path and a verifiable digest", async () => {
    const { ctx, writeFile, markDirty } = setup();
    const input = large();
    const result = (await preserveConnectorResult(
      ctx,
      "connected_read",
      "../../external-id",
      input,
    )) as any;
    const file = writeFile.mock.calls[0]![1] as any;
    expect(file.path).toMatch(/^bots\/bot-1\/tool-results\/[a-f0-9]{64}\.json$/);
    expect(JSON.parse(file.content.toString())).toEqual(input);
    expect(result.savedResult.sha256).toBe(createHash("sha256").update(file.content).digest("hex"));
    expect(result.savedResult.bytes).toBe(file.content.length);
    expect(JSON.stringify(result).length).toBeLessThan(12_000);
    expect(markDirty).toHaveBeenCalledOnce();
  });
  it("redacts secrets before writing or previewing", async () => {
    const { ctx, writeFile } = setup();
    const result = await preserveConnectorResult(ctx, "connected_read", "call-1", {
      ...large(),
      credential: "fixture-secret-value",
    });
    expect(JSON.stringify(result)).not.toContain("fixture-secret-value");
    expect((writeFile.mock.calls[0]![1] as any).content.toString()).not.toContain(
      "fixture-secret-value",
    );
  });
  it("keeps small results and remote errors intact without starting a computer", async () => {
    const { ctx, get } = setup();
    for (const value of [
      { ok: true },
      { ...large(), isError: true },
      { error: "x".repeat(20_000) },
    ]) {
      expect(await preserveConnectorResult(ctx, "connected_read", "call", value)).toBe(value);
    }
    expect(get).not.toHaveBeenCalled();
  });
  it("preserves structured pagination and media result contracts", async () => {
    const { ctx, get } = setup();
    for (const value of [
      { segment: 1, nextCursor: "opaque-cursor", diagnostic: "x".repeat(20_000) },
      { content: [...large().content, { type: "image", data: "encoded" }] },
    ])
      expect(await preserveConnectorResult(ctx, "read", "call", value)).toBe(value);
    expect(get).not.toHaveBeenCalled();
  });
  it("respects disabled file tools and bots without computers", async () => {
    const { ctx, get } = setup();
    const value = large();
    for (const tool of ["write_file", "read_file"]) {
      ctx.tools.disabled.add(tool);
      expect(await preserveConnectorResult(ctx, "connected_read", "call", value)).toBe(value);
      ctx.tools.disabled.clear();
    }
    ctx.bot.computer = null;
    expect(await preserveConnectorResult(ctx, "connected_read", "call", value)).toBe(value);
    expect(get).not.toHaveBeenCalled();
  });
  it("does not turn a completed remote action into an error when local saving fails", async () => {
    const { ctx, writeFile } = setup();
    writeFile.mockRejectedValueOnce(new Error("unavailable"));
    const value = large();
    expect(await preserveConnectorResult(ctx, "connected_write", "call", value)).toBe(value);
  });
});
