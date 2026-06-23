import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const settingsStageSource = readFileSync(resolve(import.meta.dirname, "runtime-stage-settings.svelte"), "utf8");
const primaryStageSource = readFileSync(resolve(import.meta.dirname, "runtime-primary-stage.svelte"), "utf8");
const workspaceSettingsPanelSource = readFileSync(
  resolve(import.meta.dirname, "../settings/workspace-settings-panel.svelte"),
  "utf8",
);

describe("Feature: Runtime settings stage hydration contract", () => {
  test("Scenario: Given runtime events replace runtime objects frequently When reading the settings stage source Then graph hydration is keyed by session identity instead of runtime prop churn", () => {
    expect(settingsStageSource).toContain("let settingsSessionId = $state<string | null>(null);");
    expect(settingsStageSource).toContain("const nextSessionId = session.id;");
    expect(settingsStageSource).toContain("if (settingsSessionId === nextSessionId) {");
    expect(settingsStageSource).toContain("void loadSettingsGraph(null);");
    expect(settingsStageSource).not.toContain("void runtime;");
  });

  test("Scenario: Given the runtime primary stage renders settings When reading the stage switch Then only the session identity is forwarded into the settings panel", () => {
    expect(primaryStageSource).toContain("<RuntimeStageSettings {session} />");
    expect(primaryStageSource).not.toContain("<RuntimeStageSettings {session} {runtime} />");
  });

  test("Scenario: Given runtime settings are loading When no graph data exists Then the shared settings panel uses Skeleton only as a missing-data placeholder", () => {
    expect(workspaceSettingsPanelSource).toContain("import * as Skeleton from '$lib/components/ui/skeleton/index.js';");
    expect(workspaceSettingsPanelSource).toContain("const loadingWithoutData = $derived(loading && layers.length === 0 && !selectedLayerId)");
    expect(workspaceSettingsPanelSource).toContain("const refreshingWithData = $derived(loading && !loadingWithoutData)");
    expect(workspaceSettingsPanelSource).toContain('data-testid="workspace-settings-skeleton"');
    expect(workspaceSettingsPanelSource).toContain("<Skeleton.Root");
    expect(workspaceSettingsPanelSource).toContain("refreshingWithData ? 'Refreshing…' : status");
    expect(workspaceSettingsPanelSource).not.toContain("Loading workspace settings…");
  });
});
