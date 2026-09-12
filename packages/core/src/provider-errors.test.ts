import { describe, expect, it } from "vitest";
import {
  delegatedFailureText,
  formatRateLimitUserText,
  formatSetupRetryUserText,
  isRateLimitError,
  rateLimitRetryDelayMs,
} from "./provider-errors.js";

describe("isRateLimitError", () => {
  it("detects OpenRouter 429 dumps", () => {
    expect(
      isRateLimitError(
        '429: {"message":"Rate limit exceeded: new-account-rpm/openai/gpt-5.6-luna"}',
      ),
    ).toBe(true);
    expect(isRateLimitError("Too Many Requests")).toBe(true);
    expect(isRateLimitError("connection refused")).toBe(false);
  });
});

describe("rateLimitRetryDelayMs", () => {
  it("honors retry-after seconds", () => {
    expect(rateLimitRetryDelayMs('retry-after":45', 1)).toBe(45_000);
  });

  it("backs off when the provider sent no hint", () => {
    expect(rateLimitRetryDelayMs("429", 1)).toBe(15_000);
    expect(rateLimitRetryDelayMs("429", 2)).toBe(30_000);
    expect(rateLimitRetryDelayMs("429", 5)).toBe(120_000);
  });
});

describe("formatRateLimitUserText", () => {
  it("says retrying with a delay", () => {
    expect(formatRateLimitUserText({ retrying: true, delayMs: 45_000 })).toBe(
      "Rate limited. Retrying in 45s.",
    );
    expect(formatRateLimitUserText({ retrying: false })).toBe(
      "Rate limited. Stopped after retries.",
    );
  });
});

describe("formatSetupRetryUserText", () => {
  it("names the wait when the shared computer is busy", () => {
    expect(formatSetupRetryUserText(true)).toBe("Waiting for the team computer.");
    expect(formatSetupRetryUserText(false)).toBe("Could not start. Retrying.");
  });
});

describe("delegatedFailureText", () => {
  it("strips raw 429 json from peer returns", () => {
    expect(delegatedFailureText('429: {"message":"Rate limit exceeded"}')).toBe(
      "Rate limited. Stopped after retries.",
    );
    expect(delegatedFailureText("no model")).toBe(
      "Could not complete the delegated request: no model",
    );
  });
});
