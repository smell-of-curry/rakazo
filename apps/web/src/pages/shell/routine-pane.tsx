import type { Bot, Routine } from "@rakazo/contracts";
import type { Dispatch, SetStateAction } from "react";
import { localTimezone } from "../../lib/local-timezone";
import { type RoutineDraftState, RoutineEditor } from "../RoutineEditor";
import type { Panel } from "./types";

export function RoutinePane({
  active,
  routineDraft,
  setRoutineDraft,
  editingRoutine,
  routineWebhookSecret,
  messagingProviders,
  savingRoutine,
  runningRoutine,
  routineError,
  setPanel,
  ensureWebhookSecret,
  saveRoutine,
  testRunRoutine,
  setDeleteRoutineTarget,
}: {
  active: Bot;
  routineDraft: RoutineDraftState;
  setRoutineDraft: Dispatch<SetStateAction<RoutineDraftState>>;
  editingRoutine: Routine | null;
  routineWebhookSecret: string | null;
  messagingProviders: string[];
  savingRoutine: boolean;
  runningRoutine: boolean;
  routineError: string | null;
  setPanel: Dispatch<SetStateAction<Panel>>;
  ensureWebhookSecret: (botId: string) => Promise<unknown>;
  saveRoutine: (bot: Bot) => Promise<unknown>;
  testRunRoutine: (bot: Bot) => Promise<unknown>;
  setDeleteRoutineTarget: Dispatch<SetStateAction<Routine | null>>;
}) {
  return (
    <RoutineEditor
      draft={routineDraft}
      onChange={setRoutineDraft}
      editing={editingRoutine}
      timezone={editingRoutine?.timezone ?? localTimezone()}
      webhook={{
        path:
          typeof window !== "undefined"
            ? `${window.location.origin}/api/v1/bots/${active.id}/webhook`
            : `/api/v1/bots/${active.id}/webhook`,
        secret: routineWebhookSecret,
        configured: active.webhookConfigured || Boolean(routineWebhookSecret),
      }}
      githubPath={
        typeof window !== "undefined"
          ? `${window.location.origin}/api/v1/bots/${active.id}/github`
          : `/api/v1/bots/${active.id}/github`
      }
      messageProviders={messagingProviders}
      saving={savingRoutine}
      running={runningRoutine}
      error={routineError}
      onBack={() => setPanel("computer")}
      onClose={() => setPanel(null)}
      onEnsureWebhook={async () => {
        await ensureWebhookSecret(active.id);
      }}
      onSave={async () => {
        await saveRoutine(active);
      }}
      onTestRun={async () => {
        await testRunRoutine(active);
      }}
      onDelete={() => {
        if (editingRoutine) {
          setDeleteRoutineTarget(editingRoutine);
          return;
        }
        setPanel("computer");
      }}
    />
  );
}
