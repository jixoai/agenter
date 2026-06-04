#!/usr/bin/env bun
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs as parseNodeArgs } from "node:util";

import { stageArtifact } from "../binaries/artifacts";
import {
  agenterCliTargets,
  resolveAgenterCliTargetById,
  type AgenterCliTarget,
} from "../binaries/agenter-cli-artifacts";
import {
  readAgenterReleaseArchiveManifest,
  resolveReleaseArchiveRecord,
  type AgenterReleaseArchiveRecord,
} from "./agenter-release-archive-manifest";

const repoRoot = resolve(import.meta.dir, "../..");

export interface StageAgenterCliPackagesFromReleaseArchivesOptions {
  archiveDir?: string;
  manifestPath: string;
  targetId?: string;
  workspaceRoot?: string;
}

export interface StagedAgenterCliPackageFromArchive {
  archivePath: string;
  destinationPath: string;
  sourcePath: string;
  target: AgenterCliTarget;
}

const run = async (cmd: string[], cwd = repoRoot): Promise<void> => {
  const proc = Bun.spawn({
    cmd,
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed with exit code ${exitCode}`);
  }
};

const resolveTargets = (targetId?: string): readonly AgenterCliTarget[] =>
  targetId ? [resolveAgenterCliTargetById(targetId)] : agenterCliTargets;

const resolveArchivePath = async (
  archiveDir: string,
  record: AgenterReleaseArchiveRecord,
  target: AgenterCliTarget,
): Promise<string> => {
  if (record.packageName !== target.packageName) {
    throw new Error(
      `release archive manifest drift for ${target.targetId}: expected package ${target.packageName}, got ${record.packageName}`,
    );
  }
  const archivePath = join(resolve(archiveDir), record.archiveFileName);
  try {
    await access(archivePath);
  } catch {
    throw new Error(`missing canonical release archive for ${target.targetId}: ${archivePath}`);
  }
  return archivePath;
};

const extractArchiveBinary = async (
  target: AgenterCliTarget,
  archivePath: string,
  record: AgenterReleaseArchiveRecord,
): Promise<string> => {
  const extractDir = await mkdtemp(join(tmpdir(), `agenter-release-extract-${target.targetId}-`));
  try {
    if (target.archiveFormat === "tar.gz") {
      await run(["tar", "-xzf", archivePath, "-C", extractDir]);
    } else {
      await run(["unzip", "-q", archivePath, "-d", extractDir]);
    }
    const extractedBinaryPath = join(extractDir, record.archiveBinaryPath);
    await readFile(extractedBinaryPath);
    const stagedCopyDir = await mkdtemp(join(tmpdir(), `agenter-release-copy-${target.targetId}-`));
    const stagedCopyPath = join(stagedCopyDir, target.binaryName);
    await Bun.write(stagedCopyPath, await readFile(extractedBinaryPath));
    return stagedCopyPath;
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
};

export const stageAgenterCliPackagesFromReleaseArchives = async (
  options: StageAgenterCliPackagesFromReleaseArchivesOptions,
): Promise<StagedAgenterCliPackageFromArchive[]> => {
  const manifest = await readAgenterReleaseArchiveManifest(options.manifestPath);
  const archiveDir = resolve(options.archiveDir ?? dirname(options.manifestPath));
  const workspaceRoot = resolve(options.workspaceRoot ?? repoRoot);
  const results: StagedAgenterCliPackageFromArchive[] = [];

  for (const target of resolveTargets(options.targetId)) {
    const record = resolveReleaseArchiveRecord(manifest, target);
    const archivePath = await resolveArchivePath(archiveDir, record, target);
    const extractedBinaryPath = await extractArchiveBinary(target, archivePath, record);
    try {
      const destinationPath = `${target.packageDir}/${record.packageBinaryPath}`;
      // Platform packages are projections of archive truth. The package layer
      // copies from the canonical release archive instead of treating package
      // staging as a second binary build authority.
      await stageArtifact(workspaceRoot, extractedBinaryPath, destinationPath);
      results.push({
        archivePath,
        destinationPath: join(workspaceRoot, destinationPath),
        sourcePath: extractedBinaryPath,
        target,
      });
    } finally {
      await rm(dirname(extractedBinaryPath), { recursive: true, force: true });
    }
  }

  return results;
};

export const parseArgs = (argv: readonly string[]): StageAgenterCliPackagesFromReleaseArchivesOptions => {
  const { values } = parseNodeArgs({
    args: [...argv],
    options: {
      "archive-dir": { type: "string" },
      manifest: { type: "string" },
      "target-id": { type: "string" },
      "workspace-root": { type: "string" },
    },
  });
  if (!values.manifest) {
    throw new Error("stage-agenter-cli-packages-from-release-archives requires --manifest");
  }
  return {
    archiveDir: values["archive-dir"],
    manifestPath: values.manifest,
    targetId: values["target-id"],
    workspaceRoot: values["workspace-root"],
  };
};

if (import.meta.main) {
  const staged = await stageAgenterCliPackagesFromReleaseArchives(parseArgs(Bun.argv.slice(2)));
  for (const entry of staged) {
    console.log(`staged ${entry.target.packageName} from ${entry.archivePath}`);
  }
}
