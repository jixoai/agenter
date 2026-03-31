import { readFileSync } from "node:fs";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { E2E_FIXTURE_PATH } from "./fixture-path";

interface E2EFixture {
  workspacePath: string;
}

const loadFixture = (): E2EFixture => JSON.parse(readFileSync(E2E_FIXTURE_PATH, "utf8")) as E2EFixture;
const isMobileProject = (testInfo: TestInfo): boolean => testInfo.project.name === "mobile-iphone14";

const waitForWelcomeShell = async (page: Page) => {
  await page.waitForURL((url) => url.pathname === "/workspaces" && url.searchParams.get("view") === "welcome", {
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "Welcome" }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Avatar", exact: true })).toBeVisible();
};

test.describe("Feature: Workspace shell vnext browser flow", () => {
  test("Scenario: Given the app entry route When the browser loads Then Workspaces Welcome becomes the default shell on desktop and mobile", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await waitForWelcomeShell(page);

    if (isMobileProject(testInfo)) {
      await expect(page.getByText("Start or reattach avatars with global rooms and terminals.")).toBeVisible();
      await expect(page.getByText("List workspaces by last use, path, or name.")).toBeVisible();
    } else {
      await expect(page.getByText("Running Avatars")).toBeVisible();
      const sidebar = page.getByTestId("app-sidebar-nav");
      await expect(sidebar.getByRole("button", { name: "Chats", exact: true })).toBeVisible();
      await expect(sidebar.getByRole("button", { name: "Workspaces", exact: true })).toBeVisible();
      await expect(sidebar.getByRole("button", { name: "Terminals", exact: true })).toBeVisible();
    }
  });

  test("Scenario: Given the legacy settings route When the browser opens it Then the app redirects into the ~/ workspace settings tab", async ({
    page,
  }) => {
    await page.goto("/settings");

    await page.waitForURL(
      (url) =>
        url.pathname === "/workspaces" &&
        url.searchParams.get("view") === "workspace" &&
        url.searchParams.get("workspacePath") === "~/" &&
        url.searchParams.get("tab") === "settings",
      { timeout: 20_000 },
    );

    await expect(page.getByRole("heading", { name: "~/" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Global Settings" })).toBeVisible();
  });

  test("Scenario: Given the Welcome start orchestrator When the operator starts the seeded workspace avatar Then the browser lands on the attention-first runtime shell", async ({
    page,
  }) => {
    const fixture = loadFixture();

    await page.goto("/");
    await waitForWelcomeShell(page);
    await page.getByRole("combobox", { name: "Workspace", exact: true }).selectOption(fixture.workspacePath);
    await page.getByRole("button", { name: "Start Avatar", exact: true }).click();

    await page.waitForURL(
      (url) =>
        /^\/session\/[^/]+\/devtools$/.test(url.pathname) && url.searchParams.get("panel") === "attention",
      {
        timeout: 20_000,
      },
    );

    await expect(page.getByRole("heading", { name: "Attention" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Attention" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /Cycles/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Systems" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Observability" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Settings" })).toBeVisible();
  });
});
