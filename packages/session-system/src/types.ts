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

export type SessionMessageScope = "heartbeat_part" | "prompt_window" | "request_aux";
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

export type HeartbeatRecordKind = "model_call" | "compact" | "config";
export type HeartbeatRecordStatus = "running" | "completed" | "error" | "blocked" | "cancelled";

export type HeartbeatRecordSourceRef =
  | { kind: "ai_call"; id: number; role: "primary" | "related" }
  | {
      kind: "message_part";
      messageId: string;
      partId: string;
      role: "input" | "output" | "tool_call" | "tool_result" | "config" | "compact";
    }
  | { kind: "effect"; id: string; role: "compact" | "config" | "other" };

export interface HeartbeatRecordPartSummary {
  messageId: string;
  partId: string;
  role: SessionMessageRole;
  type: string;
  mimeType: string | null;
  aiCallId: number | null;
  startedAt: number;
  completedAt: number | null;
  label: string;
  isComplete: boolean;
}

export interface HeartbeatRecordSummary {
  provider: string | null;
  model: string | null;
  parts: HeartbeatRecordPartSummary[];
  counts: {
    parts: number;
    toolCalls: number;
    toolResults: number;
    errors: number;
  };
  firstFrameMs: number | null;
  thinkingDurationMs: number;
}

export interface HeartbeatRecord {
  id: number;
  recordKey: string;
  kind: HeartbeatRecordKind;
  status: HeartbeatRecordStatus;
  primaryAiCallId: number | null;
  aiCallIds: number[];
  sourceRefs: HeartbeatRecordSourceRef[];
  featureFlags: Record<string, boolean>;
  summary: HeartbeatRecordSummary;
  previewText: string | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  isComplete: boolean;
}

export interface HeartbeatRecordProjectionHealth {
  totalRecords: number;
  missingPrimaryAiCallRecords: number;
  orphanRecordIds: number[];
}

export interface HeartbeatRecordProjectionRepairResult {
  before: HeartbeatRecordProjectionHealth;
  after: HeartbeatRecordProjectionHealth;
  deletedRecordIds: number[];
  deletedRecords: number;
}

export interface HeartbeatSessionClearResult {
  deletedAiCalls: number;
  deletedMessageParts: number;
  deletedHeartbeatMessageParts: number;
  deletedRequestAuxMessageParts: number;
  deletedPromptWindowMessageParts: number;
  deletedHeartbeatRecords: number;
  deletedAttentionDispatches: number;
  deletedAttentionReceipts: number;
  deletedEffectLedgerRecords: number;
  resetCurrentRoundIndex: boolean;
  resetCurrentPromptWindow: boolean;
  stoppedRuntime: boolean;
  deletedAttentionFiles: number;
}

export type HeartbeatRecordPageAnchor =
  | { kind: "latest" }
  | { kind: "fixed"; pageIndex: number; latestRecordId?: number | null };

export interface HeartbeatRecordPageInput {
  pageSize: number;
  pageCount?: number;
  anchor: HeartbeatRecordPageAnchor;
}

export interface HeartbeatRecordPage {
  records: HeartbeatRecord[];
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  totalRecords: number;
  totalPages: number;
  windowTotalRecords: number;
  windowTotalPages: number;
  latestRecordId: number | null;
  anchor: HeartbeatRecordPageAnchor;
  hasOlder: boolean;
  hasNewer: boolean;
  newRecordsAvailable: boolean;
}

export interface HeartbeatRecordDetail {
  record: HeartbeatRecord;
  aiCalls: SessionAiCallRecord[];
  messages: SessionMessageRecord[];
  sourceRefs: HeartbeatRecordSourceRef[];
}

export type SessionAttentionReceiptStatus = "accepted" | "errored" | "aborted" | "completed";

export type SessionAttentionReceiptProviderEventKind =
  | "text_delta"
  | "thinking_delta"
  | "tool_call_start"
  | "tool_call_args"
  | "tool_call_end"
  | "run_finished"
  | "run_error"
  | "transport_error"
  | "abort";

export interface SessionAttentionDispatchRecord {
  id: number;
  dispatchId: string;
  contextId: string;
  commitId: string;
  cycleId: number;
  attemptIndex: number;
  agentCallId: string;
  sessionModelCallId: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SessionAttentionDispatchInsert {
  dispatchId: string;
  contextId: string;
  commitId: string;
  cycleId: number;
  attemptIndex: number;
  agentCallId: string;
  sessionModelCallId?: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface SessionAttentionReceiptRecord {
  id: number;
  receiptId: string;
  dispatchId: string;
  contextId: string;
  commitId: string;
  cycleId: number;
  attemptIndex: number;
  agentCallId: string;
  sessionModelCallId: number | null;
  status: SessionAttentionReceiptStatus;
  providerEventKind: SessionAttentionReceiptProviderEventKind;
  timestamp: number;
  finishReason?: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export interface SessionAttentionReceiptInsert {
  receiptId: string;
  dispatchId: string;
  contextId: string;
  commitId: string;
  cycleId: number;
  attemptIndex: number;
  agentCallId: string;
  sessionModelCallId?: number | null;
  status: SessionAttentionReceiptStatus;
  providerEventKind: SessionAttentionReceiptProviderEventKind;
  timestamp?: number;
  finishReason?: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  errorCode?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export type SessionRuntimeWatchStatus = "pending" | "expired" | "satisfied";

export type SessionRuntimeWatchPredicate = {
  kind: "message_latest_visible";
  chatId: string;
  anchorMessageId: number;
};

export interface SessionRuntimeWatchRecord {
  id: number;
  watchId: string;
  ownerActionId: string;
  ownerActionKind: string;
  ownerActorId: string;
  ownerCycleId: number | null;
  ownerSessionModelCallId: number | null;
  target: string;
  predicate: SessionRuntimeWatchPredicate;
  dueAt: number;
  status: SessionRuntimeWatchStatus;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  reminderContextId?: string | null;
  reminderCommitId?: string | null;
  meta?: Record<string, unknown>;
}

export interface SessionRuntimeWatchInsert {
  watchId: string;
  ownerActionId: string;
  ownerActionKind: string;
  ownerActorId: string;
  ownerCycleId?: number | null;
  ownerSessionModelCallId?: number | null;
  target: string;
  predicate: SessionRuntimeWatchPredicate;
  dueAt: number;
  status?: SessionRuntimeWatchStatus;
  createdAt?: number;
  updatedAt?: number;
  resolvedAt?: number | null;
  reminderContextId?: string | null;
  reminderCommitId?: string | null;
  meta?: Record<string, unknown>;
}

export interface SessionRuntimeWatchUpdate {
  status?: SessionRuntimeWatchStatus;
  updatedAt?: number;
  resolvedAt?: number | null;
  reminderContextId?: string | null;
  reminderCommitId?: string | null;
  meta?: Record<string, unknown>;
}

export interface SessionEffectLedgerRecord {
  id: number;
  effectId: string;
  actionId: string;
  actionKind: string;
  actorId: string;
  cycleId: number | null;
  sessionModelCallId: number | null;
  target: string;
  effectKind: string;
  effectRecordId: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface SessionEffectLedgerInsert {
  effectId: string;
  actionId: string;
  actionKind: string;
  actorId: string;
  cycleId?: number | null;
  sessionModelCallId?: number | null;
  target: string;
  effectKind: string;
  effectRecordId: string;
  timestamp?: number;
  meta?: Record<string, unknown>;
}

export type SessionAttentionFocusState = "focused" | "background" | "muted";
export type SessionNotifyQuotaWindowKind = "period";

export interface SessionNotifyQuotaRecord {
  id: number;
  notifyId: string;
  contextId: string;
  quotaTarget: string;
  focusState: SessionAttentionFocusState;
  sourceId: string;
  commitId: string;
  sentAt: number;
  windowKind: SessionNotifyQuotaWindowKind;
  windowMs: number;
  meta?: Record<string, unknown>;
}

export interface SessionNotifyQuotaInsert {
  notifyId: string;
  contextId: string;
  quotaTarget: string;
  focusState: SessionAttentionFocusState;
  sourceId: string;
  commitId: string;
  sentAt?: number;
  windowKind?: SessionNotifyQuotaWindowKind;
  windowMs: number;
  meta?: Record<string, unknown>;
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
