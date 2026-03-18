export type SessionCollectedInputPart =
  | { type: "text"; text: string }
  | {
      type: "image";
      assetId: string;
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

export interface SessionModelCallRecord {
  id: number;
  cycleId: number;
  createdAt: number;
  provider: string;
  model: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export interface SessionModelCallInsert {
  cycleId: number;
  createdAt?: number;
  provider: string;
  model: string;
  request: unknown;
  response?: unknown;
  error?: unknown;
}

export type SessionAssetKind = "image";

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

export type LoopbusTraceStatus = "ok" | "error" | "running";

export interface LoopbusTraceRecord {
  id: number;
  cycleId: number;
  seq: number;
  step: string;
  status: LoopbusTraceStatus;
  startedAt: number;
  endedAt: number;
  detail: Record<string, unknown>;
}

export interface LoopbusTraceInsert {
  cycleId: number;
  step: string;
  status: LoopbusTraceStatus;
  startedAt: number;
  endedAt: number;
  detail?: Record<string, unknown>;
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
