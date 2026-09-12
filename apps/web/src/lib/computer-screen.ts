import type { ComputerStatus } from "@rakazo/contracts";

export type ComputerStatusChipKind = "live" | "sleeping" | "setting_up" | "needs_you" | "off";

export type ComputerStatusChip = {
  kind: ComputerStatusChipKind;
  tone: "muted" | "warning";
};

/** Pane/overlay chip. Never return the raw computer or run status string. */
export function computerStatusChip(
  computer:
    | Pick<ComputerStatus, "state" | "mode" | "screenAvailable" | "takeoverRequested">
    | null
    | undefined,
  runStatus?: string | null,
): ComputerStatusChip {
  if (computer?.takeoverRequested || runStatus === "waiting_takeover") {
    return { kind: "needs_you", tone: "warning" };
  }
  if (!computer) return { kind: "off", tone: "muted" };
  if (computer.state === "booting") return { kind: "setting_up", tone: "muted" };
  if (computer.state === "running" && computer.screenAvailable) {
    return { kind: "live", tone: "muted" };
  }
  if (computer.state === "running") return { kind: "setting_up", tone: "muted" };
  if (computer.state === "suspended") return { kind: "sleeping", tone: "muted" };
  return { kind: "off", tone: "muted" };
}

/** embed.html joins `path` onto the capability directory. A host-root path doubles. */
export function novncEmbedSocketPath(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname.includes("/novnc/session/")) {
    parsed.searchParams.set("path", "websockify");
  }
  return parsed.toString();
}

export interface ComputerScreenResult {
  url: string | null;
  error: string | null;
}

/** Only the latest request for the visible computer may replace its screen or error. */
export async function loadComputerScreen(options: {
  load: () => Promise<{ url: string | null }>;
  isCurrent: () => boolean;
  commit: (result: ComputerScreenResult) => void;
  fallbackError: string;
}): Promise<string | null> {
  let result: ComputerScreenResult;
  try {
    const screen = await options.load();
    result = { url: screen.url, error: null };
  } catch (error) {
    result = {
      url: null,
      error: error instanceof Error && error.message ? error.message : options.fallbackError,
    };
  }
  if (!options.isCurrent()) return null;
  options.commit(result);
  return result.url;
}
