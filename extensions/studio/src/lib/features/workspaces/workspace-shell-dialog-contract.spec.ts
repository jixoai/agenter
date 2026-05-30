import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspaceShellDialogSource = readFileSync(resolve(import.meta.dirname, "workspace-shell-dialog.svelte"), "utf8");

describe("Feature: Workspace shell dialog contract", () => {
  test("Scenario: Given shell execution stays dialog-scoped When reading the dialog source Then the content owns one WTerm projection instead of route navigation or form fields", () => {
    expect(workspaceShellDialogSource).toContain("WorkspaceShellTerminal");
    expect(workspaceShellDialogSource).toContain("ClipSurface");
    expect(workspaceShellDialogSource).toContain("workspace-shell-dialog-body");
    expect(workspaceShellDialogSource).toContain("min-block-size: 0;");
    expect(workspaceShellDialogSource).toContain('data-testid="workspace-shell-dialog-terminal-frame"');
    expect(workspaceShellDialogSource).toContain("sm:rounded-b-[1.4rem]");
    expect(workspaceShellDialogSource).toContain("shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]");
    expect(workspaceShellDialogSource).toContain('data-testid="workspace-shell-dialog"');
    expect(workspaceShellDialogSource).toContain("Run in shell");
    expect(workspaceShellDialogSource).toContain("Current path");
    expect(workspaceShellDialogSource).toContain("formatWorkspaceShellPath");
    expect(workspaceShellDialogSource).toContain("whitespace-normal break-all");
    expect(workspaceShellDialogSource).toContain("{currentPathValue}");
    expect(workspaceShellDialogSource).not.toContain("currentPathLabel");
    expect(workspaceShellDialogSource).toContain("bind:cwd");
    expect(workspaceShellDialogSource).not.toContain("Real backend shell projection.");
    expect(workspaceShellDialogSource).not.toContain("Back to CLI");
  });

  test("Scenario: Given the dialog should stay lightweight When reading the source Then it does not reintroduce cwd stdin or command form controls", () => {
    expect(workspaceShellDialogSource).not.toContain("InputGroup");
    expect(workspaceShellDialogSource).not.toContain("textarea");
    expect(workspaceShellDialogSource).not.toContain("placeholder=");
  });
});
