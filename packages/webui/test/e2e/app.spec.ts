import { readFileSync } from "node:fs";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { E2E_FIXTURE_PATH } from "./fixture-path";

interface E2EFixture {
  workspacePath: string;
  attachmentPath: string;
  mockReply: string;
  historySessionId: string;
  historySessionName: string;
  historyTurns: number;
}

const loadFixture = (): E2EFixture => JSON.parse(readFileSync(E2E_FIXTURE_PATH, "utf8")) as E2EFixture;
const isMobileProject = (testInfo: TestInfo): boolean => testInfo.project.name === "mobile-iphone14";

const openNavigationSheet = async (page: Page) => {
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe("Feature: Workspace-first browser shell", () => {
  test("Scenario: Given the seeded Quick Start workspace When the shell loads Then the browser shows the current workspace and composer affordances", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    const quickStartViewport = page.getByTestId("quickstart-scroll-viewport");
    const mobile = isMobileProject(testInfo);

    await page.goto("/");

    if (mobile) {
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
      const navigation = await openNavigationSheet(page);
      await expect(navigation.getByRole("button", { name: "Quick Start", exact: true })).toBeVisible();
      await expect(navigation.getByRole("button", { name: "Workspaces", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close panel" }).click();
    } else {
      await expect(page.getByText("Workspace-first shell")).toBeVisible();
      await expect(page.getByRole("button", { name: "Quick Start", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Workspaces", exact: true })).toBeVisible();
    }
    await expect(quickStartViewport.getByText("Workspace", { exact: true })).toBeVisible();
    await expect(quickStartViewport.getByRole("button", { name: "Change", exact: true })).toBeVisible();
    await expect(quickStartViewport.getByRole("button", { name: "Attach", exact: true })).toBeVisible();
    await expect(quickStartViewport.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  });

  test("Scenario: Given a fresh Quick Start request with an attachment When the first message is sent Then Chat and Devtools show the new cycle and reply", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    const firstPrompt = "Reply with exactly PLAYWRIGHT-FIRST-CYCLE";
    const quickStartViewport = page.getByTestId("quickstart-scroll-viewport");
    const mobile = isMobileProject(testInfo);

    await page.goto("/");

    await page.locator(".cm-content").first().click();
    await page.keyboard.type(firstPrompt);
    await page.locator('input[type="file"]').setInputFiles(fixture.attachmentPath);

    await expect(page.getByText("Pending attachments")).toBeVisible();
    await expect(page.getByText("notes.txt")).toBeVisible();

    await quickStartViewport.getByRole("button", { name: "Start", exact: true }).click();

    await page.waitForURL(/\/workspace\/chat\?/, { timeout: 20_000 });
    const userMessage = page.getByRole("article").filter({ hasText: firstPrompt }).first();
    const assistantMessage = page.getByRole("article").filter({ hasText: fixture.mockReply }).first();

    await expect(userMessage).toBeVisible();
    await expect(userMessage.getByText("notes.txt")).toBeVisible();
    await expect(assistantMessage).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Message actions" }).first()).toBeVisible();

    if (mobile) {
      await expect(page.getByRole("button", { name: "Chat", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Devtools", exact: true }).click();
      await page.waitForURL(/\/workspace\/devtools\?/, { timeout: 20_000 });
      const navigation = await openNavigationSheet(page);
      await expect(navigation.getByText("Running Sessions")).toBeVisible();
      await page.getByRole("button", { name: "Close panel" }).click();
    } else {
      await page.getByRole("tab", { name: "Devtools", exact: true }).click();
      await page.waitForURL(/\/workspace\/devtools\?/, { timeout: 20_000 });
    }

    if (mobile) {
      await expect(page.getByRole("button", { name: "Devtools", exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("tab", { name: "Devtools", exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Cycles", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cycle 1 ·/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Technical records", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox").filter({ hasText: fixture.mockReply }).first()).toBeVisible();
  });

  test("Scenario: Given a seeded long-history session When Chat opens on desktop and mobile Then persisted turns stay visible and running-session navigation stays available", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    const mobile = isMobileProject(testInfo);
    const route = `/workspace/chat?workspacePath=${encodeURIComponent(fixture.workspacePath)}&sessionId=${encodeURIComponent(fixture.historySessionId)}`;
    const latestPrompt = `History prompt ${fixture.historyTurns}: confirm the long persisted conversation turn ${fixture.historyTurns}.`;
    const firstPrompt = "History prompt 1: confirm the long persisted conversation turn 1.";

    await page.goto(route);
    await page.waitForURL(/\/workspace\/chat\?/, { timeout: 20_000 });

    await expect(page.getByRole("article").filter({ hasText: latestPrompt }).first()).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "notes.txt" }).first()).toBeVisible();
    await expect(page.getByText(fixture.mockReply).first()).toBeVisible();

    const viewport = page.getByTestId("chat-scroll-viewport");
    await expect(viewport).toBeVisible();
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(page.getByRole("article").filter({ hasText: firstPrompt }).first()).toBeVisible();

    if (mobile) {
      const navigation = await openNavigationSheet(page);
      await expect(navigation.getByText("Running Sessions")).toBeVisible();
      await expect(navigation.getByText(fixture.historySessionName).first()).toBeVisible();
      await page.getByRole("button", { name: "Close panel" }).click();
    } else {
      await expect(page.getByText("Running Sessions")).toBeVisible();
      await expect(page.getByText(fixture.historySessionName).first()).toBeVisible();
    }
  });
});
