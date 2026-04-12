import { describe, expect, test } from "vitest";

import {
  buildRuleDrafts,
  buildWorkspaceTreeRows,
  collectWorkspaceRuleMatchIds,
  collectWorkspaceTreeMatchPaths,
  normalizeWorkspaceMode,
  serializeRuleDrafts,
  type WorkspaceTreePages,
} from "./workspace-workbench-state";

describe("Feature: Workspace workbench state primitives", () => {
  test("Scenario: Given an unknown mode query When normalizing the workspace mode Then explorer remains the canonical fallback", () => {
    expect(normalizeWorkspaceMode(null)).toBe("explorer");
    expect(normalizeWorkspaceMode("detail")).toBe("explorer");
    expect(normalizeWorkspaceMode("rules")).toBe("rules");
    expect(normalizeWorkspaceMode("private")).toBe("private");
  });

  test("Scenario: Given runtime grants with disabled drafts When serializing rules Then only enabled normalized paths are persisted", () => {
    const drafts = buildRuleDrafts([
      {
        grantId: "grant-root",
        mountId: "mount-alpha",
        workspacePath: "/repo/app",
        relativePath: ".",
        absolutePath: "/repo/app",
        mode: "rw",
        createdAt: "2026-04-12T00:00:00.000Z",
      },
      {
        grantId: "grant-src",
        mountId: "mount-alpha",
        workspacePath: "/repo/app",
        relativePath: "src/",
        absolutePath: "/repo/app/src",
        mode: "ro",
        createdAt: "2026-04-12T00:00:01.000Z",
      },
    ]);
    drafts[1]!.enabled = false;

    expect(serializeRuleDrafts(drafts)).toEqual([{ relativePath: "/", mode: "rw" }]);
  });

  test("Scenario: Given a searched tree with expanded ancestors and a paged directory When building rows Then ancestors stay visible and load-more remains scoped to its folder", () => {
    const pages: WorkspaceTreePages = {
      "/": {
        rootPath: "/",
        total: 2,
        nextOffset: null,
        items: [
          {
            path: "/src",
            name: "src",
            kind: "directory",
            sizeBytes: null,
            modifiedAtMs: 1,
            previewKind: "directory",
            accessMode: "rw",
          },
          {
            path: "/README.md",
            name: "README.md",
            kind: "file",
            sizeBytes: 128,
            modifiedAtMs: 2,
            previewKind: "text",
            accessMode: "ro",
          },
        ],
      },
      "/src": {
        rootPath: "/src",
        total: 1_300,
        nextOffset: 1_000,
        items: [
          {
            path: "/src/lib",
            name: "lib",
            kind: "directory",
            sizeBytes: null,
            modifiedAtMs: 3,
            previewKind: "directory",
            accessMode: "rw",
          },
        ],
      },
    };

    const rows = buildWorkspaceTreeRows({
      pages,
      expandedPaths: new Set(["/", "/src"]),
      searchQuery: "lib",
    });

    expect(rows).toEqual([
      {
        type: "entry",
        entry: pages["/"]!.items[0],
        depth: 0,
      },
      {
        type: "entry",
        entry: pages["/src"]!.items[0],
        depth: 1,
      },
      {
        type: "load-more",
        parentPath: "/src",
        remainingCount: 300,
        depth: 1,
      },
    ]);
    expect(collectWorkspaceTreeMatchPaths(pages, "lib")).toEqual(["/src/lib"]);
  });

  test("Scenario: Given the rules catalog stays visible during page search When collecting rule matches Then only matching rows participate in next-prev navigation", () => {
    expect(
      collectWorkspaceRuleMatchIds(
        [
          {
            id: "rule-root",
            relativePath: "/",
            mode: "rw",
            enabled: true,
          },
          {
            id: "rule-src",
            relativePath: "/src/**",
            mode: "ro",
            enabled: false,
          },
        ],
        "disabled",
      ),
    ).toEqual(["rule-src"]);
  });
});
