import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const webChatViewRootSource = readFileSync(resolve(import.meta.dirname, "../src/web-chat-view-root.svelte"), "utf8");
const defaultComposerSource = readFileSync(resolve(import.meta.dirname, "../src/default-composer.svelte"), "utf8");
const resourcePreviewLayerSource = readFileSync(
  resolve(import.meta.dirname, "../src/resource-preview-layer.svelte"),
  "utf8",
);
const resourcePreviewShellSource = readFileSync(
  resolve(import.meta.dirname, "../src/resource-preview-shell.svelte"),
  "utf8",
);
const reviewShellClientSource = readFileSync(
  resolve(import.meta.dirname, "../example/src/lib/review-shell-client.svelte"),
  "utf8",
);

describe("Feature: composer resource scope contract", () => {
  test("Scenario: Given transcript messages have resources When composer completion is built Then only current-draft resources enter the composer resource pool", () => {
    expect(webChatViewRootSource).toContain("const composerScopedResourceReferences");
    expect(webChatViewRootSource).toContain("commentResourceToReference(resource)");
    expect(webChatViewRootSource).toContain("const existingCommentCount = draftedCommentResources.length");
    expect(webChatViewRootSource).not.toContain("const transcriptResourceReferences");
    expect(webChatViewRootSource).not.toContain("resolveMessageResourceReferences");
    expect(reviewShellClientSource).not.toContain("resourceReferences: shellState.resourceReferences");
  });

  test("Scenario: Given a pending image or file is accepted When upload completes Then the composer opens that resource preview immediately", () => {
    expect(defaultComposerSource).toContain("const acceptedAssets = merged.map((file) => createPendingAsset(file))");
    expect(defaultComposerSource).toContain("previewingEditorResourceId = acceptedAssets[0].id");
    expect(defaultComposerSource).toContain("if (previewingEditorResourceId === assetId)");
  });

  test("Scenario: Given an image or file preview opens When header copy is rendered Then the eyebrow is the reference label instead of the extension", () => {
    expect(resourcePreviewLayerSource).toContain("const resolvedReferenceLabel");
    expect(resourcePreviewLayerSource).toContain("eyebrow={resolvedReferenceLabel}");
    expect(resourcePreviewLayerSource).not.toContain("eyebrow={resolvedExtension}");
    expect(resourcePreviewShellSource).toContain("letter-spacing: 0;");
    expect(resourcePreviewShellSource).not.toContain("text-transform: uppercase");
  });
});
