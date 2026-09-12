import { i18n } from "@lingui/core";
import type { Routine } from "@rakazo/contracts";
import { describeRoutineSchedule } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { Clock, Pause, Plus } from "lucide-react";

export function routineTriggerSummary(routine: Routine): string {
  return describeRoutineSchedule(routine);
}

export function RoutineListHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-6 mb-2 flex h-8 items-center justify-between gap-3">
      <div className="text-title font-semibold text-foreground">
        {i18n._({ id: "Routines", message: "Routines" })}
      </div>
      <Button
        variant="secondary"
        size="icon-sm"
        data-testid="routine-create-button"
        aria-label={i18n._({ id: "Create Routine", message: "Create Routine" })}
        title={i18n._({ id: "Create Routine", message: "Create Routine" })}
        onClick={onCreate}
      >
        <Plus strokeWidth={1.9} />
      </Button>
    </div>
  );
}

export function RoutineListRow({
  routine,
  running,
  onOpen,
  onStop,
}: {
  routine: Routine;
  running: boolean;
  onOpen: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex h-12 w-full items-center gap-2 rounded-lg px-2 hover:bg-accent">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="grid size-4 place-items-center">
          {routine.active ? (
            <Clock size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
          ) : (
            <Pause size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-foreground" dir="auto">
            {routine.name}
          </span>
          <span className="block truncate text-small text-muted-foreground">
            {routineTriggerSummary(routine)}
          </span>
        </span>
      </button>
      {running ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-micro text-muted-foreground">
            {i18n._({ id: "Running", message: "Running" })}
          </span>
          <Button size="xs" variant="outline" onClick={onStop}>
            {i18n._({ id: "Stop", message: "Stop" })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
