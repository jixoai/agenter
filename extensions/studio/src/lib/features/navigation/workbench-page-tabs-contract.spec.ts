import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workbenchPageTabsSource = readFileSync(resolve(import.meta.dirname, "workbench-page-tabs.svelte"), "utf8");
const workbenchToolbarStructuredSource = readFileSync(
  resolve(import.meta.dirname, "workbench-toolbar-structured.svelte"),
  "utf8",
);
const workbenchToolbarHarnessSource = readFileSync(
  resolve(import.meta.dirname, "workbench-toolbar.story-harness.svelte"),
  "utf8",
);
const runtimeTabBarSource = readFileSync(resolve(import.meta.dirname, "../runtime/runtime-tab-bar.svelte"), "utf8");
const roomPageToolbarContentSource = readFileSync(
  resolve(import.meta.dirname, "../messages/room-page-toolbar-content.svelte"),
  "utf8",
);

describe("Feature: Shared page-tabs primitive contract", () => {
  test("Scenario: Given page-tabs are a shared leaf primitive When reading the source Then the component owns scroll viewport, tabs list, and trigger geometry in one place", () => {
    expect(workbenchPageTabsSource).toContain("import { Tabs as TabsPrimitive } from 'bits-ui';");
    expect(workbenchPageTabsSource).toContain("<ScrollView");
    expect(workbenchPageTabsSource).toContain('class="workbench-page-tabs__trigger"');
    expect(workbenchPageTabsSource).toContain(":global(.workbench-page-tabs__viewport)");
    expect(workbenchPageTabsSource).toContain(":global(.workbench-page-tabs__list)");
  });

  test("Scenario: Given toolbar tabs must not be rebuilt per feature When reading the consumers Then runtime, messages, and harness reuse WorkbenchPageTabs instead of local Tabs.List token stacks", () => {
    expect(runtimeTabBarSource).toContain("<WorkbenchPageTabs");
    expect(runtimeTabBarSource).not.toContain("Tabs.List");
    expect(roomPageToolbarContentSource).toContain("<WorkbenchPageTabs");
    expect(roomPageToolbarContentSource).not.toContain("Tabs.Trigger");
    expect(workbenchToolbarHarnessSource).toContain("<WorkbenchPageTabs");
    expect(workbenchToolbarHarnessSource).not.toContain("Tabs.Root");
  });

  test("Scenario: Given page-tabs shadows must remain visible When reading the structured toolbar source Then the page-tabs region no longer clips overflow", () => {
    expect(workbenchToolbarStructuredSource).toContain(".workbench-toolbar__page-tabs {");
    expect(workbenchToolbarStructuredSource).toMatch(
      /\.workbench-toolbar__page-tabs\s*\{[^}]*overflow:\s*visible;/,
    );
    expect(workbenchToolbarStructuredSource).not.toMatch(
      /\.workbench-toolbar__page-tabs\s*\{[^}]*overflow:\s*hidden;/,
    );
  });
});
