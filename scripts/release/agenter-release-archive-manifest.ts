import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { agenterCliTargets, type AgenterCliTarget } from "../binaries/agenter-cli-artifacts";

export interface AgenterReleaseArchiveRecord {
  archiveBinaryPath: string;
  archiveFileName: string;
  archiveSha256: string;
  archiveUrl: string;
  homebrewBinaryPath: string;
  packageName: string;
  packageBinaryPath: string;
  targetId: string;
}

export interface AgenterReleaseArchiveManifest {
  generatedAt?: string;
  releaseTag: string;
  version: string;
  archives: AgenterReleaseArchiveRecord[];
}

export interface CreateAgenterReleaseArchiveManifestOptions {
  archiveSha256ByTargetId: Readonly<Record<string, string>>;
  generatedAt?: string;
  owner?: string;
  releaseTag: string;
  repo?: string;
  version: string;
}

export const agenterReleaseArchiveManifestFileName = "agenter-release-archives.json";
export const defaultAgenterReleaseArchiveOwner = "jixoai";
export const defaultAgenterReleaseArchiveRepo = "agenter";

export const homebrewProjectionTargets = agenterCliTargets.filter(
  (target) => target.packageOs !== "win32" && target.libc !== "musl",
);

export const createAgenterReleaseArchiveUrl = (input: {
  archiveFileName: string;
  owner?: string;
  releaseTag: string;
  repo?: string;
}): string => {
  const owner = input.owner ?? defaultAgenterReleaseArchiveOwner;
  const repo = input.repo ?? defaultAgenterReleaseArchiveRepo;
  return `https://github.com/${owner}/${repo}/releases/download/${input.releaseTag}/${input.archiveFileName}`;
};

export const createAgenterReleaseArchiveRecord = (
  target: AgenterCliTarget,
  input: Pick<CreateAgenterReleaseArchiveManifestOptions, "archiveSha256ByTargetId" | "owner" | "releaseTag" | "repo">,
): AgenterReleaseArchiveRecord => {
  const archiveSha256 = input.archiveSha256ByTargetId[target.targetId];
  if (!archiveSha256) {
    throw new Error(`release archive manifest is missing checksum truth for target ${target.targetId}`);
  }
  return {
    targetId: target.targetId,
    archiveFileName: target.archiveFileName,
    archiveBinaryPath: target.archiveBinaryPath,
    archiveSha256,
    archiveUrl: createAgenterReleaseArchiveUrl({
      archiveFileName: target.archiveFileName,
      owner: input.owner,
      releaseTag: input.releaseTag,
      repo: input.repo,
    }),
    homebrewBinaryPath: target.archiveBinaryPath,
    packageName: target.packageName,
    packageBinaryPath: target.packageBinaryPath,
  };
};

export const createAgenterReleaseArchiveManifest = (
  input: CreateAgenterReleaseArchiveManifestOptions,
): AgenterReleaseArchiveManifest => ({
  generatedAt: input.generatedAt,
  releaseTag: input.releaseTag,
  version: input.version,
  archives: agenterCliTargets.map((target) => createAgenterReleaseArchiveRecord(target, input)),
});

export const readAgenterReleaseArchiveManifest = async (manifestPath: string): Promise<AgenterReleaseArchiveManifest> =>
  JSON.parse(await readFile(resolve(manifestPath), "utf8")) as AgenterReleaseArchiveManifest;

export const writeAgenterReleaseArchiveManifest = async (
  manifestPath: string,
  manifest: AgenterReleaseArchiveManifest,
): Promise<void> => {
  await writeFile(resolve(manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
};

export const createReleaseArchiveIndex = (
  manifest: AgenterReleaseArchiveManifest,
): Map<string, AgenterReleaseArchiveRecord> => new Map(manifest.archives.map((record) => [record.targetId, record]));

export const resolveReleaseArchiveRecord = (
  manifest: AgenterReleaseArchiveManifest,
  target: Pick<AgenterCliTarget, "targetId">,
): AgenterReleaseArchiveRecord => {
  const record = createReleaseArchiveIndex(manifest).get(target.targetId);
  if (!record) {
    throw new Error(`release archive manifest is missing target ${target.targetId}`);
  }
  return record;
};
