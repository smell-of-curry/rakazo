import { resolveBotWorkspacePath } from "./computer-support.js";
import type { RunContext } from "./run-context.js";

const MAX_ARGUMENT_FILE_BYTES = 128_000;

/** Snapshot workspace arguments before schema validation, review, and persisted replay. */
export async function expandConnectorArgumentFile(
  ctx: RunContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!("argumentsPath" in args)) return args;
  if ("arguments" in args) throw new Error("Supply either arguments or argumentsPath, not both.");
  if (typeof args.argumentsPath !== "string" || !args.argumentsPath.trim())
    throw new Error("argumentsPath must name a UTF-8 JSON object file in the workspace.");
  if (!ctx.bot.computer || ctx.tools.disabled.has("read_file"))
    throw new Error("Workspace file reading is unavailable for this bot.");

  let bytes: Uint8Array;
  try {
    const path = resolveBotWorkspacePath(ctx.computer.mode, ctx.bot.id, args.argumentsPath);
    bytes = await ctx.deps.sandbox.readFile(
      await ctx.computer.get("tool", toolName),
      path,
      ctx.context,
      { maxBytes: MAX_ARGUMENT_FILE_BYTES },
    );
  } catch {
    throw new Error("Could not read argumentsPath within the workspace file size limit.");
  }
  if (bytes.byteLength > MAX_ARGUMENT_FILE_BYTES)
    throw new Error("argumentsPath exceeds the workspace file size limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("argumentsPath must contain a valid UTF-8 JSON object.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("argumentsPath must contain a JSON object.");
  return { id: args.id, arguments: parsed };
}
