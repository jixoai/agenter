import { expect, test, type Locator, type Page } from "@playwright/test";

const LONG_SCROLLBACK_COMMAND = `printf 'scrollback-%02d\\n' ${Array.from({ length: 90 }, (_, index) => index).join(" ")}`;
const LONG_SCROLLBACK_LAST_LINE = "scrollback-89";

const clickStable = async (locator: Locator): Promise<void> => {
  await locator.scrollIntoViewIfNeeded();
  try {
    await locator.click({ timeout: 5_000 });
  } catch {
    await locator.click({ force: true });
  }
};

const activateUntil = async (locator: Locator, predicate: () => Promise<boolean>, attempts = 3): Promise<void> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await clickStable(locator);
    const activated = await expect
      .poll(predicate, { timeout: 2_000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);
    if (activated) {
      return;
    }
  }

  throw new Error("activateUntil failed to reach the expected state");
};

const activateTab = async (tab: Locator): Promise<void> => {
  await activateUntil(tab, async () => ((await tab.getAttribute("aria-selected")) ?? "false") === "true", 2);
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
  await clickStable(page.getByRole("button", { name: "Use backend-managed key" }));
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
    return (await page.evaluate(() => window.localStorage.getItem("agenter:webui:auth-session"))) !== null;
  });
};

const navigateToSystem = async (page: Page, label: "Avatars" | "Workspaces"): Promise<void> => {
  const targetPath = `/${label.toLowerCase()}`;
  const namedLink = page.getByRole("link", { name: label });
  const hrefLink = page.locator(`a[href="${targetPath}"]`).first();
  let link = namedLink.first();
  let linkVisible = await link.isVisible().catch(() => false);
  if (!linkVisible) {
    link = hrefLink;
    linkVisible = await link.isVisible().catch(() => false);
  }
  if (!linkVisible) {
    const toggleSidebarButton = page.getByRole("button", { name: /Toggle (application navigation|Sidebar)/i });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await toggleSidebarButton.click();
    link = namedLink.first();
    linkVisible = await link.isVisible().catch(() => false);
    if (!linkVisible) {
      link = hrefLink;
    }
  }

  await clickStable(link);
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (await sidebarDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect.poll(async () => await sidebarDialog.isVisible().catch(() => false), { timeout: 2_000 }).toBeFalsy();
  }
  await expect(page).toHaveURL(new RegExp(`${targetPath}(?:$|/.*|\\?.*)`), { timeout: 15_000 });
};

const waitForWorkspaceStartReady = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () => {
        const itemCount = await page
          .locator("[data-workspace-start-item]")
          .count()
          .catch(() => 0);
        return itemCount > 0;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
};

const openWorkspaceDetailFromStartPage = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("workspace-start-route")).toBeVisible({ timeout: 15_000 });
  await waitForWorkspaceStartReady(page);
  const firstWorkspaceItem = page.locator("[data-workspace-start-item]").first();
  const firstOpenLink = page.locator("[data-workspace-start-open]").first();
  const href = await firstOpenLink.getAttribute("href");
  const openLinkVisible = await firstOpenLink.isVisible().catch(() => false);
  if (openLinkVisible) {
    await clickStable(firstOpenLink);
  } else {
    await clickStable(firstWorkspaceItem);
    const openWorkspaceDetailButton = page.getByRole("button", { name: "Open workspace detail", exact: true });
    const detailButtonVisible = await openWorkspaceDetailButton.isVisible().catch(() => false);
    if (detailButtonVisible) {
      await clickStable(openWorkspaceDetailButton);
    } else {
      await firstWorkspaceItem.dblclick().catch(() => undefined);
      const navigatedByDoubleClick = await expect
        .poll(async () => /\/workspaces\/root\/.+$/.test(new URL(page.url()).pathname), { timeout: 2_500 })
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);
      if (!navigatedByDoubleClick) {
        await firstWorkspaceItem.focus().catch(() => undefined);
        await firstWorkspaceItem.press("Enter").catch(() => undefined);
      }
    }
  }
  const navigated = await expect
    .poll(async () => /\/workspaces\/root\/.+$/.test(new URL(page.url()).pathname), { timeout: 2_500 })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);
  if (!navigated && href) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
  }
  await expect(page).toHaveURL(/\/workspaces\/root\/.+(?:\?.*)?$/, { timeout: 15_000 });
  await expect(page.getByTestId("workspaces-route")).toBeVisible({ timeout: 15_000 });
};

const openManageWorkspaceDialog = async (page: Page): Promise<Locator> => {
  const manageDialog = page.getByRole("dialog", { name: "Manage workspace" });
  let manageTrigger = page.getByRole("button", { name: "Manage", exact: true });
  const manageVisible = await manageTrigger.isVisible().catch(() => false);
  if (!manageVisible) {
    const overflowTrigger = page.getByRole("button", { name: "Open workspace toolbar details", exact: true });
    await expect(overflowTrigger).toBeVisible({ timeout: 15_000 });
    await clickStable(overflowTrigger);
    manageTrigger = page.getByRole("button", { name: "Manage", exact: true }).last();
  }
  await activateUntil(manageTrigger, async () => {
    return await manageDialog.isVisible().catch(() => false);
  });
  await expect(manageDialog).toBeVisible({ timeout: 15_000 });
  return manageDialog;
};

const findWorkspaceManageActionRow = async (manageDialog: Locator): Promise<Locator> => {
  const rows = manageDialog.locator('[data-testid^="workspace-manage-row-"]');
  let actionableIndex = -1;
  await expect
    .poll(
      async () =>
        await manageDialog
          .getByText("Loading avatar mount state…")
          .isVisible()
          .catch(() => false),
      { timeout: 15_000 },
    )
    .toBeFalsy();
  await expect
    .poll(
      async () => {
        const count = await rows.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          const row = rows.nth(index);
          const mountCount = await row
            .locator('[data-testid^="workspace-manage-mount-"]')
            .count()
            .catch(() => 0);
          if (mountCount > 0) {
            actionableIndex = index;
            return true;
          }
        }
        for (let index = 0; index < count; index += 1) {
          const row = rows.nth(index);
          const unmountCount = await row
            .locator('[data-testid^="workspace-manage-unmount-"]')
            .count()
            .catch(() => 0);
          if (unmountCount > 0) {
            actionableIndex = index;
            return true;
          }
        }
        return false;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return rows.nth(actionableIndex);
};

const readWorkspaceManageRowState = async (row: Locator): Promise<"detached" | "mounted" | "pending"> => {
  const mountVisible = await row
    .getByRole("button", { name: "Mount", exact: true })
    .isVisible()
    .catch(() => false);
  if (mountVisible) {
    return "detached";
  }

  const unmountVisible = await row
    .getByRole("button", { name: "Unmount", exact: true })
    .isVisible()
    .catch(() => false);
  if (unmountVisible) {
    return "mounted";
  }

  return "pending";
};

const waitForWorkspaceManageRowState = async (row: Locator, targetState: "detached" | "mounted"): Promise<void> => {
  await expect.poll(async () => await readWorkspaceManageRowState(row), { timeout: 15_000 }).toBe(targetState);
};

const resolveWorkspaceManageRowState = async (row: Locator): Promise<"detached" | "mounted"> => {
  await expect.poll(async () => await readWorkspaceManageRowState(row), { timeout: 15_000 }).not.toBe("pending");

  const state = await readWorkspaceManageRowState(row);
  if (state === "pending") {
    throw new Error("workspace management row did not settle");
  }
  return state;
};

const expectPageContentLayout = async (root: Locator, mobile: boolean): Promise<void> => {
  const main = root.locator('[data-workbench-page-content-region="main"]').first();
  const bottom = root.locator('[data-workbench-page-content-region="bottom"]').first();
  const drawer = root.locator('[data-workbench-page-content-region="drawer"]').first();

  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(bottom).toBeVisible({ timeout: 15_000 });

  const mainBox = await main.boundingBox();
  const bottomBox = await bottom.boundingBox();

  expect(mainBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();

  if (!mainBox || !bottomBox) {
    return;
  }

  if (mobile) {
    return;
  }

  await expect(drawer).toBeVisible({ timeout: 15_000 });
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox).not.toBeNull();
  if (!drawerBox) {
    return;
  }

  expect(drawerBox.x).toBeGreaterThan(mainBox.x);
  expect(drawerBox.y).toBeLessThanOrEqual(bottomBox.y + 8);
};

const readTerminalTranscript = async (host: Locator): Promise<string> =>
  await host.evaluate((element) => (element instanceof HTMLElement ? element.innerText : (element.textContent ?? "")));

const readTerminalVisibleText = async (host: Locator): Promise<string> =>
  await host.evaluate((element) => {
    const hostElement = element as HTMLElement;
    const hostBox = hostElement.getBoundingClientRect();
    const rows = Array.from(hostElement.querySelectorAll(".term-row")).filter(
      (row): row is HTMLElement => row instanceof HTMLElement,
    );
    return rows
      .filter((row) => {
        const rowBox = row.getBoundingClientRect();
        const rowStyle = window.getComputedStyle(row);
        return (
          rowStyle.display !== "none" &&
          rowStyle.visibility !== "hidden" &&
          rowBox.bottom > hostBox.top &&
          rowBox.top < hostBox.bottom
        );
      })
      .map((row) => (row.textContent ?? "").trimEnd())
      .filter((text) => text.trim().length > 0)
      .join("\n");
  });

const readTerminalScrollState = async (host: Locator) =>
  await host.evaluate((element) => {
    const hostElement = element as HTMLElement;
    const computed = window.getComputedStyle(hostElement);
    return {
      clientHeight: hostElement.clientHeight,
      clientWidth: hostElement.clientWidth,
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      scrollHeight: hostElement.scrollHeight,
      scrollLeft: hostElement.scrollLeft,
      scrollTop: hostElement.scrollTop,
      scrollWidth: hostElement.scrollWidth,
      touchAction: computed.touchAction,
      windowScrollY: window.scrollY,
    };
  });

const readTerminalScrollbackVisibility = async (host: Locator) =>
  await host.evaluate((element) => {
    const hostElement = element as HTMLElement;
    const frameElement = hostElement.closest('[data-testid="workspace-shell-dialog-terminal-frame"]');

    const readVisibleState = () => {
      const hostBox = hostElement.getBoundingClientRect();
      const rows = Array.from(hostElement.querySelectorAll(".term-scrollback-row")).filter(
        (row): row is HTMLElement => row instanceof HTMLElement,
      );
      const visibleRows = rows.filter((row) => {
        const rowBox = row.getBoundingClientRect();
        const rowStyle = window.getComputedStyle(row);
        return (
          rowStyle.display !== "none" &&
          rowStyle.visibility !== "hidden" &&
          rowBox.bottom > hostBox.top &&
          rowBox.top < hostBox.bottom
        );
      });
      const firstVisibleText =
        visibleRows.map((row) => (row.textContent ?? "").trim()).find((text) => text.length > 0) ?? "";

      return {
        firstVisibleText,
        frameOverflowY: frameElement instanceof HTMLElement ? window.getComputedStyle(frameElement).overflowY : null,
        frameScrollTop: frameElement instanceof HTMLElement ? frameElement.scrollTop : null,
        hostClientHeight: hostElement.clientHeight,
        hostOverflowY: window.getComputedStyle(hostElement).overflowY,
        hostScrollHeight: hostElement.scrollHeight,
        hostScrollTop: hostElement.scrollTop,
        scrollbackRows: rows.length,
        visibleScrollbackRows: visibleRows.length,
      };
    };

    const maxScrollTop = Math.max(0, hostElement.scrollHeight - hostElement.clientHeight);
    const step = Math.max(1, Math.floor(hostElement.clientHeight / 2));
    for (let scrollTop = 0; scrollTop <= maxScrollTop; scrollTop += step) {
      hostElement.scrollTop = scrollTop;
      const state = readVisibleState();
      if (state.firstVisibleText.length > 0) {
        return state;
      }
    }
    hostElement.scrollTop = maxScrollTop;
    const bottomState = readVisibleState();
    if (bottomState.firstVisibleText.length > 0) {
      return bottomState;
    }
    hostElement.scrollTop = 0;
    return readVisibleState();
  });

test.describe("Feature: Workspace and runtime shells", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 90_000));
    await authenticateWithManagedKey(page);
  });

  test("Scenario: Given the avatar workbench fixed tabs When opening and closing the Add avatar draft Then My avatars and Add avatar preserve navigation ownership", async ({
    page,
  }) => {
    await navigateToSystem(page, "Avatars");
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });

    await activateTab(page.getByRole("tab", { name: "Add avatar", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/new\/[^/]+(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("avatar-create-route")).toBeVisible({ timeout: 15_000 });
    const firstDraftPath = new URL(page.url()).pathname;

    await activateTab(page.getByRole("tab", { name: "My avatars", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/catalog(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });

    await activateTab(page.getByRole("tab", { name: "Add avatar", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/new\/[^/]+(?:\?.*)?$/, { timeout: 15_000 });
    const secondDraftPath = new URL(page.url()).pathname;
    expect(secondDraftPath).toBe(firstDraftPath);

    await expect(page.getByRole("tab", { name: "My avatars", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Add avatar", exact: true })).toHaveCount(1);

    await clickStable(page.getByRole("button", { name: "Close tab", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/catalog(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Add avatar", exact: true })).toHaveCount(1);

    await activateTab(page.getByRole("tab", { name: "Add avatar", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/new\/[^/]+(?:\?.*)?$/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).not.toBe(firstDraftPath);
    await expect(page.getByTestId("avatar-create-route")).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given the workspace workbench When switching Explorer Rules and Private Then shared header and responsive page-content remain stable", async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");

    await navigateToSystem(page, "Workspaces");
    await openWorkspaceDetailFromStartPage(page);
    await expect(page.getByTestId("workspaces-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("workspace-content-header")).toBeVisible({ timeout: 15_000 });

    if (!mobile) {
      await expect(page.getByPlaceholder("Search loaded tree")).toBeVisible({ timeout: 15_000 });
    }

    await activateTab(page.getByRole("tab", { name: "rules", exact: true }));
    if (mobile) {
      await expect(page.getByRole("button", { name: "Add rule", exact: true })).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(
        page.getByText("Rule order maps directly to runtime grant priority for the selected avatar lens."),
      ).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByPlaceholder("Search rules")).toBeVisible({ timeout: 15_000 });
    }

    await activateTab(page.getByRole("tab", { name: "private", exact: true }));
    if (mobile) {
      await expect(page.getByRole("button", { name: "Create private asset", exact: true })).toBeVisible({
        timeout: 15_000,
      });
    } else {
      await expect(
        page.getByText("Avatar-private assets reuse the tree model without workspace permission badges."),
      ).toBeVisible({
        timeout: 15_000,
      });
    }

    await activateTab(page.getByRole("tab", { name: "explorer", exact: true }));
    if (mobile) {
      await expect(page.getByRole("combobox", { name: "Quick rule access mode", exact: true })).toBeVisible({
        timeout: 15_000,
      });
    } else {
      await expect(
        page.getByText("Folders toggle inline and loaded tree search stays inside the same hierarchy."),
      ).toBeVisible({
        timeout: 15_000,
      });
    }

    await expectPageContentLayout(page.getByTestId("workspaces-route"), mobile);
  });

  test("Scenario: Given workspace management is opened When one avatar mount is toggled and rules are reopened Then the dialog closes and the workbench returns to Rules intact", async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");
    await navigateToSystem(page, "Workspaces");
    await openWorkspaceDetailFromStartPage(page);

    const manageDialog = await openManageWorkspaceDialog(page);
    const initialActionRow = await findWorkspaceManageActionRow(manageDialog);
    const rowTestId = await initialActionRow.getAttribute("data-testid");
    if (!rowTestId) {
      throw new Error("workspace management row is missing data-testid");
    }
    const actionRow = manageDialog.getByTestId(rowTestId);
    const nickname = rowTestId.replace("workspace-manage-row-", "");
    const mountButton = actionRow.getByTestId(`workspace-manage-mount-${nickname}`);
    const unmountButton = actionRow.getByTestId(`workspace-manage-unmount-${nickname}`);
    const rowState = await resolveWorkspaceManageRowState(actionRow);

    if (rowState === "detached") {
      await mountButton.click({ force: true, timeout: 5_000 });
      await waitForWorkspaceManageRowState(actionRow, "mounted");
      await expect(actionRow).toContainText("Mounted", { timeout: 15_000 });
      await expect(unmountButton).toBeVisible({ timeout: 15_000 });
    } else {
      await unmountButton.click({ force: true, timeout: 5_000 });
      await waitForWorkspaceManageRowState(actionRow, "detached");
      await expect(actionRow).toContainText("Detached", { timeout: 15_000 });
      await expect(mountButton).toBeVisible({ timeout: 15_000 });
      await mountButton.click({ force: true, timeout: 5_000 });
      await waitForWorkspaceManageRowState(actionRow, "mounted");
      await expect(actionRow).toContainText("Mounted", { timeout: 15_000 });
    }

    await clickStable(actionRow.getByTestId(`workspace-manage-open-${nickname}`));
    await expect(manageDialog).toBeHidden({ timeout: 15_000 });
    if (mobile) {
      await expect(page.getByRole("button", { name: "Add rule", exact: true })).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(
        page.getByText("Rule order maps directly to runtime grant priority for the selected avatar lens."),
      ).toBeVisible({
        timeout: 15_000,
      });
    }
    await expect(page.getByTestId("workspaces-route")).toBeVisible({ timeout: 15_000 });
  });

  test("Scenario: Given the workspace CLI list When the user scrolls the left rail Then the list scrolls independently without moving the page shell", async ({
    page,
  }) => {
    await navigateToSystem(page, "Workspaces");
    await openWorkspaceDetailFromStartPage(page);
    await activateTab(page.getByRole("tab", { name: "cli", exact: true }));

    const listViewport = page.getByTestId("workspace-cli-list");
    await expect(listViewport).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => await listViewport.evaluate((element) => element.scrollHeight > element.clientHeight), {
        timeout: 15_000,
      })
      .toBeTruthy();

    const before = await listViewport.evaluate((element) => ({
      clientHeight: element.clientHeight,
      mainScrollTop: element.closest('[data-workbench-page-content-region="main"]')?.scrollTop ?? null,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      windowScrollY: window.scrollY,
    }));
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await listViewport.hover();
    await page.mouse.wheel(0, 600);

    await expect
      .poll(async () => await listViewport.evaluate((element) => element.scrollTop), { timeout: 5_000 })
      .toBeGreaterThan(before.scrollTop);
    await expect
      .poll(
        async () =>
          await listViewport.evaluate((element) => ({
            mainScrollTop: element.closest('[data-workbench-page-content-region="main"]')?.scrollTop ?? null,
            windowScrollY: window.scrollY,
          })),
        { timeout: 5_000 },
      )
      .toEqual({
        mainScrollTop: 0,
        windowScrollY: 0,
      });
    const after = await listViewport.evaluate((element) => element.scrollTop);
    expect(after).toBeGreaterThan(before.scrollTop);
  });

  test("Scenario: Given one root-workspace CLI command on a mounted public workspace When Run in shell opens the dialog Then the terminal transcript stays visible without a cwd-grant rejection", async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");
    await navigateToSystem(page, "Workspaces");
    await openWorkspaceDetailFromStartPage(page);
    await activateTab(page.getByRole("tab", { name: "cli", exact: true }));

    const rootCommand = page.locator('[data-workspace-cli-command-id="root-runtime-cli:attention commit"]');
    await expect(rootCommand).toBeVisible({ timeout: 15_000 });
    await clickStable(rootCommand);
    await expect(page.getByTestId("workspace-detail-drawer")).toContainText("attention commit", { timeout: 15_000 });
    await expect(page.getByText("attention commit --help", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("workspace-detail-drawer")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("workspace-detail-drawer").locator('[data-workbench-detail-drawer-region="summary"]'),
    ).toHaveCount(0);

    const openShellButton = page.getByTestId("workspace-cli-open-shell-button");
    await expect(openShellButton).toBeVisible({ timeout: 15_000 });
    await clickStable(openShellButton);

    const dialog = page.getByTestId("workspace-shell-dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const terminalHost = page.getByTestId("workspace-shell-terminal-host");
    await expect(terminalHost).toBeVisible({ timeout: 15_000 });
    const terminalFrame = page.getByTestId("workspace-shell-dialog-terminal-frame");
    await expect(terminalFrame).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => await readTerminalTranscript(terminalHost), { timeout: 15_000 })
      .toContain("default@root:");
    await expect
      .poll(async () => await readTerminalTranscript(terminalHost), { timeout: 15_000 })
      .toContain("command: `attention commit`");
    await expect
      .poll(async () => await readTerminalTranscript(terminalHost), { timeout: 15_000 })
      .not.toContain("outside explicit workspace grants");
    await expect
      .poll(async () => await readTerminalTranscript(terminalHost), { timeout: 15_000 })
      .not.toContain("/Users/");

    const readShellContainmentState = async () =>
      await terminalHost.evaluate((element) => {
        const hostElement = element as HTMLElement;
        const frameElement = hostElement.closest('[data-testid="workspace-shell-dialog-terminal-frame"]');
        const dialogElement = hostElement.closest('[data-testid="workspace-shell-dialog"]');
        if (!(frameElement instanceof HTMLElement) || !(dialogElement instanceof HTMLElement)) {
          return null;
        }
        const hostBox = hostElement.getBoundingClientRect();
        const frameBox = frameElement.getBoundingClientRect();
        const dialogBox = dialogElement.getBoundingClientRect();
        const hostStyle = getComputedStyle(hostElement);
        return {
          frameWithinDialog:
            frameBox.left >= dialogBox.left - 1 &&
            frameBox.right <= dialogBox.right + 1 &&
            frameBox.top >= dialogBox.top - 1 &&
            frameBox.bottom <= dialogBox.bottom + 1,
          hostBottomGap: Math.abs(Math.round(frameBox.bottom - hostBox.bottom)),
          hostFlushesFrameBottom: Math.abs(hostBox.bottom - frameBox.bottom) <= 1,
          hostPaddingBottom: hostStyle.paddingBottom,
          hostWithinFrame:
            hostBox.left >= frameBox.left - 1 &&
            hostBox.right <= frameBox.right + 1 &&
            hostBox.top >= frameBox.top - 1 &&
            hostBox.bottom <= frameBox.bottom + 1,
        };
      });
    await expect.poll(readShellContainmentState, { timeout: 5_000 }).toEqual({
      frameWithinDialog: true,
      hostBottomGap: 0,
      hostFlushesFrameBottom: true,
      hostPaddingBottom: "0px",
      hostWithinFrame: true,
    });

    await expect
      .poll(
        async () => {
          const state = await readTerminalScrollState(terminalHost);
          return state.scrollHeight > state.clientHeight;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    await terminalHost.evaluate((element) => {
      const hostElement = element as HTMLElement;
      hostElement.scrollTop = 0;
    });
    await expect
      .poll(async () => await readTerminalVisibleText(terminalHost), { timeout: 5_000 })
      .toContain("attention commit --help");

    await terminalHost.click();
    await page.keyboard.type(LONG_SCROLLBACK_COMMAND);
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => await readTerminalTranscript(terminalHost), { timeout: 15_000 })
      .toContain(LONG_SCROLLBACK_LAST_LINE);

    await expect
      .poll(
        async () => {
          const state = await readTerminalScrollState(terminalHost);
          return state.scrollHeight > state.clientHeight;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await terminalHost.evaluate((element) => {
      const hostElement = element as HTMLElement;
      hostElement.scrollTop = 0;
      hostElement.scrollLeft = 0;
    });
    await expect
      .poll(
        async () => {
          const state = await readTerminalScrollbackVisibility(terminalHost);
          return {
            frameOverflowY: state.frameOverflowY,
            frameScrollTop: state.frameScrollTop,
            hasReadableScrollbackText: state.firstVisibleText.length > 0,
            hasScrollbackRows: state.scrollbackRows > 0,
            hasVisibleScrollbackRows: state.visibleScrollbackRows > 0,
            hostOverflowY: state.hostOverflowY,
            hostScrollsInternally: state.hostScrollHeight > state.hostClientHeight,
          };
        },
        { timeout: 5_000 },
      )
      .toEqual({
        frameOverflowY: "hidden",
        frameScrollTop: 0,
        hasReadableScrollbackText: true,
        hasScrollbackRows: true,
        hasVisibleScrollbackRows: true,
        hostOverflowY: "auto",
        hostScrollsInternally: true,
      });
    await terminalHost.evaluate((element) => {
      const hostElement = element as HTMLElement;
      hostElement.scrollTop = 0;
    });
    const beforeWheelState = await readTerminalScrollState(terminalHost);
    await terminalHost.hover();
    await page.mouse.wheel(0, Math.max(120, Math.floor(beforeWheelState.clientHeight / 2)));
    await expect
      .poll(
        async () => {
          const state = await readTerminalScrollState(terminalHost);
          return {
            scrollTopAdvanced: state.scrollTop > beforeWheelState.scrollTop,
            windowScrollY: state.windowScrollY,
          };
        },
        { timeout: 5_000 },
      )
      .toEqual({
        scrollTopAdvanced: true,
        windowScrollY: beforeWheelState.windowScrollY,
      });

    if (mobile) {
      const mobileScrollState = await readTerminalScrollState(terminalHost);
      expect(mobileScrollState.overflowX).toBe("auto");
      expect(mobileScrollState.overflowY).toBe("auto");
      expect(mobileScrollState.clientWidth).toBeGreaterThan(0);
      expect(mobileScrollState.scrollWidth).toBeGreaterThan(mobileScrollState.clientWidth);
      expect(mobileScrollState.touchAction === "manipulation" || mobileScrollState.touchAction.includes("pan-x")).toBe(
        true,
      );
      await terminalHost.evaluate((element) => {
        const hostElement = element as HTMLElement;
        hostElement.scrollLeft = hostElement.scrollWidth - hostElement.clientWidth;
      });
      await expect
        .poll(
          async () => {
            const state = await readTerminalScrollState(terminalHost);
            return state.scrollLeft;
          },
          { timeout: 5_000 },
        )
        .toBeGreaterThan(0);
    }
  });

  test("Scenario: Given the avatars catalog When opening a stopped avatar Then launch actions remain available without a blocker gate", async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name.includes("mobile");
    await navigateToSystem(page, "Avatars");
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    if (mobile) {
      await clickStable(page.getByTestId("avatar-catalog-route").locator("button").first());
    }
    await expect(page.getByText("Selected avatar")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Open avatar", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Start avatar", exact: true })).toBeEnabled();
  });
});
