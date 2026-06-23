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
const webHeartbeatViewSource = readFileSync(
  resolve(import.meta.dirname, "../../../../../../packages/web-heartbeat-view/src/HeartbeatView.svelte"),
  "utf8",
);
const webHeartbeatRecordDetailSource = readFileSync(
  resolve(import.meta.dirname, "../../../../../../packages/web-heartbeat-view/src/heartbeat-record-detail.svelte"),
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

  test("Scenario: Given Heartbeat projection repair is an explicit operator action When reading runtime sources Then the top toolbar action calls the repair API and refreshes the embedded app-view", () => {
    expect(runtimePageToolbarSource).toContain("DropdownMenu.Root");
    expect(runtimePageToolbarSource).toContain("CircleEllipsisIcon");
    expect(runtimePageToolbarSource).toContain("Repair Heartbeat projections");
    expect(runtimePageToolbarSource).toContain("onRepairHeartbeatRecordProjectionHealth");
    expect(runtimeShellSource).toContain("heartbeatRepairPending");
    expect(runtimeShellSource).toContain("heartbeatRepairError");
    expect(runtimeShellSource).toContain("controller.runtimeStore.repairHeartbeatRecordProjectionHealth(session.id)");
    expect(runtimeShellSource).toContain("heartbeatRepairVersion += 1");
    expect(runtimePrimaryStageSource).toContain("heartbeatRepairVersion");
    expect(runtimeHeartbeatEmbedStageSource).toContain(
      "buildHeartbeatListAppViewUrl(sessionId, heartbeatRepairVersion)",
    );
    expect(runtimeHeartbeatEmbedStageSource).toContain("refreshVersion: heartbeatRepairVersion");
  });

  test("Scenario: Given Heartbeat session facts are locally dirty When reading runtime sources Then the More menu exposes a bounded destructive clear action", () => {
    expect(runtimePageToolbarSource).toContain("Trash2Icon");
    expect(runtimePageToolbarSource).toContain("清空 Heartbeat Session");
    expect(runtimePageToolbarSource).toContain('variant="destructive"');
    expect(runtimePageToolbarSource).toContain("heartbeatClearDisabled");
    expect(runtimePageToolbarSource).toContain("onClearHeartbeatSession");
    expect(runtimeShellSource).toContain("heartbeatClearPending");
    expect(runtimeShellSource).toContain("heartbeatClearError");
    expect(runtimeShellSource).toContain("Heartbeat clear failed");
    expect(runtimeShellSource).toContain("controller.runtimeStore.clearHeartbeatSession(session.id)");
    expect(runtimeShellSource).toContain("heartbeatClearDisabled={isRunning || runtimeTogglePending}");
  });

  test("Scenario: Given AvatarSession hydration has no source data yet When reading the shell source Then Skeleton owns the no-data loading projection", () => {
    expect(runtimeShellSource).toContain("import * as Skeleton");
    expect(runtimeShellSource).toContain("{#if runtimeLoading}");
    expect(runtimeShellSource).toContain('data-testid="runtime-shell-skeleton"');
    expect(runtimeShellSource).toContain("<Skeleton.Root");
    expect(runtimeShellSource).toContain("{:else}");
    expect(runtimeShellSource).toContain("<Card.Title>Runtime unavailable</Card.Title>");
    expect(runtimeShellSource).not.toContain("Hydrating runtime facts");
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

  test("Scenario: Given a Heartbeat record selection races iframe hydration When reading the embed source Then initial effects do not clear the selected record", () => {
    expect(runtimeHeartbeatEmbedStageSource).toContain("let activeSessionId = $state<string | null>(null)");
    expect(runtimeHeartbeatEmbedStageSource).toContain("if (activeSessionId === null)");
    expect(runtimeHeartbeatEmbedStageSource).toContain("return;");
    expect(runtimeHeartbeatEmbedStageSource).toContain("if (activeSessionId === sessionId)");
    expect(runtimeHeartbeatEmbedStageSource).toContain("activeSessionId = sessionId");
    expect(runtimeHeartbeatEmbedStageSource).toContain("selectedRecordId = null");
  });

  test("Scenario: Given the Studio Heartbeat app-view owns iframe content When reading the app-view source Then list selection is a postMessage event instead of an iframe self-route", () => {
    expect(runtimeHeartbeatAppViewSource).toContain("HeartbeatView");
    expect(runtimeHeartbeatAppViewSource).toContain("HeartbeatRecordDetailView");
    expect(runtimeHeartbeatAppViewSource).toContain("window.parent.postMessage");
    expect(runtimeHeartbeatAppViewSource).not.toContain("packages/web-heartbeat-view/example");
  });

  test("Scenario: Given the embedded Heartbeat iframe is loading without record data When reading package sources Then Skeletons own missing-data loading projections", () => {
    expect(webHeartbeatViewSource).toContain('data-testid="heartbeat-loading-skeleton"');
    expect(webHeartbeatViewSource).toContain(
      "const recordsLoadingWithoutData = $derived(Boolean(recordsResource && !recordsResource.loaded && !recordsResource.error))",
    );
    expect(webHeartbeatViewSource).toContain(
      "const groupsLoadingWithoutData = $derived(!viewState.groupsState.loaded && !viewState.groupsState.error)",
    );
    expect(webHeartbeatRecordDetailSource).toContain('data-testid="heartbeat-record-detail-skeleton"');
    expect(webHeartbeatRecordDetailSource).toContain("{@render detailLoadingSkeleton()}");
    expect(webHeartbeatRecordDetailSource).toContain("detailState?.refreshing");
    expect(webHeartbeatRecordDetailSource).not.toContain("Loading detail");
  });

  test("Scenario: Given the Studio Heartbeat list iframe owns only record-page projection When reading the app-view source Then legacy group hydration and detail state stay outside the list surface", () => {
    expect(runtimeHeartbeatAppViewSource).toContain("listViewState");
    expect(runtimeHeartbeatAppViewSource).toContain("groupsState: emptyGroupsState");
    expect(runtimeHeartbeatAppViewSource).toContain("includeHeartbeatGroups: false");
    expect(runtimeHeartbeatAppViewSource).toContain("includeHeartbeatRecords: false");
    expect(runtimeHeartbeatAppViewSource).toContain("controller.runtimeStore.loadHeartbeatRecords(runtimeId)");
  });

  test("Scenario: Given a Studio Heartbeat detail route is selected before detail data exists When reading the app-view source Then pending detail state wins over unavailable fallback", () => {
    expect(runtimeHeartbeatAppViewSource).toContain("selectedDetailPending");
    expect(runtimeHeartbeatAppViewSource).toContain("!selectedDetailState");
    expect(runtimeHeartbeatAppViewSource).toContain(
      "import * as Skeleton from '$lib/components/ui/skeleton/index.js';",
    );
    expect(runtimeHeartbeatAppViewSource).toContain("heartbeatRecordLoadingSkeleton");
    expect(runtimeHeartbeatAppViewSource).toContain('data-testid="runtime-heartbeat-record-detail-skeleton"');
    expect(runtimeHeartbeatAppViewSource).toContain("{@render heartbeatRecordLoadingSkeleton()}");
    expect(runtimeHeartbeatAppViewSource).toContain("Heartbeat record is not available.");
    expect(runtimeHeartbeatAppViewSource).not.toContain("Loading Heartbeat record…");
  });

  test("Scenario: Given Heartbeat detail store refreshes after a local load snapshot When reading the app-view source Then fresher store detail wins over stale local detail", () => {
    expect(runtimeHeartbeatAppViewSource).toContain("selectedLocalRecordDetailState");
    expect(runtimeHeartbeatAppViewSource).toContain("sourceRefreshedAt >= localRefreshedAt");
    expect(runtimeHeartbeatAppViewSource).toContain("selectedRecordDetailState : selectedLocalRecordDetailState");
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
