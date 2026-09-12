import { describe, expect, it, vi } from "vitest";
import { computerStatusChip, loadComputerScreen, novncEmbedSocketPath } from "./computer-screen";

const computer = {
  state: "stopped" as const,
  mode: "dedicated" as const,
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
});

describe("novncEmbedSocketPath", () => {
  it("keeps the RFB socket under the capability directory", () => {
    const url = novncEmbedSocketPath(
      "https://app.example/novnc/session/control/1.token/embed.html?path=novnc%2Fsession%2Fcontrol%2F1.token%2Fwebsockify&view_only=false",
    );
    expect(new URL(url).searchParams.get("path")).toBe("websockify");
  });

  it("leaves non-proxy screens alone", () => {
    const src = "https://screen.example/vnc.html?path=websockify%3Ftoken%3Dabc";
    expect(novncEmbedSocketPath(src)).toBe(src);
  });
});

describe("computer screen requests", () => {
  it("shows connection failures and lets a successful retry clear them", async () => {
    const commit = vi.fn();
    const options = {
      isCurrent: () => true,
      commit,
      fallbackError: "Could not connect",
    };
    await loadComputerScreen({
      ...options,
      load: async () => {
        throw new Error("Control stream failed to start");
      },
    });
    expect(commit).toHaveBeenLastCalledWith({
      url: null,
      error: "Control stream failed to start",
    });

    await expect(
      loadComputerScreen({
        ...options,
        load: async () => ({ url: "https://screen.example/vnc.html" }),
      }),
    ).resolves.toBe("https://screen.example/vnc.html");
    expect(commit).toHaveBeenLastCalledWith({
      url: "https://screen.example/vnc.html",
      error: null,
    });
  });

  it.each(["success", "failure"])(
    "ignores a stale %s after a newer screen failure",
    async (outcome) => {
      let finish!: (screen: { url: string | null }) => void;
      let fail!: (error: Error) => void;
      const deferred = new Promise<{ url: string | null }>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      let current = 1;
      const commit = vi.fn();
      const stale = loadComputerScreen({
        load: () => deferred,
        isCurrent: () => current === 1,
        commit,
        fallbackError: "Could not connect",
      });
      current = 2;
      await loadComputerScreen({
        load: async () => {
          throw new Error("Latest connection failed");
        },
        isCurrent: () => current === 2,
        commit,
        fallbackError: "Could not connect",
      });
      if (outcome === "success") finish({ url: "https://stale.example/vnc.html" });
      else fail(new Error("Stale connection failed"));
      await expect(stale).resolves.toBeNull();
      expect(commit).toHaveBeenCalledExactlyOnceWith({
        url: null,
        error: "Latest connection failed",
      });
    },
  );

  it("uses the visible fallback for errors without a message", async () => {
    const commit = vi.fn();
    await loadComputerScreen({
      load: async () => Promise.reject(null),
      isCurrent: () => true,
      commit,
      fallbackError: "Could not connect",
    });
    expect(commit).toHaveBeenCalledExactlyOnceWith({ url: null, error: "Could not connect" });
  });
});
