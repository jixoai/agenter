import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspacesRouteSource = readFileSync(resolve(import.meta.dirname, "workspaces-route.svelte"), "utf8");

describe("Feature: Workspaces route search and rules contract", () => {
  test("Scenario: Given the page now distinguishes root-workspace from public-workspace When reading the route source Then mount-kind drives explicit surface labels instead of ownership-only copy", () => {
    expect(workspacesRouteSource).toContain("let currentMount = $state<RuntimeWorkspaceMountEntry | null>(null);");
    expect(workspacesRouteSource).toContain("listRuntimeWorkspaceMounts(runtimeId)");
    expect(workspacesRouteSource).toContain("currentSurfaceKind");
    expect(workspacesRouteSource).toContain("currentSurfaceSummary");
    expect(workspacesRouteSource).toContain("root-workspace");
    expect(workspacesRouteSource).toContain("public-workspace");
    expect(workspacesRouteSource).toContain("Root-exclusive env and CLI stay out by default.");
    expect(workspacesRouteSource).toContain("Sharing still depends on mounts and grants.");
  });

  test("Scenario: Given the workspace detail route now follows the shared page-toolbar law When reading the route source Then page-tabs and right-side actions are composed through the shared primitive instead of a bespoke flex header", () => {
    expect(workspacesRouteSource).toContain("WorkbenchPageTabs");
    expect(workspacesRouteSource).toContain("WorkbenchToolbarAction");
    expect(workspacesRouteSource).toContain("<WorkbenchToolbar");
    expect(workspacesRouteSource).toContain("pageTabs={workspaceRouteToolbarPageTabs}");
    expect(workspacesRouteSource).toContain("status={workspaceRouteToolbarStatus}");
    expect(workspacesRouteSource).toContain("actions={workspaceRouteToolbarActions}");
    expect(workspacesRouteSource).toContain('overflowLabel="Open workspace toolbar details"');
  });

  test("Scenario: Given avatar lens is page-local toolbar context When reading the route source Then the shared toolbar owns View as and the content header no longer receives avatar picker props", () => {
    expect(workspacesRouteSource).toContain('data-testid="workspace-avatar-select"');
    expect(workspacesRouteSource).toContain("items={avatarSelectItems}");
    expect(workspacesRouteSource).not.toContain("avatars={avatarOptions}");
    expect(workspacesRouteSource).not.toContain("onAvatarChange={(avatar) => {");
  });

  test("Scenario: Given workspace modes own page-local search When reading the route source Then search keeps prev-next-cancel inside the shared toolbar", () => {
    expect(workspacesRouteSource).toContain("collectWorkspaceCliMatchIds");
    expect(workspacesRouteSource).toContain("filterWorkspaceCliCatalogGroups");
    expect(workspacesRouteSource).toContain("collectWorkspaceRuleMatchIds");
    expect(workspacesRouteSource).toContain("jumpToActiveMatch");
    expect(workspacesRouteSource).toContain("revealTreePath");
    expect(workspacesRouteSource).toContain("Cancel");
  });

  test("Scenario: Given rule editing now belongs to the detail panel When reading the route source Then add duplicate delete and apply all live in the drawer instead of a bottom dock", () => {
    expect(workspacesRouteSource).toContain("const addRule");
    expect(workspacesRouteSource).toContain("const duplicateRule");
    expect(workspacesRouteSource).toContain("const removeRule");
    expect(workspacesRouteSource).toContain("Apply rules");
    expect(workspacesRouteSource).toContain("Add rule");
    expect(workspacesRouteSource).not.toContain("{#snippet bottom()}");
  });

  test("Scenario: Given shared shell primitives were extracted When reading the route source Then the real page assembly consumes the shared content header page-content layout and typed drawer", () => {
    expect(workspacesRouteSource).toContain("WorkspaceContentHeader");
    expect(workspacesRouteSource).toContain("WorkbenchPageContent");
    expect(workspacesRouteSource).toContain("WorkbenchDetailDrawer");
  });

  test("Scenario: Given Workspace now owns a CLI mode When reading the route source Then the mode tab model and detail copy explicitly cover grouped command discovery", () => {
    expect(workspacesRouteSource).toContain("{ value: 'cli', label: 'cli', title: 'CLI' }");
    expect(workspacesRouteSource).toContain(
      "One grouped catalog keeps builtins, root runtime CLI, and workspace tools aligned with helpcenter truth.",
    );
    expect(workspacesRouteSource).toContain("orderWorkspaceCliCatalogGroupsForDisplay");
    expect(workspacesRouteSource).toContain("resolveWorkspaceCliDefaultEntryId");
    expect(workspacesRouteSource).toContain("data-workspace-cli-command-id");
    expect(workspacesRouteSource).toContain('viewportTestId="workspace-cli-list"');
    expect(workspacesRouteSource).toContain("fallback metadata");
    expect(workspacesRouteSource).toContain("Command detail");
  });

  test("Scenario: Given the CLI helpcenter can now launch real shell runs When reading the route source Then the page opens one terminal dialog backed by the selected shell surface", () => {
    expect(workspacesRouteSource).toContain("WorkspaceShellDialog");
    expect(workspacesRouteSource).toContain("selectedCliShellLaunch");
    expect(workspacesRouteSource).toContain("currentWorkspaceHasRootGrantAccess");
    expect(workspacesRouteSource).toContain("selectedRootRuntimeRunning");
    expect(workspacesRouteSource).toContain("selectedRootRuntimeStarting");
    expect(workspacesRouteSource).toContain("Start runtime and run");
    expect(workspacesRouteSource).toContain(
      "The shell dialog will open automatically once the root runtime is actually running.",
    );
    expect(workspacesRouteSource).toContain("workspace-cli-open-shell-button");
    expect(workspacesRouteSource).toContain("openCliShellDialog");
    expect(workspacesRouteSource).toContain("workspaceShellLaunchKey");
    expect(workspacesRouteSource).toContain("resolveWorkspaceShellSurface");
    expect(workspacesRouteSource).toContain("resolveWorkspaceShellLaunchCwd");
  });

  test("Scenario: Given the left workbench list should own its own scrolling When reading the route source Then the list card uses a fixed header plus one minmax body and rules mode scrolls inside that body", () => {
    expect(workspacesRouteSource).toContain("grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]");
    expect(workspacesRouteSource).toContain('<Card.Content class="h-full min-h-0 p-0">');
    expect(workspacesRouteSource).toContain('<ScrollView class="h-full" contentClass="grid gap-2 p-2.5 md:p-3">');
  });

  test("Scenario: Given compact detail opens on mobile When reading the route source Then the content header yields focus so the detail surface can become the single task view", () => {
    expect(workspacesRouteSource).toContain("hideCompactContentHeader");
    expect(workspacesRouteSource).toContain("hidden md:block");
    expect(workspacesRouteSource).toContain("detailCompact && detailOpen");
    expect(workspacesRouteSource).toContain("gap-0 p-0");
    expect(workspacesRouteSource).toContain('class="row-start-2 h-full min-h-0 min-w-0 w-full"');
    expect(workspacesRouteSource).toContain('mainClass="h-full min-h-0"');
    expect(workspacesRouteSource).toContain('drawerClass="h-full min-h-0"');
    expect(workspacesRouteSource).toContain("tone={detailCompact ? 'page' : 'pane'}");
  });

  test("Scenario: Given explorer and private actions now belong to the detail panel When reading the route source Then quick rule staging and private asset creation live beside preview instead of under the list", () => {
    expect(workspacesRouteSource).toContain("Create private asset");
    expect(workspacesRouteSource).toContain("Stage rule");
    expect(workspacesRouteSource).toContain('aria-label="Quick rule access mode"');
    expect(workspacesRouteSource).toContain("title={quickRuleMode === 'ro' ? 'Read only' : 'Read write'}");
    expect(workspacesRouteSource).toContain("workspacePreviewDetail");
    expect(workspacesRouteSource).not.toContain("summary={workspaceDrawerSummary}");
  });

  test("Scenario: Given workspace root selection moved to the fixed start page When reading the detail route source Then the detail shell no longer owns an inline root switcher", () => {
    expect(workspacesRouteSource).toContain("workspacePath");
    expect(workspacesRouteSource).toContain("buildWorkspaceDetailHref");
    expect(workspacesRouteSource).not.toContain("selectedWorkspacePath");
    expect(workspacesRouteSource).not.toContain("onWorkspaceChange");
  });
});
