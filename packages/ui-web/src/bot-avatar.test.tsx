import { AVATAR_SHAPES, resolveAvatarShape } from "@rakazo/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvatarShapePreview, BotAvatar } from "./bot-avatar.js";

describe("BotAvatar", () => {
  it("renders a circular photo when imageSrc is set", () => {
    const { container } = render(
      <BotAvatar color="#8B5CF6" identity="bot-1" imageSrc="/api/bots/bot-1/avatar?v=1" />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/api/bots/bot-1/avatar?v=1");
    expect(image).toHaveClass("object-cover");
  });

  it("renders the resolved mascot path when there is no photo", () => {
    const { container } = render(<BotAvatar color="#8B5CF6" identity="maya" shape="cloud" />);
    const path = container.querySelector("path");
    expect(path).toHaveAttribute("d", AVATAR_SHAPES.cloud);
    expect(container.querySelectorAll("ellipse")).toHaveLength(2);
  });

  it("hashes a default shape from the bot id", () => {
    const { container } = render(<BotAvatar color="#10B981" identity="bot-research" />);
    expect(container.querySelector("path")).toHaveAttribute(
      "d",
      AVATAR_SHAPES[resolveAvatarShape("bot-research")],
    );
  });
});

describe("AvatarShapePreview", () => {
  it("names the shape for the studio grid", () => {
    render(<AvatarShapePreview shape="hexagon" color="#8B5CF6" selected />);
    expect(screen.getByRole("button", { name: "hexagon" })).toHaveAttribute("aria-pressed", "true");
  });
});
