import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workbenchWindowSource = readFileSync(resolve(import.meta.dirname, "workbench-window.svelte"), "utf8");

describe("Feature: Workbench page toolbar layout contract", () => {
  test("Scenario: Given the shared page toolbar uses a 48px row baseline When reading the workbench window source Then the toolbar keeps a single-row baseline and can expand by row count instead of arbitrary heights", () => {
    expect(workbenchWindowSource).toContain("--workbench-page-toolbar-rows: 1;");
    expect(workbenchWindowSource).toContain("block-size: calc(var(--workbench-page-toolbar-rows) * 48px);");
    expect(workbenchWindowSource).toContain("grid-auto-rows: minmax(0, 1fr);");
  });

  test("Scenario: Given both a local toolbar and a page-toolbar portal exist When reading the workbench window source Then the shell adds a second row while preserving takeover exclusivity", () => {
    expect(workbenchWindowSource).toContain("data-has-local-toolbar={toolbar && !pageToolbarRegistry.takeover ? 'true' : 'false'}");
    expect(workbenchWindowSource).toContain("data-has-takeover={pageToolbarRegistry.takeover ? 'true' : 'false'}");
    expect(workbenchWindowSource).toContain(
      ".workbench-page-toolbar[data-has-local-toolbar='true']:has(.workbench-page-toolbar-host:not(:empty))",
    );
    expect(workbenchWindowSource).toContain(".workbench-page-toolbar[data-has-takeover='true']");
    expect(workbenchWindowSource).toContain("workbench-page-toolbar-takeover");
  });
});
