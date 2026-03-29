import { createHash } from "node:crypto";

import type {
  SessionTerminalOutcome,
  SessionTraceEvent,
  SessionTraceLink,
  SessionTraceRef,
  SessionTraceStatus,
} from "@agenter/session-system";

import type { LoopBusPhase } from "./loop-bus";

export interface LoopBusKernelState {
  schemaVersion: 2;
  stateVersion: number;
  running: boolean;
  paused: boolean;
  runtimeStatus: "idle" | "running" | "waiting" | "backoff" | "paused";
  phase: LoopBusPhase;
  gate: "open" | "waiting_input";
  queueSize: number;
  cycle: number;
  sentBatches: number;
  updatedAt: number;
  lastMessageAt: number | null;
  lastResponseAt: number | null;
  lastWakeAt: number | null;
  lastWakeSource: string | null;
  lastWakeCause: string | null;
  activeContextCount: number;
  activeItemCount: number;
  unresolvedScoreCount: number;
  waitingReason: string | null;
  nextAutoWakeAt: number | null;
  backoffMs: number | null;
  retryCount: number;
  blockedReason: string | null;
  lastProgressAt: number | null;
  lastError: string | null;
}

export interface LoopBusKernelSnapshot {
  timestamp: number;
  stateHash: string;
  state: LoopBusKernelState;
}

export type LoopBusPatchOperation =
  | {
      op: "add" | "replace";
      path: string;
      value: unknown;
    }
  | {
      op: "remove";
      path: string;
    };

export interface LoopBusStateLogEntry {
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: LoopBusPatchOperation[];
}

export interface LoopBusTraceEntry {
  id?: number;
  cycleId?: number;
  seq?: number;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  kind: string;
  name: string;
  startedAt: number;
  endedAt: number;
  status: SessionTraceStatus;
  refs: SessionTraceRef[];
  links: SessionTraceLink[];
  events: SessionTraceEvent[];
  attributes: Record<string, unknown>;
  outcome?: SessionTerminalOutcome;
}

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source).sort((a, b) => a.localeCompare(b));
  const target: Record<string, unknown> = {};
  for (const key of keys) {
    target[key] = sortObject(source[key]);
  }
  return target;
};

export const stableStringify = (value: unknown): string => JSON.stringify(sortObject(value));

export const hashLoopState = (state: LoopBusKernelState): string =>
  createHash("sha256").update(stableStringify(state)).digest("hex");

const topLevelPath = (key: string): string => `/${key}`;

export const createLoopStatePatch = (
  previous: LoopBusKernelState,
  next: LoopBusKernelState,
): LoopBusPatchOperation[] => {
  const patch: LoopBusPatchOperation[] = [];
  const prevRecord = previous as unknown as Record<string, unknown>;
  const nextRecord = next as unknown as Record<string, unknown>;
  const keySet = new Set([...Object.keys(prevRecord), ...Object.keys(nextRecord)]);

  for (const key of [...keySet].sort((a, b) => a.localeCompare(b))) {
    const prevValue = prevRecord[key];
    const nextValue = nextRecord[key];
    if (!(key in nextRecord)) {
      patch.push({ op: "remove", path: topLevelPath(key) });
      continue;
    }
    if (!(key in prevRecord)) {
      patch.push({ op: "add", path: topLevelPath(key), value: nextValue });
      continue;
    }
    if (stableStringify(prevValue) !== stableStringify(nextValue)) {
      patch.push({ op: "replace", path: topLevelPath(key), value: nextValue });
    }
  }

  return patch;
};

export const applyLoopStatePatch = (state: LoopBusKernelState, patch: LoopBusPatchOperation[]): LoopBusKernelState => {
  const next: Record<string, unknown> = { ...state };
  for (const operation of patch) {
    const key = operation.path.startsWith("/") ? operation.path.slice(1) : operation.path;
    if (operation.op === "remove") {
      delete next[key];
      continue;
    }
    next[key] = operation.value;
  }
  return next as unknown as LoopBusKernelState;
};

export const createInitialLoopKernelState = (
  now: number,
  phase: LoopBusPhase = "waiting_commits",
): LoopBusKernelState => ({
  schemaVersion: 2,
  stateVersion: 0,
  running: false,
  paused: false,
  runtimeStatus: "idle",
  phase,
  gate: "open",
  queueSize: 0,
  cycle: 0,
  sentBatches: 0,
  updatedAt: now,
  lastMessageAt: null,
  lastResponseAt: null,
  lastWakeAt: null,
  lastWakeSource: null,
  lastWakeCause: null,
  activeContextCount: 0,
  activeItemCount: 0,
  unresolvedScoreCount: 0,
  waitingReason: null,
  nextAutoWakeAt: null,
  backoffMs: null,
  retryCount: 0,
  blockedReason: null,
  lastProgressAt: null,
  lastError: null,
});
