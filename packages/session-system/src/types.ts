import type {
  SessionTerminalOutcome,
  SessionTraceEvent,
  SessionTraceIdentity,
  SessionTraceLink,
  SessionTraceRef,
  SessionTraceStatus,
} from "./trace-types";

export type SessionCollectedInputPart =
  | { type: "text"; text: string }
  | {
      type: SessionAssetKind;
      assetId: string;
      kind: SessionAssetKind;
      mimeType: string;
      name: string;
      sizeBytes: number;
      url: string;
    };

export type SessionCollectedInput = {
  source: "message" | "terminal" | "task" | "attention";
  sourceId?: string;
  role: "user" | "tool";
  name: string;
  parts: SessionCollectedInputPart[];
  meta?: Record<string, string | number | boolean | null>;
};

export interface SessionHeadRecord {
  headCycleId: number | null;
  updatedAt: number;
}

export interface ReverseTimeCursor {
  beforeTimeMs: number;
  beforeId: number;
}

export interface ReversePage<T> {
  items: T[];
  nextBefore: ReverseTimeCursor | null;
  hasMoreBefore: boolean;
}

export interface SessionCycleRecord {
  id: number;
  seq: number;
  prevCycleId: number | null;
  createdAt: number;
  wake: Record<string, unknown>;
  collectedInputs: SessionCollectedInput[];
  extendsRecord: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface SessionCycleInsert {
  prevCycleId?: number | null;
  createdAt?: number;
  wake?: Record<string, unknown>;
  collectedInputs?: SessionCollectedInput[];
  extendsRecord?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface SessionCycleUpdate {
  wake?: Record<string, unknown>;
  collectedInputs?: SessionCollectedInput[];
  extendsRecord?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface SessionModelCallRecord {
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
  trace?: SessionTraceIdentity;
  outcome?: SessionTerminalOutcome;
}

export interface SessionModelCallInsert {
  cycleId: number;
  createdAt?: number;
  status?: SessionModelCallRecord["status"];
  completedAt?: number;
  provider: string;
  model: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
  trace?: SessionTraceIdentity;
  outcome?: SessionTerminalOutcome;
}

export interface SessionModelCallUpdate {
  status?: SessionModelCallRecord["status"];
  completedAt?: number | null;
  response?: unknown;
  error?: unknown;
  trace?: SessionTraceIdentity;
  outcome?: SessionTerminalOutcome;
}

export type SessionAssetKind = "image" | "video" | "file";

export interface SessionAssetRecord {
  id: string;
  kind: SessionAssetKind;
  createdAt: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
}

export interface SessionAssetInsert {
  id: string;
  kind: SessionAssetKind;
  createdAt?: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string;
}

export interface SessionBlockAssetRecord {
  blockId: number;
  assetId: string;
  seq: number;
}

export type SessionBlockRole = "user" | "assistant";
export type SessionBlockChannel = "to_user" | "self_talk" | "tool_call" | "tool_result" | "user_input";
export type SessionBlockFormat = "plain" | "markdown";

export interface SessionBlockToolMeta {
  name: string;
  ok?: boolean;
}

export interface SessionBlockRecord {
  id: number;
  seq: number;
  cycleId: number | null;
  createdAt: number;
  role: SessionBlockRole;
  channel: SessionBlockChannel;
  format: SessionBlockFormat;
  content: string;
  tool?: SessionBlockToolMeta;
  attachments: SessionAssetRecord[];
}

export interface SessionBlockInsert {
  cycleId?: number | null;
  createdAt?: number;
  role: SessionBlockRole;
  channel: SessionBlockChannel;
  format?: SessionBlockFormat;
  content: string;
  tool?: SessionBlockToolMeta;
}

export type LoopbusTraceStatus = SessionTraceStatus;

export interface LoopbusTraceRecord {
  id: number;
  cycleId: number;
  seq: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  kind: string;
  name: string;
  status: LoopbusTraceStatus;
  startedAt: number;
  endedAt: number;
  refs: SessionTraceRef[];
  links: SessionTraceLink[];
  events: SessionTraceEvent[];
  attributes: Record<string, unknown>;
  outcome?: SessionTerminalOutcome;
}

export interface LoopbusTraceInsert {
  cycleId: number;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  kind: string;
  name: string;
  status: LoopbusTraceStatus;
  startedAt: number;
  endedAt: number;
  refs?: SessionTraceRef[];
  links?: SessionTraceLink[];
  events?: SessionTraceEvent[];
  attributes?: Record<string, unknown>;
  outcome?: SessionTerminalOutcome;
}

export interface LoopbusTraceUpdate {
  parentSpanId?: string | null;
  status?: LoopbusTraceStatus;
  endedAt?: number;
  refs?: SessionTraceRef[];
  links?: SessionTraceLink[];
  events?: SessionTraceEvent[];
  attributes?: Record<string, unknown>;
  outcome?: SessionTerminalOutcome;
}

export type LoopbusStatePatchOperation =
  | {
      op: "add" | "replace";
      path: string;
      value?: unknown;
    }
  | {
      op: "remove";
      path: string;
    };

export interface LoopbusStateLogRecord {
  id: number;
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: LoopbusStatePatchOperation[];
}

export interface LoopbusStateLogInsert {
  timestamp: number;
  stateVersion: number;
  event: string;
  prevHash: string | null;
  stateHash: string;
  patch: LoopbusStatePatchOperation[];
}

export interface ApiCallRecord {
  id: number;
  modelCallId: number;
  createdAt: number;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export interface ApiCallInsert {
  modelCallId: number;
  createdAt?: number;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export type TerminalActivityKind = "cycle_input" | "terminal_read" | "terminal_write" | "message";

export interface TerminalActivityRecord {
  id: number;
  terminalId: string;
  createdAt: number;
  kind: TerminalActivityKind;
  cycleId: number | null;
  role?: SessionBlockRole;
  channel?: SessionBlockChannel;
  title: string;
  content: string;
  tool?: SessionBlockToolMeta;
  detail?: unknown;
}

export interface TerminalActivityInsert {
  terminalId: string;
  createdAt?: number;
  kind: TerminalActivityKind;
  cycleId?: number | null;
  role?: SessionBlockRole;
  channel?: SessionBlockChannel;
  title: string;
  content: string;
  tool?: SessionBlockToolMeta;
  detail?: unknown;
}
