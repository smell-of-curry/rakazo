import type { MessageBlock } from "@rakazo/contracts";
import { isApprovalAskBlock, isSecretAskBlock } from "@rakazo/core";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { MobileMessage } from "../../lib/api";
import { typeScale } from "../../lib/appearance";
import { useI18n } from "../../lib/i18n";
import { useMobileTokens } from "../../lib/native";
import { formatApprovalAnswer } from "../../lib/thread-ui";
import { AskActions } from "../AskActions";
import { NativeSymbol } from "../native-symbol";
import type { MessageActionProps } from "./types";

export function ComputerGateCard({
  block,
  botId,
  botName,
}: {
  block: Extract<MessageBlock, { kind: "computer" }>;
  botId: string;
  botName?: string;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  const router = useRouter();
  const dismissed = block.status === "dismissed";
  const answered = block.status === "answered";
  return (
    <View
      style={{
        width: "90%",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        padding: 12,
        opacity: answered || dismissed ? 0.6 : 1,
      }}
    >
      {block.text ? (
        <Text style={{ color: tokens.foreground, ...typeScale.body }}>{block.text}</Text>
      ) : null}
      {dismissed ? (
        <Text style={{ color: tokens.mutedForeground, ...typeScale.caption, marginTop: 8 }}>
          {t("Dismissed")}
        </Text>
      ) : answered ? (
        <NativeSymbol ios="checkmark" android="checkmark" size={16} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Open computer")}
          onPress={() =>
            router.push({
              pathname: "/computer",
              params: { botId, name: botName ?? t("Bot") },
            })
          }
          style={{
            marginTop: 12,
            alignSelf: "flex-start",
            borderRadius: 12,
            backgroundColor: tokens.muted,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: tokens.foreground, ...typeScale.body, fontWeight: "600" }}>
            {t("Open computer")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function ApprovalAskCard({
  askBlock,
  message,
  canAnswer,
  onAnswer,
  actionProps,
}: {
  askBlock: Extract<MessageBlock, { kind: "ask" }>;
  message: MobileMessage;
  canAnswer: boolean;
  onAnswer: (message: MobileMessage, answer: string) => Promise<void>;
  actionProps: MessageActionProps;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  return (
    <View
      style={{
        width: "90%",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        padding: 12,
        opacity: askBlock.status === "answered" || askBlock.status === "dismissed" ? 0.6 : 1,
      }}
    >
      {askBlock.text ? (
        <Text {...actionProps} style={{ color: tokens.foreground, fontSize: 15.5, lineHeight: 23 }}>
          {askBlock.text}
        </Text>
      ) : null}
      {askBlock.detail ? (
        <Text
          {...(askBlock.text ? {} : actionProps)}
          style={{
            color: tokens.mutedForeground,
            marginTop: askBlock.text ? 8 : 0,
            fontSize: 12.5,
            fontFamily: "Menlo",
            lineHeight: 20,
          }}
        >
          {askBlock.detail}
        </Text>
      ) : null}
      {askBlock.actions?.length ? (
        <AskActions
          actions={askBlock.actions}
          selectedId={askBlock.status === "answered" ? askBlock.answer : undefined}
          disabled={
            askBlock.status === "answered" ||
            askBlock.status === "dismissed" ||
            !canAnswer ||
            !onAnswer
          }
          dismissed={askBlock.status === "dismissed"}
          allowOther={!isApprovalAskBlock(askBlock)}
          accessibilityActions={actionProps.accessibilityActions}
          onAccessibilityAction={actionProps.onAccessibilityAction}
          onAnswer={(answer) => onAnswer(message, answer)}
        />
      ) : askBlock.status === "answered" ? (
        <Text
          {...actionProps}
          style={{
            color: tokens.mutedForeground,
            marginTop: 12,
            fontSize: 13.5,
            fontWeight: "600",
          }}
        >
          {formatApprovalAnswer(askBlock.answer, askBlock.actions, isApprovalAskBlock(askBlock))}
        </Text>
      ) : (
        <Text
          {...actionProps}
          style={{ color: tokens.mutedForeground, marginTop: 12, fontSize: 13.5 }}
        >
          {t("No longer active")}
        </Text>
      )}
    </View>
  );
}

export function AskBlock({
  ask,
  canAnswer,
  onAnswer,
  actionProps,
}: {
  ask: Extract<MobileMessage["blocks"][number], { kind: "ask" }>;
  canAnswer: boolean;
  onAnswer: (answer: string) => Promise<void>;
  actionProps: MessageActionProps;
}) {
  const tokens = useMobileTokens();
  const { t } = useI18n();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const answered = ask.status === "answered";
  const dismissed = ask.status === "dismissed";
  const secretInput = isSecretAskBlock(ask);
  const secretLabel = t("Paste value");
  const submitLabel = secretInput ? t("Save securely") : t("Send");
  const submittingLabel = secretInput ? t("Saving…") : t("Sending…");

  async function submit() {
    if (submitting) return;
    if (secretInput ? answer.length === 0 : !answer.trim()) return;
    const submitValue = secretInput ? answer : answer.trim();
    setSubmitting(true);
    setError(null);
    if (secretInput) setAnswer("");
    try {
      await onAnswer(submitValue);
    } catch (cause) {
      setError(!secretInput && cause instanceof Error ? cause.message : t("Could not send answer"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      style={{
        width: "90%",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        padding: 12,
        gap: 10,
        opacity: answered || dismissed ? 0.6 : 1,
      }}
    >
      <Text
        {...actionProps}
        style={{ color: tokens.foreground, ...typeScale.body, fontWeight: "600" }}
      >
        {ask.text}
      </Text>
      {secretInput && ask.credential ? (
        <Text style={{ color: tokens.mutedForeground, ...typeScale.small }}>
          {ask.credential.origin}
        </Text>
      ) : null}
      {ask.detail && !secretInput ? (
        <Text style={{ color: tokens.mutedForeground, ...typeScale.small }}>{ask.detail}</Text>
      ) : null}
      {dismissed ? (
        <Text style={{ color: tokens.mutedForeground, ...typeScale.caption }}>
          {t("Dismissed")}
        </Text>
      ) : answered ? (
        secretInput ? (
          <>
            <Text style={{ color: tokens.mutedForeground, ...typeScale.body }}>{t("Saved")}</Text>
            <Text style={{ color: tokens.mutedForeground, ...typeScale.small }}>
              {t("Stored securely, never shown to your bot")}
            </Text>
          </>
        ) : (
          <Text style={{ color: tokens.mutedForeground, ...typeScale.body }}>
            {ask.answer ?? t("Done")}
          </Text>
        )
      ) : canAnswer ? (
        <>
          <TextInput
            accessibilityLabel={secretInput ? secretLabel : t("Answer")}
            value={answer}
            onChangeText={setAnswer}
            placeholder={secretInput ? secretLabel : t("Type an answer")}
            placeholderTextColor={tokens.mutedForeground}
            secureTextEntry={secretInput}
            autoComplete="off"
            autoCorrect={secretInput ? false : undefined}
            autoCapitalize={secretInput ? "none" : "sentences"}
            editable={!submitting}
            onSubmitEditing={() => void submit()}
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
            accessibilityLabel={submitLabel}
            disabled={(secretInput ? answer.length === 0 : !answer.trim()) || submitting}
            onPress={() => void submit()}
            style={{
              alignSelf: "flex-end",
              borderRadius: 999,
              backgroundColor: tokens.foreground,
              opacity: (secretInput ? answer.length === 0 : !answer.trim()) || submitting ? 0.5 : 1,
              paddingHorizontal: 16,
              paddingVertical: 9,
            }}
          >
            <Text style={{ color: tokens.primaryForeground, fontWeight: "600" }}>
              {submitting ? submittingLabel : submitLabel}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={{ color: tokens.mutedForeground, fontSize: 13.5 }}>
          {t("Waiting for this bot’s response.")}
        </Text>
      )}
      {error ? <Text style={{ color: tokens.destructive, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
