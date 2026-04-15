import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workbenchPageContentSource = readFileSync(
  resolve(import.meta.dirname, "workbench-page-content.svelte"),
  "utf8",
);

describe("Feature: Workbench page content responsive contract", () => {
  test("Scenario: Given desktop page content When reading the shared layout source Then the drawer can span beside both main and bottom regions", () => {
    expect(workbenchPageContentSource).toContain("data-workbench-page-content-region=\"main\"");
    expect(workbenchPageContentSource).toContain("data-workbench-page-content-region=\"bottom\"");
    expect(workbenchPageContentSource).toContain("data-workbench-page-content-region=\"drawer\"");
    expect(workbenchPageContentSource).toContain("lg:col-start-2 lg:row-span-2");
  });

  test("Scenario: Given compact page content When reading the shared layout source Then the same regions stack in one column before the drawer becomes persistent", () => {
    expect(workbenchPageContentSource).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(workbenchPageContentSource).toContain("grid-template-rows: auto auto auto;");
    expect(workbenchPageContentSource).toContain("desktopColumnsClass = 'lg:grid-cols-[minmax(0,1fr)_22rem]'");
  });

  test("Scenario: Given split-detail adopters When reading the shared page-content source Then compact fallback comes from the shared split primitive instead of viewport matchMedia", () => {
    expect(workbenchPageContentSource).toContain("detailLayout = 'static'");
    expect(workbenchPageContentSource).toContain("WorkbenchSplitDetail.Root");
    expect(workbenchPageContentSource).toContain("bind:compact={detailCompact}");
    expect(workbenchPageContentSource).toContain("showDefaultClose={false}");
    expect(workbenchPageContentSource).toContain("workbench-page-content__detail-sheet-layer");
    expect(workbenchPageContentSource).toContain("portalProps={detailSheetHost ? { to: detailSheetHost } : undefined}");
    expect(workbenchPageContentSource).toContain("workbench-page-content__detail-sheet-overlay");
    expect(workbenchPageContentSource).not.toContain("matchMedia(");
  });
});
