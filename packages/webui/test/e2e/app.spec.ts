import { readFileSync } from "node:fs";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { E2E_FIXTURE_PATH } from "./fixture-path";

interface E2EFixture {
  workspacePath: string;
  attachmentPath: string;
  mockReply: string;
  modelMode?: "mock" | "real";
  historySessionId: string;
  historySessionName: string;
  historyTurns: number;
}

const assistantTimeoutMs = (fixture: E2EFixture): number => (fixture.modelMode === "real" ? 120_000 : 20_000);

const loadFixture = (): E2EFixture => JSON.parse(readFileSync(E2E_FIXTURE_PATH, "utf8")) as E2EFixture;
const isMobileProject = (testInfo: TestInfo): boolean => testInfo.project.name === "mobile-iphone14";
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactTextPattern = (value: string): RegExp => new RegExp(`^${escapeRegExp(value)}$`);
const sessionChatsRoutePattern = /\/session\/[^/]+\/chats(?:\?|$)/;
const articleByExactText = (page: Page, text: string) =>
  page.getByRole("article").filter({ has: page.getByText(exactTextPattern(text)) }).first();
const waitForAssistantArticle = async (page: Page, fixture: E2EFixture, text?: string) => {
  if (fixture.modelMode !== "real" && text) {
    const article = articleByExactText(page, text);
    await expect(article).toBeVisible({ timeout: assistantTimeoutMs(fixture) });
    return article;
  }
  const articles = page.getByRole("article");
  await expect
    .poll(async () => await articles.count(), {
      timeout: assistantTimeoutMs(fixture),
      message: "expected chat transcript to contain at least one visible article",
    })
    .toBeGreaterThan(0);
  return articles.last();
};

const expectArticleCountAtLeast = async (page: Page, fixture: E2EFixture, minimum: number) => {
  const articles = page.getByRole("article");
  await expect
    .poll(async () => await articles.count(), {
      timeout: assistantTimeoutMs(fixture),
      message: `expected at least ${minimum} visible chat articles`,
    })
    .toBeGreaterThanOrEqual(minimum);
};

const openNavigationSheet = async (page: Page) => {
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(dialog).toBeVisible();
  return dialog;
};

const switchToChatChannel = async (
  page: Page,
  input: {
    title: string;
    chatId: string;
    visibleTexts?: string[];
    hiddenTexts?: string[];
  },
) => {
  const channelTabs = page.getByRole("tablist", { name: "Rooms" });
  const tab = channelTabs.getByRole("tab", { name: new RegExp(`^${escapeRegExp(input.title)}$`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("message-channel-metadata-trigger").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(input.chatId);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(dialog).toBeHidden();

  const viewport = page.getByTestId("web-chat-scroll-viewport");
  for (const text of input.visibleTexts ?? []) {
    await expect(viewport.getByText(exactTextPattern(text)).first()).toBeVisible({ timeout: 20_000 });
  }
  for (const text of input.hiddenTexts ?? []) {
    await expect(viewport.getByText(exactTextPattern(text))).toHaveCount(0);
  }
};

const sendChatMessage = async (page: Page, text: string) => {
  const sendButton = page.getByTestId("composer-action-primary").last();
  const composer = sendButton.locator("xpath=ancestor::section[1]");
  const editor = composer.locator(".cm-content[contenteditable='true']").last();

  await expect(sendButton).toBeVisible({ timeout: 20_000 });
  await editor.click();
  await page.keyboard.type(text);
  await expect(sendButton).toBeEnabled({ timeout: 20_000 });
  await sendButton.click();
  await expect(page.getByText(exactTextPattern(text)).first()).toBeVisible({ timeout: 20_000 });
};

const waitForQuickStartReady = async (page: Page) => {
  const enterButton = page.getByRole("button", { name: "Enter", exact: true });
  await expect(enterButton).toBeEnabled({ timeout: 20_000 });
};

test.describe("Feature: Workspace-first browser shell", () => {
  test("Scenario: Given the seeded Quick Start workspace When the shell loads Then the browser shows the current workspace and composer affordances", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    const quickStartViewport = page.getByTestId("quickstart-scroll-viewport");
    const mobile = isMobileProject(testInfo);

    await page.goto("/");

    if (mobile) {
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
      const navigation = await openNavigationSheet(page);
      await expect(navigation.getByRole("button", { name: "Quick Start", exact: true })).toBeVisible();
      await expect(navigation.getByRole("button", { name: /^Workspaces/ })).toBeVisible();
      await page.getByRole("button", { name: "Close panel" }).click();
    } else {
      await expect(page.getByText("Workspace-first shell")).toBeVisible();
      await expect(page.getByRole("button", { name: "Quick Start", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Workspaces/ })).toBeVisible();
    }
    await expect(quickStartViewport.getByText("Workspace", { exact: true })).toBeVisible();
    await expect(quickStartViewport.getByRole("button", { name: "Change", exact: true })).toBeVisible();
    await expect(quickStartViewport.getByRole("button", { name: "Attach", exact: true })).toBeVisible();
    await expect(quickStartViewport.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  });

  test("Scenario: Given a fresh Quick Start request with an attachment When the first message is sent Then Chat stays conversation-first and Devtools opens attention-first inspection", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    testInfo.setTimeout(Math.max(testInfo.timeout, assistantTimeoutMs(fixture) + 30_000));
    const firstPrompt = `Reply with exactly ${fixture.mockReply}`;
    const quickStartViewport = page.getByTestId("quickstart-scroll-viewport");
    const mobile = isMobileProject(testInfo);

    await page.goto("/");
    await waitForQuickStartReady(page);

    await page.locator(".cm-content").first().click();
    await page.keyboard.type(firstPrompt);
    await page.locator('input[type="file"]').setInputFiles(fixture.attachmentPath);

    await expect(page.getByText("Pending attachments")).toBeVisible();
    await expect(page.getByText("notes.txt")).toBeVisible();

    await expect(quickStartViewport.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
    await quickStartViewport.getByRole("button", { name: "Start", exact: true }).click();

    await page.waitForURL(/\/session\/[^/]+\/chats/, { timeout: 20_000 });
    await expect(page.getByText("Loading rooms...")).toHaveCount(0, { timeout: 20_000 });
    const userMessage = articleByExactText(page, firstPrompt);
    if (fixture.modelMode !== "real") {
      await waitForAssistantArticle(page, fixture, fixture.mockReply);
    }

    await expect(userMessage).toBeVisible();
    await expect(userMessage.getByText("notes.txt")).toBeVisible();
    await expect(page.getByText("Technical records")).toHaveCount(0);
    await expect(page.getByTestId("message-channel-metadata-trigger")).toBeVisible();
    await expect(page.getByRole("button", { name: "New room" })).toBeVisible();

    const workspaceTabs = page.getByRole("tablist", { name: "Workspace routes" });
    await expect(workspaceTabs.getByRole("tab", { name: "Chats", exact: true })).toBeVisible();
    await expect(workspaceTabs.getByRole("tab", { name: "Terminals", exact: true })).toBeVisible();
    await workspaceTabs.getByRole("tab", { name: "Devtools", exact: true }).click();
    await page.waitForURL(/\/session\/[^/]+\/devtools/, { timeout: 20_000 });

    if (mobile) {
      const navigation = await openNavigationSheet(page);
      await expect(navigation.getByText("Running Sessions")).toBeVisible();
      await page.getByRole("button", { name: "Close panel" }).click();
    }

    await expect(workspaceTabs.getByRole("tab", { name: "Devtools", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Attention", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Attention", exact: true })).toBeVisible();
    await expect(page.getByText("ctx-chat-main").first()).toBeVisible();

    if (fixture.modelMode === "real") {
      return;
    }

    await page.getByRole("tab", { name: "Cycles", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Cycles", exact: true })).toBeVisible();
    const cycleButton = page.getByRole("button", { name: /Cycle 1 ·/ }).first();
    await expect(cycleButton).toBeVisible();

    if (mobile) {
      await cycleButton.click();
      const cycleDialog = page.getByRole("dialog", { name: /Cycle 1/i });
      await expect(cycleDialog).toBeVisible();
      await cycleDialog.getByRole("tab", { name: /Contexts/i }).click();
      await expect(cycleDialog.getByRole("heading", { name: "Context movement", exact: true })).toBeVisible();
      await cycleDialog.getByRole("tab", { name: /Effects/i }).click();
      await expect(cycleDialog.getByRole("heading", { name: "Hook outcomes", exact: true })).toBeVisible();
      await expect(cycleDialog.getByRole("heading", { name: "Delivered messages", exact: true })).toBeVisible();
      await expect(cycleDialog.getByText(exactTextPattern(fixture.mockReply)).first()).toBeVisible();
      await expect(cycleDialog.getByText("Technical records")).toHaveCount(0);
    } else {
      await page.getByRole("tab", { name: /Contexts/i }).click();
      await expect(page.getByRole("heading", { name: "Context movement", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: /Effects/i }).click();
      await expect(page.getByRole("heading", { name: "Hook outcomes", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Delivered messages", exact: true })).toBeVisible();
      await expect(page.getByText(exactTextPattern(fixture.mockReply)).first()).toBeVisible();
      await expect(page.getByText("Technical records")).toHaveCount(0);
    }
  });

  test("Scenario: Given a delivered assistant message When the user opens message actions Then Devtools opens the linked cycle instead of rendering raw attention activity inline", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    testInfo.setTimeout(Math.max(testInfo.timeout, assistantTimeoutMs(fixture) + 30_000));
    const prompt = `Reply with exactly ${fixture.mockReply}`;

    await page.goto("/");
    await waitForQuickStartReady(page);
    await page.locator(".cm-content").first().click();
    await page.keyboard.type(prompt);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole("button", { name: "Start", exact: true }).click();

    await page.waitForURL(sessionChatsRoutePattern, { timeout: 20_000 });
    const assistantMessage = await waitForAssistantArticle(page, fixture, fixture.mockReply);
    await assistantMessage.hover();
    await assistantMessage.getByLabel("Message actions").click();
    const viewInDevtools = page.getByRole("menuitem", { name: "View In Devtools" });
    await expect(viewInDevtools).toBeVisible();
    if (fixture.modelMode === "real") {
      const isDisabled = (await viewInDevtools.getAttribute("aria-disabled")) === "true";
      if (isDisabled) {
        await page.keyboard.press("Escape");
        await page.getByRole("tab", { name: "Devtools", exact: true }).click();
        await page.waitForURL(/\/session\/[^/]+\/devtools(?:\\?|$)/, { timeout: 20_000 });
        await expect(page.getByRole("heading", { name: "Attention", exact: true })).toBeVisible();
        await page.goBack();
        await page.waitForURL(sessionChatsRoutePattern, { timeout: 20_000 });
        await expect(page.getByText(exactTextPattern(prompt)).first()).toBeVisible();
        await page.goForward();
        await page.waitForURL(/\/session\/[^/]+\/devtools(?:\\?|$)/, { timeout: 20_000 });
        await expect(page.getByRole("heading", { name: "Attention", exact: true })).toBeVisible();
        return;
      }
    }
    await viewInDevtools.click();

    await page.waitForURL(/\/session\/[^/]+\/devtools\?.*cycleId=1/, { timeout: 20_000 });
    await page.getByRole("tab", { name: /Contexts/i }).click();
    await expect(page.getByText("Context movement")).toBeVisible();
    await page.getByRole("tab", { name: /Effects/i }).click();
    if (fixture.modelMode !== "real") {
      await expect(page.getByText(exactTextPattern(fixture.mockReply)).first()).toBeVisible();
    }

    await page.goBack();
    await page.waitForURL(sessionChatsRoutePattern, { timeout: 20_000 });
    await expect(page.getByRole("article")).toHaveCount(2, { timeout: assistantTimeoutMs(fixture) });
    await expect(page.getByText(exactTextPattern(prompt)).first()).toBeVisible();

    await page.goForward();
    await page.waitForURL(/\/session\/[^/]+\/devtools\?.*cycleId=1/, { timeout: 20_000 });
    await page.getByRole("tab", { name: /Contexts/i }).click();
    await expect(page.getByText("Context movement")).toBeVisible();
  });

  test("Scenario: Given an active chat channel When admin opens metadata disclosure Then tokenized transport metadata and grant controls stay available on desktop and mobile", async ({
    page,
  }) => {
    const fixture = loadFixture();
    const prompt = `Reply with exactly ${fixture.mockReply}`;

    await page.goto("/");
    await waitForQuickStartReady(page);
    await page.locator(".cm-content").first().click();
    await page.keyboard.type(prompt);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole("button", { name: "Start", exact: true }).click();

    await page.waitForURL(sessionChatsRoutePattern, { timeout: 20_000 });
    await expect(page.getByText(exactTextPattern(prompt)).first()).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("message-channel-metadata-trigger").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("?token=");

    const titleInput = dialog.getByLabel("Channel title");
    await titleInput.fill("Chat admin");
    await dialog.getByRole("button", { name: "Save channel" }).click();
    await expect(dialog.getByLabel("Channel title")).toHaveValue("Chat admin");

    await dialog.getByLabel("Grant label").fill("Viewer");
    await dialog.getByLabel("Grant participant").fill("user:gaubee");
    await dialog.getByRole("button", { name: "Issue token" }).click();
    await expect(dialog).toContainText("msgtok_");
    await expect(dialog).toContainText("Viewer");
  });

  test("Scenario: Given a seeded long-history session When Chat opens on desktop and mobile Then persisted turns stay visible and running-session navigation stays available", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    const mobile = isMobileProject(testInfo);
    const route = `/session/${encodeURIComponent(fixture.historySessionId)}/chats`;
    const latestPrompt = `History prompt ${fixture.historyTurns}: confirm the long persisted conversation turn ${fixture.historyTurns}.`;
    const firstPrompt = "History prompt 1: confirm the long persisted conversation turn 1.";

    await page.goto(route);
    await page.waitForURL(/\/session\/[^/]+\/chats/, { timeout: 20_000 });

    await expect(articleByExactText(page, latestPrompt)).toBeVisible();

    const viewport = page.getByTestId("web-chat-scroll-viewport");
    await expect(viewport).toBeVisible();
    const beforeScroll = await viewport.evaluate((element) => ({
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.clientHeight);

    await viewport.evaluate((element) => {
      element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - 240);
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const afterManualScroll = await viewport.evaluate((element) => element.scrollTop);
    expect(afterManualScroll).toBeGreaterThan(0);

    await viewport.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const firstTurnArticle = articleByExactText(page, firstPrompt);
    await expect(firstTurnArticle).toBeVisible();
    await expect(firstTurnArticle.getByRole("link", { name: "notes.txt" })).toBeVisible();

    await page.getByRole("tab", { name: "Devtools", exact: true }).click();
    await page.waitForURL(/\/session\/[^/]+\/devtools(?:\\?|$)/, { timeout: 20_000 });
    await page.getByRole("tab", { name: "Cycles", exact: true }).click();

    const cycleTimelineViewport = page.getByTestId("cycle-timeline-scroll-viewport");
    await expect(cycleTimelineViewport).toBeVisible();
    const cycleTimelineBeforeScroll = await cycleTimelineViewport.evaluate((element) => ({
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(cycleTimelineBeforeScroll.scrollHeight).toBeGreaterThan(cycleTimelineBeforeScroll.clientHeight);

    await cycleTimelineViewport.evaluate((element) => {
      element.scrollTop = 160;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const cycleTimelineAfterScroll = await cycleTimelineViewport.evaluate((element) => element.scrollTop);
    expect(cycleTimelineAfterScroll).toBeGreaterThan(0);

    if (mobile) {
      const navigation = await openNavigationSheet(page);
      await expect(navigation.getByText("Running Sessions")).toBeVisible();
      await expect(navigation.getByText(fixture.historySessionName).first()).toBeVisible();
      await page.getByRole("button", { name: "Close panel" }).click();
    } else {
      await expect(page.getByText("Running Sessions")).toBeVisible();
      await expect(page.getByText(fixture.historySessionName).first()).toBeVisible();
    }
  });

  test("Scenario: Given the lunch-relay story When the user switches between chat channels Then the WebUI preserves isolated transcripts for each step of the relay", async ({
    page,
  }, testInfo) => {
    const fixture = loadFixture();
    testInfo.setTimeout(fixture.modelMode === "real" ? 180_000 : 30_000);
    const originPrompt = "[lunch-main] ask gaubee what to eat for lunch. Reply with exactly: 稍等，我去问一下。";
    const originReply = "稍等，我去问一下。";
    const relayPrompt = "[lunch-relay] ask gaubee lunch. Reply with exactly: 中午吃蛋炒饭。";
    const relayReply = "中午吃蛋炒饭。";
    const finalPrompt = "[lunch-return] relay lunch answer to kzf. Reply with exactly: gaubee 说中午吃蛋炒饭。";
    const finalReply = "gaubee 说中午吃蛋炒饭。";

    await page.goto("/");
    await waitForQuickStartReady(page);
    await page.locator(".cm-content").first().click();
    await page.keyboard.type(originPrompt);
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.waitForURL(sessionChatsRoutePattern, { timeout: 20_000 });
    await expect(page.getByText(exactTextPattern(originPrompt)).first()).toBeVisible({ timeout: 20_000 });
    await waitForAssistantArticle(page, fixture, fixture.modelMode === "real" ? undefined : originReply);

    await expect(page.getByRole("tablist", { name: "Rooms" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New room" })).toBeVisible();

    await page.getByRole("button", { name: "New room" }).click();
    const createChatDialog = page.getByRole("dialog", { name: "Create room" });
    await expect(createChatDialog).toBeVisible({ timeout: 20_000 });
    await expect(createChatDialog.getByLabel("Title")).toHaveValue("Room 2");
    await createChatDialog.getByRole("button", { name: "Create room" }).click();
    await expect(page.getByRole("tablist", { name: "Rooms" }).getByRole("tab", { name: /^Room 2$/ })).toBeVisible({
      timeout: 20_000,
    });

    await switchToChatChannel(page, {
      title: "Room 2",
      chatId: "chat-chat-2",
    });
    await sendChatMessage(page, relayPrompt);
    await waitForAssistantArticle(page, fixture, fixture.modelMode === "real" ? undefined : relayReply);

    await switchToChatChannel(page, {
      title: "Room",
      chatId: "chat-main",
      visibleTexts: fixture.modelMode === "real" ? [originPrompt] : [originPrompt, originReply],
      hiddenTexts: [relayPrompt],
    });
    if (fixture.modelMode === "real") {
      await expectArticleCountAtLeast(page, fixture, 1);
    } else {
      await expect(page.getByRole("article")).toHaveCount(2, { timeout: assistantTimeoutMs(fixture) });
    }

    await switchToChatChannel(page, {
      title: "Room 2",
      chatId: "chat-chat-2",
      visibleTexts: fixture.modelMode === "real" ? [relayPrompt] : [relayPrompt, relayReply],
      hiddenTexts: fixture.modelMode === "real" ? [originPrompt] : [originPrompt, originReply],
    });
    if (fixture.modelMode === "real") {
      await expectArticleCountAtLeast(page, fixture, 1);
    } else {
      await expect(page.getByRole("article")).toHaveCount(2, { timeout: assistantTimeoutMs(fixture) });
    }

    await switchToChatChannel(page, {
      title: "Room",
      chatId: "chat-main",
      visibleTexts: fixture.modelMode === "real" ? [originPrompt] : [originPrompt, originReply],
      hiddenTexts: [relayPrompt],
    });
    await sendChatMessage(page, finalPrompt);
    await waitForAssistantArticle(page, fixture, fixture.modelMode === "real" ? undefined : finalReply);
    if (fixture.modelMode === "real") {
      await expectArticleCountAtLeast(page, fixture, 2);
    } else {
      await expect(page.getByRole("article")).toHaveCount(4, { timeout: assistantTimeoutMs(fixture) });
    }

    await switchToChatChannel(page, {
      title: "Room 2",
      chatId: "chat-chat-2",
      visibleTexts: fixture.modelMode === "real" ? [relayPrompt] : [relayPrompt, relayReply],
      hiddenTexts:
        fixture.modelMode === "real"
          ? [finalPrompt, originPrompt]
          : [finalPrompt, finalReply, originPrompt, originReply],
    });
    if (fixture.modelMode === "real") {
      await expectArticleCountAtLeast(page, fixture, 1);
    } else {
      await expect(page.getByRole("article")).toHaveCount(2, { timeout: assistantTimeoutMs(fixture) });
    }

    await page.getByRole("tab", { name: "Devtools", exact: true }).click();
    await page.waitForURL(/\/session\/[^/]+\/devtools(?:\\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Attention", exact: true })).toBeVisible();
    await expect(page.getByText("ctx-chat-main").first()).toBeVisible();
    await expect(page.getByText("ctx-chat-chat-2").first()).toBeVisible();
  });
});
