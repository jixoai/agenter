import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const messageRowSource = readFileSync(resolve(import.meta.dirname, "../src/message-row.svelte"), "utf8");
const pendingAssetStripSource = readFileSync(
  resolve(import.meta.dirname, "../src/composer/pending-asset-strip.svelte"),
  "utf8",
);
const messageSourcePopupSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-source-popup.svelte"),
  "utf8",
);
const resourcePreviewLayerSource = readFileSync(
  resolve(import.meta.dirname, "../src/resource-preview-layer.svelte"),
  "utf8",
);
const resourcePreviewShellSource = readFileSync(
  resolve(import.meta.dirname, "../src/resource-preview-shell.svelte"),
  "utf8",
);
const commentInspectorSource = readFileSync(resolve(import.meta.dirname, "../src/comment-inspector.svelte"), "utf8");

describe("Feature: comment resource reopen contract", () => {
  test("Scenario: Given a sent message resource affordance When reading the implementation Then comment resources reopen through the shared preview shell with a comment-specific stage", () => {
    expect(messageRowSource).toContain('commentDetailMode = "view"');
    expect(messageRowSource).toContain("<ResourcePreviewLayer");
    expect(messageRowSource).toContain("commentMode={commentDetailMode}");
    expect(resourcePreviewLayerSource).toContain('activeResource?.kind === "comment"');
    expect(resourcePreviewLayerSource).toContain("<ResourcePreviewShell");
    expect(resourcePreviewLayerSource).toContain("<CommentInspector");
    expect(resourcePreviewLayerSource).toContain("standaloneShell={false}");
  });

  test("Scenario: Given the composer resource rail When reading the implementation Then pending comment resources reopen into the same comment detail contract", () => {
    expect(pendingAssetStripSource).toContain("commentEditable");
    expect(pendingAssetStripSource).toContain("onUpdateComment?.");
    expect(pendingAssetStripSource).toContain("<ResourcePreviewLayer");
    expect(pendingAssetStripSource).toContain("bind:commentDraftValue={commentDraftValue}");
  });

  test("Scenario: Given comment creation from the source popup When reading the implementation Then selection actions create an inline anchor with a bottom editor", () => {
    expect(messageSourcePopupSource).toContain("buildCommentResourceSourceUri");
    expect(messageSourcePopupSource).toContain("selectionActionButtonRef");
    expect(messageSourcePopupSource).toContain("<SelectionActionSurface");
    expect(messageSourcePopupSource).toContain("<CommentAnchorBadge");
    expect(messageSourcePopupSource).toContain("<Sheet");
    expect(messageSourcePopupSource).toContain("message-source-comment-editor-sheet");
    expect(messageSourcePopupSource).toContain('<Toolbar class="message-source-comment-editor-toolbar">');
    expect(messageSourcePopupSource).toContain('<PageContent class="message-source-comment-editor-content">');
    expect(messageSourcePopupSource).toContain(":global(.message-source-comment-editor-content.page-content)");
    expect(messageSourcePopupSource).not.toContain('<div class="message-source-comment-editor-content">');
  });

  test("Scenario: Given image file and comment resources When reading the implementation Then image, document, and comment resources stay on one popup-shell preview family", () => {
    expect(resourcePreviewLayerSource).toContain('activeResource?.kind === "image"');
    expect(resourcePreviewLayerSource).toContain('activeResource?.kind === "comment"');
    expect(resourcePreviewLayerSource).toContain("<ResourcePreviewShell");
    expect(resourcePreviewLayerSource).toContain("<CommentInspector");
    expect(resourcePreviewShellSource).toContain("<PageContent");
    expect(commentInspectorSource).toContain("<ResourcePreviewShell");
    expect(commentInspectorSource).toContain("standaloneShell = true");
    expect(commentInspectorSource).toContain("<Segmented");
    expect(commentInspectorSource).toContain("<Block");
    expect(commentInspectorSource).toContain('<Toolbar class="comment-inspector-edit-bar">');
    expect(commentInspectorSource).toContain('<PageContent class="comment-inspector-edit-content">');
    expect(commentInspectorSource).toContain(":global(.comment-inspector-edit-content.page-content)");
    expect(commentInspectorSource).not.toContain('<div class="comment-inspector-edit-content">');
    expect(commentInspectorSource).not.toContain("<Popup");
  });
});
