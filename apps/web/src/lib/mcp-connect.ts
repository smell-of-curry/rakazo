import type { RakazoDesktop } from "./desktop";
import { desktopBridge } from "./desktop";
import { rpc } from "./rpc";

export const MCP_OAUTH_CHANNEL = "rakazo-mcp-oauth";
export const MCP_OAUTH_TIMEOUT_MS = 10 * 60 * 1000;
export const MCP_OAUTH_POLL_MS = 1500;
const LOOPBACK_PORT_MIN = 49152;
const LOOPBACK_PORT_SPAN = 16383;

export type McpOauthResult =
  | "connected"
  | "cancelled"
  | "already_connected"
  | "authorization_not_requested";

/** Desktop uses a loopback callback (Robinhood rejects many public HTTPS
 * callbacks after login). Other clients keep the in-app popup. */
export async function connectMcpOauth(serverId: string): Promise<McpOauthResult> {
  const desktopAuth = desktopBridge()?.oauth;
  if (desktopAuth?.open) {
    return await connectMcpOauthDesktop(serverId, { ...desktopAuth, open: desktopAuth.open });
  }
  return await connectMcpOauthPopup(serverId);
}

export function loopbackMcpRedirectUri(random = Math.random): string {
  const port = LOOPBACK_PORT_MIN + Math.floor(random() * LOOPBACK_PORT_SPAN);
  return `http://127.0.0.1:${port}/mcp/oauth/callback`;
}

async function connectMcpOauthDesktop(
  serverId: string,
  desktopAuth: NonNullable<RakazoDesktop["oauth"]> & {
    open: (authorizationUrl: string) => Promise<void>;
  },
): Promise<McpOauthResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = await rpc.mcp.oauth.begin({
      serverId,
      redirectUri: loopbackMcpRedirectUri(),
    });
    if (started.status !== "authorization_required") return started.status;
    try {
      return await waitForDesktopMcpOauth(started.sessionId, started.authorizationUrl, desktopAuth);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not open browser sign-in");
}

async function waitForDesktopMcpOauth(
  sessionId: string,
  authorizationUrl: string,
  desktopAuth: NonNullable<RakazoDesktop["oauth"]> & {
    open: (authorizationUrl: string) => Promise<void>;
  },
): Promise<McpOauthResult> {
  return await new Promise<McpOauthResult>((resolve, reject) => {
    let settled = false;
    let timeoutTimer = 0;
    const finish = (result: McpOauthResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      unsubscribe();
      void desktopAuth.cancel?.(authorizationUrl).catch(() => undefined);
      resolve(result);
    };
    const unsubscribe = desktopAuth.onCallback((callback) => {
      if (callback.state !== sessionId) return;
      void rpc.mcp.oauth
        .complete({ sessionId, code: callback.code, state: sessionId })
        .then(() => finish("connected"))
        .catch(() => finish("cancelled"));
    });
    timeoutTimer = window.setTimeout(() => finish("cancelled"), MCP_OAUTH_TIMEOUT_MS);
    void desktopAuth.open(authorizationUrl).catch((error: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      unsubscribe();
      reject(error);
    });
  });
}

async function connectMcpOauthPopup(serverId: string): Promise<McpOauthResult> {
  const started = await rpc.mcp.oauth.begin({
    serverId,
    redirectUri: `${window.location.origin}/mcp/oauth/callback`,
  });
  if (started.status !== "authorization_required") return started.status;
  const popup = window.open(
    started.authorizationUrl,
    MCP_OAUTH_CHANNEL,
    "popup,width=1024,height=800",
  );
  if (!popup) {
    window.location.assign(started.authorizationUrl);
    return "cancelled";
  }
  return await new Promise<McpOauthResult>((resolve) => {
    const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
    let settled = false;
    let pollTimer = 0;
    let timeoutTimer = 0;
    const finish = (result: McpOauthResult) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      channel.close();
      resolve(result);
    };
    pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      finish("cancelled");
    }, 500);
    timeoutTimer = window.setTimeout(() => {
      popup.close();
      finish("cancelled");
    }, MCP_OAUTH_TIMEOUT_MS);
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type !== "mcp-oauth-complete") return;
      finish("connected");
    };
  });
}
