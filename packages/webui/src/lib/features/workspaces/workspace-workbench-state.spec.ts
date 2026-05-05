import type { WorkspaceCliCatalogGroup } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import {
  buildRuleDrafts,
  buildWorkspaceTreeRows,
  collectWorkspaceCliMatchIds,
  collectWorkspaceRuleMatchIds,
  collectWorkspaceTreeMatchPaths,
  filterWorkspaceCliCatalogGroups,
  normalizeWorkspaceMode,
  orderWorkspaceCliCatalogGroupsForDisplay,
  resolveWorkspaceCliDefaultEntryId,
  serializeRuleDrafts,
  type WorkspaceTreePages,
} from "./workspace-workbench-state";

describe("Feature: Workspace workbench state primitives", () => {
  test("Scenario: Given an unknown mode query When normalizing the workspace mode Then explorer remains the canonical fallback", () => {
    expect(normalizeWorkspaceMode(null)).toBe("explorer");
    expect(normalizeWorkspaceMode("detail")).toBe("explorer");
    expect(normalizeWorkspaceMode("rules")).toBe("rules");
    expect(normalizeWorkspaceMode("private")).toBe("private");
    expect(normalizeWorkspaceMode("cli")).toBe("cli");
  });

  test("Scenario: Given runtime grants with disabled drafts When serializing rules Then only enabled normalized paths are persisted", () => {
    const drafts = buildRuleDrafts([
      {
        grantId: "grant-root",
        mountId: "mount-alpha",
        workspacePath: "/repo/app",
        pattern: ".",
        ruleIndex: 0,
        mode: "rw",
        createdAt: "2026-04-12T00:00:00.000Z",
      },
      {
        grantId: "grant-src",
        mountId: "mount-alpha",
        workspacePath: "/repo/app",
        pattern: "src/",
        ruleIndex: 1,
        mode: "ro",
        createdAt: "2026-04-12T00:00:01.000Z",
      },
    ]);
    drafts[1]!.enabled = false;

    expect(serializeRuleDrafts(drafts)).toEqual([{ pattern: "/", mode: "rw" }]);
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
            pattern: "/",
            mode: "rw",
            enabled: true,
          },
          {
            id: "rule-src",
            pattern: "/src/**",
            mode: "ro",
            enabled: false,
          },
        ],
        "disabled",
      ),
    ).toEqual(["rule-src"]);
  });

  test("Scenario: Given the CLI catalog uses grouped search When filtering commands Then matching entries stay in their original group shells", () => {
    const groups: WorkspaceCliCatalogGroup[] = [
      {
        id: "root-runtime-cli",
        title: "root runtime CLI",
        description: "root runtime CLI",
        entries: [
          {
            id: "root-runtime-cli:message send",
            groupId: "root-runtime-cli",
            source: "runtime-cli",
            commandLabel: "message send",
            displayName: "send",
            description: "Send a durable room message.",
            detailHint: "message send --help",
          },
        ],
      },
      {
        id: "workspace-private-tools",
        title: "workspace private tools",
        description: "private tools",
        entries: [
          {
            id: "workspace-private-tools:tool_draft",
            groupId: "workspace-private-tools",
            source: "workspace-tool",
            commandLabel: "tool_draft",
            displayName: "Draft note",
            description: "Draft a private note.",
            detailHint: "tool_draft --help",
            toolFileName: "draft.ts",
          },
        ],
      },
    ];

    expect(filterWorkspaceCliCatalogGroups(groups, "draft")).toEqual([
      {
        ...groups[1],
        entries: [...groups[1].entries],
      },
    ]);
    expect(collectWorkspaceCliMatchIds(groups, "message")).toEqual(["root-runtime-cli:message send"]);
  });

  test("Scenario: Given browser CLI discovery mixes workspace runtime and builtin groups When ordering for display Then product commands stay above builtin noise without losing entries", () => {
    const groups: WorkspaceCliCatalogGroup[] = [
      {
        id: "just-bash-builtins",
        title: "just-bash builtins",
        description: "builtins",
        entries: [],
      },
      {
        id: "root-runtime-cli",
        title: "root runtime CLI",
        description: "runtime",
        entries: [],
      },
      {
        id: "workspace-private-tools",
        title: "workspace private tools",
        description: "private",
        entries: [],
      },
    ];

    expect(orderWorkspaceCliCatalogGroupsForDisplay(groups).map((group) => group.id)).toEqual([
      "workspace-private-tools",
      "root-runtime-cli",
      "just-bash-builtins",
    ]);
  });

  test("Scenario: Given builtin punctuation commands sort first When resolving the default CLI detail Then the page prefers a human-readable command over symbolic noise", () => {
    const groups: WorkspaceCliCatalogGroup[] = [
      {
        id: "just-bash-builtins",
        title: "just-bash builtins",
        description: "builtins",
        entries: [
          {
            id: "just-bash-builtins:.",
            groupId: "just-bash-builtins",
            source: "just-bash-builtin",
            commandLabel: ".",
            displayName: ".",
            description: "Execute commands from a file in the current shell.",
            detailHint: "help .",
          },
          {
            id: "just-bash-builtins:alias",
            groupId: "just-bash-builtins",
            source: "just-bash-builtin",
            commandLabel: "alias",
            displayName: "alias",
            description: "Define or display aliases.",
            detailHint: "help alias",
          },
        ],
      },
    ];

    expect(resolveWorkspaceCliDefaultEntryId(groups, null)).toBe("just-bash-builtins:alias");
    expect(resolveWorkspaceCliDefaultEntryId(groups, "just-bash-builtins:alias")).toBe("just-bash-builtins:alias");
  });

  test("Scenario: Given the raw CLI catalog starts with builtins When route initialization asks for the default detail Then ordered product commands win before builtin fallbacks", () => {
    const groups: WorkspaceCliCatalogGroup[] = [
      {
        id: "just-bash-builtins",
        title: "just-bash builtins",
        description: "builtins",
        entries: [
          {
            id: "just-bash-builtins:.",
            groupId: "just-bash-builtins",
            source: "just-bash-builtin",
            commandLabel: ".",
            displayName: ".",
            description: "Execute commands from a file in the current shell.",
            detailHint: "help .",
          },
        ],
      },
      {
        id: "root-runtime-cli",
        title: "root runtime CLI",
        description: "runtime",
        entries: [
          {
            id: "root-runtime-cli:attention commit",
            groupId: "root-runtime-cli",
            source: "runtime-cli",
            commandLabel: "attention commit",
            displayName: "commit",
            description: "Persist an attention commit.",
            detailHint: "help attention commit",
          },
        ],
      },
    ];

    const orderedGroups = orderWorkspaceCliCatalogGroupsForDisplay(groups);
    expect(resolveWorkspaceCliDefaultEntryId(orderedGroups, null)).toBe("root-runtime-cli:attention commit");
  });
});
