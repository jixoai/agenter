import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspaceContentHeaderSource = readFileSync(
  resolve(import.meta.dirname, "workspace-content-header.svelte"),
  "utf8",
);

describe("Feature: Workspace content header mobile density contract", () => {
  test("Scenario: Given a narrow workspace shell When reading the header source Then the mobile layout keeps one compact label plus the full path as secondary text", () => {
    expect(workspaceContentHeaderSource).toContain("describeCompactWorkspace");
    expect(workspaceContentHeaderSource).toContain("objectiveCompactLabel");
    expect(workspaceContentHeaderSource).toContain("md:hidden");
  });

  test("Scenario: Given the mobile header must not widen the route When reading the source Then the outer surface and avatar trigger both opt into shrinking", () => {
    expect(workspaceContentHeaderSource).toContain("min-w-0 w-full");
    expect(workspaceContentHeaderSource).toContain("class=\"h-auto min-h-10 w-full min-w-0");
  });
});
