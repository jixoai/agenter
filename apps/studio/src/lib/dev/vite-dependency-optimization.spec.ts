import { describe, expect, test } from "vitest";

import {
  appOptimizeDepsInclude,
  appVitestOptimizeDepsInclude,
  JIXO_CODEMIRROR_WORKSPACE_PACKAGE,
  TERMINAL_VIEW_WORKSPACE_PACKAGE,
  workspaceSourceDependencyExcludes,
} from "./vite-dependency-optimization";

describe("Feature: Studio Vite dependency optimization law", () => {
  test("Scenario: Given the terminal-view workspace package When Studio defines optimizeDeps Then terminal-view stays excluded from prebundling", () => {
    expect(workspaceSourceDependencyExcludes).toContain(TERMINAL_VIEW_WORKSPACE_PACKAGE);
    expect(appOptimizeDepsInclude).not.toContain(TERMINAL_VIEW_WORKSPACE_PACKAGE);
  });

  test("Scenario: Given the CodeMirror workspace package When Studio defines optimizeDeps Then Svelte source stays outside prebundling", () => {
    expect(workspaceSourceDependencyExcludes).toContain(JIXO_CODEMIRROR_WORKSPACE_PACKAGE);
    expect(appOptimizeDepsInclude).not.toContain(JIXO_CODEMIRROR_WORKSPACE_PACKAGE);
  });

  test("Scenario: Given Notes Query uses SQL CodeMirror When Studio defines optimizeDeps Then the SQL language package is deduped with the other CodeMirror atoms", () => {
    expect(appOptimizeDepsInclude).toContain("@codemirror/lang-sql");
  });

  test("Scenario: Given browser-based Vitest hosts When optimizeDeps are resolved Then terminal-view is prebundled up front to avoid mid-run optimize reloads", () => {
    expect(appVitestOptimizeDepsInclude).toContain(TERMINAL_VIEW_WORKSPACE_PACKAGE);
  });
});
