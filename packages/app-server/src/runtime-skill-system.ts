import { RuntimeSkillBaselineStore } from "./runtime-skill-baseline-store";
import type { RuntimeSkillConfig } from "./runtime-skill-config";
import { writeRuntimeSkillConfigFile } from "./runtime-skill-config";
import {
  RUNTIME_SKILL_CONTEXT_ID,
  RUNTIME_SKILL_DEFAULT_TARGET,
  RUNTIME_SKILL_SNAPSHOT_TARGET,
  type RuntimeSkillConfigInfo,
  type RuntimeSkillInfo,
  type RuntimeSkillRefreshResult,
  type RuntimeSkillRemoveResult,
  type RuntimeSkillSetConfigResult,
  type RuntimeSkillSystemInput,
  type RuntimeSkillUpsertResult,
} from "./runtime-skill-contract";
import { diffRuntimeSkillSnapshots } from "./runtime-skill-diff";
import { buildRuntimeSkillChangeIngresses, buildRuntimeSkillSnapshotIngress } from "./runtime-skill-ingress";
import { normalizeRuntimeSkillName } from "./runtime-skill-markdown";
import {
  buildRuntimeSkillTruthEntry,
  buildRuntimeSkillTruthSnapshot,
  type RuntimeSkillTruthState,
} from "./runtime-skill-truth";
import { RuntimeSkillWatchService } from "./runtime-skill-watch-service";
import {
  buildRuntimeSkillsList,
  findRuntimeSkill,
  getRuntimeSkillByName,
  listRuntimeSkills,
  readRuntimeSkillContent,
  removeRuntimeSkillFile,
  resolveRuntimeSkillRoots,
  upsertRuntimeSkillFile,
  type RuntimeSkillRecord,
  type RuntimeSkillRootKind,
  type RuntimeSkillWritableRootKind,
} from "./runtime-skills";
import type { RuntimeSystemIngressEnvelope } from "./runtime-system-kernel-adapters/types";
import { resolveWorkspaceGrantModeFromAbsolutePath } from "./workspace-system";

export {
  RUNTIME_SKILL_CONTEXT_ID,
  RUNTIME_SKILL_CONTEXT_TEMPLATE,
  RUNTIME_SKILL_DEFAULT_TARGET,
  RUNTIME_SKILL_SNAPSHOT_TARGET,
} from "./runtime-skill-contract";
export type {
  RuntimeSkillConfigInfo,
  RuntimeSkillInfo,
  RuntimeSkillRefreshResult,
  RuntimeSkillRemoveResult,
  RuntimeSkillSetConfigResult,
  RuntimeSkillSystemInput,
  RuntimeSkillUpsertResult,
  RuntimeSkillWorkspaceAuthority,
} from "./runtime-skill-contract";

const RUNTIME_SKILL_REMINDER_SCORE_KEY = "runtime-skill-system";

export class RuntimeSkillSystem {
  private skills: RuntimeSkillRecord[] = [];
  private trackedSkills = new Map<string, RuntimeSkillTruthState>();
  private pendingBootstrap = false;
  private initialized = false;
  private publishedSnapshot = "";
  private readonly baselineStore: RuntimeSkillBaselineStore;
  private readonly watchService: RuntimeSkillWatchService;

  constructor(private readonly input: RuntimeSkillSystemInput) {
    this.baselineStore = new RuntimeSkillBaselineStore(input.fingerprintManifestPath);
    this.watchService = new RuntimeSkillWatchService({
      watchDebounceMs: input.watchDebounceMs,
      watchPollMs: input.watchPollMs,
      unrefTimers: input.unrefTimers,
      onIdleFlush: async () => {
        const result = this.flushPendingChanges();
        if (!result || (result.systemIngress === null && result.reminderIngresses.length === 0)) {
          return;
        }
        await input.onIdleFlush?.(result);
      },
    });
  }

  list(): RuntimeSkillRecord[] {
    this.ensureTrackedState();
    return [...this.skills];
  }

  search(query: string): RuntimeSkillRecord[] {
    this.ensureTrackedState();
    return findRuntimeSkill({
      ...this.input,
      query,
    });
  }

  info(name: string, rootKind?: RuntimeSkillRootKind): RuntimeSkillInfo | null {
    const normalizedName = normalizeRuntimeSkillName(name);
    if (!normalizedName) {
      return null;
    }
    const skill =
      getRuntimeSkillByName({
        ...this.input,
        name: normalizedName,
        rootKind,
      }) ??
      this.skills.find((entry) => entry.name === normalizedName && (rootKind ? entry.rootKind === rootKind : true)) ??
      null;
    if (!skill) {
      return null;
    }
    return {
      skill,
      content: readRuntimeSkillContent(skill),
    };
  }

  getConfig(input: { name: string; rootKind?: RuntimeSkillRootKind }): RuntimeSkillConfigInfo | null {
    this.ensureTrackedState();
    const normalizedName = normalizeRuntimeSkillName(input.name);
    if (!normalizedName) {
      return null;
    }
    const tracked =
      input.rootKind === undefined
        ? (this.trackedSkills.get(normalizedName) ?? null)
        : (() => {
            const skill = getRuntimeSkillByName({
              ...this.input,
              name: normalizedName,
              rootKind: input.rootKind,
            });
            if (!skill) {
              return null;
            }
            return buildRuntimeSkillTruthEntry(skill);
          })();
    if (!tracked) {
      return null;
    }
    return {
      skill: tracked.skill,
      writable: this.canWriteConfig(tracked.skill),
      skillDir: tracked.skill.skillDir,
      skillPath: tracked.skill.path,
      configPath: tracked.configState.configPath,
      configExists: tracked.configState.configExists,
      config: tracked.configState.config,
      configError: tracked.configState.configError,
      resolvedWatchTargets: tracked.configState.resolvedWatchTargets,
    };
  }

  refresh(
    input: {
      forceBootstrap?: boolean;
      publishReminders?: boolean;
    } = {},
  ): RuntimeSkillRefreshResult {
    return this.refreshInternal({
      forceBootstrap: input.forceBootstrap === true,
      publishReminders: input.publishReminders === true,
    });
  }

  flushPendingChanges(): RuntimeSkillRefreshResult | null {
    if (!this.watchService.hasPendingChanges()) {
      return null;
    }
    this.watchService.prepareFlush();
    return this.refresh({
      publishReminders: true,
      forceBootstrap: false,
    });
  }

  upsert(input: { name: string; content: string; rootKind?: RuntimeSkillWritableRootKind }): RuntimeSkillUpsertResult {
    this.ensureTrackedState();
    const normalizedName = normalizeRuntimeSkillName(input.name);
    if (!normalizedName) {
      throw new Error(`invalid skill name: ${input.name}`);
    }
    const existingWritable = this.skills.find((skill) => skill.name === normalizedName && skill.rootKind !== "builtin");
    const skill = upsertRuntimeSkillFile({
      ...this.input,
      name: normalizedName,
      content: input.content,
      rootKind: input.rootKind,
    });
    const refreshed = this.refresh({
      publishReminders: true,
      forceBootstrap: false,
    });
    return {
      ...refreshed,
      created: !existingWritable,
      skill,
    };
  }

  remove(input: { name: string; rootKind?: RuntimeSkillWritableRootKind }): RuntimeSkillRemoveResult {
    this.ensureTrackedState();
    const normalizedName = normalizeRuntimeSkillName(input.name);
    if (!normalizedName) {
      throw new Error(`invalid skill name: ${input.name}`);
    }
    const visibleSkill = getRuntimeSkillByName({
      ...this.input,
      name: normalizedName,
    });
    if (!input.rootKind && visibleSkill?.rootKind === "builtin") {
      throw new Error(`skill is read-only: ${normalizedName}`);
    }

    const removed = removeRuntimeSkillFile({
      ...this.input,
      name: normalizedName,
      rootKind: input.rootKind,
    });
    const refreshed = this.refresh({
      publishReminders: true,
      forceBootstrap: false,
    });
    if (!removed.removed) {
      return {
        ...refreshed,
        removed: false,
        removedPath: null,
        removedRootKind: removed.rootKind,
      };
    }
    return {
      ...refreshed,
      removed: true,
      removedPath: removed.path,
      removedRootKind: removed.rootKind,
    };
  }

  setConfig(input: {
    name: string;
    config: RuntimeSkillConfig;
    rootKind?: RuntimeSkillRootKind;
  }): RuntimeSkillSetConfigResult {
    this.ensureTrackedState();
    const normalizedName = normalizeRuntimeSkillName(input.name);
    if (!normalizedName) {
      throw new Error(`invalid skill name: ${input.name}`);
    }
    const skill = getRuntimeSkillByName({
      ...this.input,
      name: normalizedName,
      rootKind: input.rootKind,
    });
    if (!skill) {
      throw new Error(`skill not found: ${input.name}`);
    }
    if (!this.canWriteConfig(skill)) {
      throw new Error(`skill config is read-only: ${skill.name}`);
    }
    const configPath = writeRuntimeSkillConfigFile(skill, input.config);
    const refreshed = this.refresh({
      publishReminders: true,
      forceBootstrap: false,
    });
    return {
      ...refreshed,
      skill,
      configPath,
    };
  }

  dispose(): void {
    this.watchService.dispose();
  }

  private ensureTrackedState(): void {
    if (this.initialized) {
      return;
    }
    const skills = listRuntimeSkills(this.input);
    const tracked = this.buildTrackedSkills(skills);
    this.skills = skills;
    this.trackedSkills = tracked;
    this.initialized = true;
    this.syncWatchers(tracked);
  }

  private refreshInternal(input: { forceBootstrap: boolean; publishReminders: boolean }): RuntimeSkillRefreshResult {
    const previousTracked = this.trackedSkills;
    const skills = listRuntimeSkills(this.input);
    const tracked = this.buildTrackedSkills(skills);
    const snapshot = buildRuntimeSkillsList(skills);

    this.skills = skills;
    this.trackedSkills = tracked;
    this.initialized = true;
    this.watchService.clearPendingChanges();

    let systemIngress: RuntimeSystemIngressEnvelope | null = null;
    if (this.publishedSnapshot !== snapshot) {
      systemIngress = buildRuntimeSkillSnapshotIngress({
        owner: this.input.owner,
        contextId: RUNTIME_SKILL_CONTEXT_ID,
        target: RUNTIME_SKILL_SNAPSHOT_TARGET,
        snapshot,
        createdAt: Date.now(),
      });
      this.publishedSnapshot = snapshot;
      this.pendingBootstrap = true;
    } else if (input.forceBootstrap) {
      this.pendingBootstrap = true;
    }

    const baselineTracked = this.baselineStore.resolveChangeBaseline(previousTracked, input.publishReminders);
    const changedSkills = baselineTracked ? diffRuntimeSkillSnapshots(baselineTracked, tracked) : [];
    const reminderIngresses = buildRuntimeSkillChangeIngresses({
      owner: this.input.owner,
      contextId: RUNTIME_SKILL_CONTEXT_ID,
      target: RUNTIME_SKILL_DEFAULT_TARGET,
      scoreKey: RUNTIME_SKILL_REMINDER_SCORE_KEY,
      changes: changedSkills,
      createdAt: Date.now(),
    });
    if (reminderIngresses.length > 0) {
      this.pendingBootstrap = true;
    }

    this.syncWatchers(tracked);
    this.baselineStore.write(tracked);

    return {
      contextId: RUNTIME_SKILL_CONTEXT_ID,
      skills,
      snapshot,
      changedSkills,
      systemIngress,
      reminderIngresses,
      bootstrapPending: this.pendingBootstrap,
    };
  }

  private buildTrackedSkills(skills: RuntimeSkillRecord[]): Map<string, RuntimeSkillTruthState> {
    return buildRuntimeSkillTruthSnapshot(skills);
  }

  private syncWatchers(tracked: Map<string, RuntimeSkillTruthState>): void {
    this.watchService.sync(resolveRuntimeSkillRoots(this.input), tracked);
  }

  private markSkillDirty(name: string): void {
    this.watchService.markSkillDirty(name);
  }

  private canWriteConfig(skill: RuntimeSkillRecord): boolean {
    if (skill.rootKind !== "builtin") {
      return skill.writable;
    }
    const authorities = this.input.listWorkspaceAuthorities?.() ?? [];
    return authorities.some(
      (authority) =>
        resolveWorkspaceGrantModeFromAbsolutePath({
          workspaceRoot: authority.workspaceRoot,
          absolutePath: skill.configPath,
          grants: authority.grants,
        }) === "rw",
    );
  }
}
