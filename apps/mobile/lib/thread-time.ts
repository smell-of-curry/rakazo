const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatClock(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** Thread timestamps: `Tue, Sep 8 11:23 AM` / today `11:23 AM` / this week `Tue 11:23 AM`. */
export function formatThreadTimestamp(iso: string, now = new Date(), locale = "en-US"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  const time = formatClock(date, locale);
  if (dayDiff <= 0) return time;
  if (dayDiff < 7) {
    const weekday = date.toLocaleDateString(locale, { weekday: "short" });
    return `${weekday} ${time}`;
  }
  const day = date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  return `${day} ${time}`;
}

export function shouldShowThreadTimestamp(
  currentIso: string | undefined,
  previousIso?: string,
  gapMs = 5 * 60_000,
): boolean {
  if (!currentIso) return false;
  if (!previousIso) return true;
  const current = new Date(currentIso).getTime();
  const previous = new Date(previousIso).getTime();
  if (Number.isNaN(current) || Number.isNaN(previous)) return false;
  if (startOfDay(new Date(current)) !== startOfDay(new Date(previous))) return true;
  return Math.abs(current - previous) >= gapMs;
}
