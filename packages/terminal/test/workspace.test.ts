import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";

import { createWorkspace, destroyWorkspace } from "../src/workspace";

test("workspace creates utc path with readable date folders", () => {
  const workspace = createWorkspace();
  expect(existsSync(workspace)).toBe(true);
  const normalized = workspace.replaceAll("\\", "/");
  expect(normalized).toMatch(/\/\d{4}\/\d{2}\/\d{2}\/\d{2}_\d{2}-\d+/);
  expect(normalized).toContain(`-${process.pid}`);
  destroyWorkspace(workspace, false);
  expect(existsSync(workspace)).toBe(false);
});

test("workspace supports explicit workspacePath resume", () => {
  const base = join(tmpdir(), "ati-workspace-resume-path");
  mkdirSync(base, { recursive: true });
  const resumed = createWorkspace({ workspacePath: base });
  expect(resumed).toBe(base);
  rmSync(base, { recursive: true, force: true });
});

test("workspace supports resume by pid lookup", () => {
  const baseDir = join(tmpdir(), "ati-workspace-resume-pid");
  const fake = join(baseDir, "2026", "02", "28", `04_59-${process.pid}`);
  mkdirSync(fake, { recursive: true });
  const resumed = createWorkspace({ resumePid: process.pid, outputRoot: baseDir });
  expect(resumed).toBe(fake);
  rmSync(baseDir, { recursive: true, force: true });
});

test("workspace supports custom outputRoot", () => {
  const root = join(tmpdir(), "ati-workspace-root");
  mkdirSync(root, { recursive: true });
  const workspace = createWorkspace({ outputRoot: root });
  expect(workspace.startsWith(root)).toBe(true);
  destroyWorkspace(workspace, false);
  rmSync(root, { recursive: true, force: true });
});
