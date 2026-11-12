import type { ConnectorTool } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { createApprovedEffectReplayQueue } from "./approval-effect.js";
import { expandConnectorArgumentFile } from "./connector-argument-file.js";
import { catalogEntries, resolveCatalogCall } from "./lazy-tool-catalog.js";
import type { RunContext } from "./run-context.js";
import { resolveToolRequest } from "./run-tool-request.js";

function setup() {
  const readFile = vi.fn(async () => Buffer.from(JSON.stringify({ content: "prepared source" })));
  const get = vi.fn(async () => ({ id: "computer" }));
  const target: ConnectorTool = {
    name: "connected_write",
    description: "Write source",
    inputSchema: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"],
      additionalProperties: false,
    },
    route: { connectorId: "mcp", resourceId: "server-1", resourceRevision: 1, toolName: "write" },
  };
  const resolveCall = vi.fn(async (call: Parameters<typeof resolveCatalogCall>[0]) =>
    resolveCatalogCall(call, catalogEntries([target])),
  );
  const ctx = {
    bot: { id: "bot-1", computer: { id: "computer" } },
    tools: {
      disabled: new Set<string>(),
      connector: new Map([
        [
          "connectors_execute_tool",
          { route: { connectorId: "mcp", toolName: "__catalog_execute" } },
        ],
      ]),
      approvedReplays: createApprovedEffectReplayQueue([]),
    },
    computer: { mode: "team", get },
    deps: { sandbox: { readFile }, connector: { resolveCall } },
    context: { signal: new AbortController().signal },
  } as unknown as RunContext;
  return { ctx, readFile, get, target, resolveCall };
}
const wrapper = { id: "server-1:write", argumentsPath: "changes/arguments.json" };

describe("connector argument files", () => {
  it("reads a bounded workspace file and submits the complete object through the live schema", async () => {
    const { ctx, readFile } = setup();
    const args = { content: "source\n".repeat(12_000) };
    readFile.mockResolvedValueOnce(Buffer.from(JSON.stringify(args)));
    const result = await resolveToolRequest(ctx, "connectors_execute_tool", wrapper, "call-1");
    expect(result).toMatchObject({ name: "connected_write", args, catalogRemapped: true });
    expect(JSON.stringify(result)).not.toContain("argumentsPath");
    expect(readFile).toHaveBeenCalledWith(
      { id: "computer" },
      "bots/bot-1/changes/arguments.json",
      ctx.context,
      { maxBytes: 128_000 },
    );
  });

  it("replays the approved snapshot even after the file or caller arguments change", async () => {
    const { ctx, readFile } = setup();
    const first = await resolveToolRequest(ctx, "connectors_execute_tool", wrapper, "call-1");
    if ("error" in first) throw new Error(first.error);
    ctx.tools.approvedReplays = createApprovedEffectReplayQueue([
      { kind: first.name, request: first.effectRequest, idempotencyKey: "approved-key" },
    ]);
    readFile.mockRejectedValue(new Error("file removed after approval"));
    const replay = await resolveToolRequest(
      ctx,
      "connectors_execute_tool",
      {
        id: "unassigned:write",
        argumentsPath: "changed.json",
      },
      "call-2",
    );
    expect(replay).toMatchObject({
      args: { content: "prepared source" },
      approvedEffectKey: "approved-key",
      connectorCall: { args: { content: "prepared source" } },
    });
    expect(readFile).toHaveBeenCalledOnce();
    expect(() => ctx.tools.approvedReplays.assertDrained()).not.toThrow();
  });

  it("still rejects a changed connection revision before consuming approval", async () => {
    const { ctx, target } = setup();
    const first = await resolveToolRequest(ctx, "connectors_execute_tool", wrapper, "call-1");
    if ("error" in first) throw new Error(first.error);
    ctx.tools.approvedReplays = createApprovedEffectReplayQueue([
      { kind: first.name, request: first.effectRequest },
    ]);
    target.route!.resourceRevision = 2;
    const replay = await resolveToolRequest(ctx, "connectors_execute_tool", wrapper, "call-2");
    expect(replay).toHaveProperty("error");
    expect(ctx.tools.approvedReplays.nextToolName()).toBe(first.name);
  });

  it("rejects unassigned targets and invalid source arguments before execution", async () => {
    const { ctx, readFile } = setup();
    expect(
      await resolveToolRequest(ctx, "connectors_execute_tool", { id: wrapper.id }, "call"),
    ).toHaveProperty("error");
    expect(
      await resolveToolRequest(
        ctx,
        "connectors_execute_tool",
        { ...wrapper, id: "unassigned:write" },
        "call",
      ),
    ).toHaveProperty("error");
    readFile.mockResolvedValueOnce(Buffer.from('{"content":42}'));
    expect(
      await resolveToolRequest(ctx, "connectors_execute_tool", wrapper, "call"),
    ).toHaveProperty("error");
  });

  it("leaves inline arguments and direct tools with an argumentsPath parameter alone", async () => {
    const { ctx, readFile } = setup();
    const inline = { id: wrapper.id, arguments: { content: "inline" } };
    expect(await expandConnectorArgumentFile(ctx, "tool", inline)).toBe(inline);
    const args = { argumentsPath: "a real remote parameter" };
    expect(await resolveToolRequest(ctx, "direct_tool", args, "call")).toMatchObject({ args });
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects ambiguous inputs and unavailable file access without starting a computer", async () => {
    const { ctx, get } = setup();
    await expect(
      expandConnectorArgumentFile(ctx, "tool", { ...wrapper, arguments: {} }),
    ).rejects.toThrow("not both");
    ctx.tools.disabled.add("read_file");
    await expect(expandConnectorArgumentFile(ctx, "tool", wrapper)).rejects.toThrow("unavailable");
    ctx.tools.disabled.clear();
    ctx.bot.computer = null;
    await expect(expandConnectorArgumentFile(ctx, "tool", wrapper)).rejects.toThrow("unavailable");
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    Buffer.from("null"),
    Buffer.from("[]"),
    Buffer.from('"text"'),
    Buffer.from("{bad"),
    Buffer.from([0xff]),
  ])("rejects invalid object data without including file contents in errors", async (data) => {
    const { ctx, readFile } = setup();
    readFile.mockResolvedValueOnce(data);
    await expect(expandConnectorArgumentFile(ctx, "tool", wrapper)).rejects.toThrow(/JSON object/);
  });

  it("rejects traversal, read failures and oversized responses even if an adapter ignores its limit", async () => {
    const { ctx, readFile } = setup();
    await expect(
      expandConnectorArgumentFile(ctx, "tool", { ...wrapper, argumentsPath: "../../../outside" }),
    ).rejects.toThrow("Could not read");
    expect(readFile).not.toHaveBeenCalled();
    readFile.mockRejectedValueOnce(new Error("private path details"));
    await expect(expandConnectorArgumentFile(ctx, "tool", wrapper)).rejects.toThrow(
      "Could not read",
    );
    readFile.mockResolvedValueOnce(Buffer.alloc(128_001));
    await expect(expandConnectorArgumentFile(ctx, "tool", wrapper)).rejects.toThrow("size limit");
  });
});
