import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspaceContentHeaderSource = readFileSync(
  resolve(import.meta.dirname, "workspace-content-header.svelte"),
  "utf8",
);

describe("Feature: Workspace content header mobile density contract", () => {
  test("Scenario: Given root-workspace and public-workspace semantics must stay visible When reading the header source Then it renders explicit env and CLI badges plus one factual summary line", () => {
    expect(workspaceContentHeaderSource).toContain("surfaceKind: 'root-workspace' | 'public-workspace'");
    expect(workspaceContentHeaderSource).toContain("surfaceSummary: string");
    expect(workspaceContentHeaderSource).toContain("workspace-surface-kind");
    expect(workspaceContentHeaderSource).toContain("workspace-surface-profile");
    expect(workspaceContentHeaderSource).toContain("workspace-surface-summary");
    expect(workspaceContentHeaderSource).toContain("Root workspace");
    expect(workspaceContentHeaderSource).toContain("Public workspace");
    expect(workspaceContentHeaderSource).toContain("Root-exclusive env + CLI");
    expect(workspaceContentHeaderSource).toContain("Collaboration env surface");
  });

  test("Scenario: Given a narrow workspace shell When reading the header source Then the mobile layout keeps one compact workspace label while the full path moves to the title affordance", () => {
    expect(workspaceContentHeaderSource).toContain("describeCompactWorkspace");
    expect(workspaceContentHeaderSource).toContain("objectiveCompactLabel");
    expect(workspaceContentHeaderSource).toContain("title={objectiveLabel}");
    expect(workspaceContentHeaderSource).toContain("md:hidden");
    expect(workspaceContentHeaderSource).toContain(
      "hidden truncate text-sm font-medium leading-tight text-foreground md:block",
    );
  });

  test("Scenario: Given avatar lens now belongs to the shared toolbar When reading the header source Then the content header keeps only workspace facts and no longer renders its own View as picker", () => {
    expect(workspaceContentHeaderSource).toContain("min-w-0 w-full");
    expect(workspaceContentHeaderSource).not.toContain('data-testid="workspace-avatar-select"');
    expect(workspaceContentHeaderSource).not.toContain('aria-label="View as"');
  });

  test("Scenario: Given the shared header belongs to page-content When reading the source Then it uses one integrated content band instead of a detached card wrapper", () => {
    expect(workspaceContentHeaderSource).toContain("border-b border-border/45");
    expect(workspaceContentHeaderSource).not.toContain("rounded-[0.95rem] border border-border/60");
  });
});
