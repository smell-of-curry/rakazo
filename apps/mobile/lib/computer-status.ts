import { computerStatusChipLabel, computerStatusChip as mapComputerStatusChip } from "@rakazo/core";

/**
 * Chip labels for the computer header.
 * Decision table lives in `@rakazo/core` `computerStatusChip`.
 */
export type ComputerStatusChip = "Live" | "Sleeping" | "Setting up…" | "Needs you" | "Off";

export function computerStatusChip(input: {
  state?: "stopped" | "booting" | "running" | "suspended" | "error";
  takeoverRequested?: boolean;
  booting?: boolean;
  runStatus?: string | null;
}): ComputerStatusChip {
  const mapped = mapComputerStatusChip(
    {
      state: input.booting ? "booting" : input.state,
      screenAvailable: input.state === "running" && !input.booting,
      takeoverRequested: input.takeoverRequested,
    },
    input.runStatus,
  );
  return computerStatusChipLabel(mapped.kind) as ComputerStatusChip;
}
