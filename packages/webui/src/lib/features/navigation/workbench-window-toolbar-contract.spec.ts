import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workbenchWindowSource = readFileSync(resolve(import.meta.dirname, "workbench-window.svelte"), "utf8");

describe("Feature: Workbench page toolbar height contract", () => {
  test("Scenario: Given the shared page toolbar is fixed-height When reading the workbench window source Then the toolbar stays 48px tall and no row multiplier remains", () => {
    expect(workbenchWindowSource).toContain("block-size: 48px;");
    expect(workbenchWindowSource).not.toContain("--workbench-page-toolbar-rows");
  });

  test("Scenario: Given both a layout toolbar and a page-toolbar portal exist When reading the workbench window source Then the portal host wins instead of creating a second stacked row", () => {
    expect(workbenchWindowSource).toContain("workbench-page-toolbar-local");
    expect(workbenchWindowSource).toContain(
      ".workbench-page-toolbar:has(.workbench-page-toolbar-host:not(:empty)) .workbench-page-toolbar-local",
    );
  });
});
