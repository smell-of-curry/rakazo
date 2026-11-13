import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./helpers";

test("reply previews retain graphemes and clamp within the viewport", async ({
  page,
}, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/e2e/fixtures/reply-preview-graphemes.html");
    const previews = page.getByTestId("reply-parent-preview");
    await expect(previews).toHaveCount(10);
    for (const [index, cluster] of ["😀", "👩‍💻", "🇧🇷", "👍🏽", "e\u0301"].entries()) {
      await expect(previews.nth(index * 2)).toHaveAccessibleName(
        `Jump to replied message: ${"x".repeat(120)}`,
      );
      await expect(previews.nth(index * 2)).toHaveText(`↩ Helper: ${"x".repeat(279)}`);
      await expect(previews.nth(index * 2 + 1)).toContainText(`Short ${cluster}`);
    }
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    await captureScreenshot(page, testInfo, `reply-preview-${width}`);
  }
});
