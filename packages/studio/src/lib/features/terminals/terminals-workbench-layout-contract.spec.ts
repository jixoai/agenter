import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const terminalsWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "terminals-workbench-layout.svelte"),
  "utf8",
);

describe("Feature: Terminals shell toolbar contract", () => {
  test("Scenario: Given selected terminal identity now belongs to the route page-toolbar When reading the shell source Then the outer workbench window stays a neutral host without reviving static Shared terminals copy", () => {
    expect(terminalsWorkbenchLayoutSource).toContain('bodyMode="fill"');
    expect(terminalsWorkbenchLayoutSource).toContain('bodyClass="rounded-none border-0 bg-transparent shadow-none"');
    expect(terminalsWorkbenchLayoutSource).not.toContain("Shared terminals");
    expect(terminalsWorkbenchLayoutSource).not.toContain("WorkbenchToolbarStatus");
    expect(terminalsWorkbenchLayoutSource).not.toContain("toolbar={terminalsToolbar}");
  });
});
