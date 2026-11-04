import { expect, it } from "vitest";
import { countUnreadsAbove } from "./more-unreads-count";

it("counts unread rows whose bottom sits above the scrollport", () => {
  expect(countUnreadsAbove(100, [40, 90, 100, 140])).toBe(2);
  expect(countUnreadsAbove(0, [40])).toBe(0);
  expect(countUnreadsAbove(20, [])).toBe(0);
});
