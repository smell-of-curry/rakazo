import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, type ViewProps } from "react-native";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { NativeSymbol } from "./native-symbol";

type AskAction = { id: string; label: string };

const KNOWN_ASK_ACTION_LABELS: Record<string, string> = {
  allow: "Allow once",
  always: "Always allow",
  deny: "Deny",
};

export function AskActions({
  actions,
  disabled,
  selectedId,
  onAnswer,
  allowOther,
  accessibilityActions,
  onAccessibilityAction,
}: {
  actions: AskAction[];
  disabled?: boolean;
  selectedId?: string;
  onAnswer: (answer: string) => Promise<void>;
  allowOther?: boolean;
  accessibilityActions?: ViewProps["accessibilityActions"];
  onAccessibilityAction?: ViewProps["onAccessibilityAction"];
}) {
  const { t } = useI18n();
  const tokens = mobileTokens();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const submitting = pendingAction !== null;
  const customSelected = Boolean(selectedId) && !actions.some((action) => action.id === selectedId);

  async function submit(answer: string) {
    if (disabled || submitting) return;
    setPendingAction(answer);
    try {
      await onAnswer(answer);
    } catch (error) {
      Alert.alert(
        t("Could not submit answer"),
        error instanceof Error ? error.message : t("Please try again."),
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      {actions.map((action) => {
        const emphasized = action.id === "allow" || action.id === "always";
        const selected = selectedId === action.id;
        const faded = Boolean(selectedId) && !selected;
        return (
          <Pressable
            key={action.id}
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={onAccessibilityAction}
            accessibilityState={{ disabled: disabled || submitting, selected }}
            disabled={disabled || submitting}
            onPress={() => void submit(action.id)}
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: selected
                ? tokens.background
                : emphasized && !selectedId
                  ? tokens.muted
                  : "transparent",
              borderWidth: 1,
              borderColor: tokens.border,
              opacity: faded ? 0.35 : selected ? 1 : disabled || submitting ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: tokens.foreground,
                fontSize: 15,
                fontWeight: selected || emphasized ? "600" : "400",
              }}
            >
              {pendingAction === action.id
                ? t("Sending…")
                : Object.hasOwn(KNOWN_ASK_ACTION_LABELS, action.id)
                  ? t(KNOWN_ASK_ACTION_LABELS[action.id]!)
                  : action.label}
            </Text>
            {selected ? <NativeSymbol ios="checkmark" android="checkmark" size={16} /> : null}
          </Pressable>
        );
      })}
      {allowOther && !disabled && !selectedId ? (
        <>
          <TextInput
            testID="ask-other"
            accessibilityLabel={t("Answer")}
            value={other}
            onChangeText={setOther}
            placeholder={t("Type your answer")}
            placeholderTextColor={tokens.mutedForeground}
            editable={!submitting}
            onSubmitEditing={() => void submit(other.trim())}
            style={{
              minHeight: 42,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.border,
              color: tokens.foreground,
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Send answer")}
            disabled={!other.trim() || submitting}
            onPress={() => void submit(other.trim())}
            style={{
              alignSelf: "flex-start",
              opacity: !other.trim() || submitting ? 0.4 : 1,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: tokens.muted,
            }}
          >
            <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: "600" }}>
              {pendingAction && pendingAction === other.trim() ? t("Sending…") : t("Send answer")}
            </Text>
          </Pressable>
        </>
      ) : allowOther && customSelected ? (
        <Text style={{ color: tokens.mutedForeground, fontSize: 13.5, fontWeight: "600" }}>
          {t("Answered: {answer}", { answer: selectedId ?? t("Done") })}
        </Text>
      ) : null}
    </View>
  );
}
