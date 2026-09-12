import { t } from "@lingui/core/macro";
import type { Bot, Group, ThreadSnapshot } from "@rakazo/contracts";
import {
  BotAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GroupAvatar,
} from "@rakazo/ui-web";
import { Menu, Monitor, MoreHorizontal, PanelLeftOpen, Search } from "lucide-react";
import { botImageSrc, withMemberImages } from "../../lib/bot-image-src";
import { desktopBridge } from "../../lib/desktop";
import { WindowChrome } from "../WindowChrome";
import type { Panel } from "./types";

export type ThreadHeaderProps = {
  botsSidebarCollapsed: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  setBotsSidebarCollapsedPref: (collapsed: boolean) => void;
  inGroup: boolean;
  active: Bot | undefined;
  activeGroup: Group | undefined;
  activeSnapshot: ThreadSnapshot | null;
  setPanel: (panel: Panel) => void;
  panel: Panel;
  needsComputer: boolean;
  computerLive?: boolean;
  refreshThread: (id: string) => Promise<ThreadSnapshot | null | undefined>;
  onFindInChat?: () => void;
};

export function ThreadHeader({
  botsSidebarCollapsed,
  setMobileSidebarOpen,
  setBotsSidebarCollapsedPref,
  inGroup,
  active,
  activeGroup,
  activeSnapshot,
  setPanel,
  panel,
  needsComputer,
  computerLive = false,
  refreshThread,
  onFindInChat,
}: ThreadHeaderProps) {
  return (
    <div className="app-drag flex items-center justify-between border-b border-sidebar-border h-11 px-3 md:px-[22px]">
      <div className="flex min-w-0 items-center gap-2">
        {botsSidebarCollapsed && desktopBridge() ? <WindowChrome /> : null}
        <button
          type="button"
          aria-label={t`Open navigation`}
          onClick={() => setMobileSidebarOpen(true)}
          className="app-no-drag grid h-8 w-8 shrink-0 place-items-center rounded-lg text-foreground/75 hover:bg-accent md:hidden"
        >
          <Menu size={19} strokeWidth={1.7} />
        </button>
        {botsSidebarCollapsed ? (
          <button
            type="button"
            data-testid="restore-bots-sidebar"
            aria-label={t`Show bots`}
            title={t`Show bots`}
            onClick={() => setBotsSidebarCollapsedPref(false)}
            className="app-no-drag hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-foreground/75 hover:bg-accent md:grid"
          >
            <PanelLeftOpen size={19} strokeWidth={1.7} aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          data-testid="bot-settings-trigger"
          onClick={() => setPanel(inGroup ? "group-settings" : "settings")}
          className="app-no-drag flex min-w-0 items-center gap-2"
        >
          {inGroup ? (
            <GroupAvatar
              members={withMemberImages(activeSnapshot?.members ?? activeGroup?.members ?? [])}
              size={20}
            />
          ) : active ? (
            <BotAvatar
              color={active.color}
              shape={active.avatarShape}
              identity={active.id}
              size={20}
              imageSrc={botImageSrc(active)}
            />
          ) : null}
          <span className="min-w-0 truncate text-body font-medium text-foreground" dir="auto">
            {inGroup
              ? (activeGroup?.name ?? activeSnapshot?.groupName ?? t`Group`)
              : (active?.name ?? t`Select a bot`)}
          </span>
        </button>
      </div>
      <div className="flex items-center gap-1">
        {!inGroup && active ? (
          <button
            type="button"
            title={t`Agent computer`}
            onClick={() => {
              const next = panel === "computer" ? null : "computer";
              setPanel(next);
              if (next === "computer" && active) {
                void refreshThread(active.id).catch(() => undefined);
              }
            }}
            data-active={panel ? "" : undefined}
            className={`app-no-drag grid h-8 w-8 place-items-center rounded-lg ${
              needsComputer
                ? "bg-warning/15 text-warning hover:bg-warning/20"
                : "hover:bg-accent data-active:bg-accent"
            }`}
          >
            <Monitor
              size={16}
              strokeWidth={1.6}
              className={
                needsComputer
                  ? "text-warning"
                  : computerLive
                    ? "text-primary"
                    : "text-foreground/75"
              }
            />
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t`More`}
            className="app-no-drag grid h-8 w-8 place-items-center rounded-lg text-foreground/75 hover:bg-accent"
          >
            <MoreHorizontal size={16} strokeWidth={1.7} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onFindInChat}>
              <Search size={14} />
              {t`Find in chat`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
