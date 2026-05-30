import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workbenchWindowSource = readFileSync(resolve(import.meta.dirname, "workbench-window.svelte"), "utf8");

describe("Feature: Workbench page toolbar layout contract", () => {
  test("Scenario: Given the shared page toolbar uses a fixed chrome row When reading the workbench window source Then the host keeps the 48px baseline instead of stacking arbitrary extra toolbar rows", () => {
    expect(workbenchWindowSource).toContain("block-size: 48px;");
    expect(workbenchWindowSource).not.toContain("--workbench-page-toolbar-rows");
    expect(workbenchWindowSource).not.toContain("grid-auto-rows: minmax(0, 1fr);");
  });

  test("Scenario: Given local and page-level toolbar sources may coexist in the tree When reading the workbench window source Then the shell chooses a single owner and reserves takeover only for close ownership", () => {
    expect(workbenchWindowSource).toContain("if (pageToolbarRegistry.portalOwnerCount > 0)");
    expect(workbenchWindowSource).toContain("data-toolbar-owner={pageToolbarOwner}");
    expect(workbenchWindowSource).toContain("{#if pageToolbarOwner === 'local' && toolbar}");
    expect(workbenchWindowSource).toContain(".workbench-page-toolbar[data-toolbar-owner='none']");
    expect(workbenchWindowSource).toContain(".workbench-page-toolbar[data-toolbar-owner='takeover']");
    expect(workbenchWindowSource).toContain("workbench-page-toolbar-takeover");
  });
});
