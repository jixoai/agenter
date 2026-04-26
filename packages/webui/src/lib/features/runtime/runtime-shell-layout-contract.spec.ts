import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const runtimeShellSource = readFileSync(resolve(import.meta.dirname, "runtime-shell.svelte"), "utf8");
const runtimePageToolbarSource = readFileSync(
  resolve(import.meta.dirname, "runtime-page-toolbar-content.svelte"),
  "utf8",
);
const runtimeHeartbeatStageSource = readFileSync(
  resolve(import.meta.dirname, "runtime-stage-heartbeat.svelte"),
  "utf8",
);

describe("Feature: Runtime shell toolbar contract", () => {
  test("Scenario: Given runtime chrome belongs to the shared page toolbar When reading the runtime shell source Then it injects toolbar content instead of reviving a body header", () => {
    expect(runtimeShellSource).toContain("<WorkbenchPageToolbar>");
    expect(runtimeShellSource).toContain("<RuntimePageToolbarContent");
    expect(runtimeShellSource).not.toContain("<Scaffold.Header");
  });

  test("Scenario: Given runtime tabs must live inside the shared toolbar law When reading the toolbar content source Then the toolbar binds page-tabs, identity, status, and actions through the shared primitive", () => {
    expect(runtimePageToolbarSource).toContain("<WorkbenchToolbar");
    expect(runtimePageToolbarSource).toContain("pageTabs={runtimeToolbarPageTabs}");
    expect(runtimePageToolbarSource).toContain("identityTitle={runtimeToolbarIdentityTitle}");
    expect(runtimePageToolbarSource).toContain("status={runtimeToolbarStatus}");
    expect(runtimePageToolbarSource).toContain("actions={runtimeToolbarActions}");
    expect(runtimePageToolbarSource).toContain("<RuntimeTabBar");
  });

  test("Scenario: Given runtime lifecycle actions can fail When reading the shell sources Then toolbar pending state and route-level notices stay wired into the shared shell", () => {
    expect(runtimeShellSource).toContain("runtimeTogglePending");
    expect(runtimeShellSource).toContain("runtimeToggleError");
    expect(runtimeShellSource).toContain("Runtime action failed");
    expect(runtimeShellSource).toContain("<NoticeBanner");
    expect(runtimeShellSource).toContain("runtimeActionPending={runtimeTogglePending}");
    expect(runtimePageToolbarSource).toContain("disabled={runtimeActionPending}");
  });

  test("Scenario: Given Heartbeat owns an inner scroll viewport When reading the stage source Then the stage itself stays shrinkable instead of expanding past the workbench body", () => {
    expect(runtimeHeartbeatStageSource).toContain('class="runtime-heartbeat-stage');
    expect(runtimeHeartbeatStageSource).toContain("min-block-size: 0;");
  });
});
