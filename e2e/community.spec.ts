import { expect, test } from "@playwright/test";

test("community route renders", async ({ page }) => {
  await page.goto("/community");
  await expect(page.locator("body")).toContainText(/Komuniteti|Parko/);
});
