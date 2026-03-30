import type { RuntimeAttentionState } from "@agenter/client-sdk";

export interface SchedulerStateLogItem {
  id: number;
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: Array<{ op: "add" | "replace" | "remove"; path: string; value?: unknown }>;
}

export interface RuntimeTraceItem {
  id: number;
  cycleId: number;
  seq: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  kind: string;
  name: string;
  status: "running" | "done" | "error" | "cancelled";
  startedAt: number;
  endedAt: number;
  refs: Array<{ kind: string; ref: string; label?: string; attributes?: Record<string, unknown> }>;
  links: Array<{
    kind: string;
    traceId?: string;
    spanId?: string;
    ref?: { kind: string; ref: string; label?: string; attributes?: Record<string, unknown> };
    attributes?: Record<string, unknown>;
  }>;
  events: Array<{
    id: string;
    name: string;
    timestamp: number;
    status?: "info" | "ok" | "error";
    refs?: Array<{ kind: string; ref: string; label?: string; attributes?: Record<string, unknown> }>;
    attributes?: Record<string, unknown>;
  }>;
  attributes: Record<string, unknown>;
  outcome?: {
    code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
    message?: string;
    retryable?: boolean;
    error?: unknown;
    reason?: string;
  };
}

export interface ModelCallItem {
  id: number;
  cycleId: number;
  createdAt: number;
  status: "running" | "done" | "error" | "cancelled";
  completedAt?: number;
  provider: string;
  model: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
  trace?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string | null;
  };
  outcome?: {
    code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
    message?: string;
    retryable?: boolean;
    error?: unknown;
    reason?: string;
  };
}

export interface ApiCallItem {
  id: number;
  modelCallId: number;
  createdAt: number;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export interface SchedulerKernelState {
  schemaVersion: 2;
  stateVersion: number;
  running: boolean;
  paused: boolean;
  runtimeStatus: "idle" | "running" | "waiting" | "backoff" | "blocked" | "paused";
  phase: string;
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

export type SchedulerInputSignals = Record<
  "user" | "terminal" | "task" | "attention",
  { version: number; timestamp: number | null }
>;

export type SchedulerPhase =
  | "waiting_commits"
  | "collecting_inputs"
  | "persisting_cycle"
  | "calling_model"
  | "stopped";

export interface FlowStep {
  id: string;
  phase: SchedulerPhase;
  step: string;
  title: string;
  subtitle: string;
  direction?: "right" | "left";
}

export interface CycleDigest {
  cycleId: number;
  startedAt: number;
  endedAt: number;
  steps: string[];
  modelCalls: number;
  status: "ok" | "error" | "running";
}

export interface ObservabilityEventItem {
  key: string;
  kind:
    | "attention.context"
    | "attention.commit"
    | "attention.hook"
    | "cycle.frame"
    | "scheduler.state"
    | "scheduler.trace"
    | "model.call"
    | "api.call";
  title: string;
  summary: string;
  timestamp: number;
  status: "ok" | "error" | "running" | "info";
  cycleId: number | null;
  contextId: string | null;
  itemId: string | null;
  payload: unknown;
}

export interface ObservabilityPanelProps {
  stage: string;
  kernel: SchedulerKernelState | null;
  inputSignals: SchedulerInputSignals;
  attention?: RuntimeAttentionState | null;
  logs: SchedulerStateLogItem[];
  traces: RuntimeTraceItem[];
  modelCalls: ModelCallItem[];
  apiCalls: ApiCallItem[];
  apiRecording: { enabled: boolean; refCount: number };
  hasMoreTrace?: boolean;
  hasMoreModel?: boolean;
  loadingTrace?: boolean;
  loadingModel?: boolean;
  onLoadMoreTrace?: () => void | Promise<void>;
  onLoadMoreModel?: () => void | Promise<void>;
}

export const FLOW_ROWS: FlowStep[][] = [
  [
    { id: "race", phase: "waiting_commits", step: "1", title: "Race", subtitle: "wait inputs", direction: "right" },
    { id: "collect", phase: "collecting_inputs", step: "2", title: "Collect", subtitle: "attention + debounce" },
    { id: "persist", phase: "persisting_cycle", step: "3", title: "Persist", subtitle: "cycle ledger" },
  ],
  [{ id: "model", phase: "calling_model", step: "4", title: "Model", subtitle: "provider call", direction: "left" }],
];

export const TRACE_ROW_ESTIMATE = 72;
export const MODEL_ROW_ESTIMATE = 76;
export const OVERSCAN = 8;

export const toTime = (value: number | null | undefined): string => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleTimeString();
};

export const toDuration = (start: number, end: number): string => `${Math.max(0, end - start)} ms`;

export const toStatusTone = (status: "running" | "done" | "error" | "cancelled"): "ok" | "error" | "running" => {
  if (status === "running") {
    return "running";
  }
  if (status === "error" || status === "cancelled") {
    return "error";
  }
  return "ok";
};

export const formatTraceLabel = (trace: RuntimeTraceItem): string => {
  return trace.kind === trace.name ? trace.name : `${trace.kind} / ${trace.name}`;
};

export const formatTraceSummary = (trace: RuntimeTraceItem): string => {
  const outcome = trace.outcome?.code ?? trace.status;
  return `cycle #${trace.cycleId} · ${outcome}`;
};

export const toJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const normalizePhase = (phase?: string | null): SchedulerPhase => {
  switch (phase) {
    case "collecting_inputs":
    case "persisting_cycle":
    case "calling_model":
    case "stopped":
    case "waiting_commits":
      return phase;
    default:
      return "waiting_commits";
  }
};

export const buildCycleDigests = (traces: RuntimeTraceItem[], modelCalls: ModelCallItem[]): CycleDigest[] => {
  const digests = new Map<number, CycleDigest>();

  for (const trace of traces) {
    const current = digests.get(trace.cycleId);
    if (current) {
      current.startedAt = Math.min(current.startedAt, trace.startedAt);
      current.endedAt = Math.max(current.endedAt, trace.endedAt);
      current.status =
        toStatusTone(trace.status) === "error"
          ? "error"
          : current.status === "error"
            ? current.status
            : toStatusTone(trace.status);
      const label = formatTraceLabel(trace);
      if (current.steps.at(-1) !== label) {
        current.steps.push(label);
      }
      continue;
    }
    digests.set(trace.cycleId, {
      cycleId: trace.cycleId,
      startedAt: trace.startedAt,
      endedAt: trace.endedAt,
      steps: [formatTraceLabel(trace)],
      modelCalls: 0,
      status: toStatusTone(trace.status),
    });
  }

  for (const call of modelCalls) {
    const current = digests.get(call.cycleId);
    if (current) {
      current.modelCalls += 1;
      continue;
    }
    digests.set(call.cycleId, {
      cycleId: call.cycleId,
      startedAt: call.createdAt,
      endedAt: call.createdAt,
      steps: [],
      modelCalls: 1,
      status: toStatusTone(call.status),
    });
  }

  return [...digests.values()].sort((left, right) => right.cycleId - left.cycleId).slice(0, 6);
};

const pushObservabilityEvent = (target: ObservabilityEventItem[], event: ObservabilityEventItem): void => {
  target.push(event);
};

export const buildObservabilityEvents = (input: {
  attention?: RuntimeAttentionState | null;
  logs: SchedulerStateLogItem[];
  traces: RuntimeTraceItem[];
  modelCalls: ModelCallItem[];
  apiCalls: ApiCallItem[];
}): ObservabilityEventItem[] => {
  const events: ObservabilityEventItem[] = [];

  for (const context of input.attention?.snapshot.contexts ?? []) {
    pushObservabilityEvent(events, {
      key: `attention-context:${context.contextId}`,
      kind: "attention.context",
      title: context.contextId,
      summary: `${context.owner} · ${Object.values(context.scoreMap).filter((score) => score > 0).length} active scores`,
      timestamp: Date.parse(context.updatedAt) || Date.parse(context.createdAt) || 0,
      status: Object.values(context.scoreMap).some((score) => score > 0) ? "running" : "ok",
      cycleId: null,
      contextId: context.contextId,
      itemId: context.headCommitId ?? null,
      payload: context,
    });

    for (const commit of context.commits) {
      pushObservabilityEvent(events, {
        key: `attention-commit:${context.contextId}:${commit.commitId}`,
        kind: "attention.commit",
        title: commit.summary,
        summary: `${commit.meta.author} · ${commit.meta.source}`,
        timestamp: Date.parse(commit.createdAt) || 0,
        status: Object.values(commit.scores).some((score) => score > 0) ? "running" : "ok",
        cycleId: null,
        contextId: context.contextId,
        itemId: commit.commitId,
        payload: commit,
      });
    }
  }

  for (const frame of input.attention?.cycleFrames ?? []) {
    pushObservabilityEvent(events, {
      key: `cycle:${frame.cycleId}:${frame.seq}`,
      kind: "cycle.frame",
      title: `Cycle #${frame.cycleId}`,
      summary: `${frame.inputContextIds.length} contexts in · ${frame.producedCommitRefs.length} commits out`,
      timestamp: frame.createdAt,
      status: "info",
      cycleId: frame.cycleId,
      contextId: frame.inputContextIds[0] ?? null,
      itemId: frame.producedCommitRefs[0]?.commitId ?? null,
      payload: frame,
    });
  }

  for (const hook of input.attention?.hooks ?? []) {
    pushObservabilityEvent(events, {
      key: `hook:${hook.id}`,
      kind: "attention.hook",
      title: `${hook.systemId} hook`,
      summary: `${hook.status} · ${hook.contextId}`,
      timestamp: hook.createdAt,
      status: hook.status === "failed" ? "error" : hook.status === "delivered" ? "ok" : "info",
      cycleId: hook.cycleId,
      contextId: hook.contextId,
      itemId: hook.commitId,
      payload: hook,
    });
  }

  for (const log of input.logs) {
    pushObservabilityEvent(events, {
      key: `state:${log.id}`,
      kind: "scheduler.state",
      title: log.event,
      summary: `state v${log.stateVersion}`,
      timestamp: log.timestamp,
      status: "info",
      cycleId: null,
      contextId: null,
      itemId: null,
      payload: log,
    });
  }

  for (const trace of input.traces) {
    pushObservabilityEvent(events, {
      key: `trace:${trace.id}`,
      kind: "scheduler.trace",
      title: formatTraceLabel(trace),
      summary: formatTraceSummary(trace),
      timestamp: trace.endedAt || trace.startedAt,
      status: toStatusTone(trace.status),
      cycleId: trace.cycleId,
      contextId: null,
      itemId: null,
      payload: trace,
    });
  }

  for (const modelCall of input.modelCalls) {
    pushObservabilityEvent(events, {
      key: `model:${modelCall.id}`,
      kind: "model.call",
      title: `${modelCall.provider} / ${modelCall.model}`,
      summary: `cycle #${modelCall.cycleId} · ${modelCall.outcome?.code ?? modelCall.status}`,
      timestamp: modelCall.completedAt ?? modelCall.createdAt,
      status: toStatusTone(modelCall.status),
      cycleId: modelCall.cycleId,
      contextId: null,
      itemId: null,
      payload: modelCall,
    });
  }

  for (const apiCall of input.apiCalls) {
    pushObservabilityEvent(events, {
      key: `api:${apiCall.id}`,
      kind: "api.call",
      title: `API call #${apiCall.id}`,
      summary: apiCall.error ? "error" : "recorded request",
      timestamp: apiCall.createdAt,
      status: apiCall.error ? "error" : "ok",
      cycleId: null,
      contextId: null,
      itemId: null,
      payload: apiCall,
    });
  }

  return events.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return right.timestamp - left.timestamp;
    }
    return left.key.localeCompare(right.key);
  });
};
