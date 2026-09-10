import { i18n } from "@lingui/core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { PinnedGrid } from "./pinned-grid";
import { BotTitleCapsule, SidebarChatRow, SidebarSectionHeader } from "./sidebar-chrome";

describe("sidebar chrome", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("hides empty title capsules", () => {
    expect(renderToStaticMarkup(<BotTitleCapsule title="  " />)).toBe("");
    expect(renderToStaticMarkup(<BotTitleCapsule title="Ops" />)).toContain("Ops");
    expect(renderToStaticMarkup(<BotTitleCapsule title="Ops" />)).toContain("rounded-full");
  });

  it("renders a 3-column pin grid without a Pinned heading", () => {
    const html = renderToStaticMarkup(
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
    expect(html).toContain('data-sidebar-group="pinned"');
    expect(html).toContain("grid-cols-3");
    expect(html).toContain('data-roster-bot-id="bot-1"');
    expect(html).toContain("data-roster-bot-name");
    expect(html).toContain("Chief");
    expect(html).toContain("Needs you");
    expect(html).not.toContain("Ops");
    expect(html).toContain("Crew");
    expect(html).not.toContain("Pinned");
    expect(html).not.toContain('data-roster-bot-id="grp-1"');
    expect(html.match(/ignored/g)).toBeNull();
  });

  it("puts bot title in a capsule beside the preview", () => {
    const html = renderToStaticMarkup(
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
    expect(html).toContain('data-roster-bot-id="bot-1"');
    expect(html).toContain("data-roster-bot-name");
    expect(html).toContain("Ops");
    expect(html).toContain("Ship it");
    expect(html).toContain("8:43 AM");
    expect(html).toContain("bg-sidebar-accent");
    expect(html).toContain("rounded-full");
    expect(html).not.toContain("text-[13.5px]");
  });

  it.each(["waiting_takeover", "waiting_input"] as const)(
    "shows Needs you instead of raw %s",
    (status) => {
      const html = renderToStaticMarkup(
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
      expect(html).toContain("Needs you");
      expect(html).toContain("bg-warning/15");
      expect(html).toContain("text-warning");
      expect(html).toContain("8:43 AM");
      expect(html).toContain("rounded-full");
      expect(html).not.toContain(status);
    },
  );

  it("hides queued/running instead of dumping the raw status", () => {
    const html = renderToStaticMarkup(
      <SidebarChatRow
        kind="bot"
        chatId="bot-1"
        avatar={<span>A</span>}
        name="Chief"
        time="8:43 AM"
        status="queued"
      />,
    );
    expect(html).toContain("8:43 AM");
    expect(html).not.toContain("queued");
    expect(html).not.toContain("running");
    expect(html).not.toContain("Needs you");
  });

  it("styles section headers as small uppercase tracking", () => {
    const html = renderToStaticMarkup(
      <SidebarSectionHeader title="PokeBedrock" collapsed={false} />,
    );
    expect(html).toContain("PokeBedrock");
    expect(html).toContain("uppercase");
    expect(html).toContain("tracking-[0.06em]");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain('aria-expanded="true"');
  });
});
