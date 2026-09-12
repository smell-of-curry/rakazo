import { isApprovalAskBlock, isSecretAskBlock } from "./action-approval.js";
import { isNeedsYou } from "./run-state.js";

export const HUMAN_GATE_CONTINUE_PROMPT =
  "You asked the user in chat. Call ask_user, request_secret, or request_takeover now.";

export type NeedsYouKind = "ask" | "secret" | "approval" | "takeover";

export type NeedsYouSnapshot = {
  run?: { id: string; status: string } | null;
  activeRuns?: readonly { id: string; status: string }[];
  messages?: readonly {
    id: string;
    runId?: string | null;
    blocks: readonly {
      kind: string;
      status?: string;
      text?: string;
      state?: string;
      input?: string;
      approvalEffectId?: string;
      actions?: readonly { id: string; label: string }[];
    }[];
  }[];
};

export type NeedsYouResult = {
  kind: NeedsYouKind | null;
  messageId?: string;
  text?: string;
};

export function isOpenGateStatus(status: string | undefined): boolean {
  return status !== "answered" && status !== "dismissed";
}

/** Latest unanswered computer handoff line. Prefer `needsYou` for the full gate. */
export function latestComputerNeedsYouText(
  messages: NeedsYouSnapshot["messages"],
): string | undefined {
  if (!messages) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    for (let blockIndex = message.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = message.blocks[blockIndex];
      if (
        block?.kind === "computer" &&
        block.state === "Needs you" &&
        isOpenGateStatus(block.status) &&
        block.text?.trim()
      ) {
        return block.text;
      }
    }
  }
  return undefined;
}

export function needsYou(snapshot: NeedsYouSnapshot | null | undefined): NeedsYouResult {
  if (!snapshot) return { kind: null };
  const runs = snapshot.activeRuns ?? (snapshot.run ? [snapshot.run] : []);
  const waiting = runs.filter((run) => isNeedsYou(run.status));
  if (waiting.length === 0) return { kind: null };
  const waitingIds = new Set(waiting.map((run) => run.id));
  const messages = snapshot.messages ?? [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.runId || !waitingIds.has(message.runId)) continue;
    for (let blockIndex = message.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = message.blocks[blockIndex];
      if (!block) continue;
      if (block.kind === "ask" && isOpenGateStatus(block.status)) {
        if (isApprovalAskBlock(block)) {
          return { kind: "approval", messageId: message.id, text: block.text };
        }
        if (isSecretAskBlock(block)) {
          return { kind: "secret", messageId: message.id, text: block.text };
        }
        return { kind: "ask", messageId: message.id, text: block.text };
      }
      if (
        block.kind === "computer" &&
        block.state === "Needs you" &&
        isOpenGateStatus(block.status)
      ) {
        return { kind: "takeover", messageId: message.id, text: block.text };
      }
    }
  }

  if (waiting.some((run) => run.status === "waiting_takeover")) {
    return { kind: "takeover", text: latestComputerNeedsYouText(messages) };
  }
  return { kind: null };
}

const SECRET_ASK =
  /api[ _-]?key|access token|secret key|paste (?:your |the )?(?:key|token|secret|password)|enter (?:your |the )?(?:api|password|token|secret|otp|2fa|code)/i;
const LOGIN_ASK = /sign in|log in|login at|sign into|authenticate at|complete (?:2fa|captcha|duo)/i;
const NEED_USER = /please|need you|can you|could you/i;
const FACT_QUESTION =
  /^(?:which |what |whose |please (?:send|provide|enter|tell)|i need (?:you to|your))/i;

export function textLooksLikeHumanGate(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (SECRET_ASK.test(value)) return true;
  if (LOGIN_ASK.test(value) && (/\bhttps?:\/\//i.test(value) || NEED_USER.test(value))) return true;
  if (/\?\s*$/.test(value) && FACT_QUESTION.test(value)) return true;
  return false;
}

export function shouldContinueForHumanGate(input: {
  scripted?: boolean;
  alreadyContinued?: boolean;
  assembled: string;
}): boolean {
  if (input.scripted || input.alreadyContinued) return false;
  return textLooksLikeHumanGate(input.assembled);
}
