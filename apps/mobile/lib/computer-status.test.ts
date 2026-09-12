import { describe, expect, it } from "vitest";
import { computerStatusChip } from "./computer-status";

describe("computerStatusChip", () => {
  it("maps the computer-screen table", () => {
    expect(computerStatusChip({ takeoverRequested: true, state: "running" })).toBe("Needs you");
    expect(computerStatusChip({ runStatus: "waiting_takeover", state: "running" })).toBe(
      "Needs you",
    );
    expect(computerStatusChip({ state: "booting" })).toBe("Setting up…");
    expect(computerStatusChip({ state: "running", booting: true })).toBe("Setting up…");
    expect(computerStatusChip({ state: "running" })).toBe("Live");
    expect(computerStatusChip({ state: "suspended" })).toBe("Sleeping");
    expect(computerStatusChip({ state: "stopped" })).toBe("Off");
    expect(computerStatusChip({ state: "error" })).toBe("Off");
    expect(computerStatusChip({})).toBe("Off");
  });

  it("does not treat waiting_input as a computer handoff", () => {
    expect(computerStatusChip({ state: "running", runStatus: "waiting_input" })).toBe("Live");
  });
});
