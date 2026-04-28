import {
  readRuntimeSkillFingerprintManifest,
  writeRuntimeSkillFingerprintManifest,
} from "./runtime-skill-fingerprint-manifest";
import {
  projectRuntimeSkillBaselineStates,
  type RuntimeSkillDiffState,
  type RuntimeSkillTruthState,
} from "./runtime-skill-truth";

const toDiffSnapshot = (snapshot: Map<string, RuntimeSkillDiffState>): Map<string, RuntimeSkillDiffState> =>
  new Map(
    [...snapshot.entries()].map(([name, state]) => [
      name,
      {
        skill: {
          name: state.skill.name,
          rootKind: state.skill.rootKind,
          skillDir: state.skill.skillDir,
          path: state.skill.path,
          summary: state.skill.summary,
          configExists: state.skill.configExists,
        },
        observedFiles: state.observedFiles,
      },
    ]),
  );

export class RuntimeSkillBaselineStore {
  constructor(private readonly manifestPath?: string) {}

  resolveChangeBaseline(
    previousTracked: Map<string, RuntimeSkillTruthState>,
    publishReminders: boolean,
  ): Map<string, RuntimeSkillDiffState> | null {
    if (!publishReminders) {
      return null;
    }
    if (!this.manifestPath) {
      return toDiffSnapshot(previousTracked);
    }
    const manifest = readRuntimeSkillFingerprintManifest(this.manifestPath);
    if (manifest.kind === "ok") {
      return toDiffSnapshot(manifest.trackedSkills);
    }
    return null;
  }

  write(snapshot: Map<string, RuntimeSkillTruthState>): void {
    if (!this.manifestPath) {
      return;
    }
    writeRuntimeSkillFingerprintManifest(this.manifestPath, projectRuntimeSkillBaselineStates(snapshot));
  }
}
