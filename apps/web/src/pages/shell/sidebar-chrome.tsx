import { i18n } from "@lingui/core";
import { isNeedsYou } from "@rakazo/core";
import { cn } from "@rakazo/ui-web";
import { ChevronDown, Lock } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatSidebarTime } from "../../lib/sidebar-time";

export function accountDisplayName(name?: string | null, email?: string | null): string {
  const trimmed = name?.trim() ?? "";
  if (trimmed && trimmed.toLowerCase() !== "owner") return trimmed;
  return email?.split("@")[0]?.trim() ?? "";
}

export function accountInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export type BotTitleCapsuleProps = {
  title?: string | null;
  className?: string;
};

export function BotTitleCapsule({ title, className }: BotTitleCapsuleProps) {
  const value = title?.trim() ?? "";
  if (!value) return null;
  return (
    <span
      dir="auto"
      className={cn(
        "max-w-full truncate rounded-full bg-muted px-1.5 py-px text-muted-foreground",
        className,
      )}
    >
      <span className="text-micro">{value}</span>
    </span>
  );
}

export function NeedsYouBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "max-w-full truncate rounded-full bg-warning/15 px-1.5 py-px text-warning",
        className,
      )}
    >
      <span className="text-micro">{i18n._({ id: "Needs you", message: "Needs you" })}</span>
    </span>
  );
}

export type SidebarSectionHeaderProps = {
  title: string;
  collapsed?: boolean;
  showChevron?: boolean;
  showLock?: boolean;
  actions?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function SidebarSectionHeader({
  title,
  collapsed = false,
  showChevron = true,
  showLock = false,
  actions,
  className,
  type = "button",
  ...rest
}: SidebarSectionHeaderProps) {
  return (
    <div className="group flex items-center">
      <button
        type={type}
        aria-expanded={showChevron ? !collapsed : undefined}
        className={`${cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 font-medium uppercase tracking-[0.06em] text-muted-foreground hover:bg-sidebar-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          className,
        )} text-caption`}
        {...rest}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {showLock ? <Lock size={11} strokeWidth={2} aria-hidden="true" /> : null}
          <span className="truncate">{title}</span>
        </span>
        {showChevron ? (
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            className={cn(
              "opacity-0 transition-transform group-hover:opacity-100 group-focus-within:opacity-100",
              collapsed ? "-rotate-90" : null,
            )}
            aria-hidden="true"
          />
        ) : null}
      </button>
      {actions}
    </div>
  );
}

export type SidebarChatRowProps = {
  kind?: "bot" | "group";
  chatId?: string;
  avatar: ReactNode;
  name: string;
  title?: string | null;
  preview?: string | null;
  updatedAt?: string;
  time?: string;
  status?: string | null;
  unread?: boolean;
  selected?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function SidebarChatRow({
  kind,
  chatId,
  avatar,
  name,
  title,
  preview,
  updatedAt,
  time,
  status,
  unread = false,
  selected = false,
  className,
  type = "button",
  ...rest
}: SidebarChatRowProps) {
  void title;
  const stamp = time ?? (updatedAt ? formatSidebarTime(updatedAt) : "");
  const needsYou = isNeedsYou(status);
  return (
    <button
      type={type}
      className={cn(
        "flex h-[52px] w-full items-center gap-3 rounded-lg px-2.5 text-start",
        kind === "bot" ? "cursor-grab active:cursor-grabbing" : null,
        selected ? "bg-sidebar-accent" : "hover:bg-sidebar-accent",
        className,
      )}
      {...rest}
      data-roster-bot-id={kind === "bot" ? chatId : undefined}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            dir="auto"
            data-roster-bot-name={kind === "bot" ? "" : undefined}
            className="truncate text-body font-semibold text-foreground"
          >
            {name}
            {unread ? (
              <span className="sr-only">{i18n._({ id: " (unread)", message: " (unread)" })}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {needsYou ? (
              <NeedsYouBadge />
            ) : (
              <>
                {unread ? (
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                  />
                ) : null}
                {stamp ? <span className="text-caption text-muted-foreground">{stamp}</span> : null}
              </>
            )}
          </span>
        </div>
        {preview ? (
          <div dir="auto" className="truncate text-small text-muted-foreground">
            {preview}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export type SidebarAccountRowProps = {
  name: string;
  initials: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function SidebarAccountRow({
  name,
  initials,
  className,
  type = "button",
  ...rest
}: SidebarAccountRowProps) {
  return (
    <button
      type={type}
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-start hover:bg-sidebar-accent",
        className,
      )}
      {...rest}
    >
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <span className="text-micro">{initials}</span>
      </span>
      <span className="truncate text-body">{name}</span>
    </button>
  );
}
