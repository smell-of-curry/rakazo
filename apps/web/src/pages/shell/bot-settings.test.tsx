import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { Bot } from "@rakazo/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""), ""),
}));
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

import { BotSettings } from "./bot-settings";
import { ClearConversationDialog, DeleteBotDialog } from "./dialogs";
import { SAVE_DEBOUNCE_MS } from "./use-debounced-save";

vi.mock("../../lib/rpc", () => ({
  rpc: {
    voice: { voices: vi.fn().mockResolvedValue([]) },
    models: {
      credentials: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([]),
    },
    me: vi.fn().mockResolvedValue(null),
    bots: {
      update: vi
        .fn()
        .mockResolvedValue({ hasAvatar: false, updatedAt: "2026-01-01T00:00:00.000Z" }),
      setAvatar: vi.fn(),
      remove: vi.fn(),
    },
    computer: {
      recover: vi.fn().mockResolvedValue({}),
      reset: vi.fn().mockResolvedValue({}),
    },
    scratchpad: { list: vi.fn().mockResolvedValue([]) },
  },
}));

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

function sampleBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "bot-1",
    spaceId: "space-1",
    name: "Chief",
    title: "Ops",
    description: "",
    instructions: "Stay brief",
    color: "#8B5CF6",
    avatarShape: "hexagon",
    notifyOnFinish: true,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    unread: false,
    parentBotId: null,
    memoryScope: null,
    threadId: "thread-1",
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
    ...overrides,
  };
}

function renderSettings(overrides: Partial<ComponentProps<typeof BotSettings>> = {}) {
  return render(
    wrap(
      <BotSettings
        bot={sampleBot()}
        memoryProviderConfigured
        onSkillsChange={() => undefined}
        onSave={async () => undefined}
        onExport={async () => undefined}
        onClear={() => undefined}
        onDelete={() => undefined}
        {...overrides}
      />,
    ),
  );
}

function DangerHarness() {
  const bot = sampleBot();
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <BotSettings
        bot={bot}
        memoryProviderConfigured={false}
        onSkillsChange={() => undefined}
        onSave={async () => undefined}
        onExport={async () => undefined}
        onClear={() => setClearOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      {clearOpen ? (
        <ClearConversationDialog
          bot={bot}
          onCancel={() => setClearOpen(false)}
          onConfirm={async () => undefined}
        />
      ) : null}
      {deleteOpen ? (
        <DeleteBotDialog
          bot={bot}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async () => undefined}
        />
      ) : null}
    </>
  );
}

describe("bot settings", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders sections in order", () => {
    renderSettings();
    expect(screen.getAllByRole("heading").map((node) => node.textContent)).toEqual([
      "Profile",
      "Instructions",
      "Model",
      "Computer",
      "Notifications",
      "Danger",
    ]);
  });

  it("does not write instructions when description is edited", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSettings({ onSave });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Hello" } });
    expect(onSave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toEqual({ description: "Hello" });
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("instructions");
    vi.useRealTimers();
  });

  it("auto-saves once per debounce window", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSettings({ onSave });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "One" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Lead" } });
    expect(onSave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      description: "One",
      title: "Lead",
    });
    vi.useRealTimers();
  });

  it("opens danger dialogs", async () => {
    const user = userEvent.setup();
    render(wrap(<DangerHarness />));
    await user.click(screen.getByTestId("bot-settings-clear"));
    expect(screen.getByRole("alertdialog", { name: "Clear Chief’s conversation?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByTestId("bot-settings-delete"));
    expect(screen.getByRole("alertdialog", { name: "Delete Chief?" })).toBeVisible();
  });
});
