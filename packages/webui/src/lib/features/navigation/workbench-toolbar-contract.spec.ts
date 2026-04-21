import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workbenchToolbarSource = readFileSync(resolve(import.meta.dirname, "workbench-toolbar.svelte"), "utf8");
const workbenchToolbarStructuredSource = readFileSync(
  resolve(import.meta.dirname, "workbench-toolbar-structured.svelte"),
  "utf8",
);

describe("Feature: Shared page-toolbar primitive contract", () => {
  test("Scenario: Given the toolbar is now the shared page-toolbar primitive When reading the source Then it exposes page-tabs, identity, status, actions, and overflow collapse state", () => {
    expect(workbenchToolbarSource).toContain("pageTabs?: Snippet<[WorkbenchToolbarRenderState]>");
    expect(workbenchToolbarSource).toContain("identityTitle?: Snippet<[WorkbenchToolbarRenderState]>");
    expect(workbenchToolbarSource).toContain("status?: Snippet<[WorkbenchToolbarRenderState]>");
    expect(workbenchToolbarSource).toContain("overflowLabel?: string");
    expect(workbenchToolbarSource).toContain("showOverflowTrigger");
  });

  test("Scenario: Given page-tabs and identity collapse differently When reading the structured toolbar source Then overflow remains a floating panel that never duplicates the page-anchor", () => {
    expect(workbenchToolbarStructuredSource).toContain("data-workbench-toolbar-anchor={inlineState.anchorKind}");
    expect(workbenchToolbarStructuredSource).toContain('data-workbench-toolbar-region="page-tabs"');
    expect(workbenchToolbarStructuredSource).toContain('data-workbench-toolbar-region="overflow-panel"');
    expect(workbenchToolbarStructuredSource).toContain('role="dialog"');
    expect(workbenchToolbarStructuredSource).toContain("showOverflowIdentity");
    expect(workbenchToolbarStructuredSource).not.toContain("DropdownMenu");
  });
});
