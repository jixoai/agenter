import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const messageSystemSurfaceSource = readFileSync(resolve(import.meta.dirname, "message-system-surface.svelte"), "utf8");
const roomPageToolbarContentSource = readFileSync(
  resolve(import.meta.dirname, "room-page-toolbar-content.svelte"),
  "utf8",
);
const messageRoomManageDialogSource = readFileSync(
  resolve(import.meta.dirname, "message-room-manage-dialog.svelte"),
  "utf8",
);
const roomMessageSearchDialogSource = readFileSync(
  resolve(import.meta.dirname, "room-message-search-dialog.svelte"),
  "utf8",
);
const messagesWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "messages-workbench-layout.svelte"),
  "utf8",
);
const webChatViewRootSource = readFileSync(
  resolve(import.meta.dirname, "../../../../../web-chat-view/src/web-chat-view-root.svelte"),
  "utf8",
);

describe("Feature: Messages workbench mount contract", () => {
  test("Scenario: Given a room toolbar is injected into shared chrome When reading the room surface source Then it portals slot content instead of reviving the unstable component prop path", () => {
    expect(messageSystemSurfaceSource).toContain("<WorkbenchPageToolbar>");
    expect(messageSystemSurfaceSource).toContain("<RoomPageToolbarContent {...roomToolbarProps} />");
    expect(messageSystemSurfaceSource).not.toContain("component={RoomPageToolbarContent}");
    expect(roomPageToolbarContentSource).toContain("<WorkbenchToolbar");
    expect(roomPageToolbarContentSource).toContain("pageTabs={roomToolbarPageTabs}");
    expect(roomPageToolbarContentSource).toContain("identityTitle={roomToolbarIdentityTitle}");
    expect(roomPageToolbarContentSource).toContain("actions={roomToolbarActions}");
  });

  test("Scenario: Given room management is dialog-driven When reading the room surface source Then the parent binds the dialog open state instead of leaving reopen behavior trapped in child-only state", () => {
    expect(messageSystemSurfaceSource).toContain("bind:open={manageDialogOpen}");
    expect(messageSystemSurfaceSource).not.toContain("\n\topen={manageDialogOpen}");
  });

  test("Scenario: Given message dialogs may reopen repeatedly When reading the dialog sources Then message management and search bypass body scroll locking that can leave the page inert", () => {
    expect(messageRoomManageDialogSource).toContain("preventScroll={false}");
    expect(roomMessageSearchDialogSource).toContain("preventScroll={false}");
  });

  test("Scenario: Given the messages workbench owns a fixed page toolbar region When reading the layout source Then the host remains mounted with the shared 48px container contract and does not clip floated overflow panels", () => {
    expect(messagesWorkbenchLayoutSource).toContain("bind:this={pageToolbarRegistry.host}");
    expect(messagesWorkbenchLayoutSource).toContain('class="messages-workbench-window__toolbar-host"');
    expect(messagesWorkbenchLayoutSource).toContain("block-size: 48px;");
    expect(messagesWorkbenchLayoutSource).toContain("container-type: inline-size;");
    expect(messagesWorkbenchLayoutSource).toContain("overflow: visible;");
    expect(messagesWorkbenchLayoutSource).toContain("position: relative;");
    expect(messagesWorkbenchLayoutSource).toContain("z-index: 1;");
    expect(messagesWorkbenchLayoutSource).not.toContain("overflow: clip;");
  });

  test("Scenario: Given the room transcript is stable again When reading the chat root source Then the footer renders the composer instead of the debug placeholder", () => {
    expect(webChatViewRootSource).toContain("<DefaultComposer {...composerProps} />");
    expect(webChatViewRootSource).not.toContain("chat-footer-debug-placeholder");
  });
});
