import { expect, test } from "@playwright/test";
import { completeOnboarding, signup } from "./helpers";

test("sidebar footer shows the account name and a round Connect apps button", async ({ page }) => {
  await signup(page, `footer-${Date.now()}@rakazo.test`, "password12", "Demo User");
  await completeOnboarding(page);
  const footer = page.getByTestId("sidebar-footer");
  await expect(footer.getByTestId("user-menu-trigger")).toContainText("Demo User");
  const connect = footer.getByRole("button", { name: "Connect apps", exact: true });
  await expect(connect).toBeVisible();
  const radius = await connect.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).borderRadius),
  );
  expect(radius).toBeGreaterThanOrEqual(16);
});
