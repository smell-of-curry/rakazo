import { describe, expect, it } from "vitest";
import {
  COMPUTER_STATUS_CHIP_LABELS,
  computerStatusChip,
  computerStatusChipLabel,
} from "./computer-status.js";

const computer = {
  state: "stopped" as const,
  screenAvailable: false,
  takeoverRequested: false,
};

describe("computerStatusChip", () => {
  it("maps Live when the desktop is running with a screen", () => {
    expect(
      computerStatusChip({ ...computer, state: "running", screenAvailable: true }, "running"),
    ).toEqual({ kind: "live", tone: "muted" });
  });

  it("maps Setting up while booting or running without a screen", () => {
    expect(computerStatusChip({ ...computer, state: "booting" }, null)).toEqual({
      kind: "setting_up",
      tone: "muted",
    });
    expect(computerStatusChip({ ...computer, state: "running" }, "running")).toEqual({
      kind: "setting_up",
      tone: "muted",
    });
  });

  it("maps Sleeping, Off, and Needs you", () => {
    expect(computerStatusChip({ ...computer, state: "suspended" }, null)).toEqual({
      kind: "sleeping",
      tone: "muted",
    });
    expect(computerStatusChip({ ...computer, state: "stopped" }, null)).toEqual({
      kind: "off",
      tone: "muted",
    });
    expect(computerStatusChip({ ...computer, state: "error" }, "failed")).toEqual({
      kind: "off",
      tone: "muted",
    });
    expect(computerStatusChip(null, null)).toEqual({ kind: "off", tone: "muted" });
    expect(
      computerStatusChip(
        { ...computer, state: "running", screenAvailable: true },
        "waiting_takeover",
      ),
    ).toEqual({ kind: "needs_you", tone: "warning" });
    expect(
      computerStatusChip(
        { ...computer, state: "running", screenAvailable: true, takeoverRequested: true },
        "running",
      ),
    ).toEqual({ kind: "needs_you", tone: "warning" });
  });

  it("does not treat waiting_input as a computer handoff", () => {
    expect(
      computerStatusChip({ ...computer, state: "running", screenAvailable: true }, "waiting_input"),
    ).toEqual({ kind: "live", tone: "muted" });
  });
});

describe("computerStatusChipLabel", () => {
  it("uses the pane copy table", () => {
    expect(computerStatusChipLabel("live")).toBe("Live");
    expect(computerStatusChipLabel("sleeping")).toBe("Sleeping");
    expect(computerStatusChipLabel("setting_up")).toBe("Setting up…");
    expect(computerStatusChipLabel("needs_you")).toBe("Needs you");
    expect(computerStatusChipLabel("off")).toBe("Off");
    expect(COMPUTER_STATUS_CHIP_LABELS.live).toBe("Live");
  });
});
