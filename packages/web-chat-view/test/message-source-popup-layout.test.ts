import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const sourcePopupSource = readFileSync(
  resolve(import.meta.dirname, "../src/message-source-popup.svelte"),
  "utf8",
);
const resourcePreviewShellSource = readFileSync(
  resolve(import.meta.dirname, "../src/resource-preview-shell.svelte"),
  "utf8",
);

describe("Feature: canonical message source popup contract", () => {
  test("Scenario: Given the shared popup source When reading the implementation Then it carries sender identity, line anchors, and copy confirmation", () => {
    expect(sourcePopupSource).toContain('showFramework7Toast("已复制全文")');
    expect(sourcePopupSource).toContain('data-line-number={index + 1}');
    expect(sourcePopupSource).toContain("message-source-navbar-name");
    expect(sourcePopupSource).toContain('aria-label={`Source for ${resolvedActor.label}`}');
    expect(sourcePopupSource).toContain("buildCommentResourceSourceUri");
    expect(sourcePopupSource).toContain("sourceUri: selectedSourceUri");
  });

  test("Scenario: Given Framework7 comment edit sheets When reading component CSS Then PageContent keeps Framework7 offset ownership and custom spacing moves to variables or inner shells", () => {
    const inspectorSource = readFileSync(
      resolve(import.meta.dirname, "../src/comment-inspector.svelte"),
      "utf8",
    );
    const pageContentRule =
      /:global\(\.message-source-comment-editor-content\.page-content\)\s*\{(?<body>[^}]*)\}/su.exec(
        sourcePopupSource,
      )?.groups?.body ?? "";
    const inspectorPageContentRule =
      /:global\(\.comment-inspector-edit-content\.page-content\)\s*\{(?<body>[^}]*)\}/su.exec(inspectorSource)
        ?.groups?.body ?? "";
    const toolbarRule =
      /:global\(\.message-source-comment-editor-toolbar \.toolbar-inner\)\s*\{(?<body>[^}]*)\}/su.exec(
        sourcePopupSource,
      )?.groups?.body ?? "";

    expect(pageContentRule).toContain("--f7-page-content-extra-padding-top");
    expect(pageContentRule).toContain("--f7-page-content-extra-padding-bottom");
    expect(pageContentRule).not.toMatch(/(?:^|;)\s*padding\s*:/u);
    expect(pageContentRule).not.toContain("env(safe-area-inset");

    expect(inspectorPageContentRule).toContain("--f7-page-content-extra-padding-top");
    expect(inspectorPageContentRule).toContain("--f7-page-content-extra-padding-bottom");
    expect(inspectorPageContentRule).not.toMatch(/(?:^|;)\s*padding\s*:/u);
    expect(inspectorPageContentRule).not.toContain("env(safe-area-inset");

    expect(toolbarRule).not.toContain("env(safe-area-inset");
    expect(sourcePopupSource).toContain(".message-source-comment-editor-shell");
    expect(inspectorSource).toContain(".comment-inspector-edit-shell");
  });

  test("Scenario: Given Framework7 comment edit sheets When reading component CSS Then Sheet and Toolbar chrome stay owned by official Framework7 styles", () => {
    const inspectorSource = readFileSync(
      resolve(import.meta.dirname, "../src/comment-inspector.svelte"),
      "utf8",
    );
    const sourceSheetRule =
      /:global\(\.message-source-comment-editor-sheet\.sheet-modal\)\s*\{(?<body>[^}]*)\}/su.exec(
        sourcePopupSource,
      )?.groups?.body ?? "";
    const sourceToolbarRule =
      /:global\(\.message-source-comment-editor-toolbar\.toolbar\)\s*\{(?<body>[^}]*)\}/su.exec(
        sourcePopupSource,
      )?.groups?.body ?? "";
    const inspectorSheetRule =
      /:global\(\.comment-inspector-edit-sheet\.sheet-modal\)\s*\{(?<body>[^}]*)\}/su.exec(inspectorSource)
        ?.groups?.body ?? "";
    const inspectorToolbarRule =
      /:global\(\.comment-inspector-edit-bar\.toolbar\)\s*\{(?<body>[^}]*)\}/su.exec(inspectorSource)
        ?.groups?.body ?? "";

    for (const rule of [sourceSheetRule, sourceToolbarRule, inspectorSheetRule, inspectorToolbarRule]) {
      expect(rule).not.toMatch(/(?:^|;)\s*background(?:-color)?\s*:/u);
      expect(rule).not.toMatch(/(?:^|;)\s*backdrop-filter\s*:/u);
      expect(rule).not.toContain("--f7-toolbar-bg-color: transparent");
      expect(rule).not.toContain("--f7-toolbar-height: auto");
    }

    expect(sourcePopupSource).toContain('<Toolbar class="message-source-comment-editor-toolbar">');
    expect(sourcePopupSource).toContain('<PageContent class="message-source-comment-editor-content">');
    expect(inspectorSource).toContain('<Toolbar class="comment-inspector-edit-bar">');
    expect(inspectorSource).toContain('<PageContent class="comment-inspector-edit-content">');
  });

  test("Scenario: Given Framework7 popup PageContent surfaces When reading component CSS Then general source and preview PageContent rules also avoid whole padding overrides", () => {
    const sourcePageContentRule =
      /:global\(\.message-source-page-content\.page-content\)\s*\{(?<body>[^}]*)\}/su.exec(sourcePopupSource)
        ?.groups?.body ?? "";
    const previewPageContentRule =
      /:global\(\.resource-preview-shell-page-content\.page-content\)\s*\{(?<body>[^}]*)\}/su.exec(
        resourcePreviewShellSource,
      )?.groups?.body ?? "";
    const previewFooterRule =
      /:global\(\.resource-preview-shell-page\[data-has-footer="true"\] \.resource-preview-shell-page-content\.page-content\)\s*\{(?<body>[^}]*)\}/su.exec(
        resourcePreviewShellSource,
      )?.groups?.body ?? "";

    for (const rule of [sourcePageContentRule, previewPageContentRule, previewFooterRule]) {
      expect(rule).not.toMatch(/(?:^|;)\s*padding(?:-[a-z-]+)?\s*:/u);
      expect(rule).not.toContain("env(safe-area-inset");
    }

    expect(sourcePageContentRule).toContain("--f7-page-content-extra-padding-top");
    expect(sourcePageContentRule).toContain("--f7-page-content-extra-padding-bottom");
    expect(previewPageContentRule).toContain("--f7-page-content-extra-padding-top");
    expect(previewPageContentRule).toContain("--f7-page-content-extra-padding-bottom");
    expect(previewFooterRule).toContain("--f7-page-content-extra-padding-bottom");
    expect(sourcePopupSource).toContain(".message-source-page-content-inner");
    expect(resourcePreviewShellSource).toContain(".resource-preview-shell-body");
  });

  test("Scenario: Given Framework7 Page manually renders PageContent When reading the popup shell Then automatic PageContent wrapping is disabled", () => {
    expect(sourcePopupSource).toContain('<Page class="message-source-page" pageContent={false} noSwipeback>');
    expect(resourcePreviewShellSource).toContain('pageContent={false}');
    expect(sourcePopupSource).toContain('<PageContent class="message-source-page-content">');
    expect(resourcePreviewShellSource).toContain('<PageContent class="resource-preview-shell-page-content">');
  });
});
