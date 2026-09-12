import { i18n } from "@lingui/core";
import type { Bot, ComputerStatus, Me, Routine, ThreadSnapshot } from "@rakazo/contracts";
import { computerStatusChip, isActive } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { Settings, X } from "lucide-react";
import type { ReactNode } from "react";
import { computerCanShowScreen } from "../../lib/thread-events";
import { draftFromRoutine, emptyRoutineDraft, type RoutineDraftState } from "../routine-draft";
import { RoutineListHeader, RoutineListRow } from "../routine-list";
import {
  ComputerScreenFrame,
  ComputerScreenPlaceholder,
  ComputerStatusChipView,
  computerLabel,
} from "./computer-screen";
import type { Panel } from "./types";

export type ComputerPaneProps = {
  active: Bot;
  computerOpen: boolean;
  computer: ComputerStatus | null;
  booting: boolean;
  embeddedScreenUrl: string | null;
  computerScreenError: ReactNode;
  bootstrapMe: Me | null | undefined;
  openComputer: () => void | Promise<void>;
  setRoutineDraft: (draft: RoutineDraftState) => void;
  setRoutineWebhookSecret: (secret: string | null) => void;
  setEditingRoutine: (routine: Routine | null) => void;
  setRoutineError: (error: string | null) => void;
  setPanel: (panel: Panel) => void;
  activeRoutines: Routine[];
  snapshot: ThreadSnapshot | null;
  stopRun: () => void | Promise<void>;
};

export function ComputerPane({
  active,
  computerOpen,
  computer,
  booting,
  embeddedScreenUrl,
  computerScreenError,
  openComputer,
  setRoutineDraft,
  setRoutineWebhookSecret,
  setEditingRoutine,
  setRoutineError,
  setPanel,
  activeRoutines,
  snapshot,
  stopRun,
}: ComputerPaneProps) {
  const chip = (() => {
    const mapped = computerStatusChip(computer, snapshot?.run?.status);
    if (booting && mapped.kind === "off")
      return { kind: "setting_up" as const, tone: "muted" as const };
    return mapped;
  })();
  const showScreen =
    computerCanShowScreen(computer?.state, embeddedScreenUrl) && !computerScreenError;
  return (
    <div>
      <div className="flex h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-body font-medium text-foreground" dir="auto">
            {computerLabel(computer?.mode ?? active.computerMode, active.name)}
          </div>
          <ComputerStatusChipView chip={chip} />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={i18n._({ id: "Show settings", message: "Show settings" })}
            onClick={() => setPanel("settings")}
            className="text-muted-foreground"
          >
            <Settings size={16} strokeWidth={1.7} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={i18n._({ id: "Close panel", message: "Close panel" })}
            onClick={() => setPanel(null)}
          >
            <X size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </div>
      <div
        data-testid="computer-preview"
        className="group relative mt-3 aspect-[16/10] overflow-hidden rounded-lg border bg-muted"
      >
        {computerOpen ? (
          <ComputerScreenPlaceholder chip={chip} />
        ) : showScreen && embeddedScreenUrl ? (
          <ComputerScreenFrame
            url={embeddedScreenUrl}
            title={i18n._({ id: "Bot screen preview", message: "Bot screen preview" })}
          />
        ) : (
          (computerScreenError ?? <ComputerScreenPlaceholder chip={chip} />)
        )}
        {!computerScreenError ? (
          <button
            type="button"
            data-testid="computer-preview-open"
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-overlay/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={i18n._({ id: "Open", message: "Open" })}
            onClick={() => void openComputer()}
          >
            <span className="inline-flex items-center rounded-full bg-overlay px-3.5 py-2 text-body text-foreground shadow-md">
              <span>{i18n._({ id: "Open", message: "Open" })}</span>
            </span>
          </button>
        ) : null}
      </div>
      <RoutineListHeader
        onCreate={() => {
          setRoutineDraft(emptyRoutineDraft());
          setRoutineWebhookSecret(null);
          setEditingRoutine(null);
          setRoutineError(null);
          setPanel("routine");
        }}
      />
      {activeRoutines.map((routine) => {
        const routineRunning =
          snapshot?.run?.routineId === routine.id && isActive(snapshot.run.status);
        return (
          <RoutineListRow
            key={routine.id}
            routine={routine}
            running={routineRunning}
            onOpen={() => {
              setRoutineDraft(draftFromRoutine(routine));
              setRoutineWebhookSecret(null);
              setEditingRoutine(routine);
              setRoutineError(null);
              setPanel("routine");
            }}
            onStop={() => void stopRun()}
          />
        );
      })}
    </div>
  );
}
