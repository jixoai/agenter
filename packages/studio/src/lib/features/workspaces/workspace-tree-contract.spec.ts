import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspaceTreeSource = readFileSync(resolve(import.meta.dirname, "workspace-tree.svelte"), "utf8");

describe("Feature: Workspace tree virtualized disclosure contract", () => {
  test("Scenario: Given explorer and private trees share one primitive When reading the tree source Then the component virtualizes rows through ScrollView instead of owning a second scroll law", () => {
    expect(workspaceTreeSource).toContain("virtual={{");
    expect(workspaceTreeSource).toContain("measureElement: true");
    expect(workspaceTreeSource).toContain("overscan: 8");
    expect(workspaceTreeSource).toContain("data-workspace-tree-path");
  });

  test("Scenario: Given oversized directories stay bounded When reading the tree source Then load-more rows remain inline children inside the same tree primitive", () => {
    expect(workspaceTreeSource).toContain("data-workspace-tree-match-active");
    expect(workspaceTreeSource).toContain("Load {row.remainingCount} more");
    expect(workspaceTreeSource).not.toContain(`overflow-${"auto"}`);
  });
});
