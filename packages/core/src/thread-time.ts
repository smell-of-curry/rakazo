const DAY_MS = 86_400_000;
const TIMESTAMP_GAP_MS = 15 * 60 * 1000;

const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatThreadTimestamp(
  dateInput: Date | string,
  now = new Date(),
  locale = "en-US",
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  const time = date.toLocaleTimeString(locale, timeOpts);
  if (dayDiff <= 0) return time;
  const weekday = date.toLocaleDateString(locale, { weekday: "short" });
  if (dayDiff <= 6) return `${weekday} ${time}`;
  const monthDay = date.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay} ${time}`;
}

/** Divider only on a new local day or a gap greater than 15 minutes — not on sender change. */
export function shouldInsertThreadTimestamp(
  previous: { createdAt: string; senderKey: string } | undefined,
  current: { createdAt: string; senderKey: string },
): boolean {
  if (!previous) return true;
  const prev = new Date(previous.createdAt);
  const curr = new Date(current.createdAt);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(curr.getTime())) return true;
  if (startOfDay(prev) !== startOfDay(curr)) return true;
  return curr.getTime() - prev.getTime() > TIMESTAMP_GAP_MS;
}

export function threadSenderKey(message: { role: string; botId?: string | null }): string {
  if (message.role === "user") return "user";
  return `bot:${message.botId ?? ""}`;
}

export function parseRateLimitRetrySeconds(text: string): number | undefined {
  const match = text.match(/retrying in (\d+)\s*s/i);
  if (!match?.[1]) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export type BubbleCluster = "single" | "first" | "middle" | "last";

export function bubbleCluster(previousSameSender: boolean, nextSameSender: boolean): BubbleCluster {
  if (!previousSameSender && !nextSameSender) return "single";
  if (!previousSameSender) return "first";
  if (!nextSameSender) return "last";
  return "middle";
}
