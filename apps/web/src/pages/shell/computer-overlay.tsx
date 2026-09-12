import { i18n } from "@lingui/core";
import type {
  Bot,
  ComputerReleaseReason,
  ComputerStatus,
  TaughtSkill,
  ThreadSnapshot,
} from "@rakazo/contracts";
import { computerStatusChip } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { AskBlock } from "../../components/AskCard";
import { ComputerMaintenanceActions } from "../../components/ComputerMaintenanceActions";
import { TeachCaptureOverlay } from "../../components/teach/TeachCaptureOverlay";
import { TeachComputerOverlayControl } from "../../components/teach/TeachComputerOverlay";
import { TeachRecordingChrome, TeachStopButton } from "../../components/teach/TeachRecordingChrome";
import { rpc } from "../../lib/rpc";
import { computerCanShowScreen } from "../../lib/thread-events";
import {
  ComputerScreenFrame,
  ComputerScreenPlaceholder,
  ComputerStatusChipView,
  computerLabel,
} from "./computer-screen";

export function ComputerReleaseActions({
  takeoverRequested,
  hasControl,
  onTakeControl,
  onRelease,
}: {
  takeoverRequested: boolean;
  hasControl: boolean;
  onTakeControl: () => Promise<void>;
  onRelease: (reason?: ComputerReleaseReason) => Promise<void>;
}) {
  if (takeoverRequested && !hasControl) {
    return (
      <Button type="button" size="sm" onClick={() => void onTakeControl()}>
        {i18n._({ id: "Take control", message: "Take control" })}
      </Button>
    );
  }
  if (takeoverRequested && hasControl) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void onRelease("skipped")}>
          {i18n._({ id: "Skip", message: "Skip" })}
        </Button>
        <Button type="button" size="sm" onClick={() => void onRelease("done")}>
          {i18n._({ id: "Done", message: "Done" })}
        </Button>
      </div>
    );
  }
  if (hasControl) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => void onRelease()}>
        {i18n._({ id: "Release", message: "Release" })}
      </Button>
    );
  }
  return null;
}

export type ComputerOverlayProps = {
  booting: boolean;
  active: Bot | undefined;
  computerOpen: boolean;
  computerViewport: { height: number; offsetTop: number } | null;
  computer: ComputerStatus | null;
  embeddedScreenUrl: string | null;
  computerScreenError: ReactNode;
  recordingSkill: TaughtSkill | null;
  teachBusy: boolean;
  stopTeaching: () => void | Promise<void>;
  hasControl: boolean;
  releaseComputer: (reason?: ComputerReleaseReason) => Promise<void>;
  composerRunning: boolean;
  sending: boolean;
  stopRun: () => void | Promise<void>;
  refreshActiveTeaching: () => Promise<void>;
  refreshThread: (id: string) => Promise<ThreadSnapshot | null | undefined>;
  sendError: string | null;
  needsComputer: boolean;
  dockedAsk: AskBlock | undefined;
  setComputerOpen: (open: boolean) => void;
};

export function ComputerOverlay({
  booting,
  active,
  computerOpen,
  computerViewport,
  computer,
  embeddedScreenUrl,
  computerScreenError,
  recordingSkill,
  teachBusy,
  stopTeaching,
  hasControl,
  releaseComputer,
  composerRunning,
  sending,
  stopRun,
  refreshActiveTeaching,
  refreshThread,
  sendError,
  needsComputer,
  dockedAsk,
  setComputerOpen,
}: ComputerOverlayProps) {
  if (!computerOpen || !active) return null;
  const bot = active;
  const chip = computerStatusChip(
    computer,
    computer?.takeoverRequested ? "waiting_takeover" : null,
  );
  const showScreen =
    computerCanShowScreen(computer?.state, embeddedScreenUrl) && !computerScreenError;
  const takeoverRequested = Boolean(computer?.takeoverRequested);

  async function takeControl() {
    try {
      await rpc.computer.takeover({ botId: bot.id });
      await refreshThread(bot.id);
    } catch {
      // refreshThread still picks up the live computer/run state
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-background">
      <div
        data-testid="computer-viewport"
        className="fixed inset-x-0 top-0 flex flex-col bg-background"
        style={{
          height: computerViewport ? `${computerViewport.height}px` : "100dvh",
          top: computerViewport ? `${computerViewport.offsetTop}px` : undefined,
        }}
      >
        <div
          data-testid="computer-chrome"
          className="flex h-11 items-center justify-between gap-3 border-b px-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {recordingSkill ? (
              <TeachRecordingChrome
                recording={recordingSkill}
                busy={teachBusy}
                onStop={stopTeaching}
                variant="overlay"
              />
            ) : (
              <div className="min-w-0">
                <div className="truncate text-body font-medium text-foreground" dir="auto">
                  {computerLabel(computer?.mode, active.name)}
                </div>
                <ComputerStatusChipView chip={chip} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {composerRunning ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={i18n._({ id: "Stop", message: "Stop" })}
                data-testid="computer-overlay-stop"
                onClick={() => void stopRun()}
                disabled={sending}
              >
                {i18n._({ id: "Stop", message: "Stop" })}
              </Button>
            ) : null}
            {recordingSkill ? (
              <TeachStopButton busy={teachBusy} onStop={stopTeaching} />
            ) : (
              <ComputerReleaseActions
                takeoverRequested={takeoverRequested}
                hasControl={hasControl}
                onTakeControl={takeControl}
                onRelease={releaseComputer}
              />
            )}
            {!recordingSkill ? (
              <TeachComputerOverlayControl
                key={active.id}
                botId={active.id}
                computer={computer}
                busy={teachBusy}
                onRefresh={refreshActiveTeaching}
              />
            ) : null}
            {!recordingSkill ? (
              <ComputerMaintenanceActions
                botId={active.id}
                computer={computer}
                onChanged={async () => {
                  await refreshThread(active.id);
                }}
              />
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={i18n._({ id: "Close computer", message: "Close computer" })}
              onClick={() => setComputerOpen(false)}
            >
              <X size={16} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
        {sendError && !needsComputer && !dockedAsk ? (
          <div
            role="alert"
            className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-body text-destructive"
          >
            {sendError}
          </div>
        ) : null}
        <div className="relative min-h-0 flex-1 bg-muted">
          {showScreen && embeddedScreenUrl ? (
            <ComputerScreenFrame
              url={embeddedScreenUrl}
              title={i18n._({ id: "Bot screen", message: "Bot screen" })}
              interactive={!recordingSkill && hasControl}
            >
              <TeachCaptureOverlay
                botId={active.id}
                skill={recordingSkill}
                enabled={Boolean(recordingSkill)}
                screenWidth={computer?.screenWidth}
                screenHeight={computer?.screenHeight}
              />
            </ComputerScreenFrame>
          ) : (
            (computerScreenError ?? (
              <ComputerScreenPlaceholder
                chip={booting ? { kind: "setting_up", tone: "muted" } : chip}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
