import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, BotSection, Group, Me, Routine, Space, ThreadSnapshot } from "@rakazo/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Trash2 } from "lucide-react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { lazy } from "react";
import type { NavigateFunction } from "react-router-dom";
import { rpc, selectedSpaceId, selectSpace } from "../../lib/rpc";
import type { ContextMenuPosition } from "../BotContextMenu";
import { CommandPalette } from "./command-palette";
import {
  ClearConversationDialog,
  DeleteBotDialog,
  DeleteItemDialog,
  NewBotSectionDialog,
  NewSpaceDialog,
  PickerInfoDialog,
} from "./dialogs";
import type { Panel } from "./types";

const BotContextMenu = lazy(() =>
  import("../BotContextMenu").then((module) => ({ default: module.BotContextMenu })),
);

export type ShellDialogsProps = {
  contextChat: Bot | Group | undefined;
  contextBot: Bot | undefined;
  contextGroup: Group | undefined;
  botMenu: { kind: "bot" | "group"; id: string; position: ContextMenuPosition } | null;
  closeBotMenu: () => void;
  botSections: BotSection[];
  setBotMenu: Dispatch<
    SetStateAction<{ kind: "bot" | "group"; id: string; position: ContextMenuPosition } | null>
  >;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
  markBotUnread: (id: string) => Promise<void>;
  markBotRead: (id: string) => Promise<void>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  setNewSectionTarget: Dispatch<
    SetStateAction<{ kind: "bot"; chat: Bot } | { kind: "group"; chat: Group } | null>
  >;
  navigate: NavigateFunction;
  setPanel: Dispatch<SetStateAction<Panel>>;
  setClearTarget: Dispatch<
    SetStateAction<{ kind: "bot"; chat: Bot } | { kind: "group"; chat: Group } | null>
  >;
  setDeleteTarget: Dispatch<SetStateAction<Bot | null>>;
  setDeleteGroupTarget: Dispatch<SetStateAction<Group | null>>;
  spaceMenu: { id: string; position: ContextMenuPosition } | null;
  closeSpaceMenu: () => void;
  spaces: Space[];
  setDeleteSpaceTarget: Dispatch<SetStateAction<Space | null>>;
  setSpaceMenu: Dispatch<SetStateAction<{ id: string; position: ContextMenuPosition } | null>>;
  deleteTarget: Bot | null;
  deleteGroupTarget: Group | null;
  deleteSpaceTarget: Space | null;
  bootstrapMe: Me | null | undefined;
  newSectionTarget: { kind: "bot"; chat: Bot } | { kind: "group"; chat: Group } | null;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  bots: Bot[];
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  newSpaceOpen: boolean;
  setNewSpaceOpen: Dispatch<SetStateAction<boolean>>;
  pickerInfoTopic: "group" | "space" | null;
  setPickerInfoTopic: Dispatch<SetStateAction<"group" | "space" | null>>;
  clearTarget: { kind: "bot"; chat: Bot } | { kind: "group"; chat: Group } | null;
  active: Bot | undefined;
  activeGroup: Group | undefined;
  expandedHistoryThread: MutableRefObject<string | null>;
  pinnedAroundRef: MutableRefObject<unknown>;
  historyEpoch: MutableRefObject<number>;
  updateSnapshot: (update: (prev: ThreadSnapshot | null) => ThreadSnapshot | null) => void;
  deleteRoutineTarget: Routine | null;
  setDeleteRoutineTarget: Dispatch<SetStateAction<Routine | null>>;
  setEditingRoutine: Dispatch<SetStateAction<Routine | null>>;
  activeBotId: MutableRefObject<string | undefined>;
  refreshThread: (id: string, signal?: AbortSignal) => Promise<unknown>;
};

export function ShellDialogs(props: ShellDialogsProps) {
  const { t } = useLingui();
  const {
    contextChat,
    contextBot,
    contextGroup,
    botMenu,
    closeBotMenu,
    botSections,
    setBotMenu,
    refreshBots,
    markBotUnread,
    markBotRead,
    setGroups,
    setNewSectionTarget,
    navigate,
    setPanel,
    setClearTarget,
    setDeleteTarget,
    setDeleteGroupTarget,
    spaceMenu,
    closeSpaceMenu,
    spaces,
    setDeleteSpaceTarget,
    setSpaceMenu,
    deleteTarget,
    deleteGroupTarget,
    deleteSpaceTarget,
    bootstrapMe,
    newSectionTarget,
    commandPaletteOpen,
    setCommandPaletteOpen,
    bots,
    setMobileSidebarOpen,
    newSpaceOpen,
    setNewSpaceOpen,
    pickerInfoTopic,
    setPickerInfoTopic,
    clearTarget,
    active,
    activeGroup,
    expandedHistoryThread,
    pinnedAroundRef,
    historyEpoch,
    updateSnapshot,
    deleteRoutineTarget,
    setDeleteRoutineTarget,
    setEditingRoutine,
    activeBotId,
    refreshThread,
  } = props;
  return (
    <>
      {contextChat && botMenu ? (
        <BotContextMenu
          bot={contextChat}
          position={botMenu.position}
          onClose={closeBotMenu}
          sections={botSections}
          onTogglePinned={() => {
            setBotMenu(null);
            const request = contextBot
              ? rpc.bots.update({ botId: contextBot.id, pinned: !contextBot.pinned })
              : rpc.groups.update({
                  groupId: contextGroup!.id,
                  pinned: !contextGroup!.pinned,
                });
            void request.then(() => refreshBots());
          }}
          onToggleUnread={() => {
            const unread = !contextChat.unread;
            setBotMenu(null);
            if (contextBot) {
              const request = unread ? markBotUnread(contextBot.id) : markBotRead(contextBot.id);
              void request.catch(() => undefined);
            } else {
              const request = unread
                ? rpc.threads.markUnread({ groupId: contextGroup!.id })
                : rpc.threads.markRead({ groupId: contextGroup!.id });
              void request
                .then(() =>
                  setGroups((current) =>
                    current.map((group) =>
                      group.id === contextGroup!.id ? { ...group, unread } : group,
                    ),
                  ),
                )
                .catch(() => undefined);
            }
          }}
          onMoveToSection={(sectionId) => {
            setBotMenu(null);
            if (sectionId === contextChat.sectionId) return;
            const request = contextBot
              ? rpc.bots.update({ botId: contextBot.id, sectionId })
              : rpc.groups.update({ groupId: contextGroup!.id, sectionId });
            void request.then(() => refreshBots());
          }}
          onCreateSection={() => {
            setNewSectionTarget(
              contextBot
                ? { kind: "bot", chat: contextBot }
                : { kind: "group", chat: contextGroup! },
            );
            setBotMenu(null);
          }}
          onEdit={() => {
            navigate(contextBot ? `/app/${contextBot.id}` : `/app/g/${contextGroup!.id}`);
            setPanel(contextBot ? "settings" : "group-settings");
            setBotMenu(null);
          }}
          onDuplicate={() => {
            setBotMenu(null);
            const request = contextBot
              ? rpc.bots.duplicate({ botId: contextBot.id })
              : rpc.groups.duplicate({ groupId: contextGroup!.id });
            void request.then(async (chat) => {
              await refreshBots();
              navigate(contextBot ? `/app/${chat.id}` : `/app/g/${chat.id}`);
            });
          }}
          onClear={() => {
            setClearTarget(
              contextBot
                ? { kind: "bot", chat: contextBot }
                : { kind: "group", chat: contextGroup! },
            );
            setBotMenu(null);
          }}
          onArchive={() => {
            setBotMenu(null);
            const request = contextBot
              ? rpc.bots.archive({ botId: contextBot.id })
              : rpc.groups.archive({ groupId: contextGroup!.id });
            void request.then(() => refreshBots(true));
          }}
          onDelete={() => {
            if (contextBot) setDeleteTarget(contextBot);
            else setDeleteGroupTarget(contextGroup!);
            setBotMenu(null);
          }}
        />
      ) : null}

      {spaceMenu ? (
        <DropdownMenu
          open
          onOpenChange={(open) => {
            if (!open) closeSpaceMenu();
          }}
        >
          {/* Invisible anchor at the pointer position, mirroring the bot menu. */}
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="fixed size-0 p-0 opacity-0"
                style={{ left: spaceMenu.position.x, top: spaceMenu.position.y }}
              />
            }
          />
          <DropdownMenuContent
            aria-label={t`Actions for space`}
            align="start"
            sideOffset={0}
            className="w-[220px]"
          >
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                const target = spaces.find((space) => space.id === spaceMenu.id);
                if (target) setDeleteSpaceTarget(target);
                setSpaceMenu(null);
              }}
            >
              <Trash2 />
              {t`Delete space`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {deleteTarget ? (
        <DeleteBotDialog
          bot={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async (deleteMemories) => {
            await rpc.bots.remove({ botId: deleteTarget.id, deleteMemories });
            setDeleteTarget(null);
            setPanel(null);
            await refreshBots(true);
          }}
        />
      ) : null}

      {deleteGroupTarget ? (
        <DeleteItemDialog
          item={deleteGroupTarget}
          noun="group"
          onCancel={() => setDeleteGroupTarget(null)}
          onConfirm={async () => {
            await rpc.groups.remove({ groupId: deleteGroupTarget.id });
            setDeleteGroupTarget(null);
            setPanel(null);
            await refreshBots(true);
          }}
        />
      ) : null}

      {deleteSpaceTarget ? (
        <DeleteItemDialog
          item={deleteSpaceTarget}
          noun="space"
          description={
            <Trans>Only empty spaces can be deleted. Delete its bots and groups first.</Trans>
          }
          onCancel={() => setDeleteSpaceTarget(null)}
          onConfirm={async () => {
            const targetId = deleteSpaceTarget.id;
            const result = await rpc.spaces.remove({ spaceId: targetId });
            setDeleteSpaceTarget(null);
            setPanel(null);
            const effectiveSpaceId = selectedSpaceId() ?? bootstrapMe?.spaceId;
            if (effectiveSpaceId === targetId) {
              // The auth boundary changed, so reload like a space switch.
              if (selectSpace(result.activeSpaceId)) {
                window.location.assign("/app");
                return;
              }
            }
            await refreshBots(true);
          }}
        />
      ) : null}

      {newSectionTarget ? (
        <NewBotSectionDialog
          bot={newSectionTarget.chat}
          onCancel={() => setNewSectionTarget(null)}
          onConfirm={async (name) => {
            await rpc.botSections.create(
              newSectionTarget.kind === "bot"
                ? { botId: newSectionTarget.chat.id, name }
                : { groupId: newSectionTarget.chat.id, name },
            );
            setNewSectionTarget(null);
            await refreshBots();
          }}
        />
      ) : null}

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        bots={bots}
        onSelectBot={(id) => {
          setMobileSidebarOpen(false);
          navigate(`/app/${id}`);
        }}
      />

      {newSpaceOpen ? (
        <NewSpaceDialog
          onCancel={() => setNewSpaceOpen(false)}
          onConfirm={async (name) => {
            const space = await rpc.spaces.create({ name });
            if (!selectSpace(space.id)) {
              setNewSpaceOpen(false);
              await refreshBots();
              return;
            }
            window.location.assign("/onboarding");
          }}
        />
      ) : null}

      {pickerInfoTopic ? (
        <PickerInfoDialog topic={pickerInfoTopic} onClose={() => setPickerInfoTopic(null)} />
      ) : null}

      {clearTarget ? (
        <ClearConversationDialog
          bot={clearTarget.chat}
          onCancel={() => setClearTarget(null)}
          onConfirm={async () => {
            await rpc.threads.clear(
              clearTarget.kind === "bot"
                ? { botId: clearTarget.chat.id }
                : { groupId: clearTarget.chat.id },
            );
            if (
              (clearTarget.kind === "bot" && active?.id === clearTarget.chat.id) ||
              (clearTarget.kind === "group" && activeGroup?.id === clearTarget.chat.id)
            ) {
              expandedHistoryThread.current = null;
              pinnedAroundRef.current = null;
              historyEpoch.current += 1;
              updateSnapshot((current) =>
                current ? { ...current, messages: [], olderCursor: null, run: null } : current,
              );
            }
            setClearTarget(null);
            await refreshBots();
          }}
        />
      ) : null}

      {deleteRoutineTarget ? (
        <DeleteItemDialog
          item={deleteRoutineTarget}
          noun="routine"
          onCancel={() => setDeleteRoutineTarget(null)}
          onConfirm={async () => {
            const target = deleteRoutineTarget;
            await rpc.routines.remove({ routineId: target.id });
            setDeleteRoutineTarget(null);
            setEditingRoutine((current) => (current?.id === target.id ? null : current));
            if (activeBotId.current !== target.botId) return;
            await refreshThread(target.botId);
            if (activeBotId.current === target.botId) setPanel("computer");
          }}
        />
      ) : null}
    </>
  );
}
