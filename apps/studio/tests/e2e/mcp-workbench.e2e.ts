import { createAgenterClient } from "@agenter/client-sdk";
import { expect, test, type Locator, type Page } from "@playwright/test";

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

const authenticateWithDaemon = async (page: Page): Promise<ReturnType<typeof createAgenterClient>> => {
  const client = createAgenterClient({ wsUrl: E2E_WS_URL });
  const autoLogin = await client.trpc.auth.autoLogin.mutate();
  if (!autoLogin.ok) {
    client.close();
    throw new Error(`expected daemon auto login, got ${autoLogin.reason}: ${autoLogin.message}`);
  }
  client.setAuthToken(autoLogin.session.token);
  await page.addInitScript(
    ({ key, token }) => {
      window.localStorage.setItem(key, JSON.stringify({ token }));
    },
    { key: AUTH_SESSION_STORAGE_KEY, token: autoLogin.session.token },
  );
  return client;
};

const navigateToMcp = async (page: Page): Promise<void> => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("admin-route")).toBeVisible({ timeout: 60_000 });

  let mcpLink = page.getByRole("link", { name: "MCP" }).first();
  if (!(await mcpLink.isVisible().catch(() => false))) {
    const toggleSidebarButton = page.getByRole("button", { name: /Toggle (application navigation|Sidebar)/i });
    await expect(toggleSidebarButton).toBeVisible({ timeout: 15_000 });
    await clickStable(toggleSidebarButton);
    mcpLink = page.getByRole("link", { name: "MCP" }).first();
  }

  await clickStable(mcpLink);
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  if (await sidebarDialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
  }
  await expect(page).toHaveURL(/\/mcp(?:\?.*)?$/, { timeout: 15_000 });
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  await expect
    .poll(async () => await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
};

test.describe("Feature: MCP workbench route smoke", () => {
  test("Scenario: Given a running AvatarRuntime When opening MCP through app navigation Then desktop and iPhone layouts expose List New global-only and exact-project projections", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 120_000));
    const client = await authenticateWithDaemon(page);
    const suffix = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const sessionName = `mcp-smoke-${suffix}`;
    let createdSessionId: string | null = null;

    try {
      const created = await client.trpc.session.create.mutate({
        cwd: process.cwd(),
        name: sessionName,
        autoStart: true,
      });
      createdSessionId = created.session.id;
      await client.trpc.mcp.add.mutate({
        sessionId: createdSessionId,
        name: "filesystem",
        title: "Filesystem",
        description: "Project-scoped file tools.",
        transport: {
          kind: "stdio",
          command: "bunx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
        },
      });

      await navigateToMcp(page);
      const route = page.getByTestId("mcp-route");
      await expect(route).toBeVisible({ timeout: 30_000 });
      await expect(route.getByText("Runtime authority", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("mcp-no-runtime-state")).toHaveCount(0, { timeout: 30_000 });
      await expect(route.getByText("Global registry", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(route.getByText("Exact-project projection", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(route.getByText("Filesystem", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      if (testInfo.project.name === "desktop-chromium") {
        await expect(route.getByText("Latest fact", { exact: true })).toBeVisible({ timeout: 15_000 });
      }
      await expectNoHorizontalOverflow(page);

      await clickStable(page.getByRole("button", { name: "Global-only" }));
      await expect(page.getByText("Global-only projection", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expectNoHorizontalOverflow(page);

      await clickStable(page.getByRole("button", { name: "Exact project" }));
      await expect(route.getByText("Exact-project projection", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

      const mcpSections = page.getByRole("navigation", { name: "MCP sections" });
      await expect(mcpSections).toBeVisible({ timeout: 15_000 });
      await clickStable(mcpSections.locator('[data-workbench-page-tab="new"]').first());
      await expect(page.getByTestId("mcp-new-global-form")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("01 Global config", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("02 Project availability", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("03 Project runtime", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Start after install", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expectNoHorizontalOverflow(page);
    } finally {
      if (createdSessionId) {
        await client.trpc.session.delete.mutate({ sessionId: createdSessionId }).catch(() => undefined);
      }
      client.close();
    }
  });
});
