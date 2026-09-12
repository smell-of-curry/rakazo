import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, type ViewProps } from "react-native";
import { mobileTokens, typeScale } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { NativeSymbol } from "./native-symbol";

type AskAction = { id: string; label: string };

function actionLabel(action: AskAction, actions: AskAction[], t: (id: string) => string): string {
  if (action.id === "always") return t("Always allow");
  if (action.id === "deny") return t("Deny");
  if (action.id === "allow") {
    return actions.some((item) => item.id === "always") ? t("Allow once") : t("Allow");
  }
  return action.label;
}

export function AskActions({
  actions,
  disabled,
  selectedId,
  onAnswer,
  allowOther,
  dismissed,
  accessibilityActions,
  onAccessibilityAction,
}: {
  actions: AskAction[];
  disabled?: boolean;
  selectedId?: string;
  onAnswer: (answer: string) => Promise<void>;
  allowOther?: boolean;
  dismissed?: boolean;
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
    if (disabled || submitting || !answer) return;
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
              backgroundColor: selected ? tokens.background : "transparent",
              borderWidth: 1,
              borderColor: tokens.border,
              opacity: faded ? 0.35 : selected ? 1 : disabled || submitting ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: tokens.foreground,
                ...typeScale.body,
                fontWeight: selected ? "600" : "400",
              }}
            >
              {pendingAction === action.id ? t("Sending…") : actionLabel(action, actions, t)}
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
            placeholder={t("Type an answer")}
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
              ...typeScale.body,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Send")}
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
            <Text style={{ color: tokens.foreground, ...typeScale.body, fontWeight: "600" }}>
              {pendingAction && pendingAction === other.trim() ? t("Sending…") : t("Send")}
            </Text>
          </Pressable>
        </>
      ) : allowOther && customSelected ? (
        <Text style={{ color: tokens.mutedForeground, ...typeScale.body, fontWeight: "600" }}>
          {selectedId}
        </Text>
      ) : null}
      {dismissed ? (
        <Text style={{ color: tokens.mutedForeground, ...typeScale.caption }}>
          {t("Dismissed")}
        </Text>
      ) : null}
    </View>
  );
}
