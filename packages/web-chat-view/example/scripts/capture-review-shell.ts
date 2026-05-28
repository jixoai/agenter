import path from "node:path";

import { importPlaywright, resolveReviewUrl, resolveScreenshotDir } from "./review-screenshot-utils";

const baseUrl = resolveReviewUrl("http://127.0.0.1:4295/");
const outputDir = resolveScreenshotDir(".screenshot/after/iteration-current");

const { chromium, devices } = await importPlaywright();

await Bun.write(path.join(outputDir, ".keep"), "");

type PageLike = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;
type RootTab = "messages" | "contacts" | "me";
type ShellMode = "desktop" | "mobile";

const rootTabSelector = (tab: RootTab): string => `#review-shell-tab-${tab}`;
const activeDesktopMaster = ".review-shell-desktop-master.page-current";
const activeDesktopDetail = ".review-shell-desktop-detail.page-current";
const activeMobileRootTab = (tab: RootTab): string => `${visibleRootTabSelector(tab)}`;
const activeMobileChild = '.page[data-name="review-shell-child"]';
const activeMobileRootTabPanel = (tab: RootTab): string => `${rootTabSelector(tab)}.tab-active`;
const visibleRootTabSelector = (tab: RootTab): string => `${rootTabSelector(tab)}.tab-active`;
const visibleRootTab = (page: PageLike, tab: RootTab) => page.locator(visibleRootTabSelector(tab)).first();
const rootDesktopNav = (page: PageLike, tab: RootTab) => page.locator(`[data-review-root-nav="${tab}"]`).first();
const rootMobileTabLink = (page: PageLike, tab: RootTab) => page.locator(`.toolbar.tabbar a[data-tab="${rootTabSelector(tab)}"]`).first();
const surfaceScope = (mode: ShellMode, tab: RootTab, child = false): string => {
  if (mode === "desktop") {
    if (tab === "me" || tab === "messages") {
      return child ? activeDesktopDetail : activeDesktopMaster;
    }
    return child ? activeDesktopDetail : activeDesktopMaster;
  }
  return child ? activeMobileChild : activeMobileRootTab(tab);
};
const rootTabPanelScope = (mode: ShellMode, tab: RootTab): string =>
  mode === "desktop" ? activeDesktopMaster : activeMobileRootTabPanel(tab);
const activeContactDetailScope = (mode: ShellMode): string => (mode === "desktop" ? activeDesktopDetail : activeMobileChild);
const reviewRoomConversationItem = (page: PageLike, mode: ShellMode) =>
  page.locator(`${surfaceScope(mode, "messages")} [data-review-conversation-id^="room:"]`).first();
const reviewContactItem = (page: PageLike, mode: ShellMode, sourceId: string) =>
  page.locator(`${rootTabPanelScope(mode, "contacts")} [data-review-contact-key*="::${sourceId}::"]`).first();
const reviewSourceItem = (page: PageLike, mode: ShellMode) =>
  page
    .locator(mode === "desktop" ? `${activeDesktopMaster} [data-review-source-id="remote-lab"]` : `${activeMobileChild} [data-review-source-id="remote-lab"]`)
    .first();
const reviewMeAction = (page: PageLike, mode: ShellMode, action: string) =>
  page.locator(`${surfaceScope(mode, "me")} [data-review-me-action="${action}"]`).first();
const reviewContactAction = (page: PageLike, mode: ShellMode, action: string) =>
  page
    .locator(
      `${activeContactDetailScope(mode)} li[data-review-contact-action="${action}"], ${activeContactDetailScope(mode)} a[data-review-contact-action="${action}"]`,
    )
    .first();
const reviewSourceAction = (page: PageLike, mode: ShellMode, action: string) =>
  page
    .locator(
      mode === "desktop"
        ? `${activeDesktopDetail} li[data-review-source-action="${action}"], ${activeDesktopDetail} a[data-review-source-action="${action}"]`
        : `${activeMobileChild} li[data-review-source-action="${action}"], ${activeMobileChild} a[data-review-source-action="${action}"]`,
    )
    .first();

const setShellState = async (page: PageLike, action: "openDestination" | "openContact" | "openSources" | "openRoom", value?: string): Promise<void> => {
  await page.evaluate(
    async ({ nextAction, nextValue }) => {
      const shell = (window as typeof window & {
        __reviewShellState?: {
          openDestination: (destination: RootTab) => void | Promise<void>;
          openContact: (contactKey: string) => void | Promise<void>;
          openSources: (sourceId?: string | null) => void | Promise<void>;
          openRoom: () => void | Promise<void>;
          peopleProjection: {
            contacts: Array<{ key: string; sourceId: string; label: string }>;
          };
        };
      }).__reviewShellState;
      if (!shell) {
        throw new Error("review shell state is unavailable");
      }
      switch (nextAction) {
        case "openDestination":
          await shell.openDestination(nextValue as RootTab);
          break;
        case "openContact":
          await shell.openContact(nextValue ?? "");
          break;
        case "openSources":
          await shell.openSources(nextValue ?? undefined);
          break;
        case "openRoom":
          await shell.openRoom();
          break;
      }
    },
    { nextAction: action, nextValue: value },
  );
};

const waitForStateFragment = async (page: PageLike, fragment: string): Promise<void> => {
  await page.waitForFunction((expectedFragment) => {
    const state = document.querySelector("[data-review-shell-state]")?.getAttribute("data-review-shell-state");
    return typeof state === "string" && state.includes(expectedFragment);
  }, fragment);
};

const waitForMobileRootTab = async (page: PageLike, tab: RootTab): Promise<void> => {
  const rootTab = visibleRootTab(page, tab);
  await rootTab.waitFor({ state: "visible" });
};

const forbiddenVisibleIconNames = [
  "chat_bubble_2_fill",
  "person_2_fill",
  "tray_2_fill",
  "ellipsis",
] as const;

const assertNoVisibleIconNames = async (page: PageLike): Promise<void> => {
  const visibleText = await page.locator("body").innerText();
  const leakedIconName = forbiddenVisibleIconNames.find((iconName) => visibleText.includes(iconName));
  if (leakedIconName) {
    throw new Error(`Framework7 icon implementation name leaked as visible text: ${leakedIconName}`);
  }
};

const assertMobileChildPageIntegrity = async (page: PageLike, expectedText: string): Promise<void> => {
  await page
    .waitForFunction((text) => {
      const currentChild = document.querySelector('.page[data-name="review-shell-child"].page-current');
      const tabbar = document.querySelector(".review-shell-tabbar");
      if (!(currentChild instanceof HTMLElement)) {
        return false;
      }
      const childRect = currentChild.getBoundingClientRect();
      const childText = currentChild.textContent ?? "";
      const tabbarVisible =
        tabbar instanceof HTMLElement &&
        (() => {
          const tabbarRect = tabbar.getBoundingClientRect();
          const tabbarStyle = window.getComputedStyle(tabbar);
          return (
            tabbarRect.width > 0 &&
            tabbarRect.height > 0 &&
            tabbarStyle.display !== "none" &&
            tabbarStyle.visibility !== "hidden" &&
            tabbarStyle.opacity !== "0"
          );
        })();
      const viewportCovered =
        childRect.left <= 1 &&
        childRect.top <= 1 &&
        childRect.right >= window.innerWidth - 1 &&
        childRect.bottom >= window.innerHeight - 1;
      return childText.includes(text) && viewportCovered && !tabbarVisible;
    }, expectedText, { timeout: 7000 })
    .catch(() => undefined);
  const integrity = await page.evaluate((text) => {
    const currentChild = document.querySelector('.page[data-name="review-shell-child"].page-current');
    const tabbar = document.querySelector(".review-shell-tabbar");
    if (!(currentChild instanceof HTMLElement)) {
      return {
        ok: false,
        reason: "current child page is missing",
      };
    }
    const childRect = currentChild.getBoundingClientRect();
    const childText = currentChild.textContent ?? "";
    const tabbarVisible =
      tabbar instanceof HTMLElement &&
      (() => {
        const tabbarRect = tabbar.getBoundingClientRect();
        const tabbarStyle = window.getComputedStyle(tabbar);
        return (
          tabbarRect.width > 0 &&
          tabbarRect.height > 0 &&
          tabbarStyle.display !== "none" &&
          tabbarStyle.visibility !== "hidden" &&
          tabbarStyle.opacity !== "0"
        );
      })();
    const viewportCovered =
      childRect.left <= 1 &&
      childRect.top <= 1 &&
      childRect.right >= window.innerWidth - 1 &&
      childRect.bottom >= window.innerHeight - 1;
    if (!childText.includes(text)) {
      return {
        ok: false,
        reason: `child page text does not include ${text}`,
      };
    }
    if (!viewportCovered) {
      return {
        ok: false,
        reason: `child page does not cover viewport: ${JSON.stringify({
          left: Math.round(childRect.left),
          top: Math.round(childRect.top),
          right: Math.round(childRect.right),
          bottom: Math.round(childRect.bottom),
          width: window.innerWidth,
          height: window.innerHeight,
        })}`,
      };
    }
    if (tabbarVisible) {
      return {
        ok: false,
        reason: "root tabbar is visible behind child page",
      };
    }
    return {
      ok: true,
      reason: "",
    };
  }, expectedText);
  if (!integrity.ok) {
    throw new Error(`Mobile child page integrity failed: ${integrity.reason}`);
  }
};

const resolveShellMode = async (page: PageLike): Promise<ShellMode> =>
  (await rootDesktopNav(page, "messages").isVisible().catch(() => false)) ? "desktop" : "mobile";

const waitForRoomLatestSettle = async (page: PageLike): Promise<void> => {
  await page.waitForFunction(() => {
    const transcriptShell = document.querySelector('[part="transcript-shell"]');
    if (!(transcriptShell instanceof HTMLElement)) {
      return false;
    }
    return transcriptShell.dataset.initialLatestPending !== "true";
  });
};

const loadRoot = async (page: PageLike): Promise<ShellMode> => {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const mode = await resolveShellMode(page);
  if (mode === "desktop") {
    await reviewRoomConversationItem(page, mode).waitFor({ state: "visible" });
    await assertNoVisibleIconNames(page);
    return mode;
  }
  await waitForMobileRootTab(page, "messages");
  await reviewRoomConversationItem(page, mode).waitFor({ state: "visible" });
  await assertNoVisibleIconNames(page);
  return mode;
};

const capture = async (page: PageLike, prefix: "desktop" | "iphone14"): Promise<void> => {
  const mode = await loadRoot(page);
  await page.screenshot({ path: path.join(outputDir, `${prefix}-messages.png`), fullPage: false });

  await setShellState(page, "openDestination", "contacts");
  await waitForStateFragment(page, "contacts|");
  await reviewContactItem(page, mode, "main-office").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(outputDir, `${prefix}-contacts.png`), fullPage: false });

  const contactKey = await page.evaluate(() => {
    const shell = (window as typeof window & { __reviewShellState?: { peopleProjection?: { contacts?: Array<{ key: string; sourceId: string }> } } }).__reviewShellState;
    return shell?.peopleProjection.contacts.find((contact) => contact.sourceId === "main-office")?.key ?? null;
  });
  if (!contactKey) {
    throw new Error("unable to resolve main-office contact key");
  }
  await setShellState(page, "openContact", contactKey);
  await waitForStateFragment(page, contactKey);
  if (mode === "mobile") {
    await assertMobileChildPageIntegrity(page, "Contact Details");
  }
  await assertNoVisibleIconNames(page);
  await page.screenshot({ path: path.join(outputDir, `${prefix}-contact-detail.png`), fullPage: false });

  await loadRoot(page);
  await setShellState(page, "openDestination", "me");
  await waitForStateFragment(page, "me|");
  await page.screenshot({ path: path.join(outputDir, `${prefix}-me.png`), fullPage: false });

  await setShellState(page, "openSources");
  await waitForStateFragment(page, "sources-open");
  if (mode === "mobile") {
    await assertMobileChildPageIntegrity(page, "Sources");
  }
  await reviewSourceItem(page, mode).waitFor({ state: "visible" });
  await assertNoVisibleIconNames(page);
  await page.screenshot({ path: path.join(outputDir, `${prefix}-sources.png`), fullPage: false });

  await setShellState(page, "openSources", "remote-lab");
  await waitForStateFragment(page, "remote-lab");
  if (mode === "mobile") {
    await assertMobileChildPageIntegrity(page, "Source Details");
  }
  await assertNoVisibleIconNames(page);
  await page.screenshot({ path: path.join(outputDir, `${prefix}-source-detail.png`), fullPage: false });

  await loadRoot(page);
  await setShellState(page, "openRoom");
  await waitForStateFragment(page, "room|");
  await page.locator("[data-testid='web-chat-draft-editor']").first().waitFor({ state: "visible" });
  await waitForRoomLatestSettle(page);
  await page.screenshot({ path: path.join(outputDir, `${prefix}-room-chat.png`), fullPage: false });
};

const browser = await chromium.launch({ headless: true });

try {
  const desktopPage = await browser.newPage({
    viewport: { width: 1440, height: 1180 },
    deviceScaleFactor: 2,
  });
  await capture(desktopPage, "desktop");
  await desktopPage.close();

  const mobileContext = await browser.newContext({
    ...devices["iPhone 14"],
  });
  const mobilePage = await mobileContext.newPage();
  await capture(mobilePage, "iphone14");
  await mobileContext.close();

  console.log(outputDir);
} finally {
  await browser.close();
}
