import { formatRuntimeSkillRelativeFiles } from "./runtime-skill-config";
import type { RuntimeSkillDiffState } from "./runtime-skill-truth";
import type { RuntimeSkillRootKind } from "./runtime-skills";

export interface RuntimeSkillChange {
  name: string;
  kind: "added" | "updated" | "removed";
  rootKind: RuntimeSkillRootKind | null;
  skillDir: string;
  changedFiles: string[];
}

export const runtimeSkillFileFingerprintsEqual = (left: Map<string, string>, right: Map<string, string>): boolean => {
  if (left.size !== right.size) {
    return false;
  }
  for (const [key, value] of left.entries()) {
    if (right.get(key) !== value) {
      return false;
    }
  }
  return true;
};

const buildChangedFiles = (left: Map<string, string>, right: Map<string, string>): string[] => {
  const changed = new Set<string>();
  for (const [path, fingerprint] of left.entries()) {
    if (right.get(path) !== fingerprint) {
      changed.add(path);
    }
  }
  for (const [path, fingerprint] of right.entries()) {
    if (left.get(path) !== fingerprint) {
      changed.add(path);
    }
  }
  return [...changed].sort((a, b) => a.localeCompare(b));
};

export const diffRuntimeSkillSnapshots = (
  previous: Map<string, RuntimeSkillDiffState>,
  next: Map<string, RuntimeSkillDiffState>,
): RuntimeSkillChange[] => {
  const keys = new Set([...previous.keys(), ...next.keys()]);
  const changes: RuntimeSkillChange[] = [];
  for (const name of [...keys].sort((left, right) => left.localeCompare(right))) {
    const before = previous.get(name);
    const after = next.get(name);
    if (!before && after) {
      changes.push({
        name,
        kind: "added",
        rootKind: after.skill.rootKind,
        skillDir: after.skill.skillDir,
        changedFiles: [...after.observedFiles.keys()],
      });
      continue;
    }
    if (before && !after) {
      changes.push({
        name,
        kind: "removed",
        rootKind: before.skill.rootKind,
        skillDir: before.skill.skillDir,
        changedFiles: [...before.observedFiles.keys()],
      });
      continue;
    }
    if (!before || !after) {
      continue;
    }
    const recordChanged =
      before.skill.path !== after.skill.path ||
      before.skill.rootKind !== after.skill.rootKind ||
      before.skill.summary !== after.skill.summary ||
      before.skill.configExists !== after.skill.configExists;
    if (!recordChanged && runtimeSkillFileFingerprintsEqual(before.observedFiles, after.observedFiles)) {
      continue;
    }
    const changedFiles = buildChangedFiles(before.observedFiles, after.observedFiles);
    if (recordChanged && changedFiles.length === 0) {
      changedFiles.push(before.skill.path, after.skill.path);
    }
    changes.push({
      name,
      kind: "updated",
      rootKind: after.skill.rootKind,
      skillDir: after.skill.skillDir,
      changedFiles: [...new Set(changedFiles)].sort((left, right) => left.localeCompare(right)),
    });
  }
  return changes;
};

export const summarizeRuntimeSkillChange = (change: RuntimeSkillChange): string => {
  const prefix =
    change.kind === "added"
      ? "Added runtime skill"
      : change.kind === "removed"
        ? "Removed runtime skill"
        : "Updated runtime skill";
  const files = formatRuntimeSkillRelativeFiles(change.skillDir, change.changedFiles);
  return files.length > 0 ? `${prefix} ${change.name}: ${files.join(", ")}.` : `${prefix} ${change.name}.`;
};
