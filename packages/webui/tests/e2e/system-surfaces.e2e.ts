import { expect, test, type Locator, type Page } from "@playwright/test";

const terminalCwd = process.cwd();

const clickStable = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click({ timeout: 5_000 });
  } catch {
    await locator.click({ force: true });
  }
};

const activateUntil = async (
  locator: Locator,
  predicate: () => Promise<boolean>,
): Promise<void> => {
  await clickStable(locator);
  const activated = await expect
    .poll(predicate, { timeout: 2_000 })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!activated) {
    await locator.evaluate((element: HTMLButtonElement) => element.click());
  }
};

const navigateToSystem = async (page: Page, label: "Messages" | "Settings" | "Terminals"): Promise<void> => {
  const targetLink = page.getByRole("link", { name: label });
  const linkVisible = await targetLink.isVisible().catch(() => false);
  let openedSidebar = false;
  if (!linkVisible) {
    const toggleSidebarButton = page.getByRole("button", { name: "Toggle Sidebar" });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await toggleSidebarButton.click();
    openedSidebar = true;
  }

  await clickStable(targetLink);
  if (openedSidebar) {
    await expect(page.getByRole("dialog", { name: "Sidebar" })).not.toBeVisible({ timeout: 15_000 });
  }
  await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}$`), { timeout: 15_000 });
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
};

const authenticateWithManagedKey = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces/, { timeout: 15_000 });

  const dialog = page.getByRole("dialog", { name: "Bind superadmin key" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const useManagedKeyButton = dialog.getByRole("button", { name: "Use backend-managed key" });
  await clickStable(useManagedKeyButton);
  const signChallengeButton = dialog.getByRole("button", { name: "Sign challenge" });
  await expect(signChallengeButton).toBeEnabled({ timeout: 15_000 });
  await activateUntil(signChallengeButton, async () => !(await dialog.isVisible()));
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("agenter:webui:auth-session")), { timeout: 30_000 })
    .not.toBeNull();
};

test.describe("Feature: Svelte system surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateWithManagedKey(page);
  });

  test("Scenario: Given an authenticated superadmin When creating a room and sending a message Then the message-system room transcript renders the new fact", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Playwright room ${testInfo.project.name} ${Date.now()}`;
    const roomMessage = `room message from ${testInfo.project.name}`;

    await navigateToSystem(page, "Messages");
    await clickStable(page.getByRole("button", { name: "Create room" }));
    const createRoomDialog = page.getByRole("dialog", { name: "Create room" });
    await createRoomDialog.getByLabel("Room title").fill(roomTitle);
    await clickStable(createRoomDialog.getByRole("button", { name: "Create room" }));

    await expect(page.getByText(roomTitle, { exact: true }).first()).toBeVisible();

    await page.getByPlaceholder("Send a room message…").fill(roomMessage);
    await activateUntil(page.getByRole("button", { name: "Send message" }), async () => {
      return (await page.getByPlaceholder("Send a room message…").inputValue()) === "";
    });

    await expect(page.getByText(roomMessage)).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given an authenticated superadmin When creating a global terminal and issuing a write tool call Then the terminal-system action log records the operation", async ({
    page,
  }, testInfo) => {
    const terminalId = `playwright-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const terminalWrite = `echo terminal-smoke-${testInfo.project.name}`;

    await navigateToSystem(page, "Terminals");
    await clickStable(page.getByRole("button", { name: "Create terminal" }));
    const createTerminalDialog = page.getByRole("dialog", { name: "Create terminal" });
    await createTerminalDialog.getByLabel("Terminal id").fill(terminalId);
    await createTerminalDialog.getByLabel("Absolute cwd").fill(terminalCwd);
    await clickStable(createTerminalDialog.getByRole("button", { name: "Create terminal" }));

    await expect(page.getByText(terminalId, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`Absolute cwd: ${terminalCwd}`)).toBeVisible();
    await expect(page.getByRole("combobox").first()).toContainText("Bootstrap admin");

    await page.getByPlaceholder("Type terminal input…").fill(terminalWrite);
    await activateUntil(page.getByRole("button", { name: "Call tool" }), async () => {
      return (await page.getByPlaceholder("Type terminal input…").inputValue()) === "";
    });

    await expect(page.getByText(terminalWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
