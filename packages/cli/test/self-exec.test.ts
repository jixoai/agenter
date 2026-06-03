import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isBunCompiledExecutable,
  resolveCurrentCliEntrypointArgv,
  resolveCurrentLauncherEntrypoint,
  resolveCurrentLauncherSourceKind,
  resolveCurrentSelfExec,
} from "../src/self-exec";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-cli-self-exec-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: CLI self exec runtime law", () => {
  test("Scenario: Given a source-tree CLI invocation When launcher identity is resolved Then the workspace entrypoint stays explicit", () => {
    const root = createTempDir();
    const entrypoint = join(root, "packages", "cli", "src", "bin", "agenter.ts");
    mkdirSync(join(root, "packages", "cli", "src", "bin"), { recursive: true });
    writeFileSync(entrypoint, "");

    expect(
      resolveCurrentLauncherEntrypoint({
        argv: ["bun", entrypoint],
        cliEntryPath: join(root, "fallback.ts"),
        execPath: "/opt/homebrew/bin/bun",
        importMetaUrl: "file:///repo/packages/cli/src/run-cli.ts",
      }),
    ).toBe(entrypoint);
    expect(
      resolveCurrentCliEntrypointArgv({
        argv: ["bun", entrypoint],
        cliEntryPath: join(root, "fallback.ts"),
        execPath: "/opt/homebrew/bin/bun",
        importMetaUrl: "file:///repo/packages/cli/src/run-cli.ts",
      }),
    ).toEqual([entrypoint]);
    expect(resolveCurrentLauncherSourceKind(entrypoint, { importMetaUrl: "file:///repo/packages/cli/src/run-cli.ts" }))
      .toBe("workspace");
  });

  test("Scenario: Given a Bun-compiled executable When self exec is resolved Then respawn uses the native executable instead of bun run", () => {
    const compiledBinary = join(createTempDir(), "agenter");
    writeFileSync(compiledBinary, "");

    expect(isBunCompiledExecutable("file:///$bunfs/root/packages/cli/src/run-cli.ts")).toBe(true);
    expect(
      resolveCurrentLauncherEntrypoint({
        argv: ["bun", "/$bunfs/root/agenter"],
        cliEntryPath: "/repo/packages/cli/src/bin/agenter.ts",
        execPath: compiledBinary,
        importMetaUrl: "file:///$bunfs/root/packages/cli/src/run-cli.ts",
      }),
    ).toBe(compiledBinary);
    expect(
      resolveCurrentCliEntrypointArgv({
        argv: ["bun", "/$bunfs/root/agenter"],
        cliEntryPath: "/repo/packages/cli/src/bin/agenter.ts",
        execPath: compiledBinary,
        importMetaUrl: "file:///$bunfs/root/packages/cli/src/run-cli.ts",
      }),
    ).toEqual([]);
    expect(
      resolveCurrentSelfExec({
        argv: ["bun", "/$bunfs/root/agenter"],
        bunExecutable: "/opt/homebrew/bin/bun",
        cliEntryPath: "/repo/packages/cli/src/bin/agenter.ts",
        execPath: compiledBinary,
        importMetaUrl: "file:///$bunfs/root/packages/cli/src/run-cli.ts",
      }),
    ).toEqual({
      command: compiledBinary,
      argvPrefix: [],
    });
    expect(resolveCurrentLauncherSourceKind(compiledBinary, {
      importMetaUrl: "file:///$bunfs/root/packages/cli/src/run-cli.ts",
    })).toBe("package");
  });

  test("Scenario: Given a source invocation loses argv[1] When self exec is rebuilt Then bun run falls back to the canonical CLI entry path", () => {
    expect(
      resolveCurrentSelfExec({
        argv: ["bun"],
        bunExecutable: "/opt/homebrew/bin/bun",
        cliEntryPath: "/repo/packages/cli/src/bin/agenter.ts",
        execPath: "/opt/homebrew/bin/bun",
        importMetaUrl: "file:///repo/packages/cli/src/run-cli.ts",
      }),
    ).toEqual({
      command: "/opt/homebrew/bin/bun",
      argvPrefix: ["run", "/repo/packages/cli/src/bin/agenter.ts"],
    });
  });
});
