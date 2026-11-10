import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./helpers";

test("mathematical diagram labels render in both themes", async ({ page }, testInfo) => {
  for (const theme of ["dark", "light"]) {
    await page.goto(`/e2e/fixtures/markdown-diagram.html?theme=${theme}`);
    const image = page.getByTestId("chat-diagram").locator("img");
    await expect(image).toBeVisible();
    await page.evaluate((markdown) => {
      window.dispatchEvent(
        new CustomEvent("rk-diagram-stream-update", { detail: { markdown, streaming: false } }),
      );
    }, '```mermaid\ngraph LR\n  A["$$x^2$$"] --> B["$$\\frac{1}{2}$$"]\n```');
    const markup = async () => {
      const source = await image.getAttribute("src");
      return decodeURIComponent(source?.slice(source.indexOf(",") + 1) ?? "");
    };
    await expect.poll(markup).toContain("<math");
    expect(await markup()).toContain("<msup>");
    expect(await markup()).toContain("<mfrac>");
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth))
      .toBeGreaterThan(0);
    await captureScreenshot(page, testInfo, `markdown-diagram-math-${theme}`);
  }
});
