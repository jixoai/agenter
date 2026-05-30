import { describe, expect, test } from "vitest";

import {
  formatWorkspaceShellPath,
  resolveWorkspaceShellLaunchCwd,
  resolveWorkspaceShellPromptFolderName,
  resolveWorkspaceShellRuntimeRunning,
  resolveWorkspaceShellRuntimeStarting,
} from "./workspace-shell-contract";

describe("Feature: Workspace shell launch cwd contract", () => {
  test("Scenario: Given a public-workspace launch When resolving the initial cwd Then the selected workspace root stays explicit", () => {
    expect(
      resolveWorkspaceShellLaunchCwd({
        surface: "public-workspace",
        workspacePath: "~/projects/agenter",
        mountKind: "workspace",
        hasRootGrantAccess: false,
      }),
    ).toBe("~/projects/agenter");
  });

  test("Scenario: Given a root-workspace launch on the avatar root When resolving the initial cwd Then the shared dialog can stay on that workspace path", () => {
    expect(
      resolveWorkspaceShellLaunchCwd({
        surface: "root-workspace",
        workspacePath: "~/",
        mountKind: "avatar-root",
        hasRootGrantAccess: false,
      }),
    ).toBe("~/");
  });

  test("Scenario: Given a root-workspace launch on one granted public workspace When resolving the initial cwd Then the selected workspace root stays available", () => {
    expect(
      resolveWorkspaceShellLaunchCwd({
        surface: "root-workspace",
        workspacePath: "~/projects/agenter",
        mountKind: "workspace",
        hasRootGrantAccess: true,
      }),
    ).toBe("~/projects/agenter");
  });

  test("Scenario: Given a root-workspace launch on one mounted public workspace without root grants When resolving the initial cwd Then the dialog refuses to invent a disallowed workspace root cwd", () => {
    expect(
      resolveWorkspaceShellLaunchCwd({
        surface: "root-workspace",
        workspacePath: "~/projects/agenter",
        mountKind: "workspace",
        hasRootGrantAccess: false,
      }),
    ).toBeNull();
  });

  test("Scenario: Given a root avatar path contains one long principal id When formatting dialog and prompt paths Then the dialog keeps the full path while the terminal prompt shows only the folder name", () => {
    const path = "/Users/demo/.agenter/avatars/by-principal/0x1269f34e1a88fe6a0314f777a049a7a0cf302622";

    expect(formatWorkspaceShellPath(path)).toBe(path);
    expect(resolveWorkspaceShellPromptFolderName(path)).toBe("0x1269f34e1a88fe6a0314f777a049a7a0cf302622");
    expect(resolveWorkspaceShellPromptFolderName("/Users/demo/projects/agenter/extensions/studio")).toBe("studio");
  });

  test("Scenario: Given the root-workspace dialog is waiting on runtime boot When resolving runtime state helpers Then only running counts as exec-ready", () => {
    expect(resolveWorkspaceShellRuntimeRunning("running")).toBe(true);
    expect(resolveWorkspaceShellRuntimeRunning("starting")).toBe(false);
    expect(resolveWorkspaceShellRuntimeStarting("starting")).toBe(true);
    expect(resolveWorkspaceShellRuntimeStarting("running")).toBe(false);
  });
});
