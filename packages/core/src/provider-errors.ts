/** OpenRouter / provider 429s arrive as raw HTTP dumps. Detect, clean, retry. */

export const RATE_LIMIT_RETRY_MAX = 4;

export function isRateLimitError(message: string): boolean {
  return (
    /\b429\b/.test(message) ||
    /rate[_\s-]?limit/i.test(message) ||
    /too many requests/i.test(message) ||
    /new-account-rpm/i.test(message)
  );
}

export function rateLimitRetryDelayMs(message: string, attempt: number): number {
  const retryAfter = message.match(/retry-after["\s:=]+(\d+)/i);
  if (retryAfter) {
    const seconds = Number(retryAfter[1]);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 5 * 60_000);
  }
  return Math.min(120_000, 15_000 * 2 ** Math.min(Math.max(attempt - 1, 0), 3));
}

export function formatRateLimitUserText(options: { retrying: boolean; delayMs?: number }): string {
  if (options.retrying) {
    const seconds = options.delayMs ? Math.max(1, Math.round(options.delayMs / 1000)) : undefined;
    return seconds ? `Rate limited. Retrying in ${seconds}s.` : "Rate limited. Retrying.";
  }
  return "Rate limited. Stopped after retries.";
}

export function formatSetupRetryUserText(computerBusy: boolean): string {
  return computerBusy ? "Waiting for the team computer." : "Could not start. Retrying.";
}

export function delegatedFailureText(error: string): string {
  if (isRateLimitError(error)) return formatRateLimitUserText({ retrying: false });
  return `Could not complete the delegated request: ${error || "unknown error"}`;
}
