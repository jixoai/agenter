import { expect, test, type Locator, type Page } from "@playwright/test";

import { createAgenterClient } from "@agenter/client-sdk";

const AUTH_SESSION_STORAGE_KEY = "agenter:studio:auth-session";
const E2E_WS_URL = "ws://127.0.0.1:19190/trpc";

const clickStable = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click({ timeout: 5_000 });
  } catch {
    await locator.click({ force: true });
  }
};

const navigateToNotes = async (page: Page): Promise<void> => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-route")).toBeVisible({ timeout: 60_000 });

  let notesLink = page.getByRole("link", { name: "Notes" }).first();
  if (!(await notesLink.isVisible().catch(() => false))) {
    const toggleSidebarButton = page.getByRole("button", { name: /Toggle (application navigation|Sidebar)/i });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await clickStable(toggleSidebarButton);
    notesLink = page.getByRole("link", { name: "Notes" }).first();
  }

  await clickStable(notesLink);
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (await sidebarDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect.poll(async () => await sidebarDialog.isVisible().catch(() => false), { timeout: 2_000 }).toBeFalsy();
  }
  await expect(page).toHaveURL(/\/notes(?:\?.*)?$/, { timeout: 15_000 });
};

const closeNotesToolbarDetails = async (page: Page): Promise<void> => {
  const toolbarDetailsButton = page.getByRole("button", { name: "Open Notes toolbar details" });
  if (!(await toolbarDetailsButton.isVisible().catch(() => false))) {
    return;
  }
  const expanded = await toolbarDetailsButton.getAttribute("aria-expanded").catch(() => null);
  if (expanded === "true") {
    await clickStable(toolbarDetailsButton);
  }
  await expect(toolbarDetailsButton).toHaveAttribute("aria-expanded", "false", { timeout: 5_000 });
};

const clickNotesModeTab = async (page: Page, value: string): Promise<void> => {
  const notesModeTabs = page.getByRole("navigation", { name: "Notes modes" });
  await expect(notesModeTabs).toBeVisible({ timeout: 15_000 });
  await closeNotesToolbarDetails(page);
  await notesModeTabs.locator(`[data-workbench-page-tab="${value}"]`).first().click({ timeout: 15_000 });
};

test.describe("Feature: Notes workbench route smoke", () => {
  test("Scenario: Given seeded NoteSystem pages When opening Notes through app navigation Then desktop and iPhone layouts expose metadata tags references and read-only SQL", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 120_000));
    const client = createAgenterClient({ wsUrl: E2E_WS_URL });
    const suffix = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const targetPage = `reference-target-${suffix}`;
    const sourcePage = `current-task-${suffix}`;

    try {
      const autoLogin = await client.trpc.auth.autoLogin.mutate();
      if (!autoLogin.ok) {
        throw new Error(`expected daemon auto login, got ${autoLogin.reason}: ${autoLogin.message}`);
      }
      client.setAuthToken(autoLogin.session.token);
      await page.addInitScript(
        ({ key, token }) => {
          window.localStorage.setItem(key, JSON.stringify({ token }));
        },
        { key: AUTH_SESSION_STORAGE_KEY, token: autoLogin.session.token },
      );

      const target = await client.trpc.note.write.mutate({
        avatarNickname: "architect",
        notebook: "shell-assistant-book",
        section: "working-context",
        page: targetPage,
        content: "Reference target for the Notes workbench smoke.",
        mime: "text/markdown",
        mode: "override",
        tags: ["playwright", "reference"],
      });
      if (!target.page) {
        throw new Error("expected target note page");
      }
      await client.trpc.note.write.mutate({
        avatarNickname: "architect",
        notebook: "shell-assistant-book",
        section: "working-context",
        page: sourcePage,
        content: `# Notes route smoke for ${suffix}\n\n- Rendered markdown document.`,
        mime: "text/markdown",
        mode: "override",
        tags: ["playwright", "notes"],
        references: [{ pageId: target.page.metadata.pageId, label: "target" }],
      });

      await navigateToNotes(page);
      await expect(page.getByTestId("notes-workbench")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("notes-overview")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByLabel("Notes avatar")).toHaveCount(0);

      const architectRow = page.getByRole("button", { name: /architect/i }).first();
      await expect(architectRow).toBeVisible({ timeout: 30_000 });
      await clickStable(architectRow);
      await clickStable(page.getByRole("button", { name: /Open tab/i }).first());
      await expect(page).toHaveURL(/\/notes\/avatar\/architect$/, { timeout: 15_000 });
      await expect(page.getByTestId("notes-avatar-route")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByLabel("Notes avatar")).toHaveCount(0);

      const sourceRootsHelp = page.getByRole("button", { name: "Note source roots" });
      await expect(sourceRootsHelp).toBeVisible({ timeout: 15_000 });
      await clickStable(sourceRootsHelp);
      const sourceRootsHint = page.locator("agenter-help-hint[open]").first();
      await expect(sourceRootsHint).toContainText("Source roots", { timeout: 15_000 });
      await expect(sourceRootsHint).toContainText("Workspace/source facts are metadata", { timeout: 15_000 });
      await page.keyboard.press("Escape");

      const sourceButton = page.getByRole("button", { name: new RegExp(sourcePage) }).first();
      await expect(sourceButton).toBeVisible({ timeout: 30_000 });
      await clickStable(sourceButton);

      const detail = page.getByTestId("notes-detail");
      await expect(detail).toBeVisible({ timeout: 15_000 });
      await expect(detail.getByText("playwright")).toBeVisible({ timeout: 15_000 });
      await expect(detail.getByText("shell-assistant-book / working-context", { exact: true })).toHaveCount(0);
      const metadataHelp = detail.getByRole("button", { name: "Note metadata" });
      await expect(metadataHelp).toBeVisible({ timeout: 15_000 });
      await clickStable(metadataHelp);
      const metadataHint = detail.locator("agenter-help-hint[open]").first();
      await expect(metadataHint).toContainText("Book ID", { timeout: 15_000 });
      await expect(metadataHint).toContainText("MIME", { timeout: 15_000 });
      await expect(metadataHint).toContainText("text/markdown", { timeout: 15_000 });
      await expect(metadataHint).toContainText("References", { timeout: 15_000 });
      await expect(metadataHint).toContainText(targetPage, { timeout: 15_000 });
      await expect(detail.getByTitle(`${sourcePage} preview`)).toBeVisible({ timeout: 15_000 });
      await expect(
        page.frameLocator(`iframe[title="${sourcePage} preview"]`).locator("agenter-markdown-document"),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.frameLocator(`iframe[title="${sourcePage} preview"]`).locator("body")).toContainText(
        `Notes route smoke for ${suffix}`,
        { timeout: 15_000 },
      );

      const closeDetailButton = page.getByRole("button", { name: "Close detail" });
      if (await closeDetailButton.isVisible().catch(() => false)) {
        await clickStable(closeDetailButton);
      }

      await clickNotesModeTab(page, "search");
      await expect(page).toHaveURL(/\/notes\/avatar\/architect\/search$/, { timeout: 15_000 });
      await expect(page.getByTestId("notes-search-mode")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /playwright/i }).first()).toBeVisible({ timeout: 15_000 });

      await clickNotesModeTab(page, "query");
      await expect(page).toHaveURL(/\/notes\/avatar\/architect\/query$/, { timeout: 15_000 });
      await expect(page.getByTestId("notes-query-mode")).toBeVisible({ timeout: 15_000 });
      const sqlRows = page.locator("pre").filter({ hasText: sourcePage }).first();
      const clickedQuery = await expect(sqlRows)
        .toBeVisible({ timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (!clickedQuery) {
        const sqlInput = page.getByRole("textbox", { name: "Note SQL query" });
        await sqlInput.press("Enter");
        const submittedByEnter = await expect(sqlRows)
          .toBeVisible({ timeout: 3_000 })
          .then(() => true)
          .catch(() => false);
        if (!submittedByEnter) {
          await sqlInput.evaluate((element) => {
            if (!(element instanceof HTMLInputElement)) {
              throw new Error("Expected note SQL input");
            }
            element.form?.requestSubmit();
          });
        }
      }
      await expect(sqlRows).toBeVisible({ timeout: 15_000 });
    } finally {
      client.close();
    }
  });
});
