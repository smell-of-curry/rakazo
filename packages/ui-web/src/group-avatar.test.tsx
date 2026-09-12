import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupAvatar } from "./group-avatar.js";

describe("GroupAvatar", () => {
  it("renders fallback squad icon when no members provided", () => {
    const { container } = render(<GroupAvatar members={[]} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders a single mascot when one member is present", () => {
    const { container } = render(
      <GroupAvatar members={[{ name: "Harry", color: "#8B5CF6", botId: "bot-1" }]} />,
    );
    expect(container.querySelector("path")).toBeTruthy();
  });

  it("renders an overflow count for four or more members", () => {
    render(
      <GroupAvatar
        members={[
          { name: "Sherlock", color: "#8B5CF6", botId: "a" },
          { name: "Elon", color: "#06B6D4", botId: "b" },
          { name: "Penny", color: "#EC4899", botId: "c" },
          { name: "Harry", color: "#10B981", botId: "d" },
        ]}
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
