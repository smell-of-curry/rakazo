import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { Bot, ComputerStatus, Routine, ThreadSnapshot } from "@rakazo/contracts";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ComputerPane } from "./computer-pane";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

function bot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "bot-1",
    spaceId: "space-1",
    name: "Head",
    title: "",
    description: "",
    instructions: "",
    color: "#111111",
    avatarShape: null,
    notifyOnFinish: false,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    unread: false,
    parentBotId: null,
    memoryScope: null,
    threadId: "thread-1",
    preview: "",
    status: "idle",
    computerMode: "dedicated",
    updatedAt: "2026-09-12T00:00:00.000Z",
    createdAt: "2026-09-12T00:00:00.000Z",
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

function computer(overrides: Partial<ComputerStatus> = {}): ComputerStatus {
  return {
    botId: "bot-1",
    mode: "dedicated",
    kind: "fake",
    state: "running",
    controlHolder: "none",
    controlBotId: null,
    takeoverRequested: false,
    screenAvailable: true,
    screenWidth: 1280,
    screenHeight: 800,
    homeRevision: null,
    busyBotName: null,
    canUpdate: true,
    ...overrides,
  };
}

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "routine-1",
    botId: "bot-1",
    name: "Uptime",
    prompt: "check",
    crons: ["0 8 * * *"],
    timezone: "UTC",
    active: true,
    notify: true,
    webhookEnabled: false,
    githubEnabled: false,
    messageProvider: null,
    modelProvider: null,
    modelId: null,
    thinkingLevel: null,
    lastRunAt: null,
    nextRunAt: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => undefined;

function renderPane(overrides: Partial<Parameters<typeof ComputerPane>[0]> = {}) {
  return render(
    wrap(
      <ComputerPane
        active={bot()}
        computerOpen={false}
        computer={computer()}
        booting={false}
        embeddedScreenUrl={null}
        computerScreenError={null}
        bootstrapMe={null}
        openComputer={noop}
        setRoutineDraft={noop}
        setRoutineWebhookSecret={noop}
        setEditingRoutine={noop}
        setRoutineError={noop}
        setPanel={noop}
        activeRoutines={[]}
        snapshot={null}
        stopRun={noop}
        {...overrides}
      />,
    ),
  );
}

describe("ComputerPane", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("shows the named computer title and Live chip, never the raw state", () => {
    renderPane();
    expect(screen.getByText("Head’s computer")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("computer-status-chip").every((node) => node.textContent === "Live"),
    ).toBe(true);
    expect(screen.queryByText("running")).toBeNull();
  });

  it("shows Team computer and Needs you", () => {
    renderPane({
      active: bot({ computerMode: "team" }),
      computer: computer({ mode: "team", takeoverRequested: true }),
    });
    expect(screen.getByText("Team computer")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("computer-status-chip")
        .every((node) => node.textContent === "Needs you"),
    ).toBe(true);
  });

  it("renders human routine schedules and a Running chip with Stop", () => {
    const stopRun = vi.fn();
    renderPane({
      activeRoutines: [
        routine({ id: "r1", name: "Morning", crons: ["0 8 * * *"] }),
        routine({ id: "r2", name: "Hours", crons: ["0 */6 * * *"] }),
        routine({ id: "r3", name: "Webhook", crons: [], webhookEnabled: true }),
        routine({ id: "r4", name: "Quiet", crons: ["0 8 * * *"], active: false }),
      ],
      snapshot: {
        run: { routineId: "r1", status: "running" },
      } as ThreadSnapshot,
      stopRun,
    });
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Every day at 8:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Every 6 hours")).toBeInTheDocument();
    expect(screen.getByText("When a webhook fires")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByText(/Cron /)).toBeNull();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  });
});
