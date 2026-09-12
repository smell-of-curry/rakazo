import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkillCatalogEntry,
  Bot,
  ComputerMode,
  Me,
  ModelCatalogEntry,
  ModelCredential,
  ThinkingLevel,
  VoiceInfo,
} from "@rakazo/contracts";
import {
  AvatarShapeSchema,
  BOT_AVATAR_MAX_BYTES,
  BOT_DESCRIPTION_MAX_LENGTH,
  BOT_INSTRUCTIONS_MAX_LENGTH,
  BOT_NAME_MAX_LENGTH,
  BOT_TITLE_MAX_LENGTH,
} from "@rakazo/contracts";
import { AVATAR_COLORS } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
  Toggle,
} from "@rakazo/ui-web";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { AvatarStudio } from "./avatar-studio";
import {
  ComputerModePicker,
  DangerRow,
  fieldInputClass,
  fieldLabelClass,
  SettingsHeader,
  SettingsSection,
} from "./settings-fields";
import { useDebouncedSave } from "./use-debounced-save";

const ScratchpadSection = lazy(() =>
  import("../ScratchpadSection").then((module) => ({ default: module.ScratchpadSection })),
);

const KnowledgeSection = lazy(() =>
  import("../KnowledgeSection").then((module) => ({ default: module.KnowledgeSection })),
);

export type BotSettingsPatch = {
  name?: string;
  title?: string;
  description?: string;
  instructions?: string;
  computerMode?: ComputerMode;
  memoryScope?: "isolated" | "shared" | null;
  notifyOnFinish?: boolean;
  autoSpeak?: boolean;
  voiceId?: string | null;
  modelProvider?: string | null;
  modelId?: string | null;
  thinkingLevel?: ThinkingLevel | null;
};

export function BotSettings({
  bot,
  memoryProviderConfigured,
  onSkillsChange,
  onAvatarChange,
  onSave,
  onExport,
  onClear,
  onDelete,
}: {
  bot: Bot;
  onSkillsChange: (skills: AgentSkillCatalogEntry[]) => void;
  memoryProviderConfigured: boolean;
  onAvatarChange?: () => void | Promise<void>;
  onSave: (patch: BotSettingsPatch) => Promise<Bot | undefined>;
  onExport: () => Promise<void>;
  onClear: () => void;
  onDelete: () => void;
}) {
  const { t } = useLingui();
  const [advancedOpened, setAdvancedOpened] = useState(false);
  const ids = useId();
  const [name, setName] = useState(bot.name);
  const [title, setTitle] = useState(bot.title);
  const [description, setDescription] = useState(bot.description);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [color, setColor] = useState(bot.color);
  const [avatarShape, setAvatarShape] = useState(bot.avatarShape);
  const [computerMode, setComputerMode] = useState(bot.computerMode);
  const [memoryScope, setMemoryScope] = useState(bot.memoryScope);
  const [notifyOnFinish, setNotifyOnFinish] = useState(bot.notifyOnFinish);
  const [autoSpeak, setAutoSpeak] = useState(bot.autoSpeak);
  const [voiceId, setVoiceId] = useState(bot.voiceId ?? "");
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [modelKey, setModelKey] = useState(
    bot.modelProvider && bot.modelId ? modelOptionKey(bot.modelProvider, bot.modelId) : "",
  );
  const [thinkingLevel, setThinkingLevel] = useState(bot.thinkingLevel ?? "");
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [modelMetaReady, setModelMetaReady] = useState(false);
  const [hasAvatar, setHasAvatar] = useState(bot.hasAvatar);
  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState(bot.updatedAt);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | undefined>();
  const [computerBusy, setComputerBusy] = useState<"recover" | "reset" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const localAvatarUrlRef = useRef<string | undefined>(undefined);
  const { queue, flush, saved, error, setError } = useDebouncedSave(async (patch) => {
    const updated = await onSave(patch);
    if (!updated) return;
    // Only echo fields this save wrote. Color/shape persist via their own RPC
    // and must not be clobbered by a stale title/description response.
    if (patch.name !== undefined) setName(updated.name);
    if (patch.title !== undefined) setTitle(updated.title);
    if (patch.description !== undefined) setDescription(updated.description);
    if (patch.instructions !== undefined) setInstructions(updated.instructions);
    if (patch.computerMode !== undefined) setComputerMode(updated.computerMode);
    if (patch.memoryScope !== undefined) setMemoryScope(updated.memoryScope);
    if (patch.notifyOnFinish !== undefined) setNotifyOnFinish(updated.notifyOnFinish);
    if (patch.autoSpeak !== undefined) setAutoSpeak(updated.autoSpeak);
    if (patch.voiceId !== undefined) setVoiceId(updated.voiceId ?? "");
  });

  useEffect(() => {
    setHasAvatar(bot.hasAvatar);
    setAvatarUpdatedAt(bot.updatedAt);
  }, [bot.hasAvatar, bot.updatedAt]);
  useEffect(() => {
    return () => {
      if (localAvatarUrlRef.current) URL.revokeObjectURL(localAvatarUrlRef.current);
    };
  }, []);
  useEffect(() => {
    void rpc.voice
      .voices({})
      .then(setVoices)
      .catch(() => setVoices([]));
    void Promise.all([rpc.models.credentials(), rpc.models.list(), rpc.me()])
      .then(([nextCredentials, nextCatalog, nextMe]) => {
        setCredentials(nextCredentials);
        setCatalog(nextCatalog);
        setMe(nextMe);
        setModelMetaReady(true);
      })
      .catch(() => undefined);
  }, []);

  const connectedOptions = connectedModelOptions(credentials, catalog);
  const effectiveProvider = modelKey
    ? parseModelOptionKey(modelKey)?.provider
    : (me?.defaultProvider ?? null);
  const effectiveModelId = modelKey
    ? parseModelOptionKey(modelKey)?.modelId
    : (me?.defaultModel ?? null);
  const effectiveEntry =
    effectiveProvider && effectiveModelId
      ? catalog.find(
          (entry) => entry.provider === effectiveProvider && entry.id === effectiveModelId,
        )
      : undefined;
  const effectiveCredential = credentials.find(
    (entry) => entry.provider === effectiveProvider && entry.modelId === effectiveModelId,
  );
  const thinkingOptions = (
    effectiveCredential?.thinkingLevels ??
    effectiveEntry?.thinkingLevels ??
    []
  ).filter((level) => level !== "off");
  const defaultThinkingLevel = effectiveCredential?.thinkingLevel ?? "medium";
  const avatarSrc =
    localAvatarUrl ?? (hasAvatar ? `/api/bots/${bot.id}/avatar?v=${avatarUpdatedAt}` : undefined);

  function replaceLocalAvatarUrl(next?: string) {
    if (localAvatarUrlRef.current) URL.revokeObjectURL(localAvatarUrlRef.current);
    localAvatarUrlRef.current = next;
    setLocalAvatarUrl(next);
  }

  async function uploadAvatar(file: File) {
    if (file.size > BOT_AVATAR_MAX_BYTES) {
      setError(t`Couldn't update avatars`);
      return;
    }
    replaceLocalAvatarUrl(URL.createObjectURL(file));
    setError(null);
    try {
      const contentBase64 = await readFileAsBase64(file);
      const updated = await rpc.bots.setAvatar({
        botId: bot.id,
        name: file.name,
        mimeType: file.type || "image/jpeg",
        contentBase64,
      });
      replaceLocalAvatarUrl();
      setHasAvatar(updated.hasAvatar);
      setAvatarUpdatedAt(updated.updatedAt);
      await onAvatarChange?.();
    } catch (err) {
      replaceLocalAvatarUrl();
      setError(err instanceof Error ? err.message : t`Couldn't update avatars`);
    }
  }

  async function removeAvatar() {
    setError(null);
    try {
      const updated = await rpc.bots.update({ botId: bot.id, clearAvatar: true });
      replaceLocalAvatarUrl();
      setHasAvatar(updated.hasAvatar);
      setAvatarUpdatedAt(updated.updatedAt);
      await onAvatarChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Couldn't update avatars`);
    }
  }

  async function runComputer(action: "recover" | "reset") {
    setComputerBusy(action);
    try {
      if (action === "recover") await rpc.computer.recover({ botId: bot.id });
      else await rpc.computer.reset({ botId: bot.id });
      setResetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not update computer`);
    } finally {
      setComputerBusy(null);
    }
  }

  function queueModel(nextKey: string) {
    setModelKey(nextKey);
    setThinkingLevel("");
    const selected = nextKey ? parseModelOptionKey(nextKey) : null;
    queue({
      modelProvider: selected?.provider ?? null,
      modelId: selected?.modelId ?? null,
      ...(modelMetaReady ? { thinkingLevel: null } : {}),
    });
  }

  return (
    <div data-testid="bot-settings">
      <SettingsHeader saved={saved} />
      <SettingsSection title={<Trans>Profile</Trans>} testId="bot-settings-section-profile">
        <div className="flex justify-center">
          <AvatarStudio
            identity={bot.id}
            color={color}
            shape={avatarShape}
            imageSrc={avatarSrc}
            onColorChange={(next) => {
              setColor(next);
              void rpc.bots.update({ botId: bot.id, color: next }).then(() => onAvatarChange?.());
            }}
            onShapeChange={(next) => {
              const parsed = AvatarShapeSchema.safeParse(next);
              if (!parsed.success) return;
              setAvatarShape(parsed.data);
              void rpc.bots
                .update({ botId: bot.id, avatarShape: parsed.data })
                .then(() => onAvatarChange?.());
            }}
            onUpload={(file) => void uploadAvatar(file)}
            onReset={() => {
              const nextColor = AVATAR_COLORS[0]?.hex ?? color;
              setColor(nextColor);
              setAvatarShape("hexagon");
              void rpc.bots
                .update({ botId: bot.id, color: nextColor, avatarShape: "hexagon" })
                .then(() => onAvatarChange?.());
              if (hasAvatar) void removeAvatar();
            }}
          />
        </div>
        <label htmlFor={`${ids}-name`} className={fieldLabelClass}>
          <Trans>Name</Trans>
          <Input
            id={`${ids}-name`}
            value={name}
            maxLength={BOT_NAME_MAX_LENGTH}
            onChange={(e) => {
              setName(e.target.value);
              const next = e.target.value.trim();
              if (next) queue({ name: next });
            }}
            onBlur={() => void flush()}
            className={fieldInputClass}
          />
        </label>
        <label htmlFor={`${ids}-title`} className={fieldLabelClass}>
          <Trans>Title</Trans>
          <Input
            id={`${ids}-title`}
            value={title}
            maxLength={BOT_TITLE_MAX_LENGTH}
            onChange={(e) => {
              setTitle(e.target.value);
              queue({ title: e.target.value.trim() });
            }}
            onBlur={() => void flush()}
            className={fieldInputClass}
          />
        </label>
        <label htmlFor={`${ids}-description`} className={fieldLabelClass}>
          <Trans>Description</Trans>
          <Textarea
            id={`${ids}-description`}
            value={description}
            maxLength={BOT_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => {
              setDescription(e.target.value);
              queue({ description: e.target.value.trim() });
            }}
            onBlur={() => void flush()}
            rows={3}
            className={fieldInputClass}
          />
        </label>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Instructions</Trans>}
        testId="bot-settings-section-instructions"
      >
        <label htmlFor={`${ids}-instructions`} className={fieldLabelClass}>
          <Trans>Instructions</Trans>
          <Textarea
            id={`${ids}-instructions`}
            value={instructions}
            maxLength={BOT_INSTRUCTIONS_MAX_LENGTH}
            onChange={(e) => {
              setInstructions(e.target.value);
              queue({ instructions: e.target.value.trim() });
            }}
            onBlur={() => void flush()}
            rows={5}
            className={fieldInputClass}
          />
        </label>
      </SettingsSection>

      <SettingsSection title={<Trans>Model</Trans>} testId="bot-settings-section-model">
        <label htmlFor={`${ids}-model`} className={fieldLabelClass}>
          <Trans>Model</Trans>
          <NativeSelect
            id={`${ids}-model`}
            className={`${fieldInputClass} w-full`}
            value={modelKey}
            onChange={(event) => queueModel(event.target.value)}
          >
            <NativeSelectOption value="">
              {t`Space default`}
              {me?.defaultModel
                ? ` (${catalogLabel(catalog, me.defaultProvider, me.defaultModel) ?? me.defaultModel})`
                : ""}
            </NativeSelectOption>
            {modelKey && !connectedOptions.some((option) => option.key === modelKey) ? (
              <NativeSelectOption value={modelKey}>
                {parseModelOptionKey(modelKey)?.modelId ?? modelKey}
              </NativeSelectOption>
            ) : null}
            {connectedOptions.map((option) => (
              <NativeSelectOption key={option.key} value={option.key}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        {thinkingOptions.length ? (
          <label htmlFor={`${ids}-thinking`} className={fieldLabelClass}>
            <Trans>Thinking</Trans>
            <NativeSelect
              id={`${ids}-thinking`}
              className={`${fieldInputClass} w-full`}
              value={thinkingLevel}
              onChange={(event) => {
                const next = event.target.value;
                setThinkingLevel(next);
                if (modelMetaReady) {
                  queue({ thinkingLevel: (next || null) as ThinkingLevel | null });
                }
              }}
            >
              <NativeSelectOption value="">
                {t`Default (${thinkingLevelLabel(defaultThinkingLevel)})`}
              </NativeSelectOption>
              {thinkingOptions.map((level) => (
                <NativeSelectOption key={level} value={level}>
                  {thinkingLevelLabel(level)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        {memoryProviderConfigured ? (
          <div className={fieldLabelClass}>
            <Trans>Memory scope</Trans>
            <div className="mt-2 flex gap-2">
              {(
                [
                  { value: null, label: t`Inherit default` },
                  { value: "isolated" as const, label: t`Isolated` },
                  { value: "shared" as const, label: t`Shared` },
                ] satisfies Array<{ value: "isolated" | "shared" | null; label: string }>
              ).map((option) => (
                <Toggle
                  key={option.label}
                  variant="outline"
                  size="sm"
                  pressed={memoryScope === option.value}
                  onPressedChange={(pressed) => {
                    if (!pressed) return;
                    setMemoryScope(option.value);
                    queue({ memoryScope: option.value });
                  }}
                  className="flex-1 text-body aria-pressed:border-foreground/40 aria-pressed:text-foreground"
                >
                  {option.label}
                </Toggle>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title={<Trans>Computer</Trans>} testId="bot-settings-section-computer">
        <ComputerModePicker
          value={computerMode}
          onChange={(next) => {
            setComputerMode(next);
            queue({ computerMode: next });
          }}
          teamTestId="bot-settings-team"
          privateTestId="bot-settings-private"
        />
        <button
          type="button"
          className="block py-1.5 text-start text-body text-foreground"
          disabled={computerBusy !== null}
          onClick={() => void runComputer("recover")}
        >
          {computerBusy === "recover" ? <Trans>Recovering…</Trans> : <Trans>Recover</Trans>}
        </button>
        <button
          type="button"
          className="block py-1.5 text-start text-body text-foreground"
          disabled={computerBusy !== null}
          onClick={() => setResetOpen(true)}
        >
          <Trans>Reset</Trans>
        </button>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Notifications</Trans>}
        testId="bot-settings-section-notifications"
      >
        <Switch
          aria-label={t`Notifications`}
          checked={notifyOnFinish}
          onCheckedChange={(checked) => {
            setNotifyOnFinish(checked);
            queue({ notifyOnFinish: checked });
          }}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Danger</Trans>} testId="bot-settings-section-danger">
        <DangerRow testId="bot-settings-clear" onClick={onClear}>
          <Trans>Clear conversation</Trans>
        </DangerRow>
        <DangerRow testId="bot-settings-delete" onClick={onDelete}>
          <Trans>Delete bot</Trans>
        </DangerRow>
      </SettingsSection>

      <details
        data-testid="bot-settings-advanced"
        className="group mt-6"
        onToggle={(event) => {
          if (event.currentTarget.open) setAdvancedOpened(true);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-small text-muted-foreground">
          <span>
            <Trans>Advanced</Trans>
          </span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        {advancedOpened ? (
          <Suspense fallback={null}>
            <ScratchpadSection botId={bot.id} />
            <KnowledgeSection botId={bot.id} onSkillsChange={onSkillsChange} />
          </Suspense>
        ) : null}
        <label
          htmlFor={`${ids}-auto-speak`}
          className="mt-5 flex cursor-pointer items-center gap-3 text-small text-foreground"
        >
          <Switch
            id={`${ids}-auto-speak`}
            checked={autoSpeak}
            onCheckedChange={(checked) => {
              setAutoSpeak(checked);
              queue({ autoSpeak: checked });
            }}
          />
          <Trans>Read replies aloud</Trans>
        </label>
        {voices.length ? (
          <label htmlFor={`${ids}-voice`} className={`${fieldLabelClass} mt-4`}>
            <Trans>Voice</Trans>
            <NativeSelect
              id={`${ids}-voice`}
              className={`${fieldInputClass} w-full`}
              value={voiceId}
              onChange={(event) => {
                setVoiceId(event.target.value);
                queue({ voiceId: event.target.value || null });
              }}
            >
              <NativeSelectOption value="">{t`Account default`}</NativeSelectOption>
              {voices.map((voice) => (
                <NativeSelectOption key={voice.id} value={voice.id}>
                  {voice.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <button
          type="button"
          className="mt-4 block py-1.5 text-start text-body text-foreground"
          onClick={() => void onExport()}
        >
          <Trans>Export</Trans>
        </button>
      </details>

      {error ? <p className="mt-3 text-small text-destructive">{error}</p> : null}

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Reset computer?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>Unsaved work on the computer is lost.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={computerBusy !== null}
              onClick={() => void runComputer("reset")}
            >
              {computerBusy === "reset" ? <Trans>Resetting…</Trans> : <Trans>Reset</Trans>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? (result.split(",")[1] ?? "") : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function modelOptionKey(provider: string, modelId: string) {
  return `${provider}::${modelId}`;
}

function thinkingLevelLabel(level: ThinkingLevel) {
  if (level === "xhigh") return t`Extra high`;
  if (level === "low") return t`Low`;
  if (level === "medium") return t`Medium`;
  if (level === "high") return t`High`;
  if (level === "minimal") return t`Minimal`;
  if (level === "max") return t`Max`;
  return `${level.slice(0, 1).toUpperCase()}${level.slice(1)}`;
}

function parseModelOptionKey(key: string) {
  const separator = key.indexOf("::");
  if (separator <= 0) return null;
  return { provider: key.slice(0, separator), modelId: key.slice(separator + 2) };
}

function catalogLabel(
  catalog: ModelCatalogEntry[],
  provider: string | null | undefined,
  modelId: string,
) {
  if (!provider) return undefined;
  return catalog.find((entry) => entry.provider === provider && entry.id === modelId)?.label;
}

function connectedModelOptions(credentials: ModelCredential[], catalog: ModelCatalogEntry[]) {
  const options: Array<{ key: string; provider: string; modelId: string; label: string }> = [];
  const seen = new Set<string>();
  for (const credential of credentials) {
    const providerModels = catalog.filter(
      (entry) => entry.provider === credential.provider && !entry.placeholder,
    );
    const credentialInCatalog = Boolean(
      credential.modelId && providerModels.some((entry) => entry.id === credential.modelId),
    );
    const next =
      credential.modelId && !credentialInCatalog
        ? [
            {
              key: modelOptionKey(credential.provider, credential.modelId),
              provider: credential.provider,
              modelId: credential.modelId,
              label: `${credential.label} · ${credential.modelId}`,
            },
          ]
        : providerModels.map((entry) => ({
            key: modelOptionKey(entry.provider, entry.id),
            provider: entry.provider,
            modelId: entry.id,
            label: `${entry.providerName ?? entry.provider} · ${entry.label}`,
          }));
    for (const option of next) {
      if (seen.has(option.key)) continue;
      seen.add(option.key);
      options.push(option);
    }
  }
  return options;
}
