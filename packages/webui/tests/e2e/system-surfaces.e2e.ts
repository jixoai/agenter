import { expect, test, type Locator, type Page } from "@playwright/test";

const terminalCwd = process.cwd();
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const clickStable = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click({ timeout: 5_000 });
  } catch {
    await locator.click({ force: true });
  }
};

const typeStable = async (locator: Locator, value: string): Promise<void> => {
  await clickStable(locator);
  await locator.clear();
  await locator.pressSequentially(value);
  await expect(locator).toHaveValue(value, { timeout: 15_000 });
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

const navigateToSystem = async (
  page: Page,
  label: "Messages" | "Settings" | "Terminals" | "Workspaces",
): Promise<void> => {
  const targetLink = page.getByRole("link", { name: label });
  const linkVisible = await targetLink.isVisible().catch(() => false);
  if (!linkVisible) {
    const toggleSidebarButton = page.getByRole("button", { name: "Toggle Sidebar" });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await toggleSidebarButton.click();
  }

  await clickStable(targetLink);
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (await sidebarDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(sidebarDialog).not.toBeVisible({ timeout: 15_000 });
  }
  await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}(?:\\?.*)?$`), { timeout: 15_000 });
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
};

const openCreateRoomDialog = async (page: Page) => {
  const createRoomDialog = page.getByRole("dialog", { name: "Create room" });
  await activateUntil(page.getByRole("button", { name: "Open create room dialog" }), async () => {
    return await createRoomDialog.isVisible().catch(() => false);
  });
  await expect(createRoomDialog).toBeVisible({ timeout: 15_000 });
  return createRoomDialog;
};

const expectTerminalViewText = async (page: Page, text: string): Promise<void> => {
  const terminalView = page.locator("terminal-view").first();
  await terminalView.waitFor({ state: "visible", timeout: 15_000 });
  await expect
    .poll(
      async () =>
        await terminalView
          .evaluate((element, expected) => (element.shadowRoot?.textContent ?? "").includes(expected), text)
          .catch(() => false),
      { timeout: 15_000 },
    )
    .toBeTruthy();
};

const authenticateWithManagedKey = async (page: Page): Promise<void> => {
  await page.goto("/workspaces", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/workspaces/, { timeout: 15_000 });

  const dialog = page.getByRole("dialog", { name: "Bind superadmin key" });
  const quickStartHeading = page.getByText("Quick Start", { exact: true });
  await expect(quickStartHeading).toBeVisible({ timeout: 60_000 });

  const storedToken = await page.evaluate(() => window.localStorage.getItem("agenter:webui:auth-session"));
  if (storedToken !== null) {
    return;
  }

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
  await expect(quickStartHeading).toBeVisible({ timeout: 60_000 });
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
    const createRoomDialog = await openCreateRoomDialog(page);
    await typeStable(createRoomDialog.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomDialog.getByRole("button", { name: "Submit create room" }), async () => {
      return !(await createRoomDialog.isVisible());
    });

    await expect(page.getByRole("button", { name: new RegExp(roomTitle) }).first()).toBeVisible({ timeout: 15_000 });

    const roomComposer = page.getByPlaceholder(new RegExp(`Message ${escapeRegExp(roomTitle)}`));
    const sendMessageButton = page.getByRole("button", { name: "Send" });
    await roomComposer.fill(roomMessage);
    await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(sendMessageButton, async () => {
      return (await roomComposer.inputValue()) === "";
    });

    await expect(page.getByText(roomMessage)).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given an authenticated superadmin When creating a global terminal and issuing write plus read tool calls Then the terminal-system action log survives refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);
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
    await expect(page.locator('select[aria-label="Call tool as"]').first()).toContainText("Bootstrap admin");

    await page.getByPlaceholder("Type terminal input…").fill(terminalWrite);
    await activateUntil(page.getByRole("button", { name: "Call tool" }), async () => {
      return (await page.getByPlaceholder("Type terminal input…").inputValue()) === "";
    });

    await expect(page.getByText(terminalWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expectTerminalViewText(page, terminalWrite);
    await expectTerminalViewText(page, terminalCwd);

    await activateUntil(page.getByRole("tab", { name: "Read" }), async () => {
      return await page.getByRole("button", { name: "Call read" }).isVisible().catch(() => false);
    });
    await page.getByLabel("Read mode").selectOption("snapshot");
    await clickStable(page.getByRole("button", { name: "Call read" }));
    await expect(page.getByText("Terminal read", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(terminalId, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Absolute cwd: ${terminalCwd}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(terminalWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Terminal read", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expectTerminalViewText(page, terminalWrite);
    await expectTerminalViewText(page, terminalCwd);
  });

  test("Scenario: Given an authenticated superadmin When granting requester access and approving a pending terminal write Then the users rail and actions rail stay synchronized after refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);
    const terminalId = `playwright-approval-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const pendingWrite = `echo terminal-approval-${testInfo.project.name}`;
    const leasedWrite = `echo terminal-lease-${testInfo.project.name}`;

    await navigateToSystem(page, "Terminals");
    await clickStable(page.getByRole("button", { name: "Create terminal" }));
    const createTerminalDialog = page.getByRole("dialog", { name: "Create terminal" });
    await createTerminalDialog.getByLabel("Terminal id").fill(terminalId);
    await createTerminalDialog.getByLabel("Absolute cwd").fill(terminalCwd);
    await clickStable(createTerminalDialog.getByRole("button", { name: "Create terminal" }));

    await expect(page.getByText(terminalId, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await activateUntil(page.getByRole("tab", { name: "Users" }), async () => {
      return await page.getByLabel("Grant actor").isVisible().catch(() => false);
    });

    const grantActorSelect = page.getByLabel("Grant actor");
    const requesterOption = await grantActorSelect.evaluate((select) => {
      const htmlSelect = select as HTMLSelectElement;
      const candidate = Array.from(htmlSelect.options).find(
        (option: HTMLOptionElement) =>
          option.value.length > 0 &&
          option.value.startsWith("auth:"),
      );
      return candidate
        ? { value: candidate.value, label: candidate.textContent?.trim() ?? candidate.value }
        : null;
    });
    expect(requesterOption).not.toBeNull();
    if (!requesterOption) {
      return;
    }

    await grantActorSelect.selectOption(requesterOption.value);
    await page.getByLabel("Grant role").selectOption("requester");
    await clickStable(page.getByRole("button", { name: "Grant seat" }));

    const grantedSeat = page.getByTestId(`terminal-seat-${requesterOption.value}`);
    await expect(grantedSeat).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`terminal-seat-role-${requesterOption.value}`)).toHaveText("requester", {
      timeout: 15_000,
    });

    const callAsSelect = page.locator('select[aria-label="Call tool as"]').first();
    const requesterLabel = requesterOption.label.split(" · ")[0] ?? requesterOption.label;
    const requesterCallOption = await callAsSelect.evaluate((select, visibleLabel) => {
      const htmlSelect = select as HTMLSelectElement;
      const candidate = Array.from(htmlSelect.options).find(
        (option: HTMLOptionElement) => option.textContent?.includes(visibleLabel as string),
      );
      return candidate
        ? { value: candidate.value, label: candidate.textContent?.trim() ?? candidate.value }
        : null;
    }, requesterLabel);
    expect(requesterCallOption).not.toBeNull();
    if (!requesterCallOption) {
      return;
    }

    await callAsSelect.selectOption(requesterCallOption.value);
    await page.getByPlaceholder("Type terminal input…").fill(pendingWrite);
    await activateUntil(page.getByRole("button", { name: "Call tool" }), async () => {
      return (await page.getByPlaceholder("Type terminal input…").inputValue()) === "";
    });

    await expect(page.getByText(/Write approval requested:/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Pending approvals", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(new RegExp(escapeRegExp(pendingWrite)))).toBeVisible({ timeout: 15_000 });
    await clickStable(page.getByRole("button", { name: "Approve 30m" }));
    await expect(page.getByText(/Lease until/)).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder("Type terminal input…").fill(leasedWrite);
    await activateUntil(page.getByRole("button", { name: "Call tool" }), async () => {
      return (await page.getByPlaceholder("Type terminal input…").inputValue()) === "";
    });

    await activateUntil(page.getByRole("tab", { name: "Actions" }), async () => {
      return await page.getByText(leasedWrite, { exact: true }).first().isVisible().catch(() => false);
    });
    await expect(page.getByText(leasedWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(terminalId, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await activateUntil(page.getByRole("tab", { name: "Users" }), async () => {
      return await page.getByTestId(`terminal-seat-${requesterOption.value}`).isVisible().catch(() => false);
    });
    await expect(page.getByTestId(`terminal-seat-${requesterOption.value}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Lease until/)).toBeVisible({ timeout: 15_000 });
    await activateUntil(page.getByRole("tab", { name: "Actions" }), async () => {
      return await page.getByText(leasedWrite, { exact: true }).first().isVisible().catch(() => false);
    });
    await expect(page.getByText(leasedWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given an authenticated superadmin When granting a room seat Then the users rail shows the granted actor and role without leaving the room surface", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Grant room ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createRoomDialog = await openCreateRoomDialog(page);
    await typeStable(createRoomDialog.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomDialog.getByRole("button", { name: "Submit create room" }), async () => {
      return !(await createRoomDialog.isVisible());
    });

    await expect(page.getByRole("button", { name: new RegExp(roomTitle) }).first()).toBeVisible({ timeout: 15_000 });

    const grantActorSelect = page.getByLabel("Grant actor");
    const grantRoleSelect = page.getByLabel("Grant role");
    const grantedOption = await grantActorSelect.evaluate((select) => {
      const htmlSelect = select as HTMLSelectElement;
      const candidate = Array.from(htmlSelect.options).find(
        (option: HTMLOptionElement) => option.value.length > 0,
      );
      return candidate
        ? { value: candidate.value, label: candidate.textContent?.trim() ?? candidate.value }
        : null;
    });
    expect(grantedOption).not.toBeNull();
    if (!grantedOption) {
      return;
    }

    await grantActorSelect.selectOption(grantedOption.value);
    await grantRoleSelect.selectOption("readonly");
    await clickStable(page.getByRole("button", { name: "Grant seat" }));

    const grantedLabel = grantedOption.label.split(" · ")[0] ?? grantedOption.label;
    const grantedSeat = page.getByTestId(`room-seat-${grantedOption.value}`);
    await expect(grantedSeat).toBeVisible({ timeout: 15_000 });
    await expect(grantedSeat.getByText(grantedLabel, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`room-seat-role-${grantedOption.value}`)).toHaveText("readonly", {
      timeout: 15_000,
    });
  });

  test("Scenario: Given two room viewers When one viewer sends a message Then the other viewer sees the transcript update without refresh", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Live room ${testInfo.project.name} ${Date.now()}`;
    const liveMessage = `live transcript ${testInfo.project.name}`;

    await navigateToSystem(page, "Messages");
    const createRoomDialog = await openCreateRoomDialog(page);
    await typeStable(createRoomDialog.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomDialog.getByRole("button", { name: "Submit create room" }), async () => {
      return !(await createRoomDialog.isVisible());
    });

    const createdRoomButton = page.getByRole("button", { name: new RegExp(roomTitle) }).first();
    await expect(createdRoomButton).toBeVisible({ timeout: 15_000 });
    const createdRoomText = (await createdRoomButton.textContent()) ?? "";
    const chatId = createdRoomText.match(/room-[a-z0-9-]+/i)?.[0];
    expect(chatId).toBeTruthy();
    if (!chatId) {
      return;
    }

    const mirrorPage = await page.context().newPage();
    await mirrorPage.goto(`/messages?roomId=${chatId}`, { waitUntil: "domcontentloaded" });
    await expect(mirrorPage.getByText(roomTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    const mirrorComposer = mirrorPage.getByPlaceholder(new RegExp(`Message ${escapeRegExp(roomTitle)}`));
    const mirrorSendButton = mirrorPage.getByRole("button", { name: "Send" });
    await mirrorComposer.fill(liveMessage);
    await expect(mirrorSendButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(mirrorSendButton, async () => {
      return (await mirrorComposer.inputValue()) === "";
    });

    await expect(page.getByText(liveMessage)).toBeVisible({ timeout: 15_000 });
    await mirrorPage.close();
  });

  test("Scenario: Given an authenticated superadmin When quick start launches an avatar Then Running Avatars opens the attention-first runtime shell on desktop and mobile", async ({
    page,
  }) => {
    await expect(page.getByText("Quick Start", { exact: true })).toBeVisible({ timeout: 60_000 });
    const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
    await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
    await clickStable(startAvatarButton);

    await expect(page).toHaveURL(/\/runtime\/.+\/attention$/, { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /attention/i })).toBeVisible({ timeout: 15_000 });

    const desktopRunningRail = page.getByText("Running Avatars");
    const runtimeLinks = page.locator("[data-running-avatar-link]");
    const desktopRailVisible = await desktopRunningRail.isVisible().catch(() => false);

    if (desktopRailVisible) {
      await expect(runtimeLinks.first()).toBeVisible({ timeout: 15_000 });
    } else {
      const toggleSidebarButton = page.getByRole("button", { name: "Toggle Sidebar" });
      await clickStable(toggleSidebarButton);
      await expect(page.getByText("Running Avatars")).toBeVisible({ timeout: 15_000 });
      await expect(runtimeLinks.first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("Scenario: Given quick start avatar copy When the operator refreshes and launches the copied avatar Then the live catalog and stable runtime shell keep the copy visible", async ({
    page,
  }, testInfo) => {
    const copiedAvatarName = `playwright-copy-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    await navigateToSystem(page, "Workspaces");
    const copyAvatarButton = page.getByRole("button", { name: "Copy avatar" });
    await expect(copyAvatarButton).toBeEnabled({ timeout: 15_000 });
    await clickStable(copyAvatarButton);

    const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
    await copyDialog.getByLabel("New avatar nickname").fill(copiedAvatarName);
    await clickStable(copyDialog.getByRole("button", { name: "Copy avatar" }));

    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Quick Start", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
    await clickStable(page.getByRole("button", { name: copiedAvatarName }));
    await clickStable(page.getByRole("button", { name: "Start avatar" }));

    await expect(page).toHaveURL(/\/runtime\/.+\/attention$/, { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /attention/i })).toBeVisible({ timeout: 15_000 });
  });
});
