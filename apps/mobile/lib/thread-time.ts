import { shouldInsertThreadTimestamp } from "@rakazo/core";

export type { BubbleCluster } from "@rakazo/core";
export {
  bubbleCluster,
  formatThreadTimestamp,
  parseRateLimitRetrySeconds,
  shouldInsertThreadTimestamp,
  threadSenderKey,
} from "@rakazo/core";

export function shouldShowThreadTimestamp(
  currentIso: string | undefined,
  previousIso?: string,
): boolean {
  if (!currentIso) return false;
  return shouldInsertThreadTimestamp(
    previousIso === undefined ? undefined : { createdAt: previousIso, senderKey: "" },
    { createdAt: currentIso, senderKey: "" },
  );
}
