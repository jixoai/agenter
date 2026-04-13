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

export interface ReverseTimeCursor {
  beforeTimeMs: number;
  beforeId: number;
}

export interface ReversePage<T> {
  items: T[];
  nextBefore: ReverseTimeCursor | null;
  hasMoreBefore: boolean;
}

export interface SessionHeadRecord {
  currentRoundIndex: number;
  currentPromptWindowId: string | null;
  updatedAt: number;
}

export interface SessionPromptWindowRecord {
  promptWindowId: string;
  roundIndex: number;
  createdAt: number;
  messages: unknown[];
}

export const PROMPT_WINDOW_STATE_PART_TYPE = "state";

export type SessionMessageScope = "heartbeat" | "prompt_window" | "request_aux";
export type SessionMessageRole = "system" | "user" | "assistant" | "tool" | "config";

export interface SessionMessagePartRecord {
  partId: number;
  partIndex: number;
  messageId: string;
  windowId: string | null;
  aiCallId: number | null;
  roundIndex: number;
  scope: SessionMessageScope;
  role: SessionMessageRole;
  partType: string;
  mimeType: string | null;
  payload: unknown;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
}

export interface SessionMessagePartInput {
  partType: string;
  mimeType?: string | null;
  payload: unknown;
  isComplete?: boolean;
}

export interface SessionMessageUpsertInput {
  messageId: string;
  windowId?: string | null;
  aiCallId?: number | null;
  roundIndex: number;
  scope: SessionMessageScope;
  role: SessionMessageRole;
  createdAt?: number;
  updatedAt?: number;
  parts: SessionMessagePartInput[];
}

export interface SessionMessageRecord {
  id: number;
  messageId: string;
  windowId: string | null;
  aiCallId: number | null;
  roundIndex: number;
  scope: SessionMessageScope;
  role: SessionMessageRole;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
  parts: SessionMessagePartRecord[];
  text: string;
}

export interface SessionAiCallRecord {
  id: number;
  roundIndex: number;
  kind: string;
  status: "running" | "done" | "error" | "cancelled";
  provider: string;
  model: string;
  requestUrl: string;
  requestBody: unknown;
  responseBody: unknown | null;
  error: unknown | null;
  outcome: unknown | null;
  requestMessageIds: string[];
  responseMessageIds: string[];
  auxiliaryMessageIds: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  isComplete: boolean;
}

export interface SessionAiCallInsert {
  roundIndex: number;
  kind: string;
  status?: SessionAiCallRecord["status"];
  provider: string;
  model: string;
  requestUrl: string;
  requestBody: unknown;
  responseBody?: unknown | null;
  error?: unknown | null;
  outcome?: unknown | null;
  requestMessageIds?: string[];
  responseMessageIds?: string[];
  auxiliaryMessageIds?: string[];
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number | null;
  isComplete?: boolean;
}

export interface SessionAiCallUpdate {
  roundIndex?: number;
  kind?: string;
  status?: SessionAiCallRecord["status"];
  provider?: string;
  model?: string;
  requestUrl?: string;
  requestBody?: unknown;
  responseBody?: unknown | null;
  error?: unknown | null;
  outcome?: unknown | null;
  requestMessageIds?: string[];
  responseMessageIds?: string[];
  auxiliaryMessageIds?: string[];
  updatedAt?: number;
  completedAt?: number | null;
  isComplete?: boolean;
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
