import type { Bot, ComputerMode } from "@rakazo/contracts";
import type { Dispatch, SetStateAction } from "react";
import { CreateGroupForm } from "../GroupPanel";
import { CreateBotForm } from "./bot-panel";
import type { Panel } from "./types";

export function CreateBotPane({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    title: string;
    description: string;
    computerMode: ComputerMode;
  }) => Promise<void>;
}) {
  return <CreateBotForm onCancel={onCancel} onCreate={onCreate} />;
}

export function CreateGroupPane({
  bots,
  setPanel,
  onCreate,
}: {
  bots: Bot[];
  setPanel: Dispatch<SetStateAction<Panel>>;
  onCreate: (input: { name: string; botIds: string[] }) => Promise<void>;
}) {
  return <CreateGroupForm bots={bots} onCancel={() => setPanel(null)} onCreate={onCreate} />;
}
