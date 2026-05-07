import { describe, expect, test } from "bun:test";

import {
  GLOBAL_WORKSPACE_PATH,
  resolveWorkspaceFsPath,
  toWorkspaceCwd,
  toWorkspacePath,
} from "../src/workspace-target";

describe("Feature: workspace path normalization", () => {
  test("Scenario: Given browser shell inputs use home-relative tokens When backend normalizes cwd and workspace paths Then tilde expands against the configured home instead of the daemon process cwd", () => {
    const homeDir = "/tmp/agenter-home";

    expect(resolveWorkspaceFsPath("~/projects/demo", homeDir)).toBe("/tmp/agenter-home/projects/demo");
    expect(toWorkspacePath("~/projects/demo", homeDir)).toBe("/tmp/agenter-home/projects/demo");
    expect(toWorkspacePath("~/", homeDir)).toBe(GLOBAL_WORKSPACE_PATH);
    expect(toWorkspaceCwd("~/", homeDir)).toBe(homeDir);
  });
});
