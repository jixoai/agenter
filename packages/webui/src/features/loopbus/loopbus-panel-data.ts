export interface LoopBusStateLogItem {
  id: number;
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: Array<{ op: "add" | "replace" | "remove"; path: string; value?: unknown }>;
}

export interface LoopBusTraceItem {
  id: number;
  cycleId: number;
  seq: number;
  step: string;
  status: "ok" | "error" | "running";
  startedAt: number;
  endedAt: number;
  detail: Record<string, unknown>;
}

export interface ModelCallItem {
  id: number;
  cycleId: number;
  createdAt: number;
  provider: string;
  model: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export interface ApiCallItem {
  id: number;
  modelCallId: number;
  createdAt: number;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export interface LoopBusKernelState {
  schemaVersion: 1;
  stateVersion: number;
  running: boolean;
  paused: boolean;
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
  lastError: string | null;
}

export type InputSignalMap = Record<
  "user" | "terminal" | "task" | "attention",
  { version: number; timestamp: number | null }
>;

export type LoopPhase =
  | "waiting_commits"
  | "collecting_inputs"
  | "persisting_cycle"
  | "calling_model"
  | "applying_outputs"
  | "stopped";

export interface FlowStep {
  id: string;
  phase: LoopPhase;
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

export interface LoopBusPanelProps {
  stage: string;
  kernel: LoopBusKernelState | null;
  inputSignals: InputSignalMap;
  logs: LoopBusStateLogItem[];
  traces: LoopBusTraceItem[];
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
    { id: "collect", phase: "collecting_inputs", step: "2", title: "Collect", subtitle: "facts + debounce" },
    { id: "persist", phase: "persisting_cycle", step: "3", title: "Persist", subtitle: "cycle ledger" },
  ],
  [
    {
      id: "apply",
      phase: "applying_outputs",
      step: "5",
      title: "Apply",
      subtitle: "dispatch outputs",
      direction: "left",
    },
    { id: "model", phase: "calling_model", step: "4", title: "Model", subtitle: "provider call", direction: "left" },
  ],
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

export const toJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const normalizePhase = (phase?: string | null): LoopPhase => {
  switch (phase) {
    case "collecting_inputs":
    case "persisting_cycle":
    case "calling_model":
    case "applying_outputs":
    case "stopped":
    case "waiting_commits":
      return phase;
    default:
      return "waiting_commits";
  }
};

export const buildCycleDigests = (traces: LoopBusTraceItem[], modelCalls: ModelCallItem[]): CycleDigest[] => {
  const digests = new Map<number, CycleDigest>();

  for (const trace of traces) {
    const current = digests.get(trace.cycleId);
    if (current) {
      current.startedAt = Math.min(current.startedAt, trace.startedAt);
      current.endedAt = Math.max(current.endedAt, trace.endedAt);
      current.status = trace.status === "error" ? "error" : current.status === "error" ? current.status : trace.status;
      if (current.steps.at(-1) !== trace.step) {
        current.steps.push(trace.step);
      }
      continue;
    }
    digests.set(trace.cycleId, {
      cycleId: trace.cycleId,
      startedAt: trace.startedAt,
      endedAt: trace.endedAt,
      steps: [trace.step],
      modelCalls: 0,
      status: trace.status,
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
      status: call.error === undefined ? "ok" : "error",
    });
  }

  return [...digests.values()].sort((left, right) => right.cycleId - left.cycleId).slice(0, 6);
};
