import { i18n } from "@lingui/core";
import { isNeedsYou } from "@rakazo/core";
import { cn } from "@rakazo/ui-web";
import { ChevronDown, Lock } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatSidebarTime } from "../../lib/sidebar-time";

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
        "max-w-full truncate rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground",
        className,
      )}
    >
      {value}
    </span>
  );
}

export function NeedsYouBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "max-w-full truncate rounded-full bg-warning/15 px-1.5 py-px text-[10px] text-warning",
        className,
      )}
    >
      {i18n._({ id: "Needs you", message: "Needs you" })}
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
    <div className="flex items-center pt-2">
      <button
        type={type}
        aria-expanded={showChevron ? !collapsed : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground hover:bg-sidebar-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          className,
        )}
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
            className={collapsed ? "-rotate-90 transition-transform" : "transition-transform"}
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
  const stamp = time ?? (updatedAt ? formatSidebarTime(updatedAt) : "");
  return (
    <button
      type={type}
      className={cn(
        "flex w-full gap-3 rounded-xl px-2.5 py-[11px] text-start",
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
            className={cn(
              "truncate text-[13px] text-foreground",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {name}
            {unread ? (
              <span className="sr-only">{i18n._({ id: " (unread)", message: " (unread)" })}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground/80">
            {isNeedsYou(status) ? <NeedsYouBadge /> : null}
            {stamp}
            {unread ? (
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-foreground"
              />
            ) : null}
          </span>
        </div>
        {preview || (kind === "bot" && title?.trim()) ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {kind === "bot" ? <BotTitleCapsule title={title} className="shrink-0" /> : null}
            {preview ? (
              <div
                dir="auto"
                className={cn(
                  "min-w-0 truncate text-[12px]",
                  unread ? "font-medium text-foreground/75" : "text-muted-foreground/80",
                )}
              >
                {preview}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}
