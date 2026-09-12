import { t } from "@lingui/core/macro";
import type { Bot, Routine } from "@rakazo/contracts";
import { cronFromPreset } from "@rakazo/core";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { localTimezone } from "../../lib/local-timezone";
import { rpc } from "../../lib/rpc";
import { sharedInflight } from "../../lib/shared-inflight";
import {
  draftFromRoutine,
  emptyRoutineDraft,
  type RoutineDraftState,
  routineNeedsOneShotArm,
} from "../RoutineEditor";
import type { Panel } from "./types";

export type UseRoutinesArgs = {
  panel: Panel;
  setBots: Dispatch<SetStateAction<Bot[]>>;
  activeBotId: MutableRefObject<string | undefined>;
  refreshThreadRef: MutableRefObject<(id: string, signal?: AbortSignal) => Promise<unknown>>;
};

export function useRoutines({ panel, setBots, activeBotId, refreshThreadRef }: UseRoutinesArgs) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesBotId, setRoutinesBotId] = useState<string | null>(null);
  const [routineDraft, setRoutineDraft] = useState<RoutineDraftState>(emptyRoutineDraft());
  const [routineWebhookSecret, setRoutineWebhookSecret] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteRoutineTarget, setDeleteRoutineTarget] = useState<Routine | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [runningRoutine, setRunningRoutine] = useState(false);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const routineSavePending = useRef(false);
  const webhookSecretProvisionRef = useRef(new Map<string, Promise<string>>());
  const routineSaveRequest = useRef(0);
  const routineRunPending = useRef(false);

  const ensureWebhookSecret = (botId: string) =>
    sharedInflight(webhookSecretProvisionRef.current, botId, async () => {
      const result = await rpc.bots.rotateWebhookSecret({ botId });
      setRoutineWebhookSecret(result.secret);
      setBots((current) =>
        current.map((bot) => (bot.id === botId ? { ...bot, webhookConfigured: true } : bot)),
      );
      return result.secret;
    });

  useEffect(() => {
    if (panel !== "routine") {
      routineSaveRequest.current += 1;
      setRoutineError(null);
    }
  }, [panel]);

  async function saveRoutine(active: Bot) {
    if (routineSavePending.current) return;
    const targetBotId = active.id;
    const targetRoutine = editingRoutine;
    if (targetRoutine && targetRoutine.botId !== targetBotId) return;
    if (
      !routineDraft.schedules.length &&
      !routineDraft.webhookEnabled &&
      !routineDraft.githubEnabled &&
      !routineDraft.messageProvider
    ) {
      setRoutineError(t`Add a schedule, webhook, GitHub, or message trigger`);
      return;
    }
    const saveRequest = ++routineSaveRequest.current;
    routineSavePending.current = true;
    setSavingRoutine(true);
    setRoutineError(null);
    try {
      if (
        (routineDraft.webhookEnabled || routineDraft.githubEnabled) &&
        !active.webhookConfigured &&
        !routineWebhookSecret
      ) {
        await ensureWebhookSecret(targetBotId);
      }
      const crons = routineDraft.schedules.map(cronFromPreset);
      let saved: Routine;
      if (targetRoutine) {
        const armOneShot = routineNeedsOneShotArm(targetRoutine, crons);
        let runAt: string | undefined;
        if (armOneShot) {
          if (!routineDraft.runAtLocal) {
            setRoutineError(t`Add a run time for this one-shot.`);
            return;
          }
          const parsed = new Date(routineDraft.runAtLocal);
          if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
            setRoutineError(t`Run time must be in the future.`);
            return;
          }
          runAt = parsed.toISOString();
        }
        saved = await rpc.routines.update({
          routineId: targetRoutine.id,
          name: routineDraft.name || t`Routine`,
          prompt: routineDraft.prompt || t`Check in.`,
          crons,
          active: armOneShot ? true : routineDraft.active,
          webhookEnabled: routineDraft.webhookEnabled,
          githubEnabled: routineDraft.githubEnabled,
          messageProvider: routineDraft.messageProvider,
          modelProvider: routineDraft.modelProvider,
          modelId: routineDraft.modelId,
          thinkingLevel: routineDraft.thinkingLevel,
          ...(runAt ? { runAt } : {}),
        });
      } else {
        saved = await rpc.routines.create({
          botId: targetBotId,
          name: routineDraft.name || t`Routine`,
          prompt: routineDraft.prompt || t`Check in.`,
          crons,
          timezone: localTimezone(),
          active: routineDraft.active,
          notify: true,
          webhookEnabled: routineDraft.webhookEnabled,
          githubEnabled: routineDraft.githubEnabled,
          messageProvider: routineDraft.messageProvider,
          modelId: routineDraft.modelId,
          modelProvider: routineDraft.modelProvider,
          thinkingLevel: routineDraft.thinkingLevel,
        });
      }
      if (routineSaveRequest.current === saveRequest && activeBotId.current === targetBotId) {
        setEditingRoutine(saved);
        setRoutineDraft(draftFromRoutine(saved));
      }
    } catch (error) {
      if (routineSaveRequest.current !== saveRequest || activeBotId.current !== targetBotId) {
        return;
      }
      setRoutineError(error instanceof Error ? error.message : t`Could not save routine`);
      return;
    } finally {
      routineSavePending.current = false;
      setSavingRoutine(false);
    }
    if (routineSaveRequest.current !== saveRequest || activeBotId.current !== targetBotId) {
      return;
    }
    await refreshThreadRef.current(targetBotId).catch(() => undefined);
  }

  async function testRunRoutine(active: Bot) {
    if (routineRunPending.current) return;
    const targetBotId = active.id;
    const targetRoutine = editingRoutine;
    if (!targetRoutine) return;
    routineRunPending.current = true;
    setRunningRoutine(true);
    setRoutineError(null);
    try {
      await rpc.routines.testRun({ routineId: targetRoutine.id });
      await refreshThreadRef.current(targetBotId);
    } catch (error) {
      if (activeBotId.current === targetBotId) {
        setRoutineError(error instanceof Error ? error.message : t`Could not run routine`);
      }
    } finally {
      routineRunPending.current = false;
      setRunningRoutine(false);
    }
  }

  return {
    routines,
    setRoutines,
    routinesBotId,
    setRoutinesBotId,
    routineDraft,
    setRoutineDraft,
    routineWebhookSecret,
    setRoutineWebhookSecret,
    editingRoutine,
    setEditingRoutine,
    deleteRoutineTarget,
    setDeleteRoutineTarget,
    savingRoutine,
    runningRoutine,
    routineError,
    setRoutineError,
    ensureWebhookSecret,
    saveRoutine,
    testRunRoutine,
  };
}
