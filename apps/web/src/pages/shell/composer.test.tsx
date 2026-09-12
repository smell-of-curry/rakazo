import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""),
        "",
      ),
  }),
}));

import { composerRightSlot } from "./composer";

describe("composer right slot", () => {
  it("shows mic when empty and voice is available", () => {
    expect(composerRightSlot({ running: false, canSend: false, voiceAvailable: true })).toBe("mic");
  });

  it("shows send when there is text or attachments", () => {
    expect(composerRightSlot({ running: false, canSend: true, voiceAvailable: true })).toBe("send");
  });

  it("shows only stop while a run is active", () => {
    expect(composerRightSlot({ running: true, canSend: true, voiceAvailable: true })).toBe("stop");
    expect(composerRightSlot({ running: true, canSend: false, voiceAvailable: true })).toBe("stop");
  });

  it("hides the slot when empty and voice is unavailable", () => {
    expect(composerRightSlot({ running: false, canSend: false, voiceAvailable: false })).toBeNull();
  });
});
