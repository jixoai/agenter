import { expect, test } from "@playwright/test";

test("shows application shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Agenter")).toBeVisible();
  await expect(page.getByText("Quick Start")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sessions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New session" })).toBeVisible();
});

test("navigates views and opens create-session dialog", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Sessions" }).click();
  await expect(page.getByText("Work Sessions")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Select a session first to inspect settings layers.")).toBeVisible();

  await page.getByRole("button", { name: "New session" }).click();
  await expect(page.getByText("Create session")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByText("Create session")).toHaveCount(0);
});
