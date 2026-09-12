import { i18n } from "@lingui/core";
import { Badge, Button } from "@rakazo/ui-web";
import type { ReactNode } from "react";

export type InstallStatus = "connected" | "waiting" | "disabled";

export function ItemLogo({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return <img src={src} alt="" className="size-8 shrink-0 rounded-lg bg-muted object-contain" />;
  }
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-body font-semibold text-foreground">
      {name[0]}
    </div>
  );
}

export function StatusChip({ status }: { status: InstallStatus }) {
  const waiting = status === "waiting";
  const label =
    status === "connected"
      ? i18n._({ id: "Connected", message: "Connected" })
      : waiting
        ? i18n._({ id: "Waiting for authorization", message: "Waiting for authorization" })
        : i18n._({ id: "Disabled", message: "Disabled" });
  return (
    <Badge
      variant="secondary"
      className={`h-5 rounded-full text-caption font-medium ${
        waiting ? "bg-warning/15 text-warning" : ""
      }`}
    >
      {label}
    </Badge>
  );
}

export function MarketplaceCard({
  name,
  logo,
  description,
  connected,
  connecting,
  testId,
  onConnect,
}: {
  name: string;
  logo?: string | null;
  description?: string;
  connected: boolean;
  connecting?: boolean;
  testId?: string;
  onConnect: () => void;
}) {
  return (
    <div data-testid={testId} className="flex min-w-0 items-center gap-3 py-2">
      <ItemLogo src={logo} name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body font-semibold tracking-[-0.011em] text-foreground">
          {name}
        </div>
        {description ? (
          <div className="truncate text-small text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {connected ? (
        <StatusChip status="connected" />
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={connecting}
          onClick={onConnect}
        >
          {i18n._({ id: "Connect", message: "Connect" })}
        </Button>
      )}
    </div>
  );
}

export function InstalledRow({
  name,
  logo,
  status,
  pending,
  testId,
  extra,
  onReopen,
  onRemove,
}: {
  name: string;
  logo?: string | null;
  status: InstallStatus;
  pending?: boolean;
  testId?: string;
  extra?: ReactNode;
  onReopen?: () => void;
  onRemove: () => void;
}) {
  return (
    <div data-testid={testId} className="py-2">
      <div className="flex min-w-0 items-center gap-3">
        <ItemLogo src={logo} name={name} />
        <div className="min-w-0 flex-1 truncate text-body font-semibold tracking-[-0.011em] text-foreground">
          {name}
        </div>
        <StatusChip status={status} />
        {status === "waiting" && onReopen ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onReopen}>
            {i18n._({ id: "Reopen", message: "Reopen" })}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onRemove}>
          {i18n._({ id: "Remove", message: "Remove" })}
        </Button>
      </div>
      {extra}
    </div>
  );
}
