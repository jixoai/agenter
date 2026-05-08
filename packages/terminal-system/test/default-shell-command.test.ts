import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { resolveDefaultInteractiveShellCommand } from "../src";

const tempDirs: string[] = [];
const originalShell = process.env.SHELL;

afterEach(() => {
  process.env.SHELL = originalShell;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Feature: default interactive shell resolution", () => {
  test("Scenario: Given SHELL points to an existing shell When resolving the default interactive shell command Then env.SHELL wins over bash fallback", () => {
    if (process.platform === "win32") {
      return;
    }

    const tempDir = mkdtempSync(join(tmpdir(), "terminal-shell-"));
    tempDirs.push(tempDir);
    const preferredShell = join(tempDir, "preferred-shell");
    writeFileSync(preferredShell, "#!/bin/sh\n", { mode: 0o755 });
    process.env.SHELL = preferredShell;

    expect(resolveDefaultInteractiveShellCommand()).toEqual([preferredShell, "-i"]);
  });
});
