import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { InstalledRow, MarketplaceCard } from "./items";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

describe("integrations cards", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders an unconnected marketplace card with Connect", () => {
    const onConnect = vi.fn();
    render(
      wrap(
        <MarketplaceCard name="Gmail" description="Mail" connected={false} onConnect={onConnect} />,
      ),
    );
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.getByText("Mail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("renders a connected marketplace card with a Connected chip", () => {
    render(wrap(<MarketplaceCard name="Gmail" connected onConnect={() => undefined} />));
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("renders installed rows for each status with the right actions", async () => {
    const user = userEvent.setup();
    const onReopen = vi.fn();
    const onRemove = vi.fn();
    const { rerender } = render(
      wrap(
        <InstalledRow name="Gmail" status="connected" onReopen={onReopen} onRemove={onRemove} />,
      ),
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();

    rerender(
      wrap(<InstalledRow name="Linear" status="waiting" onReopen={onReopen} onRemove={onRemove} />),
    );
    expect(screen.getByText("Waiting for authorization")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(onReopen).toHaveBeenCalledOnce();

    rerender(
      wrap(<InstalledRow name="Slack" status="disabled" onReopen={onReopen} onRemove={onRemove} />),
    );
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
