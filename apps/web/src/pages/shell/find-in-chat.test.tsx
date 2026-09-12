import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

import { collectFindMatches, FindInChat } from "./find-in-chat";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

function Harness() {
  const messages = [
    { id: "a", text: "apple pie" },
    { id: "b", text: "banana" },
    { id: "c", text: "apple tart" },
  ];
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("apple");
  const matches = collectFindMatches(messages, query);
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <FindInChat
      open={open}
      query={query}
      onQuery={(value) => {
        setQuery(value);
        setActiveIndex(0);
      }}
      matches={matches}
      activeIndex={activeIndex}
      onActiveIndex={setActiveIndex}
      onClose={() => setOpen(false)}
    />
  );
}

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("FindInChat", () => {
  it("opens, cycles, and closes", async () => {
    const user = userEvent.setup();
    render(wrap(<Harness />));
    const pill = screen.getByTestId("find-in-chat");
    expect(pill).toHaveTextContent("1/2");
    await user.click(screen.getByRole("button", { name: "Next match" }));
    expect(pill).toHaveTextContent("2/2");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(pill).toHaveTextContent("1/2");
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("find-in-chat")).toBeNull();
  });

  it("collects case-insensitive matches", () => {
    expect(
      collectFindMatches(
        [
          { id: "1", text: "Hello Ken" },
          { id: "2", text: "nope" },
        ],
        "ken",
      ),
    ).toEqual(["1"]);
  });
});
