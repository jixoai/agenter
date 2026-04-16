import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspaceContentHeaderSource = readFileSync(
  resolve(import.meta.dirname, "workspace-content-header.svelte"),
  "utf8",
);

describe("Feature: Workspace content header mobile density contract", () => {
  test("Scenario: Given a narrow workspace shell When reading the header source Then the mobile layout keeps one compact workspace label while the full path moves to the title affordance", () => {
    expect(workspaceContentHeaderSource).toContain("describeCompactWorkspace");
    expect(workspaceContentHeaderSource).toContain("objectiveCompactLabel");
    expect(workspaceContentHeaderSource).toContain('title={objectiveLabel}');
    expect(workspaceContentHeaderSource).toContain("md:hidden");
    expect(workspaceContentHeaderSource).toContain("hidden truncate text-sm font-medium leading-tight text-foreground md:block");
  });

  test("Scenario: Given the mobile header must not widen the route When reading the source Then the outer surface and avatar trigger both opt into shrinking", () => {
    expect(workspaceContentHeaderSource).toContain("min-w-0 w-full");
    expect(workspaceContentHeaderSource).toContain("class=\"h-10 min-h-10 w-full min-w-0");
    expect(workspaceContentHeaderSource).toContain("grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)]");
  });
});
