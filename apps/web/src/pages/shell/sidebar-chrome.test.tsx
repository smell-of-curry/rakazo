import { i18n } from "@lingui/core";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { PinnedGrid } from "./pinned-grid";
import {
  accountDisplayName,
  BotTitleCapsule,
  SidebarAccountRow,
  SidebarChatRow,
  SidebarSectionHeader,
} from "./sidebar-chrome";

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
    expect(container.innerHTML).toContain("text-micro");
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
    expect(container.innerHTML).toContain("rounded-lg");
    expect(container.querySelector('[data-roster-bot-id="bot-1"]')).toBeTruthy();
    expect(container.querySelector("[data-roster-bot-name]")).toBeTruthy();
    expect(screen.getByText("Chief")).toBeInTheDocument();
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.queryByText("Ops")).toBeNull();
    expect(screen.getByText("Crew")).toBeInTheDocument();
    expect(screen.queryByText("Pinned")).toBeNull();
    expect(container.querySelector('[data-roster-bot-id="grp-1"]')).toBeNull();
    expect(container.textContent?.match(/ignored/g)).toBeNull();
    expect(container.innerHTML).toContain("text-caption");
  });

  it("shows a title capsule on pins that are not waiting", () => {
    render(
      <PinnedGrid
        items={[
          {
            chatId: "bot-2",
            kind: "bot",
            name: "Chief",
            title: "Ops",
            avatar: <span>A</span>,
          },
        ]}
      />,
    );
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.queryByText("Needs you")).toBeNull();
  });

  it("shows preview variants without a role chip", () => {
    const { rerender, container } = render(
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
    expect(screen.queryByText("Ops")).toBeNull();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("8:43 AM")).toBeInTheDocument();
    expect(container.innerHTML).toContain("bg-sidebar-accent");
    expect(container.innerHTML).toContain("text-body");
    expect(container.innerHTML).toContain("text-small");
    expect(container.innerHTML).not.toContain("text-[");

    rerender(
      <SidebarChatRow
        kind="group"
        chatId="grp-1"
        avatar={<span>G</span>}
        name="Crew"
        preview="Ken: hello"
        time="Yesterday"
      />,
    );
    expect(screen.getByText("Ken: hello")).toBeInTheDocument();

    rerender(
      <SidebarChatRow
        kind="bot"
        chatId="bot-1"
        avatar={<span>A</span>}
        name="Chief"
        preview="Messaged Ken: check marks"
        time="8:29 AM"
      />,
    );
    expect(screen.getByText("Messaged Ken: check marks")).toBeInTheDocument();
  });

  it("puts a 6px unread dot left of the time", () => {
    const { container } = render(
      <SidebarChatRow
        kind="bot"
        chatId="bot-1"
        avatar={<span>A</span>}
        name="Chief"
        time="8:43 AM"
        unread
      />,
    );
    expect(screen.getByText("8:43 AM")).toBeInTheDocument();
    expect(container.innerHTML).toContain("h-1.5 w-1.5");
    expect(container.innerHTML).toContain("bg-primary");
    const meta = screen.getByText("8:43 AM").parentElement;
    expect(meta?.querySelector(".bg-primary")).toBeTruthy();
  });

  it.each(["waiting_takeover", "waiting_input"] as const)(
    "shows Needs you instead of the time for %s",
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
      expect(screen.queryByText("8:43 AM")).toBeNull();
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

  it("styles section headers as small uppercase tracking with a hover chevron", () => {
    const { container } = render(<SidebarSectionHeader title="Unassigned" collapsed={false} />);
    expect(screen.getByRole("button", { name: "Unassigned" })).toBeInTheDocument();
    expect(container.innerHTML).toContain("uppercase");
    expect(container.innerHTML).toContain("tracking-[0.06em]");
    expect(container.innerHTML).toContain("text-caption");
    expect(container.innerHTML).toContain("text-muted-foreground");
    expect(container.innerHTML).toContain("group-hover:opacity-100");
    expect(screen.getByRole("button", { name: "Unassigned" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("falls back to the email local-part and never Owner", () => {
    expect(accountDisplayName("Jordan", "jordan@example.test")).toBe("Jordan");
    expect(accountDisplayName("Owner", "jordan@example.test")).toBe("jordan");
    expect(accountDisplayName("  ", "jordan@example.test")).toBe("jordan");
    expect(accountDisplayName(undefined, "jordan@example.test")).toBe("jordan");
    expect(accountDisplayName("", null)).toBe("");

    render(<SidebarAccountRow name={accountDisplayName("", "jordan@example.test")} initials="J" />);
    expect(screen.getByText("jordan")).toBeInTheDocument();
    expect(screen.queryByText("Owner")).toBeNull();
  });
});
