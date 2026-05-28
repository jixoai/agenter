import { writeFile } from "node:fs/promises";
import path from "node:path";

import { importPlaywright, resolveReviewUrl, resolveScreenshotDir } from "./review-screenshot-utils";

const baseUrl = resolveReviewUrl("http://127.0.0.1:4295/");
const outputDir = resolveScreenshotDir(".screenshot/after/review-flow-proof");

const { chromium, devices } = await importPlaywright();

const browser = await chromium.launch({ headless: true });
type ReviewPage = Awaited<ReturnType<typeof browser.newPage>>;

const proof = {
  peopleShellNavigation: false,
  contactRequestVisibility: false,
  mobileRootSearchbarVisible: false,
  mobileMeProfilesSearchHonest: false,
  mentionCompletion: false,
  resourceCompletion: false,
  uploadRailPreview: false,
  commentRoundtrip: false,
  commentEditorSheetStable: false,
  commentEditorSaveRightDelta: -1,
  commentEditorTextareaVisibleHeight: -1,
  inlineResourceTokensLightweight: false,
  roomEntryLatestPinned: false,
  roomEntryLatestBottomGap: -1,
  roomEntryLatestComposerGap: -1,
  roomEntryDistanceToLatest: -1,
  scrollToLatest: false,
  scrollToLatestVisualLatestPinned: false,
  scrollToLatestDistanceBefore: -1,
  scrollToLatestDistanceAfter: -1,
  scrollToLatestLatestBottomGapBefore: -1,
  scrollToLatestLatestBottomGapAfter: -1,
  scrollToLatestLatestComposerGapBefore: -1,
  scrollToLatestLatestComposerGapAfter: -1,
  scrollToLatestViewportFlexDirection: "",
  scrollToLatestContentFlexDirection: "",
  scrollToLatestContentJustifyContent: "",
  wideCompletionPosition: false,
  wideCompletionStartX: -1,
  wideCompletionPrefixedX: -1,
  wideCompletionDeltaX: -1,
  wideMessageActionsAnchored: false,
  wideMessageActionsMaxRightOverflow: -1,
  wideMessageActionsMaxTopOffset: -1,
  wideMessageActionsPopoverAligned: false,
  wideMessageActionsPopoverRightDelta: -1,
  wideMessageActionsPopoverGap: -1,
};

const verifyProof = (): void => {
  const failedChecks = Object.entries(proof)
    .filter(([, value]) => typeof value === "boolean" && value !== true)
    .map(([key]) => key);
  if (failedChecks.length === 0) {
    return;
  }
  throw new Error(
    `Review flow proof failed: ${failedChecks.join(", ")}. ` +
      `scrollToLatestDistanceBefore=${proof.scrollToLatestDistanceBefore}, ` +
      `scrollToLatestDistanceAfter=${proof.scrollToLatestDistanceAfter}, ` +
      `scrollToLatestLatestBottomGapAfter=${proof.scrollToLatestLatestBottomGapAfter}, ` +
      `scrollToLatestLatestComposerGapAfter=${proof.scrollToLatestLatestComposerGapAfter}, ` +
      `scrollToLatestViewportFlexDirection=${proof.scrollToLatestViewportFlexDirection}, ` +
      `scrollToLatestContentFlexDirection=${proof.scrollToLatestContentFlexDirection}, ` +
      `scrollToLatestContentJustifyContent=${proof.scrollToLatestContentJustifyContent}, ` +
      `wideCompletionDeltaX=${proof.wideCompletionDeltaX}, ` +
      `wideMessageActionsPopoverRightDelta=${proof.wideMessageActionsPopoverRightDelta}, ` +
      `commentEditorSaveRightDelta=${proof.commentEditorSaveRightDelta}, ` +
      `commentEditorTextareaVisibleHeight=${proof.commentEditorTextareaVisibleHeight}, ` +
      `roomEntryDistanceToLatest=${proof.roomEntryDistanceToLatest}, ` +
      `roomEntryLatestBottomGap=${proof.roomEntryLatestBottomGap}, ` +
      `roomEntryLatestComposerGap=${proof.roomEntryLatestComposerGap}`,
  );
};

type RootTab = "messages" | "contacts" | "me";
type ShellMode = "desktop" | "mobile";

const rootTabSelector = (tab: RootTab): string => `#review-shell-tab-${tab}`;
const visibleRootTabSelector = (tab: RootTab): string => `${rootTabSelector(tab)}.tab-active`;
const visibleRootTab = (page: ReviewPage, tab: RootTab) => page.locator(visibleRootTabSelector(tab)).first();
const rootDesktopNav = (page: ReviewPage, tab: RootTab) => page.locator(`[data-review-root-nav="${tab}"]`).first();
const rootMobileTabLink = (page: ReviewPage, tab: RootTab) => page.locator(`.toolbar.tabbar a[data-tab="${rootTabSelector(tab)}"]`).first();
const reviewRoomConversationItem = (page: ReviewPage) => page.locator('[data-review-conversation-id^="room:"]').first();
const reviewContactItem = (page: ReviewPage, sourceId: string) =>
  page.locator(`[data-review-contact-key*="::${sourceId}::"]`).first();
const reviewSourceItem = (page: ReviewPage, sourceId: string) => page.locator(`[data-review-source-id="${sourceId}"]`).first();
const reviewMeAction = (page: ReviewPage, action: string) => page.locator(`[data-review-me-action="${action}"]`).first();
const reviewSourceAction = (page: ReviewPage, action: string) => page.locator(`[data-review-source-action="${action}"]`).first();
const waitForMobileRootTab = async (page: ReviewPage, tab: RootTab): Promise<void> => {
  const rootTab = visibleRootTab(page, tab);
  await rootTab.waitFor({ state: "visible" });
};

const resolveShellMode = async (page: ReviewPage): Promise<ShellMode> =>
  (await rootDesktopNav(page, "messages").isVisible().catch(() => false)) ? "desktop" : "mobile";

const clickShellTab = async (page: ReviewPage, mode: ShellMode, tab: RootTab): Promise<void> => {
  if (mode === "desktop") {
    await rootDesktopNav(page, tab).click();
    return;
  }
  await rootMobileTabLink(page, tab).click();
  await waitForMobileRootTab(page, tab);
};

const clickBack = async (page: ReviewPage): Promise<void> => {
  await page
    .locator('.page[data-name="review-shell-child"] .navbar .left .link.back, .page[data-name="review-shell-child"] .navbar .left .link[aria-label="Back"]')
    .first()
    .click();
};

const clickContactListItem = async (page: ReviewPage): Promise<void> => {
  await reviewContactItem(page, "main-office").click();
};

const clickSourceManagementItem = async (page: ReviewPage): Promise<void> => {
  await reviewMeAction(page, "source-directory").click();
};

const clickSourceListItem = async (page: ReviewPage): Promise<void> => {
  await reviewSourceItem(page, "remote-lab").click();
};

const clickConversationItem = async (page: ReviewPage): Promise<void> => {
  await reviewRoomConversationItem(page).click();
};

const settleTransientLayers = async (page: ReviewPage): Promise<void> => {
  const closePreviewButton = page.getByLabel("Close preview").last();
  if (await closePreviewButton.isVisible().catch(() => false)) {
    await closePreviewButton.click({ force: true, timeout: 2_000 }).catch(() => {});
  }
  const closeSourceButton = page.locator("[aria-label='Close source']").first();
  if (await closeSourceButton.isVisible().catch(() => false)) {
    await closeSourceButton.click({ force: true, timeout: 2_000 }).catch(() => {});
  }
  await page.waitForFunction(() => {
    const modalSelectors = [
      ".popup.modal-in",
      ".sheet-modal.modal-in",
      ".popover.modal-in",
      ".actions-modal.modal-in",
    ];
    if (modalSelectors.some((selector) => document.querySelector(selector))) {
      return false;
    }
    const visibleBackdrop = [...document.querySelectorAll(".popup-backdrop, .sheet-backdrop, .popover-backdrop, .actions-backdrop")].some(
      (element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          style.pointerEvents !== "none"
        );
      },
    );
    return !visibleBackdrop;
  });
};

const waitForTransientToast = async (page: ReviewPage): Promise<void> => {
  const visibleToast = page.locator(".toast.modal-in, .toast.toast-in").last();
  if (!(await visibleToast.isVisible().catch(() => false))) {
    return;
  }
  await visibleToast.waitFor({ state: "hidden", timeout: 4_000 }).catch(async () => {
    await page.waitForFunction(() => {
      return ![...document.querySelectorAll(".toast")].some((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      });
    });
  });
};

const openRoomChat = async (page: ReviewPage): Promise<void> => {
  const editor = page.locator("[data-testid='web-chat-draft-editor']").first();
  if (!(await editor.isVisible().catch(() => false))) {
    const mode = await resolveShellMode(page);
    await clickShellTab(page, mode, "messages");
    await reviewRoomConversationItem(page).waitFor({ state: "visible" });
    await clickConversationItem(page);
  }
  await editor.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const transcriptShell = document.querySelector('[part="transcript-shell"]');
    if (!(transcriptShell instanceof HTMLElement)) {
      return false;
    }
    return transcriptShell.dataset.initialLatestPending !== "true";
  });
};

const verifyPeopleShellNavigation = async (page: ReviewPage): Promise<void> => {
  const mode = await resolveShellMode(page);
  await reviewRoomConversationItem(page).waitFor({ state: "visible" });
  if (mode === "mobile") {
    const mobileSearchbarVisible = await page.evaluate(() => {
      const searchbar = document.querySelector(".page[data-name='review-shell-home'] .navbar .subnavbar .searchbar");
      if (!(searchbar instanceof HTMLElement)) {
        return false;
      }
      const rect = searchbar.getBoundingClientRect();
      return rect.width >= 240 && rect.height >= 40 && rect.y >= 0;
    });
    proof.mobileRootSearchbarVisible = mobileSearchbarVisible;
  } else {
    proof.mobileRootSearchbarVisible = true;
  }
  await clickShellTab(page, mode, "contacts");
  await reviewContactItem(page, "main-office").waitFor({ state: "visible" });
  const contactRequestText = (await visibleRootTab(page, "contacts").textContent()) ?? "";
  const contactRequestVisibility =
    /Pending requests\s+2/u.test(contactRequestText) &&
    contactRequestText.includes("Requests") &&
    contactRequestText.includes("Mira") &&
    contactRequestText.includes("Nora") &&
    contactRequestText.includes("Remote lab · inbound · pending") &&
    contactRequestText.includes("Main office · outbound · pending");
  proof.contactRequestVisibility = contactRequestVisibility;
  await clickContactListItem(page);
  await page.getByText("Contact Details").first().waitFor({ state: "visible" });
  await page.locator('[data-review-contact-action="start-chat"]').first().waitFor({ state: "visible" });
  await clickBack(page);

  await clickShellTab(page, mode, "me");
  if (mode === "mobile") {
    const mobileMeProfilesSearchHonest = await page.evaluate(() => {
      const activeTab = document.querySelector<HTMLElement>("#review-shell-tab-me.tab-active");
      if (!(activeTab instanceof HTMLElement)) {
        return false;
      }
      const rootPage = activeTab.closest(".page");
      if (!(rootPage instanceof HTMLElement)) {
        return false;
      }
      const searchInput = rootPage.querySelector<HTMLInputElement>(".subnavbar input[type='search']");
      const profileEntry = activeTab.querySelector<HTMLElement>('[data-review-me-entry="profiles"]');
      const currentProfileTitle = [...activeTab.querySelectorAll(".block-title")]
        .map((element) => element.textContent?.trim() ?? "")
        .includes("Current profile");
      return !(searchInput instanceof HTMLInputElement) && profileEntry instanceof HTMLElement && currentProfileTitle;
    });
    proof.mobileMeProfilesSearchHonest = mobileMeProfilesSearchHonest;
    await reviewMeAction(page, "profiles").waitFor({ state: "visible" });
    await reviewMeAction(page, "profiles").click();
    await page.getByText("Profiles").first().waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const titles = [...document.querySelectorAll(".page-content .item-title")]
        .map((element) => element.textContent?.trim() ?? "")
        .filter((text) => text.endsWith("review"));
      return titles.length >= 2;
    });
    await clickBack(page);
  } else {
    proof.mobileMeProfilesSearchHonest = true;
  }
  await reviewMeAction(page, "source-directory").waitFor({ state: "visible" });
  await clickSourceManagementItem(page);
  await reviewSourceItem(page, "remote-lab").waitFor({ state: "visible" });
  await clickSourceListItem(page);
  await page.getByText("Source Details").first().waitFor({ state: "visible" });
  await reviewSourceAction(page, "edit").waitFor({ state: "visible" });
  const sourceRequestText =
    (await page
      .locator('.page[data-name="review-shell-child"]')
      .filter({ has: page.getByText("Source Details") })
      .last()
      .textContent()) ?? "";
  const sourceRequestIsolation =
    sourceRequestText.includes("Requests") &&
    sourceRequestText.includes("Mira") &&
    sourceRequestText.includes("Incoming · Pending") &&
    !sourceRequestText.includes("Nora") &&
    !sourceRequestText.includes("Outbound · Accepted");
  proof.contactRequestVisibility = proof.contactRequestVisibility && sourceRequestIsolation;
  await clickBack(page);
  await clickBack(page);
  proof.peopleShellNavigation = true;
};

const captureWideCompletionPosition = async (
  text: string,
  screenshotName?: string,
): Promise<{ editorX: number; tooltipX: number; tooltipRight: number; viewportWidth: number }> => {
  const page = await browser.newPage({
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1,
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await openRoomChat(page);
  const editor = page.locator("[data-testid='web-chat-draft-editor']").first();
  await editor.click();
  await page.keyboard.type(text);
  await page.locator(".cm-tooltip-autocomplete").first().waitFor({ state: "visible" });
  await page.waitForTimeout(120);
  const box = await page.evaluate(() => {
    const editorElement = document.querySelector("[data-testid='web-chat-draft-editor']");
    const tooltipElement = document.querySelector(".cm-tooltip-autocomplete");
    if (!(editorElement instanceof HTMLElement) || !(tooltipElement instanceof HTMLElement)) {
      throw new Error("completion position elements are unavailable");
    }
    const editorRect = editorElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    return {
      editorX: editorRect.x,
      tooltipX: tooltipRect.x,
      tooltipRight: tooltipRect.right,
      viewportWidth: window.innerWidth,
    };
  });
  if (screenshotName) {
    await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: false });
  }
  await page.close();
  return box;
};

const verifyWideCompletionPosition = async (): Promise<void> => {
  const start = await captureWideCompletionPosition("?scr");
  const prefixed = await captureWideCompletionPosition("review note ?scr", "wide-completion-prefixed.png");
  proof.wideCompletionStartX = Math.round(start.tooltipX);
  proof.wideCompletionPrefixedX = Math.round(prefixed.tooltipX);
  proof.wideCompletionDeltaX = Math.round(prefixed.tooltipX - start.tooltipX);
  proof.wideCompletionPosition =
    start.tooltipX >= start.editorX &&
    prefixed.tooltipX > start.tooltipX + 48 &&
    prefixed.tooltipRight <= prefixed.viewportWidth - 8;
};

interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface MessageActionAnchorMeasurement {
  index: number;
  card: RectBox;
  bubble: RectBox;
  trigger: RectBox;
}

interface MessageActionPopoverMeasurement {
  trigger: RectBox;
  popover: RectBox;
}

interface CommentEditorSheetMeasurement {
  viewportWidth: number;
  viewportHeight: number;
  save: RectBox;
  textarea: RectBox;
}

interface ScrollToLatestVisualMeasurement {
  viewport: RectBox;
  latest: RectBox;
  latestBottomGap: number;
  latestComposerGap: number;
  latestText: string;
  latestViewKey: string;
  viewportFlexDirection: string;
  contentFlexDirection: string;
  contentJustifyContent: string;
}

const verifyWideMessageActionsAnchoring = async (): Promise<void> => {
  const page = await browser.newPage({
    viewport: { width: 1728, height: 1117 },
    deviceScaleFactor: 1,
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await openRoomChat(page);
  const firstAssistantRow = page.locator('.row[data-message-author="assistant"]').first();
  await firstAssistantRow.hover();
  const measurements = await page.evaluate<MessageActionAnchorMeasurement[]>(() => {
    return Array.from(document.querySelectorAll('.row[data-message-author="assistant"]')).map((row, index) => {
      const card = row.querySelector(".message-card");
      const bubble = row.querySelector(".message-bubble");
      const trigger = row.querySelector('[aria-label="Message actions"]');
      if (!(card instanceof HTMLElement) || !(bubble instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
        throw new Error("message action anchor elements are unavailable");
      }
      const cardRect = card.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      return {
        index,
        card: {
          x: Math.round(cardRect.x),
          y: Math.round(cardRect.y),
          width: Math.round(cardRect.width),
          height: Math.round(cardRect.height),
          right: Math.round(cardRect.right),
          bottom: Math.round(cardRect.bottom),
        },
        bubble: {
          x: Math.round(bubbleRect.x),
          y: Math.round(bubbleRect.y),
          width: Math.round(bubbleRect.width),
          height: Math.round(bubbleRect.height),
          right: Math.round(bubbleRect.right),
          bottom: Math.round(bubbleRect.bottom),
        },
        trigger: {
          x: Math.round(triggerRect.x),
          y: Math.round(triggerRect.y),
          width: Math.round(triggerRect.width),
          height: Math.round(triggerRect.height),
          right: Math.round(triggerRect.right),
          bottom: Math.round(triggerRect.bottom),
        },
      };
    });
  });
  await page.screenshot({ path: path.join(outputDir, "wide-message-actions-anchor.png"), fullPage: false });
  await page.getByLabel("Message actions").first().click();
  await page.locator(".popover.modal-in, .actions-modal.modal-in, .sheet-modal.modal-in").first().waitFor({
    state: "visible",
  });
  await page.waitForTimeout(160);
  const popoverMeasurement = await page.evaluate<MessageActionPopoverMeasurement>(() => {
    const trigger = document.querySelector('[aria-label="Message actions"]');
    const popover = document.querySelector(".popover.modal-in, .actions-modal.modal-in, .sheet-modal.modal-in");
    if (!(trigger instanceof HTMLElement) || !(popover instanceof HTMLElement)) {
      throw new Error("message action popover elements are unavailable");
    }
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    return {
      trigger: {
        x: Math.round(triggerRect.x),
        y: Math.round(triggerRect.y),
        width: Math.round(triggerRect.width),
        height: Math.round(triggerRect.height),
        right: Math.round(triggerRect.right),
        bottom: Math.round(triggerRect.bottom),
      },
      popover: {
        x: Math.round(popoverRect.x),
        y: Math.round(popoverRect.y),
        width: Math.round(popoverRect.width),
        height: Math.round(popoverRect.height),
        right: Math.round(popoverRect.right),
        bottom: Math.round(popoverRect.bottom),
      },
    };
  });
  await page.screenshot({ path: path.join(outputDir, "wide-message-actions-open.png"), fullPage: false });
  await page.close();

  proof.wideMessageActionsMaxRightOverflow = Math.max(
    ...measurements.map(({ card, trigger }) => Math.round(trigger.right - card.right)),
  );
  proof.wideMessageActionsMaxTopOffset = Math.max(
    ...measurements.map(({ card, trigger }) => Math.round(Math.abs(trigger.y - card.y))),
  );
  proof.wideMessageActionsAnchored =
    measurements.length > 0 &&
    measurements.every(({ card, bubble, trigger }) => {
      const inlineCardAnchored = trigger.x >= card.x - 12 && trigger.right <= card.right + 12;
      const inlineBubbleAnchored = trigger.x >= bubble.x - 2 && trigger.right <= bubble.right + 2;
      const blockAnchored = Math.abs(trigger.y - card.y) <= 12;
      return inlineCardAnchored && inlineBubbleAnchored && blockAnchored;
    });
  proof.wideMessageActionsPopoverRightDelta = Math.round(
    Math.abs(popoverMeasurement.popover.right - popoverMeasurement.trigger.right),
  );
  proof.wideMessageActionsPopoverGap = Math.round(
    Math.min(
      Math.abs(popoverMeasurement.popover.bottom - popoverMeasurement.trigger.y),
      Math.abs(popoverMeasurement.popover.y - popoverMeasurement.trigger.bottom),
    ),
  );
  proof.wideMessageActionsPopoverAligned =
    proof.wideMessageActionsPopoverRightDelta <= 12 && proof.wideMessageActionsPopoverGap <= 14;
};

try {
  const context = await browser.newContext({
    ...devices["iPhone 14"],
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await verifyPeopleShellNavigation(page);
  await openRoomChat(page);
  const roomEntryMeasurement = await page.evaluate(() => {
    const viewport = document.querySelector("[data-testid='web-chat-scroll-viewport']");
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='web-chat-scroll-viewport'] [data-view-key]"));
    const latestRow = rows.at(-1);
    const footer = document.querySelector<HTMLElement>(".chat-footer");
    if (!(viewport instanceof HTMLElement) || !(latestRow instanceof HTMLElement)) {
      throw new Error("room entry framing elements are unavailable");
    }
    const viewportRect = viewport.getBoundingClientRect();
    const latestRowRect = latestRow.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect() ?? viewportRect;
    const extent = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const raw = viewport.scrollTop;
    const distanceToLatest = !Number.isFinite(raw) ? 0 : Math.max(0, extent - Math.min(extent, Math.max(0, raw)));
    return {
      latestBottomGap: Math.round(Math.abs(viewportRect.bottom - latestRowRect.bottom)),
      latestComposerGap: Math.round(footerRect.top - latestRowRect.bottom),
      distanceToLatest: Math.round(distanceToLatest),
    };
  });
  proof.roomEntryLatestBottomGap = roomEntryMeasurement.latestBottomGap;
  proof.roomEntryLatestComposerGap = roomEntryMeasurement.latestComposerGap;
  proof.roomEntryDistanceToLatest = roomEntryMeasurement.distanceToLatest;
  proof.roomEntryLatestPinned =
    roomEntryMeasurement.distanceToLatest <= 12 &&
    roomEntryMeasurement.latestBottomGap <= 72 &&
    roomEntryMeasurement.latestComposerGap >= 0;

  proof.inlineResourceTokensLightweight = await page.evaluate(() => {
    const firstAssistantRow = Array.from(document.querySelectorAll('.row[data-message-author="assistant"]')).find(
      (row) => row.textContent?.includes("[^Image 1]") && row.textContent?.includes("[^File 2]"),
    );
    if (!(firstAssistantRow instanceof HTMLElement)) {
      return false;
    }
    const tokens = Array.from(firstAssistantRow.querySelectorAll<HTMLElement>('[part="message-resource-token"]'));
    return (
      tokens.length >= 2 &&
      tokens.some((token) => token.textContent === "[^Image 1]") &&
      tokens.some((token) => token.textContent === "[^File 2]") &&
      tokens.every((token) => {
        const style = window.getComputedStyle(token);
        return (
          !token.querySelector("svg") &&
          (style.backgroundColor === "rgba(0, 0, 0, 0)" || style.backgroundColor === "transparent")
        );
      })
    );
  });

  const editor = page.locator("[data-testid='web-chat-draft-editor']").first();
  await editor.click();
  await page.keyboard.type("@Iri");
  const irisOption = page.locator(".cm-tooltip-autocomplete li").filter({ hasText: "@Iris" }).first();
  await irisOption.waitFor({ state: "visible" });
  proof.mentionCompletion = true;
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+A");
  await page.keyboard.press("Backspace");

  const fileInput = page.locator("input.composer-file-input");
  await fileInput.setInputFiles({
    name: "src-img.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pQdVSEAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const pendingTiles = page.locator("[part='composer-assets'] article.resource-card");
  await pendingTiles.first().waitFor({ state: "visible" });
  await pendingTiles.first().locator("[part='resource-card-hitbox']").click();
  await page.locator("[part='resource-preview-layer']").first().waitFor({ state: "visible" });
  proof.uploadRailPreview = true;
  await page.getByLabel("Close preview").last().click();

  await editor.click();
  await page.keyboard.type("^src-img");
  const imageOption = page.locator(".cm-tooltip-autocomplete li").filter({ hasText: "^Image 1" }).first();
  await imageOption.waitFor({ state: "visible" });
  proof.resourceCompletion = true;
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+A");
  await page.keyboard.press("Backspace");

  const sourceCard = page
    .locator('.row[data-message-author="assistant"] .message-card')
    .filter({ hasText: "[^Image 1]" })
    .first();
  await sourceCard.dblclick();
  await page.locator(".message-source-page-content").waitFor({ state: "visible" });
  await page
    .locator(".message-source-toolbar-actions, .message-source-footer-actions")
    .getByRole("button", { name: "Comment" })
    .last()
    .click();
  await page.locator("[part='comment-anchor-badge']").waitFor({ state: "visible" });
  const commentInput = page
    .locator(".message-source-comment-editor-sheet.modal-in textarea, .message-source-comment-editor-inline textarea")
    .first();
  await commentInput.waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  const commentEditorMeasurement = await page.evaluate<CommentEditorSheetMeasurement>(() => {
    const save = document.querySelector(".message-source-comment-editor-sheet.modal-in .message-source-comment-editor-save");
    const textarea = document.querySelector(".message-source-comment-editor-sheet.modal-in textarea");
    if (!(save instanceof HTMLElement) || !(textarea instanceof HTMLElement)) {
      throw new Error("comment editor sheet elements are unavailable");
    }
    const saveRect = save.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      save: {
        x: Math.round(saveRect.x),
        y: Math.round(saveRect.y),
        width: Math.round(saveRect.width),
        height: Math.round(saveRect.height),
        right: Math.round(saveRect.right),
        bottom: Math.round(saveRect.bottom),
      },
      textarea: {
        x: Math.round(textareaRect.x),
        y: Math.round(textareaRect.y),
        width: Math.round(textareaRect.width),
        height: Math.round(textareaRect.height),
        right: Math.round(textareaRect.right),
        bottom: Math.round(textareaRect.bottom),
      },
    };
  });
  proof.commentEditorSaveRightDelta = Math.round(commentEditorMeasurement.save.right - commentEditorMeasurement.viewportWidth);
  proof.commentEditorTextareaVisibleHeight = Math.round(
    Math.max(
      0,
      Math.min(commentEditorMeasurement.textarea.bottom, commentEditorMeasurement.viewportHeight) -
        Math.max(commentEditorMeasurement.textarea.y, 0),
    ),
  );
  proof.commentEditorSheetStable =
    commentEditorMeasurement.save.x >= 8 &&
    commentEditorMeasurement.save.right <= commentEditorMeasurement.viewportWidth - 8 &&
    commentEditorMeasurement.textarea.x >= 8 &&
    commentEditorMeasurement.textarea.right <= commentEditorMeasurement.viewportWidth - 8 &&
    proof.commentEditorTextareaVisibleHeight >= 72;
  await commentInput.fill("Route-level review proof comment.");
  await page.getByRole("button", { name: "Save" }).last().click();
  await waitForTransientToast(page);
  await settleTransientLayers(page);
  const inlineCommentTile = page
    .locator("[part='composer-assets'] article.resource-card")
    .filter({ has: page.locator(".resource-card-comment-index") })
    .first();
  await inlineCommentTile.waitFor({ state: "visible" });
  const sourceSurface = page.locator(".message-source-page-content").first();
  if (await sourceSurface.isVisible()) {
    const closeSourceButton = page.locator("[aria-label='Close source']").first();
    if (await closeSourceButton.isVisible()) {
      await closeSourceButton.click();
      await sourceSurface.waitFor({ state: "hidden" });
    }
  }
  const commentTile = inlineCommentTile;
  await commentTile.waitFor({ state: "visible" });
  await commentTile.locator("[part='resource-card-hitbox']").click();
  await page
    .locator("[role='tab'][aria-selected='true']")
    .filter({ hasText: "View" })
    .last()
    .waitFor({ state: "visible" });
  proof.commentRoundtrip = true;
  await page.getByLabel("Close preview").last().click();
  await settleTransientLayers(page);

  const transcriptViewport = page.locator("[data-testid='web-chat-scroll-viewport']").first();
  const readLatestVisualMeasurement = async (): Promise<ScrollToLatestVisualMeasurement> =>
    transcriptViewport.evaluate((element) => {
      const rowSurfaces = Array.from(
        element.querySelectorAll<HTMLElement>("[data-view-key]"),
      );
      const latestSurface = rowSurfaces.at(-1);
      const latestRow = latestSurface?.querySelector<HTMLElement>(".row") ?? latestSurface ?? null;
      const content = element.querySelector(".bottom-anchored-timeline-content");
      const footer = document.querySelector<HTMLElement>(".chat-footer");
      if (!(latestRow instanceof HTMLElement) || !(latestSurface instanceof HTMLElement) || !(content instanceof HTMLElement)) {
        throw new Error("scroll-to-latest visual measurement elements are unavailable");
      }
      const viewportRect = element.getBoundingClientRect();
      const latestRect = latestRow.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect() ?? viewportRect;
      return {
        viewport: {
          x: Math.round(viewportRect.x),
          y: Math.round(viewportRect.y),
          width: Math.round(viewportRect.width),
          height: Math.round(viewportRect.height),
          right: Math.round(viewportRect.right),
          bottom: Math.round(viewportRect.bottom),
        },
        latest: {
          x: Math.round(latestRect.x),
          y: Math.round(latestRect.y),
          width: Math.round(latestRect.width),
          height: Math.round(latestRect.height),
          right: Math.round(latestRect.right),
          bottom: Math.round(latestRect.bottom),
        },
        latestBottomGap: Math.round(Math.abs(viewportRect.bottom - latestRect.bottom)),
        latestComposerGap: Math.round(footerRect.top - latestRect.bottom),
        latestText: latestRow.textContent?.trim() ?? "",
        latestViewKey: latestSurface.dataset.viewKey ?? "",
        viewportFlexDirection: window.getComputedStyle(element).flexDirection,
        contentFlexDirection: window.getComputedStyle(content).flexDirection,
        contentJustifyContent: window.getComputedStyle(content).justifyContent,
      };
    });
  const readDistanceToLatest = async (): Promise<number> =>
    transcriptViewport.evaluate((element) => {
      const extent = Math.max(0, element.scrollHeight - element.clientHeight);
      const raw = element.scrollTop;
      if (!Number.isFinite(raw)) {
        return 0;
      }
      return Math.max(0, extent - Math.min(extent, Math.max(0, raw)));
    });
  await transcriptViewport.hover();
  await page.mouse.wheel(0, -640);
  await page.waitForTimeout(120);
  const latestVisualBefore = await readLatestVisualMeasurement();
  proof.scrollToLatestLatestBottomGapBefore = latestVisualBefore.latestBottomGap;
  proof.scrollToLatestLatestComposerGapBefore = latestVisualBefore.latestComposerGap;
  proof.scrollToLatestDistanceBefore = await readDistanceToLatest();
  const scrollToLatestButton = page.getByRole("button", { name: "Scroll to latest" });
  const canScrollAway = proof.scrollToLatestDistanceBefore > 12;
  if (canScrollAway) {
    await scrollToLatestButton.waitFor({ state: "visible" });
    await scrollToLatestButton.click();
    await page.waitForFunction(
      () => {
        const viewport = document.querySelector("[data-testid='web-chat-scroll-viewport']");
        if (!(viewport instanceof HTMLElement)) {
          return false;
        }
        const latestSurface = Array.from(viewport.querySelectorAll<HTMLElement>("[data-view-key]")).at(-1);
        const latestRow = latestSurface?.querySelector<HTMLElement>(".row") ?? latestSurface ?? null;
        const footer = document.querySelector<HTMLElement>(".chat-footer");
        if (!(latestRow instanceof HTMLElement)) {
          return false;
        }
        const extent = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        const raw = viewport.scrollTop;
        const normalized = !Number.isFinite(raw) ? 0 : Math.max(0, extent - Math.min(extent, Math.max(0, raw)));
        const viewportRect = viewport.getBoundingClientRect();
        const latestRect = latestRow.getBoundingClientRect();
        const latestBottomGap = Math.abs(viewportRect.bottom - latestRect.bottom);
        const footerRect = footer?.getBoundingClientRect() ?? viewportRect;
        const latestComposerGap = footerRect.top - latestRect.bottom;
        return (
          normalized <= 12 &&
          window.getComputedStyle(viewport).flexDirection === "column" &&
          latestRect.bottom <= viewportRect.bottom + 16 &&
          latestBottomGap <= 72 &&
          latestComposerGap >= 0
        );
      },
      undefined,
      { timeout: 2_000 },
    );
    await scrollToLatestButton.waitFor({ state: "hidden" });
    proof.scrollToLatestDistanceAfter = await readDistanceToLatest();
  } else {
    proof.scrollToLatestDistanceAfter = proof.scrollToLatestDistanceBefore;
  }
  const latestVisualAfter = await readLatestVisualMeasurement();
  proof.scrollToLatestLatestBottomGapAfter = latestVisualAfter.latestBottomGap;
  proof.scrollToLatestLatestComposerGapAfter = latestVisualAfter.latestComposerGap;
  proof.scrollToLatestViewportFlexDirection = latestVisualAfter.viewportFlexDirection;
  proof.scrollToLatestContentFlexDirection = latestVisualAfter.contentFlexDirection;
  proof.scrollToLatestContentJustifyContent = latestVisualAfter.contentJustifyContent;
  proof.scrollToLatest = canScrollAway ? proof.scrollToLatestDistanceAfter <= 12 : proof.scrollToLatestDistanceAfter <= 12;
  proof.scrollToLatestVisualLatestPinned =
    proof.scrollToLatestViewportFlexDirection === "column" &&
    proof.scrollToLatestContentFlexDirection === "column" &&
    proof.scrollToLatestLatestBottomGapAfter <= 72 &&
    proof.scrollToLatestLatestComposerGapAfter >= 0;

  await page.screenshot({ path: path.join(outputDir, "review-flow-proof.png"), fullPage: true });
  await context.close();

  await verifyWideCompletionPosition();
  await verifyWideMessageActionsAnchoring();
  await writeFile(path.join(outputDir, "review-flow-proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
  verifyProof();
} finally {
  await browser.close();
}
