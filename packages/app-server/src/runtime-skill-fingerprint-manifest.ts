import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

import type { RuntimeSkillRootKind } from "./runtime-skills";

export const RUNTIME_SKILL_FINGERPRINT_MANIFEST_VERSION = 1;

const runtimeSkillFingerprintFileSchema = z
  .object({
    path: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict();

const runtimeSkillFingerprintEntrySchema = z
  .object({
    name: z.string().min(1),
    rootKind: z.enum(["shared", "global", "avatar", "builtin"]),
    skillDir: z.string().min(1),
    path: z.string().min(1),
    summary: z.string(),
    configExists: z.boolean(),
    observedFiles: z.array(runtimeSkillFingerprintFileSchema),
  })
  .strict();

const runtimeSkillFingerprintManifestSchema = z
  .object({
    version: z.literal(RUNTIME_SKILL_FINGERPRINT_MANIFEST_VERSION),
    generatedAt: z.string(),
    skills: z.array(runtimeSkillFingerprintEntrySchema),
  })
  .strict();

export interface RuntimeSkillFingerprintManifestState {
  skill: {
    name: string;
    rootKind: RuntimeSkillRootKind;
    skillDir: string;
    path: string;
    summary: string;
    configExists: boolean;
  };
  observedFiles: Map<string, string>;
}

export type RuntimeSkillFingerprintManifestReadResult =
  | {
      kind: "ok";
      trackedSkills: Map<string, RuntimeSkillFingerprintManifestState>;
    }
  | {
      kind: "missing";
    }
  | {
      kind: "invalid";
      error: string;
    };

export const readRuntimeSkillFingerprintManifest = (path: string): RuntimeSkillFingerprintManifestReadResult => {
  if (!existsSync(path)) {
    return { kind: "missing" };
  }
  try {
    const parsed = runtimeSkillFingerprintManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    return {
      kind: "ok",
      trackedSkills: new Map(
        parsed.skills.map((entry) => [
          entry.name,
          {
            skill: {
              name: entry.name,
              rootKind: entry.rootKind,
              skillDir: entry.skillDir,
              path: entry.path,
              summary: entry.summary,
              configExists: entry.configExists,
            },
            observedFiles: new Map(entry.observedFiles.map((file) => [file.path, file.fingerprint] as const)),
          },
        ]),
      ),
    };
  } catch (error) {
    return {
      kind: "invalid",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const writeRuntimeSkillFingerprintManifest = (
  path: string,
  trackedSkills: Iterable<RuntimeSkillFingerprintManifestState>,
): void => {
  const skills = [...trackedSkills]
    .map((state) => ({
      name: state.skill.name,
      rootKind: state.skill.rootKind,
      skillDir: state.skill.skillDir,
      path: state.skill.path,
      summary: state.skill.summary,
      configExists: state.skill.configExists,
      observedFiles: [...state.observedFiles.entries()]
        .map(([filePath, fingerprint]) => ({
          path: filePath,
          fingerprint,
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const manifest = {
    version: RUNTIME_SKILL_FINGERPRINT_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    skills,
  };
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
};
