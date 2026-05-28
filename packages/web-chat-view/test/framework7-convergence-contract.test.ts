import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const reviewShellClientSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/lib/review-shell-client.svelte"),
  "utf8",
);
const reviewShellAppCssSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/app.css"),
  "utf8",
);
const reviewShellBlueprintHarnessSource = readFileSync(
  resolve(import.meta.dirname, "../src/storybook/review-shell-app-blueprint-harness.svelte"),
  "utf8",
);
const webChatViewRootSource = readFileSync(
  resolve(import.meta.dirname, "../src/web-chat-view-root.svelte"),
  "utf8",
);

describe("Feature: Framework7 convergence for the mobile review shell", () => {
  test("Scenario: Given the mobile root navigation When reading the implementation Then the bottom shell is expressed through the official Toolbar tabbar instead of a custom nav row", () => {
    expect(reviewShellClientSource).toContain("<Toolbar");
    expect(reviewShellClientSource).toContain("tabbar");
    expect(reviewShellClientSource).toContain('position="bottom"');
    expect(reviewShellClientSource).toContain("review-shell-tabbar--suspended");
    expect(reviewShellAppCssSource).toContain(".review-shell-tabbar--suspended");
    expect(reviewShellClientSource).toContain("<ToolbarPane>");
    expect(reviewShellClientSource).toContain('tabLink="#review-shell-tab-messages"');
    expect(reviewShellClientSource).toContain('tabLink="#review-shell-tab-contacts"');
    expect(reviewShellClientSource).toContain('tabLink="#review-shell-tab-me"');
    expect(reviewShellClientSource).toContain('aria-label="Messages"');
    expect(reviewShellClientSource).toContain('aria-label="Contacts"');
    expect(reviewShellClientSource).toContain('aria-label="Me"');
    expect(reviewShellClientSource).toContain('class="review-shell-tab-icon"');
    expect(reviewShellClientSource).not.toContain('iconIos="f7:chat_bubble_2_fill"');
    expect(reviewShellClientSource).not.toContain('iconIos="f7:person_2_fill"');
    expect(reviewShellClientSource).not.toContain('iconIos="f7:person_crop_circle_fill"');
    expect(reviewShellClientSource).not.toContain('onClick={() => shellState.openDestination("messages")}');
    expect(reviewShellClientSource).not.toContain('onClick={() => shellState.openDestination("contacts")}');
    expect(reviewShellClientSource).not.toContain('onClick={() => shellState.openDestination("me")}');
    expect(reviewShellClientSource).not.toContain("tabbarLabel");
    expect(reviewShellClientSource).not.toContain("<nav class=\"review-shell-tabbar\"");
  });

  test("Scenario: Given the shell search chrome When reading the implementation Then Subnavbar and Searchbar stay in the official Navbar tree instead of being pushed into afterInner wrappers", () => {
    expect(reviewShellClientSource).toContain('<Subnavbar class="review-shell-mobile-subnavbar" inner={false}>');
    expect(reviewShellClientSource).toContain('<Subnavbar class="review-shell-desktop-subnavbar" inner={false}>');
    expect(reviewShellClientSource).toContain("customSearch={true}");
    expect(reviewShellClientSource).not.toContain("{#snippet afterInner()}");
  });

  test("Scenario: Given mobile child navigation When opening a child surface Then Framework7 owns the page transition through the View router", () => {
    expect(reviewShellClientSource).toContain('path: "/review-shell-child/"');
    expect(reviewShellClientSource).toContain("component: ReviewShellRoutedPage");
    expect(reviewShellClientSource).toContain("router.navigate(childRoutePath");
    expect(reviewShellClientSource).toContain("router.back(\"/\"");
    expect(reviewShellClientSource).toContain("routes={appParameters.routes}");
    expect(reviewShellClientSource).toContain('<Link href={false} icon="icon-back" iconOnly aria-label="Back" onClick={handleMobileChildBack} />');
    expect(reviewShellClientSource).not.toContain("{:else if mobileChildSurfaceOpen}");
    expect(reviewShellClientSource).not.toContain('backLink="Back"');
  });

  test("Scenario: Given the shell layout When reading the implementation Then page padding no longer owns the chat footer spacing", () => {
    expect(reviewShellClientSource).toContain('class="review-shell-room-page-content"');
    expect(reviewShellClientSource).toContain("messagesContent={shellState.roomOpen}");
    expect(reviewShellClientSource).toContain("messagesContent={shellState.roomOpen || wideMessagesDetailVisible}");
    expect(reviewShellClientSource).toContain('class={shellState.roomOpen ? "review-shell-room-page" : undefined}');
    expect(reviewShellClientSource).toContain('review-shell-desktop-detail page-master-detail ${');
    expect(reviewShellAppCssSource).toContain(".review-shell-room-page-content");
    expect(reviewShellAppCssSource).toContain(".review-shell-room-page");
    expect(reviewShellAppCssSource).toContain(".review-shell-chat-host {");
    expect(reviewShellAppCssSource).not.toContain(".review-shell-tab-page-content {");
    expect(reviewShellAppCssSource).not.toContain("--f7-page-content-extra-padding-top");
    expect(reviewShellAppCssSource).not.toContain("--f7-page-content-extra-padding-bottom");
  });

  test("Scenario: Given the example app stylesheet When reading global CSS Then Framework7 selectors are valid browser selectors rather than Svelte scoped :global wrappers", () => {
    expect(reviewShellAppCssSource).toContain(".framework7-root");
    expect(reviewShellAppCssSource).toContain('.page[data-name="review-shell-home"]');
    expect(reviewShellAppCssSource).not.toContain(":global(");
  });

  test("Scenario: Given temporary sheet pages When reading the implementation Then close and save actions live in Toolbar chrome instead of content button rows", () => {
    expect(reviewShellClientSource).toContain('<Toolbar class="review-shell-sheet-toolbar">');
    expect(reviewShellClientSource).toContain('<PageContent class="review-shell-sheet-content">');
    expect(reviewShellClientSource).toContain('<Link sheetClose>Done</Link>');
    expect(reviewShellClientSource).toContain('<Link sheetClose>Cancel</Link>');
    expect(reviewShellClientSource).toContain('<Link onClick={saveSourceDraft}>Save</Link>');
    expect(reviewShellClientSource).not.toContain("<Sheet opened={resourcesSheetOpen} backdrop swipeToClose push={false} onSheetClosed={() => (resourcesSheetOpen = false)}>\n    <View>");
    expect(reviewShellClientSource).not.toContain("<Sheet opened={detailsSheetOpen} backdrop swipeToClose push={false} onSheetClosed={() => (detailsSheetOpen = false)}>\n    <View>");
    expect(reviewShellClientSource).not.toContain("<Sheet opened={sourceEditorOpen} backdrop swipeToClose push={false} onSheetClosed={() => (sourceEditorOpen = false)}>\n    <View>");
    expect(reviewShellClientSource).not.toContain("<Sheet opened={shellState.shellPanelOpen} backdrop swipeToClose push={false} onSheetClosed={() => (shellState.shellPanelOpen = false)}>\n    <View>");
    expect(reviewShellClientSource).not.toContain('<div class="left">');
    expect(reviewShellClientSource).not.toContain('<div class="right">');
    expect(reviewShellClientSource).not.toContain('class="review-shell-action-row"');
  });

  test("Scenario: Given the chat surface When reading the implementation Then the scroll-to-latest affordance is a real button rather than a link pretending to be a button", () => {
    expect(webChatViewRootSource).toContain('class="chat-scroll-latest-button"');
    expect(webChatViewRootSource).toContain("<Button");
    expect(webChatViewRootSource).not.toContain('href="#"');
    expect(webChatViewRootSource).not.toContain('role="button"');
  });
});
