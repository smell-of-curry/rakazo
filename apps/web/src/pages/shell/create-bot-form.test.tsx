import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { AVATAR_COLORS, AVATAR_SHAPE_KEYS } from "@rakazo/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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

import { CreateBotForm } from "./create-bot-form";

function wrap(node: ReactNode) {
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

describe("create bot form", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("submits name, title, shape, and color", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(wrap(<CreateBotForm onCreate={onCreate} onCancel={() => undefined} />));
    expect(screen.queryByLabelText("Description")).toBeNull();
    await user.type(screen.getByLabelText("Name"), "Scout");
    await user.type(screen.getByLabelText("Title"), "Finder");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0]?.[0] as {
      name: string;
      title: string;
      color: string;
      avatarShape: string;
    };
    expect(payload).toMatchObject({ name: "Scout", title: "Finder" });
    expect(AVATAR_SHAPE_KEYS).toContain(payload.avatarShape);
    expect(AVATAR_COLORS.some((color) => color.hex === payload.color)).toBe(true);
  });
});
