import { describe, expect, test } from "vitest";

import {
  appOptimizeDepsInclude,
  appVitestOptimizeDepsInclude,
  TERMINAL_VIEW_WORKSPACE_PACKAGE,
  workspaceSourceDependencyExcludes,
} from "./vite-dependency-optimization";

describe("Feature: WebUI Vite dependency optimization law", () => {
  test("Scenario: Given the terminal-view workspace package When WebUI defines optimizeDeps Then terminal-view stays excluded from prebundling", () => {
    expect(workspaceSourceDependencyExcludes).toContain(TERMINAL_VIEW_WORKSPACE_PACKAGE);
    expect(appOptimizeDepsInclude).not.toContain(TERMINAL_VIEW_WORKSPACE_PACKAGE);
  });

  test("Scenario: Given browser-based Vitest hosts When optimizeDeps are resolved Then terminal-view is prebundled up front to avoid mid-run optimize reloads", () => {
    expect(appVitestOptimizeDepsInclude).toContain(TERMINAL_VIEW_WORKSPACE_PACKAGE);
  });
});
