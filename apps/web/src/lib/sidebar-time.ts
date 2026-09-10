const DAY_MS = 86_400_000;

export function formatSidebarTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfThatDay) / DAY_MS);

  if (dayDiff <= 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
