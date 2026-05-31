import type { RuntimeSkillConfig } from "./runtime-skill-config";
import type { RuntimeSkillChange } from "./runtime-skill-diff";
import type { RuntimeSkillLookupInput, RuntimeSkillRecord, RuntimeSkillWritableRootKind } from "./runtime-skills";
import type { RuntimeSystemIngressEnvelope } from "./runtime-system-kernel-adapters/types";
import type { WorkspaceGrantRecord } from "./workspace-system";

export interface RuntimeSkillWorkspaceAuthority {
  workspaceRoot: string;
  defaultCwd: string;
  env: Record<string, string>;
  grants: WorkspaceGrantRecord[];
}

export interface RuntimeSkillInfo {
  skill: RuntimeSkillRecord;
  content: string;
}

export interface RuntimeSkillConfigInfo {
  skill: RuntimeSkillRecord;
  writable: boolean;
  skillDir: string;
  skillPath: string;
  configPath: string;
  configExists: boolean;
  config: RuntimeSkillConfig | null;
  configError: string | null;
  resolvedWatchTargets: string[];
}

export interface RuntimeSkillRefreshResult {
  skills: RuntimeSkillRecord[];
  snapshot: string;
  changedSkills: RuntimeSkillChange[];
  publishedIngresses: RuntimeSystemIngressEnvelope[];
}

export interface RuntimeSkillUpsertResult extends RuntimeSkillRefreshResult {
  created: boolean;
  skill: RuntimeSkillRecord;
}

export interface RuntimeSkillRemoveResult extends RuntimeSkillRefreshResult {
  removed: boolean;
  removedPath: string | null;
  removedRootKind: RuntimeSkillWritableRootKind | null;
}

export interface RuntimeSkillSetConfigResult extends RuntimeSkillRefreshResult {
  skill: RuntimeSkillRecord;
  configPath: string;
}

export interface RuntimeSkillSystemInput extends RuntimeSkillLookupInput {
  owner: string;
  watchDebounceMs?: number;
  watchPollMs?: number;
  fingerprintManifestPath?: string;
  unrefTimers?: boolean;
  listWorkspaceAuthorities?: () => RuntimeSkillWorkspaceAuthority[];
  onIdleFlush?: (result: RuntimeSkillRefreshResult) => Promise<void> | void;
}
