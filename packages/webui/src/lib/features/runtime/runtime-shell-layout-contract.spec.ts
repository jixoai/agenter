import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const runtimeShellSource = readFileSync(resolve(import.meta.dirname, "runtime-shell.svelte"), "utf8");
const runtimePageToolbarSource = readFileSync(
  resolve(import.meta.dirname, "runtime-page-toolbar-content.svelte"),
  "utf8",
);

describe("Feature: Runtime shell toolbar contract", () => {
  test("Scenario: Given runtime chrome belongs to the shared page toolbar When reading the runtime shell source Then it injects toolbar content instead of reviving a body header", () => {
    expect(runtimeShellSource).toContain("<WorkbenchPageToolbar>");
    expect(runtimeShellSource).toContain("<RuntimePageToolbarContent");
    expect(runtimeShellSource).not.toContain("<Scaffold.Header");
  });

  test("Scenario: Given runtime tabs must live inside the shared toolbar law When reading the toolbar content source Then the toolbar renders the tab strip beside title and start stop controls through WorkbenchToolbar", () => {
    expect(runtimePageToolbarSource).toContain("<WorkbenchToolbar");
    expect(runtimePageToolbarSource).toContain("<RuntimeTabBar");
    expect(runtimePageToolbarSource).toContain("Stop");
    expect(runtimePageToolbarSource).toContain("Start");
  });
});
