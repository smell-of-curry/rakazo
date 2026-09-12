import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ModelCatalogEntry, ModelCredential, Routine, ThinkingLevel } from "@rakazo/contracts";
import { ThinkingLevelSchema } from "@rakazo/contracts";
import { type CronFreq, type CronPreset, cronFromPreset, defaultCronPreset } from "@rakazo/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@rakazo/ui-web";
import { ChevronLeft, Clock, GitBranch, Globe, MessageSquare, Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { RoutineSchedule } from "./RoutineSchedule";
import {
  draftFromRoutine,
  emptyRoutineDraft,
  type RoutineDraftState,
  routineNeedsOneShotArm,
} from "./routine-draft";
import { RoutineListHeader, RoutineListRow, routineTriggerSummary } from "./routine-list";

export type { RoutineDraftState };
export {
  draftFromRoutine,
  emptyRoutineDraft,
  RoutineListHeader,
  RoutineListRow,
  routineNeedsOneShotArm,
  routineTriggerSummary,
};

const SCHEDULE_PRESETS: CronFreq[] = [
  "Every hour",
  "Every day",
  "Weekdays",
  "Every week",
  "Every month",
  "Interval",
  "Advanced",
];

const COMING_SOON = [
  { id: "teams", label: () => t`Teams message` },
  { id: "linear", label: () => t`Linear issue` },
  { id: "sentry", label: () => t`Sentry alert` },
  { id: "pagerduty", label: () => t`PagerDuty incident` },
] as const;

export function RoutineEditor({
  draft,
  onChange,
  editing,
  timezone,
  webhook,
  githubPath,
  messageProviders,
  saving,
  running,
  error,
  onBack,
  onClose,
  onSave,
  onTestRun,
  onDelete,
  onEnsureWebhook,
}: {
  draft: RoutineDraftState;
  onChange: (next: RoutineDraftState) => void;
  editing: Routine | null;
  timezone: string;
  webhook: { path: string; secret: string | null; configured: boolean };
  githubPath: string;
  messageProviders: string[];
  saving: boolean;
  running: boolean;
  error: string | null;
  onBack: () => void;
  onClose: () => void;
  onSave: () => void;
  onTestRun: () => void;
  onDelete: () => void;
  onEnsureWebhook: () => Promise<void>;
}) {
  const { t } = useLingui();
  const fieldId = useId();
  const [credentials, setCredentials] = useState<ModelCredential[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  useEffect(() => {
    void Promise.all([rpc.models.credentials(), rpc.models.list()])
      .then(([nextCredentials, nextCatalog]) => {
        setCredentials(nextCredentials);
        setCatalog(nextCatalog);
      })
      .catch(() => undefined);
  }, []);
  const modelKey =
    draft.modelProvider && draft.modelId ? modelOptionKey(draft.modelProvider, draft.modelId) : "";
  const connectedOptions: Array<{
    key: string;
    provider: string;
    modelId: string;
    label: string;
  }> = [];
  const seenOptions = new Set<string>();
  for (const credential of credentials) {
    const providerModels = catalog.filter(
      (entry) => entry.provider === credential.provider && !entry.placeholder,
    );
    const credentialInCatalog = Boolean(
      credential.modelId && providerModels.some((entry) => entry.id === credential.modelId),
    );
    const options =
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
    for (const option of options) {
      if (seenOptions.has(option.key)) continue;
      seenOptions.add(option.key);
      connectedOptions.push(option);
    }
  }
  const effectiveProvider = modelKey ? parseModelOptionKey(modelKey)?.provider : null;
  const effectiveModelId = modelKey ? parseModelOptionKey(modelKey)?.modelId : null;
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
  const slackAvailable = messageProviders.includes("slack");
  const slackDisabledReasonId = `${fieldId}-slack-disabled-reason`;
  const hasTriggers =
    draft.schedules.length > 0 ||
    draft.webhookEnabled ||
    draft.githubEnabled ||
    Boolean(draft.messageProvider);
  const canTest = Boolean(editing) && !saving && !running;
  const needsOneShotArm =
    editing != null && routineNeedsOneShotArm(editing, draft.schedules.map(cronFromPreset));

  function addSchedule(freq: CronFreq) {
    const base = defaultCronPreset();
    const next: CronPreset =
      freq === "Advanced" ? { ...base, freq, cron: cronFromPreset(base) } : { ...base, freq };
    onChange({ ...draft, schedules: [...draft.schedules, next] });
  }

  async function addWebhook() {
    onChange({ ...draft, webhookEnabled: true });
    if (!webhook.configured) {
      await onEnsureWebhook().catch(() => undefined);
    }
  }

  async function addGithub() {
    onChange({ ...draft, githubEnabled: true });
    if (!webhook.configured) {
      await onEnsureWebhook().catch(() => undefined);
    }
  }

  function addMessageProvider(provider: string) {
    onChange({ ...draft, messageProvider: provider });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          className="text-muted-foreground"
          aria-label={t`Back`}
        >
          <ChevronLeft />
        </Button>
        <div className="text-title font-semibold text-foreground">
          <Trans>Routine</Trans>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-muted-foreground"
          aria-label={t`Close`}
        >
          <X />
        </Button>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-body text-foreground">
          <button
            type="button"
            role="switch"
            aria-checked={draft.active}
            onClick={() => onChange({ ...draft, active: !draft.active })}
            className={`relative h-[22px] w-[40px] rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              draft.active ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`absolute top-[2px] left-0 h-[18px] w-[18px] rounded-full bg-background transition-transform ${
                draft.active
                  ? "translate-x-[20px] dark:bg-primary-foreground"
                  : "translate-x-[2px] dark:bg-foreground"
              }`}
            />
          </button>
          <Trans>Active</Trans>
        </label>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={saving || running} onClick={onDelete}>
            <Trans>Delete</Trans>
          </Button>
          <Button variant="secondary" disabled={!canTest} onClick={onTestRun}>
            {running ? t`Running…` : t`Test run`}
          </Button>
        </div>
      </div>

      <label htmlFor={`${fieldId}-name`} className="block text-body text-muted-foreground">
        <Trans>Name</Trans>
        <Input
          id={`${fieldId}-name`}
          value={draft.name}
          placeholder={t`Name this routine`}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="mt-2"
        />
      </label>

      <label htmlFor={`${fieldId}-prompt`} className="mt-5 block text-body text-muted-foreground">
        <Trans>Instruction</Trans>
        <Textarea
          id={`${fieldId}-prompt`}
          value={draft.prompt}
          placeholder={t`What should this routine do each time it runs?`}
          onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          rows={4}
          className="mt-2"
        />
      </label>

      <label htmlFor={`${fieldId}-model`} className="mt-5 block text-body text-muted-foreground">
        <Trans>Model</Trans>
        <NativeSelect
          id={`${fieldId}-model`}
          className="mt-2 w-full"
          value={modelKey}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              onChange({ ...draft, modelProvider: null, modelId: null, thinkingLevel: null });
              return;
            }
            const selected = parseModelOptionKey(value);
            if (!selected) return;
            onChange({
              ...draft,
              modelProvider: selected.provider,
              modelId: selected.modelId,
              thinkingLevel: null,
            });
          }}
        >
          <NativeSelectOption value="">
            <Trans>Same as bot</Trans>
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
      {modelKey && thinkingOptions.length ? (
        <label
          htmlFor={`${fieldId}-thinking`}
          className="mt-5 block text-body text-muted-foreground"
        >
          <Trans>Thinking</Trans>
          <NativeSelect
            id={`${fieldId}-thinking`}
            className="mt-2 w-full"
            value={draft.thinkingLevel ?? ""}
            onChange={(event) => {
              const parsed = ThinkingLevelSchema.safeParse(event.target.value);
              onChange({ ...draft, thinkingLevel: parsed.success ? parsed.data : null });
            }}
          >
            <NativeSelectOption value="">{t`Default (medium)`}</NativeSelectOption>
            {thinkingOptions.map((level) => (
              <NativeSelectOption key={level} value={level}>
                {thinkingLevelLabel(level)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      ) : null}

      <div className="mt-5 text-body text-muted-foreground">
        <div className="flex items-baseline gap-2">
          <Trans>When to run</Trans>
          <span className="text-small text-muted-foreground">{timezone}</span>
        </div>

        <div className="mt-2 space-y-2">
          {draft.schedules.map((preset, index) => (
            <div key={index} className="relative">
              <RoutineSchedule
                value={preset}
                onChange={(next) =>
                  onChange({
                    ...draft,
                    schedules: draft.schedules.map((item, i) => (i === index ? next : item)),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t`Remove schedule`}
                onClick={() =>
                  onChange({
                    ...draft,
                    schedules: draft.schedules.filter((_, i) => i !== index),
                  })
                }
                className="absolute top-2 right-2 text-muted-foreground"
              >
                <X />
              </Button>
            </div>
          ))}

          {draft.webhookEnabled ? (
            <InboundTriggerCard
              kind="webhook"
              saved={Boolean(editing)}
              path={webhook.path}
              secret={webhook.secret}
              configured={webhook.configured}
              onRemove={() => onChange({ ...draft, webhookEnabled: false })}
              onRotate={() => void onEnsureWebhook()}
            />
          ) : null}

          {draft.githubEnabled ? (
            <InboundTriggerCard
              kind="github"
              saved={Boolean(editing)}
              path={githubPath}
              secret={webhook.secret}
              configured={webhook.configured}
              onRemove={() => onChange({ ...draft, githubEnabled: false })}
              onRotate={() => void onEnsureWebhook()}
            />
          ) : null}

          {draft.messageProvider ? (
            <MessageTriggerCard
              provider={draft.messageProvider}
              onRemove={() => onChange({ ...draft, messageProvider: null })}
            />
          ) : null}

          {needsOneShotArm ? (
            <label htmlFor={`${fieldId}-run-at`} className="block text-body text-muted-foreground">
              <Trans>Run at</Trans>
              <Input
                id={`${fieldId}-run-at`}
                type="datetime-local"
                value={draft.runAtLocal}
                onChange={(e) => onChange({ ...draft, runAtLocal: e.target.value })}
                aria-label={t`Run at`}
                className="mt-2"
              />
            </label>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="mt-2 h-auto w-full rounded-xl py-3" />}
          >
            <Plus />
            <Trans>Add trigger</Trans>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Clock />
                <Trans>On a schedule</Trans>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[170px]">
                {SCHEDULE_PRESETS.map((freq) => (
                  <DropdownMenuItem key={freq} onClick={() => addSchedule(freq)}>
                    {schedulePresetLabel(freq)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <span className="block" title={slackAvailable ? undefined : t`Slack not enabled`}>
              <DropdownMenuItem
                disabled={draft.messageProvider === "slack" || !slackAvailable}
                aria-describedby={slackAvailable ? undefined : slackDisabledReasonId}
                onClick={() => addMessageProvider("slack")}
              >
                <MessageSquare />
                <Trans>Slack message</Trans>
              </DropdownMenuItem>
              {!slackAvailable ? (
                <span id={slackDisabledReasonId} className="sr-only">
                  <Trans>Slack not enabled</Trans>
                </span>
              ) : null}
            </span>

            {COMING_SOON.map((item) => (
              <span
                key={item.id}
                className="block"
                title={item.id === "teams" ? t`Teams not enabled` : t`Coming soon`}
              >
                <DropdownMenuItem disabled>
                  <span aria-hidden className="inline-block size-3.5 rounded-sm bg-muted" />
                  {item.label()}
                </DropdownMenuItem>
              </span>
            ))}

            <DropdownMenuItem disabled={draft.githubEnabled} onClick={() => void addGithub()}>
              <GitBranch />
              <Trans>Git event</Trans>
            </DropdownMenuItem>

            <DropdownMenuItem disabled={draft.webhookEnabled} onClick={() => void addWebhook()}>
              <Globe />
              <Trans>Webhook</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5">
        <Button disabled={saving || running || !hasTriggers} onClick={onSave}>
          {saving ? t`Saving…` : t`Save`}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-body text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-8 text-body text-muted-foreground">
        <Trans>Run history</Trans>
        <p className="mt-2 text-small text-muted-foreground">
          <Trans>No runs yet</Trans>
        </p>
      </div>
    </div>
  );
}

function MessageTriggerCard({ provider, onRemove }: { provider: string; onRemove: () => void }) {
  const { t } = useLingui();
  const label =
    provider === "slack"
      ? t`Slack message`
      : provider === "teams"
        ? t`Teams message`
        : t`Message event`;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2.5 px-0.5">
        <MessageSquare size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        <span className="flex-1 text-body text-foreground">{label}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t`Remove message trigger`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

function InboundTriggerCard({
  kind,
  saved,
  path,
  secret,
  configured,
  onRemove,
  onRotate,
}: {
  kind: "webhook" | "github";
  saved: boolean;
  path: string;
  secret: string | null;
  configured: boolean;
  onRemove: () => void;
  onRotate: () => void;
}) {
  const { t } = useLingui();
  const pending = !saved;
  const placeholder = t`Available after the routine is saved`;
  // GitHub delivery URL and signature header are fixed by bot id / protocol, so show
  // them before save. The shared secret still needs a saved routine to mint.
  const postValue = kind === "github" || !pending ? path : placeholder;
  const keyValue = pending
    ? placeholder
    : (secret ?? (configured ? t`Saved. Rotate to reveal.` : placeholder));
  const headerValue =
    kind === "github"
      ? "X-Hub-Signature-256: sha256=…"
      : pending
        ? placeholder
        : secret
          ? `Authorization: Bearer ${secret}`
          : configured
            ? "Authorization: Bearer …"
            : placeholder;
  const cellClass =
    "break-all rounded-lg bg-muted px-2.5 py-1.5 font-mono text-small text-foreground";

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2.5 px-0.5">
        {kind === "github" ? (
          <GitBranch size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        ) : (
          <Globe size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        )}
        <span className="flex-1 text-body text-foreground">
          {kind === "github" ? <Trans>Git event</Trans> : <Trans>When a webhook fires</Trans>}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={kind === "github" ? t`Remove Git event` : t`Remove webhook`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      <div className="mt-2.5 space-y-2.5 text-small">
        <div className="block text-muted-foreground">
          <Trans>POST to</Trans>
          <div className={`mt-1 ${cellClass}`}>{postValue}</div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="shrink-0">
            <Trans>key</Trans>
          </span>
          <div className={`min-w-0 flex-1 ${cellClass}`}>{keyValue}</div>
        </div>
        <div className="block text-muted-foreground">
          <Trans>header</Trans>
          <div className={`mt-1 ${cellClass}`}>{headerValue}</div>
        </div>
        {saved && configured && !secret ? (
          <Button
            variant="link"
            size="xs"
            onClick={onRotate}
            className="px-0 text-muted-foreground"
          >
            <Trans>Rotate key</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function schedulePresetLabel(freq: CronFreq): string {
  switch (freq) {
    case "Every hour":
      return t`Every hour`;
    case "Every day":
      return t`Every day`;
    case "Weekdays":
      return t`Weekdays`;
    case "Every week":
      return t`Every week`;
    case "Every month":
      return t`Every month`;
    case "Interval":
      return t`Interval`;
    case "Advanced":
      return t`Advanced...`;
    default:
      return freq;
  }
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
