import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");

const defaultComposerSource = readSource("src/default-composer.svelte");
const messageActionsMenuSource = readSource("src/message-actions-menu.svelte");
const messageActionsContextMenuSource = readSource("src/message-actions-context-menu.svelte");
const selectionActionSurfaceSource = readSource("src/selection-action-surface.svelte");
const resourcePreviewShellSource = readSource("src/resource-preview-shell.svelte");
const messageSourcePopupSource = readSource("src/message-source-popup.svelte");

const extractRuleBody = (source: string, selectorPattern: RegExp): string =>
  selectorPattern.exec(source)?.groups?.body ?? "";

const expectNoModalChromeRepaint = (ruleBody: string): void => {
  expect(ruleBody).not.toMatch(/(?:^|;)\s*position\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*inset(?:-[a-z-]+)?\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*bottom\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*padding(?:-[a-z-]+)?\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*background(?:-color)?\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*backdrop-filter\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*border-radius\s*:/u);
  expect(ruleBody).not.toMatch(/(?:^|;)\s*box-shadow\s*:/u);
};

describe("Feature: Framework7 modal encapsulation for Web Chat", () => {
  test("Scenario: Given the composer tool tray When reading source Then it uses a shared MessagebarSheet wrapper without repainting sheet chrome", () => {
    const composerToolSheetSource = readSource("src/composer/composer-tool-sheet.svelte");
    const sheetRule = extractRuleBody(
      composerToolSheetSource,
      /:global\(\.web-chat-f7-composer-tool-sheet\.messagebar-sheet\)\s*\{(?<body>[^}]*)\}/su,
    );

    expect(defaultComposerSource).toContain("<ComposerToolSheet");
    expect(defaultComposerSource).not.toMatch(/<MessagebarSheet(?!Item)/u);
    expect(defaultComposerSource).toContain("<MessagebarSheetItem");
    expect(defaultComposerSource).not.toMatch(/\{#if\s+toolsSheetVisible\}\s*<ComposerToolSheet/su);
    expect(defaultComposerSource).toContain("sheetVisible={toolsSheetVisible}");
    expect(composerToolSheetSource).toContain("<MessagebarSheet");
    expectNoModalChromeRepaint(sheetRule);
  });

  test("Scenario: Given contextual message and source actions When reading source Then all live modal creation is centralized in one Framework7 Actions adapter", () => {
    const actionSurfaceSource = readSource("src/framework7-action-surface.svelte");

    expect(actionSurfaceSource).toContain("actions.create");
    expect(actionSurfaceSource).toContain("convertToPopover: true");
    expect(actionSurfaceSource).toContain("forceToPopover");
    expect(actionSurfaceSource).not.toContain("backdrop-filter");

    for (const source of [
      messageActionsMenuSource,
      messageActionsContextMenuSource,
      selectionActionSurfaceSource,
    ]) {
      expect(source).toContain("<Framework7ActionSurface");
      expect(source).not.toContain("actions.create");
      expect(source).not.toContain("Framework7AppWithActions");
      expect(source).not.toContain("backdrop-filter");
    }
  });

  test("Scenario: Given popup temporary views When reading source Then popup toolbar and navbar chrome are left to Framework7", () => {
    const previewPopupRule = extractRuleBody(
      resourcePreviewShellSource,
      /:global\(\.resource-preview-shell-popup\)\s*\{(?<body>[^}]*)\}/su,
    );
    const previewToolbarRule = extractRuleBody(
      resourcePreviewShellSource,
      /:global\(\.resource-preview-shell-toolbar\.toolbar\)\s*\{(?<body>[^}]*)\}/su,
    );
    const previewToolbarInnerRule = extractRuleBody(
      resourcePreviewShellSource,
      /:global\(\.resource-preview-shell-toolbar \.toolbar-inner\)\s*\{(?<body>[^}]*)\}/su,
    );
    const sourceSelectionToolbarRule = extractRuleBody(
      messageSourcePopupSource,
      /:global\(\.message-source-selection-toolbar\.toolbar\)\s*\{(?<body>[^}]*)\}/su,
    );
    const sourceSelectionToolbarInnerRule = extractRuleBody(
      messageSourcePopupSource,
      /:global\(\.message-source-selection-toolbar \.toolbar-inner\)\s*\{(?<body>[^}]*)\}/su,
    );

    for (const rule of [
      previewPopupRule,
      previewToolbarRule,
      previewToolbarInnerRule,
      sourceSelectionToolbarRule,
      sourceSelectionToolbarInnerRule,
    ]) {
      expect(rule).not.toContain("env(safe-area-inset");
      expect(rule).not.toMatch(/(?:^|;)\s*background(?:-color)?\s*:/u);
      expect(rule).not.toMatch(/(?:^|;)\s*backdrop-filter\s*:/u);
      expect(rule).not.toMatch(/(?:^|;)\s*padding(?:-[a-z-]+)?\s*:/u);
    }

    expect(resourcePreviewShellSource).not.toContain('style="--f7-glass-bg-color');
    expect(messageSourcePopupSource).not.toContain('style="--f7-glass-bg-color');
  });
});
