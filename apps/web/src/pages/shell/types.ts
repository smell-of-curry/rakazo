import type { ProductEvent } from "@rakazo/contracts";

export type Panel =
  | "computer"
  | "settings"
  | "routine"
  | "create"
  | "create-group"
  | "group-settings"
  | null;

export type PendingAttachment = {
  id: string;
  threadKey: string;
  file: File;
  previewUrl?: string;
};

export type PendingBrowserNotification = {
  event: Pick<ProductEvent, "id" | "type" | "threadId" | "botId" | "payload">;
  botId: string;
  botName: string;
  groupNotification: boolean;
};

/** Identity colour for bots the roster no longer knows about. */
export const FALLBACK_BOT_COLOR = "#85858A";
