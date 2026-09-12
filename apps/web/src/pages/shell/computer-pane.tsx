import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Bot, ComputerStatus, Me, Routine, ThreadSnapshot } from "@rakazo/contracts";
import { isActive } from "@rakazo/core";
import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  ComputersUnavailableHint,
  computersAreUnavailable,
} from "../../components/ComputersUnavailableHint";
import { computerCanShowScreen } from "../../lib/thread-events";
import {
  draftFromRoutine,
  emptyRoutineDraft,
  type RoutineDraftState,
  RoutineListHeader,
  RoutineListRow,
} from "../RoutineEditor";
import {
  computerLabel,
  computerPlaceholder,
  DesktopKindEmptyState,
  screenIframeSandbox,
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
  bootstrapMe,
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
  return (
    <div>
      <div
        data-testid="computer-preview"
        className="group relative aspect-[16/10] overflow-hidden rounded-[14px] bg-background"
      >
        {computerOpen ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground/80">
            <Trans>Open in full window</Trans>
          </div>
        ) : computer?.kind === "desktop" ? (
          <DesktopKindEmptyState className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80" />
        ) : computerCanShowScreen(computer?.state, embeddedScreenUrl) && !computerScreenError ? (
          <iframe
            title={t`Bot screen preview`}
            src={embeddedScreenUrl ?? undefined}
            sandbox={screenIframeSandbox(embeddedScreenUrl)}
            className="h-full w-full border-0 bg-black"
            allow="clipboard-read; clipboard-write"
            style={{ pointerEvents: "none" }}
          />
        ) : (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80">
            {computerScreenError ??
              (computersAreUnavailable(bootstrapMe?.sandboxProvider) ? (
                <ComputersUnavailableHint />
              ) : (
                computerPlaceholder(
                  computer?.state,
                  booting,
                  computerLabel(computer?.mode, active.name),
                )
              ))}
          </div>
        )}
        {!computerScreenError ? (
          <button
            type="button"
            data-testid="computer-preview-open"
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-overlay/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={t`Open`}
            onClick={() => void openComputer()}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-overlay px-3.5 py-2 text-[14px] text-foreground shadow-md">
              <Maximize2 size={15} strokeWidth={1.9} aria-hidden />
              <Trans>Open</Trans>
            </span>
          </button>
        ) : null}
      </div>
      <p className="mt-2 truncate text-[13.5px] text-muted-foreground" dir="auto">
        {t`${active.name}'s screen`}
      </p>
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
