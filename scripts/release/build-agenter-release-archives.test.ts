import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { agenterCliTargets, createAgenterCliNativeArtifactPath } from "../binaries/agenter-cli-artifacts";
import { readAgenterReleaseArchiveManifest, resolveReleaseArchiveRecord } from "./agenter-release-archive-manifest";
import { buildAgenterReleaseArchives } from "./build-agenter-release-archives";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-release-archives-"));
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

describe("Feature: agenter canonical release archive build", () => {
  test("Scenario: Given the target matrix is compiled When release archives are built Then every target gets the fixed archive name, checksum, and manifest entry", async () => {
    const inputDir = createTempDir();
    const outputDir = createTempDir();
    seedNativeArtifacts(inputDir);

    const result = await buildAgenterReleaseArchives({
      inputDir,
      outputDir,
      releaseTag: "v0.0.10",
      version: "0.0.10",
    });
    const manifest = await readAgenterReleaseArchiveManifest(result.manifestPath);

    expect(result.archives).toHaveLength(agenterCliTargets.length);
    expect(existsSync(result.manifestPath)).toBe(true);
    expect(manifest.releaseTag).toBe("v0.0.10");
    expect(resolveReleaseArchiveRecord(manifest, { targetId: "darwin-arm64" })).toMatchObject({
      archiveFileName: "agenter-darwin-arm64.tar.gz",
      packageName: "@jixoai/cli-darwin-arm64",
    });
    expect(resolveReleaseArchiveRecord(manifest, { targetId: "win32-x64" })).toMatchObject({
      archiveFileName: "agenter-win32-x64.zip",
      packageName: "@jixoai/cli-win32-x64",
    });
    expect(result.archives.every((archive) => existsSync(archive.archivePath))).toBe(true);
    expect(result.archives.every((archive) => existsSync(archive.checksumPath))).toBe(true);
    expect(readFileSync(join(outputDir, "agenter-darwin-arm64.sha256"), "utf8")).toContain(
      "agenter-darwin-arm64.tar.gz",
    );
    expect(readFileSync(join(outputDir, "agenter-win32-x64.sha256"), "utf8")).toContain("agenter-win32-x64.zip");
  });
});
