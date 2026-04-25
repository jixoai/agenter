import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const layoutPrimitiveFiles = [
  "src/layout/clip-surface.svelte",
  "src/layout/scaffold/scaffold-root.svelte",
  "src/layout/scaffold/scaffold-body.svelte",
  "src/layout/scaffold/scaffold-scroll-body.svelte",
  "src/layout/sidebar-scaffold/sidebar-scaffold-root.svelte",
  "src/layout/sidebar-scaffold/sidebar-scaffold-sidebar.svelte",
  "src/layout/sidebar-scaffold/sidebar-scaffold-content.svelte",
  "src/layout/workbench-split-detail/workbench-split-detail-root.svelte",
  "src/layout/workbench-split-detail/workbench-split-detail-main.svelte",
  "src/layout/workbench-split-detail/workbench-split-detail-handle.svelte",
  "src/layout/workbench-split-detail/workbench-split-detail-detail.svelte",
];

const dialogScaffoldWrapperFiles = [
  "src/layout/dialog-scaffold/dialog-scaffold-root.svelte",
  "src/layout/dialog-scaffold/dialog-scaffold-header.svelte",
  "src/layout/dialog-scaffold/dialog-scaffold-scroll-body.svelte",
  "src/layout/dialog-scaffold/dialog-scaffold-footer.svelte",
];

describe("Feature: svelte-components layout foundation", () => {
  test("Scenario: Given shared layout primitives When reviewing shrink-law hooks Then they keep internal layout-role anchors", () => {
    const violations = layoutPrimitiveFiles.filter((relativePath) => {
      const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
      return !source.includes("data-layout-role=");
    });

    expect(violations).toEqual([]);
  });

  test("Scenario: Given scaffold roots without optional slots When reviewing source Then slot rows stay explicit inside the shared package", () => {
    const scaffoldRootSource = readFileSync(resolve(packageRoot, "src/layout/scaffold/scaffold-root.svelte"), "utf8");

    expect(scaffoldRootSource).toContain('data-slot="scaffold-body"');
    expect(scaffoldRootSource).toContain('data-slot="scaffold-scroll-body"');
    expect(scaffoldRootSource).toContain("grid-row: 2");
  });

  test("Scenario: Given dialog scaffold wrappers When reviewing source Then they preserve scaffold slot ownership and add dialog-only markers separately", () => {
    for (const relativePath of dialogScaffoldWrapperFiles) {
      const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
      expect(source).toContain("data-dialog-scaffold-slot=");
      expect(source).not.toContain('data-slot="dialog-scaffold');
    }
  });

  test("Scenario: Given sidebar scaffold When reviewing source Then responsive columns are owned by package-local media rules", () => {
    const sidebarScaffoldSource = readFileSync(
      resolve(packageRoot, "src/layout/sidebar-scaffold/sidebar-scaffold-root.svelte"),
      "utf8",
    );

    expect(sidebarScaffoldSource).toContain("@media (min-width: 768px)");
    expect(sidebarScaffoldSource).toContain('data-layout-role="sidebar-scaffold-root"');
    expect(sidebarScaffoldSource).not.toContain("md:grid-cols");
    expect(sidebarScaffoldSource).not.toContain("xl:grid-cols");
  });

  test("Scenario: Given shared layout primitives When reading style selectors Then Tailwind utility display overrides remain available", () => {
    const violations = layoutPrimitiveFiles.filter((relativePath) => {
      const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
      return source.includes("[data-layout-role=") && !source.includes(":where([data-layout-role=");
    });

    expect(violations).toEqual([]);
  });

  test("Scenario: Given the package export surface When reading index.ts Then ScrollView and scaffold-family namespaces are exported together", () => {
    const source = readFileSync(resolve(packageRoot, "src/index.ts"), "utf8");

    expect(source).toContain("export { default as ScrollView }");
    expect(source).toContain("export * as Scaffold");
    expect(source).toContain("export * as DialogScaffold");
    expect(source).toContain("export * as SidebarScaffold");
    expect(source).not.toContain("export * as Spli" + "tView");
    expect(source).toContain("export * as WorkbenchSplitDetail");
    expect(source).toContain("export { default as ClipSurface }");
  });

  test("Scenario: Given dynamically measured virtual rows When reviewing ScrollView source Then the wrapper does not clamp the main axis before measurement", () => {
    const source = readFileSync(resolve(packageRoot, "src/scroll-view.svelte"), "utf8");

    expect(source).toContain("const resolveVirtualItemStyle");
    expect(source).toContain('dynamicMeasure ? "" : `inline-size:${virtualItem.size}px;`');
    expect(source).toContain('dynamicMeasure ? "" : `block-size:${virtualItem.size}px;`');
    expect(source).not.toContain("inline-size: 100%;\n  }");
  });
});
