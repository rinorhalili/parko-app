import { expect, test } from "@playwright/test";

test("reservations route is available", async ({ page }) => {
  await page.goto("/reservations");
  await expect(page.locator("body")).toContainText(/Rezervimet|Parko/);
});
