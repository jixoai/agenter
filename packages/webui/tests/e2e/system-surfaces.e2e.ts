import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

const terminalCwd = process.cwd();
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const principalRoomIdPattern = /^0x[0-9a-f]+$/i;

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

const findVisibleListbox = async (page: Page): Promise<Locator | null> => {
  const listboxes = page.getByRole("listbox");
  const count = await listboxes.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = listboxes.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
};

const countVisibleListboxes = async (page: Page): Promise<number> => {
  const listboxes = page.getByRole("listbox");
  const count = await listboxes.count();
  let visibleCount = 0;
  for (let index = 0; index < count; index += 1) {
    if (await listboxes.nth(index).isVisible().catch(() => false)) {
      visibleCount += 1;
    }
  }
  return visibleCount;
};

const closeVisibleListboxes = async (page: Page): Promise<void> => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const visibleCount = await countVisibleListboxes(page);
    if (visibleCount === 0) {
      return;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    await expect
      .poll(async () => await countVisibleListboxes(page), { timeout: 1_000 })
      .toBeLessThan(visibleCount)
      .catch(() => undefined);
  }
};

const openSelectContent = async (page: Page, trigger: Locator): Promise<Locator> => {
  await closeVisibleListboxes(page);
  await trigger.click({ timeout: 5_000 }).catch(async () => {
    await trigger.press("Enter").catch(() => undefined);
  });
  let content = page.getByRole("listbox").last();
  const opened = await expect
    .poll(async () => {
      const visibleListbox = await findVisibleListbox(page);
      if (visibleListbox) {
        content = visibleListbox;
        return true;
      }
      return false;
    }, { timeout: 2_000 })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    await trigger.press("Enter").catch(() => undefined);
  }
  const openedAfterKey = await expect
    .poll(async () => {
      const visibleListbox = await findVisibleListbox(page);
      if (visibleListbox) {
        content = visibleListbox;
        return true;
      }
      return false;
    }, { timeout: 2_000 })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!openedAfterKey) {
    await trigger.evaluate((element: HTMLElement) => element.click()).catch(() => undefined);
  }
  await expect(content).toBeVisible({ timeout: 15_000 });
  return content;
};

const chooseSelectOptionByText = async (
  page: Page,
  trigger: Locator,
  optionText: string | RegExp,
): Promise<string> => {
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  const content = await openSelectContent(page, trigger);
  const matcher = typeof optionText === "string" ? new RegExp(`^${escapeRegExp(optionText)}$`) : optionText;
  const optionLabels = (await content.getByRole("option").allTextContents()).map((value) => value.trim());
  const targetIndex = optionLabels.findIndex((value) => matcher.test(value));
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  const label = optionLabels[targetIndex] ?? "";
  const confirmationText = label.split(" · ")[0] ?? label;
  const targetOption = content.getByRole("option", { name: matcher }).first();
  await expect(targetOption).toBeVisible({ timeout: 15_000 });
  await targetOption.dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  }).catch(async () => {
    await targetOption.click({ force: true, timeout: 1_000 });
  });
  await expect(trigger).toContainText(confirmationText, { timeout: 15_000 });
  await expect
    .poll(async () => await content.isVisible().catch(() => false), { timeout: 2_000 })
    .toBeFalsy()
    .catch(() => undefined);
  return label;
};

const chooseFirstSelectOption = async (
  page: Page,
  trigger: Locator,
  predicate: (label: string) => boolean,
): Promise<string | null> => {
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  const content = await openSelectContent(page, trigger);
  const labels = (await content.getByRole("option").allTextContents()).map((value) => value.trim()).filter(Boolean);
  const selectedLabel = labels.find(predicate) ?? null;
  await trigger.press("Escape").catch(() => undefined);
  if (!selectedLabel) {
    await expect
      .poll(async () => await content.isVisible().catch(() => false), { timeout: 2_000 })
      .toBeFalsy()
      .catch(() => undefined);
    return null;
  }
  await expect
    .poll(async () => await content.isVisible().catch(() => false), { timeout: 2_000 })
    .toBeFalsy()
    .catch(() => undefined);
  return chooseSelectOptionByText(page, trigger, selectedLabel);
};

const activateUntil = async (
  locator: Locator,
  predicate: () => Promise<boolean>,
  attempts = 3,
): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await clickStable(locator);
    const activatedByPointer = await expect
      .poll(predicate, { timeout: 1_500 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);
    if (activatedByPointer) {
      return;
    }

    await locator.evaluate((element: HTMLButtonElement) => element.click()).catch(() => undefined);
    const activatedByDomClick = await expect
      .poll(predicate, { timeout: 1_500 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);
    if (activatedByDomClick) {
      return;
    }
  }

  throw new Error("activateUntil failed to reach the expected state");
};

const activateTab = async (tab: Locator): Promise<void> => {
  await activateUntil(
    tab,
    async () => ((await tab.getAttribute("aria-selected")) ?? "false") === "true",
    2,
  );
};

const navigateToSystem = async (
  page: Page,
  label: "Avatars" | "Messages" | "Terminals",
): Promise<void> => {
  const targetPath = `/${label.toLowerCase()}`;
  const namedLink = page.getByRole("link", { name: label });
  const hrefLink = page.locator(`a[href="${targetPath}"]`).first();
  let targetLink = namedLink;
  let linkVisible = await targetLink.isVisible().catch(() => false);
  if (!linkVisible) {
    targetLink = hrefLink;
    linkVisible = await targetLink.isVisible().catch(() => false);
  }
  if (!linkVisible) {
    const toggleSidebarButton = page.getByRole("button", { name: /Toggle (application navigation|Sidebar)/i });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await toggleSidebarButton.click();
  }

  await clickStable(targetLink);
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (await sidebarDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => {
        const visible = await sidebarDialog.isVisible().catch(() => false);
        if (!visible) {
          return true;
        }
        return (await sidebarDialog.getAttribute("data-state")) === "closed";
      }, { timeout: 15_000 })
      .toBeTruthy();
  }
  await expect(page).toHaveURL(
    new RegExp(`/${label.toLowerCase()}(?:$|/.*|\\?.*)`),
    { timeout: 15_000 },
  );
};

const navigateToAdmin = async (page: Page): Promise<void> => {
  const adminLink = page.getByRole("link", { name: /Super admin/i });
  const linkVisible = await adminLink.isVisible().catch(() => false);
  if (!linkVisible) {
    const toggleSidebarButton = page.getByRole("button", { name: "Toggle Sidebar" });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await toggleSidebarButton.click();
  }

  await clickStable(adminLink);
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (await sidebarDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(sidebarDialog).not.toBeVisible({ timeout: 15_000 });
  }
  await expect(page).toHaveURL(/\/admin(?:$|\/.*|\?.*)/, { timeout: 15_000 });
  await expect(page.getByTestId("admin-route")).toBeVisible({ timeout: 15_000 });
};

const ensureSidebarClosed = async (page: Page): Promise<void> => {
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (!(await sidebarDialog.isVisible().catch(() => false))) {
    return;
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await expect
    .poll(async () => {
      const visible = await sidebarDialog.isVisible().catch(() => false);
      if (!visible) {
        return true;
      }
      return (await sidebarDialog.getAttribute("data-state")) === "closed";
    }, { timeout: 15_000 })
    .toBeTruthy();
};

const getWorkbenchEntry = async (
  page: Page,
  name: string | RegExp,
  exact = true,
): Promise<Locator> => {
  await ensureSidebarClosed(page);
  const tab = page.getByRole("tab", { name, exact }).first();
  if (await tab.isVisible().catch(() => false)) {
    return tab;
  }
  if (typeof name === "string") {
    const fuzzyTab = page.getByRole("tab", { name: new RegExp(escapeRegExp(name)) }).first();
    if (await fuzzyTab.isVisible().catch(() => false)) {
      return fuzzyTab;
    }
  }
  return page.getByRole("link", { name, exact }).first();
};

const getRoomTab = (page: Page, roomTitle: string): Locator => {
  return page.getByRole("tab", { name: new RegExp(escapeRegExp(roomTitle)) }).first();
};

const getRoomComposer = (page: Page, roomTitle: string): Locator => {
  return page.getByPlaceholder(new RegExp(`Message ${escapeRegExp(roomTitle)}`));
};

const sendRoomMessage = async (
  page: Page,
  roomTitle: string,
  message: string,
): Promise<Locator> => {
  const roomComposer = getRoomComposer(page, roomTitle);
  const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
  await clickStable(roomComposer);
  await roomComposer.pressSequentially(message);
  await expect(roomComposer).toHaveValue(message, { timeout: 15_000 });
  await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
  await activateUntil(sendMessageButton, async () => {
    return (await roomComposer.inputValue()) === "";
  });
  const row = page.locator("[data-message-id]").filter({ hasText: message }).last();
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
};

const resolveMessageAuthorRow = (messageSection: Locator): Locator => {
  return messageSection.locator("[data-message-author]").first();
};

const isRoomAlreadySelected = async (page: Page, roomTitle: string): Promise<boolean> => {
  if (await getRoomComposer(page, roomTitle).isVisible().catch(() => false)) {
    return true;
  }
  const roomTab = getRoomTab(page, roomTitle);
  if (!(await roomTab.isVisible().catch(() => false))) {
    return false;
  }
  return ((await roomTab.getAttribute("aria-selected")) ?? "false") === "true";
};

const resolveRoomTab = async (page: Page, roomTitle: string): Promise<Locator> => {
  const roomTab = getRoomTab(page, roomTitle);
  const tabVisible = await expect
    .poll(async () => await roomTab.isVisible().catch(() => false), { timeout: 15_000 })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (tabVisible) {
    return roomTab;
  }
  const roomLink = page.getByRole("link", { name: new RegExp(escapeRegExp(roomTitle)) }).first();
  await expect(roomLink).toBeVisible({ timeout: 15_000 });
  return roomLink;
};

const openRoomTab = async (page: Page, roomTitle: string): Promise<void> => {
  if (await isRoomAlreadySelected(page, roomTitle)) {
    return;
  }
  const roomTab = await resolveRoomTab(page, roomTitle);
  await activateUntil(roomTab, async () => await isRoomAlreadySelected(page, roomTitle));
  await expect(getRoomComposer(page, roomTitle)).toBeVisible({ timeout: 15_000 });
};

const openCreateRoomPage = async (page: Page) => {
  await activateUntil(await getWorkbenchEntry(page, "New room"), async () => /\/messages\/new$/.test(page.url()));
  await expect(page).toHaveURL(/\/messages\/new$/, { timeout: 15_000 });
  const createRoomPage = page.getByTestId("message-create-route");
  await expect(createRoomPage).toBeVisible({ timeout: 15_000 });
  return createRoomPage;
};

const openCreateTerminalPage = async (page: Page) => {
  await activateUntil(await getWorkbenchEntry(page, "New terminal"), async () => /\/terminals\/new$/.test(page.url()));
  await expect(page).toHaveURL(/\/terminals\/new$/, { timeout: 15_000 });
  const createTerminalPage = page.getByTestId("terminal-create-route");
  await expect(createTerminalPage).toBeVisible({ timeout: 15_000 });
  return createTerminalPage;
};

const expectSelectedRoomTitle = async (page: Page, roomTitle: string): Promise<void> => {
  await openRoomTab(page, roomTitle);
  await expect(getRoomTab(page, roomTitle)).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await expect(getRoomComposer(page, roomTitle)).toBeVisible({ timeout: 15_000 });
};

const readSelectedRoomChatId = async (page: Page, roomTitle: string): Promise<string> => {
  await openRoomTab(page, roomTitle);
  const roomIdText = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1) ?? "").trim();
  expect(roomIdText.length).toBeGreaterThan(0);
  return roomIdText ?? "";
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

const stopRuntimeIfRunning = async (page: Page): Promise<void> => {
  const stopButton = page.getByRole("button", { name: "Stop", exact: true });
  if (!(await stopButton.isVisible().catch(() => false))) {
    return;
  }
  await clickStable(stopButton);
  await expect
    .poll(async () => await stopButton.isVisible().catch(() => false), { timeout: 10_000 })
    .toBeFalsy()
    .catch(() => undefined);
};

const trackFinishedRequests = (
  page: Page,
  matcher: (request: Request) => boolean,
): {
  readonly matches: string[];
  dispose(): void;
} => {
  const matches: string[] = [];
  const handleRequestFinished = (request: Request): void => {
    if (!matcher(request)) {
      return;
    }
    matches.push(request.url());
  };
  page.on("requestfinished", handleRequestFinished);
  return {
    matches,
    dispose: () => {
      page.off("requestfinished", handleRequestFinished);
    },
  };
};

const openManageRoomDialog = async (page: Page): Promise<Locator> => {
  const manageRoomDialog = page.getByRole("dialog", { name: "Manage room" });
  await activateUntil(page.getByRole("button", { name: "Manage room" }), async () => {
    return await manageRoomDialog.isVisible().catch(() => false);
  }, 4);
  await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
  return manageRoomDialog;
};

const authenticateWithManagedKey = async (page: Page): Promise<void> => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin(?:$|\/.*|\?.*)/, { timeout: 15_000 });
  await expect(page.getByTestId("admin-route")).toBeVisible({ timeout: 60_000 });

  const storedToken = await page.evaluate(() => window.localStorage.getItem("agenter:webui:auth-session"));
  if (storedToken !== null) {
    return;
  }

  const privateKeyInput = page.getByLabel("Root private key");
  const useManagedKeyButton = page.getByRole("button", { name: "Use backend-managed key" });
  await clickStable(useManagedKeyButton);
  await expect
    .poll(async () => {
      const value = await privateKeyInput.inputValue().catch(() => "");
      return value.trim().length > 0;
    }, { timeout: 15_000 })
    .toBeTruthy();

  const signChallengeButton = page.getByRole("button", { name: "Sign challenge" });
  await expect(signChallengeButton).toBeEnabled({ timeout: 15_000 });
  await activateUntil(signChallengeButton, async () => {
    return (await page.evaluate(() => window.localStorage.getItem("agenter:webui:auth-session"))) !== null;
  });
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("agenter:webui:auth-session")), { timeout: 30_000 })
    .not.toBeNull();
};

test.describe("Feature: Svelte system surfaces", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 90_000));
    await authenticateWithManagedKey(page);
  });

  test("Scenario: Given an authenticated superadmin When creating a room and sending a message Then the message-system room transcript renders the new fact", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Playwright room ${testInfo.project.name} ${Date.now()}`;
    const roomMessage = `room message from ${testInfo.project.name}`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    await expect(page.getByRole("heading", { name: "Loading channel history...", exact: true })).toHaveCount(0, {
      timeout: 30_000,
    });
    const chatId = await readSelectedRoomChatId(page, roomTitle);
    expect(chatId).toMatch(principalRoomIdPattern);
    await expect(page.locator('[href*="/messages/room/room-"]')).toHaveCount(0);

    const roomComposer = page.getByPlaceholder(new RegExp(`Message ${escapeRegExp(roomTitle)}`));
    const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
    await clickStable(roomComposer);
    await roomComposer.pressSequentially(roomMessage);
    await expect(roomComposer).toHaveValue(roomMessage, { timeout: 15_000 });
    await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(sendMessageButton, async () => {
      return (await roomComposer.inputValue()) === "";
    });

    await expect(page.getByText(roomMessage)).toBeVisible({ timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSelectedRoomTitle(page, roomTitle);
    expect(await readSelectedRoomChatId(page, roomTitle)).toBe(chatId);
    await expect(page).not.toHaveURL(/\/messages\/room\/room-/);
    await expect(page.locator('[href*="/messages/room/room-"]')).toHaveCount(0);
  });

  test("Scenario: Given New room selects one additional user When creation completes Then the route focuses the new room and the viewer list only includes joined users", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-new-room-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Selected users ${testInfo.project.name} ${Date.now()}`;
    let viewerRuntimeUrl: string | null = null;
    try {
      await navigateToSystem(page, "Avatars");
      await clickStable(page.getByRole("button", { name: "Copy avatar" }));
      const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await expect(page.getByRole("button", { name: viewerAvatarName })).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: viewerAvatarName }));
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      const selectedUserCheckbox = createRoomPage.getByRole("checkbox", {
        name: new RegExp(`^Include ${escapeRegExp(viewerAvatarName)}$`),
      });
      await expect(selectedUserCheckbox).toBeVisible({ timeout: 15_000 });
      await clickStable(selectedUserCheckbox);

      await expect(createRoomPage.getByText("2 Users selected.", { exact: true })).toBeVisible({ timeout: 15_000 });
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      await expect(page).toHaveURL(/\/messages\/room\/0x[0-9a-f]+$/i, { timeout: 15_000 });

      const viewerTrigger = page.getByLabel("View room as user");
      const viewerContent = await openSelectContent(page, viewerTrigger);
      await expect(viewerContent.getByRole("option")).toHaveCount(2, { timeout: 15_000 });
      await expect(viewerContent.getByRole("option", { name: new RegExp(escapeRegExp(viewerAvatarName)) })).toBeVisible({
        timeout: 15_000,
      });
      await page.keyboard.press("Escape");

      const manageRoomDialog = await openManageRoomDialog(page);
      const userSeatRows = manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])');
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await userSeatRows.filter({ hasText: viewerAvatarName }).first().isVisible().catch(() => false);
      });
      await expect(userSeatRows).toHaveCount(2, { timeout: 15_000 });
      await expect(userSeatRows.filter({ hasText: viewerAvatarName }).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page);
      }
    }
  });

  test("Scenario: Given first-visit system surfaces When Avatars or Terminals load Then help hints stay collapsed until requested", async ({
    page,
  }) => {
    await navigateToSystem(page, "Avatars");
    await expect
      .poll(
        async () =>
          await page
            .locator(
              "agenter-help-hint[data-presentation='passive-auto'], agenter-help-hint[data-presentation='active-open']",
            )
            .count(),
        { timeout: 15_000 },
      )
      .toBe(0);

    await navigateToSystem(page, "Terminals");
    await expect
      .poll(
        async () =>
          await page
            .locator(
              "agenter-help-hint[data-presentation='passive-auto'], agenter-help-hint[data-presentation='active-open']",
            )
            .count(),
        { timeout: 15_000 },
      )
      .toBe(0);
  });

  test("Scenario: Given an authenticated superadmin When opening admin and workspace settings Then each route keeps its own navigation and content ownership", async ({
    page,
  }) => {
    await navigateToAdmin(page);
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Superadmin session", exact: true })).toBeVisible({ timeout: 15_000 });

    await navigateToSystem(page, "Avatars");
    const avatarWorkbenchTabs = page.getByLabel("Avatar workbench tabs");
    await activateTab(avatarWorkbenchTabs.getByRole("tab", { name: "Settings", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/settings(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("workspace-settings-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("workspace-settings-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Workspaces", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Inspect source layers, inherited values, and effective settings/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Scenario: Given an authenticated superadmin When creating a global terminal and issuing write plus read tool calls Then the terminal-system action log survives refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);
    const terminalId = `playwright-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const terminalWrite = `echo terminal-smoke-${testInfo.project.name}`;

    await navigateToSystem(page, "Terminals");
    const createTerminalPage = await openCreateTerminalPage(page);
    await createTerminalPage.getByLabel("Terminal id").fill(terminalId);
    await createTerminalPage.getByLabel("Working directory").fill(terminalCwd);
    await clickStable(createTerminalPage.getByRole("button", { name: "Create terminal" }));

    await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible();
    await expect(page.getByText(`Absolute cwd: ${terminalCwd}`)).toBeVisible();
    await expect(page.getByLabel("Call tool as").first()).toContainText("Bootstrap admin");

    await page.getByPlaceholder("Type terminal input…").fill(terminalWrite);
    await activateUntil(page.getByRole("button", { name: "Call tool", exact: true }), async () => {
      return (await page.getByPlaceholder("Type terminal input…").inputValue()) === "";
    });

    await expect(page.getByText(terminalWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expectTerminalViewText(page, terminalWrite);
    await expectTerminalViewText(page, terminalCwd);

    await activateUntil(page.getByRole("tab", { name: "Read", exact: true }), async () => {
      return await page
        .getByRole("button", { name: "Call read", exact: true })
        .isVisible()
        .catch(() => false);
    });
    await chooseSelectOptionByText(page, page.getByLabel("Read mode"), "snapshot");
    await clickStable(page.getByRole("button", { name: "Call read", exact: true }));
    await expect(page.getByText("Terminal read", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Absolute cwd: ${terminalCwd}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(terminalWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Terminal read", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expectTerminalViewText(page, terminalWrite);
    await expectTerminalViewText(page, terminalCwd);
  });

  test("Scenario: Given an authenticated superadmin When granting requester access and approving a pending terminal write Then the users rail and actions rail stay synchronized after refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(75_000);
    const terminalId = `playwright-approval-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const pendingWrite = `echo terminal-approval-${testInfo.project.name}`;
    const leasedWrite = `echo terminal-lease-${testInfo.project.name}`;
    const requesterAvatarName = `playwright-requester-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    let requesterRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      await clickStable(page.getByRole("button", { name: "Copy avatar" }));
      const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
      await copyDialog.getByLabel("New avatar nickname").fill(requesterAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await expect(page.getByRole("button", { name: requesterAvatarName })).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: requesterAvatarName }));
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      requesterRuntimeUrl = page.url();

      await navigateToSystem(page, "Terminals");
      const createTerminalPage = await openCreateTerminalPage(page);
      await createTerminalPage.getByLabel("Terminal id").fill(terminalId);
      await createTerminalPage.getByLabel("Working directory").fill(terminalCwd);
      await clickStable(createTerminalPage.getByRole("button", { name: "Create terminal" }));

      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await activateUntil(page.getByRole("tab", { name: "Users", exact: true }), async () => {
        return await page
          .getByLabel("Grant actor")
          .isVisible()
          .catch(() => false);
      });

      const grantActorSelect = page.getByLabel("Grant actor");
      const requesterOption = await chooseSelectOptionByText(
        page,
        grantActorSelect,
        new RegExp(`^${escapeRegExp(requesterAvatarName)} · .+$`),
      );
      const requesterLabel = requesterOption.split(" · ")[0] ?? requesterOption;
      await chooseSelectOptionByText(page, page.getByLabel("Grant role"), "requester");
      const grantedSeat = page
        .locator("div")
        .filter({ has: page.getByText(requesterLabel, { exact: true }) })
        .filter({ has: page.getByRole("button", { name: "Revoke" }) })
        .first();
      const grantSeatButton = page.getByRole("button", { name: "Grant seat" });
      await expect(grantSeatButton).toBeEnabled({ timeout: 15_000 });
      await activateUntil(grantSeatButton, async () => {
        return await grantedSeat.isVisible().catch(() => false);
      });

      await expect(grantedSeat).toBeVisible({ timeout: 15_000 });
      await expect(grantedSeat).toContainText("requester");
      await expect(page.getByLabel("Call tool as").first()).toContainText(requesterLabel, { timeout: 15_000 });
      await page.getByPlaceholder("Type terminal input…").fill(pendingWrite);
      const callToolButton = page.getByRole("button", { name: "Call tool", exact: true });
      await expect(callToolButton).toBeEnabled({ timeout: 15_000 });
      await activateUntil(callToolButton, async () => {
        return await page
          .getByText(/Write approval requested:/)
          .isVisible()
          .catch(() => false);
      });

      await expect(page.getByText(/Write approval requested:/)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Pending approvals", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(new RegExp(escapeRegExp(pendingWrite)))).toBeVisible({ timeout: 15_000 });
      const approveButton = page.getByRole("button", { name: "Approve 30m" }).first();
      await expect(approveButton).toBeEnabled({ timeout: 15_000 });
      await activateUntil(approveButton, async () => {
        return await page
          .getByText(/Lease until/)
          .isVisible()
          .catch(() => false);
      });
      await expect(page.getByText(/Lease until/)).toBeVisible({ timeout: 15_000 });

      await page.getByPlaceholder("Type terminal input…").fill(leasedWrite);
      await expect(callToolButton).toBeEnabled({ timeout: 15_000 });
      await activateUntil(callToolButton, async () => {
        return await page
          .getByText(leasedWrite, { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
      });

      await activateUntil(page.getByRole("tab", { name: "Actions", exact: true }), async () => {
        return await page
          .getByText(leasedWrite, { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
      });
      await expect(page.getByText(leasedWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(leasedWrite, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await activateTab(page.getByRole("tab", { name: "Users", exact: true }));
      await expect(
        page
          .locator("div")
          .filter({ has: page.getByText(requesterLabel, { exact: true }) })
          .filter({ has: page.getByRole("button", { name: "Revoke" }) })
          .first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Lease until/)).toBeVisible({ timeout: 15_000 });
    } finally {
      if (requesterRuntimeUrl) {
        await page.goto(requesterRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page);
      }
    }
  });

  test("Scenario: Given an authenticated superadmin When granting a room seat Then the users rail shows the granted actor and role without leaving the room surface", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Grant room ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const manageRoomDialog = await openManageRoomDialog(page);
    await expect(manageRoomDialog.getByTestId("room-manage-shell")).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByTestId("room-manage-rail")).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByTestId("room-manage-stage")).toBeVisible({ timeout: 15_000 });
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const railButtonHeights = await manageRoomDialog
        .getByTestId("room-manage-rail")
        .locator("button[aria-pressed]")
        .evaluateAll((buttons) =>
          buttons
            .map((button) => button.getBoundingClientRect().height)
            .filter((height) => height > 0),
        );
      expect(Math.max(...railButtonHeights)).toBeLessThan(96);
    }
    await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
      return await manageRoomDialog.getByRole("button", { name: "Add user" }).isVisible().catch(() => false);
    });
    await expect(manageRoomDialog.getByRole("button", { name: "Add user" })).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByText("Bootstrap admin", { exact: true })).toHaveCount(0);
    await activateUntil(manageRoomDialog.getByRole("button", { name: "Add user" }), async () => {
      return await manageRoomDialog
        .getByLabel("Grant actor")
        .isVisible()
        .catch(() => false);
    });

    const grantActorSelect = manageRoomDialog.getByLabel("Grant actor");
    const grantedOption = await chooseFirstSelectOption(manageRoomDialog.page(), grantActorSelect, (label) => {
      return label !== "Select actor";
    });
    expect(grantedOption).not.toBeNull();
    if (!grantedOption) {
      return;
    }

    await chooseSelectOptionByText(manageRoomDialog.page(), manageRoomDialog.getByLabel("Grant role"), "readonly");
    await clickStable(manageRoomDialog.getByRole("button", { name: "Grant seat" }));
    await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
      return await manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-seat-"]')
        .filter({ hasText: grantedOption.split(" · ")[0] ?? grantedOption })
        .first()
        .isVisible()
        .catch(() => false);
    });

    const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;
    const grantedSeat = manageRoomDialog.getByTestId("room-manage-stage").locator('[data-testid^="room-seat-"]').filter({
      hasText: grantedLabel,
    }).first();
    await expect(grantedSeat).toBeVisible({ timeout: 15_000 });
    await expect(grantedSeat).toContainText(grantedLabel);
    await expect(grantedSeat).toContainText("readonly");
  });

  test("Scenario: Given a granted room user When role changes in Permissions Then the updated permission is reflected in the user list", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-permission-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Permission sync ${testInfo.project.name} ${Date.now()}`;
    let viewerRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      await clickStable(page.getByRole("button", { name: "Copy avatar" }));
      const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await expect(page.getByRole("button", { name: viewerAvatarName })).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: viewerAvatarName }));
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const manageRoomDialog = await openManageRoomDialog(page);
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await manageRoomDialog.getByRole("button", { name: "Add user" }).isVisible().catch(() => false);
      });
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Add user" }), async () => {
        return await manageRoomDialog.getByLabel("Grant actor").isVisible().catch(() => false);
      });

      const grantedOption = await chooseSelectOptionByText(
        manageRoomDialog.page(),
        manageRoomDialog.getByLabel("Grant actor"),
        new RegExp(`^${escapeRegExp(viewerAvatarName)} · .+$`),
      );
      const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;
      await chooseSelectOptionByText(manageRoomDialog.page(), manageRoomDialog.getByLabel("Grant role"), "readonly");
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Grant seat" }), async () => {
        return await manageRoomDialog
          .getByTestId("room-manage-stage")
          .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])')
          .filter({ hasText: grantedLabel })
          .first()
          .isVisible()
          .catch(() => false);
      });

      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Permissions section" }), async () => {
        return await manageRoomDialog
          .getByTestId("room-manage-stage")
          .locator('[data-testid^="room-permission-"]')
          .filter({ hasText: grantedLabel })
          .first()
          .isVisible()
          .catch(() => false);
      });

      const permissionRow = manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-permission-"]')
        .filter({ hasText: grantedLabel })
        .first();
      await expect(permissionRow).toBeVisible({ timeout: 15_000 });
      await clickStable(permissionRow.getByRole("button", { name: "Admin", exact: true }));
      await activateUntil(permissionRow.getByRole("button", { name: "Apply", exact: true }), async () => {
        return !(await permissionRow.getByRole("button", { name: "Apply", exact: true }).isVisible().catch(() => false));
      });
      await expect(permissionRow).toContainText("Current role", { timeout: 15_000 });

      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await manageRoomDialog
          .getByTestId("room-manage-stage")
          .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])')
          .filter({ hasText: grantedLabel })
          .first()
          .isVisible()
          .catch(() => false);
      });

      const userSeat = manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])')
        .filter({ hasText: grantedLabel })
        .first();
      await expect(userSeat).toBeVisible({ timeout: 15_000 });
      await expect(userSeat).toContainText("admin", { timeout: 15_000 });
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page);
      }
    }
  });

  test("Scenario: Given a managed room overview When the operator saves a new title Then the selected room keeps the new title after refresh", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Rename room ${testInfo.project.name} ${Date.now()}`;
    const renamedTitle = `${roomTitle} renamed`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const chatId = await readSelectedRoomChatId(page, roomTitle);
    const manageRoomDialog = await openManageRoomDialog(page);
    await expect(manageRoomDialog.getByTestId("room-manage-overview-section")).toBeVisible({ timeout: 15_000 });
    await typeStable(manageRoomDialog.getByLabel("Room title"), renamedTitle);
    await activateUntil(manageRoomDialog.getByRole("button", { name: "Save title", exact: true }), async () => {
      return await page.getByRole("tab", { name: new RegExp(escapeRegExp(renamedTitle)) }).first().isVisible().catch(() => false);
    });
    await page.keyboard.press("Escape");
    await expect(manageRoomDialog).not.toBeVisible({ timeout: 15_000 });

    await expectSelectedRoomTitle(page, renamedTitle);
    expect(await readSelectedRoomChatId(page, renamedTitle)).toBe(chatId);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSelectedRoomTitle(page, renamedTitle);
    expect(await readSelectedRoomChatId(page, renamedTitle)).toBe(chatId);
  });

  test("Scenario: Given a granted room user When seat actions focus and revoke the seat Then the room users list reflects both mutations in place", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-seat-actions-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Seat actions ${testInfo.project.name} ${Date.now()}`;
    let viewerRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      await clickStable(page.getByRole("button", { name: "Copy avatar" }));
      const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await expect(page.getByRole("button", { name: viewerAvatarName })).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: viewerAvatarName }));
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const manageRoomDialog = await openManageRoomDialog(page);
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await manageRoomDialog.getByRole("button", { name: "Add user" }).isVisible().catch(() => false);
      });
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Add user" }), async () => {
        return await manageRoomDialog.getByLabel("Grant actor").isVisible().catch(() => false);
      });

      const grantedOption = await chooseSelectOptionByText(
        manageRoomDialog.page(),
        manageRoomDialog.getByLabel("Grant actor"),
        new RegExp(`^${escapeRegExp(viewerAvatarName)} · .+$`),
      );
      const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;
      await chooseSelectOptionByText(manageRoomDialog.page(), manageRoomDialog.getByLabel("Grant role"), "member");
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Grant seat" }), async () => {
        return await manageRoomDialog
          .getByTestId("room-manage-stage")
          .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])')
          .filter({ hasText: grantedLabel })
          .first()
          .isVisible()
          .catch(() => false);
      });

      const userSeat = manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])')
        .filter({ hasText: grantedLabel })
        .first();
      await expect(userSeat).toBeVisible({ timeout: 15_000 });

      const seatActionsButton = userSeat.getByRole("button", {
        name: new RegExp(`Seat actions for ${escapeRegExp(grantedLabel)}`, "i"),
      });
      await clickStable(seatActionsButton);
      await clickStable(page.getByRole("menuitem", { name: "Focus seat", exact: true }));
      await expect(userSeat).toContainText("Focused", { timeout: 15_000 });

      await clickStable(seatActionsButton);
      await clickStable(page.getByRole("menuitem", { name: "Revoke user", exact: true }));
      await expect(userSeat).toHaveCount(0, { timeout: 15_000 });
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page);
      }
    }
  });

  test("Scenario: Given another durable room exists When the operator archives the selected room Then the message route falls back to the remaining room", async ({
    page,
  }, testInfo) => {
    const fallbackTitle = `Archive fallback ${testInfo.project.name} ${Date.now()}`;
    const archiveTitle = `Archive target ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createFallbackPage = await openCreateRoomPage(page);
    await typeStable(createFallbackPage.getByLabel("Room title"), fallbackTitle);
    await activateUntil(createFallbackPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });
    await expectSelectedRoomTitle(page, fallbackTitle);

    const createArchivePage = await openCreateRoomPage(page);
    await typeStable(createArchivePage.getByLabel("Room title"), archiveTitle);
    await activateUntil(createArchivePage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });
    await expectSelectedRoomTitle(page, archiveTitle);

    const manageRoomDialog = await openManageRoomDialog(page);
    await expect(manageRoomDialog.getByTestId("room-manage-overview-section")).toBeVisible({ timeout: 15_000 });
    await activateUntil(manageRoomDialog.getByRole("button", { name: "Archive room", exact: true }), async () => {
      return await isRoomAlreadySelected(page, fallbackTitle);
    });
    await expectSelectedRoomTitle(page, fallbackTitle);
    await expect(page.getByRole("tab", { name: new RegExp(escapeRegExp(archiveTitle)) })).toHaveCount(0);
  });

  test("Scenario: Given another durable room exists When the operator deletes the selected room Then the message route falls back to the remaining room", async ({
    page,
  }, testInfo) => {
    const fallbackTitle = `Delete fallback ${testInfo.project.name} ${Date.now()}`;
    const deleteTitle = `Delete target ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createFallbackPage = await openCreateRoomPage(page);
    await typeStable(createFallbackPage.getByLabel("Room title"), fallbackTitle);
    await activateUntil(createFallbackPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });
    await expectSelectedRoomTitle(page, fallbackTitle);

    const createDeletePage = await openCreateRoomPage(page);
    await typeStable(createDeletePage.getByLabel("Room title"), deleteTitle);
    await activateUntil(createDeletePage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });
    await expectSelectedRoomTitle(page, deleteTitle);

    const manageRoomDialog = await openManageRoomDialog(page);
    await expect(manageRoomDialog.getByTestId("room-manage-overview-section")).toBeVisible({ timeout: 15_000 });
    await activateUntil(manageRoomDialog.getByRole("button", { name: "Delete room", exact: true }), async () => {
      return await isRoomAlreadySelected(page, fallbackTitle);
    });
    await expectSelectedRoomTitle(page, fallbackTitle);
    await expect(page.getByRole("tab", { name: new RegExp(escapeRegExp(deleteTitle)) })).toHaveCount(0);
  });

  test("Scenario: Given two room viewers When one viewer sends a message Then the other viewer sees the transcript update without refresh", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Live room ${testInfo.project.name} ${Date.now()}`;
    const liveMessage = `live transcript ${testInfo.project.name}`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const chatId = await readSelectedRoomChatId(page, roomTitle);

    const mirrorPage = await page.context().newPage();
    await mirrorPage.goto(`/messages/room/${chatId}`, { waitUntil: "domcontentloaded" });
    await expectSelectedRoomTitle(mirrorPage, roomTitle);

    const mirrorComposer = mirrorPage.getByPlaceholder(new RegExp(`Message ${escapeRegExp(roomTitle)}`));
    const mirrorSendButton = mirrorPage.getByRole("button", { name: "Send", exact: true });
    await mirrorComposer.fill(liveMessage);
    await expect(mirrorSendButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(mirrorSendButton, async () => {
      return (await mirrorComposer.inputValue()) === "";
    });

    await expect(page.getByText(liveMessage)).toBeVisible({ timeout: 15_000 });
    await mirrorPage.close();
  });

  test("Scenario: Given room messages from two granted viewers When View as switches Then the matching sender message moves to viewer ownership", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-viewer-align-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Viewer align ${testInfo.project.name} ${Date.now()}`;
    const adminMessage = `viewer align admin ${testInfo.project.name}`;
    const avatarMessage = `viewer align avatar ${testInfo.project.name}`;
    let viewerRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      await clickStable(page.getByRole("button", { name: "Copy avatar" }));
      const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await expect(page.getByRole("button", { name: viewerAvatarName })).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: viewerAvatarName }));
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const manageRoomDialog = await openManageRoomDialog(page);
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await manageRoomDialog.getByRole("button", { name: "Add user" }).isVisible().catch(() => false);
      });
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Add user" }), async () => {
        return await manageRoomDialog.getByLabel("Grant actor").isVisible().catch(() => false);
      });
      await chooseSelectOptionByText(
        manageRoomDialog.page(),
        manageRoomDialog.getByLabel("Grant actor"),
        new RegExp(`^${escapeRegExp(viewerAvatarName)} · .+$`),
      );
      await chooseSelectOptionByText(manageRoomDialog.page(), manageRoomDialog.getByLabel("Grant role"), "member");
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Grant seat" }), async () => {
        return await page.getByLabel("View room as user").isVisible().catch(() => false);
      });
      await page.keyboard.press("Escape");
      await expect(manageRoomDialog).not.toBeVisible({ timeout: 15_000 });

      const adminSection = await sendRoomMessage(page, roomTitle, adminMessage);
      const adminRow = resolveMessageAuthorRow(adminSection);
      await expect(adminRow).toHaveAttribute("data-message-author", "viewer", { timeout: 15_000 });

      await chooseSelectOptionByText(
        page,
        page.getByLabel("View room as user"),
        new RegExp(`^${escapeRegExp(viewerAvatarName)} · .+$`),
      );
      await expect(adminRow).toHaveAttribute("data-message-author", "participant", { timeout: 15_000 });

      const avatarSection = await sendRoomMessage(page, roomTitle, avatarMessage);
      const avatarRow = resolveMessageAuthorRow(avatarSection);
      await expect(avatarRow).toHaveAttribute("data-message-author", "viewer", { timeout: 15_000 });

      await chooseSelectOptionByText(page, page.getByLabel("View room as user"), /admin$/i);
      await expect(adminRow).toHaveAttribute("data-message-author", "viewer", { timeout: 15_000 });
      await expect(avatarRow).toHaveAttribute("data-message-author", "participant", { timeout: 15_000 });
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page);
      }
    }
  });

  test("Scenario: Given a room message with another granted seat When the operator idles on the transcript Then read acks settle once and the message discloses read plus unread actors", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-read-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Read detail ${testInfo.project.name} ${Date.now()}`;
    const roomMessage = `read detail message ${testInfo.project.name}`;
    let viewerRuntimeUrl: string | null = null;
    try {
      await navigateToSystem(page, "Avatars");
      await clickStable(page.getByRole("button", { name: "Copy avatar" }));
      const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await expect(page.getByRole("button", { name: viewerAvatarName })).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: viewerAvatarName }));
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const manageRoomDialog = await openManageRoomDialog(page);
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await manageRoomDialog.getByRole("button", { name: "Add user" }).isVisible().catch(() => false);
      });
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Add user" }), async () => {
        return await manageRoomDialog.getByLabel("Grant actor").isVisible().catch(() => false);
      });

      const grantActorSelect = manageRoomDialog.getByLabel("Grant actor");
      const grantedOption = await chooseSelectOptionByText(
        manageRoomDialog.page(),
        grantActorSelect,
        new RegExp(`^${escapeRegExp(viewerAvatarName)} · .+$`),
      );
      const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;

      await chooseSelectOptionByText(manageRoomDialog.page(), manageRoomDialog.getByLabel("Grant role"), "readonly");
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Grant seat" }), async () => {
        return await manageRoomDialog
          .getByTestId("room-manage-stage")
          .locator('[data-testid^="room-seat-"]')
          .filter({ hasText: grantedLabel })
          .first()
          .isVisible()
          .catch(() => false);
      });
      await page.keyboard.press("Escape");
      await expect(manageRoomDialog).not.toBeVisible({ timeout: 15_000 });

      const readAckRequests = trackFinishedRequests(page, (request) => {
        return request.url().includes("/trpc/message.globalMarkRead");
      });
      const roomComposer = getRoomComposer(page, roomTitle);
      const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
      await clickStable(roomComposer);
      await roomComposer.pressSequentially(roomMessage);
      await expect(roomComposer).toHaveValue(roomMessage, { timeout: 15_000 });
      await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
      await activateUntil(sendMessageButton, async () => {
        return (await roomComposer.inputValue()) === "";
      });

      const latestMessageRow = page.locator("[data-message-id]").last();
      await expect(latestMessageRow).toContainText(roomMessage, { timeout: 15_000 });
      const readIndicator = latestMessageRow.getByTestId("message-read-indicator");
      await expect(readIndicator).toBeVisible({ timeout: 15_000 });
      await expect(readIndicator).toHaveAttribute("aria-label", "1/2 read", { timeout: 15_000 });

      await clickStable(readIndicator);
      const disclosure = page.getByTestId("message-read-disclosure");
      await expect(disclosure).toBeVisible({ timeout: 15_000 });
      await expect(disclosure).toContainText("Read");
      await expect(disclosure).toContainText("Unread");
      await expect(disclosure).toContainText(grantedLabel);
      await page.keyboard.press("Escape");
      await expect(disclosure).not.toBeVisible({ timeout: 15_000 });

      await chooseSelectOptionByText(
        page,
        page.getByLabel("View room as user"),
        new RegExp(`^${escapeRegExp(viewerAvatarName)} · .+$`),
      );
      await expect
        .poll(() => readAckRequests.matches.length, { timeout: 15_000 })
        .toBeGreaterThan(0);
      const settledReadAckCount = readAckRequests.matches.length;
      await expect(readIndicator).toHaveAttribute("aria-label", "All 2 users read", { timeout: 15_000 });
      await expect(readIndicator).toHaveAttribute("data-complete", "true", { timeout: 15_000 });
      await page.waitForTimeout(1_200);
      expect(readAckRequests.matches.length).toBe(settledReadAckCount);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expectSelectedRoomTitle(page, roomTitle);
      await page.waitForTimeout(1_200);
      expect(readAckRequests.matches.length).toBe(settledReadAckCount);
      readAckRequests.dispose();
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page);
      }
    }
  });

  test("Scenario: Given a selected room When the toolbar add-user action is pressed Then room management lands on Users Add", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Toolbar add user ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const roomToolbar = page.locator("[data-workbench-page-toolbar]");
    const manageRoomDialog = page.getByRole("dialog", { name: "Manage room" });
    await activateUntil(roomToolbar.getByRole("button", { name: "Add user", exact: true }), async () => {
      return await manageRoomDialog.getByLabel("Grant actor").isVisible().catch(() => false);
    }, 4);

    await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByTestId("room-manage-nav-users")).toHaveAttribute("aria-pressed", "true");
    await expect(manageRoomDialog.getByLabel("Grant actor")).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByLabel("Grant role")).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given loaded room messages When the toolbar searches the transcript Then the active match cycles through the loaded chat rows", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Search room ${testInfo.project.name} ${Date.now()}`;
    const plainMessage = `search plain ${testInfo.project.name}`;
    const firstMatchMessage = `needle ${testInfo.project.name} first`;
    const secondMatchMessage = `needle ${testInfo.project.name} second`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    await sendRoomMessage(page, roomTitle, plainMessage);
    const firstMatchRow = await sendRoomMessage(page, roomTitle, firstMatchMessage);
    const secondMatchRow = await sendRoomMessage(page, roomTitle, secondMatchMessage);

    const roomToolbar = page.locator("[data-workbench-page-toolbar]");
    await activateUntil(roomToolbar.getByRole("button", { name: "Search messages", exact: true }), async () => {
      return await page.getByTestId("room-search-dialog").isVisible().catch(() => false);
    }, 4);

    const searchDialog = page.getByTestId("room-search-dialog");
    await expect(searchDialog).toBeVisible({ timeout: 15_000 });
    const searchInput = searchDialog.getByLabel("Search messages");
    await typeStable(searchInput, "needle");
    await expect(searchDialog.getByTestId("room-search-count")).toHaveText("1/2", { timeout: 15_000 });
    await expect(firstMatchRow).toHaveAttribute("data-room-search-match", "true", { timeout: 15_000 });
    await expect(secondMatchRow).not.toHaveAttribute("data-room-search-match", "true");

    await clickStable(searchDialog.getByRole("button", { name: "Next", exact: true }));
    await expect(searchDialog.getByTestId("room-search-count")).toHaveText("2/2", { timeout: 15_000 });
    await expect(secondMatchRow).toHaveAttribute("data-room-search-match", "true", { timeout: 15_000 });
    await expect(firstMatchRow).not.toHaveAttribute("data-room-search-match", "true");

    await clickStable(searchDialog.getByRole("button", { name: "Previous", exact: true }));
    await expect(searchDialog.getByTestId("room-search-count")).toHaveText("1/2", { timeout: 15_000 });
    await expect(firstMatchRow).toHaveAttribute("data-room-search-match", "true", { timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(searchDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-message-id][data-room-search-match='true']")).toHaveCount(0, { timeout: 15_000 });
  });

  test("Scenario: Given a room attachment When the toolbar switches to assets Then the durable upload fills page content without transcript chrome pollution", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Assets room ${testInfo.project.name} ${Date.now()}`;
    const roomMessage = `asset message ${testInfo.project.name}`;
    const assetName = `brief-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const roomToolbar = page.locator("[data-workbench-page-toolbar]");
    const composer = getRoomComposer(page, roomTitle);
    const composerGroup = page.getByRole("group", { name: "Message composer" });
    await composer.fill(roomMessage);
    await composerGroup.locator('input[type="file"]').setInputFiles({
      name: assetName,
      mimeType: "text/plain",
      buffer: Buffer.from(`durable asset ${roomTitle}`, "utf8"),
    });

    await expect(page.getByText(assetName, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
    await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(sendMessageButton, async () => {
      return await page.getByText(roomMessage, { exact: true }).first().isVisible().catch(() => false);
    });

    await activateTab(roomToolbar.getByRole("tab", { name: "assets", exact: true }));
    const assetsViewport = page.getByTestId("room-assets-pane-viewport");
    await expect(assetsViewport).toBeVisible({ timeout: 15_000 });
    const assetRow = assetsViewport.locator('[data-testid^="room-asset-row-"]').filter({
      hasText: assetName,
    }).first();
    await expect(assetRow).toBeVisible({ timeout: 15_000 });
    await expect(assetRow).toContainText("text/plain");
    await expect(composerGroup).toHaveCount(0);

    await activateTab(roomToolbar.getByRole("tab", { name: "chat", exact: true }));
    await expect(composerGroup).toBeVisible({ timeout: 15_000 });
  });

  test.fixme("Scenario: Given an authenticated superadmin When quick start launches and closes a runtime tab Then Avatars keeps the attention shell reachable without a secondary running rail", async ({
    page,
  }) => {
    await expect(page.getByText("Quick Start", { exact: true })).toBeVisible({ timeout: 60_000 });
    const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
    await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
    const avatarWorkbenchTabs = page.getByLabel("Avatar workbench tabs");
    await activateUntil(startAvatarButton, async () => {
      return /\/avatars\/runtime\/.+\/attention$/.test(page.url())
        || (await avatarWorkbenchTabs.getByRole("tab").count()) > 3;
    });

    await expect(avatarWorkbenchTabs.getByRole("tab")).toHaveCount(4, { timeout: 15_000 });
    if (!/\/avatars\/runtime\/.+\/attention$/.test(page.url())) {
      await activateTab(avatarWorkbenchTabs.getByRole("tab").nth(3));
    }

    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
    const runtimeUrl = page.url();
    await expect(page.getByRole("tab", { name: /attention/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("runtime-primary-stage")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("runtime-secondary-rail")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("runtime-attention-overview")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("runtime-attention-summary")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Running Avatars", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Running", exact: true })).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await expect(page.getByTestId("runtime-secondary-rail-mobile")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /Quick jumps/i })).toBeVisible({ timeout: 15_000 });
    }
    const closeRuntimeTabButton = avatarWorkbenchTabs.getByRole("button", { name: /^Close / }).first();
    await clickStable(closeRuntimeTabButton);
    await expect(page).toHaveURL(/\/avatars\/workspace(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Quick Start", exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto(runtimeUrl, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
    await expect(page.getByTestId("runtime-primary-stage")).toBeVisible({ timeout: 15_000 });
    await stopRuntimeIfRunning(page);
  });

  test("Scenario: Given quick start avatar copy When the operator refreshes and launches the copied avatar Then the live catalog and stable runtime shell keep the copy visible", async ({
    page,
  }, testInfo) => {
    const copiedAvatarName = `playwright-copy-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    await navigateToSystem(page, "Avatars");
    const copyAvatarButton = page.getByRole("button", { name: "Copy avatar" });
    await expect(copyAvatarButton).toBeEnabled({ timeout: 15_000 });
    await clickStable(copyAvatarButton);

    const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
    await copyDialog.getByLabel("New avatar nickname").fill(copiedAvatarName);
    await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
      return !(await copyDialog.isVisible().catch(() => false));
    });

    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Quick Start", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
    await clickStable(page.getByRole("button", { name: copiedAvatarName }));
    await clickStable(page.getByRole("button", { name: "Start avatar" }));

    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /attention/i })).toBeVisible({ timeout: 15_000 });
    await stopRuntimeIfRunning(page);
  });

  test("Scenario: Given quick start avatar copy dialog When the operator presses Enter Then the avatar copy submits through form semantics", async ({
    page,
  }, testInfo) => {
    const copiedAvatarName = `playwright-enter-copy-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    await navigateToSystem(page, "Avatars");
    await clickStable(page.getByRole("button", { name: "Copy avatar" }));

    const copyDialog = page.getByRole("dialog", { name: "Copy avatar" });
    const nicknameInput = copyDialog.getByLabel("New avatar nickname");
    await nicknameInput.fill(copiedAvatarName);
    await nicknameInput.press("Enter");

    await expect(copyDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
  });
});
