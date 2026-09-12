import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { Bot, Group } from "@rakazo/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""),
        "",
      ),
  }),
}));

import { GroupSettings } from "./GroupPanel";
import { DeleteItemDialog } from "./shell/dialogs";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

function sampleBot(id: string, name: string): Bot {
  return {
    id,
    spaceId: "space-1",
    name,
    title: "",
    description: "",
    instructions: "",
    color: "#8B5CF6",
    avatarShape: "hexagon",
    notifyOnFinish: true,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    unread: false,
    parentBotId: null,
    memoryScope: null,
    threadId: `thread-${id}`,
    preview: "",
    status: "idle",
    computerMode: "team",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    voiceId: null,
    autoSpeak: false,
    modelProvider: null,
    modelId: null,
    thinkingLevel: null,
    teamChatAmbientEnabled: false,
    teamChatRules: "",
    webhookConfigured: false,
    hasAvatar: false,
    spawnKey: null,
  };
}

const bots = [sampleBot("bot-1", "Chief"), sampleBot("bot-2", "Scout")];

const group: Group = {
  id: "group-1",
  spaceId: "space-1",
  name: "Crew",
  pinned: false,
  sectionId: null,
  archivedAt: null,
  members: [
    { botId: "bot-1", name: "Chief", color: "#8B5CF6" },
    { botId: "bot-2", name: "Scout", color: "#10B981" },
  ],
  threadId: "thread-g",
  preview: "",
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function DangerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <GroupSettings
        group={group}
        bots={bots}
        onSave={async () => undefined}
        onRemove={() => setOpen(true)}
      />
      {open ? (
        <DeleteItemDialog
          item={group}
          noun="group"
          onCancel={() => setOpen(false)}
          onConfirm={async () => undefined}
        />
      ) : null}
    </>
  );
}

describe("group settings", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders sections in order", () => {
    render(
      wrap(
        <GroupSettings
          group={group}
          bots={bots}
          onSave={async () => undefined}
          onRemove={() => undefined}
        />,
      ),
    );
    expect(screen.getAllByRole("heading").map((node) => node.textContent)).toEqual([
      "Profile",
      "Danger",
    ]);
  });

  it("opens the delete dialog", async () => {
    const user = userEvent.setup();
    render(wrap(<DangerHarness />));
    await user.click(screen.getByTestId("group-settings-delete"));
    expect(screen.getByRole("alertdialog", { name: "Delete Crew?" })).toBeVisible();
  });
});
