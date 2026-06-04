import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  agenterCliTargets,
  createAgenterCliNativeArtifactPath,
  resolveAgenterCliTargetById,
} from "../binaries/agenter-cli-artifacts";
import { buildAgenterReleaseArchives } from "./build-agenter-release-archives";
import { stageAgenterCliPackagesFromReleaseArchives } from "./stage-agenter-cli-packages-from-release-archives";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-stage-from-archives-"));
  tempDirs.push(dir);
  return dir;
};

const seedNativeArtifacts = (inputDir: string): void => {
  for (const target of agenterCliTargets) {
    const artifactPath = createAgenterCliNativeArtifactPath(inputDir, target);
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, `binary-${target.targetId}\n`);
  }
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() ?? "", { recursive: true, force: true });
  }
});

describe("Feature: agenter package staging from canonical archives", () => {
  test("Scenario: Given canonical release archives exist When platform packages are staged Then npm projection copies the binary from archive truth", async () => {
    const inputDir = createTempDir();
    const archiveDir = createTempDir();
    const workspaceRoot = createTempDir();
    seedNativeArtifacts(inputDir);

    const { manifestPath } = await buildAgenterReleaseArchives({
      inputDir,
      outputDir: archiveDir,
      releaseTag: "v0.0.10",
      version: "0.0.10",
    });
    const target = resolveAgenterCliTargetById("linux-x64-gnu");
    const staged = await stageAgenterCliPackagesFromReleaseArchives({
      manifestPath,
      targetId: target.targetId,
      workspaceRoot,
    });

    expect(staged).toHaveLength(1);
    expect(readFileSync(join(workspaceRoot, target.artifactPath), "utf8")).toBe("binary-linux-x64-gnu\n");
  });

  test("Scenario: Given a projection step runs before the canonical archive exists When staging starts Then the failure is explicit and closed", async () => {
    const inputDir = createTempDir();
    const archiveDir = createTempDir();
    const workspaceRoot = createTempDir();
    seedNativeArtifacts(inputDir);

    const { manifestPath } = await buildAgenterReleaseArchives({
      inputDir,
      outputDir: archiveDir,
      releaseTag: "v0.0.10",
      version: "0.0.10",
    });
    unlinkSync(join(archiveDir, "agenter-win32-x64.zip"));

    await expect(
      stageAgenterCliPackagesFromReleaseArchives({
        manifestPath,
        targetId: "win32-x64",
        workspaceRoot,
      }),
    ).rejects.toThrow(`missing canonical release archive for win32-x64: ${join(archiveDir, "agenter-win32-x64.zip")}`);
  });
});
