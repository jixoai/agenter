import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

const terminalCwd = process.cwd();
const AUTH_SESSION_STORAGE_KEY = "agenter:webui:auth-session";
const AUTH_SKIP_AUTO_LOGIN_ONCE_KEY = "agenter:webui:skip-auto-login-once";
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
  await locator.fill(value);
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
    if (
      await listboxes
        .nth(index)
        .isVisible()
        .catch(() => false)
    ) {
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

  await expect.poll(async () => await countVisibleListboxes(page), { timeout: 2_000 }).toBe(0);
};

const openSelectContent = async (page: Page, trigger: Locator): Promise<Locator> => {
  await closeVisibleListboxes(page);
  await clickStable(trigger).catch(async () => {
    await trigger.press("Enter").catch(() => undefined);
  });
  let content = page.getByRole("listbox").last();
  const opened = await expect
    .poll(
      async () => {
        const visibleListbox = await findVisibleListbox(page);
        if (visibleListbox) {
          content = visibleListbox;
          return true;
        }
        return false;
      },
      { timeout: 2_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    await trigger.focus().catch(() => undefined);
    await trigger.press("ArrowDown").catch(() => undefined);
  }
  const openedAfterArrow = await expect
    .poll(
      async () => {
        const visibleListbox = await findVisibleListbox(page);
        if (visibleListbox) {
          content = visibleListbox;
          return true;
        }
        return false;
      },
      { timeout: 2_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!openedAfterArrow) {
    await trigger.press("Enter").catch(() => undefined);
  }
  const openedAfterKey = await expect
    .poll(
      async () => {
        const visibleListbox = await findVisibleListbox(page);
        if (visibleListbox) {
          content = visibleListbox;
          return true;
        }
        return false;
      },
      { timeout: 2_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!openedAfterKey) {
    await trigger.evaluate((element: HTMLElement) => element.click()).catch(() => undefined);
  }
  await expect(content).toBeVisible({ timeout: 15_000 });
  return content;
};

const chooseSelectOptionByText = async (page: Page, trigger: Locator, optionText: string | RegExp): Promise<string> => {
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  const content = await openSelectContent(page, trigger);
  const matcher = typeof optionText === "string" ? new RegExp(`^${escapeRegExp(optionText)}$`) : optionText;
  let optionLabels: string[] = [];
  const matched = await expect
    .poll(
      async () => {
        optionLabels = (await content.getByRole("option").allTextContents()).map((value) => value.trim());
        return optionLabels.some((value) => matcher.test(value));
      },
      { timeout: 15_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!matched) {
    throw new Error(
      `Select option ${String(optionText)} not found. Available options: ${optionLabels.join(" | ") || "<empty>"}`,
    );
  }
  const targetIndex = optionLabels.findIndex((value) => matcher.test(value));
  const label = optionLabels[targetIndex] ?? "";
  const confirmationText = label.split(" · ")[0] ?? label;
  const normalizedLabel = label.replace(/^[A-Z]·\s*/u, "");
  const confirmationCandidates = [
    confirmationText,
    normalizedLabel,
    normalizedLabel.split(" · ")[0] ?? normalizedLabel,
  ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  const targetOption = content.getByRole("option", { name: matcher }).first();
  await expect(targetOption).toBeVisible({ timeout: 15_000 });
  await targetOption
    .dispatchEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    })
    .catch(async () => {
      await targetOption.click({ force: true, timeout: 1_000 });
    });
  await expect.poll(async () => await content.isVisible().catch(() => false), { timeout: 15_000 }).toBeFalsy();
  await expect
    .poll(
      async () => {
        const triggerText = ((await trigger.textContent()) ?? "").replace(/\s+/g, " ").trim();
        const triggerTitle = ((await trigger.getAttribute("title")) ?? "").replace(/\s+/g, " ").trim();
        return confirmationCandidates.some((candidate) => {
          return triggerText.includes(candidate) || triggerTitle.includes(candidate);
        });
      },
      { timeout: 2_000 },
    )
    .toBeTruthy()
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
  if (!selectedLabel) {
    await page.mouse.click(0, 0).catch(() => undefined);
    await expect
      .poll(async () => await content.isVisible().catch(() => false), { timeout: 2_000 })
      .toBeFalsy()
      .catch(() => undefined);
    return null;
  }
  const targetOption = content.getByRole("option", { name: new RegExp(`^${escapeRegExp(selectedLabel)}$`) }).first();
  await expect(targetOption).toBeVisible({ timeout: 15_000 });
  await targetOption
    .dispatchEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    })
    .catch(async () => {
      await targetOption.click({ force: true, timeout: 1_000 });
    });
  await expect(trigger).toContainText(selectedLabel.split(" · ")[0] ?? selectedLabel, { timeout: 15_000 });
  await expect.poll(async () => await content.isVisible().catch(() => false), { timeout: 15_000 }).toBeFalsy();
  return selectedLabel;
};

const activateUntil = async (locator: Locator, predicate: () => Promise<boolean>, attempts = 3): Promise<void> => {
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

    await locator.click({ force: true, timeout: 1_000 }).catch(() => undefined);
    const activatedByForceClick = await expect
      .poll(predicate, { timeout: 1_500 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);
    if (activatedByForceClick) {
      return;
    }
  }

  throw new Error("activateUntil failed to reach the expected state");
};

const activateTab = async (tab: Locator): Promise<void> => {
  await activateUntil(tab, async () => ((await tab.getAttribute("aria-selected")) ?? "false") === "true", 2);
};

const navigateToSystem = async (page: Page, label: "Avatars" | "Messages" | "Terminals"): Promise<void> => {
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
      .poll(
        async () => {
          const visible = await sidebarDialog.isVisible().catch(() => false);
          if (!visible) {
            return true;
          }
          return (await sidebarDialog.getAttribute("data-state")) === "closed";
        },
        { timeout: 15_000 },
      )
      .toBeTruthy();
  }
  await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}(?:$|/.*|\\?.*)`), { timeout: 15_000 });
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
    .poll(
      async () => {
        const visible = await sidebarDialog.isVisible().catch(() => false);
        if (!visible) {
          return true;
        }
        return (await sidebarDialog.getAttribute("data-state")) === "closed";
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
};

const getWorkbenchEntry = async (page: Page, name: string | RegExp, exact = true): Promise<Locator> => {
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

const getRoomComposer = (page: Page): Locator => {
  return page
    .getByRole("group", { name: "Message composer" })
    .locator('[data-testid="web-chat-draft-editor"] [role="textbox"]')
    .first();
};

const readRoomComposerText = async (roomComposer: Locator): Promise<string> => {
  return ((await roomComposer.textContent()) ?? "").replace(/\u200b/g, "").trim();
};

const sendRoomMessage = async (page: Page, roomTitle: string, message: string): Promise<Locator> => {
  const roomComposer = getRoomComposer(page);
  const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
  await roomComposer.fill(message);
  await expect.poll(async () => await readRoomComposerText(roomComposer), { timeout: 15_000 }).toBe(message);
  await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
  await activateUntil(sendMessageButton, async () => {
    return !(await sendMessageButton.isEnabled().catch(() => true));
  });
  const row = page.locator("[data-view-key]").filter({ hasText: message }).last();
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
};

const resolveMessageAuthorRow = (messageSection: Locator): Locator => {
  return messageSection.locator("[data-message-author]").first();
};

const isRoomAlreadySelected = async (page: Page, roomTitle: string): Promise<boolean> => {
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
  await expect(getRoomComposer(page)).toBeVisible({ timeout: 15_000 });
};

const openCreateRoomPage = async (page: Page) => {
  await activateUntil(await getWorkbenchEntry(page, "New room"), async () => /\/messages\/new$/.test(page.url()));
  await expect(page).toHaveURL(/\/messages\/new$/, { timeout: 15_000 });
  const createRoomPage = page.getByTestId("message-create-route");
  await expect(createRoomPage).toBeVisible({ timeout: 15_000 });
  return createRoomPage;
};

const waitForRoomUserCheckbox = async (createRoomPage: Locator, label: string): Promise<Locator> => {
  const checkbox = createRoomPage.getByRole("checkbox", {
    name: new RegExp(`^Include ${escapeRegExp(label)}$`),
  });
  let availableUsers: string[] = [];
  const visible = await expect
    .poll(
      async () => {
        availableUsers = (await createRoomPage.locator('[data-testid^="new-room-user-"]').allTextContents())
          .map((value) => value.replace(/\s+/g, " ").trim())
          .filter(Boolean);
        return await checkbox.isVisible().catch(() => false);
      },
      { timeout: 15_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    throw new Error(`Room user ${label} was not listed. Available users: ${availableUsers.join(" | ") || "<empty>"}`);
  }
  return checkbox;
};

const openCreateTerminalPage = async (page: Page) => {
  const createRoutePattern = /\/terminals\/new$/;
  const reachedCreateRoute = await activateUntil(await getWorkbenchEntry(page, "New terminal"), async () =>
    createRoutePattern.test(page.url()),
  )
    .then(() => true)
    .catch(() => false);
  if (!reachedCreateRoute) {
    await page.goto("/terminals/new", { waitUntil: "domcontentloaded" });
  }
  await expect(page).toHaveURL(/\/terminals\/new$/, { timeout: 15_000 });
  const createTerminalPage = page.getByTestId("terminal-create-route");
  await expect(createTerminalPage).toBeVisible({ timeout: 15_000 });
  return createTerminalPage;
};

const createTerminalAndOpenDetail = async (
  page: Page,
  input: {
    terminalId: string;
    cwd: string;
  },
): Promise<void> => {
  const createTerminalPage = await openCreateTerminalPage(page);
  await createTerminalPage.getByLabel("Terminal id").fill(input.terminalId);
  await createTerminalPage.getByLabel("Working directory").fill(input.cwd);
  await clickStable(createTerminalPage.getByRole("button", { name: "Create terminal" }));
  const terminalTab = page.getByRole("tab", { name: new RegExp(escapeRegExp(input.terminalId)) }).first();
  await expect(terminalTab).toBeVisible({ timeout: 15_000 });
  await activateUntil(terminalTab, async () => {
    return await page
      .getByText(`Launch cwd: ${input.cwd}`)
      .isVisible()
      .catch(() => false);
  });
  await expect(page).toHaveURL(new RegExp(`/terminals/${escapeRegExp(encodeURIComponent(input.terminalId))}$`), {
    timeout: 15_000,
  });
  await expect(page.getByText(`Launch cwd: ${input.cwd}`)).toBeVisible({ timeout: 15_000 });
};

const expectSelectedRoomTitle = async (page: Page, roomTitle: string): Promise<void> => {
  await openRoomTab(page, roomTitle);
  await expect(getRoomTab(page, roomTitle)).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await expect(getRoomComposer(page)).toBeVisible({ timeout: 15_000 });
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

const expectTerminalSnapshotGeometry = async (page: Page, cols: number, rows: number): Promise<void> => {
  await expect(page.getByTestId("terminal-current-snapshot")).toContainText(`Current snapshot: ${cols}x${rows}`, {
    timeout: 15_000,
  });
};

const focusTerminalViewport = async (page: Page): Promise<void> => {
  const terminalView = page.locator("terminal-view").first();
  await terminalView.waitFor({ state: "visible", timeout: 15_000 });
  const viewport = terminalView.locator("[data-terminal-viewport]").first();
  await expect(viewport).toBeVisible({ timeout: 15_000 });
  await clickStable(viewport);
};

const typeIntoTerminalTextarea = async (page: Page, text: string): Promise<void> => {
  const terminalView = page.locator("terminal-view").first();
  await terminalView.waitFor({ state: "visible", timeout: 15_000 });
  await focusTerminalViewport(page);
  const textarea = terminalView.locator(".xterm-helper-textarea").first();
  await expect(textarea).toBeAttached({ timeout: 15_000 });
  await textarea.focus().catch(() => undefined);
  await textarea.pressSequentially(text);
};

const pressTerminalTextareaKey = async (page: Page, key: string): Promise<void> => {
  const terminalView = page.locator("terminal-view").first();
  await terminalView.waitFor({ state: "visible", timeout: 15_000 });
  await focusTerminalViewport(page);
  const textarea = terminalView.locator(".xterm-helper-textarea").first();
  await expect(textarea).toBeAttached({ timeout: 15_000 });
  await textarea.focus().catch(() => undefined);
  await textarea.press(key);
};

const typeIntoTerminalViewport = async (page: Page, text: string): Promise<void> => {
  await typeIntoTerminalTextarea(page, text);
};

const pressTerminalViewportKey = async (page: Page, key: string): Promise<void> => {
  await pressTerminalTextareaKey(page, key);
};

const typeIntoTerminalViewportByKeyboard = async (page: Page, text: string): Promise<void> => {
  await focusTerminalViewport(page);
  await page.keyboard.type(text);
};

const pressTerminalViewportKeyByKeyboard = async (page: Page, key: string): Promise<void> => {
  await focusTerminalViewport(page);
  await page.keyboard.press(key);
};

const countTerminalViewOccurrences = async (page: Page, text: string): Promise<number> => {
  const terminalView = page.locator("terminal-view").first();
  await terminalView.waitFor({ state: "visible", timeout: 15_000 });
  return await terminalView.evaluate((element, expected) => {
    const shadowText = element.shadowRoot?.textContent ?? "";
    if (expected.length === 0) {
      return 0;
    }
    return shadowText.split(expected).length - 1;
  }, text);
};

const readTerminalProjectionScale = async (page: Page): Promise<number> => {
  const terminalView = page.locator("terminal-view").first();
  await terminalView.waitFor({ state: "visible", timeout: 15_000 });
  return await terminalView.evaluate((element) => {
    if (!("projectionScale" in element)) {
      return 0;
    }
    const projectionScale = element.projectionScale;
    return typeof projectionScale === "number" ? projectionScale : 0;
  });
};

const stopRuntimeIfRunning = async (page: Page): Promise<void> => {
  const stopButton = page.getByRole("button", { name: /^(Stop|Stop runtime)$/u }).first();
  const startButton = page.getByRole("button", { name: /^(Start|Start avatar|Start runtime)$/u }).first();
  const overflowTrigger = page.getByRole("button", { name: "Open runtime toolbar details", exact: true }).first();
  const settled = await expect
    .poll(
      async () =>
        (await stopButton.isVisible().catch(() => false)) ||
        (await startButton.isVisible().catch(() => false)) ||
        (await overflowTrigger.isVisible().catch(() => false)),
      { timeout: 15_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!settled) {
    return;
  }
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (
      !(await stopButton.isVisible().catch(() => false)) &&
      !(await startButton.isVisible().catch(() => false)) &&
      (await overflowTrigger.isVisible().catch(() => false))
    ) {
      await clickStable(overflowTrigger);
    }
    if (await stopButton.isVisible().catch(() => false)) {
      await clickStable(stopButton);
      await expect.poll(async () => await startButton.isVisible().catch(() => false), { timeout: 15_000 }).toBeTruthy();
      return;
    }
    if (attempt === 24) {
      break;
    }
    await page.waitForTimeout(200);
  }
  await expect.poll(async () => await startButton.isVisible().catch(() => false), { timeout: 15_000 }).toBeTruthy();
};

const startRuntimeIfStopped = async (page: Page): Promise<void> => {
  const stopButton = page.getByRole("button", { name: /^(Stop|Stop runtime)$/u }).first();
  const startButton = page.getByRole("button", { name: /^(Start|Start runtime)$/u }).first();
  const overflowTrigger = page.getByRole("button", { name: "Open runtime toolbar details", exact: true }).first();
  const settled = await expect
    .poll(
      async () =>
        (await stopButton.isVisible().catch(() => false)) ||
        (await startButton.isVisible().catch(() => false)) ||
        (await overflowTrigger.isVisible().catch(() => false)),
      { timeout: 15_000 },
    )
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!settled) {
    return;
  }
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (
      !(await stopButton.isVisible().catch(() => false)) &&
      !(await startButton.isVisible().catch(() => false)) &&
      (await overflowTrigger.isVisible().catch(() => false))
    ) {
      await clickStable(overflowTrigger);
    }
    if (await startButton.isVisible().catch(() => false)) {
      await clickStable(startButton);
      await expect.poll(async () => await stopButton.isVisible().catch(() => false), { timeout: 30_000 }).toBeTruthy();
      return;
    }
    if (await stopButton.isVisible().catch(() => false)) {
      return;
    }
    if (attempt === 24) {
      break;
    }
    await page.waitForTimeout(200);
  }
  await expect.poll(async () => await stopButton.isVisible().catch(() => false), { timeout: 30_000 }).toBeTruthy();
};

const readAuthToken = async (page: Page): Promise<string> => {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem("agenter:webui:auth-session");
    if (!raw) {
      return "";
    }
    try {
      const parsed = JSON.parse(raw) as { token?: unknown };
      return typeof parsed.token === "string" ? parsed.token : "";
    } catch {
      return "";
    }
  });
  expect(token).not.toBe("");
  return token;
};

const stopSessionViaApi = async (page: Page, sessionId: string): Promise<void> => {
  const token = await readAuthToken(page);
  const response = await page.request.post("/trpc/session.stop?batch=1", {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    data: {
      "0": {
        json: {
          sessionId,
        },
      },
    },
  });
  expect(response.ok()).toBeTruthy();
};

const parseTrpcBatchJson = async <T>(response: Awaited<ReturnType<Page["request"]["post"]>>): Promise<T> => {
  const payload = (await response.json()) as unknown;
  const firstEntry = Array.isArray(payload) ? payload[0] : payload;
  if (firstEntry && typeof firstEntry === "object" && "error" in firstEntry) {
    throw new Error(JSON.stringify(firstEntry));
  }
  const result = firstEntry && typeof firstEntry === "object" && "result" in firstEntry ? firstEntry.result : null;
  const data = result && typeof result === "object" && "data" in result ? result.data : null;
  if (data && typeof data === "object" && "json" in data) {
    return data.json as T;
  }
  return data as T;
};

const readRuntimeAvatarPrincipalId = async (page: Page): Promise<string> => {
  const runtimeText = await page.locator("main").textContent();
  const principalId = /by-principal\/(0x[0-9a-f]{40})/i.exec(runtimeText ?? "")?.[1] ?? "";
  expect(principalId).not.toBe("");
  return principalId;
};

const issueGlobalTerminalGrantViaApi = async (
  page: Page,
  input: {
    terminalId: string;
    participantId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    label?: string;
  },
): Promise<{ grant: { accessToken?: string | null } }> => {
  const token = await readAuthToken(page);
  const response = await page.request.post("/trpc/terminal.issueGrant?batch=1", {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    data: {
      "0": {
        json: input,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`terminal.issueGrant failed: ${response.status()} ${await response.text()}`);
  }
  return await parseTrpcBatchJson<{ grant: { accessToken?: string | null } }>(response);
};

const writeGlobalTerminalViaApi = async (
  page: Page,
  input: {
    terminalId: string;
    accessToken: string;
    text: string;
    createApprovalRequest?: boolean;
  },
): Promise<unknown> => {
  const token = await readAuthToken(page);
  const response = await page.request.post("/trpc/terminal.write?batch=1", {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    data: {
      "0": {
        json: {
          ...input,
          returnRead: false,
        },
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`terminal.write failed: ${response.status()} ${await response.text()}`);
  }
  return await parseTrpcBatchJson<unknown>(response);
};

const approveGlobalTerminalRequestViaApi = async (
  page: Page,
  input: {
    terminalId: string;
    requestId: string;
    durationMs: number;
  },
): Promise<void> => {
  const token = await readAuthToken(page);
  const response = await page.request.post("/trpc/terminal.approveRequest?batch=1", {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    data: {
      "0": {
        json: input,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`terminal.approveRequest failed: ${response.status()} ${await response.text()}`);
  }
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
  await activateUntil(
    await getRoomToolbarButton(page, "Manage room"),
    async () => {
      return await manageRoomDialog.isVisible().catch(() => false);
    },
    4,
  );
  await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
  return manageRoomDialog;
};

const resolveVisibleNamedButton = async (
  scope: Page | Locator,
  name: "Add user" | "Manage room" | "Search messages",
): Promise<Locator | null> => {
  const candidates = scope.getByRole("button", { name, exact: true });
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
};

const resolveVisibleTerminalToolbarButton = async (scope: Page | Locator, name: "Users"): Promise<Locator | null> => {
  const candidates = scope.getByRole("button", { name, exact: true });
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
};

const resolveVisibleTerminalActionsToggle = async (scope: Page | Locator): Promise<Locator | null> => {
  const radioCandidates = scope.getByRole("radio", { name: "Actions", exact: true });
  const radioCount = await radioCandidates.count().catch(() => 0);
  for (let index = 0; index < radioCount; index += 1) {
    const candidate = radioCandidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  const buttonCandidates = scope.getByRole("button", { name: "Actions", exact: true });
  const buttonCount = await buttonCandidates.count().catch(() => 0);
  for (let index = 0; index < buttonCount; index += 1) {
    const candidate = buttonCandidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
};

const getTerminalToolbar = (page: Page): Locator => {
  return page.locator("[data-workbench-page-toolbar]").last();
};

const ensureTerminalToolbarOverflowOpen = async (page: Page): Promise<void> => {
  const terminalToolbar = getTerminalToolbar(page);
  const overflowTrigger = terminalToolbar
    .getByRole("button", { name: "Open terminal toolbar details", exact: true })
    .first();
  if (!(await overflowTrigger.isVisible().catch(() => false))) {
    return;
  }
  if ((await overflowTrigger.getAttribute("aria-expanded")) === "true") {
    return;
  }
  await activateUntil(
    overflowTrigger,
    async () => {
      return (await overflowTrigger.getAttribute("aria-expanded")) === "true";
    },
    4,
  );
};

const getTerminalToolbarButton = async (page: Page, name: "Users"): Promise<Locator> => {
  const terminalToolbar = getTerminalToolbar(page);
  const inlineButton = await resolveVisibleTerminalToolbarButton(terminalToolbar, name);
  if (inlineButton) {
    return inlineButton;
  }

  await ensureTerminalToolbarOverflowOpen(page);
  let overflowButton: Locator | null = null;
  await expect
    .poll(
      async () => {
        overflowButton = await resolveVisibleTerminalToolbarButton(page, name);
        return overflowButton !== null;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return overflowButton!;
};

const getTerminalActionsToggle = async (page: Page): Promise<Locator> => {
  const terminalToolbar = getTerminalToolbar(page);
  const inlineToggle = await resolveVisibleTerminalActionsToggle(terminalToolbar);
  if (inlineToggle) {
    return inlineToggle;
  }

  await ensureTerminalToolbarOverflowOpen(page);
  let overflowToggle: Locator | null = null;
  await expect
    .poll(
      async () => {
        overflowToggle = await resolveVisibleTerminalActionsToggle(page);
        return overflowToggle !== null;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return overflowToggle!;
};

const openTerminalActionsPanel = async (page: Page): Promise<Locator> => {
  const panel = page.locator('[data-terminal-detail-panel-view="actions"]').first();
  if (await panel.isVisible().catch(() => false)) {
    return panel;
  }
  await activateUntil(
    await getTerminalActionsToggle(page),
    async () => {
      return await panel.isVisible().catch(() => false);
    },
    4,
  );
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
};

const closeTerminalActionsPanel = async (page: Page): Promise<void> => {
  const closeButton = page.getByRole("button", { name: "Close terminal actions", exact: true }).first();
  if (!(await closeButton.isVisible().catch(() => false))) {
    return;
  }
  await clickStable(closeButton);
  await expect(closeButton).not.toBeVisible({ timeout: 15_000 });
  await expectBodyInteractive(page);
};

const expectTerminalActionPanelText = async (page: Page, text: string): Promise<void> => {
  const panel = await openTerminalActionsPanel(page);
  await expect(panel.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
};

const expectTerminalActionPanelContains = async (page: Page, text: string | RegExp): Promise<void> => {
  const panel = await openTerminalActionsPanel(page);
  await expect(panel.getByText(text).first()).toBeVisible({ timeout: 15_000 });
};

const openTerminalUsersDialog = async (page: Page): Promise<Locator> => {
  await closeTerminalActionsPanel(page);
  const dialog = page.getByTestId("terminal-users-dialog");
  await activateUntil(
    await getTerminalToolbarButton(page, "Users"),
    async () => {
      return await dialog.isVisible().catch(() => false);
    },
    4,
  );
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
};

const closeTerminalUsersDialog = async (page: Page): Promise<void> => {
  const dialog = page.getByTestId("terminal-users-dialog");
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }
  await clickStable(dialog.getByRole("button", { name: "Close", exact: true }));
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  await expectBodyInteractive(page);
};

const resolveVisibleRoomViewerTrigger = async (scope: Page | Locator): Promise<Locator | null> => {
  const candidates = scope.getByRole("button", { name: "View room as user", exact: true });
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
};

const getRoomToolbarButton = async (
  page: Page,
  name: "Add user" | "Manage room" | "Search messages",
): Promise<Locator> => {
  const roomToolbar = page.locator("[data-workbench-page-toolbar]");
  const inlineButton = await resolveVisibleNamedButton(roomToolbar, name);
  if (inlineButton) {
    return inlineButton;
  }

  const overflowTrigger = roomToolbar.getByRole("button", { name: "Open room toolbar details", exact: true }).first();
  await expect(overflowTrigger).toBeVisible({ timeout: 15_000 });
  if ((await overflowTrigger.getAttribute("aria-expanded")) !== "true") {
    await activateUntil(
      overflowTrigger,
      async () => {
        return (await overflowTrigger.getAttribute("aria-expanded")) === "true";
      },
      4,
    );
  }
  let overflowButton: Locator | null = null;
  await expect
    .poll(
      async () => {
        overflowButton = await resolveVisibleNamedButton(page, name);
        return overflowButton !== null;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return overflowButton!;
};

const getRoomViewerTrigger = async (page: Page): Promise<Locator> => {
  const inlineTrigger = await resolveVisibleRoomViewerTrigger(page);
  if (inlineTrigger) {
    return inlineTrigger;
  }

  const roomToolbar = page.locator("[data-workbench-page-toolbar]");
  const overflowTrigger = roomToolbar.getByRole("button", { name: "Open room toolbar details", exact: true }).first();
  await expect(overflowTrigger).toBeVisible({ timeout: 15_000 });
  if ((await overflowTrigger.getAttribute("aria-expanded")) !== "true") {
    await activateUntil(
      overflowTrigger,
      async () => {
        return (await overflowTrigger.getAttribute("aria-expanded")) === "true";
      },
      4,
    );
  }
  let viewerTrigger: Locator | null = null;
  await expect
    .poll(
      async () => {
        viewerTrigger = await resolveVisibleRoomViewerTrigger(page);
        return viewerTrigger !== null;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return viewerTrigger!;
};

const openCopyAvatarDialog = async (page: Page): Promise<Locator> => {
  const dialog = page.getByRole("dialog", { name: "Copy avatar" });
  const copyButtons = page.getByRole("button", { name: /Copy avatar/i });
  const openDetailTrigger = page.getByRole("button", { name: /Open detail/i }).first();
  const selectedAvatarEntry = page.getByTestId("avatar-catalog-route").locator("button[aria-pressed]").first();
  const resolveVisibleCopyButton = async (): Promise<Locator | null> => {
    const copyButtonCount = await copyButtons.count().catch(() => 0);
    for (let index = 0; index < copyButtonCount; index += 1) {
      const candidate = copyButtons.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    return null;
  };

  const availableEntry = await expect
    .poll(
      async () => {
        if (await resolveVisibleCopyButton()) {
          return "copy";
        }
        if (await selectedAvatarEntry.isVisible().catch(() => false)) {
          return "select";
        }
        if (await openDetailTrigger.isVisible().catch(() => false)) {
          return "details";
        }
        return null;
      },
      { timeout: 15_000 },
    )
    .not.toBeNull()
    .then(async () => {
      if (await resolveVisibleCopyButton()) {
        return "copy" as const;
      }
      if (await selectedAvatarEntry.isVisible().catch(() => false)) {
        return "select" as const;
      }
      return "details" as const;
    });

  if (availableEntry === "copy") {
    const directButton = await resolveVisibleCopyButton();
    if (directButton) {
      await clickStable(directButton);
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      return dialog;
    }
  }

  if (availableEntry === "select") {
    await expect(selectedAvatarEntry).toBeVisible({ timeout: 15_000 });
    await clickStable(selectedAvatarEntry);
  } else {
    await expect(openDetailTrigger).toBeVisible({ timeout: 15_000 });
    await clickStable(openDetailTrigger);
  }

  const mobileCopyButton = page.getByRole("button", { name: /Copy avatar/i }).first();
  await expect(mobileCopyButton).toBeVisible({ timeout: 15_000 });
  await clickStable(mobileCopyButton);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
};

const selectAvatarCatalogEntry = async (page: Page, avatarName: string): Promise<void> => {
  const avatarCatalogRoute = page.getByTestId("avatar-catalog-route");
  const avatarButton = avatarCatalogRoute.locator("button", { hasText: avatarName }).first();
  const selectedAvatarButton = avatarCatalogRoute
    .locator('button[aria-pressed="true"]', { hasText: avatarName })
    .first();
  const detailHeading = page.getByRole("heading", { name: avatarName, exact: true }).last();
  const closeDetailButton = page.getByRole("button", { name: "Close detail", exact: true });

  if (await detailHeading.isVisible().catch(() => false)) {
    return;
  }
  if (await closeDetailButton.isVisible().catch(() => false)) {
    await clickStable(closeDetailButton);
    await expectBodyInteractive(page);
  } else {
    await expectBodyInteractive(page);
  }
  await expect(avatarButton).toBeVisible({ timeout: 15_000 });
  await activateUntil(
    avatarButton,
    async () => {
      return await selectedAvatarButton.isVisible().catch(() => false);
    },
    4,
  );
  await expect(selectedAvatarButton).toBeVisible({ timeout: 15_000 });
  const detailVisible = await expect
    .poll(async () => await detailHeading.isVisible().catch(() => false), { timeout: 3_000 })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!detailVisible) {
    const openDetailButton = page.getByRole("button", { name: /Open detail/i }).first();
    if (await openDetailButton.isVisible().catch(() => false)) {
      await clickStable(openDetailButton);
    }
  }
  await expect(detailHeading).toBeVisible({ timeout: 15_000 });
};

const expectBodyInteractive = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          return getComputedStyle(document.body).pointerEvents !== "none";
        }),
      { timeout: 15_000 },
    )
    .toBeTruthy();
};

const closeDialogAndExpectInteractive = async (page: Page, dialog: Locator): Promise<void> => {
  await clickStable(dialog.getByRole("button", { name: "Close", exact: true }));
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  await expectBodyInteractive(page);
};

const expectLocatorMissingOrDisabled = async (locator: Locator): Promise<void> => {
  await expect
    .poll(
      async () => {
        const count = await locator.count().catch(() => 0);
        if (count === 0) {
          return true;
        }
        const target = locator.first();
        if (!(await target.isVisible().catch(() => false))) {
          return true;
        }
        return await target.isDisabled().catch(() => false);
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
};

const openManageRoomAddUserDialog = async (page: Page): Promise<Locator> => {
  const manageRoomDialog = page.getByRole("dialog", { name: "Manage room" });
  await activateUntil(
    await getRoomToolbarButton(page, "Add user"),
    async () => {
      const userTriggerVisible = await getManageRoomUserTrigger(manageRoomDialog)
        .isVisible()
        .catch(() => false);
      const roleTriggerVisible = await getManageRoomRoleTrigger(manageRoomDialog)
        .isVisible()
        .catch(() => false);
      return userTriggerVisible && roleTriggerVisible;
    },
    4,
  );
  await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
  await expect(manageRoomDialog.getByTestId("room-manage-nav-users")).toHaveAttribute("aria-pressed", "true");
  await expect(manageRoomDialog.getByRole("tab", { name: "Add", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  return manageRoomDialog;
};

const getManageRoomUserTrigger = (manageRoomDialog: Locator): Locator => {
  return manageRoomDialog.locator('[data-slot="select-trigger"][aria-label="User"]').first();
};

const getManageRoomRoleTrigger = (manageRoomDialog: Locator): Locator => {
  return manageRoomDialog.locator('[data-slot="select-trigger"][aria-label="Role"]').first();
};

const openManageRoomUsersAddForm = async (manageRoomDialog: Locator): Promise<void> => {
  await activateUntil(manageRoomDialog.getByTestId("room-manage-nav-users"), async () => {
    return await manageRoomDialog
      .getByTestId("room-manage-users-section")
      .isVisible()
      .catch(() => false);
  });
  const addTab = manageRoomDialog.getByRole("tab", { name: "Add", exact: true });
  await expect(addTab).toBeVisible({ timeout: 15_000 });
  await activateTab(addTab);
  await expect(getManageRoomUserTrigger(manageRoomDialog)).toBeVisible({ timeout: 15_000 });
  await expect(getManageRoomRoleTrigger(manageRoomDialog)).toBeVisible({ timeout: 15_000 });
};

const submitManageRoomUser = async (manageRoomDialog: Locator, predicate: () => Promise<boolean>): Promise<void> => {
  await clickStable(manageRoomDialog.getByRole("button", { name: "Add room user" }));
  await expect.poll(predicate, { timeout: 15_000 }).toBeTruthy();
};

const authenticateWithManagedKey = async (page: Page): Promise<void> => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin(?:$|\/.*|\?.*)/, { timeout: 15_000 });
  await expect(page.getByTestId("admin-route")).toBeVisible({ timeout: 60_000 });

  const storedToken = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_STORAGE_KEY);
  if (storedToken !== null) {
    return;
  }

  const privateKeyInput = page.getByLabel("Root private key");
  const useManagedKeyButton = page.getByRole("button", { name: "Use backend-managed key" });
  await clickStable(useManagedKeyButton);
  await expect
    .poll(
      async () => {
        const value = await privateKeyInput.inputValue().catch(() => "");
        return value.trim().length > 0;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();

  const signChallengeButton = page.getByRole("button", { name: "Sign challenge" });
  await expect(signChallengeButton).toBeEnabled({ timeout: 15_000 });
  await activateUntil(signChallengeButton, async () => {
    return (await page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_STORAGE_KEY)) !== null;
  });
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_STORAGE_KEY), { timeout: 30_000 })
    .not.toBeNull();
};

const clearBrowserAuthSession = async (page: Page): Promise<void> => {
  await page.evaluate(
    ({ authKey, skipKey }) => {
      window.localStorage.removeItem(authKey);
      window.sessionStorage.setItem(skipKey, "1");
    },
    { authKey: AUTH_SESSION_STORAGE_KEY, skipKey: AUTH_SKIP_AUTO_LOGIN_ONCE_KEY },
  );
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), AUTH_SESSION_STORAGE_KEY), { timeout: 15_000 })
    .toBeNull();
};

const forceUnauthenticatedBootstrap = async (page: Page): Promise<void> => {
  await page.addInitScript(
    ({ authKey, skipKey }) => {
      window.localStorage.removeItem(authKey);
      window.sessionStorage.setItem(skipKey, "1");
    },
    {
      authKey: AUTH_SESSION_STORAGE_KEY,
      skipKey: AUTH_SKIP_AUTO_LOGIN_ONCE_KEY,
    },
  );
};

const expectSignInGate = async (page: Page): Promise<void> => {
  const signInDialog = page.getByRole("dialog", { name: "Sign in to Agenter" });
  await expect(signInDialog).toBeVisible({ timeout: 30_000 });
  await expect(signInDialog.getByText("Sign in to continue.", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(signInDialog.getByRole("button", { name: "Sign challenge" })).toBeDisabled();
};

test.describe("Feature: Unauthenticated system surfaces", () => {
  test("Scenario: Given an unauthenticated browser When opening the New room route Then the protected workbench stays behind the sign-in gate", async ({
    page,
  }) => {
    await forceUnauthenticatedBootstrap(page);
    await page.goto("/messages/new", { waitUntil: "domcontentloaded" });

    await expectSignInGate(page);
    await expect(page.getByTestId("message-create-route")).toHaveCount(0);
  });

  test("Scenario: Given an unauthenticated browser When opening the New terminal route Then the protected workbench stays behind the sign-in gate", async ({
    page,
  }) => {
    await forceUnauthenticatedBootstrap(page);
    await page.goto("/terminals/new", { waitUntil: "domcontentloaded" });

    await expectSignInGate(page);
    await expect(page.getByTestId("terminal-create-route")).toHaveCount(0);
  });
});

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

    const roomComposer = getRoomComposer(page);
    const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
    await roomComposer.fill(roomMessage);
    await expect.poll(async () => await readRoomComposerText(roomComposer), { timeout: 15_000 }).toBe(roomMessage);
    await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(sendMessageButton, async () => {
      return !(await sendMessageButton.isEnabled().catch(() => true));
    });

    await expect(page.getByText(roomMessage)).toBeVisible({ timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSelectedRoomTitle(page, roomTitle);
    expect(await readSelectedRoomChatId(page, roomTitle)).toBe(chatId);
    await expect(page).not.toHaveURL(/\/messages\/room\/room-/);
    await expect(page.locator('[href*="/messages/room/room-"]')).toHaveCount(0);
  });

  test("Scenario: Given an existing room route When browser auth is cleared and the route reloads Then the sign-in gate blocks stale transcript interaction", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Unauth room ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const chatId = await readSelectedRoomChatId(page, roomTitle);

    await clearBrowserAuthSession(page);
    await page.goto(`/messages/room/${encodeURIComponent(chatId)}`, { waitUntil: "domcontentloaded" });

    await expectSignInGate(page);
    await expect(page.getByText("Loading channel history...", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Message composer" })).toHaveCount(0);
    await expectLocatorMissingOrDisabled(page.getByRole("button", { name: "Manage room", exact: true }));
    await expectLocatorMissingOrDisabled(page.getByRole("button", { name: "Add user", exact: true }));
    await expect(page.getByLabel("View room as user")).toHaveCount(0);
  });

  test("Scenario: Given New room selects one additional user When creation completes Then the route focuses the new room and room controls only include joined users", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-new-room-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Selected users ${testInfo.project.name} ${Date.now()}`;
    let viewerRuntimeUrl: string | null = null;
    try {
      await navigateToSystem(page, "Avatars");
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      const selectedUserCheckbox = await waitForRoomUserCheckbox(createRoomPage, viewerAvatarName);
      await clickStable(selectedUserCheckbox);

      await expect(createRoomPage.getByText("2 Users selected.", { exact: true })).toBeVisible({ timeout: 15_000 });
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      await expect(page).toHaveURL(/\/messages\/room\/0x[0-9a-f]+$/i, { timeout: 15_000 });

      if ((page.viewportSize()?.width ?? 0) >= 768) {
        const viewerTrigger = await getRoomViewerTrigger(page);
        await chooseSelectOptionByText(page, viewerTrigger, new RegExp(escapeRegExp(viewerAvatarName)));
        await expect(viewerTrigger).toContainText(viewerAvatarName, { timeout: 15_000 });
      }

      const manageRoomDialog = page.getByRole("dialog", { name: "Manage room" });
      await activateUntil(
        await getRoomToolbarButton(page, "Add user"),
        async () => {
          return await manageRoomDialog.isVisible().catch(() => false);
        },
        4,
      );
      await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
      await activateTab(manageRoomDialog.getByRole("tab", { name: "List", exact: true }));
      const userSeatRows = manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-seat-"]:not([data-testid^="room-seat-role-"])');
      await activateUntil(manageRoomDialog.getByRole("button", { name: "Open Users section" }), async () => {
        return await userSeatRows
          .filter({ hasText: viewerAvatarName })
          .first()
          .isVisible()
          .catch(() => false);
      });
      await expect(userSeatRows).toHaveCount(2, { timeout: 15_000 });
      await expect(userSeatRows.filter({ hasText: viewerAvatarName }).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page).catch(() => undefined);
      }
    }
  });

  test("Scenario: Given mobile room viewer switching When a toolbar action follows Then the action still opens its room chrome", async ({
    page,
  }, testInfo) => {
    test.skip(!/mobile/i.test(testInfo.project.name), "This regression only reproduces on mobile viewport");

    const viewerAvatarName = `playwright-mobile-toolbar-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Mobile toolbar after view-as ${testInfo.project.name} ${Date.now()}`;
    let viewerRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      const selectedUserCheckbox = await waitForRoomUserCheckbox(createRoomPage, viewerAvatarName);
      await clickStable(selectedUserCheckbox);

      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const viewerTrigger = await getRoomViewerTrigger(page);
      await chooseSelectOptionByText(page, viewerTrigger, new RegExp(escapeRegExp(viewerAvatarName)));
      await expect(viewerTrigger).toContainText(viewerAvatarName, { timeout: 15_000 });

      const manageRoomDialog = page.getByRole("dialog", { name: "Manage room" });
      await activateUntil(
        await getRoomToolbarButton(page, "Add user"),
        async () => {
          return await manageRoomDialog.isVisible().catch(() => false);
        },
        4,
      );
      await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
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
  }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");

    await navigateToAdmin(page);
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Superadmin session", exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await navigateToSystem(page, "Avatars");
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    await selectAvatarCatalogEntry(page, "default");
    await clickStable(page.getByRole("button", { name: "Open avatar", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/heartbeat$/, { timeout: 30_000 });
    await expect(page.locator('[data-running-avatar-link] img[data-slot="avatar-image"]').first()).toHaveAttribute(
      "src",
      /\/media\/avatars\//,
    );
    await expect(page.locator('[data-workbench-page-toolbar] img[data-slot="avatar-image"]').first()).toHaveAttribute(
      "src",
      /\/media\/avatars\//,
    );
    await activateTab(page.getByRole("tab", { name: "Settings", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/settings$/, { timeout: 15_000 });
    await expect(page.getByTestId("runtime-primary-stage")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("runtime-settings-stage")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Runtime policy", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /runtime settings$/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Durable runtime law lives here:/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Inspect effective settings, per-layer sources, and provenance/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Scenario: Given a stopped Heartbeat runtime route When the operator reloads and starts from the toolbar Then the runtime returns to running without leaving Heartbeat", async ({
    page,
  }) => {
    await navigateToSystem(page, "Avatars");
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    await selectAvatarCatalogEntry(page, "default");
    await clickStable(page.getByRole("button", { name: "Open avatar", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/heartbeat$/, { timeout: 30_000 });

    const runtimeUrl = page.url();
    const sessionId = decodeURIComponent(new URL(runtimeUrl).pathname.split("/")[3] ?? "");
    expect(sessionId).not.toBe("");

    await stopSessionViaApi(page, sessionId);
    await page.goto(runtimeUrl, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/heartbeat$/, { timeout: 30_000 });
    await expect(page.getByTestId("runtime-primary-stage")).toBeVisible({ timeout: 15_000 });

    await startRuntimeIfStopped(page);
    await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(runtimeUrl)}$`), { timeout: 30_000 });

    await stopRuntimeIfRunning(page);
  });

  test("Scenario: Given an authenticated superadmin When creating a global terminal and issuing write plus read tool calls Then the terminal-system action log survives refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(45_000);
    const terminalId = `playwright-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const terminalWrite = `echo terminal-smoke-${testInfo.project.name}`;
    const terminalOutput = terminalWrite.replace(/^echo\s+/u, "");

    await navigateToSystem(page, "Terminals");
    await createTerminalAndOpenDetail(page, {
      terminalId,
      cwd: terminalCwd,
    });

    await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible();
    await expect(page.getByText(`Launch cwd: ${terminalCwd}`)).toBeVisible();
    await expect(page.getByLabel("Call tool as").first()).toContainText("Bootstrap admin");

    await page.getByPlaceholder("Type terminal input…").fill(terminalWrite);
    await activateUntil(page.getByRole("button", { name: "Call tool", exact: true }), async () => {
      return (await page.getByPlaceholder("Type terminal input…").inputValue()) === "";
    });

    await expectTerminalActionPanelText(page, terminalWrite);
    await expectTerminalViewText(page, terminalOutput);

    await closeTerminalActionsPanel(page);
    await activateTab(page.getByRole("tab", { name: "Read", exact: true }).last());
    await chooseSelectOptionByText(page, page.getByLabel("Read mode"), "snapshot");
    await clickStable(page.getByRole("button", { name: "Call read", exact: true }).first());
    await expectTerminalActionPanelContains(page, /terminal\.read|Terminal read/u);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Launch cwd: ${terminalCwd}`)).toBeVisible({ timeout: 15_000 });
    await expectTerminalActionPanelText(page, terminalWrite);
    await expectTerminalActionPanelContains(page, /terminal\.read|Terminal read/u);
    await expectTerminalViewText(page, terminalOutput);
  });

  test("Scenario: Given an authenticated superadmin When typing into the live terminal viewport Then live input bytes reach the PTY without creating terminal.write facts", async ({
    page,
  }, testInfo) => {
    test.setTimeout(75_000);
    const terminalId = `playwright-rawinput-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const demoCommand = "bun run ../terminal-system/src/bin/demo-cli.ts";
    const resizeEventLabel = "stdout resize event ->";
    const terminalWriteRequests = trackFinishedRequests(page, (request) =>
      request.url().includes("/trpc/terminal.write?batch=1"),
    );

    try {
      await navigateToSystem(page, "Terminals");
      await createTerminalAndOpenDetail(page, {
        terminalId,
        cwd: terminalCwd,
      });

      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("terminal-window-size-info")).toBeVisible({ timeout: 15_000 });

      await typeIntoTerminalViewportByKeyboard(page, demoCommand);
      await pressTerminalViewportKeyByKeyboard(page, "Enter");
      await expectTerminalViewText(page, "Demo CLI (for ATI resize experiments)");
      await expectTerminalViewText(page, "keys: 1=select 2=spinner 3=progress 4=redraw 5=proof");
      expect(terminalWriteRequests.matches).toHaveLength(0);

      await typeIntoTerminalViewportByKeyboard(page, "1");
      await expectTerminalViewText(page, "TUI Select:");
      await pressTerminalViewportKeyByKeyboard(page, "ArrowDown");
      await pressTerminalViewportKeyByKeyboard(page, "Enter");
      await expectTerminalViewText(page, "selected: Breakout");
      expect(terminalWriteRequests.matches).toHaveLength(0);

      await clickStable(page.getByTestId("terminal-window-zoom-control"));
      await expect(page.locator('[data-terminal-window-surface="true"]').first()).toHaveAttribute(
        "data-terminal-window-mode",
        "cover",
        { timeout: 15_000 },
      );
      expect(terminalWriteRequests.matches).toHaveLength(0);
    } finally {
      terminalWriteRequests.dispose();
    }
  });

  test("Scenario: Given the shared terminal window When live drag resize and durable resize are used Then viewport fit-cover stay inside the frame and both resize channels remain usable", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const terminalId = `playwright-resize-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const demoCommand = "bun run ../terminal-system/src/bin/demo-cli.ts";
    const resizeEventLabel = "stdout resize event ->";

    await navigateToSystem(page, "Terminals");
    await createTerminalAndOpenDetail(page, {
      terminalId,
      cwd: terminalCwd,
    });

    await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("terminal-window-size-info")).toBeVisible({ timeout: 15_000 });

    await typeIntoTerminalViewportByKeyboard(page, demoCommand);
    await pressTerminalViewportKeyByKeyboard(page, "Enter");
    await expectTerminalViewText(page, "Demo CLI (for ATI resize experiments)");

    const liveResizeHandle = page.getByTestId("terminal-window-live-resize-handle");
    await expect(liveResizeHandle).toBeVisible({ timeout: 15_000 });
    await liveResizeHandle.scrollIntoViewIfNeeded();
    const resizeEventsBeforeDrag = await countTerminalViewOccurrences(page, resizeEventLabel);
    const liveResizeHint = page.getByTestId("terminal-live-resize-hint");
    await expect(liveResizeHint).toHaveCount(0);
    const handleBox = await liveResizeHandle.boundingBox();
    if (!handleBox) {
      throw new Error("terminal live resize handle bounding box missing");
    }
    const handleHitTarget = await liveResizeHandle.evaluate((handle) => {
      const rect = handle.getBoundingClientRect();
      const computed = {
        nativeResizeHandle: handle.getAttribute("data-terminal-window-native-resize-handle"),
        childElementCount: handle.children.length,
        cursor: getComputedStyle(handle).cursor,
        backgroundColor: getComputedStyle(handle).backgroundColor,
      };
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (!(target instanceof Element)) {
        return {
          rect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          viewport: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
          },
          target: null,
          computed,
        };
      }
      const hitHandle = target.closest('[data-testid="terminal-window-live-resize-handle"]');
      return {
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        },
        target: {
          tagName: target.tagName,
          namespace: target.namespaceURI,
          testId: target.getAttribute("data-testid"),
          handleTestId: hitHandle?.getAttribute("data-testid") ?? null,
        },
        computed,
      };
    });
    expect(handleHitTarget?.target?.handleTestId).toBe("terminal-window-live-resize-handle");
    expect(handleHitTarget?.computed.nativeResizeHandle).toBe("true");
    expect(handleHitTarget?.computed.childElementCount).toBe(0);
    expect(handleHitTarget?.computed.cursor).toBe("se-resize");
    expect(handleHitTarget?.computed.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await liveResizeHandle.hover();
    await page.mouse.down();
    await expect(page.locator('[data-terminal-window-surface="true"]').first()).toHaveAttribute(
      "data-terminal-window-resizing",
      "true",
      { timeout: 5_000 },
    );
    await page.mouse.move(handleBox.x + handleBox.width / 2 - 80, handleBox.y + handleBox.height / 2 - 48, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.locator('[data-terminal-window-surface="true"]').first()).toHaveAttribute(
      "data-terminal-window-resizing",
      "false",
      { timeout: 5_000 },
    );
    await expect.poll(async () => (await liveResizeHint.count()) > 0, { timeout: 15_000 }).toBeTruthy();
    await expect
      .poll(async () => await countTerminalViewOccurrences(page, resizeEventLabel), { timeout: 15_000 })
      .toBeGreaterThan(resizeEventsBeforeDrag);
    await expect(liveResizeHint).toContainText(/Live frame:\s*\d+x\d+px/i, { timeout: 15_000 });
    const liveGeometryAfterRelease = await page.getByTestId("terminal-window-size-info").textContent();
    expect(liveGeometryAfterRelease?.trim().length ?? 0).toBeGreaterThan(0);
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId("terminal-window-size-info")).toHaveText(liveGeometryAfterRelease ?? "", {
      timeout: 5_000,
    });

    await activateUntil(page.getByRole("tab", { name: "Resize", exact: true }), async () => {
      return await page
        .getByTestId("terminal-resize-submit")
        .isVisible()
        .catch(() => false);
    });
    await typeStable(page.getByTestId("terminal-resize-cols"), "96");
    await typeStable(page.getByTestId("terminal-resize-rows"), "28");
    await activateUntil(page.getByTestId("terminal-resize-submit"), async () => {
      return await page
        .getByTestId("terminal-current-snapshot")
        .filter({ hasText: "Current snapshot: 96x28" })
        .isVisible()
        .catch(() => false);
    });
    await expectTerminalSnapshotGeometry(page, 96, 28);

    await typeIntoTerminalViewport(page, "5");
    await expectTerminalViewText(
      page,
      "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345",
    );

    const terminalWindow = page.locator('[data-terminal-window-surface="true"]').first();
    await expect(terminalWindow).toHaveAttribute("data-terminal-window-mode", "fit");
    const fitShellWidth = Number(await terminalWindow.getAttribute("data-terminal-window-shell-width"));
    const fitShellHeight = Number(await terminalWindow.getAttribute("data-terminal-window-shell-height"));
    const fitFrameWidth = Number(await terminalWindow.getAttribute("data-terminal-window-frame-width"));
    const fitFrameHeight = Number(await terminalWindow.getAttribute("data-terminal-window-frame-height"));
    const fitHeaderBox = await terminalWindow.locator("header").boundingBox();
    const fitProjectionScale = await readTerminalProjectionScale(page);
    await expect(page.getByTestId("terminal-window-size-info")).toHaveText("96x28");

    await clickStable(page.getByTestId("terminal-window-zoom-control"));
    await expect(terminalWindow).toHaveAttribute("data-terminal-window-mode", "cover", { timeout: 15_000 });
    const coverShellWidth = Number(await terminalWindow.getAttribute("data-terminal-window-shell-width"));
    const coverShellHeight = Number(await terminalWindow.getAttribute("data-terminal-window-shell-height"));
    const coverFrameWidth = Number(await terminalWindow.getAttribute("data-terminal-window-frame-width"));
    const coverFrameHeight = Number(await terminalWindow.getAttribute("data-terminal-window-frame-height"));
    const coverHeaderBox = await terminalWindow.locator("header").boundingBox();
    const coverProjectionScale = await readTerminalProjectionScale(page);
    expect(fitProjectionScale).toBeGreaterThan(0);
    expect(fitProjectionScale).toBeLessThanOrEqual(1);
    expect(coverProjectionScale).toBe(1);
    await expect(page.getByTestId("terminal-window-live-resize-handle")).toHaveCount(0);
    expect(coverFrameWidth).toBe(fitFrameWidth);
    expect(coverFrameHeight).toBe(fitFrameHeight);
    expect(coverHeaderBox?.height ?? 0).toBeCloseTo(fitHeaderBox?.height ?? 0, 0);
    expect(coverShellWidth).toBeGreaterThanOrEqual(fitShellWidth);
    expect(coverShellHeight).toBeGreaterThanOrEqual(fitShellHeight);
    expect(coverShellWidth).toBeLessThan(coverFrameWidth);
    expect(coverShellHeight).toBeLessThan(coverFrameHeight + Math.round(fitHeaderBox?.height ?? 44));
    await expect
      .poll(async () => {
        return await terminalWindow.evaluate((windowSurface) => {
          return windowSurface
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running");
        });
      })
      .toBeFalsy();
    const coverContentAlignment = await terminalWindow.evaluate((windowSurface) => {
      const body = windowSurface.querySelector<HTMLElement>('[data-terminal-window-body="true"]');
      const terminalView = body?.querySelector<HTMLElement>('[data-terminal-host-root="true"]') as
        | (HTMLElement & { shadowRoot: ShadowRoot | null })
        | null;
      const terminalViewport = terminalView?.shadowRoot?.querySelector<HTMLElement>("[data-terminal-viewport]") ?? null;
      if (!body || !terminalView || !terminalViewport) {
        return null;
      }
      const bodyRect = body.getBoundingClientRect();
      const hostRect = terminalView.getBoundingClientRect();
      const viewportRect = terminalViewport.getBoundingClientRect();
      return {
        bodyLeft: bodyRect.left,
        bodyTop: bodyRect.top,
        bodyRight: bodyRect.right,
        bodyBottom: bodyRect.bottom,
        hostLeft: hostRect.left,
        hostTop: hostRect.top,
        hostRight: hostRect.right,
        hostBottom: hostRect.bottom,
        viewportLeft: viewportRect.left,
        viewportTop: viewportRect.top,
        viewportRight: viewportRect.right,
        viewportBottom: viewportRect.bottom,
      };
    });
    expect(coverContentAlignment).not.toBeNull();
    expect(coverContentAlignment?.hostLeft ?? 0).toBeCloseTo(coverContentAlignment?.bodyLeft ?? 0, 1);
    expect(coverContentAlignment?.hostTop ?? 0).toBeCloseTo(coverContentAlignment?.bodyTop ?? 0, 1);
    expect(coverContentAlignment?.hostRight ?? 0).toBeCloseTo(coverContentAlignment?.bodyRight ?? 0, 1);
    expect(coverContentAlignment?.hostBottom ?? 0).toBeCloseTo(coverContentAlignment?.bodyBottom ?? 0, 1);
    expect(coverContentAlignment?.viewportLeft ?? 0).toBeCloseTo(coverContentAlignment?.bodyLeft ?? 0, 1);
    expect(coverContentAlignment?.viewportTop ?? 0).toBeCloseTo(coverContentAlignment?.bodyTop ?? 0, 1);
    await expect
      .poll(async () => {
        const viewport = await page.getByTestId("terminal-window-scroll-viewport").elementHandle();
        if (!viewport) {
          return { overflow: 0, scrollWidth: 0, clientWidth: 0 };
        }
        return await viewport.evaluate((node) => ({
          overflow: node.scrollWidth - node.clientWidth,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        }));
      })
      .toMatchObject({
        scrollWidth: expect.any(Number),
        clientWidth: expect.any(Number),
      });
    await expect
      .poll(async () => {
        const viewport = await page.getByTestId("terminal-window-scroll-viewport").elementHandle();
        if (!viewport) {
          return 0;
        }
        return await viewport.evaluate((node) => node.scrollWidth - node.clientWidth);
      })
      .toBeGreaterThan(0);

    await clickStable(page.getByTestId("terminal-window-zoom-control"));
    await expect(terminalWindow).toHaveAttribute("data-terminal-window-mode", "fit", { timeout: 15_000 });
    const fitShellWidthAfterRestore = Number(await terminalWindow.getAttribute("data-terminal-window-shell-width"));
    expect(fitShellWidthAfterRestore).toBeLessThan(coverShellWidth);
    await expect(page.getByTestId("terminal-window-live-resize-handle")).toBeVisible({ timeout: 15_000 });
    await expectTerminalViewText(
      page,
      "012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345",
    );
  });

  test("Scenario: Given an existing terminal route When browser auth is cleared and the route reloads Then the sign-in gate blocks stale terminal actions", async ({
    page,
  }, testInfo) => {
    const terminalId = `playwright-unauth-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    await navigateToSystem(page, "Terminals");
    await createTerminalAndOpenDetail(page, {
      terminalId,
      cwd: terminalCwd,
    });

    await clearBrowserAuthSession(page);
    await page.goto(`/terminals/${encodeURIComponent(terminalId)}`, { waitUntil: "domcontentloaded" });

    await expectSignInGate(page);
    await expectLocatorMissingOrDisabled(page.getByRole("button", { name: "Call tool", exact: true }));
    await expectLocatorMissingOrDisabled(page.getByRole("button", { name: "Call read", exact: true }));
    await expectLocatorMissingOrDisabled(page.getByRole("button", { name: "Delete terminal", exact: true }));
  });

  test("Scenario: Given an authenticated superadmin When granting requester access and approving a pending terminal write Then the users rail and actions rail stay synchronized after refresh", async ({
    page,
  }, testInfo) => {
    test.setTimeout(75_000);
    const terminalId = `playwright-approval-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const pendingWrite = `echo terminal-approval-${testInfo.project.name}`;
    const leasedWrite = `echo terminal-lease-${testInfo.project.name}`;
    const requesterAvatarName = `playwright-requester-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    let requesterActorId = "";
    let requesterAccessToken = "";
    let requesterRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(requesterAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, requesterAvatarName);
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      requesterRuntimeUrl = page.url();
      requesterActorId = await readRuntimeAvatarPrincipalId(page);

      await navigateToSystem(page, "Terminals");
      await createTerminalAndOpenDetail(page, {
        terminalId,
        cwd: terminalCwd,
      });

      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      expect(requesterActorId).not.toBe("");
      const grantOutput = await issueGlobalTerminalGrantViaApi(page, {
        terminalId,
        participantId: requesterActorId,
        role: "requester",
        label: requesterAvatarName,
      });
      requesterAccessToken = grantOutput.grant.accessToken ?? "";
      expect(requesterAccessToken).not.toBe("");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await openTerminalUsersDialog(page);
      const grantedSeat = page.getByTestId(`terminal-seat-${requesterActorId}`);
      await expect(grantedSeat).toBeVisible({ timeout: 15_000 });
      await expect(grantedSeat).toContainText(requesterActorId);
      await expect(grantedSeat).toContainText("requester");
      const pendingWriteOutput = await writeGlobalTerminalViaApi(page, {
        terminalId,
        accessToken: requesterAccessToken,
        text: pendingWrite,
        createApprovalRequest: true,
      });
      const pendingRequestId =
        typeof pendingWriteOutput === "object" &&
        pendingWriteOutput &&
        "approvalRequest" in pendingWriteOutput &&
        pendingWriteOutput.approvalRequest &&
        typeof pendingWriteOutput.approvalRequest === "object" &&
        "requestId" in pendingWriteOutput.approvalRequest &&
        typeof pendingWriteOutput.approvalRequest.requestId === "string"
          ? pendingWriteOutput.approvalRequest.requestId
          : "";
      expect(pendingRequestId).not.toBe("");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await openTerminalUsersDialog(page);
      await expect(page.getByText("Pending approvals", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(new RegExp(escapeRegExp(pendingWrite)))).toBeVisible({ timeout: 15_000 });
      await approveGlobalTerminalRequestViaApi(page, {
        terminalId,
        requestId: pendingRequestId,
        durationMs: 30 * 60 * 1000,
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await openTerminalUsersDialog(page);
      await expect(page.getByText(/Lease until/)).toBeVisible({ timeout: 15_000 });
      const leasedWriteOutput = await writeGlobalTerminalViaApi(page, {
        terminalId,
        accessToken: requesterAccessToken,
        text: leasedWrite,
      });
      expect(leasedWriteOutput).toBeTruthy();

      await closeTerminalUsersDialog(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(new RegExp(escapeRegExp(terminalId))).first()).toBeVisible({ timeout: 15_000 });
      await expectTerminalActionPanelText(page, leasedWrite);
      await openTerminalUsersDialog(page);
      await expect(page.getByTestId(`terminal-seat-${requesterActorId}`)).toBeVisible({ timeout: 15_000 });
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
    const manageRoomDialog = await openManageRoomAddUserDialog(page);
    await expect(manageRoomDialog.getByTestId("room-manage-shell")).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByTestId("room-manage-rail")).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByTestId("room-manage-stage")).toBeVisible({ timeout: 15_000 });
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const railButtonHeights = await manageRoomDialog
        .getByTestId("room-manage-rail")
        .locator("button[aria-pressed]")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().height).filter((height) => height > 0),
        );
      expect(Math.max(...railButtonHeights)).toBeLessThan(96);
    }
    await expect(manageRoomDialog.getByText("Bootstrap admin", { exact: true })).toHaveCount(0);

    const grantActorSelect = getManageRoomUserTrigger(manageRoomDialog);
    const grantedOption = await chooseFirstSelectOption(manageRoomDialog.page(), grantActorSelect, (label) => {
      return label !== "Select user";
    });
    expect(grantedOption).not.toBeNull();
    if (!grantedOption) {
      return;
    }

    await chooseSelectOptionByText(manageRoomDialog.page(), getManageRoomRoleTrigger(manageRoomDialog), "readonly");
    await submitManageRoomUser(manageRoomDialog, async () => {
      return await manageRoomDialog
        .getByTestId("room-manage-stage")
        .locator('[data-testid^="room-seat-"]')
        .filter({ hasText: grantedOption.split(" · ")[0] ?? grantedOption })
        .first()
        .isVisible()
        .catch(() => false);
    });

    const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;
    const grantedSeat = manageRoomDialog
      .getByTestId("room-manage-stage")
      .locator('[data-testid^="room-seat-"]')
      .filter({
        hasText: grantedLabel,
      })
      .first();
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
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
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
      const manageRoomDialog = await openManageRoomAddUserDialog(page);

      const grantedOption = await chooseSelectOptionByText(
        manageRoomDialog.page(),
        getManageRoomUserTrigger(manageRoomDialog),
        new RegExp(escapeRegExp(viewerAvatarName)),
      );
      const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;
      await chooseSelectOptionByText(manageRoomDialog.page(), getManageRoomRoleTrigger(manageRoomDialog), "readonly");
      await submitManageRoomUser(manageRoomDialog, async () => {
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
        return !(await permissionRow
          .getByRole("button", { name: "Apply", exact: true })
          .isVisible()
          .catch(() => false));
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
      return await page
        .getByRole("tab", { name: new RegExp(escapeRegExp(renamedTitle)) })
        .first()
        .isVisible()
        .catch(() => false);
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
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
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
      const manageRoomDialog = await openManageRoomAddUserDialog(page);

      const grantedOption = await chooseSelectOptionByText(
        manageRoomDialog.page(),
        getManageRoomUserTrigger(manageRoomDialog),
        new RegExp(escapeRegExp(viewerAvatarName)),
      );
      const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;
      await chooseSelectOptionByText(manageRoomDialog.page(), getManageRoomRoleTrigger(manageRoomDialog), "member");
      await submitManageRoomUser(manageRoomDialog, async () => {
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
        name: new RegExp(`User actions for ${escapeRegExp(grantedLabel)}`, "i"),
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

    const mirrorComposer = getRoomComposer(mirrorPage);
    const mirrorSendButton = mirrorPage.getByRole("button", { name: "Send", exact: true });
    await mirrorComposer.fill(liveMessage);
    await expect(mirrorSendButton).toBeEnabled({ timeout: 15_000 });
    await activateUntil(mirrorSendButton, async () => {
      return !(await mirrorSendButton.isEnabled().catch(() => true));
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
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();
      await stopRuntimeIfRunning(page);

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const manageRoomDialog = await openManageRoomAddUserDialog(page);
      await chooseSelectOptionByText(
        manageRoomDialog.page(),
        getManageRoomUserTrigger(manageRoomDialog),
        new RegExp(escapeRegExp(viewerAvatarName)),
      );
      await chooseSelectOptionByText(manageRoomDialog.page(), getManageRoomRoleTrigger(manageRoomDialog), "member");
      await submitManageRoomUser(manageRoomDialog, async () => {
        return await manageRoomDialog
          .getByTestId("room-manage-stage")
          .locator('[data-testid^="room-seat-"]')
          .filter({ hasText: viewerAvatarName })
          .first()
          .isVisible()
          .catch(() => false);
      });
      await page.keyboard.press("Escape");
      await expect(manageRoomDialog).not.toBeVisible({ timeout: 15_000 });

      const adminSection = await sendRoomMessage(page, roomTitle, adminMessage);
      const adminRow = resolveMessageAuthorRow(adminSection);
      await expect(adminRow).toHaveAttribute("data-message-author", "viewer", { timeout: 15_000 });

      await chooseSelectOptionByText(
        page,
        await getRoomViewerTrigger(page),
        new RegExp(escapeRegExp(viewerAvatarName)),
      );
      await expect(adminRow).toHaveAttribute("data-message-author", "participant", { timeout: 15_000 });

      const avatarSection = await sendRoomMessage(page, roomTitle, avatarMessage);
      const avatarRow = resolveMessageAuthorRow(avatarSection);
      await expect(avatarRow).toHaveAttribute("data-message-author", "viewer", { timeout: 15_000 });

      await chooseSelectOptionByText(page, await getRoomViewerTrigger(page), /admin$/i);
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
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
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
      const manageRoomDialog = await openManageRoomAddUserDialog(page);

      const grantActorSelect = getManageRoomUserTrigger(manageRoomDialog);
      const grantedOption = await chooseSelectOptionByText(
        manageRoomDialog.page(),
        grantActorSelect,
        new RegExp(escapeRegExp(viewerAvatarName)),
      );
      const grantedLabel = grantedOption.split(" · ")[0] ?? grantedOption;

      await chooseSelectOptionByText(manageRoomDialog.page(), getManageRoomRoleTrigger(manageRoomDialog), "readonly");
      await submitManageRoomUser(manageRoomDialog, async () => {
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
        return request.url().includes("message.globalMarkRead");
      });
      const roomComposer = getRoomComposer(page);
      const sendMessageButton = page.getByRole("button", { name: "Send", exact: true });
      await roomComposer.fill(roomMessage);
      await expect.poll(async () => await readRoomComposerText(roomComposer), { timeout: 15_000 }).toBe(roomMessage);
      await expect(sendMessageButton).toBeEnabled({ timeout: 15_000 });
      await activateUntil(sendMessageButton, async () => {
        return !(await sendMessageButton.isEnabled().catch(() => true));
      });

      const latestMessageRow = page.locator("[data-view-key]").last();
      await expect(latestMessageRow).toContainText(roomMessage, { timeout: 15_000 });
      const readIndicator = latestMessageRow.getByTestId("message-read-indicator");
      await expect(readIndicator).toBeVisible({ timeout: 15_000 });
      await expect(readIndicator).toHaveAttribute("aria-label", "0/1 read", { timeout: 15_000 });

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
        await getRoomViewerTrigger(page),
        new RegExp(escapeRegExp(viewerAvatarName)),
      );
      await expect(readIndicator).toHaveAttribute("aria-label", "All 1 users read", { timeout: 15_000 });
      await expect(readIndicator).toHaveAttribute("data-complete", "true", { timeout: 15_000 });
      const settledReadAckCount = readAckRequests.matches.length;
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
    const manageRoomDialog = page.getByRole("dialog", { name: "Manage room" });
    await activateUntil(
      await getRoomToolbarButton(page, "Add user"),
      async () => {
        return await getManageRoomUserTrigger(manageRoomDialog)
          .isVisible()
          .catch(() => false);
      },
      4,
    );

    await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
    await expect(manageRoomDialog.getByTestId("room-manage-nav-users")).toHaveAttribute("aria-pressed", "true");
    await expect(getManageRoomUserTrigger(manageRoomDialog)).toBeVisible({ timeout: 15_000 });
    await expect(getManageRoomRoleTrigger(manageRoomDialog)).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given room toolbar dialogs are dismissed by their close button When the operator opens them again Then the route stays interactive and each dialog reopens", async ({
    page,
  }, testInfo) => {
    const roomTitle = `Dialog reopen ${testInfo.project.name} ${Date.now()}`;

    await navigateToSystem(page, "Messages");
    const createRoomPage = await openCreateRoomPage(page);
    await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
    await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
      return /\/messages\/room\//.test(page.url());
    });

    await expectSelectedRoomTitle(page, roomTitle);
    const manageRoomDialog = await openManageRoomDialog(page);
    await closeDialogAndExpectInteractive(page, manageRoomDialog);

    await activateUntil(
      await getRoomToolbarButton(page, "Manage room"),
      async () => {
        return await manageRoomDialog.isVisible().catch(() => false);
      },
      4,
    );
    await expect(manageRoomDialog).toBeVisible({ timeout: 15_000 });
    await closeDialogAndExpectInteractive(page, manageRoomDialog);

    const searchDialog = page.getByTestId("room-search-dialog");
    await activateUntil(
      await getRoomToolbarButton(page, "Search messages"),
      async () => {
        return await searchDialog.isVisible().catch(() => false);
      },
      4,
    );
    await expect(searchDialog).toBeVisible({ timeout: 15_000 });
    await closeDialogAndExpectInteractive(page, searchDialog);

    await activateUntil(
      await getRoomToolbarButton(page, "Search messages"),
      async () => {
        return await searchDialog.isVisible().catch(() => false);
      },
      4,
    );
    await expect(searchDialog).toBeVisible({ timeout: 15_000 });
    await closeDialogAndExpectInteractive(page, searchDialog);
    await expect(getRoomComposer(page)).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given the operator selects a room viewer When the page reloads Then the same View as actor is restored from auth-scoped KV", async ({
    page,
  }, testInfo) => {
    const viewerAvatarName = `playwright-refresh-viewer-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const roomTitle = `Viewer persistence ${testInfo.project.name} ${Date.now()}`;
    let viewerRuntimeUrl: string | null = null;

    try {
      await navigateToSystem(page, "Avatars");
      const copyDialog = await openCopyAvatarDialog(page);
      await copyDialog.getByLabel("New avatar nickname").fill(viewerAvatarName);
      await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
        return !(await copyDialog.isVisible().catch(() => false));
      });

      await selectAvatarCatalogEntry(page, viewerAvatarName);
      const startAvatarButton = page.getByRole("button", { name: "Start avatar" });
      await expect(startAvatarButton).toBeEnabled({ timeout: 60_000 });
      await clickStable(startAvatarButton);
      await expect(page).toHaveURL(/\/avatars\/runtime\/.+\/attention$/, { timeout: 30_000 });
      viewerRuntimeUrl = page.url();

      await navigateToSystem(page, "Messages");
      const createRoomPage = await openCreateRoomPage(page);
      await typeStable(createRoomPage.getByLabel("Room title"), roomTitle);
      const includeViewerCheckbox = await waitForRoomUserCheckbox(createRoomPage, viewerAvatarName);
      await clickStable(includeViewerCheckbox);
      await activateUntil(createRoomPage.getByRole("button", { name: "Create room" }), async () => {
        return /\/messages\/room\//.test(page.url());
      });

      await expectSelectedRoomTitle(page, roomTitle);
      const chatId = await readSelectedRoomChatId(page, roomTitle);

      const viewerTrigger = await getRoomViewerTrigger(page);
      await chooseSelectOptionByText(page, viewerTrigger, new RegExp(escapeRegExp(viewerAvatarName)));
      await expect(viewerTrigger).toContainText(viewerAvatarName, { timeout: 15_000 });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expectSelectedRoomTitle(page, roomTitle);
      expect(await readSelectedRoomChatId(page, roomTitle)).toBe(chatId);
      await expect(await getRoomViewerTrigger(page)).toContainText(viewerAvatarName, { timeout: 15_000 });
    } finally {
      if (viewerRuntimeUrl) {
        await page.goto(viewerRuntimeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        await stopRuntimeIfRunning(page).catch(() => undefined);
      }
    }
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

    await activateUntil(
      await getRoomToolbarButton(page, "Search messages"),
      async () => {
        return await page
          .getByTestId("room-search-dialog")
          .isVisible()
          .catch(() => false);
      },
      4,
    );

    const searchDialog = page.getByTestId("room-search-dialog");
    await expect(searchDialog).toBeVisible({ timeout: 15_000 });
    const searchInput = searchDialog.getByLabel("Search messages");
    await typeStable(searchInput, "needle");
    await expect(searchDialog.getByTestId("room-search-count")).toHaveText("1/2", { timeout: 15_000 });
    let initialActiveMatch: "first" | "second" | null = null;
    await expect
      .poll(
        async () => {
          if ((await firstMatchRow.getAttribute("data-room-search-match")) === "true") {
            initialActiveMatch = "first";
            return true;
          }
          if ((await secondMatchRow.getAttribute("data-room-search-match")) === "true") {
            initialActiveMatch = "second";
            return true;
          }
          return false;
        },
        { timeout: 15_000 },
      )
      .toBeTruthy();
    expect(initialActiveMatch).not.toBeNull();
    const initialInactiveRow = initialActiveMatch === "first" ? secondMatchRow : firstMatchRow;
    await expect(initialInactiveRow).not.toHaveAttribute("data-room-search-match", "true");

    await clickStable(searchDialog.getByRole("button", { name: "Next", exact: true }));
    await expect(searchDialog.getByTestId("room-search-count")).toHaveText("2/2", { timeout: 15_000 });
    const nextActiveRow = initialActiveMatch === "first" ? secondMatchRow : firstMatchRow;
    const nextInactiveRow = initialActiveMatch === "first" ? firstMatchRow : secondMatchRow;
    await expect(nextActiveRow).toHaveAttribute("data-room-search-match", "true", { timeout: 15_000 });
    await expect(nextInactiveRow).not.toHaveAttribute("data-room-search-match", "true");

    await clickStable(searchDialog.getByRole("button", { name: "Previous", exact: true }));
    await expect(searchDialog.getByTestId("room-search-count")).toHaveText("1/2", { timeout: 15_000 });
    const restoredActiveRow = initialActiveMatch === "first" ? firstMatchRow : secondMatchRow;
    await expect(restoredActiveRow).toHaveAttribute("data-room-search-match", "true", { timeout: 15_000 });

    await page.keyboard.press("Escape");
    await expect(searchDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-view-key][data-room-search-match='true']")).toHaveCount(0, { timeout: 15_000 });
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
    const composer = getRoomComposer(page);
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
      return await page
        .getByText(roomMessage, { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
    });

    await activateTab(roomToolbar.getByRole("tab", { name: "Assets", exact: true }));
    const assetsViewport = page.getByTestId("room-assets-pane-viewport");
    await expect(assetsViewport).toBeVisible({ timeout: 15_000 });
    const assetRow = assetsViewport
      .locator('[data-testid^="room-asset-row-"]')
      .filter({
        hasText: assetName,
      })
      .first();
    await expect(assetRow).toBeVisible({ timeout: 15_000 });
    await expect(assetRow).toContainText("text/plain");
    await expect(composerGroup).toHaveCount(0);

    await activateTab(roomToolbar.getByRole("tab", { name: "Chat", exact: true }));
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
      return (
        /\/avatars\/runtime\/.+\/attention$/.test(page.url()) ||
        (await avatarWorkbenchTabs.getByRole("tab").count()) > 3
      );
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
    const copyDialog = await openCopyAvatarDialog(page);
    await copyDialog.getByLabel("New avatar nickname").fill(copiedAvatarName);
    await activateUntil(copyDialog.getByRole("button", { name: "Copy avatar" }), async () => {
      return !(await copyDialog.isVisible().catch(() => false));
    });

    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 60_000 });
    await selectAvatarCatalogEntry(page, copiedAvatarName);
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
    const copyDialog = await openCopyAvatarDialog(page);
    const nicknameInput = copyDialog.getByLabel("New avatar nickname");
    await nicknameInput.fill(copiedAvatarName);
    await nicknameInput.press("Enter");

    await expect(copyDialog).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: copiedAvatarName })).toBeVisible({ timeout: 15_000 });
  });
});
