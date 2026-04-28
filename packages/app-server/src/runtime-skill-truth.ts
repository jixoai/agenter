import type { RuntimeSkillConfigState } from "./runtime-skill-config";
import { buildRuntimeSkillFileFingerprintMap, readRuntimeSkillConfigState } from "./runtime-skill-config";
import type { RuntimeSkillFingerprintManifestState } from "./runtime-skill-fingerprint-manifest";
import type { RuntimeSkillRecord } from "./runtime-skills";

export interface RuntimeSkillTruthState {
  skill: RuntimeSkillRecord;
  configState: RuntimeSkillConfigState;
  observedFiles: Map<string, string>;
}

export interface RuntimeSkillDiffState {
  skill: Pick<RuntimeSkillRecord, "name" | "path" | "rootKind" | "summary" | "configExists" | "skillDir">;
  observedFiles: Map<string, string>;
}

export const buildRuntimeSkillTruthEntry = (skill: RuntimeSkillRecord): RuntimeSkillTruthState => {
  const configState = readRuntimeSkillConfigState(skill);
  return {
    skill,
    configState,
    observedFiles: buildRuntimeSkillFileFingerprintMap(skill, configState),
  };
};

export const buildRuntimeSkillTruthSnapshot = (skills: RuntimeSkillRecord[]): Map<string, RuntimeSkillTruthState> =>
  new Map(skills.map((skill) => [skill.name, buildRuntimeSkillTruthEntry(skill)] as const));

export const projectRuntimeSkillBaselineStates = (
  snapshot: Map<string, RuntimeSkillTruthState>,
): RuntimeSkillFingerprintManifestState[] =>
  [...snapshot.values()].map(
    (state): RuntimeSkillFingerprintManifestState => ({
      skill: {
        name: state.skill.name,
        rootKind: state.skill.rootKind,
        skillDir: state.skill.skillDir,
        path: state.skill.path,
        summary: state.skill.summary,
        configExists: state.skill.configExists,
      },
      observedFiles: state.observedFiles,
    }),
  );
