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

  test("Scenario: Given source toolbar actions have icons When reading the implementation Then dense action controls do not render visible text labels", () => {
    expect(messageSourcePopupSource).toContain('aria-label="Open source line actions"');
    expect(messageSourcePopupSource).toContain('aria-label="Comment on selected source line"');
    expect(messageSourcePopupSource).not.toContain("<span>Actions</span>");
    expect(messageSourcePopupSource).not.toContain("<span>Comment</span>");
  });

  test("Scenario: Given a source comment or pending comment edit is saved empty When reading the implementation Then empty save removes the comment artifact", () => {
    const pendingAssetStripSource = readFileSync(
      resolve(import.meta.dirname, "../src/composer/pending-asset-strip.svelte"),
      "utf8",
    );
    const commentInspectorSource = readFileSync(resolve(import.meta.dirname, "../src/comment-inspector.svelte"), "utf8");

    expect(messageSourcePopupSource).toContain("deleteActiveCommentAnchor");
    expect(messageSourcePopupSource).toContain("trimmedDraft.length === 0");
    expect(messageSourcePopupSource).toContain("deleteActiveCommentAnchor({ closePanel: true })");
    expect(pendingAssetStripSource).toContain("onRemoveComment?.(previewingResource.id)");
    expect(commentInspectorSource).toContain("canSave = $derived(effectiveCanEdit)");
  });

  test("Scenario: Given an empty comment edit When save close or Sheet close ends the lifecycle Then one finalizer deletes the artifact and closes the panel", () => {
    expect(messageSourcePopupSource).toContain("finalizeEmptyCommentEditor");
    expect(messageSourcePopupSource).toContain("closeCommentEditor({ deleteIfEmpty: true })");
    expect(messageSourcePopupSource).toContain("onSheetClosed={handleCommentEditorSheetClosed}");
    expect(messageSourcePopupSource).toContain("deleteActiveCommentAnchor({ closePanel: true })");

    expect(pendingAssetStripSource).toContain("finalizePendingCommentEdit");
    expect(pendingAssetStripSource).toContain("onCommentClose={finalizePendingCommentEdit}");
    expect(pendingAssetStripSource).toContain("onRemoveComment?.(previewingResource.id)");

    expect(resourcePreviewLayerSource).toContain("onCommentClose");
    expect(commentInspectorSource).toContain("finalizeEmptyAndClose");
    expect(commentInspectorSource).toContain("onSheetClosed={handleEditSheetClosed}");
  });

  test("Scenario: Given Framework7 owns a comment edit Sheet When empty delete closes it Then Svelte retains the component until SheetClosed", () => {
    expect(messageSourcePopupSource).toContain("commentEditorSheetAnchor");
    expect(messageSourcePopupSource).toContain("{#if $framework7Runtime && commentEditorSheetAnchor}");
    expect(messageSourcePopupSource).toContain("commentEditorSheetAnchor = null");
    expect(messageSourcePopupSource).toContain("closeByBackdropClick={false}");
    expect(messageSourcePopupSource).not.toContain("{#if $framework7Runtime && activeCommentAnchor && resolvedOpen}");

    expect(commentInspectorSource).toContain("editSheetMounted");
    expect(commentInspectorSource).toContain("{#if $framework7Runtime && effectiveCanEdit && editSheetMounted}");
    expect(commentInspectorSource).toContain("editSheetMounted = false");
    expect(commentInspectorSource).toContain("closeByBackdropClick={false}");
    expect(commentInspectorSource).not.toContain("{#if $framework7Runtime && effectiveCanEdit && open}");
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

  test("Scenario: Given comment anchor and inspector surfaces When reading the implementation Then empty comment bodies are absent instead of rendered as placeholder comments", () => {
    expect(messageSourcePopupSource).not.toContain("No comment body yet");
    expect(resourcePreviewLayerSource).not.toContain("No comment body yet");
    expect(commentInspectorSource).not.toContain("No comment body yet");
  });

  test("Scenario: Given comment surfaces When reading the implementation Then the requested dot comment icon and accessible icon actions are used", () => {
    for (const source of [
      messageSourcePopupSource,
      resourcePreviewLayerSource,
      commentInspectorSource,
      readFileSync(resolve(import.meta.dirname, "../src/comment-anchor-badge.svelte"), "utf8"),
      readFileSync(resolve(import.meta.dirname, "../src/resource-card.svelte"), "utf8"),
    ]) {
      expect(source).toContain("MessageSquareDot");
      expect(source).not.toContain("MessageSquareMore");
    }

    expect(messageSourcePopupSource).toContain('aria-label="Comment on selected source line"');
    expect(messageSourcePopupSource).toContain('aria-label="Cancel comment edit"');
    expect(messageSourcePopupSource).toContain('aria-label="Save comment"');
    expect(commentInspectorSource).toContain('aria-label={mode === "edit" ? "Cancel comment edit" : "Close comment"}');
    expect(commentInspectorSource).toContain('aria-label="Cancel comment edit"');
    expect(commentInspectorSource).toContain('aria-label="Save comment"');
  });
});
