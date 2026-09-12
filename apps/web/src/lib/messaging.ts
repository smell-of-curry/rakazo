import { messageProviderLabel } from "@rakazo/core";

/** User-facing name of a messaging provider (falls back to the raw id). */
export function providerLabel(provider: string): string {
  return messageProviderLabel(provider);
}
