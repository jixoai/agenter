import { existsSync, statSync, watch, type FSWatcher } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import {
  buildRuntimeSkillFileFingerprintMap,
  hasRuntimeSkillRecursiveWatchSpec,
  readRuntimeSkillConfigState,
  RUNTIME_SKILL_CONFIG_BASENAME,
  type RuntimeSkillWatchSpec,
} from "./runtime-skill-config";
import { runtimeSkillFileFingerprintsEqual } from "./runtime-skill-diff";
import type { RuntimeSkillTruthState } from "./runtime-skill-truth";
import type { RuntimeSkillRoot, RuntimeSkillWritableRootKind } from "./runtime-skills";

const DEFAULT_SKILL_WATCH_DEBOUNCE_MS = 800;
const DEFAULT_SKILL_WATCH_POLL_MS = 2_000;

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

export class RuntimeSkillWatchService {
  private trackedSkills = new Map<string, RuntimeSkillTruthState>();
  private rootDirty = false;
  private dirtySkillNames = new Set<string>();
  private watchers = new Map<string, FSWatcher>();
  private idleFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    private readonly input: {
      watchDebounceMs?: number;
      watchPollMs?: number;
      unrefTimers?: boolean;
      onIdleFlush?: () => Promise<void> | void;
    },
  ) {}

  hasPendingChanges(): boolean {
    return this.rootDirty || this.dirtySkillNames.size > 0;
  }

  sync(roots: RuntimeSkillRoot[], tracked: Map<string, RuntimeSkillTruthState>): void {
    this.trackedSkills = tracked;
    const desired = new Map<string, RuntimeSkillWatcherDescriptor>();
    for (const root of roots) {
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

    this.syncPollTimer();
  }

  markRootDirty(): void {
    this.rootDirty = true;
    this.scheduleIdleFlush();
  }

  markSkillDirty(name: string): void {
    this.dirtySkillNames.add(name);
    this.scheduleIdleFlush();
  }

  prepareFlush(): void {
    this.clearIdleFlushTimer();
  }

  clearPendingChanges(): void {
    this.rootDirty = false;
    this.dirtySkillNames.clear();
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
    this.clearPendingChanges();
  }

  private listAdditionalWatchSpecs(specs: RuntimeSkillWatchSpec[], skillDir: string): RuntimeSkillWatchSpec[] {
    return specs.filter((spec) => {
      if (spec.recursive) {
        return false;
      }
      return resolve(spec.anchorPath) !== resolve(skillDir) || spec.pattern === RUNTIME_SKILL_CONFIG_BASENAME;
    });
  }

  private syncPollTimer(): void {
    const pollable = [...this.trackedSkills.values()].filter((state) =>
      hasRuntimeSkillRecursiveWatchSpec(state.configState),
    );
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
        if (!runtimeSkillFileFingerprintsEqual(state.observedFiles, nextObserved)) {
          this.markSkillDirty(skillName);
        }
      }
    }, this.input.watchPollMs ?? DEFAULT_SKILL_WATCH_POLL_MS);
    if (this.input.unrefTimers !== false) {
      this.pollTimer.unref?.();
    }
  }

  private scheduleIdleFlush(): void {
    this.clearIdleFlushTimer();
    this.idleFlushTimer = setTimeout(() => {
      this.idleFlushTimer = null;
      if (this.disposed || !this.hasPendingChanges()) {
        return;
      }
      void Promise.resolve(this.input.onIdleFlush?.()).catch(() => {
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
}
