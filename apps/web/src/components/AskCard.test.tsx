import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectedAskActionLabel } from "@rakazo/core";
import { describe, expect, it } from "vitest";

const askCardSource = () => readFileSync(join(import.meta.dirname, "AskCard.tsx"), "utf8");

describe("AskCard", () => {
  it("keeps the free-text field visible", () => {
    const src = askCardSource();
    expect(src).toContain("Type your answer");
    expect(src).toContain("Send answer");
    expect(src).not.toContain("Send it");
    expect(src).not.toContain("Edit first");
  });

  it("keeps a free-text field on choice cards", () => {
    const src = askCardSource();
    expect(src).toContain("choiceOther");
    expect(src).toContain('data-testid="ask-other"');
    expect(src).toContain("!approvalActions && !secretInput");
  });

  it("marks the chosen action instead of a muted secondary button", () => {
    const src = askCardSource();
    expect(src).toContain(
      "justify-between bg-background font-medium text-foreground disabled:opacity-100",
    );
    expect(src).toContain('answered && !selected && "disabled:opacity-30"');
    expect(src).toContain("<Check size={16} strokeWidth={2} aria-hidden /> : null");
    expect(src).not.toContain('variant="secondary"');
  });
});

describe("selectedAskActionLabel", () => {
  it("maps a choice answer id to its user-facing label", () => {
    expect(
      selectedAskActionLabel("choice-2", [
        { id: "choice-1", label: "Berlin" },
        { id: "choice-2", label: "Seoul" },
      ]),
    ).toBe("Seoul");
  });

  it("falls back to the answer when an action is unavailable", () => {
    expect(selectedAskActionLabel("custom", undefined)).toBe("custom");
  });
});
