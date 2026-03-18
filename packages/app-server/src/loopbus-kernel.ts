import { createHash } from "node:crypto";

import type { LoopBusPhase } from "./loop-bus";

export interface LoopBusKernelState {
  schemaVersion: 1;
  stateVersion: number;
  running: boolean;
  paused: boolean;
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
  timestamp: number;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: "ok" | "error";
  attributes: Record<string, string | number | boolean>;
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
  schemaVersion: 1,
  stateVersion: 0,
  running: false,
  paused: false,
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
  lastError: null,
});
