import { describe, expect, it } from "vitest";
import { preferredActiveRunStatus } from "./thread-listing.js";

describe("preferredActiveRunStatus", () => {
  it("prefers a waiting gate over a newer busy run", () => {
    expect(
      preferredActiveRunStatus([
        { status: "running" },
        { status: "waiting_input" },
        { status: "queued" },
      ]),
    ).toBe("waiting_input");
    expect(preferredActiveRunStatus([{ status: "queued" }, { status: "waiting_takeover" }])).toBe(
      "waiting_takeover",
    );
  });

  it("falls back to the newest active run when nothing is waiting", () => {
    expect(preferredActiveRunStatus([{ status: "running" }, { status: "queued" }])).toBe("running");
    expect(preferredActiveRunStatus([])).toBeUndefined();
  });
});
