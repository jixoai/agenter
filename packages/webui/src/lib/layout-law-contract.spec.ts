import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, test } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..", "..");
const layoutManagedFiles = [
  "src/lib/features/messages/message-room-manage-dialog.svelte",
  "src/lib/features/messages/message-system-surface.svelte",
  "src/lib/features/runtime/runtime-primary-stage.svelte",
  "src/lib/features/runtime/runtime-shell.svelte",
  "src/lib/features/settings/superadmin-onboarding-dialog.svelte",
  "src/lib/features/terminals/terminal-system-surface.svelte",
];
const routeManagedFiles = [
  "src/lib/features/settings/admin-route.svelte",
  "src/lib/features/settings/settings-route.svelte",
  "src/lib/features/settings/workspace-settings-route.svelte",
  "src/lib/features/workspaces/history-route.svelte",
  "src/lib/features/workspaces/workspaces-route.svelte",
];
const scaffoldManagedFiles = [...layoutManagedFiles, ...routeManagedFiles];
const scanRoots = [resolve(packageRoot, "src/lib/features"), resolve(packageRoot, "src/routes")];

const walkFiles = (root: string): string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const nextPath = join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(nextPath));
      continue;
    }
    if (![".svelte", ".ts"].includes(extname(entry.name))) {
      continue;
    }
    results.push(nextPath);
  }
  return results;
};

describe("Feature: Scaffold-family layout law", () => {
  test("Scenario: Given high-risk WebUI surfaces When reading their source Then they derive page or dialog shells from shared layout primitives", () => {
    const violations = scaffoldManagedFiles.filter((relativePath) => {
      const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
      return !source.includes("@agenter/svelte-components") && !source.includes("workbench-scaffold.svelte");
    });

    expect(violations).toEqual([]);
  });

  test("Scenario: Given high-risk layout-managed surfaces When scanning imports Then direct ScrollView imports stay out of feature code", () => {
    const violations = scaffoldManagedFiles.filter((relativePath) => {
      const source = readFileSync(resolve(packageRoot, relativePath), "utf8");
      return source.includes("$lib/components/scroll-view.svelte");
    });

    expect(violations).toEqual([]);
  });

  test("Scenario: Given feature and route code When scanning imports Then compatibility PanelShell no longer appears", () => {
    const violations = scanRoots
      .flatMap((root) => walkFiles(root))
      .filter((filePath) => readFileSync(filePath, "utf8").includes("$lib/components/panel-shell.svelte"))
      .map((filePath) => relative(packageRoot, filePath));

    expect(violations).toEqual([]);
  });

  test("Scenario: Given feature and route code When scanning imports Then local ScrollView forwarding no longer appears", () => {
    const violations = scanRoots
      .flatMap((root) => walkFiles(root))
      .filter((filePath) => readFileSync(filePath, "utf8").includes("$lib/components/scroll-view.svelte"))
      .map((filePath) => relative(packageRoot, filePath));

    expect(violations).toEqual([]);
  });

  test("Scenario: Given runtime scaffolds When scanning feature code Then the deprecated runtime secondary rail no longer competes with the primary stage", () => {
    const violations = scanRoots
      .flatMap((root) => walkFiles(root))
      .filter((filePath) => readFileSync(filePath, "utf8").includes("runtime-secondary-rail"))
      .map((filePath) => relative(packageRoot, filePath));

    expect(violations).toEqual([]);
  });
});
