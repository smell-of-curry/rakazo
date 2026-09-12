import { afterEach, describe, expect, it, vi } from "vitest";
import type { RakazoDesktop, RakazoDesktopOAuthCallback } from "./desktop";
import { connectMcpOauth, loopbackMcpRedirectUri } from "./mcp-connect";

const begin = vi.fn();
const complete = vi.fn();

vi.mock("./rpc.js", () => ({
  rpc: {
    mcp: {
      oauth: {
        begin: (...args: unknown[]) => begin(...args),
        complete: (...args: unknown[]) => complete(...args),
      },
    },
  },
}));

function desktopWithAuth(options: {
  open?: (url: string) => Promise<void>;
  onCallback?: (listener: (callback: RakazoDesktopOAuthCallback) => void) => () => void;
}): RakazoDesktop {
  return {
    platform: "darwin",
    window: {
      close: async () => undefined,
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      state: async () => ({ minimized: false, maximized: false, fullScreen: false }),
    },
    update: {
      state: async () => ({
        phase: "unsupported",
        currentVersion: "0.1.0",
        availableVersion: null,
        percent: null,
        message: null,
        checkedAt: null,
      }),
      check: async () => ({
        phase: "unsupported",
        currentVersion: "0.1.0",
        availableVersion: null,
        percent: null,
        message: null,
        checkedAt: null,
      }),
      download: async () => ({
        phase: "unsupported",
        currentVersion: "0.1.0",
        availableVersion: null,
        percent: null,
        message: null,
        checkedAt: null,
      }),
      install: async () => ({
        phase: "unsupported",
        currentVersion: "0.1.0",
        availableVersion: null,
        percent: null,
        message: null,
        checkedAt: null,
      }),
    },
    oauth: {
      open: options.open,
      cancel: async () => undefined,
      onCallback: options.onCallback ?? (() => () => undefined),
    },
  };
}

describe("MCP OAuth connect", () => {
  afterEach(() => {
    begin.mockReset();
    complete.mockReset();
    vi.unstubAllGlobals();
  });

  it("builds a high-port loopback callback", () => {
    expect(loopbackMcpRedirectUri(() => 0)).toBe("http://127.0.0.1:49152/mcp/oauth/callback");
  });

  it("opens desktop browser auth with a loopback redirect and redeems the code", async () => {
    let emit: (callback: RakazoDesktopOAuthCallback) => void = () => undefined;
    const open = vi.fn(async () => {
      emit({ code: "rh-code", state: "session-1" });
    });
    vi.stubGlobal("window", {
      rakazoDesktop: desktopWithAuth({
        open,
        onCallback: (listener) => {
          emit = listener;
          return () => undefined;
        },
      }),
      clearTimeout: () => undefined,
      setTimeout: () => 0,
    });
    begin.mockResolvedValue({
      status: "authorization_required",
      sessionId: "session-1",
      authorizationUrl:
        "https://robinhood.com/oauth?redirect_uri=http://127.0.0.1:49152/mcp/oauth/callback&state=session-1",
    });
    complete.mockResolvedValue({ ok: true });

    await expect(connectMcpOauth("server-1")).resolves.toBe("connected");
    expect(begin).toHaveBeenCalledWith({
      serverId: "server-1",
      redirectUri: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/mcp\/oauth\/callback$/),
    });
    expect(open).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "rh-code",
      state: "session-1",
    });
  });
});
