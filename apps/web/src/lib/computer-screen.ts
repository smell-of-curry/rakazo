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
