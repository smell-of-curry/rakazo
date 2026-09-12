import { i18n } from "@lingui/core";
import type { ComputerStatus } from "@rakazo/contracts";
import { Monitor } from "lucide-react";
import type { ReactNode } from "react";
import {
  type ComputerStatusChip,
  type ComputerStatusChipKind,
  novncEmbedSocketPath,
} from "../../lib/computer-screen";

export function embeddableScreenUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    const page = new URL(window.location.href);
    const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    const pagePort = page.port || (page.protocol === "https:" ? "443" : "80");
    if (local && parsed.port && parsed.port !== pagePort) {
      return null;
    }
    return novncEmbedSocketPath(parsed.toString());
  } catch {
    return url;
  }
}

function screenIframeSandbox(url: string | null) {
  if (!url) return undefined;
  try {
    return new URL(url, window.location.href).pathname.startsWith("/novnc/")
      ? "allow-scripts allow-pointer-lock"
      : undefined;
  } catch {
    return undefined;
  }
}

export function ComputerScreenFrame({
  url,
  title,
  interactive = false,
  children,
}: {
  url: string;
  title: string;
  interactive?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative h-full w-full">
      <iframe
        title={title}
        src={url}
        sandbox={screenIframeSandbox(url)}
        className="h-full w-full border-0 bg-muted"
        allow={
          interactive
            ? "clipboard-read; clipboard-write; fullscreen"
            : "clipboard-read; clipboard-write"
        }
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      />
      {children}
    </div>
  );
}

export function computerStatusChipLabel(kind: ComputerStatusChipKind): string {
  switch (kind) {
    case "live":
      return i18n._({ id: "Live", message: "Live" });
    case "sleeping":
      return i18n._({ id: "Sleeping", message: "Sleeping" });
    case "setting_up":
      return i18n._({ id: "Setting up…", message: "Setting up…" });
    case "needs_you":
      return i18n._({ id: "Needs you", message: "Needs you" });
    case "off":
      return i18n._({ id: "Off", message: "Off" });
  }
}

export function ComputerStatusChipView({ chip }: { chip: ComputerStatusChip }) {
  return (
    <span
      data-testid="computer-status-chip"
      className={`inline-flex rounded-full px-2 py-0.5 text-micro ${
        chip.tone === "warning" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
      }`}
    >
      {computerStatusChipLabel(chip.kind)}
    </span>
  );
}

export function ComputerScreenPlaceholder({ chip }: { chip: ComputerStatusChip }) {
  return (
    <div className="grid h-full place-items-center gap-2 text-muted-foreground">
      <Monitor size={20} strokeWidth={1.6} aria-hidden />
      <ComputerStatusChipView chip={chip} />
    </div>
  );
}

export function computerLabel(mode: ComputerStatus["mode"] | undefined, botName: string) {
  return mode === "dedicated"
    ? i18n._({
        id: "{botName}’s computer",
        message: "{botName}’s computer",
        values: { botName },
      })
    : i18n._({ id: "Team computer", message: "Team computer" });
}
