import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildAgenterCliBinary,
  buildAgenterCliCompileCommand,
  resolveBuildAgenterCliOutputPath,
} from "./build-agenter-cli";
import {
  createAgenterCliNativeArtifactPath,
  resolveAgenterCliTargetById,
  resolveCurrentAgenterCliTarget,
} from "./agenter-cli-artifacts";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-native-cli-build-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: agenter native CLI build staging", () => {
  test("Scenario: Given maintainers need a local binary proof path When root scripts are inspected Then host-only smoke stays one command away", () => {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dir, "../..", "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:build-native-cli:host-smoke"]).toBe(
      "bun run scripts/binaries/build-agenter-cli.ts --stage-package",
    );
  });

  test("Scenario: Given a target is resolved for package staging When the output path is derived Then the compiled binary lands inside the target-owned bin slot", () => {
    const root = "/repo";
    const target = resolveAgenterCliTargetById("linux-x64-musl");

    expect(resolveBuildAgenterCliOutputPath(target, { root, stagePackage: true })).toBe(
      "/repo/packages/agenter-cli-linux-x64-musl/bin/agenter",
    );
    expect(resolveBuildAgenterCliOutputPath(target, { root, stagePackage: false })).toBe(
      resolve(createAgenterCliNativeArtifactPath("/repo/native-artifacts", target)),
    );
  });

  test("Scenario: Given a target is compiled When the build command is generated Then Bun compile stays aligned with the target matrix truth", () => {
    const target = resolveAgenterCliTargetById("win32-arm64");
    const outputPath = "native-artifacts/agenter-cli-win32-arm64/agenter.exe";

    expect(buildAgenterCliCompileCommand(target, outputPath)).toEqual([
      "bun",
      "build",
      resolve(import.meta.dir, "../..", "packages/cli/src/bin/agenter.ts"),
      "--compile",
      "--target",
      "bun-windows-arm64",
      "--outfile",
      outputPath,
    ]);
  });

  test("Scenario: Given host-only smoke build runs When the current host target is compiled Then a real executable is emitted without touching package staging", async () => {
    const outputRoot = createTempDir();
    const target = resolveCurrentAgenterCliTarget();
    const outputPath = join(outputRoot, target.binaryName);

    const result = await buildAgenterCliBinary({
      output: outputPath,
      targetId: target.targetId,
    });

    expect(result.target.targetId).toBe(target.targetId);
    expect(result.outputPath).toBe(resolve(outputPath));
    expect(existsSync(result.outputPath)).toBe(true);
  }, 120_000);
});
