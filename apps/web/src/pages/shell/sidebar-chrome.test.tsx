import { i18n } from "@lingui/core";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { PinnedGrid } from "./pinned-grid";
import { BotTitleCapsule, SidebarChatRow, SidebarSectionHeader } from "./sidebar-chrome";

describe("sidebar chrome", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("hides empty title capsules", () => {
    const { container, rerender } = render(<BotTitleCapsule title="  " />);
    expect(container).toBeEmptyDOMElement();
    rerender(<BotTitleCapsule title="Ops" />);
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(container.innerHTML).toContain("rounded-full");
  });

  it("renders a 3-column pin grid without a Pinned heading", () => {
    const { container } = render(
      <PinnedGrid
        items={[
          {
            chatId: "bot-1",
            kind: "bot",
            name: "Chief",
            title: "Ops",
            status: "waiting_takeover",
            avatar: <span>A</span>,
            selected: true,
          },
          {
            chatId: "grp-1",
            kind: "group",
            name: "Crew",
            title: "ignored",
            avatar: <span>G</span>,
          },
        ]}
      />,
    );
    expect(container.querySelector('[data-sidebar-group="pinned"]')).toBeTruthy();
    expect(container.innerHTML).toContain("grid-cols-3");
    expect(container.querySelector('[data-roster-bot-id="bot-1"]')).toBeTruthy();
    expect(container.querySelector("[data-roster-bot-name]")).toBeTruthy();
    expect(screen.getByText("Chief")).toBeInTheDocument();
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.queryByText("Ops")).toBeNull();
    expect(screen.getByText("Crew")).toBeInTheDocument();
    expect(screen.queryByText("Pinned")).toBeNull();
    expect(container.querySelector('[data-roster-bot-id="grp-1"]')).toBeNull();
    expect(container.textContent?.match(/ignored/g)).toBeNull();
  });

  it("puts bot title in a capsule beside the preview", () => {
    const { container } = render(
      <SidebarChatRow
        kind="bot"
        chatId="bot-1"
        avatar={<span>A</span>}
        name="Chief"
        title="Ops"
        preview="Ship it"
        time="8:43 AM"
        selected
      />,
    );
    expect(container.querySelector('[data-roster-bot-id="bot-1"]')).toBeTruthy();
    expect(container.querySelector("[data-roster-bot-name]")).toBeTruthy();
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("8:43 AM")).toBeInTheDocument();
    expect(container.innerHTML).toContain("bg-sidebar-accent");
    expect(container.innerHTML).toContain("rounded-full");
    expect(container.innerHTML).not.toContain("text-[13.5px]");
  });

  it.each(["waiting_takeover", "waiting_input"] as const)(
    "shows Needs you instead of raw %s",
    (status) => {
      const { container } = render(
        <SidebarChatRow
          kind="bot"
          chatId="bot-1"
          avatar={<span>A</span>}
          name="Chief"
          time="8:43 AM"
          status={status}
          unread
        />,
      );
      expect(screen.getByText("Needs you")).toBeInTheDocument();
      expect(container.innerHTML).toContain("bg-warning/15");
      expect(container.innerHTML).toContain("text-warning");
      expect(screen.getByText("8:43 AM")).toBeInTheDocument();
      expect(container.innerHTML).toContain("rounded-full");
      expect(container.innerHTML).not.toContain(status);
    },
  );

  it("hides queued/running instead of dumping the raw status", () => {
    const { container } = render(
      <SidebarChatRow
        kind="bot"
        chatId="bot-1"
        avatar={<span>A</span>}
        name="Chief"
        time="8:43 AM"
        status="queued"
      />,
    );
    expect(screen.getByText("8:43 AM")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("queued");
    expect(container.innerHTML).not.toContain("running");
    expect(screen.queryByText("Needs you")).toBeNull();
  });

  it("styles section headers as small uppercase tracking", () => {
    const { container } = render(<SidebarSectionHeader title="PokeBedrock" collapsed={false} />);
    expect(screen.getByRole("button", { name: "PokeBedrock" })).toBeInTheDocument();
    expect(container.innerHTML).toContain("uppercase");
    expect(container.innerHTML).toContain("tracking-[0.06em]");
    expect(container.innerHTML).toContain("text-muted-foreground");
    expect(screen.getByRole("button", { name: "PokeBedrock" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
