import type { AgentSkillCatalogEntry, Bot, Group } from "@rakazo/contracts";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { rpc } from "../../lib/rpc";
import { GroupSettings } from "../GroupPanel";
import { BotSettings } from "./bot-settings";
import { DeleteBotDialog, DeleteItemDialog } from "./dialogs";
import { firstThreadRoute } from "./thread-events";
import type { Panel } from "./types";

export function BotSettingsPane({
  active,
  memoryProviderConfigured,
  onSkillsChange,
  onAvatarChange,
  onClear,
  refreshBots,
}: {
  active: Bot;
  memoryProviderConfigured: boolean;
  onSkillsChange: Dispatch<SetStateAction<AgentSkillCatalogEntry[]>>;
  onAvatarChange: () => void;
  onClear: () => void;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <BotSettings
        key={active.id}
        bot={active}
        memoryProviderConfigured={memoryProviderConfigured}
        onSkillsChange={onSkillsChange}
        onAvatarChange={onAvatarChange}
        onSave={async ({ computerMode, ...patch }) => {
          if (computerMode !== undefined && computerMode !== active.computerMode) {
            await rpc.bots.setComputer({
              botId: active.id,
              mode: computerMode,
            });
          }
          if (Object.keys(patch).length > 0) {
            await rpc.bots.update({ botId: active.id, ...patch });
          }
          await refreshBots();
        }}
        onExport={async () => {
          const manifest = await rpc.export.bot({ botId: active.id });
          const blob = new Blob([JSON.stringify(manifest, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${active.name.toLowerCase().replace(/\s+/g, "-")}-export.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onClear={onClear}
        onDelete={() => setDeleteOpen(true)}
      />
      {deleteOpen ? (
        <DeleteBotDialog
          bot={active}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async (deleteMemories) => {
            await rpc.bots.remove({ botId: active.id, deleteMemories });
            setDeleteOpen(false);
            await refreshBots(true);
          }}
        />
      ) : null}
    </>
  );
}

export function GroupSettingsPane({
  activeGroup,
  bots,
  groups,
  setGroups,
  setPanel,
  navigate,
  refreshBots,
  refreshGroupThread,
}: {
  activeGroup: Group;
  bots: Bot[];
  groups: Group[];
  setGroups: Dispatch<SetStateAction<Group[]>>;
  setPanel: Dispatch<SetStateAction<Panel>>;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
  refreshGroupThread: (id: string) => Promise<unknown>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <GroupSettings
        key={activeGroup.id}
        group={activeGroup}
        bots={bots}
        onSave={async (input) => {
          const updated = await rpc.groups.update({ groupId: activeGroup.id, ...input });
          setGroups((current) =>
            current.map((group) => (group.id === updated.id ? updated : group)),
          );
          await Promise.all([refreshBots(), refreshGroupThread(activeGroup.id)]).catch(
            () => undefined,
          );
        }}
        onRemove={() => setDeleteOpen(true)}
      />
      {deleteOpen ? (
        <DeleteItemDialog
          item={activeGroup}
          noun="group"
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => {
            await rpc.groups.remove({ groupId: activeGroup.id });
            const remainingGroups = groups.filter((group) => group.id !== activeGroup.id);
            setGroups(remainingGroups);
            setDeleteOpen(false);
            setPanel(null);
            navigate(firstThreadRoute(bots, remainingGroups), { replace: true });
            await refreshBots().catch(() => undefined);
          }}
        />
      ) : null}
    </>
  );
}
