import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActiveBotGlyph, CollaborationMarker } from "./CollaborationMarker";

describe("collaboration transcript markers", () => {
  it("shows a centered in-progress peer row with a pulse", () => {
    render(
      <CollaborationMarker
        ariaLabel="1 messages with Research"
        color="#14B8A6"
        identity="research"
        label="1 messages with Research"
        onClick={() => undefined}
      />,
    );

    const chip = screen.getByTestId("peer-receipt-chip");
    expect(chip).toHaveAccessibleName("1 messages with Research");
    expect(chip.className).toContain("text-caption");
    expect(chip.parentElement?.className).toContain("justify-center");
    expect(chip.querySelector(".animate-pulse")).toBeTruthy();
    expect(chip).toHaveTextContent("1 messages with Research");
  });

  it("renders a bot bubble with a three-dot pulse", () => {
    render(
      <ActiveBotGlyph
        bots={[{ botId: "research", color: "#14B8A6", status: "running" }]}
        label="Research is working"
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByTestId("typing-dots")).toBeInTheDocument();
    expect(screen.getByTestId("message-bot-bubble")).toBeInTheDocument();
    expect(screen.getByText("Research is working")).toHaveClass("sr-only");
  });
});
