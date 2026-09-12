/**
 * Chip labels for the computer header.
 * Keep this table identical to `apps/web/src/pages/shell/computer-screen.ts`
 * `computerStatusChip` (web worker owns that file; this copy is the mobile
 * source of truth until both land in the same PR).
 *
 * | input                                           | chip          |
 * |-------------------------------------------------|---------------|
 * | takeoverRequested or run `waiting_takeover`     | Needs you     |
 * | state `booting` or booting overlay              | Setting up…   |
 * | state `running`                                 | Live          |
 * | state `suspended`                               | Sleeping      |
 * | state `stopped` / `error` / unset               | Off           |
 */
export type ComputerStatusChip = "Live" | "Sleeping" | "Setting up…" | "Needs you" | "Off";

export function computerStatusChip(input: {
  state?: "stopped" | "booting" | "running" | "suspended" | "error";
  takeoverRequested?: boolean;
  booting?: boolean;
  runStatus?: string | null;
}): ComputerStatusChip {
  if (input.takeoverRequested || input.runStatus === "waiting_takeover") return "Needs you";
  if (input.state === "booting" || input.booting) return "Setting up…";
  if (input.state === "running") return "Live";
  if (input.state === "suspended") return "Sleeping";
  return "Off";
}
