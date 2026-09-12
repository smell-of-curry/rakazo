import { Trans, useLingui } from "@lingui/react/macro";
import { type Bot, GROUP_MEMBER_MAX, GROUP_MEMBER_MIN, type Group } from "@rakazo/contracts";
import { BotAvatar, Button, Input } from "@rakazo/ui-web";
import { Check, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import {
  DangerRow,
  fieldInputClass,
  fieldLabelClass,
  SettingsHeader,
  SettingsSection,
} from "./shell/settings-fields";
import { useDebouncedSave } from "./shell/use-debounced-save";

function validSelection(name: string, selected: readonly string[]) {
  return (
    Boolean(name.trim()) &&
    selected.length >= GROUP_MEMBER_MIN &&
    selected.length <= GROUP_MEMBER_MAX
  );
}

function sameMembers(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

function MemberPicker({
  bots,
  selected,
  onChange,
  maxHeight,
}: {
  bots: Bot[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxHeight: "max-h-[240px]" | "max-h-[280px]";
}) {
  const selectable = useMemo(() => bots.filter((bot) => !bot.archivedAt), [bots]);

  function toggle(botId: string) {
    if (selected.includes(botId)) {
      onChange(selected.filter((id) => id !== botId));
    } else if (selected.length < GROUP_MEMBER_MAX) {
      onChange([...selected, botId]);
    }
  }

  return (
    <div className={`mt-2 ${maxHeight} space-y-1 overflow-y-auto`}>
      {selectable.map((bot) => {
        const checked = selected.includes(bot.id);
        return (
          <button
            key={bot.id}
            type="button"
            aria-pressed={checked}
            onClick={() => toggle(bot.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start ${
              checked ? "bg-muted" : "hover:bg-accent"
            }`}
          >
            <BotAvatar color={bot.color} shape={bot.avatarShape} identity={bot.id} size={32} />
            <span className="flex-1 text-body text-foreground" dir="auto">
              {bot.name}
            </span>
            {checked ? <Check size={14} className="text-muted-foreground" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function CreateGroupForm({
  bots,
  onCancel,
  onCreate,
}: {
  bots: Bot[];
  onCancel: () => void;
  onCreate: (input: { name: string; botIds: string[] }) => Promise<void>;
}) {
  const { t } = useLingui();
  const nameId = useId();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (submitting || !validSelection(name, selected)) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), botIds: selected });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t`Could not create group`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-title font-semibold text-foreground">
          <Trans>New group</Trans>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t`Cancel new group`}
          onClick={onCancel}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      <label htmlFor={nameId} className={fieldLabelClass}>
        <Trans>Name</Trans>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t`Crew`}
          className={fieldInputClass}
        />
      </label>
      <div className={`${fieldLabelClass} mt-5`}>
        <Trans>Members</Trans>
      </div>
      <MemberPicker
        bots={bots}
        selected={selected}
        onChange={setSelected}
        maxHeight="max-h-[280px]"
      />
      <Button
        className="mt-5 w-full"
        disabled={submitting || !validSelection(name, selected)}
        onClick={() => void create()}
      >
        {submitting ? <Trans>Creating…</Trans> : <Trans>Create group</Trans>}
      </Button>
    </div>
  );
}

export function GroupSettings({
  group,
  bots,
  onSave,
  onRemove,
}: {
  group: Group;
  bots: Bot[];
  onSave: (input: { name?: string; botIds?: string[] }) => Promise<void>;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const nameId = useId();
  const [name, setName] = useState(group.name);
  const [selected, setSelected] = useState(group.members.map((member) => member.botId));
  const nameRef = useRef(name);
  const selectedRef = useRef(selected);
  nameRef.current = name;
  selectedRef.current = selected;

  const { queue, flush, saved, error, setError } = useDebouncedSave<{
    name?: string;
    botIds?: string[];
  }>(async () => {
    const nextName = nameRef.current.trim();
    const nextSelected = selectedRef.current;
    if (!validSelection(nextName, nextSelected)) {
      throw new Error(t`Could not save group`);
    }
    await onSave({
      name: nextName !== group.name ? nextName : undefined,
      botIds: sameMembers(
        nextSelected,
        group.members.map((member) => member.botId),
      )
        ? undefined
        : nextSelected,
    });
  });

  return (
    <div data-testid="group-settings">
      <SettingsHeader saved={saved} />
      {error ? (
        <p role="alert" className="mb-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      <SettingsSection title={<Trans>Profile</Trans>} testId="group-settings-section-profile">
        <label htmlFor={nameId} className={fieldLabelClass}>
          <Trans>Name</Trans>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              queue({ name: e.target.value.trim() });
            }}
            onBlur={() => void flush()}
            className={fieldInputClass}
          />
        </label>
        <div className={fieldLabelClass}>
          <Trans>Members</Trans>
        </div>
        <MemberPicker
          bots={bots}
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            queue({ botIds: next });
          }}
          maxHeight="max-h-[240px]"
        />
      </SettingsSection>
      <SettingsSection title={<Trans>Danger</Trans>} testId="group-settings-section-danger">
        <DangerRow testId="group-settings-delete" onClick={onRemove}>
          <Trans>Delete group</Trans>
        </DangerRow>
      </SettingsSection>
    </div>
  );
}

export function memberName(
  members: Group["members"] | undefined,
  botId: string | undefined,
): string | undefined {
  if (!botId || !members) return undefined;
  return members.find((member) => member.botId === botId)?.name;
}
