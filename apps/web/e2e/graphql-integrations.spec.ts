import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("installed tab opens the MCP add dialog", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `graphql-source-${stamp}@rakazo.test`, "password12", `GraphQL ${stamp}`);
  await completeOnboarding(page);

  await page.getByRole("button", { name: "Marketplace" }).click();
  const overlay = page.getByRole("dialog");
  await expect(overlay.getByPlaceholder("Search")).toBeVisible();
  await expect(overlay.getByRole("button", { name: "Add MCP server", exact: true })).toBeVisible();

  await overlay.getByRole("tab", { name: "Installed" }).click();
  await overlay
    .getByRole("tabpanel", { name: "Installed" })
    .getByRole("button", { name: "Add MCP server", exact: true })
    .click();
  const addMcp = page.getByRole("dialog").filter({ hasText: "Add MCP server" });
  await expect(addMcp.getByLabel("Server name")).toBeVisible();
  await expect(addMcp.getByLabel("Server URL")).toBeVisible();
  await captureScreenshot(page, testInfo, "01-graphql-advanced-order");
});
