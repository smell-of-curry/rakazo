const DAY_MS = 86_400_000;
const TIMESTAMP_GAP_MS = 15 * 60 * 1000;

const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function formatThreadTimestamp(date: Date, now = new Date()): string {
  if (Number.isNaN(date.getTime())) return "";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfThatDay) / DAY_MS);
  const time = date.toLocaleTimeString("en-US", timeOpts);
  if (dayDiff <= 0) return time;
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  if (dayDiff <= 6) return `${weekday} ${time}`;
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay} ${time}`;
}

export function shouldInsertThreadTimestamp(
  previous: { createdAt: string; senderKey: string } | undefined,
  current: { createdAt: string; senderKey: string },
): boolean {
  if (!previous) return true;
  const prev = new Date(previous.createdAt);
  const curr = new Date(current.createdAt);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(curr.getTime())) return true;
  const prevDay = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate()).getTime();
  const currDay = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate()).getTime();
  if (prevDay !== currDay) return true;
  if (previous.senderKey !== current.senderKey) return true;
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

export function bubbleRadiusClass(role: "user" | "bot", cluster: BubbleCluster): string {
  if (cluster === "single") return "rounded-[18px]";
  if (role === "user") {
    if (cluster === "first") return "rounded-[18px] rounded-br-[6px]";
    if (cluster === "last") return "rounded-[18px] rounded-tr-[6px]";
    return "rounded-[18px] rounded-tr-[6px] rounded-br-[6px]";
  }
  if (cluster === "first") return "rounded-[18px] rounded-bl-[6px]";
  if (cluster === "last") return "rounded-[18px] rounded-tl-[6px]";
  return "rounded-[18px] rounded-tl-[6px] rounded-bl-[6px]";
}
