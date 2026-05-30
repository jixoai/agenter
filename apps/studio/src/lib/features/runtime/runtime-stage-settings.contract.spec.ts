import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const settingsStageSource = readFileSync(resolve(import.meta.dirname, "runtime-stage-settings.svelte"), "utf8");
const primaryStageSource = readFileSync(resolve(import.meta.dirname, "runtime-primary-stage.svelte"), "utf8");

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
});
