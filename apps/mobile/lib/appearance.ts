import {
  type AppearancePreference,
  normalizeAppearancePreference,
  type ResolvedAppearance,
  resolveAppearance,
  tokensForAppearance,
  UI_APPEARANCE_STORAGE_KEY,
} from "@rakazo/ui-tokens";
import * as SecureStore from "expo-secure-store";
import { Appearance, type ColorSchemeName, type TextStyle } from "react-native";

/**
 * Shared type scale (docs/ui-parity.md). Numbers are CSS px at 1x = iOS points.
 * Web body is 13/18; native text reads larger so thread bubbles use 15/20 and
 * large titles use 17/22. System font stays; Menlo is for inline code only.
 *
 * | token    | size / lh | mobile use                          |
 * |----------|-----------|-------------------------------------|
 * | micro    | 10 / 12   | title capsule, Needs you pill       |
 * | caption  | 11 / 14   | section headers, timestamps, pin name |
 * | small    | 12 / 16   | row preview, helper, schedule       |
 * | body     | 13 / 18   | roster name, settings, composer     |
 * | title    | 15 / 20   | pane headers                        |
 * | display  | 20 / 24   | empty / onboarding                  |
 * | thread   | 15 / 20   | iOS/Android thread bubbles (web 13/18) |
 * | largeTitle | 17 / 22 | native chrome titles                |
 */
export const typeScale = {
  micro: { fontSize: 10, lineHeight: 12, fontWeight: "500" },
  caption: { fontSize: 11, lineHeight: 14 },
  captionMedium: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
  small: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 13, lineHeight: 18, letterSpacing: -0.14 },
  bodySemibold: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: -0.14 },
  thread: { fontSize: 15, lineHeight: 20, letterSpacing: -0.16 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  largeTitle: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  display: { fontSize: 20, lineHeight: 24, fontWeight: "600" },
  mono: { fontFamily: "Menlo", fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;

export type { AppearancePreference, ResolvedAppearance };

let memoryPreference: AppearancePreference | null = null;
const listeners = new Set<() => void>();

function systemAppearance(scheme?: ColorSchemeName | null): ResolvedAppearance {
  return (scheme ?? Appearance.getColorScheme()) === "light" ? "light" : "dark";
}

export function getCachedAppearancePreference(): AppearancePreference {
  return memoryPreference ?? "system";
}

export async function loadAppearancePreference(): Promise<AppearancePreference> {
  try {
    const stored = await SecureStore.getItemAsync(UI_APPEARANCE_STORAGE_KEY);
    memoryPreference = normalizeAppearancePreference(stored);
  } catch {
    memoryPreference = memoryPreference ?? "system";
  }
  notify();
  return memoryPreference;
}

export async function setAppearancePreference(
  preference: AppearancePreference,
): Promise<AppearancePreference> {
  memoryPreference = preference;
  try {
    await SecureStore.setItemAsync(UI_APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // Keep the in-memory preference when SecureStore is unavailable.
  }
  notify();
  return preference;
}

export function resolveMobileAppearance(
  preference: AppearancePreference = getCachedAppearancePreference(),
  scheme?: ColorSchemeName | null,
): ResolvedAppearance {
  return resolveAppearance(preference, systemAppearance(scheme));
}

export function mobileTokens(
  preference: AppearancePreference = getCachedAppearancePreference(),
  scheme?: ColorSchemeName | null,
) {
  return tokensForAppearance(resolveMobileAppearance(preference, scheme));
}

export function subscribeAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

Appearance.addChangeListener(() => {
  if (getCachedAppearancePreference() === "system") notify();
});
