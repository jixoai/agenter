import path from "node:path";

import type { Page } from "playwright";

import { importPlaywright, resolveReviewUrl, resolveScreenshotDir } from "./review-screenshot-utils";

const baseUrl = resolveReviewUrl("http://127.0.0.1:4295/");
const outputDir = resolveScreenshotDir(".screenshot/after/iteration-current");

const { chromium, devices } = await importPlaywright();

const browser = await chromium.launch({ headless: true });

const openRoomChat = async (page: Page): Promise<void> => {
  const editor = page.locator("[data-testid='web-chat-draft-editor']").first();
  if (await editor.isVisible().catch(() => false)) {
    await page.waitForFunction(() => {
      const transcriptShell = document.querySelector('[part="transcript-shell"]');
      return transcriptShell instanceof HTMLElement && transcriptShell.dataset.initialLatestPending !== "true";
    });
    return;
  }
  const roomConversation = page.locator('[data-review-conversation-id^="room:"]').first();
  await roomConversation.waitFor({ state: "visible" });
  await roomConversation.click();
  await editor.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const transcriptShell = document.querySelector('[part="transcript-shell"]');
    return transcriptShell instanceof HTMLElement && transcriptShell.dataset.initialLatestPending !== "true";
  });
};

const locateTranscriptMessage = async (page: Page, pattern: string): Promise<import("playwright").Locator> => {
  await openRoomChat(page);
  const transcriptShell = page.locator('[part="transcript-shell"]').first();
  const messageCard = page
    .locator('.row .message-card')
    .filter({ hasText: pattern })
    .first();
  if (await messageCard.isVisible().catch(() => false)) {
    return messageCard;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await transcriptShell.evaluate((element) => {
      element.scrollBy({ top: -Math.max(240, element.clientHeight * 0.65), behavior: "instant" });
    });
    await page.waitForTimeout(140);
    if (await messageCard.isVisible().catch(() => false)) {
      return messageCard;
    }
  }
  throw new Error(`Unable to locate transcript message containing "${pattern}"`);
};

const byAriaLabel = (part: "message-resource-token" | "resource-card-hitbox", label: string): string =>
  `[part="${part}"][aria-label=${JSON.stringify(label)}]`;

const locateResourceEntrypoint = async (
  page: Page,
  label: string,
  entrypoint: "token" | "tile",
): Promise<import("playwright").Locator> => {
  await openRoomChat(page);
  const transcriptShell = page.locator('[part="transcript-shell"]').first();
  const selector =
    entrypoint === "token"
      ? byAriaLabel("message-resource-token", label)
      : byAriaLabel("resource-card-hitbox", label);
  const target = page.locator(selector).first();
  if (await target.isVisible().catch(() => false)) {
    return target;
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await transcriptShell.evaluate((element) => {
      element.scrollBy({ top: -Math.max(260, element.clientHeight * 0.7), behavior: "instant" });
    });
    await page.waitForTimeout(160);
    if (await target.isVisible().catch(() => false)) {
      return target;
    }
  }
  throw new Error(`Unable to locate ${entrypoint} resource entrypoint labelled "${label}"`);
};

const captureOnFreshPage = async (
  targetPath: string,
  action: (page: Page) => Promise<void>,
): Promise<void> => {
  const context = await browser.newContext({
    ...devices["iPhone 14"],
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await action(page);
  await page.waitForTimeout(350);
  await page.screenshot({ path: targetPath, fullPage: false });
  await context.close();
};

const resourcePreviewPath = path.join(outputDir, "resource-preview.png");
const sourcePopupPath = path.join(outputDir, "source-popup.png");
const commentPopupPath = path.join(outputDir, "comment-popup.png");
const selectionActionsPath = path.join(outputDir, "selection-actions.png");
const messageActionsPath = path.join(outputDir, "message-actions.png");
const tokenTriggeredPath = path.join(outputDir, "token-triggered-resource.png");
const composerUploadPath = path.join(outputDir, "composer-upload.png");
const composerToolSheetPath = path.join(outputDir, "composer-tool-sheet.png");
const helpAsciiPath = path.join(outputDir, "help-completion-ascii.png");
const helpFullwidthPath = path.join(outputDir, "help-completion-fullwidth.png");

try {
  await captureOnFreshPage(tokenTriggeredPath, async (page) => {
    const imageToken = await locateResourceEntrypoint(page, "Open image resource Image 1", "token");
    await imageToken.click();
    await page.locator("[part='resource-preview-layer']").first().waitFor({ state: "visible" });
  });

  await captureOnFreshPage(resourcePreviewPath, async (page) => {
    const fileTile = await locateResourceEntrypoint(page, "Open file resource File 2", "tile");
    await fileTile.click();
    await page.locator("[part='resource-preview-layer']").first().waitFor({ state: "visible" });
  });

  await captureOnFreshPage(sourcePopupPath, async (page) => {
    const sourceCard = await locateTranscriptMessage(page, "I grouped the north entry items here before");
    await sourceCard.dblclick();
    await page.locator(".message-source-page-content, .message-source-layer").first().waitFor({ state: "visible" });
  });

  await captureOnFreshPage(selectionActionsPath, async (page) => {
    const sourceCard = await locateTranscriptMessage(page, "I grouped the north entry items here before");
    await sourceCard.dblclick();
    await page.locator(".message-source-page-content, .message-source-layer").first().waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Actions" }).last().click();
    await page
      .locator(".actions-modal.modal-in, .popover.modal-in, .selection-action-surface")
      .first()
      .waitFor({ state: "visible" });
  });

  await captureOnFreshPage(commentPopupPath, async (page) => {
    const sourceCard = await locateTranscriptMessage(page, "I grouped the north entry items here before");
    await sourceCard.dblclick();
    await page.locator(".message-source-page-content, .message-source-layer").first().waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Comment" }).last().click();
    await page.locator("[part='comment-anchor-badge']").first().waitFor({ state: "visible" });
    await page
      .locator(".message-source-comment-editor-sheet.modal-in textarea, .message-source-comment-editor-inline textarea")
      .first()
      .waitFor({ state: "visible" });
  });

  await captureOnFreshPage(messageActionsPath, async (page) => {
    await openRoomChat(page);
    const latestMessage = page
      .locator('.row[data-message-author="viewer"] .message-card')
      .filter({ hasText: "Received. I will send the wrap-up after dinner" })
      .first();
    await latestMessage.waitFor({ state: "visible" });
    await latestMessage.getByLabel("Message actions").click();
    await page
      .locator(
        ".actions-modal.modal-in, .sheet-modal.modal-in, .popover.modal-in, .message-actions-popover, .message-actions-context-popover-surface",
      )
      .first()
      .waitFor({
        state: "visible",
      });
  });

  await captureOnFreshPage(composerUploadPath, async (page) => {
    await openRoomChat(page);
    const fileInput = page.locator("input.composer-file-input").first();
    await fileInput.setInputFiles({
      name: "src-img.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pQdVSEAAAAASUVORK5CYII=", "base64"),
    });
    await page.locator(".pending-resource-shelf article.resource-card").first().waitFor({ state: "visible" });
  });

  await captureOnFreshPage(composerToolSheetPath, async (page) => {
    await openRoomChat(page);
    const toolsTrigger = page.locator(".composer-action-link[aria-label='Open message tools']").first();
    await toolsTrigger.waitFor({ state: "visible" });
    await toolsTrigger.click();
    await page.locator(".composer-tool-sheet.messagebar-sheet").first().waitFor({ state: "visible" });
  });

  await captureOnFreshPage(helpAsciiPath, async (page) => {
    await openRoomChat(page);
    const editor = page.getByTestId("web-chat-draft-editor").first();
    await editor.click();
    await page.keyboard.type("?scr");
    await page.locator(".cm-tooltip-autocomplete").first().waitFor({ state: "visible" });
  });

  await captureOnFreshPage(helpFullwidthPath, async (page) => {
    await openRoomChat(page);
    const editor = page.getByTestId("web-chat-draft-editor").first();
    await editor.click();
    await page.keyboard.type("？scr");
    await page.locator(".cm-tooltip-autocomplete").first().waitFor({ state: "visible" });
  });

  console.log(resourcePreviewPath);
  console.log(sourcePopupPath);
  console.log(commentPopupPath);
  console.log(selectionActionsPath);
  console.log(messageActionsPath);
  console.log(tokenTriggeredPath);
  console.log(composerUploadPath);
  console.log(composerToolSheetPath);
  console.log(helpAsciiPath);
  console.log(helpFullwidthPath);
} finally {
  await browser.close();
}
