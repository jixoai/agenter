import { existsSync, statSync, watch, type FSWatcher } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

import type { RuntimeSkillConfig, RuntimeSkillConfigState, RuntimeSkillWatchSpec } from "./runtime-skill-config";
import {
  buildRuntimeSkillFileFingerprintMap,
  formatRuntimeSkillRelativeFiles,
  hasRuntimeSkillRecursiveWatchSpec,
  readRuntimeSkillConfigState,
  writeRuntimeSkillConfigFile,
  RUNTIME_SKILL_CONFIG_BASENAME,
} from "./runtime-skill-config";
import { normalizeRuntimeSkillName } from "./runtime-skill-markdown";
import {
  buildRuntimeSkillsList,
  findRuntimeSkill,
  getRuntimeSkillByName,
  listRuntimeSkills,
  readRuntimeSkillContent,
  removeRuntimeSkillFile,
  resolveRuntimeSkillRoots,
  upsertRuntimeSkillFile,
  type RuntimeSkillLookupInput,
  type RuntimeSkillRecord,
  type RuntimeSkillRootKind,
  type RuntimeSkillWritableRootKind,
} from "./runtime-skills";
import type { RuntimeSystemIngressEnvelope } from "./runtime-system-kernel-adapters/types";
import { resolveWorkspaceGrantModeFromAbsolutePath, type WorkspaceGrantRecord } from "./workspace-system";

export const RUNTIME_SKILL_CONTEXT_ID = "ctx-skill-system";
export const RUNTIME_SKILL_CONTEXT_TEMPLATE = "<Slot name=\"skills-list\" readonly/>\n<Slot name=\"default\"/>";
export const RUNTIME_SKILL_SNAPSHOT_TARGET = "skills-list";
export const RUNTIME_SKILL_DEFAULT_TARGET = "default";
const RUNTIME_SKILL_REMINDER_SCORE_KEY = "runtime-skill-system";
const DEFAULT_SKILL_WATCH_DEBOUNCE_MS = 800;
const DEFAULT_SKILL_WATCH_POLL_MS = 2_000;

interface RuntimeSkillTrackedState {
  skill: RuntimeSkillRecord;
  configState: RuntimeSkillConfigState;
  observedFiles: Map<string, string>;
}

interface RuntimeSkillWatchLocation {
  watchPath: string;
  filterName: string | null;
}

interface RuntimeSkillWatcherDescriptor {
  key: string;
  watchPath: string;
  filterName: string | null;
  kind: "root" | "skill" | "anchor";
  skillName?: string;
  rootKind?: RuntimeSkillWritableRootKind;
}

export interface RuntimeSkillWorkspaceAuthority {
  workspaceRoot: string;
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

export interface RuntimeSkillChange {
  name: string;
  kind: "added" | "updated" | "removed";
  rootKind: RuntimeSkillRootKind | null;
  skillDir: string;
  changedFiles: string[];
}

export interface RuntimeSkillRefreshResult {
  contextId: string;
  skills: RuntimeSkillRecord[];
  snapshot: string;
  changedSkills: RuntimeSkillChange[];
  systemIngress: RuntimeSystemIngressEnvelope | null;
  reminderIngresses: RuntimeSystemIngressEnvelope[];
  bootstrapPending: boolean;
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

const mapsEqual = (left: Map<string, string>, right: Map<string, string>): boolean => {
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

const summarizeRuntimeSkillChange = (change: RuntimeSkillChange): string => {
  const prefix =
    change.kind === "added"
      ? "Added runtime skill"
      : change.kind === "removed"
        ? "Removed runtime skill"
        : "Updated runtime skill";
  const files = formatRuntimeSkillRelativeFiles(change.skillDir, change.changedFiles);
  return files.length > 0
    ? `${prefix} ${change.name}: ${files.join(", ")}.`
    : `${prefix} ${change.name}.`;
};

const normalizeWatchEventFilename = (value: string | Buffer | null): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Buffer) {
    return value.toString("utf8");
  }
  return null;
};

const resolveWatchLocation = (path: string): RuntimeSkillWatchLocation | null => {
  let current = resolve(path);
  let filterName: string | null = null;
  while (!existsSync(current)) {
    filterName = basename(current);
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
  try {
    const stats = statSync(current);
    if (stats.isDirectory()) {
      return {
        watchPath: current,
        filterName,
      };
    }
  } catch {
    return null;
  }
  return {
    watchPath: dirname(current),
    filterName: basename(current),
  };
};

export class RuntimeSkillSystem {
  private skills: RuntimeSkillRecord[] = [];
  private trackedSkills = new Map<string, RuntimeSkillTrackedState>();
  private pendingBootstrap = false;
  private initialized = false;
  private publishedSnapshot = "";
  private rootDirty = false;
  private dirtySkillNames = new Set<string>();
  private watchers = new Map<string, FSWatcher>();
  private idleFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    private readonly input: RuntimeSkillLookupInput & {
      owner: string;
      watchDebounceMs?: number;
      watchPollMs?: number;
      unrefTimers?: boolean;
      listWorkspaceAuthorities?: () => RuntimeSkillWorkspaceAuthority[];
      onIdleFlush?: (result: RuntimeSkillRefreshResult) => Promise<void> | void;
    },
  ) {}

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
        ? this.trackedSkills.get(normalizedName) ?? null
        : (() => {
            const skill = getRuntimeSkillByName({
              ...this.input,
              name: normalizedName,
              rootKind: input.rootKind,
            });
            if (!skill) {
              return null;
            }
            return {
              skill,
              configState: readRuntimeSkillConfigState(skill),
              observedFiles: buildRuntimeSkillFileFingerprintMap(skill),
            } satisfies RuntimeSkillTrackedState;
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
    if (!this.rootDirty && this.dirtySkillNames.size === 0) {
      return null;
    }
    this.clearIdleFlushTimer();
    return this.refresh({
      publishReminders: true,
      forceBootstrap: false,
    });
  }

  upsert(input: {
    name: string;
    content: string;
    rootKind?: RuntimeSkillWritableRootKind;
  }): RuntimeSkillUpsertResult {
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
    this.disposed = true;
    this.clearIdleFlushTimer();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const watcher of this.watchers.values()) {
      try {
        watcher.close();
      } catch {
        // Ignore watcher shutdown races during runtime teardown.
      }
    }
    this.watchers.clear();
    this.rootDirty = false;
    this.dirtySkillNames.clear();
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

  private refreshInternal(input: {
    forceBootstrap: boolean;
    publishReminders: boolean;
  }): RuntimeSkillRefreshResult {
    const previousTracked = this.trackedSkills;
    const skills = listRuntimeSkills(this.input);
    const tracked = this.buildTrackedSkills(skills);
    const snapshot = buildRuntimeSkillsList(skills);

    this.skills = skills;
    this.trackedSkills = tracked;
    this.initialized = true;
    this.rootDirty = false;
    this.dirtySkillNames.clear();

    let systemIngress: RuntimeSystemIngressEnvelope | null = null;
    if (this.publishedSnapshot !== snapshot) {
      systemIngress = {
        system: "skill",
        sourceId: "skill:runtime:snapshot",
        contextKey: RUNTIME_SKILL_CONTEXT_ID,
        kind: "runtime_skill_snapshot",
        summary: "Refreshed runtime skill snapshot.",
        content: snapshot,
        format: "text/markdown",
        score: 0,
        tags: ["skill", "snapshot"],
        createdAt: Date.now(),
        author: this.input.owner,
        target: RUNTIME_SKILL_SNAPSHOT_TARGET,
        commitMode: "system",
      };
      this.publishedSnapshot = snapshot;
      this.pendingBootstrap = true;
    } else if (input.forceBootstrap) {
      this.pendingBootstrap = true;
    }

    const changedSkills = input.publishReminders ? this.diffTrackedSkills(previousTracked, tracked) : [];
    const reminderIngresses = changedSkills.map((change, index) => ({
      system: "skill",
      sourceId: `skill:runtime:change:${change.kind}:${change.name}:${Date.now()}:${index}`,
      contextKey: RUNTIME_SKILL_CONTEXT_ID,
      kind: "runtime_skill_change",
      summary: summarizeRuntimeSkillChange(change),
      content: "",
      format: "text/plain",
      score: 100,
      tags: ["notification", "skill-change", change.kind],
      createdAt: Date.now(),
      author: this.input.owner,
      target: RUNTIME_SKILL_DEFAULT_TARGET,
      commitMode: "commit" as const,
      changeType: "diff" as const,
      meta: {
        name: change.name,
        rootKind: change.rootKind,
        changedFiles: [...change.changedFiles],
        scoreKey: RUNTIME_SKILL_REMINDER_SCORE_KEY,
      },
    }));
    if (reminderIngresses.length > 0) {
      this.pendingBootstrap = true;
    }

    this.syncWatchers(tracked);

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

  private buildTrackedSkills(skills: RuntimeSkillRecord[]): Map<string, RuntimeSkillTrackedState> {
    return new Map(
      skills.map((skill) => {
        const configState = readRuntimeSkillConfigState(skill);
        return [
          skill.name,
          {
            skill,
            configState,
            observedFiles: buildRuntimeSkillFileFingerprintMap(skill, configState),
          } satisfies RuntimeSkillTrackedState,
        ] as const;
      }),
    );
  }

  private diffTrackedSkills(
    previous: Map<string, RuntimeSkillTrackedState>,
    next: Map<string, RuntimeSkillTrackedState>,
  ): RuntimeSkillChange[] {
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
      if (!recordChanged && mapsEqual(before.observedFiles, after.observedFiles)) {
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
  }

  private syncWatchers(tracked: Map<string, RuntimeSkillTrackedState>): void {
    const desired = new Map<string, RuntimeSkillWatcherDescriptor>();
    for (const root of resolveRuntimeSkillRoots(this.input)) {
      const location = resolveWatchLocation(root.path);
      if (!location) {
        continue;
      }
      const key = `root:${root.kind}:${location.watchPath}:${location.filterName ?? "*"}`;
      desired.set(key, {
        key,
        watchPath: location.watchPath,
        filterName: location.filterName,
        kind: "root",
        rootKind: root.kind,
      });
    }
    for (const [skillName, state] of tracked.entries()) {
      const skillKey = `skill:${skillName}:${state.skill.skillDir}`;
      desired.set(skillKey, {
        key: skillKey,
        watchPath: state.skill.skillDir,
        filterName: null,
        kind: "skill",
        skillName,
      });
      for (const spec of this.listAdditionalWatchSpecs(state.configState.watchSpecs, state.skill.skillDir)) {
        const location = resolveWatchLocation(spec.anchorPath);
        if (!location) {
          continue;
        }
        const key = `anchor:${skillName}:${location.watchPath}:${location.filterName ?? "*"}:${spec.pattern}`;
        desired.set(key, {
          key,
          watchPath: location.watchPath,
          filterName: location.filterName,
          kind: "anchor",
          skillName,
        });
      }
    }

    for (const [key, watcher] of this.watchers.entries()) {
      if (desired.has(key)) {
        continue;
      }
      try {
        watcher.close();
      } catch {
        // Ignore watcher shutdown races during rapid topology refreshes.
      }
      this.watchers.delete(key);
    }

    for (const descriptor of desired.values()) {
      if (this.watchers.has(descriptor.key)) {
        continue;
      }
      try {
        const watcher = watch(descriptor.watchPath, { persistent: false }, (_eventType, filename) => {
          if (this.disposed) {
            return;
          }
          const normalizedFilename = normalizeWatchEventFilename(filename);
          if (descriptor.filterName && normalizedFilename && normalizedFilename !== descriptor.filterName) {
            return;
          }
          if (descriptor.kind === "root") {
            this.markRootDirty();
            return;
          }
          if (descriptor.skillName) {
            this.markSkillDirty(descriptor.skillName);
          }
        });
        this.watchers.set(descriptor.key, watcher);
      } catch {
        // Missing or unsupported watch roots should not block the runtime.
      }
    }

    this.syncPollTimer(tracked);
  }

  private listAdditionalWatchSpecs(specs: RuntimeSkillWatchSpec[], skillDir: string): RuntimeSkillWatchSpec[] {
    return specs.filter((spec) => {
      if (spec.recursive) {
        return false;
      }
      return resolve(spec.anchorPath) !== resolve(skillDir) || spec.pattern === RUNTIME_SKILL_CONFIG_BASENAME;
    });
  }

  private syncPollTimer(tracked: Map<string, RuntimeSkillTrackedState>): void {
    const pollable = [...tracked.values()].filter((state) => hasRuntimeSkillRecursiveWatchSpec(state.configState));
    if (pollable.length === 0) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      return;
    }
    if (this.pollTimer) {
      return;
    }
    this.pollTimer = setInterval(() => {
      if (this.disposed) {
        return;
      }
      for (const [skillName, state] of this.trackedSkills.entries()) {
        if (!hasRuntimeSkillRecursiveWatchSpec(state.configState)) {
          continue;
        }
        const nextObserved = buildRuntimeSkillFileFingerprintMap(state.skill, readRuntimeSkillConfigState(state.skill));
        if (!mapsEqual(state.observedFiles, nextObserved)) {
          this.markSkillDirty(skillName);
        }
      }
    }, this.input.watchPollMs ?? DEFAULT_SKILL_WATCH_POLL_MS);
    if (this.input.unrefTimers !== false) {
      this.pollTimer.unref?.();
    }
  }

  private markRootDirty(): void {
    this.rootDirty = true;
    this.scheduleIdleFlush();
  }

  private markSkillDirty(name: string): void {
    this.dirtySkillNames.add(name);
    this.scheduleIdleFlush();
  }

  private scheduleIdleFlush(): void {
    this.clearIdleFlushTimer();
    this.idleFlushTimer = setTimeout(() => {
      this.idleFlushTimer = null;
      if (this.disposed) {
        return;
      }
      const result = this.flushPendingChanges();
      if (!result || (result.systemIngress === null && result.reminderIngresses.length === 0)) {
        return;
      }
      void Promise.resolve(this.input.onIdleFlush?.(result)).catch(() => {
        // Idle flush failures should not crash the runtime watcher loop.
      });
    }, this.input.watchDebounceMs ?? DEFAULT_SKILL_WATCH_DEBOUNCE_MS);
    if (this.input.unrefTimers !== false) {
      this.idleFlushTimer.unref?.();
    }
  }

  private clearIdleFlushTimer(): void {
    if (!this.idleFlushTimer) {
      return;
    }
    clearTimeout(this.idleFlushTimer);
    this.idleFlushTimer = null;
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
