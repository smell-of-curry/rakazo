import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ConnectionCatalogItem } from "@rakazo/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { type InstalledEntry, IntegrationsView } from "./view";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

function item(slug: string, name: string, connected = false): ConnectionCatalogItem {
  return { connectorId: slug, slug, name, logo: null, connected, noAuth: false };
}

const catalog = [item("gmail", "Gmail", true), item("linear", "Linear")];
const installed: InstalledEntry[] = [
  { id: "c1", kind: "connection", name: "Gmail", status: "connected" },
  { id: "m1", kind: "mcp", name: "Linear MCP", status: "waiting" },
];

function view(overrides: Partial<ComponentProps<typeof IntegrationsView>> = {}) {
  return wrap(
    <IntegrationsView
      query=""
      onQuery={() => undefined}
      tab="marketplace"
      onTab={() => undefined}
      catalog={catalog}
      featured={[catalog[0]!]}
      installed={installed}
      pending={null}
      error={null}
      onConnect={() => undefined}
      onReopen={() => undefined}
      onRemove={() => undefined}
      onAddMcp={() => undefined}
      {...overrides}
    />,
  );
}

describe("integrations view", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("filters marketplace and installed by search", async () => {
    const user = userEvent.setup();
    const onQuery = vi.fn();
    const { rerender } = render(view({ onQuery }));
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.getByText("Linear")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search"), "lin");
    expect(onQuery).toHaveBeenCalled();
    rerender(view({ query: "lin", onQuery }));
    expect(screen.queryByText("Gmail")).toBeNull();
    expect(screen.getByText("Linear")).toBeInTheDocument();
  });

  it("switches tabs between marketplace and installed", async () => {
    const user = userEvent.setup();
    const onTab = vi.fn();
    const { rerender } = render(view({ onTab }));
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByText("Linear MCP")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Installed" }));
    expect(onTab).toHaveBeenCalledWith("installed");
    rerender(view({ tab: "installed", onTab }));
    expect(screen.getByText("Linear MCP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add MCP server" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });
});
