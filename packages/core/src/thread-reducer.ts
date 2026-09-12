import type { ComputerStatus, MessageBlock, Run, RunStatus } from "@rakazo/contracts";
import {
  isRunTerminalEvent,
  progressMessageId,
  reduceLiveMessageBlocks,
  runFailureError,
  subagentBlockFromPayload,
} from "./events.js";
import {
  mergeThreadHistory,
  prependThreadHistoryPage,
  upsertMessageById,
} from "./message-pages.js";
import { isActive } from "./run-state.js";
import { takeLiveMessage, updateCloudAgentMessages } from "./thread-message-updates.js";

export type ThreadReducerMessage = {
  id: string;
  threadId?: string;
  seq?: number;
  role: "user" | "bot" | "system";
  blocks: MessageBlock[];
  botId?: string;
  runId?: string | null;
  replyToMessageId?: string;
  createdAt?: string;
};

export type ThreadReducerRun = {
  id: string;
  botId?: string;
  threadId?: string;
  taskId?: string;
  status: string;
  trigger?: string;
  routineId?: string | null;
  modelProvider?: string | null;
  modelId?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
};

export type ThreadReducerComputer = {
  busyBotName?: string | null;
  state?: string;
  controlHolder?: string;
  controlBotId?: string | null;
  takeoverRequested?: boolean;
  screenAvailable?: boolean;
};

export type ThreadReducerSnapshot<M extends ThreadReducerMessage = ThreadReducerMessage> = {
  threadId: string;
  cursor?: number;
  messages: M[];
  olderCursor: number | null;
  botId?: string;
  groupId?: string;
  run: ThreadReducerRun | null;
  activeRuns?: ThreadReducerRun[];
  members?: Array<{ botId: string; status?: string }>;
  computer?: ThreadReducerComputer | null;
};

export type ThreadReducerEvent = {
  id?: string;
  type: string;
  seq?: number;
  runId?: string | null;
  botId?: string | null;
  threadId?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
};

const runTriggers = new Set<Run["trigger"]>([
  "user",
  "routine",
  "resume",
  "follow_up",
  "reaction",
  "spawn",
  "skill",
  "bot_message",
  "webhook",
  "messaging",
  "cloud_agent",
]);

const computerStates: ReadonlySet<unknown> = new Set<ComputerStatus["state"]>([
  "stopped",
  "booting",
  "running",
  "suspended",
  "error",
]);

function eventCursor<S extends ThreadReducerSnapshot>(
  prev: S,
  event: ThreadReducerEvent,
): number | undefined {
  return event.seq ?? prev.cursor;
}

function nextSnapshot<S extends ThreadReducerSnapshot>(prev: S, patch: object): S {
  return { ...prev, ...patch };
}

function runFromStartedEvent(
  event: ThreadReducerEvent,
  previous: ThreadReducerRun | undefined,
): ThreadReducerRun {
  const trigger = event.payload?.trigger;
  return {
    id: event.runId ?? previous?.id ?? event.id ?? "",
    botId: event.botId ?? previous?.botId ?? undefined,
    threadId: event.threadId ?? previous?.threadId,
    taskId: previous?.taskId ?? event.runId ?? event.id,
    status: "running",
    trigger:
      typeof trigger === "string" && runTriggers.has(trigger as Run["trigger"])
        ? trigger
        : (previous?.trigger ?? "user"),
    routineId:
      typeof event.payload?.routineId === "string"
        ? event.payload.routineId
        : (previous?.routineId ?? null),
    modelProvider: previous?.modelProvider ?? null,
    modelId: previous?.modelId ?? null,
    error: null,
    startedAt: previous?.startedAt ?? event.createdAt ?? null,
    completedAt: null,
    createdAt: previous?.createdAt ?? event.createdAt ?? "",
  };
}

function waitingRunFromEvent(
  event: ThreadReducerEvent,
  runId: string,
  status: string,
): ThreadReducerRun {
  return {
    id: runId,
    botId: event.botId ?? undefined,
    threadId: event.threadId,
    taskId: runId,
    status,
    trigger: "bot_message",
    routineId: null,
    modelProvider: null,
    modelId: null,
    error: null,
    startedAt: event.createdAt ?? null,
    completedAt: null,
    createdAt: event.createdAt ?? "",
  };
}

function messageFromEvent<M extends ThreadReducerMessage>(
  event: ThreadReducerEvent,
  fields: Pick<ThreadReducerMessage, "id" | "role" | "blocks"> & Partial<ThreadReducerMessage>,
): M {
  const next: ThreadReducerMessage = {
    id: fields.id,
    role: fields.role,
    blocks: fields.blocks,
  };
  const threadId = fields.threadId ?? event.threadId;
  const seq = fields.seq ?? event.seq;
  const botId = fields.botId ?? event.botId ?? undefined;
  const runId = fields.runId ?? event.runId ?? undefined;
  const createdAt = fields.createdAt ?? event.createdAt;
  if (threadId) next.threadId = threadId;
  if (seq !== undefined) next.seq = seq;
  if (botId) next.botId = botId;
  if (runId) next.runId = runId;
  if (createdAt) next.createdAt = createdAt;
  if (fields.replyToMessageId) next.replyToMessageId = fields.replyToMessageId;
  return next as M;
}

export function activeThreadRuns<S extends ThreadReducerSnapshot>(
  snapshot: S | null,
): NonNullable<S["activeRuns"]> {
  return snapshot?.activeRuns ?? (snapshot?.run ? [snapshot.run] : []);
}

/**
 * Reflect a committed direct-message send before its follow-up snapshot arrives.
 *
 * threads.send returns only after the message and run are durable. Keeping that
 * receipt prevents a transient snapshot/SSE interruption from showing a stored
 * user bubble with no working state. A matching live run always wins, and the
 * next durable event or refresh still supplies the authoritative status.
 */
export function applyThreadSendReceipt<S extends ThreadReducerSnapshot>(
  snapshot: S | null,
  receipt: { botId: string; runId: string; taskId: string; createdAt?: string },
  terminalRunIds: ReadonlySet<string> = new Set(),
): S | null {
  if (
    !snapshot ||
    snapshot.groupId ||
    snapshot.botId !== receipt.botId ||
    snapshot.run?.id === receipt.runId ||
    terminalRunIds.has(receipt.runId)
  ) {
    return snapshot;
  }
  const currentRuns = activeThreadRuns(snapshot);
  if (currentRuns.some((run) => isActive(run.status as RunStatus))) return snapshot;
  const createdAt = receipt.createdAt ?? new Date().toISOString();
  const run: ThreadReducerRun = {
    id: receipt.runId,
    botId: receipt.botId,
    threadId: snapshot.threadId,
    taskId: receipt.taskId,
    status: "queued",
    trigger: "user",
    routineId: null,
    modelProvider: null,
    modelId: null,
    error: null,
    startedAt: null,
    completedAt: null,
    createdAt,
  };
  return nextSnapshot(snapshot, { run, activeRuns: [run] });
}

/** Reason the newest run stopped, until the reader dismisses that run's failure. */
export function threadRunError(
  snapshot: ThreadReducerSnapshot | null,
  dismissedRunIds?: ReadonlySet<string>,
): string | null {
  const run = snapshot?.run;
  if (run?.status !== "failed" || dismissedRunIds?.has(run.id)) return null;
  return run.error ?? null;
}

export function clearActiveThreadRuns<S extends ThreadReducerSnapshot>(snapshot: S): S {
  const runIds = new Set(activeThreadRuns(snapshot).map((run) => run.id));
  const computer = snapshot.computer?.busyBotName
    ? { ...snapshot.computer, busyBotName: null }
    : snapshot.computer;
  return nextSnapshot(snapshot, {
    run: null,
    activeRuns: [],
    messages: snapshot.messages.filter(
      (message) =>
        !message.runId || !runIds.has(message.runId) || !message.id.startsWith("progress:"),
    ),
    computer,
  });
}

export function mergeThreadSnapshot<S extends ThreadReducerSnapshot>(
  prev: S | null,
  next: S,
  preserveLoadedHistory = false,
): S {
  // A threads.get started before SSE caught up must not wipe newer live state
  // (e.g. ask cards applied after send's post-refresh request was already in flight).
  if (prev && prev.threadId === next.threadId && (prev.cursor ?? -1) > (next.cursor ?? -1))
    return prev;
  return mergeThreadHistory(prev, next, preserveLoadedHistory);
}

/**
 * Apply a threads.get refresh without clobbering newer event-sourced takeover state.
 *
 * A refresh that started earlier can still return running+busyBotName after the client
 * already applied waiting_takeover. Cursor comparisons only apply within the same thread.
 * Stop clears run/busy optimistically in the shell because it has no terminal event; an
 * older-cursor refresh must keep that cleared local state (see Shell stopRun).
 */
export function reconcileRefreshedThread<
  S extends ThreadReducerSnapshot,
  C extends ThreadReducerComputer = NonNullable<S["computer"]>,
>(
  prev: S | null,
  snap: S,
  prevComputer: C | null,
  preserveLoadedHistory = false,
): { snapshot: S; computer: C | null } {
  const sameThread = Boolean(prev && prev.threadId === snap.threadId);

  if (sameThread && prev && (snap.cursor ?? -1) < (prev.cursor ?? -1)) {
    // A subscription can advance the cursor with progress before the send-triggered refresh
    // returns the new run record. Hydrate that matching run without rolling the transcript back.
    // Optimistic stop removes the matching progress message, so an older refresh cannot revive it.
    const refreshedRun = snap.run;
    const hasMatchingLiveProgress = Boolean(
      refreshedRun &&
        prev.messages.some(
          (message) =>
            message.runId === refreshedRun.id && message.id === `progress:${refreshedRun.id}`,
        ),
    );
    if (!prev.run && refreshedRun && hasMatchingLiveProgress) {
      return {
        snapshot: {
          ...prev,
          run: refreshedRun,
          activeRuns: snap.activeRuns,
          computer: snap.computer,
        },
        computer: (snap.computer ?? null) as C | null,
      };
    }
    // Progress can advance the thread cursor while embedded computer status from threads.get
    // is still useful — but only while a live run remains. Preserve event-sourced
    // waiting_takeover clears and optimistic stop clears.
    const preserveLocalComputer =
      prev.run?.status === "waiting_takeover" ||
      !prev.run ||
      !isActive(prev.run.status as RunStatus);
    return {
      snapshot: prev,
      computer: preserveLocalComputer ? prevComputer : ((snap.computer ?? null) as C | null),
    };
  }

  let snapshot = mergeThreadSnapshot(prev, snap, preserveLoadedHistory);
  let computer = (snap.computer ?? null) as C | null;

  const localWaiting =
    sameThread &&
    prev?.run?.status === "waiting_takeover" &&
    snapshot.run?.id === prev.run.id &&
    snapshot.run.status !== "waiting_takeover" &&
    isActive(snapshot.run.status as RunStatus);

  if (localWaiting && snapshot.run) {
    const runId = snapshot.run.id;
    snapshot = {
      ...snapshot,
      run: { ...snapshot.run, status: "waiting_takeover" },
      activeRuns: snapshot.activeRuns?.map((run) =>
        run.id === runId ? { ...run, status: "waiting_takeover" } : run,
      ),
    };
    if (computer?.busyBotName) computer = { ...computer, busyBotName: null };
  } else if (snapshot.run?.status === "waiting_takeover" && computer?.busyBotName) {
    computer = { ...computer, busyBotName: null };
  }

  return { snapshot, computer };
}

export function prependThreadMessagePage<S extends ThreadReducerSnapshot>(
  prev: S | null,
  page: ThreadHistoryPage<S["messages"][number]>,
): S | null {
  return prependThreadHistoryPage(prev, page);
}

type ThreadHistoryPage<M extends ThreadReducerMessage> = {
  threadId: string;
  messages: readonly M[];
  olderCursor: number | null;
};

export function isThreadSnapshotEvent(event: { type: string }): boolean {
  return (
    event.type === "thread.cleared" ||
    event.type === "thread.progress" ||
    event.type === "thread.subagent" ||
    event.type === "thread.cloud_agent" ||
    event.type === "agent.tool.called" ||
    event.type === "agent.tool.completed" ||
    event.type === "thread.message.created" ||
    event.type === "thread.message.updated" ||
    event.type === "thread.message.reaction" ||
    event.type === "run.started" ||
    event.type === "run.waiting_input" ||
    event.type === "computer.takeover.requested" ||
    isRunTerminalEvent(event)
  );
}

export function applyThreadEvents<S extends ThreadReducerSnapshot>(
  snapshot: S | null,
  events: readonly ThreadReducerEvent[],
): S | null {
  let next = snapshot;
  for (const event of events) next = reduceThreadSnapshot(next, event);
  return next;
}

export function reduceThreadSnapshot<S extends ThreadReducerSnapshot>(
  prev: S | null,
  event: ThreadReducerEvent,
): S | null {
  if (!prev) return prev;
  const cursor = eventCursor(prev, event);
  if (event.type === "thread.cleared") {
    return nextSnapshot(prev, {
      cursor,
      messages: [],
      olderCursor: null,
      run: null,
      activeRuns: [],
    });
  }
  if (event.type === "run.started") {
    if (!event.runId) {
      const members = updateMemberStatus(prev.members, event.botId, "running");
      if (members === prev.members && cursor === prev.cursor) return prev;
      return nextSnapshot(prev, { cursor, members });
    }
    const previousRun =
      prev.activeRuns?.find((candidate) => candidate.id === event.runId) ??
      (prev.run?.id === event.runId ? prev.run : undefined);
    const run = runFromStartedEvent(event, previousRun);
    const without = (prev.activeRuns ?? (prev.run ? [prev.run] : [])).filter(
      (candidate) => candidate.id !== run.id,
    );
    // Bot threads keep a single primary run; groups accumulate concurrent member runs.
    const activeRuns = prev.groupId ? [...without, run] : [run];
    return nextSnapshot(prev, {
      cursor,
      members: updateMemberStatus(prev.members, event.botId, "running"),
      // A group failure lives only in run; keep it until dismiss so a late member start
      // cannot wipe the banner (activeRuns still tracks the new work).
      run: prev.groupId && prev.run?.status === "failed" && prev.run.id !== run.id ? prev.run : run,
      activeRuns,
    });
  }
  if (event.type === "run.waiting_input" || event.type === "computer.takeover.requested") {
    const status = event.type === "run.waiting_input" ? "waiting_input" : "waiting_takeover";
    const runId = event.runId;
    const knownInRun = Boolean(runId && prev.run?.id === runId);
    const knownInActive = Boolean(
      runId && prev.activeRuns?.some((candidate) => candidate.id === runId),
    );
    // Peer bot_message runs are omitted from snapshots while busy; the first wait
    // event is how an open thread learns they need ask/takeover UI.
    const needsInsert = Boolean(runId) && !knownInRun && !knownInActive;
    const runChanged = Boolean(knownInRun && prev.run && prev.run.status !== status);
    const activeRunChanged = Boolean(
      knownInActive &&
        prev.activeRuns?.some((candidate) => candidate.id === runId && candidate.status !== status),
    );
    const members = updateMemberStatus(prev.members, event.botId, status);
    // Waiting pauses drop live progress server-side; clear a leftover bubble so a
    // missed message.created cannot leave "working…" stuck next to the gate.
    // Mobile also cleared progress on takeover — keep that, or the waiting footer
    // hides behind a stale Working row (torn-card / Needs you).
    const liveId = progressMessageId(event);
    const messages = prev.messages.some((message) => message.id === liveId)
      ? prev.messages.filter((message) => message.id !== liveId)
      : prev.messages;
    const computer =
      event.type === "computer.takeover.requested" && prev.computer?.busyBotName
        ? { ...prev.computer, busyBotName: null }
        : prev.computer;
    if (
      !runChanged &&
      !activeRunChanged &&
      !needsInsert &&
      members === prev.members &&
      messages === prev.messages &&
      computer === prev.computer
    ) {
      return prev;
    }
    if (needsInsert && runId) {
      const inserted = waitingRunFromEvent(event, runId, status);
      const baseActive = prev.activeRuns ?? (prev.run ? [prev.run] : []);
      const activeRuns = [...baseActive.filter((candidate) => candidate.id !== runId), inserted];
      const promoteWaiting =
        !prev.run ||
        (prev.run.status !== "waiting_input" && prev.run.status !== "waiting_takeover");
      return nextSnapshot(prev, {
        cursor,
        members,
        messages,
        computer,
        run: promoteWaiting ? inserted : prev.run,
        activeRuns,
      });
    }
    return nextSnapshot(prev, {
      cursor,
      members,
      messages,
      computer,
      run: runChanged && prev.run ? { ...prev.run, status } : prev.run,
      activeRuns: activeRunChanged
        ? prev.activeRuns?.map((candidate) =>
            candidate.id === runId ? { ...candidate, status } : candidate,
          )
        : prev.activeRuns,
    });
  }
  if (isRunTerminalEvent(event)) {
    const activeRuns = prev.activeRuns?.filter((candidate) => candidate.id !== event.runId);
    const nextMemberRun = activeRuns?.find((candidate) => candidate.botId === event.botId);
    const failure = runFailureError(event);
    const primaryEnded = prev.run?.id === event.runId ? prev.run : null;
    // In a group the failing run may be a member run rather than the displayed one, so look
    // it up in activeRuns as well or its error would be dropped with it.
    const endedRun =
      primaryEnded ?? prev.activeRuns?.find((candidate) => candidate.id === event.runId) ?? null;
    return nextSnapshot(prev, {
      cursor,
      messages: prev.messages.filter((message) => message.id !== progressMessageId(event)),
      members: updateMemberStatus(prev.members, event.botId, nextMemberRun?.status ?? "idle"),
      // A failed run stays in run (activeRuns already excludes it) so the transcript can say
      // why it stopped, matching what threads.get returns on the next load.
      run:
        endedRun && failure
          ? { ...endedRun, status: "failed", error: failure }
          : primaryEnded
            ? (activeRuns?.[0] ?? null)
            : prev.run,
      activeRuns,
    });
  }
  if (event.type === "thread.progress") {
    const liveId = progressMessageId(event);
    const { previous, remaining } = takeLiveMessage(prev.messages, liveId);
    const blocks = reduceLiveMessageBlocks(previous?.blocks ?? [], {
      type: "progress",
      payload: event.payload,
    });
    const streaming = messageFromEvent<S["messages"][number]>(event, {
      id: liveId,
      role: "bot",
      blocks,
    });
    return nextSnapshot(prev, { cursor, messages: [...remaining, streaming] });
  }
  if (event.type === "agent.tool.called") {
    const liveId = progressMessageId(event);
    const { previous, remaining } = takeLiveMessage(prev.messages, liveId);
    const blocks = reduceLiveMessageBlocks(previous?.blocks ?? [], {
      type: "tool",
      name: String(event.payload?.name ?? ""),
    });
    const next = messageFromEvent<S["messages"][number]>(event, {
      id: liveId,
      role: "bot",
      blocks,
    });
    return nextSnapshot(prev, { cursor, messages: [...remaining, next] });
  }
  if (event.type === "agent.tool.completed") {
    return nextSnapshot(prev, { cursor });
  }
  if (event.type === "thread.subagent") {
    const block = subagentBlockFromPayload(event.payload ?? {});
    const next = messageFromEvent<S["messages"][number]>(event, {
      id: `subagent:${block.agentId || event.id || "live"}`,
      role: "bot",
      blocks: [block],
    });
    const without: S["messages"] = [];
    const kept: S["messages"] = [];
    for (const message of prev.messages) {
      if (message.id === next.id) continue;
      if (message.id.startsWith("progress:")) {
        if (message.runId) kept.push(message);
      } else {
        without.push(message);
      }
    }
    return nextSnapshot(prev, { cursor, messages: [...without, next, ...kept] });
  }

  if (event.type === "thread.cloud_agent") {
    return nextSnapshot(prev, {
      cursor,
      messages: updateCloudAgentMessages(prev.messages, event.payload ?? {}),
    });
  }
  if (event.type === "thread.message.created" || event.type === "thread.message.updated") {
    const role = (event.payload?.role as ThreadReducerMessage["role"]) ?? "bot";
    const blocks = (event.payload?.blocks as MessageBlock[]) ?? [];
    const replyToMessageId =
      typeof event.payload?.replyToMessageId === "string"
        ? event.payload.replyToMessageId
        : undefined;
    const next = messageFromEvent<S["messages"][number]>(event, {
      id: String(event.payload?.messageId ?? event.id ?? `msg:${event.seq ?? 0}`),
      role,
      blocks,
      replyToMessageId,
    });
    const replacedSubagentIds = new Set(
      blocks.filter((block) => block.kind === "subagent").map((block) => block.agentId),
    );
    const liveId = progressMessageId(event);
    const { remaining } = takeLiveMessage(prev.messages, liveId);
    const without = remaining.filter((message) => !replacedSubagent(message, replacedSubagentIds));
    return nextSnapshot(prev, { cursor, messages: upsertMessageById(without, next) });
  }
  return prev;
}

function updateMemberStatus<M extends { botId: string; status?: string }>(
  members: readonly M[] | undefined,
  botId: string | null | undefined,
  status: string,
): readonly M[] | undefined {
  if (!botId) return members;
  const member = members?.find((candidate) => candidate.botId === botId);
  if (!member || member.status === status) return members;
  return members?.map((candidate) =>
    candidate.botId === botId ? { ...candidate, status } : candidate,
  );
}

export function userHoldsComputerControl(
  computer: Pick<ComputerStatus, "controlHolder" | "controlBotId"> | null | undefined,
  botId: string | undefined,
): boolean {
  return Boolean(botId && computer?.controlHolder === "user" && computer.controlBotId === botId);
}

/** True when a live bot run is blocking Take control (API would return 409). */
export function computerTakeoverBlocked(
  computer: Pick<ComputerStatus, "busyBotName"> | null | undefined,
  runStatus?: string | null,
): boolean {
  if (!computer?.busyBotName) return false;
  // waiting_takeover is the bot asking for control; terminal/idle clears the block even if
  // busyBotName is briefly stale while the executor still holds the lease in finally.
  if (!runStatus || runStatus === "waiting_takeover") return false;
  return isActive(runStatus as RunStatus);
}

export function computerPanelAutoBoot(
  state: ComputerStatus["state"] | undefined,
  screenUrl?: string | null,
): "boot" | "recover-screen" | "wait" {
  if (state === "booting" || state === "suspended") return "wait";
  if (state === "running") return screenUrl ? "wait" : "recover-screen";
  return "boot";
}

/** Fresh boot claim — a second `computer.boot` loses with "Computer is busy". */
export function computerBootInFlight(state: ComputerStatus["state"] | undefined): boolean {
  return state === "booting";
}

/** Screen stream is valid while running or still marked booting (activation can lag). */
export function computerCanShowScreen(
  state: ComputerStatus["state"] | undefined,
  screenUrl: string | null | undefined,
): boolean {
  return Boolean(screenUrl) && (state === "running" || state === "booting");
}

/** Auto panel reconnect must use computer.boot — never computer.recover (that destroys the sandbox). */
export function computerPanelAutoUsesBoot(
  action: ReturnType<typeof computerPanelAutoBoot>,
): boolean {
  return action === "boot" || action === "recover-screen";
}

export function computerPanelNeedsMaintenance(
  state: ComputerStatus["state"] | undefined,
  booting: boolean,
): boolean {
  return !booting && (state === "error" || state === "stopped");
}

export function reduceComputerStatus(
  prev: ComputerStatus | null,
  event: ThreadReducerEvent,
): ComputerStatus | null {
  if (!prev) return prev;
  if (!isComputerStatusEvent(event)) return prev;
  if (event.type === "computer.takeover.requested") {
    const retainedControl = event.payload?.retainedControl === true;
    const next = {
      ...prev,
      busyBotName: null,
      takeoverRequested: true,
      ...(retainedControl ? {} : { controlHolder: "none" as const, controlBotId: null }),
    };
    return prev.busyBotName === next.busyBotName &&
      prev.takeoverRequested === next.takeoverRequested &&
      prev.controlHolder === next.controlHolder &&
      prev.controlBotId === next.controlBotId
      ? prev
      : next;
  }
  if (event.type === "computer.takeover.granted") {
    const takeoverRequested = event.payload?.takeoverRequested === true;
    return prev.controlHolder === "user" &&
      prev.controlBotId === event.botId &&
      prev.takeoverRequested === takeoverRequested &&
      prev.busyBotName === null
      ? prev
      : {
          ...prev,
          controlHolder: "user",
          controlBotId: event.botId ?? null,
          takeoverRequested,
          busyBotName: null,
        };
  }
  if (event.type === "computer.takeover.released") {
    const holder = event.payload?.holder;
    if (holder !== "bot" && holder !== "none") return prev;
    return prev.controlHolder === holder &&
      prev.controlBotId === null &&
      !prev.takeoverRequested &&
      prev.busyBotName === null
      ? prev
      : {
          ...prev,
          controlHolder: holder,
          controlBotId: null,
          takeoverRequested: false,
          busyBotName: null,
        };
  }
  const status = event.payload?.status;
  if (!isComputerState(status)) return prev;
  const screenAvailable = status === "running" || status === "booting" || prev.screenAvailable;
  if (status === prev.state && screenAvailable === prev.screenAvailable) return prev;
  return {
    ...prev,
    state: status,
    screenAvailable,
  };
}

export function isComputerStatusEvent(event: { type: string }): boolean {
  return (
    event.type === "computer.status" ||
    event.type === "computer.takeover.requested" ||
    event.type === "computer.takeover.granted" ||
    event.type === "computer.takeover.released"
  );
}

function isComputerState(value: unknown): value is ComputerStatus["state"] {
  return computerStates.has(value);
}

function replacedSubagent(message: ThreadReducerMessage, agentIds: ReadonlySet<string>) {
  if (agentIds.size === 0) return false;
  return message.blocks.some((block) => block.kind === "subagent" && agentIds.has(block.agentId));
}
