import { expect, test, type Locator, type Page } from "@playwright/test";

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
  attempts = 3,
): Promise<void> => {
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
  await activateUntil(
    tab,
    async () => ((await tab.getAttribute("aria-selected")) ?? "false") === "true",
    2,
  );
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
};

const navigateToSystem = async (
  page: Page,
  label: "Avatars" | "Workspaces",
): Promise<void> => {
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
    await expect
      .poll(async () => await sidebarDialog.isVisible().catch(() => false), { timeout: 2_000 })
      .toBeFalsy();
  }
  await expect(page).toHaveURL(new RegExp(`${targetPath}(?:$|/.*|\\?.*)`), { timeout: 15_000 });
};

const waitForWorkspaceStartReady = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => {
      const itemCount = await page
        .locator("[data-workspace-start-item]")
        .count()
        .catch(() => 0);
      return itemCount > 0;
    }, { timeout: 15_000 })
    .toBeTruthy();
};

const openWorkspaceDetailFromStartPage = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("workspace-start-route")).toBeVisible({ timeout: 15_000 });
  await waitForWorkspaceStartReady(page);
  const firstOpenLink = page.locator("[data-workspace-start-open]").first();
  const href = await firstOpenLink.getAttribute("href");
  await clickStable(firstOpenLink);
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

const expectPageContentLayout = async (root: Locator, mobile: boolean): Promise<void> => {
  const main = root.locator('[data-workbench-page-content-region="main"]').first();
  const bottom = root.locator('[data-workbench-page-content-region="bottom"]').first();
  const drawer = root.locator('[data-workbench-page-content-region="drawer"]').first();

  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(bottom).toBeVisible({ timeout: 15_000 });
  await expect(drawer).toBeVisible({ timeout: 15_000 });

  const mainBox = await main.boundingBox();
  const bottomBox = await bottom.boundingBox();
  const drawerBox = await drawer.boundingBox();

  expect(mainBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();
  expect(drawerBox).not.toBeNull();

  if (!mainBox || !bottomBox || !drawerBox) {
    return;
  }

  if (mobile) {
    expect(drawerBox.y).toBeGreaterThan(bottomBox.y);
    expect(Math.abs(drawerBox.x - mainBox.x)).toBeLessThan(24);
    return;
  }

  expect(drawerBox.x).toBeGreaterThan(mainBox.x);
  expect(drawerBox.y).toBeLessThanOrEqual(bottomBox.y + 8);
};

test.describe("Feature: Workspace and runtime shells", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 90_000));
    await authenticateWithManagedKey(page);
  });

  test("Scenario: Given the avatars catalog stays fixed When opening and closing multiple new-avatar drafts Then browser-style tabs preserve the catalog and surviving drafts", async ({
    page,
  }) => {
    await navigateToSystem(page, "Avatars");
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });

    await clickStable(page.getByRole("link", { name: "New avatar", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/new\/[^/]+(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("avatar-create-route")).toBeVisible({ timeout: 15_000 });
    const firstDraftPath = new URL(page.url()).pathname;

    await activateTab(page.getByRole("tab", { name: "Catalog", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/catalog(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    await clickStable(page.getByRole("link", { name: "New avatar tab", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/new\/[^/]+(?:\?.*)?$/, { timeout: 15_000 });
    const secondDraftPath = new URL(page.url()).pathname;
    expect(secondDraftPath).not.toBe(firstDraftPath);

    await expect(page.getByRole("tab", { name: "Catalog", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "New avatar", exact: true })).toHaveCount(2);

    await clickStable(page.getByRole("button", { name: "Close draft", exact: true }));
    await expect(page).toHaveURL(/\/avatars\/catalog(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "New avatar", exact: true })).toHaveCount(1);

    await activateTab(page.getByRole("tab", { name: "New avatar", exact: true }).first());
    await expect(page).toHaveURL(new RegExp(`${firstDraftPath}(?:\\?.*)?$`), { timeout: 15_000 });
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

    await clickStable(page.getByRole("button", { name: "rules", exact: true }));
    await expect(page.getByText("Rule order maps directly to runtime grant priority for the selected avatar lens.")).toBeVisible({
      timeout: 15_000,
    });
    if (!mobile) {
      await expect(page.getByPlaceholder("Search rules")).toBeVisible({ timeout: 15_000 });
    }

    await clickStable(page.getByRole("button", { name: "private", exact: true }));
    await expect(page.getByText("Avatar-private assets reuse the tree model without workspace permission badges.")).toBeVisible({
      timeout: 15_000,
    });

    await clickStable(page.getByRole("button", { name: "explorer", exact: true }));
    await expect(page.getByText("Folders toggle inline and loaded tree search stays inside the same hierarchy.")).toBeVisible({
      timeout: 15_000,
    });

    await expectPageContentLayout(page.getByTestId("workspaces-route"), mobile);
  });

  test("Scenario: Given runtime launch is backend-blocked When opening the avatars catalog Then launch actions stay disabled and the blocker notice remains visible", async ({
    page,
  }) => {
    await navigateToSystem(page, "Avatars");
    await expect(page.getByTestId("avatar-catalog-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("avatar-runtime-blocker")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Open runtime" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Start runtime" })).toBeDisabled();
  });
});
