import { isNeedsYou } from "@rakazo/core";
import { cn } from "@rakazo/ui-web";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { BotTitleCapsule, NeedsYouBadge } from "./sidebar-chrome";

export type PinnedGridItem = {
  chatId: string;
  kind: "bot" | "group";
  name: string;
  title?: string | null;
  status?: string | null;
  avatar: ReactNode;
  selected?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export type PinnedGridProps = {
  items?: readonly PinnedGridItem[];
  groupKey?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function PinnedGridCell({
  chatId,
  kind,
  name,
  title,
  status,
  avatar,
  selected = false,
  className,
  type = "button",
  ...rest
}: PinnedGridItem) {
  return (
    <button
      type={type}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center",
        kind === "bot" ? "cursor-grab active:cursor-grabbing" : null,
        selected ? "bg-sidebar-accent" : "hover:bg-sidebar-accent",
        className,
      )}
      {...rest}
      data-roster-bot-id={kind === "bot" ? chatId : undefined}
    >
      {avatar}
      <span
        dir="auto"
        data-roster-bot-name={kind === "bot" ? "" : undefined}
        className="w-full truncate text-caption font-medium text-foreground"
      >
        {name}
      </span>
      {isNeedsYou(status) ? (
        <NeedsYouBadge />
      ) : kind === "bot" ? (
        <BotTitleCapsule title={title} />
      ) : null}
    </button>
  );
}

export function PinnedGrid({
  items,
  groupKey = "pinned",
  children,
  className,
  ...rest
}: PinnedGridProps) {
  return (
    <div
      className={cn("grid grid-cols-3 gap-1", className)}
      {...rest}
      data-sidebar-group={groupKey}
    >
      {children ??
        items?.map((item) => <PinnedGridCell key={`${item.kind}:${item.chatId}`} {...item} />)}
    </div>
  );
}
