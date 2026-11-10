import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("colored user bubbles keep white text in both themes", async ({ page }, testInfo) => {
  await signup(page, `bubble-colors-${Date.now()}@rakazo.test`, "password12", "Bubble Demo");
  await completeOnboarding(page);
  await rpc(page, "bots/update", { botId: activeBotId(page), color: "#A855F7" });
  await page.reload();

  const message = "Let's plan the week ahead.";
  const composer = page.getByRole("combobox", { name: /^Message/ });
  await composer.fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const bubble = page.getByTestId("message-user-bubble").filter({ hasText: message });
  await expect(bubble).toBeVisible();

  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => localStorage.setItem("rakazo.uiAppearance", theme), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(bubble).toHaveCSS("color", "rgb(255, 255, 255)");
    // #A855F7 deepened in OKLCH to #9C47E9 for AA contrast with white text.
    await expect(bubble).toHaveCSS("background-color", "rgb(156, 71, 233)");
    // An empty draft shows the neutral voice action.
    const voice = page.getByRole("button", { name: "Voice", exact: true });
    await expect(voice).toBeVisible();
    await expect(voice).not.toHaveCSS("background-color", "rgb(156, 71, 233)");
    await captureScreenshot(page, testInfo, `chat-bubble-white-text-${theme}`);
    // Send takes its place and wears the bubble's color once there is a draft.
    await composer.fill("And the week after.");
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled();
    await expect(send).toHaveCSS("background-color", "rgb(156, 71, 233)");
    await expect(send).toHaveCSS("color", "rgb(255, 255, 255)");
    await captureScreenshot(page, testInfo, `chat-send-button-bot-color-${theme}`);
    await composer.fill("");
  }
});
