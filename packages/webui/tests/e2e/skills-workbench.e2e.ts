import { expect, test, type Locator, type Page } from "@playwright/test";

const AUTH_SESSION_STORAGE_KEY = "agenter:webui:auth-session";

const clickStable = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click({ timeout: 5_000 });
  } catch {
    await locator.click({ force: true });
  }
};

const authenticateWithManagedKey = async (page: Page): Promise<void> => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-route")).toBeVisible({ timeout: 60_000 });
  const storedToken = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_STORAGE_KEY);
  if (storedToken !== null) {
    return;
  }

  const privateKeyInput = page.getByLabel("Root private key");
  await clickStable(page.getByRole("button", { name: "Use backend-managed key" }));
  await expect
    .poll(async () => {
      const value = await privateKeyInput.inputValue().catch(() => "");
      return value.trim().length > 0;
    })
    .toBeTruthy();

  const signChallengeButton = page.getByRole("button", { name: "Sign challenge" });
  await expect(signChallengeButton).toBeEnabled({ timeout: 15_000 });
  await clickStable(signChallengeButton);
  await expect
    .poll(async () => await page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_STORAGE_KEY))
    .not.toBeNull();
};

const navigateToSkills = async (page: Page): Promise<void> => {
  await page.goto("/skills", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/skills(?:\?.*)?$/, { timeout: 15_000 });
  await expect(page.getByTestId("skills-workbench")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('a[href="/skills"]').first()).toBeAttached();
};

const openPageTab = async (page: Page, name: "shared" | "avatars"): Promise<void> => {
	const tab = page.getByRole("tab", { name });
	await expect(tab).toBeVisible({ timeout: 15_000 });
	await clickStable(tab);
	await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
};

const expandSkill = async (page: Page, name: string): Promise<void> => {
  await clickStable(page.locator("button").filter({ hasText: name }).first());
};

const closeCompactPreviewIfVisible = async (page: Page): Promise<void> => {
  const closePreviewButton = page.getByRole("button", { name: "Close preview" });
  if (!(await closePreviewButton.isVisible().catch(() => false))) {
    return;
  }
  await clickStable(closePreviewButton);
  await expect(closePreviewButton).not.toBeVisible({ timeout: 15_000 });
};

const clickVisibleTreePath = async (page: Page, path: string): Promise<void> => {
  await clickStable(page.locator(`[data-skill-tree-path="${path}"]:visible`).first());
};

const assertPdfPreview = async (page: Page): Promise<void> => {
  await expect(page.getByText("Path: /manual.pdf")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Kind: pdf")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("MIME: application/pdf")).toBeVisible({ timeout: 15_000 });

  const previewFrame = page.getByTitle("manual.pdf preview");
  await expect(previewFrame).toBeVisible({ timeout: 15_000 });

  const previewFrameSrc = await previewFrame.getAttribute("src");
  expect(previewFrameSrc).toContain("/filePreviewer.html?previewKey=");
  const previewKey = new URL(previewFrameSrc!, "http://127.0.0.1").searchParams.get("previewKey");
  expect(previewKey).toBeTruthy();

  await expect
    .poll(async () => {
      if (!previewKey) {
        return null;
      }
      return await page.evaluate((key) => window.localStorage.getItem(key), previewKey);
    })
    .not.toBeNull();

  const pdfFrame = page.frameLocator('iframe[title="manual.pdf preview"]');
  await expect(pdfFrame.locator(".file-previewer__identity .text-sm").filter({ hasText: "manual.pdf" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(pdfFrame.locator("canvas.file-previewer__pdf-page").first()).toBeVisible({ timeout: 15_000 });
};

const assertTextPreview = async (page: Page, input: { path: string; title: string; text: string }): Promise<void> => {
  await expect(page.getByText(`Path: ${input.path}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Kind: text")).toBeVisible({ timeout: 15_000 });

  const previewFrame = page.getByTitle(`${input.title} preview`);
  await expect(previewFrame).toBeVisible({ timeout: 15_000 });

  const previewFrameSrc = await previewFrame.getAttribute("src");
  expect(previewFrameSrc).toContain("/filePreviewer.html?previewKey=");

  const textFrame = page.frameLocator(`iframe[title="${input.title} preview"]`);
  await expect(textFrame.locator(".cm-editor, .skill-text-viewer__fallback").first()).toBeVisible({ timeout: 15_000 });
  await expect(textFrame.locator(".cm-content, .skill-text-viewer__fallback").filter({ hasText: input.text }).first()).toBeVisible({
    timeout: 15_000,
  });
};

test.describe("Feature: Skills workbench route", () => {
  test("Scenario: Given seeded shared and avatar-private skills When the operator browses Skills Then the workbench keeps shared chrome, canonical page-tabs, compact detail behavior, and dedicated avatar tabs on desktop and mobile", async ({
    page,
  }, testInfo) => {
    await authenticateWithManagedKey(page);
    await navigateToSkills(page);

    await expect(page.getByRole("tab", { name: "shared" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "shared skills", level: 2 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "built-in" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "global" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "avatars" })).toBeVisible();

    await openPageTab(page, "shared");
    await expect(page.getByRole("heading", { name: "shared skills", level: 2 })).toBeVisible();
    await expandSkill(page, "shared-handbook");
    await clickVisibleTreePath(page, "/manual.pdf");
    await assertPdfPreview(page);
    await page.screenshot({
      path: testInfo.outputPath("skills-shared-pdf-preview.png"),
      fullPage: true,
    });

    await closeCompactPreviewIfVisible(page);
    await page.goto("/skills?view=avatar&avatar=architect", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/skills\?view=avatars&avatar=architect$/, { timeout: 15_000 });
    await openPageTab(page, "avatars");
    await clickStable(page.locator("button").filter({ hasText: "Architect" }).first());
    await expect(page.getByText("Root workspace", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("workspace-skill")).toBeVisible({ timeout: 15_000 });
    await clickStable(page.getByRole("button", { name: "Open avatar tab" }));
    await expect(page).toHaveURL(/\/skills\/avatar\/architect$/, { timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "architect" })).toHaveAttribute("aria-selected", "true", {
      timeout: 15_000,
    });
    await expandSkill(page, "workspace-skill");
    await clickVisibleTreePath(page, "/SKILL.md");
    await assertTextPreview(page, {
      path: "/SKILL.md",
      title: "SKILL.md",
      text: "Workspace private skill.",
    });
    await page.screenshot({
      path: testInfo.outputPath("skills-avatar-workspace-browser.png"),
      fullPage: true,
    });
  });
});
