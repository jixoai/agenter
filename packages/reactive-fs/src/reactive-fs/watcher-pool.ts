import { existsSync, lstatSync } from "node:fs";
import { dirname, sep } from "node:path";

import { resolveRealPathThroughExistingAncestor } from "./path-realpath.js";
import {
  getProjectWatcher,
  type ProjectWatcher,
  type ProjectWatcherRuntimeStatus,
  type ProjectWatcherRuntimeStatusListener,
} from "./project-watcher.js";

function getRealPath(path: string): string {
  return resolveRealPathThroughExistingAncestor(path);
}

function pathContains(rootDir: string, path: string): boolean {
  return path === rootDir || path.startsWith(`${rootDir}${sep}`);
}

function resolveWatchRoot(path: string): string {
  const normalizedPath = getRealPath(path);
  try {
    if (existsSync(normalizedPath) && lstatSync(normalizedPath).isDirectory()) {
      return normalizedPath;
    }
  } catch {
    // Fall through to parent-dir watch root selection.
  }
  return getRealPath(dirname(normalizedPath));
}

interface RootWatcherEntry {
  rootDir: string;
  watcher: ProjectWatcher;
  releaseRuntimeSubscription: () => void;
}

interface PathSubscription {
  rootDir: string;
  path: string;
  callbacks: Set<() => void>;
  unsubscribe: () => void;
  onError?: () => void;
}

export interface WatcherRuntimeStatus extends ProjectWatcherRuntimeStatus {
  rootDir: string;
  projectDir: string;
  initialized: boolean;
  subscriptionCount: number;
}

const DEBOUNCE_MS = 100;
const rootWatchers = new Map<string, RootWatcherEntry>();
const subscriptionCache = new Map<string, PathSubscription>();
const debounceTimers = new Map<string, NodeJS.Timeout>();
const watcherRuntimeStatusListeners = new Set<(statuses: readonly WatcherRuntimeStatus[]) => void>();

function listStatuses(): WatcherRuntimeStatus[] {
  return [...rootWatchers.values()]
    .map(({ rootDir, watcher }) => {
      const runtime = watcher.runtimeStatus;
      return {
        rootDir,
        projectDir: rootDir,
        initialized: watcher.isInitialized,
        subscriptionCount: watcher.subscriptionCount,
        generation: runtime.generation,
        reinitializeCount: runtime.reinitializeCount,
        lastReinitializeReason: runtime.lastReinitializeReason,
        reinitializeReasonCounts: runtime.reinitializeReasonCounts,
        projectResidency: runtime.projectResidency,
      } satisfies WatcherRuntimeStatus;
    })
    .sort((left, right) => left.rootDir.localeCompare(right.rootDir));
}

function emitWatcherRuntimeStatus(): void {
  const statuses = listStatuses();
  for (const listener of watcherRuntimeStatusListeners) {
    listener(statuses);
  }
}

function pickWatcherEntry(path: string): RootWatcherEntry | null {
  const normalizedPath = getRealPath(path);
  let matched: RootWatcherEntry | null = null;
  for (const entry of rootWatchers.values()) {
    if (!pathContains(entry.rootDir, normalizedPath)) {
      continue;
    }
    if (!matched || entry.rootDir.length > matched.rootDir.length) {
      matched = entry;
    }
  }
  return matched;
}

function requireWatcherEntry(path: string): RootWatcherEntry | null {
  const existing = pickWatcherEntry(path);
  if (existing) {
    return existing;
  }
  const fallbackRoot = resolveWatchRoot(path);
  return rootWatchers.get(fallbackRoot) ?? null;
}

async function ensureWatcherRoot(rootDir: string): Promise<RootWatcherEntry> {
  const normalizedRoot = getRealPath(rootDir);
  const existing = rootWatchers.get(normalizedRoot);
  if (existing) {
    if (!existing.watcher.isInitialized) {
      await existing.watcher.init();
      emitWatcherRuntimeStatus();
    }
    return existing;
  }

  const watcher = getProjectWatcher(normalizedRoot);
  const forward: ProjectWatcherRuntimeStatusListener = () => {
    emitWatcherRuntimeStatus();
  };
  const releaseRuntimeSubscription = watcher.subscribeRuntimeStatus(forward, {
    emitCurrent: false,
  });

  const entry: RootWatcherEntry = {
    rootDir: normalizedRoot,
    watcher,
    releaseRuntimeSubscription,
  };
  rootWatchers.set(normalizedRoot, entry);
  await watcher.init();
  emitWatcherRuntimeStatus();
  return entry;
}

export async function initWatcherPool(projectDir: string): Promise<void> {
  await ensureWatcherRoot(projectDir);
}

export async function ensureWatcherRootForPath(path: string): Promise<string> {
  const rootDir = resolveWatchRoot(path);
  await ensureWatcherRoot(rootDir);
  return rootDir;
}

export function acquireWatcher(
  path: string,
  onChange: () => void,
  options: { recursive?: boolean; debounceMs?: number; onError?: () => void } = {},
): () => void {
  const entry = requireWatcherEntry(path);
  if (!entry || !entry.watcher.isInitialized) {
    return () => {};
  }

  const normalizedPath = getRealPath(path);
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const isRecursive = options.recursive ?? false;
  const cacheKey = `${entry.rootDir}:${normalizedPath}:${isRecursive}`;

  let subscription = subscriptionCache.get(cacheKey);
  if (!subscription) {
    const unsubscribe = entry.watcher.subscribeSync(
      normalizedPath,
      () => {
        const existingTimer = debounceTimers.get(cacheKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          debounceTimers.delete(cacheKey);
          const currentSub = subscriptionCache.get(cacheKey);
          if (!currentSub) {
            return;
          }
          for (const callback of currentSub.callbacks) {
            try {
              callback();
            } catch (error) {
              console.error(`[watcher-pool] Callback error for ${normalizedPath}:`, error);
            }
          }
        }, debounceMs);

        debounceTimers.set(cacheKey, timer);
      },
      { watchChildren: isRecursive },
    );

    subscription = {
      rootDir: entry.rootDir,
      path: normalizedPath,
      callbacks: new Set(),
      unsubscribe,
      onError: options.onError,
    };
    subscriptionCache.set(cacheKey, subscription);
    emitWatcherRuntimeStatus();
  }

  subscription.callbacks.add(onChange);

  return () => {
    const currentSub = subscriptionCache.get(cacheKey);
    if (!currentSub) {
      return;
    }

    currentSub.callbacks.delete(onChange);
    if (currentSub.callbacks.size > 0) {
      return;
    }

    currentSub.unsubscribe();
    subscriptionCache.delete(cacheKey);

    const timer = debounceTimers.get(cacheKey);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(cacheKey);
    }
    emitWatcherRuntimeStatus();
  };
}

export function getActiveWatcherCount(): number {
  return subscriptionCache.size;
}

export async function closeAllWatchers(): Promise<void> {
  for (const [key, sub] of subscriptionCache) {
    sub.unsubscribe();
    const timer = debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
    }
  }
  subscriptionCache.clear();
  debounceTimers.clear();

  for (const entry of rootWatchers.values()) {
    entry.releaseRuntimeSubscription();
    await entry.watcher.close();
  }
  rootWatchers.clear();
  emitWatcherRuntimeStatus();
}

export function isWatcherPoolInitialized(): boolean {
  return [...rootWatchers.values()].some((entry) => entry.watcher.isInitialized);
}

export function getWatchedProjectDir(): string | null {
  if (rootWatchers.size !== 1) {
    return null;
  }
  return [...rootWatchers.keys()][0] ?? null;
}

export function getWatcherRuntimeStatus(rootDir?: string): WatcherRuntimeStatus | null {
  if (typeof rootDir === "string") {
    return listStatuses().find((status) => status.rootDir === getRealPath(rootDir)) ?? null;
  }
  const statuses = listStatuses();
  return statuses.length === 1 ? statuses[0] ?? null : null;
}

export function listWatcherRuntimeStatuses(): WatcherRuntimeStatus[] {
  return listStatuses();
}

export function subscribeWatcherRuntimeStatus(
  listener: (statuses: readonly WatcherRuntimeStatus[]) => void,
  options: { emitCurrent?: boolean } = {},
): () => void {
  watcherRuntimeStatusListeners.add(listener);
  if (options.emitCurrent !== false) {
    listener(listStatuses());
  }

  return () => {
    watcherRuntimeStatusListeners.delete(listener);
  };
}
