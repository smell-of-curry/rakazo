import type { ThreadMessage } from "@rakazo/contracts";

const PROVIDER_LABELS: Record<string, string> = {
  sendblue: "iMessage",
  slack: "Slack",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  lark: "Feishu",
};

/** Per-message provider label, narrowed to a recognized transport when available. */
export function messageProviderLabel(provider: string, transport?: string): string {
  if (provider === "sendblue" && ["iMessage", "SMS", "RCS"].includes(transport ?? "")) {
    return transport!;
  }
  return PROVIDER_LABELS[provider] ?? provider;
}

/** Plain message text for clipboard copy — text/ask/progress only, no chrome. */
export function copyableMessageText(message: Pick<ThreadMessage, "blocks">): string {
  return message.blocks
    .map((block) => {
      if (block.kind === "channel_message") {
        return `${messageProviderLabel(block.provider, block.transport)} · ${block.fromLabel}: ${block.text}`;
      }
      if (block.kind === "text" || block.kind === "progress" || block.kind === "ask") {
        return block.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}
