import { describe, expect, test } from "vitest";

import {
  removeWorkspaceWorkbenchTab,
  upsertWorkspaceWorkbenchTab,
  type WorkspaceWorkbenchTabEntry,
} from "./workspace-tabs-state";

describe("Feature: Workspace workbench tab state", () => {
  test("Scenario: Given a chosen workspace root When upserting a workbench tab Then the start page can keep one closable detail tab per root path", () => {
    const current: WorkspaceWorkbenchTabEntry[] = [];
    const next = upsertWorkspaceWorkbenchTab(current, {
      workspacePath: "/repo/agenter",
      href: "/workspaces/root/%2Frepo%2Fagenter",
    });

    expect(next).toEqual([
      {
        workspacePath: "/repo/agenter",
        href: "/workspaces/root/%2Frepo%2Fagenter",
      },
    ]);
  });

  test("Scenario: Given an already-open workspace tab When upserting with a new href Then the latest route metadata replaces the old href without duplicating the tab", () => {
    const current: WorkspaceWorkbenchTabEntry[] = [
      {
        workspacePath: "/repo/agenter",
        href: "/workspaces/root/%2Frepo%2Fagenter",
      },
    ];

    const next = upsertWorkspaceWorkbenchTab(current, {
      workspacePath: "/repo/agenter",
      href: "/workspaces/root/%2Frepo%2Fagenter?mode=rules",
    });

    expect(next).toEqual([
      {
        workspacePath: "/repo/agenter",
        href: "/workspaces/root/%2Frepo%2Fagenter?mode=rules",
      },
    ]);
  });

  test("Scenario: Given a closed workspace detail tab When removing it Then the stored tab set drops that one root and keeps the others", () => {
    const current: WorkspaceWorkbenchTabEntry[] = [
      {
        workspacePath: "/repo/agenter",
        href: "/workspaces/root/%2Frepo%2Fagenter",
      },
      {
        workspacePath: "/repo/docs",
        href: "/workspaces/root/%2Frepo%2Fdocs",
      },
    ];

    expect(removeWorkspaceWorkbenchTab(current, "/repo/agenter")).toEqual([
      {
        workspacePath: "/repo/docs",
        href: "/workspaces/root/%2Frepo%2Fdocs",
      },
    ]);
  });
});
