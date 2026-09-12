import { describe, expect, it } from "vitest";
import { shouldContinueForHumanGate, textLooksLikeHumanGate } from "./human-gate.js";

describe("textLooksLikeHumanGate", () => {
  it("flags secret and login asks", () => {
    expect(textLooksLikeHumanGate("Please paste your API key")).toBe(true);
    expect(textLooksLikeHumanGate("Sign in at https://sentry.example.com")).toBe(true);
    expect(textLooksLikeHumanGate("Which org should I use?")).toBe(true);
  });

  it("ignores reports and empty text", () => {
    expect(
      textLooksLikeHumanGate("Sentry login is present. I continued without another takeover."),
    ).toBe(false);
    expect(textLooksLikeHumanGate("Here is the weekly report for the site.")).toBe(false);
    expect(textLooksLikeHumanGate("")).toBe(false);
  });
});

describe("shouldContinueForHumanGate", () => {
  it("allows one continue on a prose ask", () => {
    expect(shouldContinueForHumanGate({ assembled: "Please paste your API key" })).toBe(true);
    expect(
      shouldContinueForHumanGate({
        assembled: "Please paste your API key",
        alreadyContinued: true,
      }),
    ).toBe(false);
    expect(
      shouldContinueForHumanGate({
        assembled: "Please paste your API key",
        scripted: true,
      }),
    ).toBe(false);
    expect(shouldContinueForHumanGate({ assembled: "Done. Calendar is connected." })).toBe(false);
  });
});
