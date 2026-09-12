import { Trans } from "@lingui/react/macro";
import type { ComputerMode } from "@rakazo/contracts";
import { Toggle } from "@rakazo/ui-web";
import type { ReactNode } from "react";

export const fieldLabelClass = "block text-small text-muted-foreground";
export const fieldInputClass = "mt-2 text-body";

export function SettingsSection({
  title,
  testId,
  children,
}: {
  title: ReactNode;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="mt-6 first:mt-0">
      <h3 className="text-title font-semibold text-foreground">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function SettingsHeader({ saved }: { saved: boolean }) {
  return (
    <div className="mb-1 flex h-5 items-center justify-end">
      {saved ? (
        <span data-testid="settings-saved" className="text-caption text-muted-foreground">
          <Trans>Saved</Trans>
        </span>
      ) : null}
    </div>
  );
}

export function DangerRow({
  children,
  onClick,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="block w-full py-1.5 text-start text-body text-destructive"
    >
      {children}
    </button>
  );
}

export function ComputerModePicker({
  value,
  onChange,
  teamTestId,
  privateTestId,
}: {
  value: ComputerMode;
  onChange: (value: ComputerMode) => void;
  teamTestId?: string;
  privateTestId?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["team", "dedicated"] as const).map((mode) => (
        <Toggle
          key={mode}
          variant="outline"
          pressed={value === mode}
          data-testid={mode === "team" ? teamTestId : privateTestId}
          onPressedChange={(pressed) => {
            if (pressed) onChange(mode);
          }}
          className="text-body capitalize aria-pressed:border-foreground/40 aria-pressed:text-foreground"
        >
          {mode === "team" ? <Trans>Team</Trans> : <Trans>Private</Trans>}
        </Toggle>
      ))}
    </div>
  );
}
