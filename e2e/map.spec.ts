import { expect, test } from "@playwright/test";

test("map shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Parko/i);
});
