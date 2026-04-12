import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listRuntimeToolFiles, materializeBuiltinRuntimeTools } from "../src/runtime-tools";

const tempDirs: string[] = [];

const createTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "agenter-runtime-tools-"));
  tempDirs.push(root);
  return root;
};

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: runtime built-in tools", () => {
  test("Scenario: Given a runtime root workspace When built-in tools are listed Then the runtime reports an empty built-in helper catalog", () => {
    const rootWorkspacePath = createTempRoot();

    const copied = materializeBuiltinRuntimeTools({ rootWorkspacePath });
    const listed = listRuntimeToolFiles({ rootWorkspacePath });

    expect(copied).toEqual([]);
    expect(listed).toEqual([]);
  });
});
