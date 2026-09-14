import { expect, test } from "@playwright/test";

test("profile route asks for authentication", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.locator("body")).toContainText(/Hyr|Parko/);
});
