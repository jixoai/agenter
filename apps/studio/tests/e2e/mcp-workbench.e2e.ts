import { createAgenterClient } from "@agenter/client-sdk";
import { expect, test, type Locator, type Page } from "@playwright/test";

const AUTH_SESSION_STORAGE_KEY = "agenter:studio:auth-session";
const E2E_WS_URL = "ws://127.0.0.1:19190/trpc";
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    .poll(
      async () =>
        await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    )
    .toBeLessThanOrEqual(2);
};

const closeMcpDetailIfVisible = async (page: Page): Promise<void> => {
  const closeDetailButton = page.getByRole("button", { name: "Close detail" });
  if (!(await closeDetailButton.isVisible().catch(() => false))) {
    return;
  }
  await clickStable(closeDetailButton);
  await expect.poll(async () => await closeDetailButton.isVisible().catch(() => false), { timeout: 5_000 }).toBeFalsy();
};

test.describe("Feature: MCP workbench route smoke", () => {
  test("Scenario: Given an Avatar-owned MCP config without starting AvatarRuntime When opening MCP through app navigation Then configs stays cross-Avatar and avatars stays ownership-only", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 120_000));
    const client = await authenticateWithDaemon(page);
    const suffix = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const mcpName = `filesystem-${suffix}`;
    const projectPath = process.cwd();

    try {
      await client.trpc.mcp.add.mutate({
        avatarNickname: "default",
        name: mcpName,
        title: "Filesystem",
        description: "Project-scoped file tools.",
        transport: {
          kind: "stdio",
          command: "bunx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", projectPath],
        },
      });
      await client.trpc.mcp.enable.mutate({
        avatarNickname: "default",
        name: mcpName,
        projectPath,
      });

      await navigateToMcp(page);
      const route = page.getByTestId("mcp-route");
      await expect(route).toBeVisible({ timeout: 30_000 });
      await expect(route.getByLabel("Filter MCP configs")).toBeVisible({ timeout: 15_000 });
      await expect(route.getByText("Filesystem", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(route.getByTestId(`mcp-config-row-avatar-${mcpName}`)).toBeVisible({ timeout: 15_000 });
      await expect(route.getByText("Avatar authority", { exact: true })).toHaveCount(0);
      await expect(route.getByText("Last fact", { exact: true })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      await clickStable(route.getByRole("button", { name: /New config/ }).first());
      await expect(page.getByTestId("mcp-new-global-form")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("mcp-config-inspect")).toBeVisible({ timeout: 15_000 });
      await clickStable(page.getByRole("button", { name: "Code" }));
      await expect(page.getByTestId("mcp-config-code-textarea")).toBeVisible({ timeout: 15_000 });
      await closeMcpDetailIfVisible(page);

      await clickStable(route.getByRole("button", { name: /Filesystem/ }).first());
      await expect(page.getByTestId("mcp-config-detail")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("mcp-config-owner-readonly")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("mcp-config-inspect")).toBeVisible({ timeout: 15_000 });

      await closeMcpDetailIfVisible(page);

      const mcpSections = page.getByRole("navigation", { name: "MCP sections" });
      await expect(mcpSections).toBeVisible({ timeout: 15_000 });
      await clickStable(mcpSections.locator('[data-workbench-page-tab="avatars"]').first());
      await expect(page.getByTestId("mcp-avatar-overview")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Avatar ownership", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("mcp-avatar-profile-default")).toBeVisible({ timeout: 15_000 });
      const openAvatarDetailButton = page.getByRole("button", { name: "Open detail" });
      if (await openAvatarDetailButton.isVisible().catch(() => false)) {
        await clickStable(openAvatarDetailButton);
      }
      await expect(page.getByTestId("mcp-avatar-detail")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("mcp-avatar-detail-profile")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Configs", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Instances", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

      const avatarDetail = page.getByTestId("mcp-avatar-detail");
      await clickStable(avatarDetail.getByRole("button", { name: /Filesystem/ }).first());
      await expect(page.getByTestId("mcp-config-detail")).toBeVisible({ timeout: 15_000 });
      await closeMcpDetailIfVisible(page);

      await clickStable(
        page.getByRole("navigation", { name: "MCP sections" }).locator('[data-workbench-page-tab="avatars"]').first(),
      );
      const reopenAvatarDetailButton = page.getByRole("button", { name: "Open detail" });
      if (await reopenAvatarDetailButton.isVisible().catch(() => false)) {
        await clickStable(reopenAvatarDetailButton);
      }
      await expect(page.getByTestId("mcp-avatar-detail")).toBeVisible({ timeout: 15_000 });
      await clickStable(
        page
          .getByTestId("mcp-avatar-detail")
          .getByRole("button", {
            name: new RegExp(escapeRegExp(projectPath)),
          })
          .first(),
      );
      const selectedInstanceRow = page
        .getByTestId("mcp-config-detail")
        .locator('[data-testid="mcp-config-instance-row"][data-selected="true"]');
      await expect(selectedInstanceRow).toHaveCount(1);
      await expect(selectedInstanceRow).toContainText(projectPath);
      await expectNoHorizontalOverflow(page);
    } finally {
      await client.trpc.mcp.remove
        .mutate({ avatarNickname: "default", name: mcpName, stop: true })
        .catch(() => undefined);
      client.close();
    }
  });
});
