import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspacesRouteSource = readFileSync(resolve(import.meta.dirname, "workspaces-route.svelte"), "utf8");

describe("Feature: Workspaces route search and rules contract", () => {
  test("Scenario: Given workspace modes own page-local search When reading the route source Then search keeps prev-next-cancel inside the shared toolbar", () => {
    expect(workspacesRouteSource).toContain("collectWorkspaceRuleMatchIds");
    expect(workspacesRouteSource).toContain("jumpToActiveMatch");
    expect(workspacesRouteSource).toContain("revealTreePath");
    expect(workspacesRouteSource).toContain("Cancel");
  });

  test("Scenario: Given the rules editor lives in the bottom area When reading the route source Then add duplicate delete and apply all remain in one editing surface", () => {
    expect(workspacesRouteSource).toContain("const addRule");
    expect(workspacesRouteSource).toContain("const duplicateRule");
    expect(workspacesRouteSource).toContain("const removeRule");
    expect(workspacesRouteSource).toContain("Apply rules");
    expect(workspacesRouteSource).toContain("Add rule");
  });

  test("Scenario: Given shared shell primitives were extracted When reading the route source Then the real page assembly consumes the shared content header page-content layout and typed drawer", () => {
    expect(workspacesRouteSource).toContain("WorkspaceContentHeader");
    expect(workspacesRouteSource).toContain("WorkbenchPageContent");
    expect(workspacesRouteSource).toContain("WorkbenchDetailDrawer");
  });

  test("Scenario: Given compact detail opens on mobile When reading the route source Then the content header yields focus so the detail surface can become the single task view", () => {
    expect(workspacesRouteSource).toContain("hideCompactContentHeader");
    expect(workspacesRouteSource).toContain("hidden md:block");
    expect(workspacesRouteSource).toContain("detailCompact && detailOpen");
    expect(workspacesRouteSource).toContain("gap-0 p-0");
    expect(workspacesRouteSource).toContain("class=\"row-start-2 h-full min-w-0 w-full\"");
    expect(workspacesRouteSource).toContain("tone={detailCompact ? 'page' : 'pane'}");
  });

  test("Scenario: Given explorer quick actions stay in the bottom area When reading the route source Then mobile switches to a denser action dock instead of repeating the desktop card", () => {
    expect(workspacesRouteSource).toContain("grid gap-2.5 md:hidden");
    expect(workspacesRouteSource).toContain("Quick rule staging for the current tree selection.");
    expect(workspacesRouteSource).toContain("Stage");
    expect(workspacesRouteSource).toContain("Apply");
    expect(workspacesRouteSource).toContain("grid-cols-[minmax(0,1fr)_auto_auto]");
  });

  test("Scenario: Given workspace root selection moved to the fixed start page When reading the detail route source Then the detail shell no longer owns an inline root switcher", () => {
    expect(workspacesRouteSource).toContain("workspacePath");
    expect(workspacesRouteSource).toContain("buildWorkspaceDetailHref");
    expect(workspacesRouteSource).not.toContain("selectedWorkspacePath");
    expect(workspacesRouteSource).not.toContain("onWorkspaceChange");
  });
});
