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
const runtimePrimaryStageSource = readFileSync(resolve(import.meta.dirname, "runtime-primary-stage.svelte"), "utf8");
const runtimeHeartbeatEmbedStageSource = readFileSync(
  resolve(import.meta.dirname, "runtime-stage-heartbeat-embed.svelte"),
  "utf8",
);
const runtimeHeartbeatAppViewSource = readFileSync(
  resolve(import.meta.dirname, "runtime-heartbeat-app-view.svelte"),
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

  test("Scenario: Given Studio embeds the new Heartbeat app-view When reading runtime sources Then the iframe split-detail is the default and legacy Heartbeat is gated", () => {
    expect(runtimePrimaryStageSource).toContain("__LEGACY_WEB_HEARTBEAT_VIEW__");
    expect(runtimePrimaryStageSource).toContain("<RuntimeStageHeartbeatEmbed");
    expect(runtimeHeartbeatEmbedStageSource).toContain("runtime-heartbeat-list-frame");
    expect(runtimeHeartbeatEmbedStageSource).toContain("runtime-heartbeat-detail-frame");
    expect(runtimeHeartbeatEmbedStageSource).toContain("runtime-heartbeat-detail-empty");
    expect(runtimeHeartbeatEmbedStageSource).toContain("event.origin !== window.location.origin");
  });

  test("Scenario: Given the Studio Heartbeat app-view owns iframe content When reading the app-view source Then list selection is a postMessage event instead of an iframe self-route", () => {
    expect(runtimeHeartbeatAppViewSource).toContain("HeartbeatView");
    expect(runtimeHeartbeatAppViewSource).toContain("HeartbeatRecordDetailView");
    expect(runtimeHeartbeatAppViewSource).toContain("window.parent.postMessage");
    expect(runtimeHeartbeatAppViewSource).not.toContain("packages/web-heartbeat-view/example");
  });

  test("Scenario: Given the Studio Heartbeat list iframe owns only record-page projection When reading the app-view source Then legacy group hydration and detail state stay outside the list surface", () => {
    expect(runtimeHeartbeatAppViewSource).toContain("listViewState");
    expect(runtimeHeartbeatAppViewSource).toContain("groupsState: emptyGroupsState");
    expect(runtimeHeartbeatAppViewSource).toContain("includeHeartbeatGroups: false");
    expect(runtimeHeartbeatAppViewSource).toContain("includeHeartbeatRecords: false");
    expect(runtimeHeartbeatAppViewSource).toContain("controller.runtimeStore.loadHeartbeatRecords(runtimeId)");
  });

  test("Scenario: Given runtime shell inserts route-level notices above the primary stage When reading the shell source Then the stage host itself remains shrinkable so Heartbeat keeps a bounded inner viewport", () => {
    expect(runtimeShellSource).toContain("'runtime-shell__layout-grid grid h-full gap-3'");
    expect(runtimeShellSource).toContain(
      "runtimeRouteNotice ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]'",
    );
    expect(runtimeShellSource).toContain(".runtime-shell__layout-grid");
    expect(runtimeShellSource).toContain('class="runtime-shell__stage-host h-full"');
    expect(runtimeShellSource).toContain(".runtime-shell__stage-host");
    expect(runtimeShellSource).toContain("min-block-size: 0;");
  });
});
