import { useLingui } from "@lingui/react/macro";
import type {
  Bot,
  ComputerStatus,
  Routine,
  TaughtSkill,
  ThreadMessage,
  ThreadSnapshot,
} from "@rakazo/contracts";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  type MessageReaction,
} from "@rakazo/contracts";
import {
  attachmentsForThread,
  type ComposerMention,
  inferAttachmentMimeType,
  resolveComposerSendPlan,
  speechFromBlocks,
} from "@rakazo/core";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { useCallback, useRef } from "react";
import type { NavigateFunction } from "react-router-dom";
import { requestBrowserNotificationPermission } from "../../lib/browser-notifications";
import { revokePendingAttachmentPreviews } from "../../lib/pending-attachments";
import { rpc } from "../../lib/rpc";
import { applyThreadSendReceipt, clearActiveThreadRuns } from "../../lib/thread-events";
import { speaker } from "../../lib/tts";
import { emptyRoutineDraft, type RoutineDraftState } from "../RoutineEditor";
import { newClientNonce, readFileAsBase64 } from "./thread-events";
import type { Panel, PendingAttachment } from "./types";

export type UseThreadSendArgs = {
  navigate: NavigateFunction;
  activeBotId: MutableRefObject<string | undefined>;
  activeGroupId: MutableRefObject<string | undefined>;
  botsRef: MutableRefObject<Bot[]>;
  sending: boolean;
  setSending: Dispatch<SetStateAction<boolean>>;
  setSendError: Dispatch<SetStateAction<string | null>>;
  pendingAttachments: PendingAttachment[];
  setPendingAttachments: Dispatch<SetStateAction<PendingAttachment[]>>;
  setAttachmentNotice: Dispatch<SetStateAction<string | null>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  setReplyTarget: Dispatch<SetStateAction<ThreadMessage | null>>;
  activeReplyTarget: ThreadMessage | null;
  refreshThreadRef: MutableRefObject<
    (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null | undefined>
  >;
  refreshGroupThreadRef: MutableRefObject<
    (id: string, signal?: AbortSignal) => Promise<ThreadSnapshot | null | undefined>
  >;
  updateSnapshot: (update: (prev: ThreadSnapshot | null) => ThreadSnapshot | null) => void;
  terminalRunReceipts: MutableRefObject<Set<string>>;
  flushPendingBrowserNotifications: () => void;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
  cancelFocusPrompt: () => void;
  focusPromptBotIdRef: MutableRefObject<string | null>;
  teachBusy: boolean;
  setTeachBusy: Dispatch<SetStateAction<boolean>>;
  taughtSkills: TaughtSkill[];
  taughtSkillsBotId: string | null;
  setTaughtSkills: Dispatch<SetStateAction<TaughtSkill[]>>;
  setTaughtSkillsBotId: Dispatch<SetStateAction<string | null>>;
  setComputerOpen: Dispatch<SetStateAction<boolean>>;
  setRoutineDraft: Dispatch<SetStateAction<RoutineDraftState>>;
  setRoutineWebhookSecret: Dispatch<SetStateAction<string | null>>;
  setEditingRoutine: Dispatch<SetStateAction<Routine | null>>;
  setPanel: Dispatch<SetStateAction<Panel>>;
  computerRef: MutableRefObject<ComputerStatus | null>;
  commitComputer: (next: ComputerStatus | null) => void;
  speakingMessageId: string | null;
};

export function useThreadSend(args: UseThreadSendArgs) {
  const { t } = useLingui();
  const {
    navigate,
    activeBotId,
    activeGroupId,
    botsRef,
    sending,
    setSending,
    setSendError,
    pendingAttachments,
    setPendingAttachments,
    setAttachmentNotice,
    fileInputRef,
    setReplyTarget,
    activeReplyTarget,
    refreshThreadRef,
    refreshGroupThreadRef,
    updateSnapshot,
    terminalRunReceipts,
    flushPendingBrowserNotifications,
    refreshBots,
    cancelFocusPrompt,
    focusPromptBotIdRef,
    teachBusy,
    setTeachBusy,
    taughtSkills,
    taughtSkillsBotId,
    setTaughtSkills,
    setTaughtSkillsBotId,
    setComputerOpen,
    setRoutineDraft,
    setRoutineWebhookSecret,
    setEditingRoutine,
    setPanel,
    computerRef,
    commitComputer,
    speakingMessageId,
  } = args;

  const answerMessage = useCallback(async (message: ThreadMessage, text: string) => {
    const botId = activeBotId.current;
    const groupId = activeGroupId.current;
    if (!botId && !groupId) return;
    await rpc.threads.answer({
      ...(groupId ? { groupId } : { botId: botId! }),
      runId: message.runId ?? "",
      messageId: message.id,
      answer: text,
    });
    if (groupId && activeGroupId.current === groupId) {
      await refreshGroupThreadRef.current(groupId);
    } else if (botId && activeBotId.current === botId) {
      await refreshThreadRef.current(botId);
    }
  }, []);
  const reactToMessage = useCallback(
    async (message: ThreadMessage, reaction: MessageReaction) => {
      const botId = activeBotId.current;
      const groupId = activeGroupId.current;
      if (!botId && !groupId) return;
      try {
        await rpc.threads.react({
          ...(groupId ? { groupId } : { botId: botId! }),
          messageId: message.id,
          reaction,
          clientNonce: newClientNonce(),
        });
      } catch (error) {
        const stillHere = groupId
          ? activeGroupId.current === groupId
          : activeBotId.current === botId;
        if (!stillHere) return;
        setSendError(error instanceof Error ? error.message : t`Could not update reaction`);
      }
    },
    [t],
  );
  const onAttachmentPick = useCallback(
    async (files: FileList | null) => {
      const threadKey = activeGroupId.current ?? activeBotId.current;
      if (!threadKey || !files?.length) return;
      const existing = attachmentsForThread(pendingAttachments, threadKey);
      const next: PendingAttachment[] = [];
      const skipped: string[] = [];
      for (const file of Array.from(files)) {
        if (existing.length + next.length >= ATTACHMENT_MAX_COUNT) {
          skipped.push(t`${file.name} (max ${ATTACHMENT_MAX_COUNT} attachments)`);
          continue;
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          skipped.push(t`${file.name} (over 10 MiB)`);
          continue;
        }
        const mimeType = inferAttachmentMimeType(file.name, file.type);
        if (!mimeType) {
          skipped.push(file.name);
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${next.length}`,
          threadKey,
          file,
          previewUrl: mimeType.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        });
      }
      if (next.length) setPendingAttachments((current) => [...current, ...next]);
      setAttachmentNotice(skipped.length ? t`Skipped ${skipped.join(", ")}` : null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [pendingAttachments, t],
  );
  const removeAttachment = useCallback((attachment: PendingAttachment) => {
    revokePendingAttachmentPreviews([attachment]);
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
  }, []);
  const sendMessage = useCallback(
    async (text: string, mentions: ComposerMention[] = []) => {
      const initialBotTarget = activeBotId.current;
      const initialGroupTarget = activeGroupId.current;
      if (!initialBotTarget && !initialGroupTarget) return;
      // Composer clears draft only after this promise resolves; a silent
      // return here would wipe text on an in-flight double-send.
      if (sending) throw new Error("Sending");
      const originThreadKey = initialGroupTarget ?? initialBotTarget;
      const attachments = attachmentsForThread(pendingAttachments, originThreadKey);
      const plan = resolveComposerSendPlan({
        text,
        mentions,
        hasAttachments: attachments.length > 0,
      });
      if (plan.isNoOp) return;
      const reroutedToGroup = Boolean(
        plan.rerouteGroupId && plan.rerouteGroupId !== initialGroupTarget,
      );
      const groupTarget = plan.rerouteGroupId ?? initialGroupTarget;
      const botTarget = reroutedToGroup ? undefined : initialBotTarget;
      if (
        plan.shouldSend &&
        (groupTarget || botsRef.current.find((bot) => bot.id === botTarget)?.notifyOnFinish)
      ) {
        const permissionRequest = requestBrowserNotificationPermission();
        if (permissionRequest) void permissionRequest.then(flushPendingBrowserNotifications);
      }
      const trimmed = plan.trimmed;
      setSending(true);
      setSendError(null);
      const dropDelayedSetup = () => {
        // Only after successful engagement so a failed upload/send keeps the setup card.
        if (initialBotTarget && focusPromptBotIdRef.current === initialBotTarget) {
          cancelFocusPrompt();
        }
      };
      try {
        if (plan.shouldRunRoutines) {
          const sendNonce = newClientNonce();
          await Promise.all(
            plan.routineIds.map((routineId) =>
              rpc.routines.testRun({
                routineId,
                clientNonce: `routine-mention:${sendNonce}:${routineId}`,
              }),
            ),
          );
        }
        if (!plan.shouldSend) {
          dropDelayedSetup();
          setReplyTarget(null);
          revokePendingAttachmentPreviews(attachments);
          setPendingAttachments((current) =>
            current.filter((attachment) => attachment.threadKey !== originThreadKey),
          );
          setAttachmentNotice(null);
          if (reroutedToGroup && groupTarget) {
            navigate(`/app/g/${groupTarget}`);
            return;
          }
          if (groupTarget && activeGroupId.current === groupTarget) {
            await refreshGroupThreadRef.current(groupTarget);
          } else if (botTarget && activeBotId.current === botTarget) {
            await refreshThreadRef.current(botTarget);
          }
          return;
        }
        const artifactIds: string[] = [];
        for (const pending of attachments) {
          const mimeType = inferAttachmentMimeType(pending.file.name, pending.file.type);
          if (!mimeType) {
            throw new Error(t`Unsupported file type: ${pending.file.name}`);
          }
          const contentBase64 = await readFileAsBase64(pending.file);
          const artifact = await rpc.artifacts.create(
            groupTarget
              ? { groupId: groupTarget, name: pending.file.name, mimeType, contentBase64 }
              : { botId: botTarget!, name: pending.file.name, mimeType, contentBase64 },
          );
          artifactIds.push(artifact.id);
        }
        const clientNonce = newClientNonce();
        if (groupTarget) {
          await rpc.threads.send({
            groupId: groupTarget,
            clientNonce,
            text: trimmed || undefined,
            mentions: plan.mentionPayload.length ? plan.mentionPayload : undefined,
            artifactIds: artifactIds.length ? artifactIds : undefined,
            replyToMessageId: reroutedToGroup ? undefined : activeReplyTarget?.id,
          });
        } else if (botTarget) {
          const sent = await rpc.threads.send({
            botId: botTarget,
            clientNonce,
            text: trimmed || undefined,
            mentions: plan.mentionPayload.length ? plan.mentionPayload : undefined,
            artifactIds: artifactIds.length ? artifactIds : undefined,
            replyToMessageId: activeReplyTarget?.id,
          });
          if (activeBotId.current === botTarget) {
            updateSnapshot((current) =>
              applyThreadSendReceipt(
                current,
                {
                  botId: botTarget,
                  runId: sent.runId,
                  taskId: sent.taskId,
                },
                terminalRunReceipts.current,
              ),
            );
          }
        }
        dropDelayedSetup();
        setReplyTarget(null);
        revokePendingAttachmentPreviews(attachments);
        setPendingAttachments((current) =>
          current.filter((attachment) => attachment.threadKey !== originThreadKey),
        );
        // Refresh sidebar status even when a bot→group reroute navigates away below.
        void refreshBots().catch(() => undefined);
        if (reroutedToGroup && groupTarget) {
          navigate(`/app/g/${groupTarget}`);
          return;
        }
        if (groupTarget && activeGroupId.current === groupTarget) setAttachmentNotice(null);
        if (botTarget && activeBotId.current === botTarget) setAttachmentNotice(null);
        if (groupTarget) await refreshGroupThreadRef.current(groupTarget);
        else if (botTarget) await refreshThreadRef.current(botTarget);
      } catch (error) {
        if (reroutedToGroup && groupTarget) {
          setSendError(error instanceof Error ? error.message : t`Failed to send message`);
        } else if (groupTarget && activeGroupId.current === groupTarget) {
          setSendError(error instanceof Error ? error.message : t`Failed to send message`);
        } else if (botTarget && activeBotId.current === botTarget) {
          setSendError(error instanceof Error ? error.message : t`Failed to send message`);
        }
        throw error;
      } finally {
        setSending(false);
      }
    },
    [
      activeReplyTarget?.id,
      flushPendingBrowserNotifications,
      navigate,
      pendingAttachments,
      sending,
      t,
    ],
  );
  const followUpMessage = useCallback(async (text: string) => {
    const id = activeBotId.current;
    if (!id) return;
    await rpc.threads.followUp({ botId: id, text });
    await refreshThreadRef.current(id);
  }, []);
  const stopRun = useCallback(async () => {
    if (sending) return;
    setSending(true);
    try {
      const botTarget = activeBotId.current;
      const groupTarget = activeGroupId.current;
      if (groupTarget) {
        setSendError(null);
        try {
          await rpc.threads.stop({ groupId: groupTarget });
        } catch (error) {
          if (activeGroupId.current === groupTarget) {
            setSendError(error instanceof Error ? error.message : t`Failed to stop`);
          }
          return;
        }
        // Stop has no terminal event; clear run UI before refresh races with in-flight gets.
        if (activeGroupId.current === groupTarget) {
          updateSnapshot((prev) =>
            prev && prev.groupId === groupTarget ? clearActiveThreadRuns(prev) : prev,
          );
        }
        await refreshGroupThreadRef.current(groupTarget).catch(() => undefined);
        return;
      }
      if (!botTarget) return;
      setSendError(null);
      try {
        await rpc.threads.stop({ botId: botTarget });
      } catch (error) {
        if (activeBotId.current === botTarget) {
          setSendError(error instanceof Error ? error.message : t`Failed to stop`);
        }
        return;
      }
      // Stop does not emit a terminal thread event. Clear local run/busy immediately so a
      // superseded in-flight refresh (older cursor) cannot leave Stop enabled / Take control
      // blocked while the API is already idle.
      if (activeBotId.current === botTarget) {
        updateSnapshot((prev) =>
          !prev || (prev.botId !== botTarget && prev.botId) ? prev : clearActiveThreadRuns(prev),
        );
        const currentComputer = computerRef.current;
        if (currentComputer?.busyBotName) {
          commitComputer({ ...currentComputer, busyBotName: null });
        }
      }
      await refreshThreadRef.current(botTarget).catch(() => undefined);
    } finally {
      setSending(false);
    }
  }, [sending, t]);
  const stopTeaching = useCallback(async () => {
    const id = activeBotId.current;
    if (!id || teachBusy) return;
    const recording = taughtSkills.find(
      (skill) => skill.status === "recording" && taughtSkillsBotId === id,
    );
    if (!recording) return;
    setTeachBusy(true);
    try {
      await rpc.skills.stop({ skillId: recording.id });
      await refreshThreadRef.current(id);
      setComputerOpen(false);
    } finally {
      setTeachBusy(false);
    }
  }, [teachBusy, taughtSkills, taughtSkillsBotId]);
  // Transcript and MessageView are memoized; these must stay referentially stable or every
  // Shell state change re-renders the whole transcript.
  const refreshActiveThread = useCallback(async () => {
    const groupId = activeGroupId.current;
    if (groupId) {
      await refreshGroupThreadRef.current(groupId);
      return;
    }
    const id = activeBotId.current;
    if (!id) return;
    await refreshThreadRef.current(id);
  }, []);
  // Teach chrome needs skills applied before this resolves — refreshThread only
  // kicks skills.list off in the background, so Stop teaching would never mount
  // if that background call failed or lagged behind local recovery.
  const refreshActiveTeaching = useCallback(async () => {
    const id = activeBotId.current;
    if (!id) return;
    await refreshThreadRef.current(id);
    const skills = await rpc.skills.list({ botId: id });
    if (activeBotId.current !== id) return;
    setTaughtSkills(skills);
    setTaughtSkillsBotId(id);
  }, []);
  const addSkillRoutine = useCallback((name: string, prompt: string) => {
    setRoutineDraft({ ...emptyRoutineDraft(), name, prompt });
    setRoutineWebhookSecret(null);
    setEditingRoutine(null);
    setPanel("routine");
  }, []);
  const speakingMessageIdRef = useRef(speakingMessageId);
  speakingMessageIdRef.current = speakingMessageId;
  const speakMessage = useCallback((message: ThreadMessage) => {
    if (speakingMessageIdRef.current === message.id) {
      speaker.stop();
      return;
    }
    const text = speechFromBlocks(message.blocks);
    const id = message.botId ?? activeBotId.current;
    if (text && id) void speaker.speak(text, { botId: id, messageId: message.id });
  }, []);

  return {
    answerMessage,
    reactToMessage,
    onAttachmentPick,
    removeAttachment,
    sendMessage,
    followUpMessage,
    stopRun,
    stopTeaching,
    refreshActiveThread,
    refreshActiveTeaching,
    addSkillRoutine,
    speakMessage,
  };
}
