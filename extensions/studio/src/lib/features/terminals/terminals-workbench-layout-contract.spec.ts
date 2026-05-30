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

  test("Scenario: Given terminal history is now an explicit product surface When reading the workbench source Then the shell exposes a dedicated History tab and route-specific active tab ids", () => {
    expect(terminalsWorkbenchLayoutSource).toContain("if (page.url.pathname === '/terminals/history')");
    expect(terminalsWorkbenchLayoutSource).toContain("id: 'terminal-history'");
    expect(terminalsWorkbenchLayoutSource).toContain("href: '/terminals/history'");
    expect(terminalsWorkbenchLayoutSource).toContain("label: 'Index'");
    expect(terminalsWorkbenchLayoutSource).toContain("controller.runtimeState.globalTerminalIndex.data");
    expect(terminalsWorkbenchLayoutSource).toContain("badgeLabel: String(indexTerminals.length)");
    expect(terminalsWorkbenchLayoutSource).toContain("Live terminals appear first, then killed terminals in reverse stop order.");
    expect(terminalsWorkbenchLayoutSource).toContain("if (page.url.pathname === '/terminals/new')");
  });

  test("Scenario: Given archived terminals remain inspectable after leaving history When reading the workbench source Then the shell exposes a dedicated Archive tab instead of making archived evidence disappear", () => {
    expect(terminalsWorkbenchLayoutSource).toContain("if (page.url.pathname === '/terminals/archive')");
    expect(terminalsWorkbenchLayoutSource).toContain("id: 'terminal-archive'");
    expect(terminalsWorkbenchLayoutSource).toContain("href: '/terminals/archive'");
  });
});
