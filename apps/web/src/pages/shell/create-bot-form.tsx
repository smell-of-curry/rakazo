import { Trans, useLingui } from "@lingui/react/macro";
import type { AvatarShape, ComputerMode } from "@rakazo/contracts";
import { BOT_NAME_MAX_LENGTH, BOT_TITLE_MAX_LENGTH } from "@rakazo/contracts";
import { AVATAR_COLORS, AVATAR_SHAPE_KEYS } from "@rakazo/core";
import { BotAvatar, Button, Input } from "@rakazo/ui-web";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { fieldInputClass, fieldLabelClass } from "./settings-fields";

export type CreateBotFormValues = {
  name: string;
  title: string;
  description: string;
  computerMode: ComputerMode;
  color: string;
  avatarShape: AvatarShape;
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0]!;
}

export function CreateBotForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: CreateBotFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const ids = useId();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [color] = useState(() => pickRandom(AVATAR_COLORS).hex);
  const [avatarShape] = useState(() => pickRandom(AVATAR_SHAPE_KEYS));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        title: title.trim(),
        description: "",
        computerMode: "team",
        color,
        avatarShape,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not create bot`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="create-bot-form">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-title font-semibold text-foreground">
          <Trans>New bot</Trans>
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label={t`Cancel new bot`} onClick={onCancel}>
          <X size={16} strokeWidth={1.8} />
        </Button>
      </div>
      {error ? (
        <p role="alert" data-testid="create-bot-error" className="mb-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-center py-2">
        <BotAvatar
          color={color}
          shape={avatarShape}
          identity={name.trim() || "new-bot"}
          size={72}
        />
      </div>
      <label htmlFor={`${ids}-name`} className={fieldLabelClass}>
        <Trans>Name</Trans>
        <Input
          id={`${ids}-name`}
          value={name}
          maxLength={BOT_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          placeholder={t`Maya`}
          className={fieldInputClass}
        />
      </label>
      <label htmlFor={`${ids}-title`} className={`${fieldLabelClass} mt-4`}>
        <Trans>Title</Trans>
        <Input
          id={`${ids}-title`}
          value={title}
          maxLength={BOT_TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t`Research lead`}
          className={fieldInputClass}
        />
      </label>
      <Button
        className="mt-5"
        disabled={!name.trim() || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? <Trans>Creating…</Trans> : <Trans>Create</Trans>}
      </Button>
    </div>
  );
}
