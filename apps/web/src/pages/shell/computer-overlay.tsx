import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Bot,
  ComputerReleaseReason,
  ComputerStatus,
  TaughtSkill,
  ThreadSnapshot,
} from "@rakazo/contracts";
import { BotAvatar, Button } from "@rakazo/ui-web";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { AskBlock } from "../../components/AskCard";
import { ComputerMaintenanceActions } from "../../components/ComputerMaintenanceActions";
import { TeachCaptureOverlay } from "../../components/teach/TeachCaptureOverlay";
import { TeachComputerOverlayControl } from "../../components/teach/TeachComputerOverlay";
import { TeachRecordingChrome, TeachStopButton } from "../../components/teach/TeachRecordingChrome";
import { botImageSrc } from "../../lib/bot-image-src";
import { computerCanShowScreen } from "../../lib/thread-events";
import {
  computerLabel,
  computerPlaceholder,
  DesktopKindEmptyState,
  screenIframeSandbox,
} from "./computer-screen";

export function ComputerReleaseActions({
  takeoverRequested,
  onRelease,
}: {
  takeoverRequested: boolean;
  onRelease: (reason?: ComputerReleaseReason) => Promise<void>;
}) {
  if (!takeoverRequested) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => void onRelease()}>
        <Trans>Release</Trans>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void onRelease("skipped")}>
        <Trans>Skip</Trans>
      </Button>
      <Button type="button" size="sm" onClick={() => void onRelease("done")}>
        <Trans>I’m done</Trans>
      </Button>
    </div>
  );
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
  if (booting) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[22px] bg-background/95">
        <div className="text-[19px] font-medium text-foreground">
          <Trans>Booting up {active?.name}’s computer</Trans>
        </div>
        <div className="h-[5px] w-[min(420px,70%)] overflow-hidden rounded-full bg-accent">
          <div className="h-full w-2/3 rounded-full bg-primary" />
        </div>
      </div>
    );
  }
  if (!computerOpen || !active) return null;
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
          className="flex items-center justify-between gap-4 border-b border-sidebar-border px-[18px] py-3.5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BotAvatar
              color={active.color}
              shape={active.avatarShape}
              identity={active.id}
              size={28}
              imageSrc={botImageSrc(active)}
            />
            {recordingSkill ? (
              <TeachRecordingChrome
                recording={recordingSkill}
                busy={teachBusy}
                onStop={stopTeaching}
                variant="overlay"
              />
            ) : (
              <span className="truncate text-[15.5px] font-medium text-foreground" dir="auto">
                {computerLabel(computer?.mode, active.name)}
              </span>
            )}
            {!recordingSkill && hasControl ? (
              computer?.takeoverRequested ? (
                <span className="rounded-full bg-warning/15 px-[11px] py-1 text-[13px] text-warning">
                  <Trans>Needs you</Trans>
                </span>
              ) : (
                <span className="rounded-full bg-success/15 px-[11px] py-1 text-[13px] text-success">
                  <Trans>You have control</Trans>
                </span>
              )
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {composerRunning ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t`Stop`}
                data-testid="computer-overlay-stop"
                onClick={() => void stopRun()}
                disabled={sending}
              >
                <Trans>Stop</Trans>
              </Button>
            ) : null}
            {recordingSkill ? (
              <TeachStopButton busy={teachBusy} onStop={stopTeaching} />
            ) : hasControl ? (
              <ComputerReleaseActions
                takeoverRequested={Boolean(computer?.takeoverRequested)}
                onRelease={releaseComputer}
              />
            ) : null}
            {active && !recordingSkill ? (
              <TeachComputerOverlayControl
                key={active.id}
                botId={active.id}
                computer={computer}
                busy={teachBusy}
                onRefresh={refreshActiveTeaching}
              />
            ) : null}
            {active && !recordingSkill ? (
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
              aria-label={t`Close computer`}
              onClick={() => setComputerOpen(false)}
            >
              <X size={16} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
        {sendError && !needsComputer && !dockedAsk ? (
          <div
            role="alert"
            className="border-b border-destructive/40 bg-destructive/10 px-[18px] py-2 text-[13px] text-destructive"
          >
            {sendError}
          </div>
        ) : null}
        <div className="relative min-h-0 flex-1 bg-background">
          {computer?.kind === "desktop" ? (
            <DesktopKindEmptyState className="grid h-full place-items-center px-8 text-center text-sm text-muted-foreground/80" />
          ) : computerCanShowScreen(computer?.state, embeddedScreenUrl) && !computerScreenError ? (
            <>
              <iframe
                title={t`Bot screen`}
                src={embeddedScreenUrl ?? undefined}
                sandbox={screenIframeSandbox(embeddedScreenUrl)}
                className="h-full w-full border-0 bg-black"
                allow="clipboard-read; clipboard-write; fullscreen"
                style={{
                  pointerEvents: recordingSkill || !hasControl ? "none" : "auto",
                }}
              />
              {active ? (
                <TeachCaptureOverlay
                  botId={active.id}
                  skill={recordingSkill}
                  enabled={Boolean(recordingSkill)}
                  screenWidth={computer?.screenWidth}
                  screenHeight={computer?.screenHeight}
                />
              ) : null}
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground/80">
              {computerScreenError ??
                computerPlaceholder(
                  computer?.state,
                  booting,
                  computerLabel(computer?.mode, active.name),
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
