import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { agenterCliTargets, type AgenterCliTarget } from "../binaries/agenter-cli-artifacts";

export interface AgenterReleaseArchiveRecord {
  archiveFileName: string;
  archiveSha256: string;
  archiveUrl: string;
  homebrewBinaryPath: string;
  packageBinaryPath: string;
  targetId: string;
}

export interface AgenterReleaseArchiveManifest {
  generatedAt?: string;
  releaseTag: string;
  version: string;
  archives: AgenterReleaseArchiveRecord[];
}

export const homebrewProjectionTargets = agenterCliTargets.filter(
  (target) => target.packageOs !== "win32" && target.libc !== "musl",
);

export const readAgenterReleaseArchiveManifest = async (manifestPath: string): Promise<AgenterReleaseArchiveManifest> =>
  JSON.parse(await readFile(resolve(manifestPath), "utf8")) as AgenterReleaseArchiveManifest;

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
