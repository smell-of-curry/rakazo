import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { Bot, ComputerStatus } from "@rakazo/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ComputerOverlay, ComputerReleaseActions } from "./computer-overlay";

vi.mock("../../lib/rpc", () => ({
  rpc: {
    computer: { takeover: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("../../components/ComputerMaintenanceActions", () => ({
  ComputerMaintenanceActions: () => null,
}));

vi.mock("../../components/teach/TeachCaptureOverlay", () => ({
  TeachCaptureOverlay: () => null,
}));

vi.mock("../../components/teach/TeachComputerOverlay", () => ({
  TeachComputerOverlayControl: () => null,
}));

vi.mock("../../components/teach/TeachRecordingChrome", () => ({
  TeachRecordingChrome: () => null,
  TeachStopButton: () => null,
}));

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
    controlHolder: "user",
    controlBotId: "bot-1",
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

describe("ComputerReleaseActions", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("shows Take control before the user holds a pending handoff", () => {
    const onTakeControl = vi.fn().mockResolvedValue(undefined);
    render(
      wrap(
        <ComputerReleaseActions
          takeoverRequested
          hasControl={false}
          onTakeControl={onTakeControl}
          onRelease={vi.fn()}
        />,
      ),
    );
    expect(screen.getByRole("button", { name: "Take control" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  });

  it("shows Done and Skip after the user takes a pending handoff", async () => {
    const user = userEvent.setup();
    const onRelease = vi.fn().mockResolvedValue(undefined);
    render(
      wrap(
        <ComputerReleaseActions
          takeoverRequested
          hasControl
          onTakeControl={vi.fn()}
          onRelease={onRelease}
        />,
      ),
    );
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take control" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onRelease).toHaveBeenCalledWith("done");
  });

  it("shows Release when the user has control without a handoff", () => {
    render(
      wrap(
        <ComputerReleaseActions
          takeoverRequested={false}
          hasControl
          onTakeControl={vi.fn()}
          onRelease={vi.fn()}
        />,
      ),
    );
    expect(screen.getByRole("button", { name: "Release" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take control" })).toBeNull();
  });
});

describe("ComputerOverlay", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("keeps the header chip and handoff buttons for a pending takeover", () => {
    render(
      wrap(
        <ComputerOverlay
          booting={false}
          active={bot()}
          computerOpen
          computerViewport={null}
          computer={computer({ takeoverRequested: true, controlHolder: "none" })}
          embeddedScreenUrl={null}
          computerScreenError={null}
          recordingSkill={null}
          teachBusy={false}
          stopTeaching={vi.fn()}
          hasControl={false}
          releaseComputer={vi.fn()}
          composerRunning={false}
          sending={false}
          stopRun={vi.fn()}
          refreshActiveTeaching={vi.fn()}
          refreshThread={vi.fn()}
          sendError={null}
          needsComputer={false}
          dockedAsk={undefined}
          setComputerOpen={vi.fn()}
        />,
      ),
    );
    expect(screen.getByTestId("computer-chrome")).toBeInTheDocument();
    expect(screen.getByText("Head’s computer")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("computer-status-chip")
        .every((node) => node.textContent === "Needs you"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Take control" })).toBeInTheDocument();
    expect(screen.queryByText("running")).toBeNull();
  });
});
