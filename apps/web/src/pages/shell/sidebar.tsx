import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Bot, Group, Me, SearchHit } from "@rakazo/contracts";
import { isNeedsYou } from "@rakazo/core";
import {
  BotAvatar,
  Button,
  GroupAvatar,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import {
  Bell,
  Gauge,
  LayoutGrid,
  Lock,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Search,
  Settings,
} from "lucide-react";
import type {
  Dispatch,
  DragEvent,
  MutableRefObject,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  SetStateAction,
} from "react";
import { authClient } from "../../lib/auth";
import { botImageSrc, withMemberImages } from "../../lib/bot-image-src";
import { BOTS_SIDEBAR_EDGE_DRAG_PX } from "../../lib/bots-sidebar-pref";
import { clearSpaceSelection, rpc } from "../../lib/rpc";
import { ActivityList } from "../ActivityList";
import type { ContextMenuPosition } from "../BotContextMenu";
import type { SettingsSection } from "../SettingsOverlay";
import { SpaceSearchResults } from "../SpaceSearch";
import { WindowChrome } from "../WindowChrome";
import { BotCreatePicker } from "./bot-picker";
import { PinnedGrid, PinnedGridCell } from "./pinned-grid";
import {
  accountDisplayName,
  accountInitials,
  SidebarChatRow,
  SidebarSectionHeader,
} from "./sidebar-chrome";
import type { Panel } from "./types";

type SidebarBotChat = Pick<
  Bot,
  | "id"
  | "spaceId"
  | "name"
  | "title"
  | "color"
  | "avatarShape"
  | "preview"
  | "updatedAt"
  | "unread"
  | "status"
>;

type SidebarGroupChat = Pick<
  Group,
  "id" | "spaceId" | "name" | "preview" | "members" | "updatedAt" | "unread"
>;

type SidebarRosterItem =
  | { kind: "bot"; chat: SidebarBotChat }
  | { kind: "group"; chat: SidebarGroupChat };

export type ShellSidebarGroup = {
  key: string;
  title?: string | null;
  bots: SidebarRosterItem[];
  showLock?: boolean;
  emptySpaceId?: string;
  spaceId: string;
  spaceName: string;
  canDeleteSpace: boolean;
};

export type ShellSidebarProps = {
  botsSidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  activityMode: boolean;
  toggleActivityMode: () => void;
  setBotsSidebarCollapsedPref: (collapsed: boolean) => void;
  createMenuOpen: boolean;
  setCreateMenuOpen: (open: boolean) => void;
  bots: Bot[];
  setMobileSidebarOpen: (open: boolean) => void;
  navigate: (path: string) => void;
  setPanel: (panel: Panel) => void;
  setNewSpaceOpen: (open: boolean) => void;
  setPickerInfoTopic: (topic: "group" | "space" | null) => void;
  query: string;
  setQuery: (query: string) => void;
  showSpaceSearch: boolean;
  searchHits: SearchHit[];
  searchLoading: boolean;
  jumpToSearchHit: (hit: SearchHit) => void | Promise<void>;
  sidebarGroups: ShellSidebarGroup[];
  inGroup: boolean;
  active: Bot | undefined;
  activeGroup: Group | undefined;
  activeSnapshotGroupId: string | null | undefined;
  activeSnapshotMembers: Group["members"] | undefined;
  activeSnapshotBotId: string | undefined;
  activeSnapshotRunStatus: string | undefined;
  draggedBotId: string | null;
  setDraggedBotId: (id: string | null) => void;
  reorderRosterBot: (draggedId: string, targetId: string, groupBotIds: string[]) => void;
  openSpaceChat: (spaceId: string, path: string) => void;
  bootstrapMe: Me | null | undefined;
  botMenuAnchor: MutableRefObject<HTMLElement | null>;
  setBotMenu: Dispatch<
    SetStateAction<{
      kind: "bot" | "group";
      id: string;
      position: ContextMenuPosition;
    } | null>
  >;
  collapsedSidebarSections: ReadonlySet<string>;
  toggleSidebarSection: (key: string) => void;
  spaceMenuAnchor: MutableRefObject<HTMLElement | null>;
  setSpaceMenu: Dispatch<
    SetStateAction<{
      id: string;
      position: ContextMenuPosition;
    } | null>
  >;
  archivedBots: Bot[];
  archivedGroups: Group[];
  archivedOpen: boolean;
  setArchivedOpen: Dispatch<SetStateAction<boolean>>;
  refreshBots: (force?: boolean) => void | Promise<void>;
  setDeleteTarget: (bot: Bot) => void;
  setDeleteGroupTarget: (group: Group) => void;
  setPluginsOpen: (open: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  initials: string;
  userName: string;
  setCommandPaletteOpen: (open: boolean) => void;
  openSettings: (section?: SettingsSection) => void;
  setUsage: Dispatch<
    SetStateAction<{
      inputTokens: number;
      outputTokens: number;
      runs: number;
    } | null>
  >;
  botsSidebarEdgeDragRef: MutableRefObject<{
    startX: number;
    mode: "expand" | "collapse";
  } | null>;
};

function rosterAvatar(
  item: SidebarRosterItem,
  avatarSize: number,
  liveMembers: Group["members"] | undefined,
) {
  return item.kind === "bot" ? (
    <BotAvatar
      color={item.chat.color}
      shape={item.chat.avatarShape}
      identity={item.chat.id}
      size={avatarSize}
      imageSrc={botImageSrc(item.chat)}
    />
  ) : (
    <GroupAvatar members={withMemberImages(liveMembers ?? item.chat.members)} size={avatarSize} />
  );
}

export function ShellSidebar({
  botsSidebarCollapsed,
  mobileSidebarOpen,
  activityMode,
  toggleActivityMode,
  setBotsSidebarCollapsedPref,
  createMenuOpen,
  setCreateMenuOpen,
  bots,
  setMobileSidebarOpen,
  navigate,
  setPanel,
  setNewSpaceOpen,
  setPickerInfoTopic,
  query,
  setQuery,
  showSpaceSearch,
  searchHits,
  searchLoading,
  jumpToSearchHit,
  sidebarGroups,
  inGroup,
  active,
  activeGroup,
  activeSnapshotGroupId,
  activeSnapshotMembers,
  activeSnapshotBotId,
  activeSnapshotRunStatus,
  draggedBotId,
  setDraggedBotId,
  reorderRosterBot,
  openSpaceChat,
  bootstrapMe,
  botMenuAnchor,
  setBotMenu,
  collapsedSidebarSections,
  toggleSidebarSection,
  spaceMenuAnchor,
  setSpaceMenu,
  archivedBots,
  archivedGroups,
  archivedOpen,
  setArchivedOpen,
  refreshBots,
  setDeleteTarget,
  setDeleteGroupTarget,
  setPluginsOpen,
  menuOpen,
  setMenuOpen,
  initials,
  userName,
  setCommandPaletteOpen,
  openSettings,
  setUsage,
  botsSidebarEdgeDragRef,
}: ShellSidebarProps) {
  const accountName =
    accountDisplayName(bootstrapMe?.name, bootstrapMe?.email) || accountDisplayName(userName) || "";
  const accountLabel = accountInitials(accountName) || initials;

  return (
    <>
      <aside
        data-testid="bots-sidebar"
        data-collapsed={botsSidebarCollapsed ? "true" : "false"}
        inert={botsSidebarCollapsed && !mobileSidebarOpen ? true : undefined}
        className={`absolute inset-y-0 start-0 z-40 flex w-[calc(100%-48px)] max-w-[280px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-[transform,width,opacity] md:static md:z-auto md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        } ${
          botsSidebarCollapsed
            ? "md:w-0 md:max-w-0 md:overflow-hidden md:border-e-0 md:opacity-0 md:pointer-events-none"
            : "md:w-[280px]"
        }`}
      >
        <div className="app-drag group flex h-11 items-center justify-between px-3">
          <WindowChrome />
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              className="app-no-drag hidden h-7 w-7 items-center justify-center rounded-full text-muted-foreground/70 opacity-0 hover:text-foreground/75 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 md:inline-flex"
              aria-label={t`Minimize bots`}
              title={t`Minimize bots`}
              data-testid="minimize-bots-sidebar"
              onClick={() => setBotsSidebarCollapsedPref(true)}
            >
              <PanelLeftClose size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              <PopoverTrigger
                className="app-no-drag text-title text-muted-foreground/70 hover:text-foreground/75"
                title={t`Create`}
                data-testid="create-menu-trigger"
              >
                +
              </PopoverTrigger>
              {createMenuOpen ? (
                <PopoverContent
                  align="end"
                  className="app-no-drag w-auto gap-0 overflow-hidden p-0 data-closed:animate-none"
                >
                  <BotCreatePicker
                    bots={bots}
                    onCreateBot={() => {
                      setCreateMenuOpen(false);
                      setMobileSidebarOpen(false);
                      setPanel("create");
                    }}
                    onOpenBot={(id) => {
                      setCreateMenuOpen(false);
                      setMobileSidebarOpen(false);
                      navigate(`/app/${id}`);
                    }}
                    onCreateGroup={() => {
                      setCreateMenuOpen(false);
                      setMobileSidebarOpen(false);
                      setPanel("create-group");
                    }}
                    onCreateSpace={() => {
                      setCreateMenuOpen(false);
                      setMobileSidebarOpen(false);
                      setNewSpaceOpen(true);
                    }}
                    onShowGroupInfo={() => {
                      setCreateMenuOpen(false);
                      setMobileSidebarOpen(false);
                      setPickerInfoTopic("group");
                    }}
                    onShowSpaceInfo={() => {
                      setCreateMenuOpen(false);
                      setMobileSidebarOpen(false);
                      setPickerInfoTopic("space");
                    }}
                  />
                </PopoverContent>
              ) : null}
            </Popover>
          </div>
        </div>
        <InputGroup
          data-testid="sidebar-search"
          className="mx-2.5 mb-3 h-8 w-auto rounded-full border-0 bg-muted shadow-none"
        >
          <InputGroupAddon>
            <Search size={14} strokeWidth={1.8} className="size-3.5" aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              setCommandPaletteOpen(true);
            }}
            placeholder={t`Search`}
            autoComplete="off"
            name="sidebar-search"
            className="text-body"
          />
        </InputGroup>
        <div className="rk-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2.5">
          {showSpaceSearch ? (
            <SpaceSearchResults
              hits={searchHits}
              loading={searchLoading}
              onSelect={(hit) => void jumpToSearchHit(hit)}
            />
          ) : (
            <>
              {activityMode ? (
                <ActivityList
                  onOpenRun={(run) => {
                    setMobileSidebarOpen(false);
                    if (run.groupId) navigate(`/app/g/${run.groupId}`);
                    else navigate(`/app/${run.botId}`);
                  }}
                />
              ) : null}
              {sidebarGroups.map((group) => {
                const collapsed = Boolean(group.title) && collapsedSidebarSections.has(group.key);
                const groupBotIds = group.bots.flatMap((item) =>
                  item.kind === "bot" ? [item.chat.id] : [],
                );
                const isPinned = group.key === "pinned" || group.key.endsWith(":pinned");
                const rosterItems = group.bots.map((item) => {
                  const selected =
                    (item.kind === "bot" && !inGroup && active?.id === item.chat.id) ||
                    (item.kind === "group" && inGroup && activeGroup?.id === item.chat.id);
                  const avatarSize = isPinned ? 52 : 36;
                  const liveMembers =
                    item.kind === "group" && item.chat.id === activeSnapshotGroupId
                      ? (activeSnapshotMembers ?? item.chat.members)
                      : item.kind === "group"
                        ? item.chat.members
                        : undefined;
                  const botStatus =
                    item.kind === "bot"
                      ? activeSnapshotBotId === item.chat.id
                        ? (activeSnapshotRunStatus ?? item.chat.status)
                        : item.chat.status
                      : undefined;
                  const rosterStatus =
                    item.kind === "bot"
                      ? botStatus && botStatus !== "idle"
                        ? botStatus
                        : undefined
                      : liveMembers?.find((member) => isNeedsYou(member.status))?.status;
                  const rowProps = {
                    kind: item.kind,
                    chatId: item.chat.id,
                    name: item.chat.name,
                    title: item.kind === "bot" ? item.chat.title : undefined,
                    status: rosterStatus,
                    selected,
                    draggable: item.kind === "bot",
                    "aria-keyshortcuts":
                      item.kind === "bot" ? "Alt+ArrowUp Alt+ArrowDown" : undefined,
                    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
                      if (item.kind !== "bot") return;
                      setDraggedBotId(item.chat.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.chat.id);
                    },
                    onDragOver: (event: DragEvent<HTMLButtonElement>) => {
                      if (
                        item.kind === "bot" &&
                        draggedBotId &&
                        groupBotIds.includes(draggedBotId)
                      ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    },
                    onDrop: (event: DragEvent<HTMLButtonElement>) => {
                      if (item.kind !== "bot" || !draggedBotId) return;
                      event.preventDefault();
                      reorderRosterBot(draggedBotId, item.chat.id, groupBotIds);
                      setDraggedBotId(null);
                    },
                    onDragEnd: () => setDraggedBotId(null),
                    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
                      if (
                        item.kind !== "bot" ||
                        !event.altKey ||
                        (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                      )
                        return;
                      const index = groupBotIds.indexOf(item.chat.id);
                      const target = groupBotIds[index + (event.key === "ArrowUp" ? -1 : 1)];
                      if (!target) return;
                      event.preventDefault();
                      reorderRosterBot(item.chat.id, target, groupBotIds);
                    },
                    onClick: () => {
                      openSpaceChat(
                        item.chat.spaceId,
                        item.kind === "bot" ? `/app/${item.chat.id}` : `/app/g/${item.chat.id}`,
                      );
                    },
                    onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => {
                      if (item.chat.spaceId !== bootstrapMe?.spaceId) return;
                      event.preventDefault();
                      botMenuAnchor.current = event.currentTarget;
                      setBotMenu({
                        kind: item.kind,
                        id: item.chat.id,
                        position: { x: event.clientX, y: event.clientY },
                      });
                    },
                    style: {
                      opacity: item.kind === "bot" && draggedBotId === item.chat.id ? 0.55 : 1,
                    },
                  };
                  return { item, avatarSize, liveMembers, rowProps };
                });
                if (isPinned) {
                  return (
                    <PinnedGrid key={group.key} groupKey={group.key}>
                      {rosterItems.map(({ item, avatarSize, liveMembers, rowProps }) => (
                        <PinnedGridCell
                          key={`${item.kind}:${item.chat.id}`}
                          {...rowProps}
                          avatar={rosterAvatar(item, avatarSize, liveMembers)}
                        />
                      ))}
                    </PinnedGrid>
                  );
                }
                return (
                  <div key={group.key} data-sidebar-group={group.key}>
                    {group.title ? (
                      <SidebarSectionHeader
                        title={group.title}
                        collapsed={collapsed}
                        showChevron={!group.emptySpaceId}
                        showLock={group.showLock}
                        onClick={() => {
                          if (group.emptySpaceId) {
                            openSpaceChat(group.emptySpaceId, "/onboarding");
                            return;
                          }
                          toggleSidebarSection(group.key);
                        }}
                        onContextMenu={
                          group.canDeleteSpace
                            ? (event) => {
                                event.preventDefault();
                                spaceMenuAnchor.current = event.currentTarget;
                                setSpaceMenu({
                                  id: group.spaceId,
                                  position: { x: event.clientX, y: event.clientY },
                                });
                              }
                            : undefined
                        }
                        aria-label={
                          group.emptySpaceId
                            ? t`Open ${group.title}`
                            : collapsed
                              ? t`Expand ${group.title}`
                              : t`Collapse ${group.title}`
                        }
                        actions={
                          group.canDeleteSpace ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t`Actions for ${group.spaceName}`}
                              onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                spaceMenuAnchor.current = event.currentTarget;
                                setSpaceMenu({
                                  id: group.spaceId,
                                  position: { x: rect.left, y: rect.bottom },
                                });
                              }}
                            >
                              <MoreHorizontal size={14} aria-hidden="true" />
                            </Button>
                          ) : null
                        }
                      />
                    ) : null}
                    {!collapsed &&
                      rosterItems.map(({ item, avatarSize, liveMembers, rowProps }) => (
                        <SidebarChatRow
                          key={`${item.kind}:${item.chat.id}`}
                          {...rowProps}
                          avatar={rosterAvatar(item, avatarSize, liveMembers)}
                          preview={
                            item.kind === "bot"
                              ? item.chat.preview
                              : item.chat.preview ||
                                item.chat.members.map((member) => member.name).join(", ")
                          }
                          updatedAt={item.chat.updatedAt}
                          unread={item.chat.unread}
                        />
                      ))}
                  </div>
                );
              })}
            </>
          )}
          {archivedBots.length + archivedGroups.length > 0 && !showSpaceSearch ? (
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                aria-expanded={archivedOpen}
                onClick={() => setArchivedOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-body text-muted-foreground hover:bg-sidebar-accent"
              >
                <span>
                  <Trans>Archived</Trans>
                </span>
                <span>{archivedBots.length + archivedGroups.length}</span>
              </button>
              {archivedOpen ? (
                <>
                  {archivedBots.map((bot) => (
                    <div key={bot.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2">
                      <BotAvatar
                        color={bot.color}
                        shape={bot.avatarShape}
                        identity={bot.id}
                        size={28}
                        imageSrc={botImageSrc(bot)}
                      />
                      <span
                        className="min-w-0 flex-1 truncate text-body text-foreground/75"
                        dir="auto"
                      >
                        {bot.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          void rpc.bots.restore({ botId: bot.id }).then(() => refreshBots(true))
                        }
                      >
                        <Trans>Restore</Trans>
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:text-destructive"
                        aria-label={t`Delete ${bot.name}`}
                        onClick={() => setDeleteTarget(bot)}
                      >
                        <Trans>Delete</Trans>
                      </Button>
                    </div>
                  ))}
                  {archivedGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2">
                      <GroupAvatar members={group.members} size={28} />
                      <span
                        className="min-w-0 flex-1 truncate text-body text-foreground/75"
                        dir="auto"
                      >
                        {group.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          void rpc.groups
                            .restore({ groupId: group.id })
                            .then(() => refreshBots(true))
                        }
                      >
                        <Trans>Restore</Trans>
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:text-destructive"
                        aria-label={t`Delete ${group.name}`}
                        onClick={() => setDeleteGroupTarget(group)}
                      >
                        <Trans>Delete</Trans>
                      </Button>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setPluginsOpen(true)}
          className="mx-2 mb-0.5 flex h-9 items-center gap-3 rounded-lg px-2.5 hover:bg-sidebar-accent"
        >
          <LayoutGrid
            size={16}
            strokeWidth={1.7}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-body">
            <Trans>Marketplace</Trans>
          </span>
        </button>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            data-testid="user-menu-trigger"
            className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-start hover:bg-sidebar-accent"
          >
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-muted text-micro text-muted-foreground">
              {accountLabel}
            </span>
            <span className="truncate text-body">{accountName}</span>
          </PopoverTrigger>
          {menuOpen ? (
            <PopoverContent
              side="top"
              align="start"
              className="w-[calc(280px-1.5rem)] max-w-[calc(100vw-3rem)] gap-0 p-1 data-closed:animate-none"
            >
              <Button
                variant="ghost"
                className="w-full justify-start font-normal"
                aria-label={t`Activity`}
                aria-pressed={activityMode}
                title={t`Activity`}
                data-activity-mode={activityMode ? "on" : "off"}
                onClick={() => {
                  toggleActivityMode();
                  setMenuOpen(false);
                }}
              >
                <Bell className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Activity</Trans>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal"
                aria-label={t`New space`}
                onClick={() => {
                  setMenuOpen(false);
                  setNewSpaceOpen(true);
                }}
              >
                <Lock className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>New space</Trans>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal"
                aria-label={t`Settings`}
                onClick={() => {
                  setMenuOpen(false);
                  openSettings("general");
                }}
              >
                <Settings className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Settings</Trans>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal"
                aria-label={t`Usage`}
                onClick={() => {
                  setMenuOpen(false);
                  void rpc.usage
                    .summary()
                    .then(setUsage)
                    .catch(() => undefined);
                  openSettings("usage");
                }}
              >
                <Gauge className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Usage</Trans>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal"
                onClick={() =>
                  void authClient.signOut().then(() => {
                    clearSpaceSelection();
                    navigate("/");
                  })
                }
              >
                <LogOut className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Log out</Trans>
              </Button>
            </PopoverContent>
          ) : null}
        </Popover>
      </aside>

      <button
        type="button"
        data-testid="bots-sidebar-edge"
        aria-label={botsSidebarCollapsed ? t`Show bots` : t`Hide bots`}
        aria-pressed={!botsSidebarCollapsed}
        className={`absolute inset-y-0 z-50 hidden w-2 cursor-ew-resize touch-none border-0 bg-transparent p-0 md:block ${
          botsSidebarCollapsed ? "start-0" : "start-[272px]"
        }`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          botsSidebarEdgeDragRef.current = {
            startX: event.clientX,
            mode: botsSidebarCollapsed ? "expand" : "collapse",
          };
        }}
        onPointerMove={(event) => {
          const drag = botsSidebarEdgeDragRef.current;
          if (!drag) return;
          const rtl =
            typeof document !== "undefined" &&
            document.documentElement.getAttribute("dir") === "rtl";
          const delta = rtl ? drag.startX - event.clientX : event.clientX - drag.startX;
          if (drag.mode === "expand" && delta >= BOTS_SIDEBAR_EDGE_DRAG_PX) {
            botsSidebarEdgeDragRef.current = null;
            setBotsSidebarCollapsedPref(false);
          } else if (drag.mode === "collapse" && delta <= -BOTS_SIDEBAR_EDGE_DRAG_PX) {
            botsSidebarEdgeDragRef.current = null;
            setBotsSidebarCollapsedPref(true);
          }
        }}
        onPointerUp={(event) => {
          const drag = botsSidebarEdgeDragRef.current;
          botsSidebarEdgeDragRef.current = null;
          if (!drag) return;
          if (Math.abs(event.clientX - drag.startX) < BOTS_SIDEBAR_EDGE_DRAG_PX) {
            setBotsSidebarCollapsedPref(!botsSidebarCollapsed);
          }
        }}
        onPointerCancel={() => {
          botsSidebarEdgeDragRef.current = null;
        }}
      />
    </>
  );
}
