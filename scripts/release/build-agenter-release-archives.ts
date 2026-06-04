#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";

import {
  agenterCliTargets,
  createAgenterCliArchivePath,
  createAgenterCliNativeArtifactPath,
  type AgenterCliTarget,
} from "../binaries/agenter-cli-artifacts";
import {
  agenterReleaseArchiveManifestFileName,
  createAgenterReleaseArchiveManifest,
  writeAgenterReleaseArchiveManifest,
  type AgenterReleaseArchiveManifest,
} from "./agenter-release-archive-manifest";

const repoRoot = resolve(import.meta.dir, "../..");

interface PackageJson {
  version: string;
}

export interface BuildAgenterReleaseArchivesOptions {
  inputDir: string;
  outputDir: string;
  owner?: string;
  releaseTag?: string;
  repo?: string;
  version?: string;
}

export interface BuiltAgenterReleaseArchive {
  archivePath: string;
  checksumPath: string;
  sourceBinaryPath: string;
  target: AgenterCliTarget;
}

export interface BuildAgenterReleaseArchivesResult {
  archives: BuiltAgenterReleaseArchive[];
  manifest: AgenterReleaseArchiveManifest;
  manifestPath: string;
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

const readAgenterVersion = async (): Promise<string> => {
  const packageJson = (await Bun.file(join(repoRoot, "packages/agenter/package.json")).json()) as PackageJson;
  return packageJson.version;
};

const resolveReleaseTag = (version: string, releaseTag?: string): string => releaseTag ?? `v${version}`;

const ensureArchiveInput = async (target: AgenterCliTarget, inputDir: string): Promise<string> => {
  const sourceBinaryPath = resolve(createAgenterCliNativeArtifactPath(inputDir, target));
  await readFile(sourceBinaryPath);
  return sourceBinaryPath;
};

const prepareArchiveStagingDir = async (target: AgenterCliTarget, sourceBinaryPath: string): Promise<string> => {
  const tempRoot = await mkdtemp(join(tmpdir(), "agenter-release-archive-"));
  const stagingDir = join(tempRoot, target.targetId);
  const stagingBinaryPath = join(stagingDir, target.archiveBinaryPath);
  await mkdir(dirname(stagingBinaryPath), { recursive: true });
  await copyFile(sourceBinaryPath, stagingBinaryPath);
  if (target.packageOs !== "win32") {
    await chmod(stagingBinaryPath, 0o755);
  }
  return stagingDir;
};

const createArchive = async (target: AgenterCliTarget, stagingDir: string, archivePath: string): Promise<void> => {
  await mkdir(dirname(archivePath), { recursive: true });
  await rm(archivePath, { force: true });
  if (target.archiveFormat === "tar.gz") {
    await run(["tar", "-czf", archivePath, "-C", stagingDir, target.archiveBinaryPath]);
    return;
  }
  await run(["zip", "-q", archivePath, target.archiveBinaryPath], stagingDir);
};

const computeSha256 = async (path: string): Promise<string> => createHash("sha256").update(await readFile(path)).digest("hex");

const writeChecksumFile = async (target: AgenterCliTarget, outputDir: string, sha256: string): Promise<string> => {
  const checksumPath = join(resolve(outputDir), target.checksumFileName);
  await writeFile(checksumPath, `${sha256}  ${target.archiveFileName}\n`);
  return checksumPath;
};

export const buildAgenterReleaseArchives = async (
  options: BuildAgenterReleaseArchivesOptions,
): Promise<BuildAgenterReleaseArchivesResult> => {
  const inputDir = resolve(options.inputDir);
  const outputDir = resolve(options.outputDir);
  const version = options.version ?? (await readAgenterVersion());
  const releaseTag = resolveReleaseTag(version, options.releaseTag);
  const archiveSha256ByTargetId: Record<string, string> = {};
  const archives: BuiltAgenterReleaseArchive[] = [];

  for (const target of agenterCliTargets) {
    const sourceBinaryPath = await ensureArchiveInput(target, inputDir);
    const stagingDir = await prepareArchiveStagingDir(target, sourceBinaryPath);
    try {
      const archivePath = resolve(createAgenterCliArchivePath(outputDir, target));
      await createArchive(target, stagingDir, archivePath);
      const archiveSha256 = await computeSha256(archivePath);
      archiveSha256ByTargetId[target.targetId] = archiveSha256;
      archives.push({
        archivePath,
        checksumPath: await writeChecksumFile(target, outputDir, archiveSha256),
        sourceBinaryPath,
        target,
      });
    } finally {
      await rm(dirname(stagingDir), { recursive: true, force: true });
    }
  }

  // GitHub release archives are the binary truth. npm packages and Homebrew
  // both project from this manifest instead of rebuilding or renaming targets
  // ad hoc at their own layer.
  const manifest = createAgenterReleaseArchiveManifest({
    archiveSha256ByTargetId,
    generatedAt: new Date().toISOString(),
    owner: options.owner,
    releaseTag,
    repo: options.repo,
    version,
  });
  const manifestPath = join(outputDir, agenterReleaseArchiveManifestFileName);
  await writeAgenterReleaseArchiveManifest(manifestPath, manifest);
  return { archives, manifest, manifestPath };
};

export const parseArgs = async (argv: readonly string[]): Promise<BuildAgenterReleaseArchivesOptions> => {
  const { values } = parseNodeArgs({
    args: [...argv],
    options: {
      "input-dir": { type: "string" },
      "output-dir": { type: "string" },
      owner: { type: "string" },
      "release-tag": { type: "string" },
      repo: { type: "string" },
      version: { type: "string" },
    },
  });
  if (!values["input-dir"]) {
    throw new Error("build-agenter-release-archives requires --input-dir");
  }
  if (!values["output-dir"]) {
    throw new Error("build-agenter-release-archives requires --output-dir");
  }
  return {
    inputDir: values["input-dir"],
    outputDir: values["output-dir"],
    owner: values.owner,
    releaseTag: values["release-tag"],
    repo: values.repo,
    version: values.version,
  };
};

if (import.meta.main) {
  const result = await buildAgenterReleaseArchives(await parseArgs(Bun.argv.slice(2)));
  console.log(result.manifestPath);
}
