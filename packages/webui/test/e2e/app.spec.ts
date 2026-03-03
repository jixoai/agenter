import { expect, test } from "@playwright/test";

test("shows core panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Agenter WebUI")).toBeVisible();
  await expect(page.getByText("Instances")).toBeVisible();
  await expect(page.getByText("Settings & Prompts")).toBeVisible();
});
