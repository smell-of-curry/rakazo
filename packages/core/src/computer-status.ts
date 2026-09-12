export type ComputerStatusChipKind = "live" | "sleeping" | "setting_up" | "needs_you" | "off";

export type ComputerStatusChip = {
  kind: ComputerStatusChipKind;
  tone: "muted" | "warning";
};

export type ComputerStatusChipSource = {
  state?: "stopped" | "booting" | "running" | "suspended" | "error";
  screenAvailable?: boolean;
  takeoverRequested?: boolean;
};

/** Pane/overlay chip. Never return the raw computer or run status string. */
export function computerStatusChip(
  computer: ComputerStatusChipSource | null | undefined,
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
