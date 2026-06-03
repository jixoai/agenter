#!/usr/bin/env bun
import { resolve } from "node:path";

import { agenterCliTargets, type AgenterCliTarget } from "../binaries/agenter-cli-artifacts";

const repoRoot = resolve(import.meta.dir, "../..");

export interface PackedFileEntry {
  path: string;
}

export interface PackedPackageEntry {
  files?: PackedFileEntry[];
  name?: string;
  version?: string;
}

const normalizePackedFiles = (entries: PackedFileEntry[] | undefined): string[] =>
  (entries ?? []).map((entry) => entry.path).sort((left, right) => left.localeCompare(right));

export const expectedAgenterWrapperPackedFiles = (): string[] =>
  [
    "CHANGELOG.md",
    "SPEC.md",
    "bin/agenter.exe",
    "cli-wrapper.cjs",
    "install.cjs",
    "native-platform.cjs",
    "package.json",
  ]
    .slice()
    .sort((left, right) => left.localeCompare(right));

export const expectedAgenterPlatformPackedFiles = (target: AgenterCliTarget): string[] =>
  ["README.md", target.packageBinaryPath, "package.json"].slice().sort((left, right) => left.localeCompare(right));

export const assertPackedFilesEqual = (
  label: string,
  actualEntries: PackedFileEntry[] | undefined,
  expectedFiles: string[],
): void => {
  const actual = normalizePackedFiles(actualEntries);
  const expected = [...expectedFiles].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} packed files mismatch\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`,
    );
  }
};

export const runNpmPackDryRun = async (packageDir: string): Promise<PackedPackageEntry> => {
  const proc = Bun.spawn({
    cmd: ["npm", "pack", "--dry-run", "--json", packageDir],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`npm pack --dry-run failed for ${packageDir}: ${stderr.trim()}`);
  }
  const result = JSON.parse(stdout) as PackedPackageEntry[];
  if (result.length !== 1) {
    throw new Error(`npm pack --dry-run for ${packageDir} returned ${result.length} entries`);
  }
  return result[0];
};

export const verifyAgenterWrapperPackage = async (): Promise<void> => {
  const pack = await runNpmPackDryRun("./packages/agenter");
  assertPackedFilesEqual("agenter wrapper", pack.files, expectedAgenterWrapperPackedFiles());
};

export const verifyAgenterPlatformPackage = async (target: AgenterCliTarget): Promise<void> => {
  const pack = await runNpmPackDryRun(`./${target.packageDir}`);
  assertPackedFilesEqual(target.packageName, pack.files, expectedAgenterPlatformPackedFiles(target));
};

export const verifyAgenterNativeCliPackages = async (): Promise<void> => {
  await verifyAgenterWrapperPackage();
  for (const target of agenterCliTargets) {
    await verifyAgenterPlatformPackage(target);
  }
};

if (import.meta.main) {
  await verifyAgenterNativeCliPackages();
  console.log("verified agenter wrapper and native CLI platform packages");
}
