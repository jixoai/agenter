import {
  AttentionStore,
  AttentionSystem,
  applyAttentionCommitWithContext,
  type AttentionActiveContextMatch,
  type AttentionCommit,
  type AttentionCommitChange,
  type AttentionCommitHookResult,
  type AttentionCommitMatch,
  type AttentionCommitMeta,
  type AttentionCommitRef,
  type AttentionCommitToolInput,
  type AttentionContextDescriptor,
  type AttentionContextRef,
  type AttentionContextState,
  type AttentionCycleFrame,
  type AttentionFocusState,
  type AttentionHookRecord,
  type AttentionProtocolMode,
  type AttentionSystemSnapshot,
} from "@agenter/attention-system";
import type {
  AttentionDeliveryProjection,
  AttentionDispatchRecord,
  AttentionReceiptProviderEventKind,
  AttentionReceiptRecord,
  AttentionCommitRefRecord as DeliveryCommitRefRecord,
} from "@agenter/loopbus-kernel";
import {
  parseManagedInvitationDescriptorInput,
  signManagedInvitationAcceptProof,
} from "@agenter/managed-seat-invitation-handshake";
import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  type MessageChannelAccessProjection,
  type MessageChannelGrantRecord,
  type MessageChannelKind,
  type MessageChannelPatchInput,
  type MessageContactId,
  type MessageContactRecord,
  type MessageControlPlaneEntry,
  type MessageErrorPayload,
  type MessageFocusOp,
  type MessageFollowUpDueInput,
  type MessageFollowUpRequest,
  type MessageInteractivePayload,
  type MessageInvitationRecord,
  type MessageIssueGrantInput,
  type MessageIssuedGrant,
  type MessageManagedSeatClass,
  type MessageQueryRequest,
  type MessageRecord,
  type MessageSeatStateProjection,
  type MessageSnapshot,
} from "@agenter/message-system";
import {
  SessionDb,
  type SessionAiCallRecord,
  type SessionAssetRecord,
  type SessionAttentionDispatchRecord,
  type SessionAttentionReceiptRecord,
  type SessionCollectedInput,
  type SessionCollectedInputPart,
  type ReversePage as SessionDbReversePage,
  type ReverseTimeCursor as SessionDbReverseTimeCursor,
  type SessionEffectLedgerRecord,
  type SessionMessageRecord,
  type SessionMessageUpsertInput,
  type SessionNotifyQuotaRecord,
  type SessionPromptWindowRecord,
  type SessionRuntimeWatchRecord,
  type SessionTerminalOutcome,
  type SessionTraceRef,
} from "@agenter/session-system";
import { DEFAULT_LOOP_RETRY_POLICY, ResourceLoader } from "@agenter/settings";
import {
  TaskEngine,
  resolveTaskSources,
  serializeTaskMarkdown,
  type TaskSourceName,
  type TaskSourceResolved,
  type TaskView,
} from "@agenter/task-system";
import {
  DEFAULT_TERMINAL_FONT,
  TerminalControlPlane,
  type TerminalAwaitResult as ControlPlaneTerminalAwaitResult,
  type TerminalReadResult as ControlPlaneTerminalReadResult,
  type TerminalAccessProjection,
  type TerminalActorId,
  type TerminalApprovalRequestRecord,
  type TerminalAwaitInput,
  type TerminalControlPlaneConfig,
  type TerminalControlPlaneConfigPatch,
  type TerminalControlPlaneEntry,
  type TerminalInvitationRecord,
  type TerminalManagedSeatClass,
  type TerminalPatchInput,
  type TerminalProcessProfile,
  type TerminalSeatProjection,
} from "@agenter/terminal-system";
import { toolDefinition } from "@tanstack/ai";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { createRuntimeAttentionPreview } from "./attention-runtime-view";
import {
  AttentionSearchEngine,
  ATTENTION_SEARCH_LEGACY_DUCKDB_FILENAME,
  ATTENTION_SEARCH_SQLITE_FILENAME,
  type AttentionSearchRequest,
} from "./attention-search";

import { AgentRuntime } from "./agent-runtime";
import {
  AgenterAI,
  type AgentModelCallRecord,
  type AgentPromptWindowStateRecord,
  type AgentRuntimeStats,
  type AgentToolProvider,
  type AgentToolTraceEntry,
} from "./agenter-ai";
import { AttentionHashAliasRegistry, AttentionHashAliasStore } from "./attention-hash-alias-registry";
import { projectAttentionCommitMatchForModel } from "./attention-model-view";
import {
  MESSAGE_ATTENTION_NAMESPACE,
  ROOM_ATTENTION_NAMESPACE,
  TASK_ATTENTION_NAMESPACE,
  TERMINAL_ATTENTION_NAMESPACE,
  appAttentionSourceRegistry,
  formatRoomAttentionSrc,
  formatTaskAttentionSrc,
  formatTerminalAttentionSrc,
  parseMessageAttentionSrc,
  parseRoomAttentionSrc,
  parseTaskAttentionSrc,
  parseTerminalAttentionSrc,
  type TerminalAttentionSrc,
} from "./attention-src";
import {
  readAvatarSeatDocument,
  saveAvatarMessageSeatCredential,
  saveAvatarTerminalSeatCredential,
} from "./avatar-seat-store";
import {
  collectClientMessageIds,
  detectChatCycleKind,
  toChatCycleId,
  type ChatCycle,
  type ChatCycleStatus,
} from "./chat-cycles";
import {
  HEARTBEAT_INSPECTION_SCOPES,
  HEARTBEAT_MESSAGE_PART_SCOPE,
  buildHeartbeatToolInvocationMessageId,
  toHeartbeatEventMessageUpsertInput,
  toHeartbeatCompactSeparatorUpsertInput as toHeartbeatPartCompactSeparatorUpsertInput,
  toHeartbeatRequestMessageUpsertInputs,
  toHeartbeatResponseSegmentMessageUpsertInputs,
  toHeartbeatToolInvocationMessageUpsertInput,
  type HeartbeatAssistantResponseSegment,
} from "./heartbeat-message-parts";
import type { LoopBusInput, LoopBusPhase, LoopBusWakeSource } from "./loop-bus";
import type { LoopBusKernelSnapshot, LoopBusKernelState } from "./loopbus-kernel";
import { createInitialLoopKernelState, createLoopStatePatch, hashLoopState } from "./loopbus-kernel";
import {
  LoopBusPluginRuntime,
  type AttentionDispatchedInput,
  type AttentionDraft,
  type AttentionReceiptInput,
  type LoopBusPlugin,
  type LoopMessageSourceRef,
  type LoopSourceReadRequest,
  type LoopSourceReadResult,
  type LoopSourceRef,
  type LoopTaskSourceRef,
  type LoopTerminalSourceRef,
} from "./loopbus-plugin-runtime";
import { type ManagedTerminalSnapshot, type TerminalRuntime } from "./managed-terminal";
import { McpSystem } from "./mcp-system/system";
import type {
  McpAddInput,
  McpCallInput,
  McpDisableInput,
  McpListInput,
  McpProjectInput,
  McpQueryInput,
  McpRemoveInput,
} from "./mcp-system/types";
import { summarizeMessageChannelPresence } from "./message-channel-presence";
import { resolveModelCapabilities } from "./model-capabilities";
import {
  ModelClient,
  type AssistantDeliveryEvent,
  type AssistantStreamUpdate,
  type TextOnlyModelMessage,
} from "./model-client";
import { FilePromptStore, type RuntimePromptState } from "./prompt-store";
import { buildProviderSnapshot, normalizeTokenUsage, readProviderSnapshotFromRequestBody } from "./provider-snapshot";
import { createRuntimeShellCommands } from "./runtime-cli";
import type {
  RuntimeCycleRecord,
  RuntimeLoopStateLogRecord,
  RuntimeLoopTraceRecord,
  RuntimeTerminalActivityRecord,
} from "./runtime-history-records";
import { RuntimeKernelHost } from "./runtime-kernel-host";
import { startRuntimeLocalApi, type RuntimeLocalApiHandle } from "./runtime-local-api";
import {
  buildPublicWorkspaceShellEnvironment,
  buildRootWorkspaceShellEnvironment,
  buildSharedTerminalEnvironment,
  createRuntimeShellWhichCommand,
  materializeRuntimeShellBin,
} from "./runtime-shell-bin";
import { RuntimeSkillSystem } from "./runtime-skill-system";
import { listRuntimeSkillMountRoots } from "./runtime-skills";
import { RuntimeMessageKernelAdapter } from "./runtime-system-kernel-adapters/message-adapter";
import {
  RuntimeSkillKernelAdapter,
  type RuntimeSkillKernelApplyResult,
} from "./runtime-system-kernel-adapters/skill-adapter";
import { RuntimeTerminalKernelAdapter } from "./runtime-system-kernel-adapters/terminal-adapter";
import type { RuntimeIngressCommitResult, RuntimeSystemIngressEnvelope } from "./runtime-system-kernel-adapters/types";
import {
  projectRuntimeAttentionActiveMatch,
  projectRuntimeAttentionContext,
  projectRuntimeMessageChannel,
  projectRuntimeMessageOverview,
  projectRuntimeMessageSnapshot,
  projectRuntimeSkill,
  projectRuntimeSkillConfigInfo,
  projectRuntimeSkillInfo,
  projectRuntimeSkillMutation,
  projectRuntimeTerminal,
  projectRuntimeTerminalConfig,
  projectRuntimeTerminalConfigMutation,
  projectRuntimeWorkspaceSurface,
  type RuntimeMessageChannelView,
  type RuntimeMessageOverviewItem,
  type RuntimeMessageQueryResult,
  type RuntimeMessageSendResult,
  type RuntimeMessageSnapshotView,
  type RuntimeReachableParticipantView,
  type RuntimeTerminalCreateAckView,
  type RuntimeTerminalView,
  type RuntimeVisibleMessageRoomView,
  type RuntimeWorkspaceSurface,
} from "./runtime-tool-views";
import { createSpanId, createTraceEvent, createTraceId, createTraceRef } from "./runtime-trace";
import { buildSessionAssetRelativePath, resolveSessionAssetKind, toChatSessionAsset } from "./session-assets";
import { resolveSessionRoomActorId } from "./session-chat-projection";
import { resolveSessionConfig, type ResolvedSessionConfig, type SessionTerminalConfig } from "./session-config";
import {
  isPersistedChatProjectionMessage,
  projectAiCallToModelCall,
  projectHeartbeatMessageToChatMessage,
  type RuntimeModelCallRecord,
} from "./session-ledger-view";
import {
  projectSessionNotificationSnapshot,
  toAttentionFocusStateFromVisibility,
  type SessionNotificationSnapshot,
} from "./session-notifications";
import { SessionStore } from "./session-store";
import { SettingsEditor, type EditableKind } from "./settings-editor";
import { projectWorkspaceSystemClis, type SystemCliProjection } from "./system-cli-projection";
import { buildTerminalSemanticFingerprint, buildTerminalViewFingerprint } from "./terminal-snapshot-fingerprint";
import type { ChatMessage, ChatSessionAsset, ModelCapabilities, TaskStage } from "./types";
import { UsageAnalyticsDb } from "./usage-analytics-db";
import { resolveUsageAnalyticsDbPathFromAvatarRoot } from "./usage-analytics-paths";
import type { UsageAnalyticsFactInput } from "./usage-analytics-types";
import {
  listWorkspaceSettingsLayers,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
  type SettingsLayerSnapshot,
  type SettingsLayersResult,
} from "./workspace-settings";
import {
  AVATAR_HOME_ENV,
  RootWorkspaceShellWorld,
  SKILLS_HOME_ENV,
  createRootWorkspaceShellWorld,
  deriveMultiWorkspaceSkillsHome,
  executeWorkspaceBash,
  listWorkspaceHiddenPrivatePaths,
  parseEnvAvatarHome,
  serializeEnvSkillsHome,
  type RootWorkspaceBashExecResult,
  type RootWorkspaceMountInput,
  type WorkspaceGrantRecord,
  type WorkspaceMountRecord,
} from "./workspace-system";
import { resolveWorkspaceFsPath } from "./workspace-target";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_CHAT_OWNER = "agenter";
const clonePromptWindowMessages = (
  messages: unknown[] | null | undefined,
): ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"] =>
  structuredClone((messages ?? []) as ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"]);

const toAgentPromptWindowStateRecord = (record: SessionPromptWindowRecord): AgentPromptWindowStateRecord => ({
  id: record.promptWindowId,
  createdAt: record.createdAt,
  roundIndex: record.roundIndex,
  messages: clonePromptWindowMessages(record.messages),
});

type SessionDbChatMessageRecord = SessionMessageRecord;
type SessionDbApiCallRecord = SessionAiCallRecord;
type SessionModelCallRecord = RuntimeModelCallRecord;
type SessionCycleRecord = RuntimeCycleRecord;
type SessionDbLoopbusStateLogRecord = RuntimeLoopStateLogRecord;
type SessionDbLoopbusTraceRecord = RuntimeLoopTraceRecord;
type SessionDbTerminalActivityRecord = RuntimeTerminalActivityRecord;

const toToolRecord = (value: object): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(value));
};
const ATTENTION_TITLE_LIMIT = 140;
const MAX_TERMINAL_ATTENTION_DETAIL_CHARS = 4_000;
const MAX_TASK_ATTENTION_DETAIL_CHARS = 4_000;
const ATTENTION_DEBT_INITIAL_BACKOFF_MS = 600;
const ATTENTION_DEBT_MAX_BACKOFF_MS = 5_000;
const ATTENTION_DEBT_BACKOFF_MULTIPLIER = 2;
const PASSIVE_LIFECYCLE_ATTENTION_SCORE = 0;
const PASSIVE_TERMINAL_OBSERVATION_SCORE = 0;

type TerminalFocusOp = "add" | "remove" | "replace" | "clear";
type TerminalReadMode = "auto" | "diff" | "snapshot";
type TerminalReadRepresentation = "diff" | "snapshot";

interface AttentionDebtState {
  activeContextCount: number;
  activeItemCount: number;
  unresolvedScoreCount: number;
}

interface AttentionContainmentEntry {
  contextId: string;
  fingerprint: string;
  retryCount: number;
  nextWakeAt: number;
  updatedAt: number;
}

interface AttentionContainmentSummary {
  state: "none" | "ready" | "backoff" | "blocked";
  nextWakeAt: number | null;
  retryCount: number;
  blockedReason: string | null;
}

type CompactCycleTrigger =
  | "manual"
  | "threshold"
  | "attention_retry"
  | "context_overflow"
  | "external_continuation_limit"
  | "timeout"
  | "error";
type AttentionInputProtocolKind = "context" | "items";
type AttentionVisibleSnapshotKind = "context" | "items";
interface AttentionCommitRefEnvelope {
  contextId: string;
  commitId: string;
}

interface AttentionVisibleSnapshot {
  contextId: string;
  kind: AttentionVisibleSnapshotKind;
  text: string;
  headCommitId: string | null;
  updatedAt: string;
  seededFocusState?: Exclude<AttentionFocusState, "muted">;
}

interface StagedAttentionItemEntry {
  key: string;
  commitId: string;
  sourceId: string;
  ingressType: AttentionCommit["ingressType"];
  isNotify: boolean;
  updatedAt: number;
}

interface PendingAttentionMessagePlan {
  messageId: string;
  contextId: string;
  kind: AttentionVisibleSnapshotKind;
  text: string;
  headCommitId: string | null;
  updatedAt: string;
  seededFocusState?: Exclude<AttentionFocusState, "muted">;
  clearStageKeys: string[];
  attentionCommitRefs: AttentionCommitRefEnvelope[];
  clearsBoundaryRefresh: boolean;
  notifyOnly?: boolean;
  notifyQuotaRecords?: Array<{
    quotaTarget: string;
    focusState: AttentionFocusState;
    sourceId: string;
    windowMs: number;
  }>;
}

const mergeAttentionPlanCommitRefs = (
  contextPlan: PendingAttentionMessagePlan,
  itemsPlan: PendingAttentionMessagePlan,
): PendingAttentionMessagePlan => ({
  ...contextPlan,
  clearStageKeys: [...itemsPlan.clearStageKeys],
  attentionCommitRefs: [...itemsPlan.attentionCommitRefs],
});

interface AttentionCollectedInputMeta {
  attentionMessagePlanId?: string;
}

interface PendingCompactRequest {
  trigger: CompactCycleTrigger;
  requestedAt: number;
}

const COMPACT_CYCLE_TRIGGER_VALUES = new Set<CompactCycleTrigger>([
  "manual",
  "threshold",
  "attention_retry",
  "context_overflow",
  "external_continuation_limit",
  "timeout",
  "error",
]);
const ATTENTION_INPUT_PROTOCOL_KINDS = new Set<AttentionInputProtocolKind>(["context", "items"]);
const COMPACT_CYCLE_INPUT_NAME = "CompactCycle";
const NOTIFY_QUOTA_DEFAULTS = {
  muted: 12 * 60 * 60 * 1_000,
  background: 30 * 60 * 1_000,
} as const;

type NotifyQuotaFocusState = keyof typeof NOTIFY_QUOTA_DEFAULTS;

interface RuntimeNotifyQuotaStatusView {
  quotaTarget: string;
  focusState: AttentionFocusState;
  effective: {
    windowKind: "period";
    windowMs: number | null;
  };
  remaining: {
    allowedNow: boolean;
    remainingSends: number | null;
    nextAllowedAt: number | null;
  };
  history: Array<{
    notifyId: string;
    contextId: string;
    commitId: string;
    sourceId: string;
    sentAt: number;
    windowMs: number;
  }>;
}

const parseCompactCycleTrigger = (value: unknown): CompactCycleTrigger | null => {
  if (typeof value !== "string") {
    return null;
  }
  return COMPACT_CYCLE_TRIGGER_VALUES.has(value as CompactCycleTrigger) ? (value as CompactCycleTrigger) : null;
};

const parseAttentionInputProtocolKind = (value: unknown): AttentionInputProtocolKind | null => {
  if (typeof value !== "string") {
    return null;
  }
  return ATTENTION_INPUT_PROTOCOL_KINDS.has(value as AttentionInputProtocolKind)
    ? (value as AttentionInputProtocolKind)
    : null;
};

const serializeAttentionCommitIds = (commitIds: readonly string[]): string | undefined => {
  if (commitIds.length === 0) {
    return undefined;
  }
  return JSON.stringify(commitIds);
};

const serializeAttentionContextIds = (contextIds: readonly string[]): string | undefined => {
  if (contextIds.length === 0) {
    return undefined;
  }
  return JSON.stringify([...new Set(contextIds)]);
};

const parseAttentionContextIds = (value: unknown): string[] => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0))];
  } catch {
    return [];
  }
};

const parseAttentionCommitIds = (value: unknown): string[] => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
};

const serializeAttentionCommitRefs = (refs: readonly AttentionCommitRefEnvelope[]): string | undefined => {
  if (refs.length === 0) {
    return undefined;
  }
  return JSON.stringify(
    refs.map((ref) => ({
      contextId: ref.contextId,
      commitId: ref.commitId,
    })),
  );
};

const parseAttentionCommitRefs = (value: unknown): AttentionCommitRefEnvelope[] => {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is AttentionCommitRefEnvelope =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).contextId === "string" &&
        typeof (item as Record<string, unknown>).commitId === "string",
    );
  } catch {
    return [];
  }
};

const pageLocalRecords = <T extends { id: number }>(
  items: readonly T[],
  input: { before?: SessionDbReverseTimeCursor; limit?: number } | undefined,
  readTimestamp: (item: T) => number,
): SessionDbReversePage<T> => {
  const limit = Math.max(1, Math.min(input?.limit ?? 200, 1_000));
  const before = input?.before;
  const descending = [...items].sort((left, right) => {
    const leftTime = readTimestamp(left);
    const rightTime = readTimestamp(right);
    return leftTime === rightTime ? right.id - left.id : rightTime - leftTime;
  });
  const filtered = descending.filter((item) => {
    if (!before) {
      return true;
    }
    const timestamp = readTimestamp(item);
    return timestamp < before.beforeTimeMs || (timestamp === before.beforeTimeMs && item.id < before.beforeId);
  });
  const pageDescending = filtered.slice(0, limit);
  const pageItems = [...pageDescending].reverse();
  const oldest = pageItems[0] ?? null;
  return {
    items: pageItems,
    nextBefore:
      filtered.length > pageDescending.length && oldest
        ? {
            beforeTimeMs: readTimestamp(oldest),
            beforeId: oldest.id,
          }
        : null,
    hasMoreBefore: filtered.length > pageDescending.length,
  };
};

const readAllMessagesByScope = (db: SessionDb, scope: typeof HEARTBEAT_MESSAGE_PART_SCOPE): SessionMessageRecord[] => {
  const pages: SessionMessageRecord[][] = [];
  let before: SessionDbReverseTimeCursor | undefined;
  while (true) {
    const page = db.pageMessagesByScope(scope, { before, limit: 1_000 });
    if (page.items.length === 0) {
      break;
    }
    pages.push(page.items);
    if (!page.hasMoreBefore || !page.nextBefore) {
      break;
    }
    before = page.nextBefore;
  }
  return pages.reverse().flat();
};

type PendingTraceSpan = Omit<SessionDbLoopbusTraceRecord, "id" | "seq" | "cycleId">;

const toCycleFrameTraceRef = (cycleId: number): SessionTraceRef =>
  createTraceRef("cycle.frame", String(cycleId), { label: `Cycle #${cycleId}` });

const toAttentionContextTraceRef = (contextId: string): SessionTraceRef =>
  createTraceRef("attention.context", contextId, { label: contextId });

const toAttentionCommitTraceRef = (contextId: string, commitId: string): SessionTraceRef =>
  createTraceRef("attention.commit", `${contextId}:${commitId}`, {
    label: commitId,
    attributes: { contextId, commitId },
  });

const toMessageChannelTraceRef = (channelId: string): SessionTraceRef =>
  createTraceRef("message.channel", channelId, { label: channelId });

const toTerminalTraceRef = (terminalId: string): SessionTraceRef =>
  createTraceRef("terminal.pty", terminalId, { label: terminalId });

const toModelCallTraceRef = (modelCallId: number): SessionTraceRef =>
  createTraceRef("model.call", String(modelCallId), { label: `Model call #${modelCallId}` });

const toAttentionHookTraceRef = (hookId: string): SessionTraceRef =>
  createTraceRef("attention.hook", hookId, { label: hookId });

const extractKnownTerminalIds = (value: string, terminalIds: Iterable<string>): string[] => {
  const matches: string[] = [];
  for (const terminalId of terminalIds) {
    if (terminalId.length === 0 || !value.includes(terminalId)) {
      continue;
    }
    matches.push(terminalId);
  }
  return matches;
};

const buildTerminalDiffPayload = (
  terminalId: string,
  input: {
    fromHash: string | null;
    toHash: string | null;
    diff: string;
    bytes: number;
    status: "IDLE" | "BUSY";
    processPhase: ControlPlaneTerminalReadResult["processPhase"];
  },
): ControlPlaneTerminalReadResult => ({
  kind: "terminal-diff",
  representation: "diff" as const,
  terminalId,
  fromHash: input.fromHash,
  toHash: input.toHash,
  bytes: input.bytes,
  status: input.status,
  processPhase: input.processPhase,
  diff: input.diff,
});

const serializeTerminalDiff = (
  terminalId: string,
  input: {
    fromHash: string | null;
    toHash: string | null;
    diff: string;
    bytes: number;
    status: "IDLE" | "BUSY";
    processPhase: ControlPlaneTerminalReadResult["processPhase"];
  },
): string => JSON.stringify(buildTerminalDiffPayload(terminalId, input));

const truncateAttentionDetail = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  const remaining = value.length - maxChars;
  return `${value.slice(0, maxChars)}\n... [truncated ${remaining} chars]`;
};

const truncateAttentionDetailPreview = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  const headLength = Math.max(1, Math.floor(maxChars * 0.65));
  const tailLength = Math.max(1, maxChars - headLength);
  if (headLength + tailLength >= value.length) {
    return value;
  }
  const remaining = value.length - headLength - tailLength;
  return `${value.slice(0, headLength)}\n... [truncated ${remaining} chars] ...\n${value.slice(-tailLength)}`;
};

const buildTerminalSnapshotPayload = (
  terminalId: string,
  snapshot: ManagedTerminalSnapshot,
  status: "IDLE" | "BUSY",
  processPhase: ControlPlaneTerminalReadResult["processPhase"],
): ControlPlaneTerminalReadResult => ({
  kind: "terminal-snapshot",
  representation: "snapshot" as const,
  terminalId,
  seq: snapshot.seq,
  cols: snapshot.cols,
  rows: snapshot.rows,
  cursor: snapshot.cursor,
  tail: snapshot.lines.slice(-20).join("\n"),
  snapshot,
  status,
  processPhase,
});

const attachTerminalReadCursor = (
  payload: ControlPlaneTerminalReadResult,
  readCursor: ControlPlaneTerminalReadResult["readCursor"] | null,
): ControlPlaneTerminalReadResult => {
  if (!readCursor) {
    return payload;
  }
  return {
    ...payload,
    fromHash: payload.fromHash ?? readCursor.fromHash,
    toHash: payload.toHash ?? readCursor.toHash,
    readCursor,
  };
};

const truncateTerminalAttentionDetail = (value: string): string => {
  return truncateAttentionDetail(value, MAX_TERMINAL_ATTENTION_DETAIL_CHARS);
};

const getTerminalTail = (payload: Record<string, unknown>): string => {
  if (typeof payload.tail === "string") {
    const tail = payload.tail;
    if (tail.trim().length > 0) {
      return tail;
    }
  }
  if (Array.isArray(payload.tail)) {
    const tail = payload.tail.filter((line): line is string => typeof line === "string").join("\n");
    if (tail.trim().length > 0) {
      return tail;
    }
  }
  const snapshot = payload.snapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const lines = (snapshot as { lines?: unknown }).lines;
    if (Array.isArray(lines)) {
      const semanticLines = lines
        .filter((line): line is string => typeof line === "string")
        .map((line) => line.trimEnd());
      while (semanticLines.length > 0 && semanticLines[semanticLines.length - 1]!.trim().length === 0) {
        semanticLines.pop();
      }
      return semanticLines.slice(-20).join("\n");
    }
  }
  return "";
};

const getTerminalTailSummary = (tail: string): string | null => {
  const lines = tail
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return null;
  }
  return truncateAttentionTitle(lines.at(-1)!);
};

const hasMeaningfulTerminalAttentionPayload = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const kind = typeof parsed.kind === "string" ? parsed.kind : "";
    if (kind === "terminal-snapshot") {
      return getTerminalTail(parsed).trim().length > 0;
    }
    if (kind === "terminal-diff") {
      return typeof parsed.diff === "string" && parsed.diff.trim().length > 0;
    }
    return true;
  } catch {
    return content.trim().length > 0;
  }
};

const buildTerminalAttentionPresentation = (
  content: string,
  fallbackTerminalId: string,
): {
  title: string;
  detailValue: string;
  detailFormat: string;
  detailKind: "replace" | "patch";
} => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const kind = typeof parsed.kind === "string" ? parsed.kind : "terminal-event";
    const terminalId = typeof parsed.terminalId === "string" ? parsed.terminalId : fallbackTerminalId;

    if (kind === "terminal-snapshot") {
      const tail = getTerminalTail(parsed);
      const titleSuffix = getTerminalTailSummary(tail);
      const metaYaml = toYaml({
        kind,
        terminalId,
        seq: parsed.seq ?? null,
        cols: parsed.cols ?? null,
        rows: parsed.rows ?? null,
        status: parsed.status ?? "unknown",
        cursor: parsed.cursor ?? null,
      });
      const detailBody =
        tail.trim().length > 0 ? mdFence("text", truncateTerminalAttentionDetail(tail)) : "_empty snapshot tail_";
      return {
        title: titleSuffix ? `Terminal ${terminalId}: ${titleSuffix}` : `Terminal ${terminalId} snapshot updated`,
        detailValue: [mdFence("yaml", metaYaml), detailBody].join("\n\n"),
        detailFormat: "text/markdown",
        detailKind: "replace",
      };
    }

    if (kind === "terminal-diff") {
      const diff = typeof parsed.diff === "string" ? parsed.diff : "";
      const metaYaml = toYaml({
        kind,
        terminalId,
        fromHash: parsed.fromHash ?? null,
        toHash: parsed.toHash ?? null,
        bytes: parsed.bytes ?? 0,
        status: parsed.status ?? "unknown",
      });
      const detailBody =
        diff.trim().length > 0 ? mdFence("diff", truncateTerminalAttentionDetail(diff)) : "_empty terminal diff_";
      return {
        title: `Terminal ${terminalId} diff updated`,
        detailValue: [mdFence("yaml", metaYaml), detailBody].join("\n\n"),
        detailFormat: "text/markdown",
        detailKind: "patch",
      };
    }

    return {
      title: `Terminal ${terminalId} updated`,
      detailValue: mdFence("yaml", toYaml(parsed)),
      detailFormat: "text/markdown",
      detailKind: "replace",
    };
  } catch {
    const trimmed = content.trim();
    return {
      title: trimmed.length > 0 ? truncateAttentionTitle(trimmed) : `Terminal ${fallbackTerminalId} updated`,
      detailValue: content,
      detailFormat: "text/plain",
      detailKind: "replace",
    };
  }
};

const buildStableAttentionSubjectId = (prefix: string, seed: string): string => {
  const normalized = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const digest = createHash("sha256").update(`${prefix}:${seed}`).digest("hex").slice(0, 10);
  return normalized.length > 0 ? `${prefix}-${normalized}-${digest}` : `${prefix}-${digest}`;
};

const buildTaskAttentionPresentation = (
  content: string,
  fallbackSubjectId: string,
): {
  title: string;
  detailValue: string;
  detailFormat: string;
  detailKind: "replace";
} => {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const kind = typeof parsed.kind === "string" ? parsed.kind : "task-event";

    if (kind === "task-heartbeat") {
      const activeCount = typeof parsed.activeCount === "number" ? parsed.activeCount : 0;
      return {
        title: `Task heartbeat: ${activeCount} active`,
        detailValue: mdFence("yaml", toYaml(parsed)),
        detailFormat: "text/markdown",
        detailKind: "replace",
      };
    }

    if (kind === "task-triggered") {
      const source = typeof parsed.source === "string" ? parsed.source : "unknown";
      const topic = typeof parsed.topic === "string" ? parsed.topic : "unknown";
      const affected = Array.isArray(parsed.affected) ? parsed.affected : [];
      return {
        title: `Task trigger ${topic} (${affected.length} affected)`,
        detailValue: mdFence("yaml", toYaml({ kind, source, topic, affected })),
        detailFormat: "text/markdown",
        detailKind: "replace",
      };
    }

    if (kind === "task-source") {
      const file = typeof parsed.file === "string" ? parsed.file : fallbackSubjectId;
      const markdown = typeof parsed.markdown === "string" ? parsed.markdown : "";
      const metaYaml = toYaml({
        kind,
        sourceName: parsed.sourceName ?? null,
        sourcePath: parsed.sourcePath ?? null,
        file,
      });
      const body =
        markdown.trim().length > 0
          ? mdFence("markdown", truncateAttentionDetail(markdown, MAX_TASK_ATTENTION_DETAIL_CHARS))
          : "_empty task source_";
      return {
        title: `Task source changed: ${basename(file)}`,
        detailValue: [mdFence("yaml", metaYaml), body].join("\n\n"),
        detailFormat: "text/markdown",
        detailKind: "replace",
      };
    }

    return {
      title: `Task ${fallbackSubjectId} updated`,
      detailValue: mdFence("yaml", toYaml(parsed)),
      detailFormat: "text/markdown",
      detailKind: "replace",
    };
  } catch {
    const trimmed = content.trim();
    return {
      title: trimmed.length > 0 ? truncateAttentionTitle(trimmed) : `Task ${fallbackSubjectId} updated`,
      detailValue: content,
      detailFormat: "text/plain",
      detailKind: "replace",
    };
  }
};

const buildMessageFollowUpReminderPresentation = (input: {
  chatId: string;
  anchorMessageId: number;
  dueAt: number;
  messageContent: string;
}): {
  title: string;
  detailValue: string;
  detailFormat: string;
  detailKind: "replace";
} => {
  const trimmedContent = input.messageContent.trim();
  const titleSuffix =
    trimmedContent.length > 0 ? truncateAttentionTitle(trimmedContent) : `message ${input.anchorMessageId}`;
  const metaYaml = toYaml({
    kind: "message-follow-up-reminder",
    chatId: input.chatId,
    anchorMessageId: input.anchorMessageId,
    dueAt: new Date(input.dueAt).toISOString(),
  });
  const body =
    trimmedContent.length > 0
      ? mdFence("text", truncateAttentionDetail(input.messageContent, MAX_TASK_ATTENTION_DETAIL_CHARS))
      : "_empty room message_";
  return {
    title: `Re-evaluate room follow-up: ${titleSuffix}`,
    detailValue: [mdFence("yaml", metaYaml), body].join("\n\n"),
    detailFormat: "text/markdown",
    detailKind: "replace",
  };
};

type TerminalReadPayload = ControlPlaneTerminalReadResult | { ok: false; reason: string };
type RuntimeTerminalWriteResult = {
  ok: boolean;
  message: string;
  read?: TerminalReadPayload;
  approvalRequest?: TerminalApprovalRequestRecord;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
      ? error.name === "AbortError" || error.message === "This operation was aborted"
      : false;

const truncateAttentionTitle = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= ATTENTION_TITLE_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, ATTENTION_TITLE_LIMIT - 1)}...`;
};

const serializeAttentionCommitMatch = (match: AttentionCommitMatch): string =>
  mdFence("yaml+attention-commit-match", toYaml(projectAttentionCommitMatchForModel(match)));

const projectBackgroundAttentionContextForModel = (match: AttentionActiveContextMatch): Record<string, unknown> => ({
  contextId: match.contextId,
  owner: match.context.owner,
  updatedAt: match.context.updatedAt,
  headCommitId: match.context.headCommitId,
  contentPreview: truncateAttentionDetailPreview(match.context.content, 280),
  recentCommitSummaries: match.recentCommits.slice(-3).map((commit) => ({
    commitId: commit.commitId,
    summary: commit.summary,
  })),
});

const projectAttentionCommitForPrompt = (commit: AttentionCommit): Record<string, unknown> => ({
  commitId: commit.commitId,
  ingressType: commit.ingressType,
  parentCommitIds: [...commit.parentCommitIds],
  provenance: {
    author: commit.meta.author,
    source: commit.meta.source,
    src: commit.meta.src,
    tags: commit.meta.tags,
    createdAt: commit.meta.createdAt,
  },
  summary: commit.summary,
  change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
  createdAt: commit.createdAt,
});

const projectAttentionActiveContextForPrompt = (match: AttentionActiveContextMatch): Record<string, unknown> => ({
  contextId: match.contextId,
  context: {
    contextId: match.context.contextId,
    owner: match.context.owner,
    content: truncateAttentionDetail(match.context.content, 1_600),
    contentFormat: match.context.contentFormat,
    headCommitId: match.context.headCommitId,
    createdAt: match.context.createdAt,
    updatedAt: match.context.updatedAt,
  },
  recentCommits: match.recentCommits.map(projectAttentionCommitForPrompt),
});

const collapseSingleAttentionValue = <T>(items: readonly T[]): T | T[] => (items.length === 1 ? items[0]! : [...items]);

const serializeFocusedAttentionContext = (match: AttentionActiveContextMatch): string =>
  mdFence("yaml+focused-attention-context", toYaml(projectAttentionActiveContextForPrompt(match)));

const serializeFocusedAttentionContexts = (matches: readonly AttentionActiveContextMatch[]): string =>
  mdFence(
    "yaml+focused-attention-context",
    toYaml(collapseSingleAttentionValue(matches.map((match) => projectAttentionActiveContextForPrompt(match)))),
  );

const serializeFocusedAttentionContextBody = (match: AttentionActiveContextMatch): string =>
  ["## AttentionContext.focused", "", serializeFocusedAttentionContext(match)].join("\n");

const serializeBackgroundAttentionContext = (match: AttentionActiveContextMatch): string =>
  mdFence("yaml+background-attention-context", toYaml(projectBackgroundAttentionContextForModel(match)));

const serializeBackgroundAttentionContexts = (matches: readonly AttentionActiveContextMatch[]): string =>
  mdFence(
    "yaml+background-attention-context",
    toYaml(collapseSingleAttentionValue(matches.map((match) => projectBackgroundAttentionContextForModel(match)))),
  );

const serializeBackgroundAttentionContextBody = (match: AttentionActiveContextMatch): string =>
  ["## AttentionContext.background", "", serializeBackgroundAttentionContext(match)].join("\n");

const serializeMutedAttentionContextList = (matches: readonly AttentionActiveContextMatch[]): string =>
  mdFence(
    "yaml+muted-attention-context-list",
    toYaml(
      matches.map((match) => ({
        contextId: match.contextId,
        updatedAt: match.context.updatedAt,
        headCommitId: match.context.headCommitId,
      })),
    ),
  );

const modelMessageContentToText = (content: TextOnlyModelMessage["content"]): string => {
  if (content === null || content === undefined) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content
    .map((part) => (part.type === "text" ? part.content : ""))
    .filter((part) => part.length > 0)
    .join("\n");
};

const yamlScalar = (input: unknown): string => {
  if (input === null || input === undefined) {
    return "null";
  }
  if (typeof input === "boolean" || typeof input === "number") {
    return String(input);
  }
  const text = String(input);
  if (/^[a-zA-Z0-9._/-]+$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
};

const toYaml = (value: unknown, indent = 0): string => {
  const padding = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${padding}[]`;
    }
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          return `${padding}-\n${toYaml(item, indent + 2)}`;
        }
        return `${padding}- ${yamlScalar(item)}`;
      })
      .join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return `${padding}{}`;
    }
    return entries
      .map(([key, child]) => {
        if (child !== null && typeof child === "object") {
          return `${padding}${key}:\n${toYaml(child, indent + 2)}`;
        }
        return `${padding}${key}: ${yamlScalar(child)}`;
      })
      .join("\n");
  }
  return `${padding}${yamlScalar(value)}`;
};

const mdFence = (lang: string, content: string): string => `\`\`\`${lang}\n${content.replace(/\u0000/g, "")}\n\`\`\``;

const buildToolInvocationMarkdown = (invocation: {
  invocationId: string;
  name: string;
  status: "waiting" | "running" | "success" | "failed" | "cancelled";
  startedAt: number;
  finishedAt?: number;
  call?: unknown;
  result?: unknown;
  error?: string;
}): string =>
  mdFence(
    "yaml",
    toYaml({
      invocationId: invocation.invocationId,
      tool: invocation.name,
      status: invocation.status,
      startedAt: new Date(invocation.startedAt).toISOString(),
      finishedAt: invocation.finishedAt ? new Date(invocation.finishedAt).toISOString() : null,
      call: invocation.call ?? null,
      result: invocation.result ?? null,
      error: invocation.error ?? null,
    }),
  );

const listMarkdownFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listMarkdownFiles(full)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(full);
      }
    }
    return files;
  } catch {
    return [];
  }
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

type LoopInputKind = "user" | "terminal" | "task" | "attention";
const IGNORE_WAIT = Symbol("ignore-wait");
const DEFAULT_MAX_FOCUSED_ROOM_COUNT = 3;
const DEFAULT_MAX_BATCH_READ_ROOM_MESSAGE_COUNT = 20;

const MESSAGE_SRC_NAMESPACE = ROOM_ATTENTION_NAMESPACE;
const TERMINAL_SRC_NAMESPACE = TERMINAL_ATTENTION_NAMESPACE;
const TASK_SRC_NAMESPACE = TASK_ATTENTION_NAMESPACE;

type RuntimeSourceKind = "message" | "terminal" | "task" | "unknown";
type LifecycleBridgeId = "message" | "terminal";

type MessageSourceParts = {
  chatId: string;
  messageId: number;
};

type TerminalSourceParts = TerminalAttentionSrc;

const formatMessageSourceSrc = (input: MessageSourceParts): LoopMessageSourceRef["src"] =>
  formatRoomAttentionSrc({ roomId: input.chatId, entryId: input.messageId });

const parseMessageSourceSrc = (src: string): MessageSourceParts | null => {
  const parsed = parseRoomAttentionSrc(src);
  if (!parsed?.entryId) {
    return null;
  }
  const messageId = Number(parsed.entryId);
  return Number.isInteger(messageId) && messageId > 0
    ? {
        chatId: parsed.roomId,
        messageId,
      }
    : null;
};

const formatTerminalSourceSrc = (input: TerminalSourceParts): LoopTerminalSourceRef["src"] =>
  formatTerminalAttentionSrc(input);

const parseTerminalSourceSrc = (src: string): TerminalSourceParts | null => parseTerminalAttentionSrc(src);

const formatTaskSourceSrc = (subjectId: string): LoopTaskSourceRef["src"] => formatTaskAttentionSrc(subjectId);

const parseTaskSourceSrc = (src: string): string | null => parseTaskAttentionSrc(src);

const resolveRuntimeSourceKind = (src: string | undefined): RuntimeSourceKind => {
  if (!src) {
    return "unknown";
  }
  if (parseMessageSourceSrc(src)) {
    return "message";
  }
  if (parseTerminalSourceSrc(src)) {
    return "terminal";
  }
  if (parseTaskSourceSrc(src)) {
    return "task";
  }
  return "unknown";
};

const resolveLifecycleBridgeId = (src: string): LifecycleBridgeId => {
  const namespace = appAttentionSourceRegistry.resolve(src)?.namespace;
  if (namespace === ROOM_ATTENTION_NAMESPACE || namespace === MESSAGE_ATTENTION_NAMESPACE) {
    return "message";
  }
  if (namespace === TERMINAL_ATTENTION_NAMESPACE) {
    return "terminal";
  }
  throw new Error(`unsupported lifecycle attention src: ${src}`);
};

const buildLifecycleAttentionDetail = (
  src: string,
  bridgeId: LifecycleBridgeId,
  event: string,
  payload?: Record<string, unknown>,
): string => {
  const roomSource = parseRoomAttentionSrc(src);
  if (roomSource) {
    return toYaml({
      event,
      bridgeId,
      src,
      chatId: roomSource.roomId,
      messageId: roomSource.entryId ?? null,
      ...payload,
    });
  }
  const messageSource = parseMessageAttentionSrc(src);
  if (messageSource) {
    return toYaml({
      event,
      bridgeId,
      src,
      chatId: messageSource.chatId,
      messageId: messageSource.messageId ?? null,
      ...payload,
    });
  }
  const terminalSource = parseTerminalAttentionSrc(src);
  if (terminalSource) {
    return toYaml({
      event,
      bridgeId,
      src,
      terminalId: terminalSource.terminalId,
      eventId: terminalSource.eventId ?? null,
      ...payload,
    });
  }
  return toYaml({
    event,
    bridgeId,
    src,
    ...payload,
  });
};

const cloneMessageAttachmentFacts = (message: MessageRecord): ChatSessionAsset[] =>
  message.attachments?.map((attachment) => ({
    assetId: attachment.assetId,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: attachment.url,
  })) ?? [];

const buildMessageFactEnvelope = (input: {
  message: MessageRecord;
  chatTitle: string;
  chatKind: string;
  contextId: string;
  focused: boolean;
  attachments?: ChatSessionAsset[];
}): string => {
  const { message } = input;
  const messageFact = {
    room: {
      chatId: message.chatId,
      title: input.chatTitle,
      kind: input.chatKind,
      contextId: input.contextId,
      focused: input.focused,
    },
    message: {
      messageId: message.messageId,
      ref: message.ref ?? null,
      senderContactId: message.senderContactId ?? null,
      senderLabel: message.from,
      kind: message.kind,
      createdAt: new Date(message.createdAt).toISOString(),
      updatedAt: new Date(message.updatedAt).toISOString(),
      visibleAt: typeof message.visibleAt === "number" ? new Date(message.visibleAt).toISOString() : null,
      sourceRef: formatMessageSourceSrc({
        chatId: message.chatId,
        messageId: message.messageId,
      }),
    },
  };
  const attachmentFacts =
    (input.attachments ?? []).length === 0
      ? []
      : [
          "attachments:",
          ...(input.attachments ?? []).map(
            (attachment) =>
              `- ${attachment.kind}: ${attachment.name} (${attachment.mimeType}, ${attachment.sizeBytes} bytes)`,
          ),
        ];
  return [mdFence("yaml", toYaml(messageFact)), message.content, ...attachmentFacts].join("\n\n");
};

const stableAttentionDraftDigest = (draft: AttentionDraft): string => {
  const semanticHint =
    typeof draft.semanticHash === "string"
      ? draft.semanticHash
      : typeof draft.versionHint === "string"
        ? draft.versionHint
        : JSON.stringify({
            content: draft.content,
            presentation: draft.presentation ?? null,
            provenance: draft.provenance ?? null,
            contextMutation: draft.contextMutation ?? "preserve",
          });
  return `${draft.sourceRef.src}:${semanticHint}`;
};

const buildAttentionScoreSubjectSeed = (draft: AttentionDraft): string => `subject:${draft.sourceRef.src}`;

const buildAttentionScoreSemanticSeed = (draft: AttentionDraft): string | null => {
  const semanticHash = typeof draft.semanticHash === "string" ? draft.semanticHash.trim() : "";
  if (semanticHash.length === 0) {
    return null;
  }
  return `semantic:${semanticHash}`;
};

const buildAttentionScoreDigest = (seed: string): string => createHash("sha256").update(seed).digest("hex");

class LoopInputSignal {
  private version = 0;
  private listeners = new Set<() => void>();

  notify(): number {
    this.version += 1;
    for (const listener of [...this.listeners]) {
      listener();
    }
    this.listeners.clear();
    return this.version;
  }

  current(): number {
    return this.version;
  }

  waitAfter(afterVersion: number): { promise: Promise<number>; cancel: () => void } {
    if (this.version > afterVersion) {
      return {
        promise: Promise.resolve(this.version),
        cancel: () => {},
      };
    }

    let settled = false;
    let resolveRef: ((value: number) => void) | null = null;
    const promise = new Promise<number>((resolve) => {
      resolveRef = resolve;
    });
    const onSignal = () => {
      if (settled) {
        return;
      }
      settled = true;
      this.listeners.delete(onSignal);
      resolveRef?.(this.version);
    };
    this.listeners.add(onSignal);
    return {
      promise,
      cancel: () => {
        if (settled) {
          return;
        }
        settled = true;
        this.listeners.delete(onSignal);
      },
    };
  }

  shutdown(): void {
    this.notify();
  }
}

const ATTENTION_RUNTIME_HISTORY_LIMIT = 200;

const toAttentionContextRef = (contextId: string): AttentionContextRef => ({
  contextId,
});

const toAttentionCommitRef = (contextId: string, commitId: string): AttentionCommitRef => ({
  contextId,
  commitId,
});

const sameAttentionCommitRef = (left: AttentionCommitRef, right: AttentionCommitRef): boolean =>
  left.contextId === right.contextId && left.commitId === right.commitId;

const dedupeAttentionCommitRefs = (refs: AttentionCommitRef[]): AttentionCommitRef[] => {
  const deduped: AttentionCommitRef[] = [];
  for (const ref of refs) {
    if (deduped.some((candidate) => sameAttentionCommitRef(candidate, ref))) {
      continue;
    }
    deduped.push({ ...ref });
  }
  return deduped;
};

const mergeTraceRefs = (...groups: Array<SessionTraceRef[] | undefined>): SessionTraceRef[] => {
  const deduped = new Map<string, SessionTraceRef>();
  for (const group of groups) {
    for (const ref of group ?? []) {
      deduped.set(`${ref.kind}:${ref.ref}`, {
        ...ref,
        attributes: ref.attributes ? { ...ref.attributes } : undefined,
      });
    }
  }
  return [...deduped.values()];
};

const cloneAttentionCycleFrame = (frame: AttentionCycleFrame): AttentionCycleFrame => ({
  ...frame,
  protocolMode: frame.protocolMode ?? "none",
  inputCommitRefs: (frame.inputCommitRefs ?? []).map((ref) => ({ ...ref })),
  inputContextIds: [...frame.inputContextIds],
  activeContextIds: [...frame.activeContextIds],
  producedCommitRefs: frame.producedCommitRefs.map((ref) => ({ ...ref })),
  modelCallIds: [...frame.modelCallIds],
  hookIds: [...frame.hookIds],
});

const cloneAttentionHookRecord = (record: AttentionHookRecord): AttentionHookRecord => ({
  ...record,
  target: record.target ? { ...record.target } : undefined,
  output: record.output ? { ...record.output } : undefined,
});

const cloneAttentionDeliveryProjection = (projection: AttentionDeliveryProjection): AttentionDeliveryProjection => ({
  ...projection,
  latestError: projection.latestError ? { ...projection.latestError } : null,
});

const cloneAttentionDispatchRecord = (dispatch: AttentionDispatchRecord): AttentionDispatchRecord => ({
  ...dispatch,
});

const cloneAttentionReceiptRecord = (receipt: AttentionReceiptRecord): AttentionReceiptRecord => ({
  ...receipt,
  usage: receipt.usage ? { ...receipt.usage } : undefined,
  meta: receipt.meta ? structuredClone(receipt.meta) : undefined,
});

const cloneEffectLedgerRecord = (record: SessionEffectLedgerRecord): SessionEffectLedgerRecord => ({
  ...record,
  meta: record.meta ? structuredClone(record.meta) : undefined,
});

const projectRuntimeTerminalCreateAck = (terminal: RuntimeTerminalView): RuntimeTerminalCreateAckView => {
  return {
    ...terminal,
  };
};

export interface SessionRuntimeAttentionState {
  snapshot: AttentionSystemSnapshot;
  active: AttentionActiveContextMatch[];
  cycleFrames: AttentionCycleFrame[];
  hooks: AttentionHookRecord[];
}

export interface SessionRuntimeAttentionDeliveryState {
  projections: AttentionDeliveryProjection[];
  dispatches: AttentionDispatchRecord[];
  receipts: AttentionReceiptRecord[];
  // Legacy generic runtime watches are no longer session-runtime owned for
  // message follow-up. Keep the field temporarily as an empty compatibility
  // projection until Studio migrates to dedicated follow-up task diagnostics.
  watches: SessionRuntimeWatchRecord[];
  effects: SessionEffectLedgerRecord[];
}

export interface SessionRuntimeAttentionApiSurface {
  baseUrl: string;
  principalId: string;
  managedSeatAuthorityUrl?: string | null;
}

type ManagedSeatAuthorityEndpoint = {
  authorityUrl: string;
  trpcPath?: string;
  acceptPath?: string;
};

type RemoteMessageSeatAccess = {
  chatId: string;
  accessToken: string;
  accessRole: MessageChannelAccessProjection["accessRole"];
  endpoint: ManagedSeatAuthorityEndpoint;
};

type RemoteTerminalSeatAccess = {
  terminalId: string;
  accessToken: string;
  accessRole: TerminalAccessProjection["role"];
  endpoint: ManagedSeatAuthorityEndpoint;
};

type RuntimeTerminalManageInviteResult = {
  invitation: TerminalInvitationRecord;
};

type RuntimeTerminalManageAcceptResult = {
  invitation: TerminalInvitationRecord;
  access: TerminalAccessProjection;
  seat?: TerminalSeatProjection;
};

type RuntimeTerminalManageConfigResult = {
  result: TerminalInvitationRecord | TerminalAccessProjection;
};

type RuntimeTerminalManageRevokeResult = {
  result: { ok: true };
};

type RuntimeMessageManageInviteResult = {
  invitation: MessageInvitationRecord;
};

type RuntimeMessageManageAcceptResult = {
  invitation: MessageInvitationRecord;
  access: MessageChannelAccessProjection;
  seat?: MessageSeatStateProjection;
};

type RuntimeMessageManageConfigResult = {
  result: MessageInvitationRecord | MessageChannelAccessProjection;
};

type RuntimeMessageManageRevokeResult = {
  result: { ok: true };
};

interface SessionRuntimeWorkspaceAuthority {
  mount: WorkspaceMountRecord;
  workspaceRoot: string;
  grants: WorkspaceGrantRecord[];
  defaultCwd: string;
}

export type ModelCallDeltaKind = "assistant_draft" | "tool_call" | "tool_result" | "run_finished";

export interface SessionModelCallDeltaRecord {
  id: number;
  seq: number;
  modelCallId: number;
  cycleId: number;
  timestamp: number;
  kind: ModelCallDeltaKind;
  data: unknown;
}

export interface RuntimeEventMap {
  phase: { phase: LoopBusPhase };
  stage: { stage: TaskStage };
  stats: AgentRuntimeStats;
  chat: ChatMessage;
  terminalSnapshot: { terminalId: string; snapshot: ManagedTerminalSnapshot };
  terminalRead: { terminalId: string; result: ControlPlaneTerminalReadResult };
  terminalStatus: {
    terminalId: string;
    processPhase: "not_started" | "running" | "killed";
    lifecycleTransition: "bootstrapping" | "killing" | null;
    status: "IDLE" | "BUSY";
  };
  focusedTerminal: { terminalIds: string[]; terminalId: string | null };
  taskUpdated: { task: TaskView };
  taskDeleted: { key: string };
  taskTriggered: { topic: string; source: "api" | "file" | "scheduler" | "tool"; affected: TaskView[] };
  taskSourceChanged: {
    sourceName: string;
    sourcePath: string;
    file: string;
    source: "boot" | "watch";
    markdown: string;
  };
  schedulerSnapshot: { snapshot: LoopBusKernelSnapshot };
  schedulerLog: { entry: SessionDbLoopbusStateLogRecord };
  observabilityTrace: { entry: SessionDbLoopbusTraceRecord };
  schedulerSignal: { kind: LoopInputKind; version: number; timestamp: number };
  heartbeatPart: { entry: SessionMessageRecord };
  modelCall: { entry: SessionModelCallRecord };
  modelCallDelta: { entry: SessionModelCallDeltaRecord };
  attentionDeliveryUpdated: SessionRuntimeAttentionDeliveryState;
  attentionDispatch: {
    reason: "created" | "bound";
    commitRef: DeliveryCommitRefRecord;
    dispatch: AttentionDispatchRecord;
    projection: AttentionDeliveryProjection | null;
  };
  attentionReceipt: {
    commitRef: DeliveryCommitRefRecord;
    dispatch: AttentionDispatchRecord;
    receipt: AttentionReceiptRecord;
    projection: AttentionDeliveryProjection | null;
  };
  apiCall: { entry: SessionDbApiCallRecord };
  apiRecording: { enabled: boolean; refCount: number };
  cycleUpdated: { cycle: ChatCycle | null };
  attentionUpdated: SessionRuntimeAttentionState;
  error: { message: string };
}

export type RuntimeEvent<TType extends keyof RuntimeEventMap = keyof RuntimeEventMap> = {
  [K in TType]: {
    type: K;
    timestamp: number;
    payload: RuntimeEventMap[K];
  };
}[TType];

export interface SessionRuntimeSnapshot {
  sessionId: string;
  started: boolean;
  activityState: "idle" | "active";
  schedulerPhase: LoopBusPhase;
  stage: TaskStage;
  focusedTerminalId: string;
  focusedTerminalIds: string[];
  chatMessages: ChatMessage[];
  messageChannels?: MessageControlPlaneEntry[];
  terminalSnapshots: Record<string, ManagedTerminalSnapshot>;
  terminalReads: Record<string, ControlPlaneTerminalReadResult>;
  terminals: Array<{
    terminalId: string;
    status: "IDLE" | "BUSY";
    processPhase: "not_started" | "running" | "killed";
    archivedAt?: number | null;
    lifecycleTransition: "bootstrapping" | "killing" | null;
    seq: number;
    launchCwd: string;
    icon?: string;
    configuredTitle?: string;
    currentTitle?: string;
    currentPath?: string;
    lastStopReason?: "killed" | "exited" | "startup_failed" | null;
    lastExitCode?: number | null;
    lastExitSignal?: string | null;
    lastStoppedAt?: number | null;
    shortcuts?: Record<string, string>;
    transportUrl?: string;
  }>;
  tasks: TaskView[];
  schedulerState: LoopBusKernelState | null;
  attention?: SessionRuntimeAttentionState;
  attentionDelivery: SessionRuntimeAttentionDeliveryState;
  schedulerSignals: Record<LoopInputKind, { version: number; timestamp: number | null }>;
  apiCallRecording: {
    enabled: boolean;
    refCount: number;
  };
  attentionApi: SessionRuntimeAttentionApiSurface | null;
  modelCapabilities: ModelCapabilities;
  activeCycle: ChatCycle | null;
}

export interface SessionRuntimeOptions {
  sessionId: string;
  cwd: string;
  workspacePath?: string;
  avatar?: string;
  avatarPrincipalId?: string;
  avatarPrivateKey?: string;
  homeDir?: string;
  rootWorkspacePath?: string;
  managedSeatAuthorityUrl?: string;
  usageAnalyticsRoot?: string;
  sessionRoot: string;
  sessionName: string;
  storeTarget: "global" | "workspace";
  messageSystem?: MessageControlPlane;
  messageContactId?: MessageContactId;
  terminalSystem: TerminalControlPlane;
  terminalActorId?: TerminalActorId;
  resolveRuntimeTerminalCwd?: (input: {
    sessionId: string;
    cwd?: string;
  }) =>
    | Promise<{ ok: true; cwd: string } | { ok: false; message: string }>
    | { ok: true; cwd: string }
    | { ok: false; message: string };
  listRuntimeWorkspaceAuthorities?: () => Array<SessionRuntimeWorkspaceAuthority>;
  setRuntimeWorkspaceAlias?: (input: {
    runtimeWorkspaceId: number;
    alias: string;
  }) => Promise<WorkspaceMountRecord | null> | WorkspaceMountRecord | null;
  allocateRoomId?: (input: { kind: MessageChannelKind; title?: string }) => Promise<string>;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

export interface SessionRuntimeModelDebug {
  config: {
    providerId: string;
    apiStandard: ResolvedSessionConfig["ai"]["apiStandard"];
    vendor?: string;
    profile?: string;
    extensions?: string[];
    model: string;
    baseUrl?: string;
    apiKey?: string;
    apiKeyEnv?: string;
    headers?: Record<string, string>;
    temperature: number;
    topK?: number;
    transportMaxRetries: number;
    maxToken?: number;
    maxContextTokens?: number;
    thinking?: {
      enabled?: boolean;
      budgetTokens?: number;
    };
    retryPolicy: ResolvedSessionConfig["loop"]["retryPolicy"];
    compactPolicy: ResolvedSessionConfig["loop"]["compactPolicy"];
    capabilities: ModelCapabilities;
  } | null;
  promptWindow: ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"];
  prompt: RuntimePromptState | null;
  stats: ReturnType<AgenterAI["inspectDebugState"]>["stats"] | null;
  latestModelCall: SessionModelCallRecord | null;
  recentModelCalls: SessionModelCallRecord[];
  recentApiCalls: SessionDbApiCallRecord[];
}

export class SessionRuntime {
  private readonly listeners: Array<(event: RuntimeEvent) => void> = [];
  private readonly terminalSnapshots: Record<string, ManagedTerminalSnapshot> = {};
  private readonly terminalReads: Record<string, ControlPlaneTerminalReadResult> = {};
  private readonly terminalReadCursorHashById: Record<string, string | null> = {};
  private readonly terminalLatestSeq: Record<string, number> = {};
  private readonly terminalViewFingerprint: Record<string, string> = {};
  private readonly terminalSemanticFingerprint: Record<string, string> = {};
  private readonly terminalStatusById = new Map<
    string,
    {
      processPhase: "not_started" | "running" | "killed";
      lifecycleTransition: "bootstrapping" | "killing" | null;
      status: "IDLE" | "BUSY";
    }
  >();
  private readonly taskEngine = new TaskEngine();
  private readonly taskSourceMtime = new Map<string, number>();
  private readonly taskAttentionDraftQueue: AttentionDraft[] = [];
  private readonly effectLedgerRecords = new Map<string, SessionEffectLedgerRecord>();
  private taskSources: TaskSourceResolved[] = [];

  private config: ResolvedSessionConfig | null = null;
  private settingsLayers: SettingsLayerSnapshot[] = [];
  private settingsEffective = "{}";
  private settingsEditor: SettingsEditor | null = null;
  private sessionStore: SessionStore | null = null;
  private sessionDb: SessionDb | null = null;
  private usageAnalyticsDb: UsageAnalyticsDb | null = null;
  private attentionSearchEngine: AttentionSearchEngine | null = null;
  private attentionStore: AttentionStore | null = null;
  private attentionHashAliasStore: AttentionHashAliasStore | null = null;
  private attentionSystem = new AttentionSystem();
  private attentionHashAliases = new AttentionHashAliasRegistry();
  private readonly messageSystem: MessageControlPlane;
  private readonly ownsMessageSystem: boolean;
  private readonly messageContactId: MessageContactId;
  private readonly terminalActorId: TerminalActorId;
  private readonly inboundMessageQueue: LoopBusInput[] = [];
  private readonly runtimeKernelHost: RuntimeKernelHost;
  private readonly messageKernelAdapter: RuntimeMessageKernelAdapter;
  private readonly terminalKernelAdapter: RuntimeTerminalKernelAdapter;
  private readonly skillKernelAdapter: RuntimeSkillKernelAdapter;
  private readonly messageSystemCleanup: Array<() => void> = [];
  private followUpSinkCleanup: (() => void) | null = null;
  private readonly terminalSystemCleanup: Array<() => void> = [];
  private readonly killedTerminalWorkById = new Map<string, Promise<void>>();
  private agent: AgenterAI | null = null;
  private promptStore: FilePromptStore | null = null;
  private runtimeLocalApi: RuntimeLocalApiHandle | null = null;
  private mcpSystem: McpSystem | null = null;
  private runtimeSkillSystem: RuntimeSkillSystem | null = null;
  private rootWorkspaceShellWorld: RootWorkspaceShellWorld | null = null;
  private readonly terminalControlPlane: TerminalControlPlane;
  private terminals = new Map<string, TerminalRuntime>();
  private runtime: AgentRuntime | null = null;
  private started = false;
  private abortWakeRequested = false;
  private loopSuspension: "fresh" | "active" | "paused" | "stopped" = "fresh";
  private loopPhase: LoopBusPhase = "waiting_commits";
  private stage: TaskStage = "idle";
  private readonly taskHeartbeatIntervalMs = 30_000;
  private lastTaskHeartbeatAt = 0;
  private lastTaskHeartbeatDigest = "";
  private focusedTerminalIds: string[] = [];
  private chatMessages: ChatMessage[] = [];
  private activeCycle: ChatCycle | null = null;
  private readonly cycleRecords: RuntimeCycleRecord[] = [];
  private loopKernelSnapshot: LoopBusKernelSnapshot | null = null;
  private activeCycleId: number | null = null;
  private activeModelCallId: number | null = null;
  private activeAgentCallId: string | null = null;
  private activeModelResponseDraft: {
    assistant?: {
      thinking?: string;
      text?: string;
      finishReason?: string | null;
    };
    assistantSegments: HeartbeatAssistantResponseSegment[];
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    toolTrace: Array<{
      invocationId: string;
      tool: string;
      input: unknown;
      output?: unknown;
      error?: string;
      startedAt: number;
      finishedAt: number;
    }>;
  } | null = null;
  private modelCallDeltaSeq = 0;
  private cycleSeq = 0;
  private loopStateLogSeq = 0;
  private loopTraceSeq = 0;
  private terminalActivitySeq = 0;
  private readonly pendingTraceSpans: PendingTraceSpan[] = [];
  private readonly traceRowIdBySpanId = new Map<string, number>();
  private readonly runningTraceRowsByName = new Map<string, SessionDbLoopbusTraceRecord>();
  private readonly loopStateLogEntries: SessionDbLoopbusStateLogRecord[] = [];
  private readonly loopTraceEntries: SessionDbLoopbusTraceRecord[] = [];
  private readonly terminalActivityByTerminalId = new Map<string, SessionDbTerminalActivityRecord[]>();
  private readonly cycleReplyChatIds = new Map<number, string>();
  private readonly deliveredRuntimeDispatchChatIds = new Map<number, Set<string>>();
  private readonly deliveryDispatchIdsByAgentCallAttempt = new Map<string, Map<number, string[]>>();
  private pendingCompactRequest: PendingCompactRequest | null = null;
  private abortingActiveCycle = false;
  private loopKernelVersion = 0;
  private apiCallRecordingRefCount = 0;
  private readonly inputSignals: Record<LoopInputKind, LoopInputSignal> = {
    user: new LoopInputSignal(),
    terminal: new LoopInputSignal(),
    task: new LoopInputSignal(),
    attention: new LoopInputSignal(),
  };
  private inputSignalCursor: Record<LoopInputKind, number> = {
    user: 0,
    terminal: 0,
    task: 0,
    attention: 0,
  };
  private attentionFactsVersion = 0;
  private attentionFactsSentVersion = 0;
  private attentionDebtBackoffMs = ATTENTION_DEBT_INITIAL_BACKOFF_MS;
  private attentionDebtNextWakeAt: number | null = null;
  private attentionForceCollect = false;
  private readonly attentionContextSnapshot = new Map<string, AttentionVisibleSnapshot>();
  private readonly stagedAttentionItemsByContext = new Map<string, Map<string, StagedAttentionItemEntry>>();
  private readonly pendingAttentionMessagePlans = new Map<string, PendingAttentionMessagePlan>();
  private attentionBoundaryRefreshPending = false;
  private readonly dirtyAttentionContextIds = new Set<string>();
  private readonly dirtyAttentionCommitIdsByContext = new Map<string, Set<string>>();
  private readonly dirtyAttentionContextOrder = new Map<string, number>();
  private nextAttentionDirtyOrder = 0;
  private readonly attentionSourceDigests = new Map<string, string>();
  private readonly attentionCycleFrames = new Map<number, AttentionCycleFrame>();
  private recentAttentionHooks: AttentionHookRecord[] = [];
  private loopKernelLastWakeCause: string | null = null;
  private inputSignalVersion: Record<LoopInputKind, number> = {
    user: 0,
    terminal: 0,
    task: 0,
    attention: 0,
  };
  private inputSignalAt: Record<LoopInputKind, number | null> = {
    user: null,
    terminal: null,
    task: null,
    attention: null,
  };
  private readonly attentionContainment = new Map<string, AttentionContainmentEntry>();
  private lastAttentionProgressAt: number | null = null;
  private loopPluginRuntime: LoopBusPluginRuntime | null = null;

  constructor(private readonly options: SessionRuntimeOptions) {
    this.messageContactId = options.messageContactId ?? resolveSessionRoomActorId(options.sessionId);
    this.terminalActorId = options.terminalActorId ?? (resolveSessionRoomActorId(options.sessionId) as TerminalActorId);
    this.terminalControlPlane = options.terminalSystem;
    if (options.messageSystem) {
      this.messageSystem = options.messageSystem;
      this.ownsMessageSystem = false;
    } else {
      this.messageSystem = new MessageControlPlane({
        dbPath: resolveMessageControlDbPath(join(options.sessionRoot, "message-system")),
        initialConfig: {
          defaultOwner: DEFAULT_CHAT_OWNER,
          transport: {
            port: 0,
          },
        },
      });
      this.ownsMessageSystem = true;
    }
    this.runtimeKernelHost = new RuntimeKernelHost({
      commitIngress: async (envelope, input) =>
        await this.commitRuntimeSystemIngress(envelope, {
          notifyLoop: input.notifyLoop,
        }),
      getAttentionCommit: (input) =>
        this.attentionSystem.getContext(input.contextId)?.getCommit(input.commitId) ?? null,
      getAttentionContextState: (contextId) => this.attentionSystem.getContext(contextId)?.getState() ?? null,
      notifyAttentionDispatched: async (input) => await this.notifyAttentionDispatchedHooks(input),
      notifyAttentionReceipt: async (input) => await this.notifyAttentionReceiptHooks(input),
      recordAttentionHook: (contextId, commitId, result) => {
        this.recordAttentionHook(contextId, commitId, result);
      },
      recordDispatch: (dispatch) => {
        this.recordAttentionDispatch(dispatch);
      },
      recordReceipt: (receipt) => {
        this.recordAttentionReceipt(receipt);
      },
      publishAttentionDispatch: ({ reason, commitRef, dispatch, projection }) => {
        this.publishAttentionDispatch({ reason, commitRef, dispatch, projection });
      },
      publishAttentionReceipt: ({ commitRef, dispatch, receipt, projection }) => {
        this.publishAttentionReceipt({ commitRef, dispatch, receipt, projection });
      },
      signalIngress: () => {
        this.notifyInput("attention");
      },
      onAdapterError: ({ adapterName, phase, error }) => {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("error", {
          message: `${adapterName} adapter ${phase} failed: ${message}`,
        });
      },
    });
    this.messageKernelAdapter = new RuntimeMessageKernelAdapter({
      messageSystem: this.messageSystem,
      messageContactId: this.messageContactId,
      isLoopPaused: () => this.isLoopPaused(),
      getMaxFocusedRoomCount: () => this.getMaxFocusedRoomCount(),
      getMaxBatchReadRoomMessageCount: () => this.getMaxBatchReadRoomMessageCount(),
      getActorRoom: (chatId, input) => this.getActorRoom(chatId, input),
      isUnreadInboundMessage: (message) => this.isUnreadInboundMessage(message),
      buildMessageIngressEnvelope: ({ message, channel }) => this.buildMessageSystemIngressEnvelope(message, channel),
      onCompactMessage: (message) => {
        this.inboundMessageQueue.push(this.toLoopInputFromMessage(message));
      },
      queueCompactCycle: (trigger) => {
        this.queueCompactCycle(trigger);
      },
      onError: (message) => {
        this.emit("error", { message });
      },
    });
    this.terminalKernelAdapter = new RuntimeTerminalKernelAdapter({
      isLoopPaused: () => this.isLoopPaused(),
      listFocusedTerminalIds: () => this.focusedTerminalIds,
      isTerminalRunning: (terminalId) => this.terminals.get(terminalId)?.isRunning() ?? false,
      getTerminalStatus: (terminalId) => this.terminalStatusById.get(terminalId)?.status ?? null,
      getTerminalHeadHash: async (terminalId) => await this.getTerminalHeadHash(terminalId),
      getTerminalReadCursorHash: (terminalId) => this.getTerminalReadCursorHash(terminalId),
      getTerminalCommitWaitHash: (terminalId) => this.getTerminalCommitWaitHash(terminalId),
      waitTerminalCommitted: (terminalId, input) => this.waitTerminalCommitted(terminalId, input),
      getTerminalContextId: (terminalId) =>
        terminalId === "control-plane"
          ? this.getTerminalControlPlaneAttentionContextId()
          : this.getTerminalAttentionContextId(terminalId),
      isTerminalActionable: (terminalId) => this.isTerminalActionable(terminalId),
      readTerminalIngress: async (terminalId, input) =>
        await this.buildTerminalSystemIngressEnvelope(terminalId, input),
      buildLifecycleIngressEnvelope: (input) =>
        this.buildLifecycleIngressEnvelope({
          system: "terminal",
          src: formatTerminalSourceSrc({ terminalId: input.terminalId }),
          contextId: input.contextId,
          event: input.event,
          summary: input.summary,
          payload: input.payload,
          score: input.score,
          ingressType: input.ingressType,
          boundaryChannel: input.boundaryChannel,
        }),
      onTerminalActionableSignal: () => {
        this.notifyInput("terminal");
      },
      onTerminalIdleBridgeError: (error) => {
        this.emit("error", {
          message: `terminal idle bridge failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    });
    this.skillKernelAdapter = new RuntimeSkillKernelAdapter();
    this.runtimeKernelHost.mountAdapter(this.messageKernelAdapter);
    this.runtimeKernelHost.mountAdapter(this.terminalKernelAdapter);
    this.runtimeKernelHost.mountAdapter(this.skillKernelAdapter);
    this.bindMessageSystem();
  }

  private getHomeDir(): string {
    return this.options.homeDir ?? homedir();
  }

  private getRootWorkspacePath(): string {
    return this.options.rootWorkspacePath ?? this.options.cwd;
  }

  private getCurrentWorkspacePath(): string {
    return this.options.workspacePath ?? this.options.cwd;
  }

  private resolveManagedSeatAuthorityEndpoint(input: {
    descriptorInput?: string;
    explicitAuthorityUrl?: string;
  }): ManagedSeatAuthorityEndpoint {
    if (input.explicitAuthorityUrl?.trim()) {
      return {
        authorityUrl: input.explicitAuthorityUrl.trim().replace(/\/+$/u, ""),
      };
    }
    if (input.descriptorInput) {
      const parsed = parseManagedInvitationDescriptorInput(input.descriptorInput);
      if (parsed.descriptor?.endpoint?.authorityUrl) {
        return {
          authorityUrl: parsed.descriptor.endpoint.authorityUrl.replace(/\/+$/u, ""),
          trpcPath: parsed.descriptor.endpoint.trpcPath,
          acceptPath: parsed.descriptor.endpoint.acceptPath,
        };
      }
    }
    if (this.options.managedSeatAuthorityUrl?.trim()) {
      return {
        authorityUrl: this.options.managedSeatAuthorityUrl.trim().replace(/\/+$/u, ""),
      };
    }
    throw new Error("managed seat authority url is unavailable");
  }

  private async postManagedSeatAuthority<TResult>(input: {
    authorityUrl: string;
    path: string;
    body: unknown;
  }): Promise<TResult> {
    const response = await fetch(`${input.authorityUrl}${input.path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input.body),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string } & Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      throw new Error(payload.error ?? `managed seat authority request failed: ${input.path}`);
    }
    return payload as TResult;
  }

  private resolveCurrentActorMessageAccessToken(chatId: string): string {
    const channel = this.getActorRoom(chatId, { includeArchived: true, touchPresence: false });
    if (!channel?.accessToken) {
      throw new Error(`runtime actor has no visible room access token for managed seat admin flow: ${chatId}`);
    }
    return channel.accessToken;
  }

  private resolveCurrentActorTerminalAccessToken(terminalId: string): string {
    const terminal = this.listRuntimeTerminals().find((entry) => entry.terminalId === terminalId);
    const accessToken = terminal?.access?.accessToken;
    if (!accessToken) {
      throw new Error(`runtime actor has no visible terminal access token for managed seat admin flow: ${terminalId}`);
    }
    return accessToken;
  }

  private getStoredSeatDocument() {
    return readAvatarSeatDocument(this.getCurrentWorkspacePath(), this.getAvatarName(), this.getHomeDir());
  }

  private resolveStoredMessageSeat(chatId: string): RemoteMessageSeatAccess | null {
    const seat = this.getStoredSeatDocument().messageSeats[chatId];
    if (!seat || seat.state !== "active" || !seat.endpoint?.authorityUrl) {
      return null;
    }
    return {
      chatId,
      accessToken: seat.accessToken,
      accessRole: seat.accessRole,
      endpoint: {
        authorityUrl: seat.endpoint.authorityUrl,
        trpcPath: seat.endpoint.trpcPath,
        acceptPath: seat.endpoint.acceptPath,
      },
    };
  }

  private resolveStoredTerminalSeat(terminalId: string): RemoteTerminalSeatAccess | null {
    const seat = this.getStoredSeatDocument().terminalSeats[terminalId];
    if (!seat || seat.state !== "active" || !seat.endpoint?.authorityUrl) {
      return null;
    }
    return {
      terminalId,
      accessToken: seat.accessToken,
      accessRole: seat.accessRole,
      endpoint: {
        authorityUrl: seat.endpoint.authorityUrl,
        trpcPath: seat.endpoint.trpcPath,
        acceptPath: seat.endpoint.acceptPath,
      },
    };
  }

  private async getRemoteJson<TResult>(input: {
    authorityUrl: string;
    path: string;
    accessToken?: string;
    signal?: AbortSignal;
  }): Promise<TResult> {
    const headers = new Headers();
    if (input.accessToken) {
      headers.set("authorization", `Bearer ${input.accessToken}`);
    }
    const response = await fetch(`${input.authorityUrl}${input.path}`, {
      method: "GET",
      headers,
      signal: input.signal,
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : `managed seat authority request failed (${response.status}): ${input.path} :: ${JSON.stringify(payload)}`,
      );
    }
    return payload as TResult;
  }

  private async postRemoteJson<TResult>(input: {
    authorityUrl: string;
    path: string;
    body: Record<string, unknown>;
    accessToken?: string;
    signal?: AbortSignal;
  }): Promise<TResult> {
    const headers = new Headers({
      "content-type": "application/json",
    });
    if (input.accessToken) {
      headers.set("authorization", `Bearer ${input.accessToken}`);
    }
    const response = await fetch(`${input.authorityUrl}${input.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(input.body),
      signal: input.signal,
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : `managed seat authority request failed (${response.status}): ${input.path} :: ${JSON.stringify(payload)}`,
      );
    }
    return payload as TResult;
  }

  private persistAcceptedMessageSeat(input: {
    chatId: string;
    accessToken: string;
    accessRole: MessageChannelAccessProjection["accessRole"];
    endpoint?: ManagedSeatAuthorityEndpoint;
  }): void {
    saveAvatarMessageSeatCredential({
      workspacePath: this.getCurrentWorkspacePath(),
      avatar: this.getAvatarName(),
      chatId: input.chatId,
      accessToken: input.accessToken,
      accessRole: input.accessRole,
      endpoint: input.endpoint,
      homeDir: this.getHomeDir(),
    });
  }

  private persistAcceptedTerminalSeat(input: {
    terminalId: string;
    accessToken: string;
    accessRole: TerminalAccessProjection["role"];
    endpoint?: ManagedSeatAuthorityEndpoint;
  }): void {
    saveAvatarTerminalSeatCredential({
      workspacePath: this.getCurrentWorkspacePath(),
      avatar: this.getAvatarName(),
      terminalId: input.terminalId,
      accessToken: input.accessToken,
      accessRole: input.accessRole,
      endpoint: input.endpoint,
      homeDir: this.getHomeDir(),
    });
  }

  private listWorkspaceAuthorities(): SessionRuntimeWorkspaceAuthority[] {
    return this.options.listRuntimeWorkspaceAuthorities?.() ?? [];
  }

  private listMountedWorkspaceAuthorities(): SessionRuntimeWorkspaceAuthority[] {
    return this.listWorkspaceAuthorities().filter((entry) => entry.mount.kind === "workspace");
  }

  private findMountedWorkspaceAuthority(runtimeWorkspaceId: number): SessionRuntimeWorkspaceAuthority | null {
    return (
      this.listMountedWorkspaceAuthorities().find((entry) => entry.mount.runtimeWorkspaceId === runtimeWorkspaceId) ??
      null
    );
  }

  private getRootWorkspaceSkillRoots(): string[] {
    const skillHomeRoots = this.getRuntimeSkillHomeRoots();
    if (skillHomeRoots.length > 0) {
      return listRuntimeSkillMountRoots({
        homeDir: this.getHomeDir(),
        skillHomeRoots,
        principalId: this.options.avatarPrincipalId,
      });
    }
    return listRuntimeSkillMountRoots({
      homeDir: this.getHomeDir(),
      rootWorkspacePath: this.getRootWorkspacePath(),
      principalId: this.options.avatarPrincipalId,
    });
  }

  private getRuntimeSkillHomeRoots(): string[] {
    const workspaceGroups = this.listWorkspaceAuthorities().map((authority) => ({
      pwd: authority.defaultCwd,
      avatarHome: parseEnvAvatarHome(authority.mount.env[AVATAR_HOME_ENV]),
    }));
    if (workspaceGroups.length === 0) {
      return [];
    }
    return deriveMultiWorkspaceSkillsHome({ workspaceGroups });
  }

  private getRootWorkspaceCapabilityEnv(): Record<string, string> {
    const avatarRoot = this.listWorkspaceAuthorities().find((authority) => authority.mount.kind === "avatar-root");
    return {
      [AVATAR_HOME_ENV]: avatarRoot?.mount.env[AVATAR_HOME_ENV] ?? "",
      [SKILLS_HOME_ENV]: serializeEnvSkillsHome(this.getRuntimeSkillHomeRoots()),
    };
  }

  private projectRootWorkspaceSystemClis(): SystemCliProjection[] {
    const avatarRoot = this.listWorkspaceAuthorities().find((authority) => authority.mount.kind === "avatar-root");
    return projectWorkspaceSystemClis({
      mountId: avatarRoot?.mount.mountId,
      runtimeId: this.options.sessionId,
      runtimeWorkspaceId: avatarRoot?.mount.runtimeWorkspaceId,
      workspacePath: avatarRoot?.mount.workspacePath ?? this.getRootWorkspacePath(),
      workspaceAlias: avatarRoot?.mount.alias ?? "root",
      defaultCwd: avatarRoot?.defaultCwd ?? this.getRootWorkspacePath(),
      env: this.getRootWorkspaceCapabilityEnv(),
    });
  }

  recomputeWorkspaceCliProjections(): void {
    this.rootWorkspaceShellWorld = null;
    if (!this.runtimeSkillSystem) {
      return;
    }
    const result = this.runtimeSkillSystem.refresh({ publishReminders: false });
    void this.handleRuntimeSkillRefreshResult(result, { notifyLoop: false }).catch((error) => {
      this.emit("error", {
        message: `runtime skill projection refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    });
  }

  private ensureRuntimeSkillSystem(): RuntimeSkillSystem {
    if (this.runtimeSkillSystem) {
      return this.runtimeSkillSystem;
    }
    this.runtimeSkillSystem = new RuntimeSkillSystem({
      owner: this.getAvatarName(),
      homeDir: this.getHomeDir(),
      rootWorkspacePath: this.getRootWorkspacePath(),
      resolveSkillHomeRoots: () => this.getRuntimeSkillHomeRoots(),
      principalId: this.options.avatarPrincipalId,
      fingerprintManifestPath: join(this.options.sessionRoot, "skill-system", "fingerprint-map.json"),
      listWorkspaceAuthorities: () =>
        this.listWorkspaceAuthorities().map((authority) => ({
          workspaceRoot: authority.workspaceRoot,
          defaultCwd: authority.defaultCwd,
          env: { ...authority.mount.env },
          grants: authority.grants,
        })),
      onIdleFlush: async (result) => {
        await this.handleRuntimeSkillRefreshResult(result, {
          notifyLoop: true,
        });
      },
    });
    return this.runtimeSkillSystem;
  }

  private ensureMcpSystem(): McpSystem {
    if (this.mcpSystem) {
      return this.mcpSystem;
    }
    this.mcpSystem = new McpSystem({
      dbPath: join(this.options.sessionRoot, "mcp-system", "mcp-system.sqlite"),
      rootWorkspacePath: this.getRootWorkspacePath(),
      runtimeEnvProvider: () => buildRootWorkspaceShellEnvironment({
        rootWorkspacePath: this.getRootWorkspacePath(),
        homeDir: this.getHomeDir(),
        apiBaseUrl: this.runtimeLocalApi?.baseUrl ?? "",
        managedSeatAuthorityUrl: this.options.managedSeatAuthorityUrl,
        privateKey: this.options.avatarPrivateKey ?? "",
        principalId: this.options.avatarPrincipalId,
        env: this.getRootWorkspaceCapabilityEnv(),
      }),
    });
    return this.mcpSystem;
  }

  mcpAdd(input: McpAddInput): ReturnType<McpSystem["add"]> {
    return this.ensureMcpSystem().add(input);
  }

  async mcpRemove(input: McpRemoveInput): Promise<Awaited<ReturnType<McpSystem["remove"]>>> {
    return await this.ensureMcpSystem().remove(input);
  }

  mcpEnable(input: McpProjectInput): ReturnType<McpSystem["enable"]> {
    return this.ensureMcpSystem().enable(input);
  }

  async mcpDisable(input: McpDisableInput): Promise<Awaited<ReturnType<McpSystem["disable"]>>> {
    return await this.ensureMcpSystem().disable(input);
  }

  mcpList(input: McpListInput): ReturnType<McpSystem["list"]> {
    return this.ensureMcpSystem().list(input);
  }

  mcpQuery(input: McpQueryInput): ReturnType<McpSystem["query"]> {
    return this.ensureMcpSystem().query(input);
  }

  async mcpStart(input: McpProjectInput): Promise<Awaited<ReturnType<McpSystem["start"]>>> {
    return await this.ensureMcpSystem().start(input);
  }

  async mcpStop(input: McpProjectInput): Promise<Awaited<ReturnType<McpSystem["stop"]>>> {
    return await this.ensureMcpSystem().stop(input);
  }

  async mcpRestart(input: McpProjectInput): Promise<Awaited<ReturnType<McpSystem["restart"]>>> {
    return await this.ensureMcpSystem().restart(input);
  }

  async mcpCall(input: McpCallInput, options: { signal?: AbortSignal } = {}): Promise<Awaited<ReturnType<McpSystem["call"]>>> {
    return await this.ensureMcpSystem().call(input, options);
  }

  private getAttentionContextMatch(contextId: string): AttentionActiveContextMatch | null {
    const context = this.attentionSystem.getContext(contextId);
    if (!context) {
      return null;
    }
    return {
      contextId,
      context: context.getState(),
      recentCommits: context.listRecentCommits(),
    };
  }

  private getRootWorkspaceMounts(): RootWorkspaceMountInput[] {
    const rootWorkspacePath = resolve(this.getRootWorkspacePath());
    const avatar = this.getAvatarName();
    const workspaceMounts = this.listMountedWorkspaceAuthorities().map(
      (authority) =>
        ({
          path: authority.mount.workspacePath,
          mode: "rw" as const,
          grants: authority.grants,
          hiddenPaths: listWorkspaceHiddenPrivatePaths({
            workspacePath: authority.mount.workspacePath,
            avatar,
          }),
        }) satisfies RootWorkspaceMountInput,
    );
    const authoritativeRoots = new Set<string>([
      rootWorkspacePath,
      ...workspaceMounts.map((mount) => resolve(mount.path)),
    ]);
    // Skill roots remain separate readonly mounts only when they add authority
    // outside the fixed root-workspace or already-mounted public workspaces.
    // This avoids nested mount conflicts and keeps the durable world topology
    // stable across skill refreshes.
    const skillMounts = this.getRootWorkspaceSkillRoots()
      .map((path) => resolve(path))
      .filter((path) => {
        for (const authorityPath of authoritativeRoots) {
          const rel = relative(authorityPath, path);
          if (rel === "" || (!rel.startsWith("..") && rel !== ".")) {
            return false;
          }
        }
        return true;
      })
      .map(
        (path) =>
          ({
            path,
            mode: "ro" as const,
          }) satisfies RootWorkspaceMountInput,
      );
    return [...workspaceMounts, ...skillMounts];
  }

  /**
   * Root-workspace is a durable shell world owned by the runtime. Public
   * workspaces and shared terminals deliberately keep separate collaboration
   * semantics instead of inheriting this root-exclusive env/CLI profile.
   */
  private getOrCreateRootWorkspaceShellWorld(): RootWorkspaceShellWorld {
    if (this.rootWorkspaceShellWorld) {
      return this.rootWorkspaceShellWorld;
    }
    if (!this.runtimeLocalApi || !this.options.avatarPrivateKey) {
      throw new Error("runtime local api unavailable");
    }
    this.rootWorkspaceShellWorld = createRootWorkspaceShellWorld({
      rootWorkspacePath: this.getRootWorkspacePath(),
      customCommands: [
        createRuntimeShellWhichCommand(this.getRootWorkspacePath()),
        ...createRuntimeShellCommands({
          baseUrl: this.runtimeLocalApi.baseUrl,
          privateKey: this.options.avatarPrivateKey,
          homeDir: this.getHomeDir(),
          rootWorkspacePath: this.getRootWorkspacePath(),
          principalId: this.options.avatarPrincipalId,
          cliProjections: this.projectRootWorkspaceSystemClis(),
        }),
      ],
    });
    return this.rootWorkspaceShellWorld;
  }

  private createMessageSourceRef(input: { chatId: string; messageId: number }): LoopMessageSourceRef {
    return {
      src: formatMessageSourceSrc(input),
      reason: "message-committed",
    };
  }

  private parseMessageSource(ref: LoopSourceRef): MessageSourceParts | null {
    return parseMessageSourceSrc(ref.src);
  }

  private getAvatarName(): string {
    return this.config?.avatar?.nickname ?? this.options.avatar ?? DEFAULT_CHAT_OWNER;
  }

  private listActorRooms(
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry[] {
    return this.messageSystem.listChannelsForContact(this.messageContactId, input);
  }

  private getActorRoom(
    chatId: string,
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry | undefined {
    return this.messageSystem.getChannelForContact(chatId, this.messageContactId, input);
  }

  private getDefaultAttentionContextId(chatId: string): string {
    return `ctx-${chatId}`;
  }

  private getTerminalAttentionContextId(terminalId: string): string {
    return `ctx-terminal-${terminalId}`;
  }

  private getTerminalControlPlaneAttentionContextId(): string {
    return "ctx-terminal-control-plane";
  }

  private ensureAttentionContext(
    contextId: string,
    focusState: AttentionFocusState = "focused",
  ): AttentionContextState {
    const existing = this.attentionSystem.getContext(contextId);
    if (existing) {
      return existing.getState();
    }
    return this.attentionSystem
      .createContext({
        contextId,
        owner: this.getAvatarName(),
        focusState,
      })
      .getState();
  }

  private resolveAttentionFocusState(contextId: string): AttentionFocusState {
    return this.attentionSystem.getContext(contextId)?.getState().focusState ?? "focused";
  }

  private isNotificationAttentionCommit(commit: AttentionCommit): boolean {
    return Array.isArray(commit.meta.tags) && commit.meta.tags.includes("notification");
  }

  private hasWakeableAttentionPayload(commit: AttentionCommit): boolean {
    if (this.isNotificationAttentionCommit(commit)) {
      return true;
    }
    return Object.values(commit.scores).some((score) => score > 0);
  }

  private resolveNotifyQuotaWindowMs(focusState: AttentionFocusState): number | null {
    if (focusState === "muted") {
      return NOTIFY_QUOTA_DEFAULTS.muted;
    }
    if (focusState === "background") {
      return NOTIFY_QUOTA_DEFAULTS.background;
    }
    return null;
  }

  private buildNotifyQuotaTarget(contextId: string, sourceId: string): string {
    return `${contextId}:${sourceId}`;
  }

  private listNotifyQuotaHistory(input: { quotaTarget: string; sentAfter?: number }): SessionNotifyQuotaRecord[] {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listNotifyQuotaRecords({
      quotaTarget: input.quotaTarget,
      sentAfter: input.sentAfter,
    });
  }

  private buildNotifyQuotaStatus(input: {
    contextId: string;
    focusState: AttentionFocusState;
    sourceId: string;
  }): RuntimeNotifyQuotaStatusView {
    const windowMs = this.resolveNotifyQuotaWindowMs(input.focusState);
    const quotaTarget = this.buildNotifyQuotaTarget(input.contextId, input.sourceId);
    const sentAfter = windowMs === null ? undefined : Date.now() - windowMs;
    const history = this.listNotifyQuotaHistory({
      quotaTarget,
      sentAfter,
    });
    const latest = history[0] ?? null;
    const nextAllowedAt = latest && windowMs !== null ? latest.sentAt + windowMs : null;
    const allowedNow = windowMs === null ? true : history.length === 0 || (nextAllowedAt ?? 0) <= Date.now();
    return {
      quotaTarget,
      focusState: input.focusState,
      effective: {
        windowKind: "period",
        windowMs,
      },
      remaining: {
        allowedNow,
        remainingSends: windowMs === null ? null : allowedNow ? 1 : 0,
        nextAllowedAt: allowedNow ? null : nextAllowedAt,
      },
      history: history.map((record) => ({
        notifyId: record.notifyId,
        contextId: record.contextId,
        commitId: record.commitId,
        sourceId: record.sourceId,
        sentAt: record.sentAt,
        windowMs: record.windowMs,
      })),
    };
  }

  private isWakeableAttentionIngress(contextId: string, commit: AttentionCommit): boolean {
    if (this.isNotificationAttentionCommit(commit)) {
      return true;
    }
    if (!this.hasWakeableAttentionPayload(commit)) {
      return false;
    }
    if (commit.ingressType === "commit") {
      return true;
    }
    return this.resolveAttentionFocusState(contextId) === "background";
  }

  private async applyAttentionFocusState(contextId: string, focusState: AttentionFocusState): Promise<void> {
    const before = this.ensureAttentionContext(contextId, focusState);
    if (before.focusState === focusState) {
      return;
    }
    const snapshot = this.attentionContextSnapshot.get(contextId);
    this.attentionSystem.setContextFocusState(contextId, focusState);
    await this.syncCompanionRoomArchiveProjection(contextId, focusState);
    this.attentionFactsVersion += 1;
    await this.persistAttentionSystem();
    this.emitAttentionState();
    if (focusState === "focused" && snapshot?.seededFocusState === "background") {
      this.markAttentionContextDirty(contextId);
      this.notifyInput("attention");
    }
    if (focusState !== "muted" && this.attentionSystem.listPushCommits(contextId).length > 0) {
      this.markAttentionContextDirty(contextId);
      this.notifyInput("attention");
    }
  }

  private resolveLifecycleAttentionScore(input: { bridgeId: LifecycleBridgeId; event: string }): number {
    void input;
    return PASSIVE_LIFECYCLE_ATTENTION_SCORE;
  }

  private summarizeTerminalControlPlanePatch(patch: TerminalControlPlaneConfigPatch): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    if (patch.defaults) {
      summary.defaults = patch.defaults;
    }
    if (patch.processProfiles) {
      summary.processProfileIds = Object.keys(patch.processProfiles);
    }
    if (patch.terminalProfiles) {
      summary.terminalProfileIds = Object.keys(patch.terminalProfiles);
    }
    if (patch.transport) {
      summary.transport = patch.transport;
    }
    return summary;
  }

  private recordTerminalFocusTransitions(input: {
    before: readonly string[];
    after: readonly string[];
    op: string;
  }): void {
    this.terminalKernelAdapter.recordFocusTransitions({
      before: input.before,
      after: input.after,
      op: input.op,
    });
  }

  private async updateTerminalControlPlaneConfig(
    patch: TerminalControlPlaneConfigPatch,
  ): Promise<TerminalControlPlaneConfig> {
    const updated = await this.requireTerminalControlPlane().setConfig(patch);
    await this.enqueueTerminalLifecycleAttentionCommit({
      terminalId: "control-plane",
      contextId: this.getTerminalControlPlaneAttentionContextId(),
      event: "terminal_config_update",
      summary: "Updated terminal control-plane config",
      payload: {
        patch: this.summarizeTerminalControlPlanePatch(patch),
      },
    });
    return updated;
  }

  private ensureAttentionContextForChannel(chatId: string): AttentionContextDescriptor {
    const actorChannel = this.getActorRoom(chatId, {
      includeArchived: true,
      touchPresence: false,
    });
    const channel = actorChannel ?? this.messageSystem.getChannel(chatId);
    const contextId = channel?.contextId ?? this.getDefaultAttentionContextId(chatId);
    const existing = this.attentionSystem.getContext(contextId);
    if (existing) {
      const state = existing.getState();
      return {
        contextId: state.contextId,
        owner: state.owner,
        headCommitId: state.headCommitId,
        unresolvedScoreCount: existing.unresolvedScoreCount(),
        updatedAt: state.updatedAt,
      };
    }
    const owner = channel?.owner ?? this.getAvatarName();
    const created = this.attentionSystem.createContext({
      contextId,
      owner,
      focusState: actorChannel
        ? actorChannel.focused
          ? "focused"
          : "background"
        : channel
          ? channel.focused
            ? "focused"
            : "background"
          : "background",
    });
    const state = created.getState();
    return {
      contextId: state.contextId,
      owner: state.owner,
      headCommitId: state.headCommitId,
      unresolvedScoreCount: created.unresolvedScoreCount(),
      updatedAt: state.updatedAt,
    };
  }

  private async resolveRuntimeTerminalCwd(input: {
    cwd?: string;
  }): Promise<{ ok: true; cwd: string } | { ok: false; message: string }> {
    const resolver = this.options.resolveRuntimeTerminalCwd;
    if (!resolver) {
      return {
        ok: false,
        message: "runtime terminal cwd resolution requires explicit workspace mount authority",
      };
    }
    return await resolver({
      sessionId: this.options.sessionId,
      cwd: input.cwd,
    });
  }

  private async allocateMessageChannelId(kind: MessageChannelKind, title?: string): Promise<string> {
    const allocated = await this.options.allocateRoomId?.({ kind, title });
    if (!allocated) {
      throw new Error("session runtime room allocation is unavailable");
    }
    return allocated;
  }

  private projectMessageChannelForAttention(channel: MessageControlPlaneEntry): Record<string, unknown> {
    return {
      chatId: channel.chatId,
      kind: channel.kind,
      title: channel.title,
      owner: channel.owner,
      contextId: channel.contextId ?? this.getDefaultAttentionContextId(channel.chatId),
      participants: channel.participants.map((participant) => ({
        id: participant.id,
        label: participant.label,
      })),
      metadata:
        channel.metadata && typeof channel.metadata === "object"
          ? ({ ...(channel.metadata as Record<string, unknown>) } satisfies Record<string, unknown>)
          : {},
      seatStates: channel.seatStates?.map((state) => ({
        contactId: state.contactId,
        label: state.label,
        role: state.role,
        currentAdmin: state.currentAdmin,
        online: state.online,
        focused: state.focused,
        invalidCredential: state.invalidCredential,
      })),
      presence: this.projectMessagePresenceSummary(channel),
      focused: channel.focused,
      archivedAt: channel.archivedAt ?? null,
      archivedBy: channel.archivedBy ?? null,
    };
  }

  private projectMessageChannelForTooling(channel: MessageControlPlaneEntry): RuntimeMessageChannelView {
    return projectRuntimeMessageChannel(channel);
  }

  private listMessageChannelsForTooling(input: { includeArchived?: boolean } = {}): RuntimeMessageChannelView[] {
    return this.listMessageChannels({ includeArchived: input.includeArchived }).map((channel) =>
      this.projectMessageChannelForTooling(channel),
    );
  }

  private getMessageChannelForTooling(input: {
    chatId: string;
    includeArchived?: boolean;
  }): RuntimeMessageChannelView | null {
    const channel =
      this.getActorRoom(input.chatId, {
        includeArchived: input.includeArchived ?? false,
      }) ??
      this.messageSystem.getChannel(input.chatId, {
        includeArchived: input.includeArchived ?? false,
      });
    return channel ? this.projectMessageChannelForTooling(channel) : null;
  }

  private async readMessageChannelForTooling(input: {
    chatId: string;
    limit?: number;
  }): Promise<RuntimeMessageSnapshotView> {
    const visibleRooms = this.listVisibleMessageRoomSummaries(input.chatId);
    const snapshot = await this.readMessageChannel(input);
    return projectRuntimeMessageSnapshot(snapshot, {
      visibleRooms,
      reachableParticipants: this.projectReachableMessageParticipants(visibleRooms),
      referencedItems: this.resolveReferencedRoomMessages(snapshot),
    });
  }

  private resolveReferencedRoomMessages(snapshot: MessageSnapshot): MessageRecord[] {
    const refs = [
      ...new Set(snapshot.items.map((item) => item.ref).filter((value): value is number => value !== undefined)),
    ];
    return refs
      .map((messageId) => this.messageSystem.getMessage(snapshot.channel.chatId, messageId))
      .filter((message): message is MessageRecord => message !== undefined);
  }

  private resolveMessageSeatLabel(input: { id: string; label?: string }): string {
    const label = input.label?.trim();
    return label && label.length > 0 ? label : input.id;
  }

  private listVisibleMessageRoomSummaries(currentChatId: string): Array<{
    chatId: string;
    title: string;
    participantLabels: string[];
    focused: boolean;
  }> {
    return this.listMessageChannels()
      .filter((channel) => channel.chatId !== currentChatId)
      .map((channel) => ({
        chatId: channel.chatId,
        title: channel.title,
        participantLabels: this.projectMessagePresenceSummary(channel).participantLabels,
        focused: channel.focused,
      }))
      .sort((left, right) => this.compareVisibleMessageRooms(left, right))
      .slice(0, 8);
  }

  private compareVisibleMessageRooms(
    left: RuntimeVisibleMessageRoomView,
    right: RuntimeVisibleMessageRoomView,
  ): number {
    if (left.focused !== right.focused) {
      return left.focused ? -1 : 1;
    }
    return left.title.localeCompare(right.title);
  }

  private projectReachableMessageContact(
    contact: MessageContactRecord,
    visibleRooms: RuntimeVisibleMessageRoomView[],
  ): RuntimeReachableParticipantView {
    const label = contact.label.trim() || contact.remoteContactId;
    const rooms = visibleRooms
      .filter(
        (room) =>
          room.chatId === contact.localDirectChatId ||
          room.participantLabels.some((participantLabel) => participantLabel.trim() === label),
      )
      .sort((left, right) => this.compareVisibleMessageRooms(left, right));
    return {
      kind: "contact",
      actorId: contact.remoteContactId,
      sourceId: contact.sourceId,
      label,
      rooms,
    };
  }

  private projectReachableMessageParticipants(
    visibleRooms: RuntimeVisibleMessageRoomView[],
  ): RuntimeReachableParticipantView[] {
    const contacts = this.messageSystem
      .listContacts(this.messageContactId)
      .map((contact) => this.projectReachableMessageContact(contact, visibleRooms));
    const coveredLabels = new Set(contacts.map((contact) => contact.label));
    const directory = new Map<string, RuntimeVisibleMessageRoomView[]>();
    for (const room of visibleRooms) {
      for (const label of room.participantLabels) {
        const normalizedLabel = label.trim();
        if (normalizedLabel.length === 0 || coveredLabels.has(normalizedLabel)) {
          continue;
        }
        const rooms = directory.get(normalizedLabel) ?? [];
        rooms.push(room);
        directory.set(normalizedLabel, rooms);
      }
    }
    const fallbacks = [...directory.entries()]
      .map(([label, rooms]) => ({
        kind: "room-label" as const,
        label,
        rooms: rooms.sort((left, right) => this.compareVisibleMessageRooms(left, right)),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
    return [...contacts, ...fallbacks].sort((left, right) => left.label.localeCompare(right.label));
  }

  private projectMessagePresenceSummary(channel: MessageControlPlaneEntry): {
    totalSeatCount: number;
    participantLabels: string[];
    onlineLabels: string[];
    offlineLabels: string[];
    focusedLabels: string[];
  } {
    return summarizeMessageChannelPresence(channel);
  }

  private toMessageFollowUpRequest(chatId: string, followUpAfterMs?: number): MessageFollowUpRequest | undefined {
    if (!Number.isInteger(followUpAfterMs) || followUpAfterMs === undefined || followUpAfterMs <= 0) {
      return undefined;
    }
    return {
      afterMs: followUpAfterMs,
      ownerSessionId: this.options.sessionId,
      attentionRoot: join(this.options.sessionRoot, "attention-system"),
      attentionContextId: this.getDefaultAttentionContextId(chatId),
      attentionOwner: this.getAvatarName(),
    };
  }

  private async sendMessageTool(input: {
    chatId: string;
    content: string;
    ref?: number;
    from?: string;
    followUpAfterMs?: number;
  }): Promise<RuntimeMessageSendResult> {
    const actorChannel = this.getActorRoom(input.chatId, { includeArchived: true });
    if (!actorChannel) {
      const remoteSeat = this.resolveStoredMessageSeat(input.chatId);
      if (!remoteSeat) {
        const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
        if (!channel) {
          throw new Error(`unknown chat channel: ${input.chatId}`);
        }
        throw new Error(`runtime actor has no member grant for chat channel: ${input.chatId}`);
      }
      const response = await this.postManagedSeatAuthority<{
        ok: boolean;
        reason?: string;
      }>({
        authorityUrl: remoteSeat.endpoint.authorityUrl,
        path: "/trpc/message.globalSend",
        body: {
          chatId: input.chatId,
          accessToken: remoteSeat.accessToken,
          text: input.content,
        },
      });
      // Intentionally do not forward `followUpAfterMs` through managed-seat RPC
      // yet. The correct fix is not another optional transport field; it is a
      // lower-level AsyncContext + RPC context-propagation law that can
      // preserve follow-up ownership across authority boundaries without
      // leaking runtime-local scheduler semantics into this bridge contract.
      if (response.ok !== true) {
        throw new Error(response.reason ?? `remote room send failed: ${input.chatId}`);
      }
      const snapshot = await this.readMessageChannel({
        chatId: input.chatId,
        limit: 5,
      });
      const lastMessage = snapshot.items.at(-1);
      if (!lastMessage) {
        throw new Error("remote room send succeeded but no visible message was returned");
      }
      return {
        ok: true,
        actionId: this.createRuntimeActionId("message_send"),
        messageId: lastMessage.messageId,
        recentMessages: projectRuntimeMessageOverview(snapshot.items, 5),
      };
    }
    const replyCycleId = this.activeCycleId;
    const author = input.from ?? this.getAvatarName();
    const actionId = this.createRuntimeActionId("message_send");
    const followUp = this.toMessageFollowUpRequest(input.chatId, input.followUpAfterMs);
    const result = await this.deliverRuntimeMessageDispatch({
      actionId,
      chatId: input.chatId,
      content: input.content,
      ref: input.ref,
      from: author,
      cycleId: replyCycleId,
      followUp,
    });
    return result;
  }

  private async editMessageTool(input: {
    chatId: string;
    messageId: number;
    content: string;
  }): Promise<{ ok: boolean; messageId: number; updatedAt: number }> {
    const actionId = this.createRuntimeActionId("message_edit");
    const access = this.getActorRoom(input.chatId, { includeArchived: true });
    if (!access?.accessToken) {
      const remoteSeat = this.resolveStoredMessageSeat(input.chatId);
      if (!remoteSeat) {
        throw new Error(`runtime actor has no member grant for chat channel: ${input.chatId}`);
      }
      const result = await this.postManagedSeatAuthority<{
        ok: boolean;
        messageId?: number;
        updatedAt?: number;
        reason?: string;
      }>({
        authorityUrl: remoteSeat.endpoint.authorityUrl,
        path: "/trpc/message.globalEdit",
        body: {
          chatId: input.chatId,
          accessToken: remoteSeat.accessToken,
          messageId: input.messageId,
          text: input.content,
        },
      });
      if (!result.ok || typeof result.messageId !== "number" || typeof result.updatedAt !== "number") {
        throw new Error(result.reason ?? `remote room edit failed: ${input.chatId}`);
      }
      return {
        ok: true,
        messageId: result.messageId,
        updatedAt: result.updatedAt,
      };
    }
    const message = this.messageSystem.editAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      messageId: input.messageId,
      content: input.content,
    });
    this.recordEffectLedger({
      actionId,
      actionKind: "message_edit",
      actorId: this.messageContactId,
      cycleId: this.activeCycleId,
      sessionModelCallId: this.activeModelCallId,
      target: `room:${input.chatId}`,
      effectKind: "message_row_updated",
      effectRecordId: `${input.chatId}/${message.messageId}`,
      timestamp: message.updatedAt,
      meta: {
        chatId: input.chatId,
        messageId: message.messageId,
      },
    });
    return {
      ok: true,
      messageId: message.messageId,
      updatedAt: message.updatedAt,
    };
  }

  private async recallMessageTool(input: {
    chatId: string;
    messageId: number;
  }): Promise<{ ok: boolean; messageId: number; updatedAt: number; recalledAt: number }> {
    const actionId = this.createRuntimeActionId("message_recall");
    const access = this.getActorRoom(input.chatId, { includeArchived: true });
    if (!access?.accessToken) {
      const remoteSeat = this.resolveStoredMessageSeat(input.chatId);
      if (!remoteSeat) {
        throw new Error(`runtime actor has no member grant for chat channel: ${input.chatId}`);
      }
      const result = await this.postManagedSeatAuthority<{
        ok: boolean;
        messageId?: number;
        updatedAt?: number;
        recalledAt?: number;
        reason?: string;
      }>({
        authorityUrl: remoteSeat.endpoint.authorityUrl,
        path: "/trpc/message.globalRecall",
        body: {
          chatId: input.chatId,
          accessToken: remoteSeat.accessToken,
          messageId: input.messageId,
        },
      });
      if (
        !result.ok ||
        typeof result.messageId !== "number" ||
        typeof result.updatedAt !== "number" ||
        typeof result.recalledAt !== "number"
      ) {
        throw new Error(result.reason ?? `remote room recall failed: ${input.chatId}`);
      }
      return {
        ok: true,
        messageId: result.messageId,
        updatedAt: result.updatedAt,
        recalledAt: result.recalledAt,
      };
    }
    const message = this.messageSystem.recallAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      messageId: input.messageId,
    });
    if (!message.recalledAt) {
      throw new Error("message recall did not persist recalledAt");
    }
    this.recordEffectLedger({
      actionId,
      actionKind: "message_recall",
      actorId: this.messageContactId,
      cycleId: this.activeCycleId,
      sessionModelCallId: this.activeModelCallId,
      target: `room:${input.chatId}`,
      effectKind: "message_row_recalled",
      effectRecordId: `${input.chatId}/${message.messageId}`,
      timestamp: message.recalledAt,
      meta: {
        chatId: input.chatId,
        messageId: message.messageId,
        recalledAt: message.recalledAt,
      },
    });
    return {
      ok: true,
      messageId: message.messageId,
      updatedAt: message.updatedAt,
      recalledAt: message.recalledAt,
    };
  }

  private requireActorChannelWriteAccess(chatId: string): { chatId: string; accessToken: string } {
    const actorChannel = this.getActorRoom(chatId, { includeArchived: true });
    if (!actorChannel?.accessToken) {
      throw new Error(`runtime actor has no member grant for chat channel: ${chatId}`);
    }
    return {
      chatId: actorChannel.chatId,
      accessToken: actorChannel.accessToken,
    };
  }

  private appendActorChannelReply(input: {
    chatId: string;
    content: string;
    ref?: number;
    from: string;
    followUp?: MessageFollowUpRequest;
    metadata?: Record<string, unknown>;
  }): MessageRecord {
    const access = this.requireActorChannelWriteAccess(input.chatId);
    return this.messageSystem.replyAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      senderContactId: this.messageContactId,
      ref: input.ref,
      from: input.from,
      content: input.content,
      followUp: input.followUp,
      metadata: input.metadata,
    });
  }

  private async deliverRuntimeMessageDispatch(input: {
    actionId: string;
    chatId: string;
    content: string;
    ref?: number;
    from: string;
    cycleId: number | null;
    followUp?: MessageFollowUpRequest;
  }): Promise<RuntimeMessageSendResult> {
    const redundant = this.findRedundantVisibleReply({
      chatId: input.chatId,
      content: input.content,
      from: input.from,
    });
    if (redundant) {
      if (input.followUp) {
        const access = this.requireActorChannelWriteAccess(input.chatId);
        this.messageSystem.refreshFollowUpAuthorized({
          chatId: access.chatId,
          accessToken: access.accessToken,
          messageId: redundant.messageId,
          followUp: input.followUp,
        });
        this.emitAttentionDeliveryState();
      }
      this.markRuntimeDispatchDelivered(input.chatId, input.cycleId);
      return await this.buildRuntimeMessageSendResult({
        actionId: input.actionId,
        chatId: input.chatId,
        message: redundant,
        recordEffect: false,
      });
    }
    const message = this.appendActorChannelReply({
      chatId: input.chatId,
      ref: input.ref,
      from: input.from,
      content: input.content,
      followUp: input.followUp,
    });
    if (input.followUp) {
      this.emitAttentionDeliveryState();
    }
    this.markRuntimeDispatchDelivered(input.chatId, input.cycleId);
    return await this.buildRuntimeMessageSendResult({
      actionId: input.actionId,
      chatId: input.chatId,
      message,
      recordEffect: true,
    });
  }

  listMessageChannels(input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry[] {
    return this.listActorRooms({ includeArchived: input.includeArchived });
  }

  async readMessageChannel(input: { chatId: string; limit?: number }): Promise<MessageSnapshot> {
    const access = this.getActorRoom(input.chatId, { includeArchived: true });
    if (access?.accessToken) {
      return this.messageSystem.snapshotAuthorized({
        chatId: access.chatId,
        accessToken: access.accessToken,
        limit: input.limit,
      });
    }
    const remoteSeat = this.resolveStoredMessageSeat(input.chatId);
    if (!remoteSeat) {
      throw new Error(`runtime actor has no grant for chat channel: ${input.chatId}`);
    }
    const payload = await this.postRemoteJson<{ snapshot: MessageSnapshot }>({
      authorityUrl: remoteSeat.endpoint.authorityUrl,
      path: "/trpc/message.globalSnapshot",
      body: {
        chatId: input.chatId,
        accessToken: remoteSeat.accessToken,
        ...(typeof input.limit === "number" ? { limit: input.limit } : {}),
      },
      accessToken: remoteSeat.accessToken,
    });
    return payload.snapshot;
  }

  async queryRuntimeMessages(input: {
    chatId: MessageQueryRequest["chatId"];
    mode: MessageQueryRequest["mode"];
    query: string;
    offset?: number;
    limit?: number;
  }): Promise<RuntimeMessageQueryResult> {
    return this.messageSystem.queryAuthorized({
      chatId: input.chatId,
      mode: input.mode,
      query: input.query,
      offset: input.offset,
      limit: input.limit,
      contactId: this.messageContactId,
    });
  }

  private async listRecentMessageOverview(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
  }): Promise<RuntimeMessageOverviewItem[]> {
    if (input.accessToken) {
      return projectRuntimeMessageOverview(
        this.messageSystem.queryMessagesAuthorized({
          chatId: input.chatId,
          accessToken: input.accessToken,
          limit: input.limit,
        }).items,
        input.limit,
      );
    }
    return projectRuntimeMessageOverview((await this.readMessageChannel(input)).items, input.limit);
  }

  private createRuntimeActionId(kind: string): string {
    return `action/${kind}/${createId()}`;
  }

  private createRuntimeEffectId(kind: string): string {
    return `effect/${kind}/${createId()}`;
  }

  private recordEffectLedger(input: {
    actionId: string;
    actionKind: string;
    actorId: string;
    target: string;
    effectKind: string;
    effectRecordId: string;
    timestamp?: number;
    cycleId?: number | null;
    sessionModelCallId?: number | null;
    meta?: Record<string, unknown>;
  }): SessionEffectLedgerRecord | null {
    if (!this.sessionDb) {
      return null;
    }
    const record = this.sessionDb.appendEffectLedger({
      effectId: this.createRuntimeEffectId(input.effectKind),
      actionId: input.actionId,
      actionKind: input.actionKind,
      actorId: input.actorId,
      cycleId: input.cycleId ?? null,
      sessionModelCallId: input.sessionModelCallId ?? null,
      target: input.target,
      effectKind: input.effectKind,
      effectRecordId: input.effectRecordId,
      timestamp: input.timestamp,
      meta: input.meta,
    });
    this.effectLedgerRecords.set(record.effectId, record);
    this.emitAttentionDeliveryState();
    return record;
  }

  private buildMessageFollowUpReminderIngress(task: MessageFollowUpDueInput): RuntimeSystemIngressEnvelope | null {
    const channel =
      this.getActorRoom(task.chatId, {
        includeArchived: true,
        touchPresence: false,
      }) ?? this.messageSystem.getChannel(task.chatId, { includeArchived: true });
    const presentation = buildMessageFollowUpReminderPresentation({
      chatId: task.chatId,
      anchorMessageId: task.messageId,
      dueAt: task.dueAt,
      messageContent: task.message.content,
    });
    return {
      system: "message",
      boundaryChannel: "world_fact",
      sourceId: formatRoomAttentionSrc({
        roomId: task.chatId,
        entryId: task.messageId,
      }),
      contextKey: channel?.contextId ?? this.getDefaultAttentionContextId(task.chatId),
      kind: "follow_up_reminder",
      summary: presentation.title,
      content: presentation.detailValue,
      format: presentation.detailFormat,
      score: 100,
      tags: ["message", "follow_up_reminder"],
      createdAt: task.dueAt,
      author: this.getAvatarName(),
      meta: {
        followUpTaskId: task.taskId,
        chatId: task.chatId,
        anchorMessageId: task.messageId,
        dueAt: task.dueAt,
        ownerSessionId: task.ownerSessionId,
      },
    };
  }

  private async buildRuntimeMessageSendResult(input: {
    actionId: string;
    chatId: string;
    message: MessageRecord;
    accessToken?: string;
    recordEffect?: boolean;
  }): Promise<RuntimeMessageSendResult> {
    if (input.recordEffect ?? true) {
      this.recordEffectLedger({
        actionId: input.actionId,
        actionKind: "message_send",
        actorId: input.message.senderContactId ?? this.messageContactId,
        cycleId: this.activeCycleId,
        sessionModelCallId: this.activeModelCallId,
        target: `room:${input.chatId}`,
        effectKind: "message_row_created",
        effectRecordId: `${input.chatId}/${input.message.messageId}`,
        timestamp: input.message.createdAt,
        meta: {
          chatId: input.chatId,
          messageId: input.message.messageId,
          ref: input.message.ref,
        },
      });
    }
    return {
      ok: true,
      actionId: input.actionId,
      messageId: input.message.messageId,
      recentMessages: await this.listRecentMessageOverview({
        chatId: input.chatId,
        accessToken: input.accessToken,
        limit: 5,
      }),
    };
  }

  async sendRuntimeMessage(input: {
    chatId: string;
    content: string;
    ref?: number;
    from?: string;
    followUpAfterMs?: number;
  }): Promise<RuntimeMessageSendResult> {
    return await this.sendMessageTool(input);
  }

  async editRuntimeMessage(input: {
    chatId: string;
    messageId: number;
    content: string;
  }): Promise<{ ok: boolean; messageId: number; updatedAt: number }> {
    return await this.editMessageTool(input);
  }

  async recallRuntimeMessage(input: {
    chatId: string;
    messageId: number;
  }): Promise<{ ok: boolean; messageId: number; updatedAt: number; recalledAt: number }> {
    return await this.recallMessageTool(input);
  }

  async inviteRuntimeTerminalSeat(input: {
    terminalId: string;
    participantId: `0x${string}`;
    seatClass: TerminalManagedSeatClass;
    label?: string;
    expiresAt?: number;
    authorityUrl?: string;
    accessToken?: string;
  }): Promise<RuntimeTerminalManageInviteResult> {
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      explicitAuthorityUrl: input.authorityUrl,
    });
    return await this.postManagedSeatAuthority<RuntimeTerminalManageInviteResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/terminal/invite",
      body: {
        terminalId: input.terminalId,
        participantId: input.participantId,
        seatClass: input.seatClass,
        label: input.label,
        expiresAt: input.expiresAt,
        accessToken: input.accessToken ?? this.resolveCurrentActorTerminalAccessToken(input.terminalId),
        actorId: this.terminalActorId,
        endpoint,
      },
    });
  }

  async acceptRuntimeTerminalSeat(input: {
    descriptor: string;
    authorityUrl?: string;
  }): Promise<RuntimeTerminalManageAcceptResult> {
    if (!this.options.avatarPrivateKey) {
      throw new Error("runtime avatar private key is unavailable");
    }
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      descriptorInput: input.descriptor,
      explicitAuthorityUrl: input.authorityUrl,
    });
    const prepared = await this.postManagedSeatAuthority<{
      invitation: TerminalInvitationRecord;
      proofInput: {
        invitationId: string;
        resourceKind: TerminalInvitationRecord["resourceKind"];
        resourceId: string;
        inviteePrincipalId: TerminalInvitationRecord["inviteePrincipalId"];
        payloadDigest: string;
        expiresAt: number;
      };
    }>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/terminal/prepare-accept",
      body: {
        descriptor: input.descriptor,
      },
    });
    const proof = await signManagedInvitationAcceptProof({
      privateKey: this.options.avatarPrivateKey,
      payload: prepared.proofInput,
    });
    const accepted = await this.postManagedSeatAuthority<RuntimeTerminalManageAcceptResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/terminal/accept",
      body: {
        descriptor: input.descriptor,
        proof,
      },
    });
    this.persistAcceptedTerminalSeat({
      terminalId: accepted.invitation.resourceId,
      accessToken: accepted.access.accessToken,
      accessRole: accepted.access.role,
      endpoint,
    });
    return accepted;
  }

  async configRuntimeTerminalSeat(input: {
    terminalId: string;
    participantId: `0x${string}`;
    seatClass: TerminalManagedSeatClass;
    label?: string;
    expiresAt?: number;
    authorityUrl?: string;
    accessToken?: string;
  }): Promise<RuntimeTerminalManageConfigResult> {
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      explicitAuthorityUrl: input.authorityUrl,
    });
    return await this.postManagedSeatAuthority<RuntimeTerminalManageConfigResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/terminal/config",
      body: {
        terminalId: input.terminalId,
        participantId: input.participantId,
        seatClass: input.seatClass,
        label: input.label,
        expiresAt: input.expiresAt,
        accessToken: input.accessToken ?? this.resolveCurrentActorTerminalAccessToken(input.terminalId),
        actorId: this.terminalActorId,
        endpoint,
      },
    });
  }

  async revokeRuntimeTerminalSeat(input: {
    terminalId: string;
    participantId: `0x${string}`;
    authorityUrl?: string;
    accessToken?: string;
  }): Promise<RuntimeTerminalManageRevokeResult> {
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      explicitAuthorityUrl: input.authorityUrl,
    });
    return await this.postManagedSeatAuthority<RuntimeTerminalManageRevokeResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/terminal/revoke",
      body: {
        terminalId: input.terminalId,
        participantId: input.participantId,
        accessToken: input.accessToken ?? this.resolveCurrentActorTerminalAccessToken(input.terminalId),
        actorId: this.terminalActorId,
      },
    });
  }

  async inviteRuntimeMessageSeat(input: {
    chatId: string;
    participantId: `0x${string}`;
    seatClass: MessageManagedSeatClass;
    label?: string;
    expiresAt?: number;
    authorityUrl?: string;
    accessToken?: string;
  }): Promise<RuntimeMessageManageInviteResult> {
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      explicitAuthorityUrl: input.authorityUrl,
    });
    return await this.postManagedSeatAuthority<RuntimeMessageManageInviteResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/message/invite",
      body: {
        chatId: input.chatId,
        participantId: input.participantId,
        seatClass: input.seatClass,
        label: input.label,
        expiresAt: input.expiresAt,
        accessToken: input.accessToken ?? this.resolveCurrentActorMessageAccessToken(input.chatId),
        endpoint,
      },
    });
  }

  async acceptRuntimeMessageSeat(input: {
    descriptor: string;
    authorityUrl?: string;
  }): Promise<RuntimeMessageManageAcceptResult> {
    if (!this.options.avatarPrivateKey) {
      throw new Error("runtime avatar private key is unavailable");
    }
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      descriptorInput: input.descriptor,
      explicitAuthorityUrl: input.authorityUrl,
    });
    const prepared = await this.postManagedSeatAuthority<{
      invitation: MessageInvitationRecord;
      proofInput: {
        invitationId: string;
        resourceKind: MessageInvitationRecord["resourceKind"];
        resourceId: string;
        inviteePrincipalId: MessageInvitationRecord["inviteePrincipalId"];
        payloadDigest: string;
        expiresAt: number;
      };
    }>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/message/prepare-accept",
      body: {
        descriptor: input.descriptor,
      },
    });
    const proof = await signManagedInvitationAcceptProof({
      privateKey: this.options.avatarPrivateKey,
      payload: prepared.proofInput,
    });
    const accepted = await this.postManagedSeatAuthority<RuntimeMessageManageAcceptResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/message/accept",
      body: {
        descriptor: input.descriptor,
        proof,
      },
    });
    this.persistAcceptedMessageSeat({
      chatId: accepted.invitation.resourceId,
      accessToken: accepted.access.accessToken,
      accessRole: accepted.access.accessRole,
      endpoint,
    });
    return accepted;
  }

  async configRuntimeMessageSeat(input: {
    chatId: string;
    participantId: `0x${string}`;
    seatClass: MessageManagedSeatClass;
    label?: string;
    expiresAt?: number;
    authorityUrl?: string;
    accessToken?: string;
  }): Promise<RuntimeMessageManageConfigResult> {
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      explicitAuthorityUrl: input.authorityUrl,
    });
    return await this.postManagedSeatAuthority<RuntimeMessageManageConfigResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/message/config",
      body: {
        chatId: input.chatId,
        participantId: input.participantId,
        seatClass: input.seatClass,
        label: input.label,
        expiresAt: input.expiresAt,
        accessToken: input.accessToken ?? this.resolveCurrentActorMessageAccessToken(input.chatId),
        endpoint,
      },
    });
  }

  async revokeRuntimeMessageSeat(input: {
    chatId: string;
    participantId: `0x${string}`;
    authorityUrl?: string;
    accessToken?: string;
  }): Promise<RuntimeMessageManageRevokeResult> {
    const endpoint = this.resolveManagedSeatAuthorityEndpoint({
      explicitAuthorityUrl: input.authorityUrl,
    });
    return await this.postManagedSeatAuthority<RuntimeMessageManageRevokeResult>({
      authorityUrl: endpoint.authorityUrl,
      path: "/api/managed-seats/message/revoke",
      body: {
        chatId: input.chatId,
        participantId: input.participantId,
        accessToken: input.accessToken ?? this.resolveCurrentActorMessageAccessToken(input.chatId),
      },
    });
  }

  async createMessageChannel(input: {
    kind: MessageChannelKind;
    title?: string;
    participants?: Array<{
      id: string;
      label?: string;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): Promise<MessageControlPlaneEntry> {
    const avatar = this.getAvatarName();
    const chatId = await this.allocateMessageChannelId(input.kind, input.title);
    const context = this.ensureAttentionContextForChannel(chatId);
    await this.applyAttentionFocusState(context.contextId, (input.focus ?? true) ? "focused" : "background");
    const channel = this.messageSystem.createChannel({
      chatId,
      kind: "room",
      title: input.title ?? "Room",
      owner: avatar,
      contextId: context.contextId,
      participants: input.participants ?? [],
      metadata: input.metadata ?? { builtIn: false },
      adminToken: input.adminToken,
      bootstrapContactId: this.messageContactId,
    });
    this.enqueueRoomLifecycleAttentionCommit({
      chatId,
      contextId: context.contextId,
      event: "channel_create",
      summary: `Created room ${chatId}`,
      payload: {
        kind: input.kind,
        title: channel.title,
        focused: Boolean(input.focus ?? true),
        channel: this.projectMessageChannelForAttention(channel),
      },
    });
    if (input.focus ?? true) {
      this.messageSystem.focusForContact(this.messageContactId, "replace", [chatId]);
      this.enqueueRoomLifecycleAttentionCommit({
        chatId,
        contextId: context.contextId,
        event: "channel_focus",
        summary: `Focused room ${chatId}`,
        payload: {
          op: "replace",
          channels: [chatId],
          focused: true,
          channel: this.projectMessageChannelForAttention(channel),
        },
      });
      return this.getActorRoom(chatId) ?? channel;
    }
    this.messageSystem.focusForContact(this.messageContactId, "remove", [chatId]);
    return this.getActorRoom(chatId) ?? channel;
  }

  async focusMessageChannels(input: {
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<MessageControlPlaneEntry[]> {
    const focusedBefore = new Set(this.messageSystem.getFocusedChatIds(this.messageContactId));
    const focusedAfter = new Set(this.messageSystem.focusAuthorized(input.op, input.channels));
    const channels = this.listActorRooms();
    const touchedChatIds = new Set<string>([
      ...focusedBefore,
      ...focusedAfter,
      ...input.channels.map((item) => item.chatId),
    ]);
    for (const chatId of touchedChatIds) {
      const channel = channels.find((item) => item.chatId === chatId);
      if (!channel) {
        continue;
      }
      const focused = focusedAfter.has(chatId);
      await this.applyAttentionFocusState(
        channel.contextId ?? this.getDefaultAttentionContextId(chatId),
        focused ? "focused" : "background",
      );
      const wasFocused = focusedBefore.has(chatId);
      if (focused === wasFocused && !input.channels.some((item) => item.chatId === chatId)) {
        continue;
      }
      this.enqueueRoomLifecycleAttentionCommit({
        chatId,
        contextId: channel.contextId ?? this.getDefaultAttentionContextId(chatId),
        event: "channel_focus",
        summary: `${focused ? "Focused" : "Unfocused"} chat channel ${chatId}`,
        payload: {
          op: input.op,
          focused,
          focusedChatIds: [...focusedAfter],
          channel: this.projectMessageChannelForAttention(channel),
        },
      });
    }
    return channels;
  }

  updateMessageChannel(input: {
    chatId: string;
    accessToken: string;
    patch: MessageChannelPatchInput;
  }): MessageControlPlaneEntry {
    const updated = this.messageSystem.updateChannelAuthorized(input);
    this.enqueueRoomLifecycleAttentionCommit({
      chatId: updated.chatId,
      contextId: updated.contextId ?? this.getDefaultAttentionContextId(updated.chatId),
      event: "channel_update",
      summary: `Updated chat channel ${updated.chatId}`,
      payload: {
        patch: {
          title: input.patch.title ?? null,
          participants: input.patch.participants ?? null,
          metadata: input.patch.metadata ?? null,
        },
        channel: this.projectMessageChannelForAttention(updated),
      },
    });
    return updated;
  }

  async archiveMessageChannel(input: {
    chatId: string;
    accessToken: string;
    archivedBy?: string;
  }): Promise<MessageControlPlaneEntry> {
    const channel =
      this.getActorRoom(input.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const archived = this.messageSystem.archiveChannelAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      archivedBy: input.archivedBy ?? this.getAvatarName(),
    });
    await this.applyArchivedMessageChannelLifecycle(archived, {
      archivedAt: archived.archivedAt ?? Date.now(),
      channel: this.projectMessageChannelForAttention(archived),
    });
    return archived;
  }

  async handleArchivedMessageChannelLifecycle(input: { chatId: string }): Promise<void> {
    const archived =
      this.getActorRoom(input.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!archived?.archivedAt) {
      return;
    }
    await this.applyArchivedMessageChannelLifecycle(archived, {
      cause: "room_management_archive",
      archivedAt: archived.archivedAt,
      channel: this.projectMessageChannelForAttention(archived),
    });
  }

  private async applyArchivedMessageChannelLifecycle(
    archived: MessageControlPlaneEntry,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const contextId = archived.contextId ?? this.getDefaultAttentionContextId(archived.chatId);
    this.enqueueRoomLifecycleAttentionCommit({
      chatId: archived.chatId,
      contextId,
      event: "channel_archive",
      summary: `Archived chat channel ${archived.chatId}`,
      payload,
    });
    // Room archive is a durable lifecycle fact; focus changes here while Avatar-authored context content stays intact.
    await this.applyAttentionFocusState(contextId, "muted");
  }

  deleteMessageChannel(input: { chatId: string; accessToken: string }): MessageControlPlaneEntry {
    const channel =
      this.getActorRoom(input.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const deleted = this.messageSystem.deleteChannelAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
    });
    this.enqueueRoomLifecycleAttentionCommit({
      chatId: deleted.chatId,
      contextId: deleted.contextId ?? this.getDefaultAttentionContextId(deleted.chatId),
      event: "channel_delete",
      summary: `Deleted chat channel ${deleted.chatId}`,
      payload: {
        channel: this.projectMessageChannelForAttention(deleted),
      },
    });
    return deleted;
  }

  listMessageChannelGrants(input: { chatId: string; accessToken: string }): MessageChannelGrantRecord[] {
    return this.messageSystem.listChannelGrantsAuthorized(input);
  }

  issueMessageChannelGrant(
    input: { chatId: string; accessToken: string } & MessageIssueGrantInput,
  ): MessageIssuedGrant {
    const issued = this.messageSystem.issueChannelGrantAuthorized(input);
    const channel = this.messageSystem.getChannel(issued.chatId, { includeArchived: true });
    this.enqueueRoomLifecycleAttentionCommit({
      chatId: issued.chatId,
      contextId: channel?.contextId ?? this.getDefaultAttentionContextId(issued.chatId),
      event: "channel_issue_grant",
      summary: `Issued ${issued.role} token for ${issued.chatId}`,
      payload: {
        role: issued.role,
        participantId: issued.participantId ?? null,
        label: issued.label ?? null,
        channel: channel ? this.projectMessageChannelForAttention(channel) : null,
      },
    });
    return issued;
  }

  revokeMessageChannelGrant(input: { chatId: string; accessToken: string; grantId: string }): { ok: boolean } {
    const result = this.messageSystem.revokeChannelGrantAuthorized(input);
    if (result.ok) {
      const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
      this.enqueueRoomLifecycleAttentionCommit({
        chatId: input.chatId,
        contextId: channel?.contextId ?? this.getDefaultAttentionContextId(input.chatId),
        event: "channel_revoke_grant",
        summary: `Revoked token for ${input.chatId}`,
        payload: {
          grantId: input.grantId,
          channel: channel ? this.projectMessageChannelForAttention(channel) : null,
        },
      });
    }
    return result;
  }

  listRuntimeTerminals(): TerminalControlPlaneEntry[] {
    const localTerminals = this.requireTerminalControlPlane().listForActor(this.terminalActorId);
    const byId = new Map(localTerminals.map((terminal) => [terminal.terminalId, terminal] as const));
    for (const [terminalId, seat] of Object.entries(this.getStoredSeatDocument().terminalSeats)) {
      if (byId.has(terminalId) || seat.state !== "active") {
        continue;
      }
      byId.set(terminalId, {
        terminalId,
        processKind: "remote",
        backend: "xterm",
        command: [],
        launchCwd: "",
        workspace: null,
        status: "IDLE",
        processPhase: "running",
        seq: 0,
        focused: false,
        rendererPreference: "auto",
        theme: "default-dark",
        cursor: "block",
        font: { ...DEFAULT_TERMINAL_FONT },
        currentAdminId: null,
        pendingRequestCount: 0,
        createdAt: 0,
        updatedAt: 0,
        access: {
          role: seat.accessRole,
          accessToken: seat.accessToken,
          participantId: this.terminalActorId,
          currentAdmin: seat.accessRole === "admin",
        },
      });
    }
    return [...byId.values()];
  }

  getRuntimeTerminalConfig(terminalId: string) {
    return this.requireTerminalControlPlane().getTerminalConfigAuthorized({
      terminalId,
      actorId: this.terminalActorId,
    });
  }

  setRuntimeTerminalConfig(input: { terminalId: string } & TerminalPatchInput) {
    return this.requireTerminalControlPlane().setTerminalConfigAuthorized({
      ...input,
      actorId: this.terminalActorId,
    });
  }

  async readRuntimeTerminal(input: {
    terminalId: string;
    mode?: TerminalReadMode;
    recordActivity?: boolean;
  }): Promise<TerminalReadPayload> {
    const localControlPlane = this.terminalControlPlane;
    if (!localControlPlane || !localControlPlane.has(input.terminalId)) {
      const remoteSeat = this.resolveStoredTerminalSeat(input.terminalId);
      if (remoteSeat) {
        const response = await this.postRemoteJson<{
          result: ControlPlaneTerminalReadResult;
        }>({
          authorityUrl: remoteSeat.endpoint.authorityUrl,
          path: "/trpc/terminal.globalRead",
          body: {
            terminalId: input.terminalId,
            accessToken: remoteSeat.accessToken,
            mode: input.mode,
            recordActivity: input.recordActivity,
          },
        });
        return this.publishTerminalReadPayload(input.terminalId, response.result, input.recordActivity ?? true);
      }
    }
    return await this.readTerminalRepresentation(input.terminalId, {
      mode: input.mode ?? "auto",
      remark: true,
      recordActivity: input.recordActivity ?? true,
    });
  }

  async awaitRuntimeTerminal(
    input: Omit<TerminalAwaitInput, "actorId" | "accessToken" | "superadminActorId">,
  ): Promise<ControlPlaneTerminalAwaitResult> {
    const controlPlane = this.requireTerminalControlPlane();
    if (!controlPlane.has(input.terminalId)) {
      throw new Error(`unknown terminal: ${input.terminalId}`);
    }
    const result = await controlPlane.awaitAuthorized({
      ...input,
      actorId: this.terminalActorId,
    });
    if (result.recordedActivity) {
      this.appendTerminalActivity({
        terminalId: input.terminalId,
        kind: "terminal_read",
        cycleId: this.activeCycleId,
        title: "Terminal await",
        content: result.eventId ? "" : JSON.stringify(result),
        detail: result.eventId
          ? this.createTerminalActivityRefDetail(input.terminalId, result.eventId, "terminal_read")
          : result,
      });
    }
    return result;
  }

  async writeRuntimeTerminal(input: {
    terminalId: string;
    text: string;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readRecordActivity?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
  }): Promise<RuntimeTerminalWriteResult> {
    const controlPlane = this.requireTerminalControlPlane();
    if (!controlPlane.has(input.terminalId)) {
      const remoteSeat = this.resolveStoredTerminalSeat(input.terminalId);
      if (!remoteSeat) {
        return { ok: false, message: `unknown terminal: ${input.terminalId}` };
      }
      try {
        const response = await this.postManagedSeatAuthority<{
          ok: boolean;
          message: string;
          read?: ControlPlaneTerminalReadResult;
        }>({
          authorityUrl: remoteSeat.endpoint.authorityUrl,
          path: "/trpc/terminal.globalWrite",
          body: {
            terminalId: input.terminalId,
            accessToken: remoteSeat.accessToken,
            text: input.text,
            returnRead: input.returnRead,
            readRecordActivity: input.readRecordActivity,
            readMode: input.readMode,
            createApprovalRequest: true,
          },
        });
        return {
          ok: response.ok,
          message: response.message,
          ...(response.read ? { read: response.read } : {}),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("error", { message: `terminal write failed (${input.terminalId}): ${message}` });
        return { ok: false, message };
      }
    }
    try {
      const result = await controlPlane.write({
        terminalId: input.terminalId,
        text: input.text,
        returnRead: input.returnRead,
        readRecordActivity: input.readRecordActivity,
        readMode: input.readMode,
        actorId: this.terminalActorId,
        createApprovalRequest: true,
      });
      if (result.ok) {
        this.appendTerminalActivity({
          terminalId: input.terminalId,
          kind: "terminal_write",
          cycleId: this.activeCycleId,
          title: "Terminal write",
          content: result.eventId ? "" : input.text,
          detail: result.eventId
            ? this.createTerminalActivityRefDetail(input.terminalId, result.eventId, "terminal_write")
            : {
                mode: "raw",
              },
        });
      }
      return {
        ok: result.ok,
        message: result.message,
        ...(result.read ? { read: result.read } : {}),
        ...(result.approvalRequest ? { approvalRequest: result.approvalRequest } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `terminal write failed (${input.terminalId}): ${message}` });
      return { ok: false, message };
    }
  }

  async inputRuntimeTerminal(input: {
    terminalId: string;
    text: string;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readRecordActivity?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
  }): Promise<RuntimeTerminalWriteResult> {
    const controlPlane = this.requireTerminalControlPlane();
    if (!controlPlane.has(input.terminalId)) {
      const remoteSeat = this.resolveStoredTerminalSeat(input.terminalId);
      if (!remoteSeat) {
        return { ok: false, message: `unknown terminal: ${input.terminalId}` };
      }
      try {
        const response = await this.postManagedSeatAuthority<{
          ok: boolean;
          message: string;
          read?: ControlPlaneTerminalReadResult;
        }>({
          authorityUrl: remoteSeat.endpoint.authorityUrl,
          path: "/trpc/terminal.globalInput",
          body: {
            terminalId: input.terminalId,
            accessToken: remoteSeat.accessToken,
            text: input.text,
            returnRead: input.returnRead,
            readRecordActivity: input.readRecordActivity,
            readMode: input.readMode,
            createApprovalRequest: true,
          },
        });
        return {
          ok: response.ok,
          message: response.message,
          ...(response.read ? { read: response.read } : {}),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("error", { message: `terminal input failed (${input.terminalId}): ${message}` });
        return { ok: false, message };
      }
    }
    try {
      const result = await controlPlane.input({
        terminalId: input.terminalId,
        text: input.text,
        returnRead: input.returnRead,
        readRecordActivity: input.readRecordActivity,
        readMode: input.readMode,
        actorId: this.terminalActorId,
        createApprovalRequest: true,
      });
      if (result.ok) {
        this.appendTerminalActivity({
          terminalId: input.terminalId,
          kind: "terminal_write",
          cycleId: this.activeCycleId,
          title: "Terminal input",
          content: result.eventId ? "" : input.text,
          detail: result.eventId
            ? this.createTerminalActivityRefDetail(input.terminalId, result.eventId, "terminal_write")
            : {
                mode: "mixed",
              },
        });
      }
      return {
        ok: result.ok,
        message: result.message,
        ...(result.read ? { read: result.read } : {}),
        ...(result.approvalRequest ? { approvalRequest: result.approvalRequest } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `terminal input failed (${input.terminalId}): ${message}` });
      return { ok: false, message };
    }
  }

  async createRuntimeTerminal(input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: TerminalControlPlaneEntry }> {
    await this.ensureRuntimeLocalApiStarted();
    const controlPlane = this.requireTerminalControlPlane();
    const targetTerminalId = input.terminalId;
    try {
      if (!this.runtimeLocalApi || !this.options.avatarPrivateKey) {
        return { ok: false, message: "runtime local api unavailable" };
      }
      let createdTerminalId: string;
      if (targetTerminalId && this.config?.terminals[targetTerminalId]) {
        const created = await this.createTerminal(targetTerminalId, this.config.terminals[targetTerminalId]);
        if (!created.ok) {
          return created;
        }
        controlPlane.bootstrap({ terminalId: targetTerminalId });
        if (this.config.terminals[targetTerminalId]?.gitLog) {
          await controlPlane.markDirty(targetTerminalId, this.terminalActorId);
        }
        createdTerminalId = targetTerminalId;
      } else {
        const cwdResolution = await this.resolveRuntimeTerminalCwd({ cwd: input.cwd });
        if (!cwdResolution.ok) {
          return cwdResolution;
        }
        const created = await controlPlane.createForActor(this.terminalActorId, {
          terminalId: input.terminalId,
          processKind: input.processKind,
          command: input.command,
          cwd: cwdResolution.cwd,
          profile: {
            ...(input.profile ?? {}),
            env: buildSharedTerminalEnvironment({
              env: input.profile?.env,
            }),
          },
        });
        const managed = controlPlane.getManagedTerminal(created.terminalId);
        if (managed) {
          this.attachRuntimeTerminal(created.terminalId, managed);
        }
        createdTerminalId = created.terminalId;
      }

      await this.applyAttentionFocusState(
        this.getTerminalAttentionContextId(createdTerminalId),
        (input.focus ?? true) ? "focused" : "background",
      );

      await this.enqueueTerminalLifecycleAttentionCommit({
        terminalId: createdTerminalId,
        contextId: this.getTerminalAttentionContextId(createdTerminalId),
        event: "terminal_create",
        summary: `Created terminal ${createdTerminalId}`,
        boundaryChannel: "world_fact",
        payload: {
          processKind: input.processKind ?? "shell",
        },
      });

      if (input.focus ?? true) {
        const focusedBefore = [...this.focusedTerminalIds];
        const focusedAfter = this.updateFocusedTerminals("replace", [createdTerminalId]);
        this.recordTerminalFocusTransitions({
          before: focusedBefore,
          after: focusedAfter,
          op: "replace",
        });
      }

      const terminal = controlPlane
        .listForActor(this.terminalActorId)
        .find((item) => item.terminalId === createdTerminalId);
      if (!terminal) {
        return {
          ok: false,
          message: `runtime actor has no terminal grant: ${createdTerminalId}`,
        };
      }
      return {
        ok: true,
        message: "terminal created",
        terminal,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `terminal create failed (${targetTerminalId ?? "dynamic"}): ${message}` });
      return { ok: false, message };
    }
  }

  async bootstrapRuntimeTerminal(
    terminalId: string,
    input: { recoveryIntent?: "killed-history" } = {},
  ): Promise<{
    ok: boolean;
    message: string;
    terminal?: TerminalControlPlaneEntry;
  }> {
    const controlPlane = this.requireTerminalControlPlane();
    try {
      const terminal = controlPlane.bootstrapAuthorized({
        terminalId,
        actorId: this.terminalActorId,
        recoveryIntent: input.recoveryIntent,
      });
      const managed = controlPlane.getManagedTerminal(terminalId);
      if (managed) {
        this.attachRuntimeTerminal(terminalId, managed);
      }
      return {
        ok: true,
        message: "terminal bootstrapped",
        terminal,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message };
    }
  }

  async focusRuntimeTerminals(input: { op: TerminalFocusOp; terminalIds: string[] }): Promise<{
    ok: boolean;
    message: string;
    focusedTerminalIds: string[];
  }> {
    const controlPlane = this.requireTerminalControlPlane();
    const visibleIds = new Set(controlPlane.listForActor(this.terminalActorId).map((terminal) => terminal.terminalId));
    const unknown = input.terminalIds.filter((terminalId) => !visibleIds.has(terminalId));
    if (unknown.length > 0) {
      return {
        ok: false,
        message: `unknown terminal: ${unknown[0]}`,
        focusedTerminalIds: [...this.focusedTerminalIds],
      };
    }
    const focusedBefore = [...this.focusedTerminalIds];
    const focusedTerminalIds = this.updateFocusedTerminals(input.op, input.terminalIds);
    const touchedTerminalIds = new Set<string>([...focusedBefore, ...focusedTerminalIds, ...input.terminalIds]);
    for (const terminalId of touchedTerminalIds) {
      await this.applyAttentionFocusState(
        this.getTerminalAttentionContextId(terminalId),
        focusedTerminalIds.includes(terminalId) ? "focused" : "background",
      );
    }
    this.recordTerminalFocusTransitions({
      before: focusedBefore,
      after: focusedTerminalIds,
      op: input.op,
    });
    return { ok: true, message: `focus ${input.op}`, focusedTerminalIds };
  }

  async deleteRuntimeTerminal(terminalId: string): Promise<{ ok: boolean; message: string }> {
    const controlPlane = this.requireTerminalControlPlane();
    const result = await controlPlane.deleteAuthorized({
      terminalId,
      actorId: this.terminalActorId,
    });
    if (!result.ok) {
      return result;
    }
    this.terminals.delete(terminalId);
    delete this.terminalLatestSeq[terminalId];
    delete this.terminalSnapshots[terminalId];
    delete this.terminalReads[terminalId];
    delete this.terminalReadCursorHashById[terminalId];
    this.terminalKernelAdapter.markTerminalConsumed(terminalId);
    if (this.config?.terminals[terminalId]) {
      delete this.config.terminals[terminalId];
      this.config.bootTerminals = this.config.bootTerminals.filter((entry) => entry.terminalId !== terminalId);
      if (this.config.primaryTerminalId === terminalId) {
        this.config.primaryTerminalId = Object.keys(this.config.terminals)[0] ?? this.config.primaryTerminalId;
      }
    }
    this.focusedTerminalIds = controlPlane.getFocusedTerminalIds(this.terminalActorId);
    this.emitFocusedTerminal();
    await this.enqueueTerminalLifecycleAttentionCommit({
      terminalId,
      contextId: this.getTerminalAttentionContextId(terminalId),
      event: "terminal_delete",
      summary: `Deleted terminal ${terminalId}`,
      boundaryChannel: "world_fact",
    });
    return result;
  }

  async stopRuntimeTerminal(terminalId: string): Promise<{
    ok: boolean;
    message: string;
    terminal?: TerminalControlPlaneEntry;
  }> {
    const controlPlane = this.requireTerminalControlPlane();
    const result = await controlPlane.stopAuthorized({
      terminalId,
      actorId: this.terminalActorId,
    });
    if (!result.ok) {
      return result;
    }
    const terminal =
      controlPlane
        .listHistoryForActor(this.terminalActorId, { touchPresence: false })
        .find((item) => item.terminalId === terminalId) ??
      controlPlane
        .listForActor(this.terminalActorId, { touchPresence: false })
        .find((item) => item.terminalId === terminalId);
    if (terminal?.processPhase === "killed") {
      await this.scheduleKilledRuntimeTerminal(terminal);
    }
    return {
      ...result,
      ...(terminal ? { terminal } : {}),
    };
  }

  listRuntimeTerminalHistory(): TerminalControlPlaneEntry[] {
    return this.requireTerminalControlPlane().listHistoryForActor(this.terminalActorId, { touchPresence: false });
  }

  archiveRuntimeTerminal(terminalId: string): TerminalControlPlaneEntry {
    return this.requireTerminalControlPlane().archiveTerminal(terminalId);
  }

  private resolveMessageRole(message: MessageRecord): ChatMessage["role"] {
    const metadata = message.metadata;
    if (
      metadata &&
      typeof metadata === "object" &&
      metadata.channel === "to_user" &&
      message.senderContactId === this.messageContactId
    ) {
      return "assistant";
    }
    return message.from === this.getAvatarName() ? "assistant" : "user";
  }

  private isInboundMessage(message: MessageRecord): boolean {
    return !message.recalledAt && message.kind === "text" && this.resolveMessageRole(message) === "user";
  }

  private isUnreadInboundMessage(message: MessageRecord): boolean {
    return this.isInboundMessage(message) && message.unreadContactIds.includes(this.messageContactId);
  }

  private getMaxFocusedRoomCount(): number {
    return this.config?.message.maxFocusedRoomCount ?? DEFAULT_MAX_FOCUSED_ROOM_COUNT;
  }

  private getMaxBatchReadRoomMessageCount(): number {
    return this.config?.message.maxBatchReadRoomMessageCount ?? DEFAULT_MAX_BATCH_READ_ROOM_MESSAGE_COUNT;
  }

  private isLoopPaused(): boolean {
    return this.runtime?.getLoopState().paused ?? false;
  }

  private isLoopStopped(): boolean {
    return this.loopSuspension === "stopped";
  }

  private hasUnreadRoomWork(): boolean {
    return this.messageKernelAdapter.hasUnreadWork();
  }

  private async collectUnreadRoomIngress(): Promise<number> {
    return await this.runtimeKernelHost.drainIngress();
  }

  private buildMessageSystemIngressEnvelope(
    message: MessageRecord,
    channel: MessageControlPlaneEntry & { accessToken: string },
  ): RuntimeSystemIngressEnvelope | null {
    const trimmedContent = message.content.trim();
    if (trimmedContent.length === 0 || trimmedContent === "/compact") {
      return null;
    }
    const attachments = cloneMessageAttachmentFacts(message);
    const envelopeMeta = {
      chatId: message.chatId,
      chatTitle: channel.title,
      chatKind: channel.kind,
      chatContextId: channel.contextId ?? this.getDefaultAttentionContextId(channel.chatId),
      chatFocused: channel.focused,
      messageId: message.messageId,
      visibleAt: message.visibleAt ?? message.createdAt,
      senderContactId: message.senderContactId ?? null,
      senderLabel: message.from,
      ref: message.ref ?? null,
    } satisfies Record<string, unknown>;
    return {
      system: "message",
      boundaryChannel: "world_fact",
      sourceId: formatMessageSourceSrc({
        chatId: message.chatId,
        messageId: message.messageId,
      }),
      contextKey: channel.contextId ?? this.getDefaultAttentionContextId(channel.chatId),
      kind: "room_ingress",
      summary: truncateAttentionTitle(trimmedContent),
      content: buildMessageFactEnvelope({
        message,
        chatTitle: channel.title,
        chatKind: channel.kind,
        contextId: channel.contextId ?? this.getDefaultAttentionContextId(channel.chatId),
        focused: channel.focused,
        attachments,
      }),
      format: "text/markdown",
      score: 100,
      tags: ["message", "room_ingress"],
      createdAt: message.updatedAt ?? message.createdAt,
      author: message.from,
      // Room messages are source facts, not Avatar-authored context summaries.
      // They must create AttentionItems/scores without rewriting the room
      // attentionContext that the Avatar later repairs with its own commit.
      contextMutation: "preserve",
      meta: envelopeMeta,
    };
  }

  private toLoopInputFromMessage(message: MessageRecord): LoopBusInput {
    const channel =
      this.getActorRoom(message.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(message.chatId, { includeArchived: true });
    const meta: Record<string, string | number | boolean | null> = {};
    meta.chatId = message.chatId;
    meta.messageId = message.messageId;
    meta.senderContactId = message.senderContactId ?? null;
    meta.senderLabel = message.from;
    meta.ref = message.ref ?? null;
    if (channel) {
      meta.chatTitle = channel.title;
      meta.chatKind = channel.kind;
      meta.chatFocused = channel.focused;
      meta.chatContextId = channel.contextId ?? this.getDefaultAttentionContextId(channel.chatId);
      meta.chatOwner = channel.owner;
    }
    return {
      name: message.from,
      role: "user",
      type: "text",
      source: "chat",
      text: message.content,
      meta,
      attachments: message.attachments?.map((attachment) => ({
        assetId: attachment.assetId,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
      })),
      timestamp: message.createdAt,
      id: String(message.messageId),
    };
  }

  private toChatMessageFromChannel(message: MessageRecord): ChatMessage {
    const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata : {};
    const role = this.resolveMessageRole(message);
    return {
      id: String(message.messageId),
      chatId: message.chatId,
      role,
      content: message.content,
      messageKind: message.kind,
      messagePayload: message.payload,
      timestamp: message.createdAt,
      updatedAt: message.updatedAt,
      visibleAt: message.visibleAt,
      cycleId:
        typeof metadata.cycleId === "number" && Number.isInteger(metadata.cycleId) ? metadata.cycleId : undefined,
      channel:
        typeof metadata.channel === "string"
          ? (metadata.channel as ChatMessage["channel"])
          : role === "assistant"
            ? "to_user"
            : undefined,
      format: typeof metadata.format === "string" ? (metadata.format as ChatMessage["format"]) : undefined,
      attachments: message.attachments?.map((attachment) => ({
        assetId: attachment.assetId,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
      })),
    };
  }

  private bindMessageSystem(): void {
    this.messageSystemCleanup.push(
      this.messageSystem.onMessage(({ chatId, message }) => {
        const actorRoom = this.getActorRoom(chatId, {
          includeArchived: true,
          touchPresence: false,
        });
        if (!actorRoom) {
          return;
        }
        const channel = this.messageSystem.getChannel(chatId, { includeArchived: true });
        if (!channel) {
          return;
        }
        if (actorRoom.focused) {
          this.recordChatMessage(this.toChatMessageFromChannel(message));
        }
      }),
    );
    this.messageSystemCleanup.push(this.messageSystem.onFocus(() => {}));
  }

  private ensureFollowUpSinkBound(): void {
    if (this.followUpSinkCleanup) {
      return;
    }
    this.followUpSinkCleanup = this.messageSystem.registerFollowUpSink(this.options.sessionId, async (task) => {
      // Today the local runtime consumes due follow-up tasks through a
      // session-owned sink. This is an adapter detail, not the long-term
      // cross-RPC ownership law: managed-seat remote sends must eventually
      // preserve follow-up ownership via AsyncContext + RPC context
      // propagation instead of smuggling runtime-local scheduler state
      // through today's authority bridge.
      const envelope = this.buildMessageFollowUpReminderIngress(task);
      if (!envelope) {
        this.emitAttentionDeliveryState();
        return;
      }
      const committed = await this.runtimeKernelHost.commitIngress(envelope, {
        notifyLoop: false,
      });
      this.emitAttentionDeliveryState();
      return {
        reminderContextId: committed?.contextId ?? null,
        reminderCommitId: committed?.commit.commitId ?? null,
      };
    });
  }

  private releaseFollowUpSink(): void {
    this.followUpSinkCleanup?.();
    this.followUpSinkCleanup = null;
  }

  private bindTerminalSystem(): void {
    this.terminalSystemCleanup.push(
      this.terminalControlPlane.onFocus(({ actorId, terminalIds }) => {
        if (actorId !== this.terminalActorId) {
          return;
        }
        const next = this.normalizeFocusedTerminalIds(terminalIds);
        if (next.join("\u0000") === this.focusedTerminalIds.join("\u0000")) {
          this.terminalKernelAdapter.syncFocusedDirtyTerminals();
          return;
        }
        const previous = [...this.focusedTerminalIds];
        this.focusedTerminalIds = next;
        this.emitFocusedTerminal();
        this.recordTerminalFocusTransitions({
          before: previous,
          after: next,
          op: "sync",
        });
        this.invalidateFocusedTerminals("focus-sync");
      }),
    );
    this.terminalSystemCleanup.push(
      this.terminalControlPlane.onChanged(({ terminalId, reason }) => {
        if (reason === "lifecycle") {
          const historyEntry = this.terminalControlPlane
            .listHistoryForActor(this.terminalActorId, { touchPresence: false })
            .find((entry) => entry.terminalId === terminalId);
          if (historyEntry?.processPhase === "killed") {
            void this.scheduleKilledRuntimeTerminal(historyEntry);
          }
        }
        switch (reason) {
          case "created":
          case "updated":
          case "deleted":
          case "lifecycle":
          case "transition":
          case "status":
            this.syncRuntimeTerminalStatus(terminalId);
            return;
          default:
            return;
        }
      }),
    );
    this.terminalSystemCleanup.push(
      this.terminalControlPlane.onApprovalRequest(({ terminalId, request }) => {
        const isAdminWork = request.assignedAdminId === this.terminalActorId && request.status === "pending";
        const isRequesterUpdate = request.participantId === this.terminalActorId && request.status !== "pending";
        if (!isAdminWork && !isRequesterUpdate) {
          return;
        }
        void this.enqueueTerminalLifecycleAttentionCommit({
          terminalId,
          contextId: this.getTerminalControlPlaneAttentionContextId(),
          event: isAdminWork ? "terminal_write_request" : "terminal_write_request_update",
          summary: isAdminWork
            ? `Terminal ${terminalId} has a pending write request`
            : `Terminal ${terminalId} write request is ${request.status}`,
          boundaryChannel: "world_fact",
          payload: {
            requestId: request.requestId,
            participantId: request.participantId,
            assignedAdminId: request.assignedAdminId ?? null,
            status: request.status,
            expiresAt: request.expiresAt,
            leaseId: request.leaseId ?? null,
          },
        });
      }),
    );
  }

  private createTerminalActivityRefDetail(
    terminalId: string,
    eventId: number,
    eventKind: "terminal_read" | "terminal_write",
  ): Record<string, unknown> {
    return {
      source: "terminal-event-ref",
      terminalId,
      eventId,
      eventKind,
    };
  }

  private createTaskSourceRef(subjectId: string, reason: string, versionHint?: string | number): LoopTaskSourceRef {
    return {
      src: formatTaskSourceSrc(subjectId),
      reason,
      versionHint,
    };
  }

  private enqueueTaskAttentionDraft(input: {
    subjectId: string;
    reason: string;
    content: string;
    from: string;
    score?: number;
    versionHint?: string | number;
    semanticHash?: string;
  }): void {
    const taskPresentation = buildTaskAttentionPresentation(input.content, input.subjectId);
    this.taskAttentionDraftQueue.push({
      sourceRef: this.createTaskSourceRef(input.subjectId, input.reason, input.versionHint),
      content: input.content,
      from: input.from,
      score: input.score ?? 100,
      provenance: {
        author: input.from,
        source: "task",
        src: formatTaskSourceSrc(input.subjectId),
        createdAt: new Date().toISOString(),
      },
      presentation: {
        summary: taskPresentation.title,
        body: taskPresentation.detailValue,
        bodyFormat: taskPresentation.detailFormat,
        changeType: "update",
      },
      semanticHash: typeof input.semanticHash === "string" ? input.semanticHash : undefined,
      versionHint: input.versionHint !== undefined ? String(input.versionHint) : undefined,
      supersedeActive: {
        src: formatTaskSourceSrc(input.subjectId),
      },
    });
  }

  private hasDeliveredRuntimeDispatchForCycle(chatId: string, cycleId: number | null): boolean {
    if (cycleId === null) {
      return false;
    }
    return this.deliveredRuntimeDispatchChatIds.get(cycleId)?.has(chatId) ?? false;
  }

  private markRuntimeDispatchDelivered(chatId: string, cycleId: number | null): void {
    if (cycleId === null) {
      return;
    }
    const existing = this.deliveredRuntimeDispatchChatIds.get(cycleId);
    if (existing) {
      existing.add(chatId);
      return;
    }
    this.deliveredRuntimeDispatchChatIds.set(cycleId, new Set([chatId]));
  }

  private getOriginChatIdForCycle(cycleId: number | null): string | null {
    if (cycleId === null) {
      return null;
    }
    return this.cycleReplyChatIds.get(cycleId) ?? null;
  }

  private findRedundantVisibleReply(input: { chatId: string; content: string; from: string }): MessageRecord | null {
    const normalizedContent = input.content.trim();
    if (normalizedContent.length === 0) {
      return null;
    }
    const recent = this.messageSystem.queryActiveVisibleMessages({ chatId: input.chatId, limit: 16 }).items;
    let latestNonAssistantAt = Number.NEGATIVE_INFINITY;
    let latestMatchingAssistant: MessageRecord | null = null;
    for (const message of recent) {
      if (message.from !== input.from) {
        latestNonAssistantAt = Math.max(latestNonAssistantAt, message.createdAt);
        continue;
      }
      if (message.content.trim() !== normalizedContent) {
        continue;
      }
      latestMatchingAssistant = message;
    }
    if (!latestMatchingAssistant) {
      return null;
    }
    return latestMatchingAssistant.createdAt >= latestNonAssistantAt ? latestMatchingAssistant : null;
  }

  private createLoopPlugins(): LoopBusPlugin[] {
    return [
      {
        name: "builtin-message-source",
        setup: (api) => {
          api.registerSource({
            namespace: MESSAGE_SRC_NAMESPACE,
            parse: (src) => parseMessageSourceSrc(src),
            format: (ref) => formatMessageSourceSrc(ref),
            key: (ref) => formatMessageSourceSrc(ref),
            bucket: (ref) => `${MESSAGE_SRC_NAMESPACE}:${ref.chatId}`,
            compare: (left, right) =>
              left.chatId === right.chatId ? left.messageId - right.messageId : left.chatId.localeCompare(right.chatId),
            read: async (request) => this.readMessageSource(request),
            toAttentionDrafts: async (result, request) => this.toMessageAttentionDrafts(result, request),
          });
        },
        attentionShouldLoad: ({ request }) => {
          const parsed = parseMessageSourceSrc(request.ref.src);
          if (!parsed) {
            return null;
          }
          const message = this.messageSystem.getMessage(parsed.chatId, parsed.messageId);
          return {
            allow: message !== undefined,
            reason: message ? "message.available" : "message.missing",
          };
        },
      },
      {
        name: "builtin-terminal-source",
        setup: (api) => {
          api.registerSource({
            namespace: TERMINAL_SRC_NAMESPACE,
            parse: (src) => parseTerminalSourceSrc(src),
            format: (ref) => formatTerminalSourceSrc(ref),
            key: (ref) => `${TERMINAL_SRC_NAMESPACE}:${ref.terminalId}`,
            bucket: (ref) => `${TERMINAL_SRC_NAMESPACE}:${ref.terminalId}`,
            compare: (left, right) =>
              left.terminalId === right.terminalId
                ? (left.eventId ?? Number.MAX_SAFE_INTEGER) - (right.eventId ?? Number.MAX_SAFE_INTEGER)
                : left.terminalId.localeCompare(right.terminalId),
            read: async (request) => this.readTerminalSource(request),
            toAttentionDrafts: async (result, request) => this.toTerminalAttentionDrafts(result, request),
          });
        },
      },
    ];
  }

  private async createLoopPluginRuntime(): Promise<LoopBusPluginRuntime> {
    const runtime = new LoopBusPluginRuntime(this.createLoopPlugins(), this.options.logger ?? { log: () => {} });
    await runtime.setup();
    return runtime;
  }

  private setProjectionStage(stage: TaskStage): void {
    if (this.stage === stage) {
      return;
    }
    this.stage = stage;
    this.emit("stage", { stage });
  }

  private updateProjectionStageFromLoopPhase(phase: LoopBusPhase): void {
    switch (phase) {
      case "collecting_inputs":
      case "persisting_cycle":
        this.setProjectionStage("observe");
        return;
      case "calling_model":
        this.setProjectionStage("decide");
        return;
      case "waiting_commits":
      case "stopped":
        this.setProjectionStage("idle");
        return;
    }
  }

  private deriveProjectionStageFromToolTrace(trace: readonly AgentToolTraceEntry[]): TaskStage {
    if (trace.some((entry) => entry.tool === "root_bash" || entry.tool === "workspace_bash")) {
      return "act";
    }
    if (trace.some((entry) => entry.tool === "workspace_list")) {
      return "observe";
    }
    return "decide";
  }

  private createAgentToolProviders(): AgentToolProvider[] {
    return [this.createWorkspaceToolProvider()];
  }

  private projectDirectWorkspaceList(): Array<{
    id: number;
    cwd: string;
    alias: string;
  }> {
    return this.listMountedWorkspaceAuthorities().map((entry) => ({
      id: entry.mount.runtimeWorkspaceId,
      cwd: entry.defaultCwd,
      alias: entry.mount.alias,
    }));
  }

  private projectRuntimeWorkspaceList(): RuntimeWorkspaceSurface[] {
    return this.listMountedWorkspaceAuthorities().map((entry) => projectRuntimeWorkspaceSurface(entry));
  }

  private async ensureRuntimeLocalApiStarted(): Promise<void> {
    if (this.runtimeLocalApi || !this.options.avatarPrincipalId) {
      return;
    }
    if (!this.options.avatarPrivateKey) {
      throw new Error("runtime avatar private key missing");
    }
    const runtimeSkillSystem = this.ensureRuntimeSkillSystem();
    const mcpSystem = this.ensureMcpSystem();
    this.runtimeLocalApi = await startRuntimeLocalApi({
      expectedPrincipalId: this.options.avatarPrincipalId,
      handlers: {
        attentionList: () => this.attentionSystem.listContexts(),
        attentionActive: () => this.attentionSystem.listActiveContexts().map(projectRuntimeAttentionActiveMatch),
        attentionContext: async (input) => this.readRuntimeAttentionContext(input),
        attentionDeliveryState: () => this.inspectAttentionDeliveryState(),
        attentionDeliveryTimeline: (input) => this.queryAttentionDeliveryTimeline(input),
        attentionQuery: async (input) => (await this.queryAttention(input)).map(projectAttentionCommitMatchForModel),
        attentionNotifyQuota: (input) => this.inspectNotifyQuota(input),
        attentionCommit: async (input) => await this.commitAttention(input),
        messageList: (input) => this.listMessageChannelsForTooling(input),
        messageRead: async (input) => await this.readMessageChannelForTooling(input),
        messageQuery: async (input) => await this.queryRuntimeMessages(input),
        messageSend: async (input) => await this.sendRuntimeMessage(input),
        messageEdit: async (input) => await this.editRuntimeMessage(input),
        messageRecall: async (input) => await this.recallRuntimeMessage(input),
        messageManageInvite: async (input) => await this.inviteRuntimeMessageSeat(input),
        messageManageAccept: async (input) => await this.acceptRuntimeMessageSeat(input),
        messageManageConfig: async (input) => await this.configRuntimeMessageSeat(input),
        messageManageRevoke: async (input) => await this.revokeRuntimeMessageSeat(input),
        workspaceList: () => this.projectRuntimeWorkspaceList(),
        workspaceSetAlias: async (input) => {
          const updated = await this.options.setRuntimeWorkspaceAlias?.({
            runtimeWorkspaceId: input.workspaceId,
            alias: input.alias,
          });
          if (!updated || updated.kind !== "workspace") {
            throw new Error(`workspace not found: ${input.workspaceId}`);
          }
          return {
            workspace: projectRuntimeWorkspaceSurface({
              mount: updated,
              defaultCwd:
                this.findMountedWorkspaceAuthority(updated.runtimeWorkspaceId)?.defaultCwd ??
                this.listWorkspaceAuthorities().find((entry) => entry.mount.mountId === updated.mountId)?.defaultCwd ??
                updated.workspacePath,
              grants:
                this.listWorkspaceAuthorities().find((entry) => entry.mount.mountId === updated.mountId)?.grants ?? [],
            }),
          };
        },
        terminalList: () => this.listRuntimeTerminals().map(projectRuntimeTerminal),
        terminalHistory: () => this.listRuntimeTerminalHistory().map(projectRuntimeTerminal),
        terminalCreate: async (input) => {
          const result = await this.createRuntimeTerminal(input);
          if (!result.terminal) {
            return { ok: result.ok, message: result.message };
          }
          return {
            ok: result.ok,
            message: result.message,
            terminal: projectRuntimeTerminalCreateAck(projectRuntimeTerminal(result.terminal)),
          };
        },
        terminalGetConfig: async (input) =>
          projectRuntimeTerminalConfig(this.getRuntimeTerminalConfig(input.terminalId)),
        terminalSetConfig: async (input) => projectRuntimeTerminalConfigMutation(this.setRuntimeTerminalConfig(input)),
        terminalRead: async (input) => await this.readRuntimeTerminal(input),
        terminalAwait: async (input, context) =>
          await this.awaitRuntimeTerminal({
            ...input,
            signal: context?.signal,
          }),
        terminalWrite: async (input) => await this.writeRuntimeTerminal(input),
        terminalInput: async (input) => await this.inputRuntimeTerminal(input),
        terminalFocus: async (input) => await this.focusRuntimeTerminals(input),
        terminalBootstrap: async (input) => {
          const result = await this.bootstrapRuntimeTerminal(input.terminalId, {
            recoveryIntent: input.recoveryIntent,
          });
          if (!result.terminal) {
            return { ok: result.ok, message: result.message };
          }
          return {
            ok: result.ok,
            message: result.message,
            terminal: projectRuntimeTerminal(result.terminal),
          };
        },
        terminalStop: async (input) => {
          const result = await this.stopRuntimeTerminal(input.terminalId);
          if (!result.terminal) {
            return { ok: result.ok, message: result.message };
          }
          return {
            ok: result.ok,
            message: result.message,
            terminal: projectRuntimeTerminal(result.terminal),
          };
        },
        terminalArchive: async (input) => ({
          terminal: projectRuntimeTerminal(this.archiveRuntimeTerminal(input.terminalId)),
        }),
        terminalManageInvite: async (input) => await this.inviteRuntimeTerminalSeat(input),
        terminalManageAccept: async (input) => await this.acceptRuntimeTerminalSeat(input),
        terminalManageConfig: async (input) => await this.configRuntimeTerminalSeat(input),
        terminalManageRevoke: async (input) => await this.revokeRuntimeTerminalSeat(input),
        skillList: () => runtimeSkillSystem.list().map(projectRuntimeSkill),
        skillSearch: (input) => runtimeSkillSystem.search(input.query ?? "").map(projectRuntimeSkill),
        skillInfo: async (input) => {
          const info = runtimeSkillSystem.info(input.name, input.rootKind);
          if (!info) {
            throw new Error(`skill not found: ${input.name}`);
          }
          return projectRuntimeSkillInfo(info);
        },
        skillGetConfig: async (input) => {
          const info = runtimeSkillSystem.getConfig(input);
          if (!info) {
            throw new Error(`skill not found: ${input.name}`);
          }
          return projectRuntimeSkillConfigInfo(info);
        },
        skillUpsert: async (input) => {
          const result = runtimeSkillSystem.upsert(input);
          const applied = await this.handleRuntimeSkillRefreshResult(result, { notifyLoop: true });
          return projectRuntimeSkillMutation({
            ...result,
            ...applied,
            skill: result.skill,
            created: result.created,
          });
        },
        skillSetConfig: async (input) => {
          const result = runtimeSkillSystem.setConfig(input);
          const applied = await this.handleRuntimeSkillRefreshResult(result, { notifyLoop: true });
          return projectRuntimeSkillMutation({
            ...result,
            ...applied,
            skill: result.skill,
          });
        },
        skillRemove: async (input) => {
          const result = runtimeSkillSystem.remove(input);
          const applied = await this.handleRuntimeSkillRefreshResult(result, { notifyLoop: true });
          return projectRuntimeSkillMutation({
            ...result,
            ...applied,
            removed: result.removed,
            removedPath: result.removedPath,
            removedRootKind: result.removedRootKind,
          });
        },
        skillRefresh: async () => {
          const result = runtimeSkillSystem.refresh({ publishReminders: false });
          const applied = await this.handleRuntimeSkillRefreshResult(result, { notifyLoop: false });
          return projectRuntimeSkillMutation({
            ...result,
            ...applied,
          });
        },
        mcp: mcpSystem,
      },
    });
  }

  async execRootWorkspaceBash(input: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }): Promise<RootWorkspaceBashExecResult> {
    await this.ensureRuntimeLocalApiStarted();
    if (!this.runtimeLocalApi || !this.options.avatarPrivateKey) {
      throw new Error("runtime local api unavailable");
    }
    let explicitCwd: string | undefined;
    if (typeof input.cwd === "string" && input.cwd.trim().length > 0) {
      const normalizedCwd = resolveWorkspaceFsPath(input.cwd, this.getHomeDir());
      const cwdResolution = await this.resolveRuntimeTerminalCwd({ cwd: normalizedCwd });
      if (!cwdResolution.ok) {
        return {
          stdout: "",
          stderr: `${cwdResolution.message}\n`,
          exitCode: 1,
          cwd: normalizedCwd,
        };
      }
      explicitCwd = cwdResolution.cwd;
    }
    materializeRuntimeShellBin(this.getRootWorkspacePath());
    return await this.getOrCreateRootWorkspaceShellWorld().exec({
      command: input.command,
      cwd: explicitCwd,
      env: buildRootWorkspaceShellEnvironment({
        rootWorkspacePath: this.getRootWorkspacePath(),
        homeDir: this.getHomeDir(),
        apiBaseUrl: this.runtimeLocalApi.baseUrl,
        managedSeatAuthorityUrl: this.options.managedSeatAuthorityUrl,
        privateKey: this.options.avatarPrivateKey,
        principalId: this.options.avatarPrincipalId,
        env: {
          ...(input.env ?? {}),
          ...this.getRootWorkspaceCapabilityEnv(),
        },
      }),
      stdin: input.stdin,
      mounts: [...this.getRootWorkspaceMounts()],
    });
  }

  private async execWorkspaceBash(input: {
    workspaceId: number;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    cwd: string;
  }> {
    const authority = this.findMountedWorkspaceAuthority(input.workspaceId);
    if (!authority) {
      throw new Error(`workspace not found: ${input.workspaceId}`);
    }
    const avatar = this.options.avatar ?? this.config?.avatar.nickname ?? "default";
    return await executeWorkspaceBash({
      workspacePath: authority.mount.workspacePath,
      avatar,
      command: input.command,
      cwd:
        typeof input.cwd === "string" && input.cwd.trim().length > 0
          ? resolveWorkspaceFsPath(input.cwd, this.getHomeDir())
          : authority.defaultCwd,
      env: buildPublicWorkspaceShellEnvironment({
        env: input.env,
      }),
      stdin: input.stdin,
      grants: authority.grants,
    });
  }

  private createWorkspaceToolProvider(): AgentToolProvider {
    return {
      name: "workspace-shell",
      createTools: ({ traceTool }) => {
        const traceWithContext = <TInput, TOutput>(
          toolName: string,
          input: TInput,
          handler: () => Promise<TOutput>,
          context?: { toolCallId?: string },
        ): Promise<TOutput> => traceTool(toolName, input, handler, { invocationId: context?.toolCallId });

        const listTool = toolDefinition({
          name: "workspace_list",
          description: "List mounted project workspaces currently held by this runtime.",
          outputSchema: z.array(
            z.object({
              id: z.number(),
              cwd: z.string(),
              alias: z.string(),
            }),
          ),
        }).server(async (_rawInput, context) =>
          traceWithContext("workspace_list", {}, async () => this.projectDirectWorkspaceList(), context),
        );

        const rootBashTool = toolDefinition({
          name: "root_bash",
          description:
            "Execute one-shot bash inside the fixed root-workspace with runtime CLI wiring and workspace capability env.",
          inputSchema: z.object({
            command: z.string(),
            cwd: z.string().optional(),
            env: z.record(z.string(), z.string()).optional(),
            stdin: z.string().optional(),
          }),
          outputSchema: z.object({
            stdout: z.string(),
            stderr: z.string(),
            exitCode: z.number(),
            cwd: z.string(),
          }),
        }).server(async (rawInput, context) => {
          const parsed = z
            .object({
              command: z.string(),
              cwd: z.string().optional(),
              env: z.record(z.string(), z.string()).optional(),
              stdin: z.string().optional(),
            })
            .parse(rawInput);
          return traceWithContext(
            "root_bash",
            {
              workspaceAlias: "root",
              ...parsed,
            },
            async () => await this.execRootWorkspaceBash(parsed),
            context,
          );
        });

        const workspaceBashTool = toolDefinition({
          name: "workspace_bash",
          description:
            "Execute one-shot bash inside one mounted public-workspace selected by workspaceId without root-workspace-exclusive CLI/env.",
          inputSchema: z.object({
            workspaceId: z.number().int().positive(),
            command: z.string(),
            cwd: z.string().optional(),
            env: z.record(z.string(), z.string()).optional(),
            stdin: z.string().optional(),
          }),
          outputSchema: z.object({
            stdout: z.string(),
            stderr: z.string(),
            exitCode: z.number(),
            cwd: z.string(),
          }),
        }).server(async (rawInput, context) => {
          const parsed = z
            .object({
              workspaceId: z.number().int().positive(),
              command: z.string(),
              cwd: z.string().optional(),
              env: z.record(z.string(), z.string()).optional(),
              stdin: z.string().optional(),
            })
            .parse(rawInput);
          const authority = this.findMountedWorkspaceAuthority(parsed.workspaceId);
          return traceWithContext(
            "workspace_bash",
            {
              ...parsed,
              workspaceAlias: authority?.mount.alias ?? null,
            },
            async () => await this.execWorkspaceBash(parsed),
            context,
          );
        });

        return [listTool, rootBashTool, workspaceBashTool];
      },
    };
  }

  private isMessageAttentionContext(match: AttentionActiveContextMatch): boolean {
    if (this.resolveMessageChatIdForContext(match.contextId)) {
      return true;
    }
    return match.recentCommits.some((commit) => parseMessageSourceSrc(commit.meta.src ?? "") !== null);
  }

  private isTerminalAttentionContext(match: AttentionActiveContextMatch): boolean {
    return (
      match.contextId.startsWith("ctx-terminal-") ||
      match.recentCommits.some((commit) => parseTerminalSourceSrc(commit.meta.src ?? "") !== null)
    );
  }

  private isTaskAttentionContext(match: AttentionActiveContextMatch): boolean {
    return (
      match.contextId.startsWith("ctx-task-") ||
      match.recentCommits.some((commit) => parseTaskSourceSrc(commit.meta.src ?? "") !== null)
    );
  }

  private isWorkspaceAttentionContext(match: AttentionActiveContextMatch): boolean {
    return (
      match.contextId.startsWith("ctx-workspace-") ||
      match.recentCommits.some((commit) => commit.meta.source === "workspace")
    );
  }

  private isSkillAttentionContext(match: AttentionActiveContextMatch): boolean {
    return (
      match.contextId === "ctx-workspace-runtime" ||
      match.recentCommits.some((commit) => commit.meta.source === "skill")
    );
  }

  private resolveAttentionSourceSystemId(match: AttentionActiveContextMatch): string {
    if (this.isMessageAttentionContext(match)) {
      return "message";
    }
    if (this.isTerminalAttentionContext(match)) {
      return "terminal";
    }
    if (this.isTaskAttentionContext(match)) {
      return "task";
    }
    if (this.isSkillAttentionContext(match)) {
      return "skill";
    }
    if (this.isWorkspaceAttentionContext(match)) {
      return "workspace";
    }
    const latestSource = match.recentCommits.find((commit) => typeof commit.meta.source === "string")?.meta.source;
    return latestSource ?? "attention";
  }

  private buildFocusedAttentionContextText(match: AttentionActiveContextMatch): string {
    return serializeFocusedAttentionContextBody(match);
  }

  private buildBackgroundAttentionContextText(match: AttentionActiveContextMatch): string {
    return serializeBackgroundAttentionContextBody(match);
  }

  private buildAttentionContextSeedPlan(match: AttentionActiveContextMatch): PendingAttentionMessagePlan | null {
    if (match.context.focusState === "muted") {
      return null;
    }
    const text =
      match.context.focusState === "focused"
        ? this.buildFocusedAttentionContextText(match)
        : this.buildBackgroundAttentionContextText(match);
    return {
      messageId: `attention-context:${match.contextId}:${match.context.headCommitId ?? "none"}:${match.context.focusState}`,
      contextId: match.contextId,
      kind: "context",
      text,
      headCommitId: match.context.headCommitId,
      updatedAt: match.context.updatedAt,
      seededFocusState: match.context.focusState === "focused" ? "focused" : "background",
      clearStageKeys: [],
      attentionCommitRefs: match.recentCommits
        .filter((commit) =>
          Object.keys(commit.scores).some((hash) => {
            const score = match.context.scoreMap[hash];
            return typeof score === "number" && score > 0;
          }),
        )
        .map((commit) => ({
          contextId: match.contextId,
          commitId: commit.commitId,
        })),
      clearsBoundaryRefresh: this.attentionBoundaryRefreshPending,
    };
  }

  private isSnapshotUsableForContext(
    snapshot: AttentionVisibleSnapshot | undefined,
    context: AttentionActiveContextMatch["context"],
  ): boolean {
    if (!snapshot) {
      return false;
    }
    if (context.focusState === "focused") {
      return snapshot.seededFocusState === "focused";
    }
    if (context.focusState === "background") {
      return snapshot.seededFocusState === "background" || snapshot.seededFocusState === "focused";
    }
    return false;
  }

  private buildAttentionItemsPlan(match: AttentionActiveContextMatch): PendingAttentionMessagePlan | null {
    const staged = this.stagedAttentionItemsByContext.get(match.contextId);
    if (!staged || staged.size === 0) {
      return null;
    }
    const commits = this.attentionSystem.getContext(match.contextId)?.listCommits() ?? [];
    const commitById = new Map(commits.map((commit) => [commit.commitId, commit] as const));
    const selectedEntries = [...staged.values()]
      .map((entry) => ({
        entry,
        commit: commitById.get(entry.commitId) ?? null,
      }))
      .filter((item): item is { entry: StagedAttentionItemEntry; commit: AttentionCommit } => item.commit !== null)
      .sort(
        (left, right) => left.entry.updatedAt - right.entry.updatedAt || left.entry.key.localeCompare(right.entry.key),
      );
    if (selectedEntries.length === 0) {
      return null;
    }
    const notifyEntries = selectedEntries.filter(({ entry }) => entry.isNotify);
    const allowedNotifyEntries =
      notifyEntries.length === 0
        ? notifyEntries
        : notifyEntries.filter(({ entry }) => {
            const quota = this.buildNotifyQuotaStatus({
              contextId: match.contextId,
              focusState: match.context.focusState,
              sourceId: entry.sourceId,
            });
            return quota.remaining.allowedNow;
          });
    const serializableEntries =
      allowedNotifyEntries.length > 0
        ? allowedNotifyEntries
        : match.context.focusState === "focused"
          ? selectedEntries
          : [];
    if (serializableEntries.length === 0) {
      return null;
    }
    const notifyOnly = allowedNotifyEntries.length > 0 && allowedNotifyEntries.length === serializableEntries.length;
    const items = serializableEntries.map(({ commit }) => ({
      contextId: match.contextId,
      commit,
    }));
    const latestUpdatedAt = serializableEntries.reduce((max, item) => Math.max(max, item.entry.updatedAt), 0);
    const notifyQuotaRecords = notifyOnly
      ? serializableEntries.map(({ entry }) => ({
          quotaTarget: this.buildNotifyQuotaTarget(match.contextId, entry.sourceId),
          focusState: match.context.focusState,
          sourceId: entry.sourceId,
          windowMs: this.resolveNotifyQuotaWindowMs(match.context.focusState) ?? 0,
        }))
      : [];
    return {
      messageId: `attention-items:${match.contextId}:${serializableEntries.map((item) => item.commit.commitId).join(",")}`,
      contextId: match.contextId,
      kind: "items",
      text: this.serializeAttentionItemsInput(items),
      headCommitId: match.context.headCommitId,
      updatedAt: new Date(latestUpdatedAt || Date.parse(match.context.updatedAt) || Date.now()).toISOString(),
      clearStageKeys: serializableEntries.map(({ entry }) => entry.key),
      attentionCommitRefs: serializableEntries.map(({ commit }) => ({
        contextId: match.contextId,
        commitId: commit.commitId,
      })),
      clearsBoundaryRefresh: false,
      notifyOnly,
      notifyQuotaRecords,
    };
  }

  private createAttentionProtocolInput(plan: PendingAttentionMessagePlan): LoopBusInput {
    const channel = this.resolveMessageChannelForContext(plan.contextId);
    const chatId = channel?.chatId ?? this.resolveMessageChatIdForContext(plan.contextId);
    const attentionCommitRefs = serializeAttentionCommitRefs(plan.attentionCommitRefs) ?? null;
    return {
      id: plan.messageId,
      name: `${plan.kind === "context" ? "AttentionContext" : "AttentionItems"}-${plan.contextId}`,
      role: "user",
      type: "text",
      source: "attention",
      text: plan.text,
      meta: {
        attentionContextId: plan.contextId,
        attentionContextIds: serializeAttentionContextIds([plan.contextId]) ?? null,
        attentionCommitRefs,
        attentionHeadCommitId: plan.headCommitId,
        attentionVisibleKind: plan.kind,
        owner: this.attentionSystem.getContext(plan.contextId)?.getState().owner ?? this.getAvatarName(),
        createdAt: plan.updatedAt,
        attentionProtocolKind: plan.kind,
        attentionMessagePlanId: plan.messageId,
        ...(plan.seededFocusState ? { attentionSeedFocusState: plan.seededFocusState } : {}),
        ...(channel ? { chatFocused: channel.focused } : {}),
        ...(chatId ? { chatId } : {}),
      },
    };
  }

  private selectAttentionProtocolPlan(
    match: AttentionActiveContextMatch,
    input: { reseedForDebt?: boolean } = {},
  ): PendingAttentionMessagePlan[] {
    const snapshot = this.attentionContextSnapshot.get(match.contextId);
    const hasUsableSnapshot = this.isSnapshotUsableForContext(snapshot, match.context);
    const itemsPlan = this.buildAttentionItemsPlan(match);
    const shouldReseedForDebt = input.reseedForDebt === true;
    if (!hasUsableSnapshot) {
      const seedPlan = this.buildAttentionContextSeedPlan(match);
      if (!seedPlan) {
        return itemsPlan ? [itemsPlan] : [];
      }
      return itemsPlan?.notifyOnly ? [mergeAttentionPlanCommitRefs(seedPlan, itemsPlan), itemsPlan] : [seedPlan];
    }
    if (shouldReseedForDebt) {
      const contextPlan = this.buildAttentionContextSeedPlan(match);
      if (!contextPlan) {
        return itemsPlan ? [itemsPlan] : [];
      }
      return [contextPlan];
    }
    if (!itemsPlan) {
      return [];
    }
    if (itemsPlan.notifyOnly) {
      return [itemsPlan];
    }
    if (match.context.focusState !== "focused") {
      return [];
    }
    const contextPlan = this.buildAttentionContextSeedPlan(match);
    if (!contextPlan) {
      return [itemsPlan];
    }
    // First-wave kernel law only compares full context text against item text.
    // Diff/patch-style context injection stays intentionally out of scope until
    // we have separate evidence that it remains readable and retry-safe.
    const contextCost = contextPlan.text.length * 1.5;
    const itemsCost = itemsPlan.text.length;
    return contextCost <= itemsCost ? [contextPlan] : [itemsPlan];
  }

  private async readMessageSource(request: LoopSourceReadRequest<MessageSourceParts>): Promise<LoopSourceReadResult> {
    const message = this.messageSystem.getMessage(request.parsed.chatId, request.parsed.messageId);
    const content = message?.content ?? "";
    const bytes = Buffer.byteLength(content, "utf8");
    return {
      kind: "snapshot",
      content,
      bytes,
      fromHash: null,
      toHash:
        typeof request.ref.versionHint === "string" || typeof request.ref.versionHint === "number"
          ? String(request.ref.versionHint)
          : null,
    };
  }

  private async toMessageAttentionDrafts(
    result: LoopSourceReadResult,
    request: LoopSourceReadRequest<MessageSourceParts>,
  ): Promise<AttentionDraft[]> {
    const chatId = request.parsed.chatId;
    const sourceMessageId = request.parsed.messageId;
    const message = this.messageSystem.getMessage(chatId, sourceMessageId);
    const actorRoom = this.getActorRoom(chatId, {
      includeArchived: true,
      touchPresence: false,
    });
    const channel = actorRoom ?? this.messageSystem.getChannel(chatId, { includeArchived: true });
    const content = message?.content ?? result.content;
    if (content.trim().length === 0 || content.trim() === "/compact") {
      return [];
    }
    const from = message?.from ?? channel?.title ?? chatId;
    const attachments = message ? cloneMessageAttachmentFacts(message) : [];
    const envelopeMeta = {
      chatId,
      chatTitle: channel?.title ?? chatId,
      chatKind: channel?.kind ?? "direct",
      chatContextId: channel?.contextId ?? this.getDefaultAttentionContextId(chatId),
      chatFocused: channel?.focused ?? false,
      messageId: message?.messageId ?? sourceMessageId,
      visibleAt: message?.visibleAt ?? message?.createdAt ?? null,
      senderContactId: message?.senderContactId ?? null,
      senderLabel: message?.from ?? from,
      ref: message?.ref ?? null,
    } satisfies Record<string, unknown>;
    const resolvedSourceMessageId = message?.messageId ?? sourceMessageId;
    return [
      {
        sourceRef:
          resolvedSourceMessageId !== null
            ? this.createMessageSourceRef({
                chatId,
                messageId: resolvedSourceMessageId,
              })
            : request.ref,
        content,
        from,
        score: 100,
        provenance: {
          author: from,
          source: "message",
          src: formatMessageSourceSrc({
            chatId,
            messageId: message?.messageId ?? sourceMessageId,
          }),
          createdAt:
            typeof message?.updatedAt === "number"
              ? new Date(message.updatedAt).toISOString()
              : typeof message?.createdAt === "number"
                ? new Date(message.createdAt).toISOString()
                : undefined,
        },
        presentation: {
          summary: truncateAttentionTitle(content.trim()),
          body: buildMessageFactEnvelope({
            message: message ?? {
              rowId: -1,
              messageId: sourceMessageId,
              chatId,
              ref: undefined,
              sourceSystemId: this.messageSystem.getSystemIdentity().systemId,
              from,
              kind: "text",
              content,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              visibleAt: undefined,
              readContactIds: [],
              unreadContactIds: [],
              senderContactId: undefined,
              metadata: undefined,
              attachments: undefined,
            },
            chatTitle: channel?.title ?? chatId,
            chatKind: channel?.kind ?? "direct",
            contextId: channel?.contextId ?? this.getDefaultAttentionContextId(chatId),
            focused: channel?.focused ?? false,
            attachments,
          }),
          bodyFormat: "text/markdown",
          changeType: "update",
        },
        // In message-system, attentionContext is the Avatar-authored summary of
        // the current topic. User room messages are pure AttentionItems: they
        // may create scores/history, but they must not rewrite that summary.
        contextMutation: "preserve",
        versionHint:
          typeof result.toHash === "string"
            ? result.toHash
            : message?.updatedAt
              ? String(message.updatedAt)
              : undefined,
      },
    ];
  }

  private async readTerminalSource(request: LoopSourceReadRequest<TerminalSourceParts>): Promise<LoopSourceReadResult> {
    const terminalId = request.parsed.terminalId;
    const payload = await this.readTerminalRepresentation(terminalId, {
      mode: request.mode ?? "auto",
      remark: true,
    });
    if ("ok" in payload) {
      return {
        kind: "snapshot",
        content: "",
        bytes: 0,
        fromHash: null,
        toHash: null,
      };
    }
    const kind = payload.kind === "terminal-diff" ? "diff" : "snapshot";
    const content = JSON.stringify(payload);
    return {
      kind,
      content,
      bytes: Buffer.byteLength(content, "utf8"),
      fromHash: typeof payload.fromHash === "string" ? payload.fromHash : null,
      toHash:
        typeof payload.toHash === "string" || typeof payload.seq === "number"
          ? String(payload.toHash ?? payload.seq)
          : null,
      semanticHash: this.terminalSemanticFingerprint[terminalId] ?? null,
      viewHash: this.terminalViewFingerprint[terminalId] ?? null,
    };
  }

  private async toTerminalAttentionDrafts(
    result: LoopSourceReadResult,
    request: LoopSourceReadRequest<TerminalSourceParts>,
  ): Promise<AttentionDraft[]> {
    if (result.content.trim().length === 0 || !hasMeaningfulTerminalAttentionPayload(result.content)) {
      return [];
    }
    const src = formatTerminalSourceSrc(request.parsed);
    const terminalId = request.parsed.terminalId;
    const presentation = buildTerminalAttentionPresentation(result.content, terminalId);
    return [
      {
        sourceRef: request.ref,
        content: result.content,
        from: `terminal:${terminalId}`,
        score: PASSIVE_TERMINAL_OBSERVATION_SCORE,
        provenance: {
          author: `terminal:${terminalId}`,
          source: "terminal",
          src,
          createdAt: new Date().toISOString(),
        },
        presentation: {
          summary: presentation.title,
          body: presentation.detailValue,
          bodyFormat: presentation.detailFormat,
          changeType: presentation.detailKind === "patch" ? "diff" : "update",
        },
        semanticHash: typeof result.semanticHash === "string" ? result.semanticHash : undefined,
        versionHint: typeof result.toHash === "string" ? result.toHash : undefined,
        supersedeActive: {
          src,
        },
      },
    ];
  }

  private async buildTerminalSystemIngressEnvelope(
    terminalId: string,
    input: { mode?: TerminalReadMode } = {},
  ): Promise<RuntimeSystemIngressEnvelope | null> {
    const previewPayload = await this.readTerminalRepresentation(terminalId, {
      mode: input.mode ?? "auto",
      remark: false,
    });
    if ("ok" in previewPayload) {
      return null;
    }
    const previewContent = JSON.stringify(previewPayload);
    if (!hasMeaningfulTerminalAttentionPayload(previewContent)) {
      return null;
    }

    const payload = await this.readTerminalRepresentation(terminalId, {
      mode: input.mode ?? "auto",
      remark: true,
    });
    if ("ok" in payload) {
      return null;
    }
    const content = JSON.stringify(payload);
    if (!hasMeaningfulTerminalAttentionPayload(content)) {
      return null;
    }
    const presentation = buildTerminalAttentionPresentation(content, terminalId);
    const sourceId = formatTerminalSourceSrc({ terminalId });
    return {
      system: "terminal",
      boundaryChannel: "world_fact",
      sourceId,
      contextKey: this.getTerminalAttentionContextId(terminalId),
      kind: payload.kind === "terminal-diff" ? "terminal_diff" : "terminal_snapshot",
      summary: presentation.title,
      content: presentation.detailValue,
      format: presentation.detailFormat,
      changeType: presentation.detailKind === "patch" ? "diff" : "update",
      score: PASSIVE_TERMINAL_OBSERVATION_SCORE,
      tags: ["terminal", payload.kind === "terminal-diff" ? "diff" : "snapshot"],
      createdAt: Date.now(),
      author: `terminal:${terminalId}`,
      supersedeActiveSrc: sourceId,
      meta: {
        terminalId,
        kind: payload.kind,
        fromHash: "fromHash" in payload ? (payload.fromHash ?? null) : null,
        toHash:
          "toHash" in payload
            ? (payload.toHash ?? null)
            : "seq" in payload && typeof payload.seq === "number"
              ? String(payload.seq)
              : null,
      },
    };
  }

  private emitFocusedTerminal(): void {
    this.emit("focusedTerminal", {
      terminalIds: [...this.focusedTerminalIds],
      terminalId: this.focusedTerminalIds[0] ?? null,
    });
  }

  private normalizeFocusedTerminalIds(input: Iterable<string>): string[] {
    const visibleIds = new Set(
      this.terminalControlPlane.listForActor(this.terminalActorId).map((terminal) => terminal.terminalId),
    );
    const deduped = new Set<string>();
    for (const terminalId of input) {
      if (!visibleIds.has(terminalId) || deduped.has(terminalId)) {
        continue;
      }
      const managed = this.terminalControlPlane.getManagedTerminal(terminalId);
      if (managed) {
        this.attachRuntimeTerminal(terminalId, managed);
      }
      deduped.add(terminalId);
    }
    return [...deduped];
  }

  private invalidateFocusedTerminals(reason: string): void {
    void reason;
    this.terminalKernelAdapter.syncFocusedDirtyTerminals();
  }

  private isTerminalActionable(terminalId: string): boolean {
    const status = this.terminalStatusById.get(terminalId);
    if (!status) {
      return false;
    }
    if (status.processPhase !== "running") {
      return false;
    }
    if (status.lifecycleTransition !== null) {
      return true;
    }
    return status.status === "IDLE" || status.status === "BUSY";
  }

  private async getTerminalHeadHash(terminalId: string): Promise<string | null> {
    if (this.terminalControlPlane.has(terminalId)) {
      const sealed = await this.terminalControlPlane.sealIdleCommit(terminalId);
      if (sealed.ok) {
        return sealed.hash;
      }
      return this.terminalControlPlane.getHeadHash(terminalId);
    }
    const terminal = this.terminals.get(terminalId) as
      | Partial<Pick<TerminalRuntime, "getHeadHash" | "sealIdleCommit">>
      | undefined;
    const sealed = await terminal?.sealIdleCommit?.();
    if (sealed?.ok) {
      return sealed.hash;
    }
    return terminal?.getHeadHash?.() ?? null;
  }

  private getTerminalReadCursorHash(terminalId: string): string | null {
    if (this.terminalControlPlane.has(terminalId)) {
      return this.terminalControlPlane.getReadCursorHashAuthorized({
        terminalId,
        actorId: this.terminalActorId,
      });
    }
    return this.terminalReadCursorHashById[terminalId] ?? null;
  }

  private getTerminalCommitWaitHash(terminalId: string): string | null {
    if (this.terminalControlPlane.has(terminalId)) {
      return this.terminalControlPlane.getHeadHash(terminalId);
    }
    return this.terminals.get(terminalId)?.getHeadHash() ?? null;
  }

  private waitTerminalCommitted(
    terminalId: string,
    input: { fromHash?: string | null } = {},
  ): { promise: Promise<{ toHash: string | null }>; reject: (reason: unknown) => void } {
    if (this.terminalControlPlane.has(terminalId)) {
      return this.terminalControlPlane.waitCommitted(terminalId, input);
    }
    const terminal = this.terminals.get(terminalId);
    return (
      terminal?.waitCommitted(input) ?? {
        promise: Promise.resolve({ toHash: null }),
        reject: () => {},
      }
    );
  }

  private updateFocusedTerminals(op: TerminalFocusOp, terminalIds: string[] = []): string[] {
    const incoming = this.normalizeFocusedTerminalIds(terminalIds);
    const next = this.terminalControlPlane.focusForActor(this.terminalActorId, op, incoming);
    this.focusedTerminalIds = [...next];
    this.emitFocusedTerminal();
    this.invalidateFocusedTerminals(`focus-${op}`);
    return next;
  }

  private resolveAttentionContextId(draft: AttentionDraft): string {
    const explicitMessageSource =
      typeof draft.provenance?.src === "string" ? parseMessageSourceSrc(draft.provenance.src) : null;
    if (explicitMessageSource) {
      return this.ensureAttentionContextForChannel(explicitMessageSource.chatId).contextId;
    }
    const messageSource = parseMessageSourceSrc(draft.sourceRef.src);
    if (messageSource) {
      return this.ensureAttentionContextForChannel(messageSource.chatId).contextId;
    }
    const terminalSource = parseTerminalSourceSrc(draft.sourceRef.src);
    if (terminalSource) {
      const contextId = this.getTerminalAttentionContextId(terminalSource.terminalId);
      const existing = this.attentionSystem.getContext(contextId);
      if (existing) {
        return existing.contextId;
      }
      return this.attentionSystem.createContext({
        contextId,
        owner: this.getAvatarName(),
      }).contextId;
    }
    const taskSubjectId = parseTaskSourceSrc(draft.sourceRef.src);
    const contextId = taskSubjectId ? `ctx-task-${taskSubjectId}` : `ctx-source-${createId()}`;
    const existing = this.attentionSystem.getContext(contextId);
    if (existing) {
      return existing.contextId;
    }
    return this.attentionSystem.createContext({
      contextId,
      owner: this.getAvatarName(),
    }).contextId;
  }

  private buildAttentionMeta(draft: AttentionDraft): AttentionCommitMeta {
    const input = draft.provenance ?? {};
    const sourceKind = resolveRuntimeSourceKind(draft.sourceRef.src);
    return {
      author: typeof input.author === "string" && input.author.length > 0 ? input.author : draft.from,
      source: typeof input.source === "string" && input.source.length > 0 ? input.source : sourceKind,
      src: typeof input.src === "string" ? input.src : draft.sourceRef.src,
      tags: Array.isArray(input.tags) ? [...input.tags] : undefined,
      createdAt: typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString(),
    };
  }

  private buildAttentionScores(draft: AttentionDraft): Record<string, number> {
    const score = Math.max(0, Math.trunc(draft.score ?? 100));
    const tokens = new Set<string>();

    tokens.add(
      this.attentionHashAliases.ensureTokenForDigest(buildAttentionScoreDigest(buildAttentionScoreSubjectSeed(draft))),
    );

    const semanticSeed = buildAttentionScoreSemanticSeed(draft);
    if (semanticSeed) {
      tokens.add(this.attentionHashAliases.ensureTokenForDigest(buildAttentionScoreDigest(semanticSeed)));
    }

    return Object.fromEntries([...tokens].map((token) => [token, score]));
  }

  private buildAttentionCommitInput(
    draft: AttentionDraft,
    input: { contextIdOverride?: string; target?: string; ingressTypeOverride?: AttentionCommit["ingressType"] } = {},
  ): AttentionCommitToolInput {
    const contextId = input.contextIdOverride ?? this.resolveAttentionContextId(draft);
    const normalizedContent = draft.content.trim();
    const terminalSource = parseTerminalSourceSrc(draft.sourceRef.src);
    const taskSubjectId = parseTaskSourceSrc(draft.sourceRef.src);
    const presentation = draft.presentation
      ? {
          summary: draft.presentation.summary,
          content: draft.presentation.body,
          format: draft.presentation.bodyFormat,
          changeType: draft.presentation.changeType ?? ("update" as const),
        }
      : terminalSource
        ? (() => {
            const terminalPresentation = buildTerminalAttentionPresentation(draft.content, terminalSource.terminalId);
            return {
              summary: terminalPresentation.title,
              content: terminalPresentation.detailValue,
              format: terminalPresentation.detailFormat,
              changeType: terminalPresentation.detailKind === "patch" ? ("diff" as const) : ("update" as const),
            };
          })()
        : taskSubjectId
          ? (() => {
              const taskPresentation = buildTaskAttentionPresentation(draft.content, taskSubjectId);
              return {
                summary: taskPresentation.title,
                content: taskPresentation.detailValue,
                format: taskPresentation.detailFormat,
                changeType: "update" as const,
              };
            })()
          : {
              summary: truncateAttentionTitle(normalizedContent),
              content: draft.content,
              format: "application/json",
              changeType: "update" as const,
            };
    return {
      contextId,
      target: input.target,
      ingressType: input.ingressTypeOverride,
      contextMutation: draft.contextMutation ?? "preserve",
      meta: this.buildAttentionMeta(draft),
      scores: this.buildAttentionScores(draft),
      summary: presentation.summary,
      change: {
        type: presentation.changeType,
        value: presentation.content,
        format: presentation.format,
      },
    };
  }

  private buildResolvedAttentionScores(scores: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.keys(scores).map((key) => [key, 0]));
  }

  private buildResolvedAttentionScoresForContext(contextId: string): Record<string, number> {
    const context = this.attentionSystem.getContext(contextId);
    if (!context) {
      return {};
    }
    const activeScores = Object.entries(context.getState().scoreMap).filter(([, value]) => value > 0);
    if (activeScores.length === 0) {
      return {};
    }
    return Object.fromEntries(activeScores.map(([key]) => [key, 0]));
  }

  private resolveRuntimeIngressInitialFocusState(envelope: RuntimeSystemIngressEnvelope): AttentionFocusState {
    if (envelope.system === "message") {
      const chatFocused = envelope.meta?.chatFocused;
      return chatFocused === true ? "focused" : "background";
    }
    if (envelope.system === "terminal") {
      const terminalId = typeof envelope.meta?.terminalId === "string" ? envelope.meta.terminalId : null;
      if (terminalId && this.focusedTerminalIds.includes(terminalId)) {
        return "focused";
      }
      return "background";
    }
    return "background";
  }

  private buildLifecycleIngressEnvelope(input: {
    system: RuntimeSystemIngressEnvelope["system"];
    src: string;
    contextId: string;
    event: string;
    summary: string;
    payload?: Record<string, unknown>;
    score?: number;
    ingressType?: "commit" | "push";
    boundaryChannel?: RuntimeSystemIngressEnvelope["boundaryChannel"];
  }): RuntimeSystemIngressEnvelope {
    const bridgeId = resolveLifecycleBridgeId(input.src);
    const score = Math.max(
      0,
      Math.trunc(
        input.score ??
          this.resolveLifecycleAttentionScore({
            bridgeId,
            event: input.event,
          }),
      ),
    );
    const detail = buildLifecycleAttentionDetail(input.src, bridgeId, input.event, input.payload);
    return {
      system: input.system,
      boundaryChannel: input.boundaryChannel ?? "scheduler_signal",
      sourceId: input.src,
      contextKey: input.contextId,
      kind: input.event,
      summary: input.summary,
      content: mdFence("yaml", detail),
      format: "text/markdown",
      score,
      tags: [input.system, "lifecycle", input.event],
      createdAt: Date.now(),
      author: this.getAvatarName(),
      ingressType: input.ingressType,
      meta: input.payload,
    };
  }

  private enqueueRoomLifecycleAttentionCommit(input: {
    chatId: string;
    contextId: string;
    event: string;
    summary: string;
    payload?: Record<string, unknown>;
    score?: number;
    ingressType?: "commit" | "push";
    boundaryChannel?: RuntimeSystemIngressEnvelope["boundaryChannel"];
  }): void {
    this.messageKernelAdapter.commitLifecycleIngress(
      this.buildLifecycleIngressEnvelope({
        system: "message",
        src: formatRoomAttentionSrc({ roomId: input.chatId }),
        contextId: input.contextId,
        event: input.event,
        summary: input.summary,
        payload: input.payload,
        score: input.score,
        ingressType: input.ingressType,
        boundaryChannel: input.boundaryChannel,
      }),
    );
  }

  private async enqueueTerminalLifecycleAttentionCommit(input: {
    terminalId: string;
    contextId: string;
    event: string;
    summary: string;
    payload?: Record<string, unknown>;
    score?: number;
    ingressType?: "commit" | "push";
    boundaryChannel?: RuntimeSystemIngressEnvelope["boundaryChannel"];
  }): Promise<void> {
    await this.terminalKernelAdapter.commitLifecycleIngress(input);
  }

  private buildContextPreservingChange(contextId: string): AttentionCommitChange {
    const state = this.attentionSystem.getContext(contextId)?.getState();
    if (!state) {
      return { type: "clean" };
    }
    return {
      type: "update",
      value: state.content,
      format: state.contentFormat,
    };
  }

  private supersedeAttentionDraftItems(draft: AttentionDraft, contextId: string): void {
    const supersede = draft.supersedeActive;
    if (!supersede) {
      return;
    }
    const context = this.attentionSystem.getContext(contextId);
    if (!context) {
      return;
    }
    const activeCommits = context
      .queryCommits({ minScore: 1, limit: 200 })
      .map((entry) => entry.commit)
      .filter((commit) => commit.meta.src === supersede.src);
    if (activeCommits.length === 0) {
      return;
    }
    const supersededAt = new Date().toISOString();
    for (const commit of activeCommits) {
      this.attentionSystem.commit(contextId, {
        parentCommitIds: [context.getState().headCommitId ?? commit.commitId].filter(
          (value): value is string => value !== null,
        ),
        meta: {
          author: this.getAvatarName(),
          source: "attention",
          src: supersede.src,
          tags: ["supersede", "source-refresh", supersededAt],
        },
        scores: this.buildResolvedAttentionScores(commit.scores),
        summary: `Supersede ${commit.summary}`,
        change: this.buildContextPreservingChange(contextId),
      });
    }
  }

  private async handleCommittedAttentionCommit(
    contextId: string,
    commit: AttentionCommit,
    input: { notifyLoop: boolean },
  ): Promise<void> {
    const wakeableAttentionIngress = this.isWakeableAttentionIngress(contextId, commit);
    const externalAttentionIngress = commit.meta.source !== "attention";
    if (externalAttentionIngress && wakeableAttentionIngress) {
      this.markAttentionContextDirty(contextId, commit.commitId);
      this.stageAttentionCommit(contextId, commit);
    }
    this.recordAttentionCommitTrace(contextId, commit, input);
    this.attentionFactsVersion += 1;
    if (externalAttentionIngress && wakeableAttentionIngress) {
      this.clearAttentionContainment(contextId);
      this.resetAttentionDebtBackoff();
    }
    await this.persistAttentionSystem();
    this.markActiveCycleProducedCommitRef(contextId, commit.commitId);
    this.emitAttentionState();
    if (input.notifyLoop && externalAttentionIngress && wakeableAttentionIngress) {
      this.notifyInput("attention");
    }
    if (this.isTerminalKilledCommit(commit)) {
      await this.applyAttentionFocusState(contextId, "muted");
    }
    const contextState = this.attentionSystem.getContext(contextId)?.getState();
    if (!contextState) {
      return;
    }
    const hookResults = await this.loopPluginRuntime?.notifyAttentionCommitted(
      { contextId, context: contextState, commit },
      { contextId },
    );
    for (const result of hookResults ?? []) {
      this.recordAttentionHook(contextId, commit.commitId, result);
    }
  }

  private isTerminalKilledCommit(commit: AttentionCommit): boolean {
    return (
      commit.meta.source === "terminal" &&
      commit.meta.tags?.includes("lifecycle") === true &&
      commit.meta.tags.includes("terminal_killed")
    );
  }

  private async notifyAttentionDispatchedHooks(input: AttentionDispatchedInput): Promise<AttentionCommitHookResult[]> {
    const results = await this.loopPluginRuntime?.notifyAttentionDispatched(input, {
      contextId: input.contextId,
      commitId: input.commit.commitId,
      dispatchId: input.dispatch.dispatchId,
      cycleId: input.dispatch.cycleId,
      agentCallId: input.dispatch.agentCallId,
      sessionModelCallId: input.dispatch.sessionModelCallId,
    });
    return results ?? [];
  }

  private async notifyAttentionReceiptHooks(input: AttentionReceiptInput): Promise<AttentionCommitHookResult[]> {
    const results = await this.loopPluginRuntime?.notifyAttentionReceipt(input, {
      contextId: input.contextId,
      commitId: input.commit.commitId,
      dispatchId: input.dispatch.dispatchId,
      cycleId: input.dispatch.cycleId,
      agentCallId: input.dispatch.agentCallId,
      sessionModelCallId: input.dispatch.sessionModelCallId,
    });
    return results ?? [];
  }

  private async handleRuntimeSkillRefreshResult(
    result: ReturnType<RuntimeSkillSystem["refresh"]>,
    input: { notifyLoop: boolean },
  ): Promise<RuntimeSkillKernelApplyResult> {
    return await this.skillKernelAdapter.applyRefreshResult(result, input);
  }

  private async flushPendingRuntimeSkillChanges(): Promise<void> {
    const result = this.runtimeSkillSystem?.flushPendingChanges();
    if (!result) {
      return;
    }
    await this.handleRuntimeSkillRefreshResult(result, {
      notifyLoop: false,
    });
  }

  private toAttentionDraftFromRuntimeSystemIngress(envelope: RuntimeSystemIngressEnvelope): AttentionDraft {
    return {
      sourceRef: {
        src: envelope.sourceId,
        reason: envelope.kind,
      },
      content: envelope.content,
      from: envelope.author,
      score: envelope.score,
      provenance: {
        author: envelope.author,
        source: envelope.system,
        src: envelope.sourceId,
        tags: envelope.tags,
        createdAt: new Date(envelope.createdAt).toISOString(),
      },
      presentation: {
        summary: envelope.summary,
        body: envelope.content,
        bodyFormat: envelope.format,
        changeType: envelope.changeType ?? "update",
      },
      contextMutation: envelope.contextMutation ?? "preserve",
      ...(envelope.supersedeActiveSrc
        ? {
            supersedeActive: {
              src: envelope.supersedeActiveSrc,
            },
          }
        : {}),
    };
  }

  private async commitAttentionDraft(
    draft: AttentionDraft,
    input: {
      notifyLoop: boolean;
      contextIdOverride?: string;
      contextFocusState?: AttentionFocusState;
      recordSourceReadTrace?: boolean;
      target?: string;
      commitMode?: RuntimeSystemIngressEnvelope["commitMode"];
      ingressTypeOverride?: AttentionCommit["ingressType"];
    },
  ): Promise<{ changed: boolean; result: RuntimeIngressCommitResult | null }> {
    const digest = stableAttentionDraftDigest(draft);
    const sourceKey = draft.sourceRef.src;
    if (this.attentionSourceDigests.get(sourceKey) === digest) {
      return {
        changed: false,
        result: null,
      };
    }
    this.attentionSourceDigests.set(sourceKey, digest);
    const contextId = input.contextIdOverride ?? this.resolveAttentionContextId(draft);
    this.supersedeAttentionDraftItems(draft, contextId);
    const commitInput = this.buildAttentionCommitInput(draft, {
      contextIdOverride: contextId,
      target: input.target,
      ingressTypeOverride: input.ingressTypeOverride,
    });
    const { commit } = applyAttentionCommitWithContext({
      system: this.attentionSystem,
      context: {
        contextId,
        owner: draft.from,
        focusState: input.contextFocusState,
      },
      commit: {
        target: commitInput.target,
        ingressType: commitInput.ingressType,
        parentCommitIds: commitInput.parentCommitIds,
        contextMutation: commitInput.contextMutation,
        meta: commitInput.meta,
        scores: commitInput.scores,
        summary: commitInput.summary,
        change: commitInput.change,
      },
      commitMode: input.commitMode,
    });
    if (input.recordSourceReadTrace ?? false) {
      this.recordDraftSourceReadTrace(draft, contextId, commit.commitId);
    }
    await this.handleCommittedAttentionCommit(contextId, commit, {
      notifyLoop: input.notifyLoop,
    });
    return {
      changed: true,
      result: {
        contextId,
        commit,
      },
    };
  }

  private async commitRuntimeSystemIngress(
    envelope: RuntimeSystemIngressEnvelope,
    input: { notifyLoop: boolean },
  ): Promise<RuntimeIngressCommitResult | null> {
    const { result } = await this.commitAttentionDraft(this.toAttentionDraftFromRuntimeSystemIngress(envelope), {
      notifyLoop: input.notifyLoop,
      contextIdOverride: envelope.contextKey,
      contextFocusState: this.resolveRuntimeIngressInitialFocusState(envelope),
      recordSourceReadTrace: false,
      target: envelope.target,
      commitMode: envelope.commitMode,
      ingressTypeOverride: envelope.ingressType,
    });
    return result;
  }

  private async commitAttentionDrafts(drafts: AttentionDraft[]): Promise<boolean> {
    if (drafts.length === 0) {
      return false;
    }
    let changed = false;
    for (const draft of drafts) {
      const result = await this.commitAttentionDraft(draft, {
        notifyLoop: false,
        recordSourceReadTrace: true,
      });
      changed ||= result.changed;
    }
    return changed;
  }

  private async flushPluginAttentionDrafts(): Promise<boolean> {
    if (!this.loopPluginRuntime || !this.loopPluginRuntime.hasInvalidations()) {
      return false;
    }
    const drafts = await this.loopPluginRuntime.readInvalidatedAttentionDrafts();
    if (drafts.length === 0) {
      return false;
    }
    return await this.commitAttentionDrafts(drafts);
  }

  private buildAttentionRuntimeState(): SessionRuntimeAttentionState {
    return {
      snapshot: this.attentionSystem.snapshot(),
      active: this.attentionSystem.listActiveContexts(),
      cycleFrames: [...this.attentionCycleFrames.values()]
        .sort((left, right) => left.createdAt - right.createdAt || left.cycleId - right.cycleId)
        .map(cloneAttentionCycleFrame),
      hooks: this.recentAttentionHooks.map(cloneAttentionHookRecord),
    };
  }

  private buildAttentionRuntimePreviewState(): SessionRuntimeAttentionState {
    return createRuntimeAttentionPreview(this.buildAttentionRuntimeState());
  }

  private buildAttentionDeliveryRuntimeState(): SessionRuntimeAttentionDeliveryState {
    const timeline = this.runtimeKernelHost.queryAttentionDeliveryTimeline({});
    return {
      projections: this.runtimeKernelHost.listDeliveryProjections().map(cloneAttentionDeliveryProjection),
      dispatches: timeline.dispatches.map(cloneAttentionDispatchRecord),
      receipts: timeline.receipts.map(cloneAttentionReceiptRecord),
      watches: [],
      effects: [...this.effectLedgerRecords.values()]
        .sort((left, right) => left.timestamp - right.timestamp || left.id - right.id)
        .map(cloneEffectLedgerRecord),
    };
  }

  private emitAttentionState(): void {
    this.emit("attentionUpdated", this.buildAttentionRuntimePreviewState());
  }

  private emitAttentionDeliveryState(): void {
    this.emit("attentionDeliveryUpdated", this.buildAttentionDeliveryRuntimeState());
  }

  private emitAttentionDispatch(input: RuntimeEventMap["attentionDispatch"]): void {
    this.emit("attentionDispatch", {
      reason: input.reason,
      commitRef: {
        contextId: input.commitRef.contextId,
        commitId: input.commitRef.commitId,
        createdAt: input.commitRef.createdAt,
      },
      dispatch: cloneAttentionDispatchRecord(input.dispatch),
      projection: input.projection ? cloneAttentionDeliveryProjection(input.projection) : null,
    });
  }

  private emitAttentionReceipt(input: RuntimeEventMap["attentionReceipt"]): void {
    this.emit("attentionReceipt", {
      commitRef: {
        contextId: input.commitRef.contextId,
        commitId: input.commitRef.commitId,
        createdAt: input.commitRef.createdAt,
      },
      dispatch: cloneAttentionDispatchRecord(input.dispatch),
      receipt: cloneAttentionReceiptRecord(input.receipt),
      projection: input.projection ? cloneAttentionDeliveryProjection(input.projection) : null,
    });
  }

  private restoreAttentionDeliveryState(): void {
    if (!this.sessionDb) {
      return;
    }
    // Message follow-up ownership moved into message-system room durability.
    // Legacy session-local runtime watches are intentionally ignored here so a
    // restart cannot double-arm both schedulers at once.
    this.effectLedgerRecords.clear();
    for (const effect of this.sessionDb.listEffectLedger()) {
      this.effectLedgerRecords.set(effect.effectId, effect);
    }
    const commitRefs = this.attentionSystem.snapshot().contexts.flatMap((context) =>
      context.commits.map((commit) => ({
        contextId: context.contextId,
        commitId: commit.commitId,
        createdAt: Date.parse(commit.createdAt) || Date.now(),
      })),
    );
    const dispatches = this.sessionDb
      .listAttentionDispatches()
      .map((dispatch) => this.toKernelDispatchRecord(dispatch));
    const receipts = this.sessionDb.listAttentionReceipts().map((receipt) => this.toKernelReceiptRecord(receipt));
    this.runtimeKernelHost.restoreTimeline({
      commitRefs,
      dispatches,
      receipts,
    });
  }

  private toKernelDispatchRecord(record: SessionAttentionDispatchRecord): AttentionDispatchRecord {
    return {
      dispatchId: record.dispatchId,
      contextId: record.contextId,
      commitId: record.commitId,
      cycleId: record.cycleId,
      attemptIndex: record.attemptIndex,
      agentCallId: record.agentCallId,
      sessionModelCallId: record.sessionModelCallId,
      createdAt: record.createdAt,
    };
  }

  private toKernelReceiptRecord(record: SessionAttentionReceiptRecord): AttentionReceiptRecord {
    return {
      receiptId: record.receiptId,
      dispatchId: record.dispatchId,
      contextId: record.contextId,
      commitId: record.commitId,
      cycleId: record.cycleId,
      attemptIndex: record.attemptIndex,
      agentCallId: record.agentCallId,
      sessionModelCallId: record.sessionModelCallId,
      status: record.status,
      providerEventKind: record.providerEventKind,
      timestamp: record.timestamp,
      finishReason: record.finishReason,
      usage: record.usage ? { ...record.usage } : undefined,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      meta: record.meta ? structuredClone(record.meta) : undefined,
    };
  }

  private recordAttentionDispatch(dispatch: AttentionDispatchRecord): void {
    if (!this.sessionDb) {
      return;
    }
    const existing = this.sessionDb.getAttentionDispatchByDispatchId(dispatch.dispatchId);
    if (!existing) {
      this.sessionDb.appendAttentionDispatch({
        dispatchId: dispatch.dispatchId,
        contextId: dispatch.contextId,
        commitId: dispatch.commitId,
        cycleId: dispatch.cycleId,
        attemptIndex: dispatch.attemptIndex,
        agentCallId: dispatch.agentCallId,
        sessionModelCallId: dispatch.sessionModelCallId,
        createdAt: dispatch.createdAt,
        updatedAt: dispatch.createdAt,
      });
      return;
    }
    if (dispatch.sessionModelCallId !== null && existing.sessionModelCallId !== dispatch.sessionModelCallId) {
      this.sessionDb.bindAttentionDispatchModelCall(dispatch.dispatchId, dispatch.sessionModelCallId, Date.now());
    }
  }

  private recordAttentionReceipt(receipt: AttentionReceiptRecord): void {
    if (!this.sessionDb || this.sessionDb.getAttentionReceiptByReceiptId(receipt.receiptId)) {
      return;
    }
    this.sessionDb.appendAttentionReceipt({
      receiptId: receipt.receiptId,
      dispatchId: receipt.dispatchId,
      contextId: receipt.contextId,
      commitId: receipt.commitId,
      cycleId: receipt.cycleId,
      attemptIndex: receipt.attemptIndex,
      agentCallId: receipt.agentCallId,
      sessionModelCallId: receipt.sessionModelCallId,
      status: receipt.status,
      providerEventKind: receipt.providerEventKind,
      timestamp: receipt.timestamp,
      finishReason: receipt.finishReason,
      usage: receipt.usage ? { ...receipt.usage } : undefined,
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
      meta: receipt.meta ? structuredClone(receipt.meta) : undefined,
    });
  }

  private publishAttentionDispatch(input: {
    reason: "created" | "bound";
    commitRef: DeliveryCommitRefRecord;
    dispatch: AttentionDispatchRecord;
    projection: AttentionDeliveryProjection | null;
  }): void {
    this.emitAttentionDispatch(input);
  }

  private publishAttentionReceipt(input: {
    commitRef: DeliveryCommitRefRecord;
    dispatch: AttentionDispatchRecord;
    receipt: AttentionReceiptRecord;
    projection: AttentionDeliveryProjection | null;
  }): void {
    this.emitAttentionReceipt(input);
  }

  private buildCycleTraceRefs(cycleId: number): SessionTraceRef[] {
    const refs: SessionTraceRef[] = [toCycleFrameTraceRef(cycleId)];
    const frame = this.attentionCycleFrames.get(cycleId);
    for (const contextId of frame?.inputContextIds ?? []) {
      refs.push(toAttentionContextTraceRef(contextId));
    }
    for (const commitRef of frame?.producedCommitRefs ?? []) {
      refs.push(toAttentionCommitTraceRef(commitRef.contextId, commitRef.commitId));
    }
    return mergeTraceRefs(refs);
  }

  private upsertTraceRow(
    input:
      | (Omit<SessionDbLoopbusTraceRecord, "id" | "seq"> & { spanId: string })
      | (PendingTraceSpan & { cycleId?: never }),
  ): SessionDbLoopbusTraceRecord | null {
    if (typeof (input as { cycleId?: number }).cycleId !== "number") {
      return null;
    }
    const nextInput = input as Omit<SessionDbLoopbusTraceRecord, "id" | "seq">;
    const existingRowId = this.traceRowIdBySpanId.get(nextInput.spanId);
    const current =
      existingRowId === undefined ? null : (this.loopTraceEntries.find((entry) => entry.id === existingRowId) ?? null);
    const mergedLinks =
      current === null
        ? nextInput.links
        : [
            ...current.links,
            ...nextInput.links.filter(
              (link) =>
                !current.links.some(
                  (currentLink) =>
                    currentLink.kind === link.kind &&
                    currentLink.traceId === link.traceId &&
                    currentLink.spanId === link.spanId &&
                    currentLink.ref?.kind === link.ref?.kind &&
                    currentLink.ref?.ref === link.ref?.ref,
                ),
            ),
          ];
    const mergedEvents =
      current === null
        ? nextInput.events
        : [
            ...current.events,
            ...nextInput.events.filter((event) => !current.events.some((currentEvent) => currentEvent.id === event.id)),
          ];
    const mergedInput = {
      ...nextInput,
      refs: mergeTraceRefs(current?.refs, nextInput.refs),
      links: mergedLinks,
      events: mergedEvents,
      attributes: {
        ...(current?.attributes ?? {}),
        ...nextInput.attributes,
      },
      outcome: nextInput.outcome ?? current?.outcome,
    };
    const row =
      existingRowId === undefined
        ? (() => {
            const created: SessionDbLoopbusTraceRecord = {
              id: ++this.loopTraceSeq,
              seq: this.loopTraceSeq,
              cycleId: mergedInput.cycleId,
              traceId: mergedInput.traceId,
              spanId: mergedInput.spanId,
              parentSpanId: mergedInput.parentSpanId,
              kind: mergedInput.kind,
              name: mergedInput.name,
              status: mergedInput.status,
              startedAt: mergedInput.startedAt,
              endedAt: mergedInput.endedAt,
              refs: mergedInput.refs,
              links: mergedInput.links,
              events: mergedInput.events,
              attributes: mergedInput.attributes,
              outcome: mergedInput.outcome,
            };
            this.loopTraceEntries.push(created);
            return created;
          })()
        : (() => {
            const index = this.loopTraceEntries.findIndex((entry) => entry.id === existingRowId);
            const updated: SessionDbLoopbusTraceRecord = {
              ...(current as SessionDbLoopbusTraceRecord),
              parentSpanId: mergedInput.parentSpanId,
              status: mergedInput.status,
              endedAt: mergedInput.endedAt,
              refs: mergedInput.refs,
              links: mergedInput.links,
              events: mergedInput.events,
              attributes: mergedInput.attributes,
              outcome: mergedInput.outcome,
            };
            if (index >= 0) {
              this.loopTraceEntries.splice(index, 1, updated);
            }
            return updated;
          })();
    this.traceRowIdBySpanId.set(row.spanId, row.id);
    if (row.status === "running") {
      this.runningTraceRowsByName.set(row.name, row);
    } else {
      const currentRunning = this.runningTraceRowsByName.get(row.name);
      if (currentRunning?.spanId === row.spanId) {
        this.runningTraceRowsByName.delete(row.name);
      }
    }
    this.emit("observabilityTrace", { entry: row });
    return row;
  }

  private queuePendingTraceSpan(span: PendingTraceSpan): void {
    this.pendingTraceSpans.push({
      ...span,
      refs: mergeTraceRefs(span.refs),
      links: span.links.map((link) => ({
        ...link,
        ref: link.ref
          ? {
              ...link.ref,
              attributes: link.ref.attributes ? { ...link.ref.attributes } : undefined,
            }
          : undefined,
        attributes: link.attributes ? { ...link.attributes } : undefined,
      })),
      events: span.events.map((event) => ({
        ...event,
        attributes: event.attributes ? { ...event.attributes } : undefined,
      })),
      attributes: { ...span.attributes },
      outcome: span.outcome ? { ...span.outcome } : undefined,
    });
  }

  private flushPendingTraceSpans(cycleId: number): void {
    if (this.pendingTraceSpans.length === 0) {
      return;
    }
    const cycleRefs = this.buildCycleTraceRefs(cycleId);
    const pending = this.pendingTraceSpans.splice(0, this.pendingTraceSpans.length);
    for (const span of pending) {
      this.upsertTraceRow({
        cycleId,
        ...span,
        refs: mergeTraceRefs(span.refs, cycleRefs),
      });
    }
  }

  private currentRunningTraceRow(name: string): SessionDbLoopbusTraceRecord | null {
    return this.runningTraceRowsByName.get(name) ?? null;
  }

  private buildDraftTraceRefs(
    draft: AttentionDraft,
    input?: {
      contextId?: string;
      commitId?: string;
    },
  ): SessionTraceRef[] {
    const terminalSource = parseTerminalSourceSrc(draft.sourceRef.src);
    const provenanceMessageSource =
      typeof draft.provenance?.src === "string" ? parseMessageSourceSrc(draft.provenance.src) : null;
    const refs: SessionTraceRef[] = [
      createTraceRef("source.read", draft.sourceRef.src, {
        label: draft.sourceRef.reason,
        attributes: {
          src: draft.sourceRef.src,
          reason: draft.sourceRef.reason,
        },
      }),
    ];
    const channelId = provenanceMessageSource?.chatId;
    if (channelId) {
      refs.push(toMessageChannelTraceRef(channelId));
    }
    if (terminalSource) {
      refs.push(toTerminalTraceRef(terminalSource.terminalId));
    }
    if (input?.contextId) {
      refs.push(toAttentionContextTraceRef(input.contextId));
    }
    if (input?.contextId && input.commitId) {
      refs.push(toAttentionCommitTraceRef(input.contextId, input.commitId));
    }
    return mergeTraceRefs(refs);
  }

  private buildAttentionCommitTraceRefs(contextId: string, commit: AttentionCommit): SessionTraceRef[] {
    const messageSource = typeof commit.meta.src === "string" ? parseMessageSourceSrc(commit.meta.src) : null;
    const terminalSource = typeof commit.meta.src === "string" ? parseTerminalSourceSrc(commit.meta.src) : null;
    const refs: SessionTraceRef[] = [
      toAttentionContextTraceRef(contextId),
      toAttentionCommitTraceRef(contextId, commit.commitId),
    ];
    if (messageSource) {
      refs.push(toMessageChannelTraceRef(messageSource.chatId));
    }
    if (terminalSource) {
      refs.push(toTerminalTraceRef(terminalSource.terminalId));
    }
    return mergeTraceRefs(refs);
  }

  private recordDraftSourceReadTrace(draft: AttentionDraft, contextId: string, commitId: string): void {
    const sourceKind = resolveRuntimeSourceKind(draft.sourceRef.src);
    this.queuePendingTraceSpan({
      traceId: createTraceId(),
      spanId: createSpanId(),
      parentSpanId: null,
      kind: "source.read",
      name: `${sourceKind}.read`,
      status: "done",
      startedAt: Date.now(),
      endedAt: Date.now(),
      refs: this.buildDraftTraceRefs(draft, { contextId, commitId }),
      links: [],
      events: [
        createTraceEvent("attention.draft.loaded", {
          status: "ok",
          attributes: {
            source: sourceKind,
            src: draft.sourceRef.src,
          },
        }),
      ],
      attributes: {
        src: draft.sourceRef.src,
        reason: draft.sourceRef.reason,
        contentBytes: draft.content.length,
      },
      outcome: {
        code: "done",
      },
    });
  }

  private recordAttentionCommitTrace(contextId: string, commit: AttentionCommit, input: { notifyLoop: boolean }): void {
    const span = {
      traceId: createTraceId(),
      spanId: createSpanId(),
      parentSpanId: null,
      kind: "attention.commit",
      name: "attention.commit",
      status: "done" as const,
      startedAt: Date.now(),
      endedAt: Date.now(),
      refs: this.buildAttentionCommitTraceRefs(contextId, commit),
      links: [],
      events: [
        createTraceEvent("attention.commit.committed", {
          status: "ok",
          refs: [toAttentionCommitTraceRef(contextId, commit.commitId)],
        }),
      ],
      attributes: {
        author: commit.meta.author,
        source: commit.meta.source,
        summary: commit.summary,
      },
      outcome: {
        code: "done",
      } satisfies SessionTerminalOutcome,
    };
    if (input.notifyLoop && this.activeCycleId !== null) {
      this.upsertTraceRow({
        cycleId: this.activeCycleId,
        ...span,
        refs: mergeTraceRefs(span.refs, this.buildCycleTraceRefs(this.activeCycleId)),
      });
      return;
    }
    this.queuePendingTraceSpan(span);
  }

  private collectActiveAttentionContextIds(): string[] {
    return [...new Set(this.attentionSystem.listActiveContexts().map((match) => match.contextId))];
  }

  private restoreAttentionRuntimeHistory(limit = ATTENTION_RUNTIME_HISTORY_LIMIT): void {
    this.attentionCycleFrames.clear();
    this.recentAttentionHooks = [];
    for (const cycle of this.cycleRecords.slice(-limit)) {
      const frame = cycle.extendsRecord.attentionCycleFrame;
      if (frame && typeof frame === "object") {
        const next = cloneAttentionCycleFrame(frame as AttentionCycleFrame);
        this.attentionCycleFrames.set(next.cycleId, next);
      }
      const hooks = cycle.extendsRecord.attentionHooks;
      if (!Array.isArray(hooks)) {
        continue;
      }
      for (const entry of hooks) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        this.recentAttentionHooks.push(cloneAttentionHookRecord(entry as AttentionHookRecord));
      }
    }
    if (this.recentAttentionHooks.length > ATTENTION_RUNTIME_HISTORY_LIMIT) {
      this.recentAttentionHooks = this.recentAttentionHooks.slice(-ATTENTION_RUNTIME_HISTORY_LIMIT);
    }
  }

  private persistAttentionCycleState(cycleId: number): void {
    const cycle = this.cycleRecords.find((entry) => entry.id === cycleId);
    if (!cycle) {
      return;
    }
    const frame = this.attentionCycleFrames.get(cycleId);
    const hooks = this.recentAttentionHooks.filter((record) => record.cycleId === cycleId);
    cycle.extendsRecord = {
      ...cycle.extendsRecord,
      attention: this.attentionSystem.snapshot(),
      attentionCycleFrame: frame ? cloneAttentionCycleFrame(frame) : undefined,
      attentionHooks: hooks.map(cloneAttentionHookRecord),
    };
    cycle.updatedAt = Date.now();
  }

  private upsertAttentionCycleFrame(frame: AttentionCycleFrame): void {
    this.attentionCycleFrames.set(frame.cycleId, cloneAttentionCycleFrame(frame));
    this.persistAttentionCycleState(frame.cycleId);
    this.emitAttentionState();
  }

  private markActiveCycleProducedCommitRef(contextId: string, commitId: string): void {
    if (!this.activeCycle || this.activeCycleId === null || this.activeCycle.cycleId !== this.activeCycleId) {
      return;
    }
    const current = this.attentionCycleFrames.get(this.activeCycleId);
    if (!current) {
      return;
    }
    current.producedCommitRefs = dedupeAttentionCommitRefs([
      ...current.producedCommitRefs,
      toAttentionCommitRef(contextId, commitId),
    ]);
    current.activeContextIds = this.collectActiveAttentionContextIds();
    this.upsertAttentionCycleFrame(current);
  }

  private hasPendingCompactCycle(): boolean {
    return this.pendingCompactRequest !== null;
  }

  private queueCompactCycle(trigger: CompactCycleTrigger): void {
    this.pendingCompactRequest = {
      trigger,
      requestedAt: Date.now(),
    };
    this.notifyInput("attention");
  }

  private consumePendingCompactCycle(): PendingCompactRequest | null {
    const request = this.pendingCompactRequest;
    this.pendingCompactRequest = null;
    return request;
  }

  private buildCompactCycleInput(request: PendingCompactRequest): LoopBusInput {
    return {
      name: COMPACT_CYCLE_INPUT_NAME,
      role: "user",
      type: "text",
      source: "attention",
      text: JSON.stringify({
        kind: "compact-cycle",
        trigger: request.trigger,
        requestedAt: new Date(request.requestedAt).toISOString(),
      }),
      meta: {
        cycleKind: "compact",
        compactTrigger: request.trigger,
        exclusiveCycle: true,
        requestedAt: new Date(request.requestedAt).toISOString(),
      },
    };
  }

  private isCompactCycleInputMessage(input: { meta?: Record<string, string | number | boolean | null> }): boolean {
    return input.meta?.cycleKind === "compact";
  }

  private readCompactCycleTriggerFromInputs(
    inputs: ReadonlyArray<{ meta?: Record<string, string | number | boolean | null> }>,
  ): CompactCycleTrigger | null {
    for (const input of inputs) {
      const trigger = parseCompactCycleTrigger(input.meta?.compactTrigger);
      if (trigger) {
        return trigger;
      }
    }
    return null;
  }

  private selectAttentionProtocolCommits(match: AttentionActiveContextMatch): AttentionCommit[] {
    const dirtyCommitIds = this.dirtyAttentionCommitIdsByContext.get(match.contextId);
    if (!dirtyCommitIds || dirtyCommitIds.size === 0) {
      return [];
    }
    const context = this.attentionSystem.getContext(match.contextId);
    const allCommits = context?.listCommits() ?? match.recentCommits;
    if (allCommits.length === 0) {
      return [];
    }
    return allCommits.filter((commit) => dirtyCommitIds.has(commit.commitId));
  }

  private serializeAttentionItemsInput(
    items: readonly {
      contextId: string;
      commit: AttentionCommit;
    }[],
  ): string {
    return [
      "## Attention Items",
      ...items.map(({ contextId, commit }) =>
        mdFence(
          "yaml+attention-item",
          toYaml({
            contextId,
            commitId: commit.commitId,
            ingressType: commit.ingressType,
            parentCommitIds: [...commit.parentCommitIds],
            provenance: {
              author: commit.meta.author,
              source: commit.meta.source,
              src: commit.meta.src,
              tags: commit.meta.tags,
              createdAt: commit.meta.createdAt,
            },
            summary: commit.summary,
            change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
            createdAt: commit.createdAt,
          }),
        ),
      ),
    ].join("\n\n");
  }

  private recordAttentionHook(
    contextId: string,
    commitId: string,
    result: AttentionHookRecord | Omit<AttentionHookRecord, "id" | "cycleId" | "contextId" | "commitId" | "createdAt">,
  ): AttentionHookRecord {
    const record: AttentionHookRecord = {
      id: `hook-${createId()}`,
      cycleId: this.activeCycleId,
      hookId: result.hookId,
      bridgeId: result.bridgeId,
      contextId,
      commitId,
      status: result.status,
      createdAt: Date.now(),
      target: result.target ? { ...result.target } : undefined,
      output: result.output ? { ...result.output } : undefined,
      error: result.error,
    };
    const parentTrace = this.currentRunningTraceRow("apply_outputs");
    if (record.cycleId !== null) {
      this.upsertTraceRow({
        cycleId: record.cycleId,
        traceId: parentTrace?.traceId ?? createTraceId(),
        spanId: createSpanId(),
        parentSpanId: parentTrace?.spanId,
        kind: "attention.hook",
        name: result.bridgeId,
        status: record.status === "failed" ? "error" : "done",
        startedAt: record.createdAt,
        endedAt: record.createdAt,
        refs: mergeTraceRefs(
          [
            toAttentionContextTraceRef(contextId),
            toAttentionCommitTraceRef(contextId, commitId),
            toAttentionHookTraceRef(record.id),
          ],
          this.buildCycleTraceRefs(record.cycleId),
        ),
        links: parentTrace
          ? [
              {
                kind: "child_of",
                traceId: parentTrace.traceId,
                spanId: parentTrace.spanId,
              },
            ]
          : [],
        events: [
          createTraceEvent("attention.hook", {
            status: record.status === "failed" ? "error" : "ok",
            attributes: {
              hookId: record.hookId,
              bridgeId: record.bridgeId,
              status: record.status,
            },
          }),
        ],
        attributes: {
          hookId: record.hookId,
          bridgeId: record.bridgeId,
          status: record.status,
          target: record.target ?? null,
        },
        outcome:
          record.status === "failed"
            ? {
                code: "error",
                message: record.error,
                error: record.error ? { message: record.error } : undefined,
              }
            : {
                code: "done",
              },
      });
    }
    this.recentAttentionHooks = [...this.recentAttentionHooks, record].slice(-ATTENTION_RUNTIME_HISTORY_LIMIT);
    if (record.cycleId !== null) {
      const frame = this.attentionCycleFrames.get(record.cycleId);
      if (frame) {
        frame.hookIds = [...frame.hookIds, record.id];
        frame.activeContextIds = this.collectActiveAttentionContextIds();
        this.upsertAttentionCycleFrame(frame);
      }
    }
    this.emitAttentionState();
    return record;
  }

  onEvent(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private async migrateLegacyAttentionStoreDir(): Promise<void> {
    const nextDir = join(this.options.sessionRoot, "attention-system");
    const legacyDir = join(this.options.sessionRoot, "chat-system");
    const [hasNext, hasLegacy] = await Promise.all([pathExists(nextDir), pathExists(legacyDir)]);
    if (hasNext || !hasLegacy) {
      return;
    }
    try {
      await rename(legacyDir, nextDir);
      this.options.logger?.log({
        channel: "agent",
        level: "info",
        message: "attention-system.migrated",
        meta: {
          from: legacyDir,
          to: nextDir,
        },
      });
    } catch (error) {
      this.options.logger?.log({
        channel: "error",
        level: "warn",
        message: "attention-system.migrate-failed",
        meta: {
          from: legacyDir,
          to: nextDir,
          reason: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private mergeBootAttentionSnapshot(persisted: AttentionSystemSnapshot): AttentionSystemSnapshot {
    const boot = this.attentionSystem.snapshot();
    if (boot.contexts.length === 0) {
      return persisted;
    }
    if (persisted.contexts.length === 0) {
      return boot;
    }
    const persistedIds = new Set(persisted.contexts.map((context) => context.contextId));
    const mergedContexts = [
      ...persisted.contexts,
      ...boot.contexts.filter((context) => !persistedIds.has(context.contextId)),
    ];
    return {
      contexts: mergedContexts,
    };
  }

  private mergeBootAttentionHashAliases(
    persisted: ReturnType<AttentionHashAliasRegistry["snapshot"]>,
  ): ReturnType<AttentionHashAliasRegistry["snapshot"]> {
    const boot = this.attentionHashAliases.snapshot();
    if (boot.aliases.length === 0) {
      return persisted;
    }
    if (persisted.aliases.length === 0) {
      return boot;
    }

    const aliases = [...persisted.aliases];
    const digestSet = new Set(aliases.map((alias) => alias.digest));
    const tokenSet = new Set(aliases.map((alias) => alias.token));
    for (const alias of boot.aliases) {
      if (digestSet.has(alias.digest) || tokenSet.has(alias.token)) {
        continue;
      }
      aliases.push(alias);
      digestSet.add(alias.digest);
      tokenSet.add(alias.token);
    }

    return {
      version: persisted.version,
      aliases: aliases.sort((left, right) => left.token.localeCompare(right.token)),
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.abortWakeRequested = false;
    this.messageSystem.setContactPresence(this.messageContactId, true);
    this.terminalControlPlane.setActorPresence(this.terminalActorId, true);
    this.config = await resolveSessionConfig(this.options.cwd, {
      avatar: this.options.avatar,
      avatarPrincipalId: this.options.avatarPrincipalId,
      homeDir: this.getHomeDir(),
    });
    this.focusedTerminalIds = this.normalizeFocusedTerminalIds(
      this.requireTerminalControlPlane().getFocusedTerminalIds(this.terminalActorId),
    );
    this.loopPluginRuntime = await this.createLoopPluginRuntime();
    await this.migrateLegacyAttentionStoreDir();
    const attentionRoot = join(this.options.sessionRoot, "attention-system");
    this.attentionStore = new AttentionStore(attentionRoot);
    this.attentionHashAliasStore = new AttentionHashAliasStore(attentionRoot);
    const persistedAttentionSnapshot = await this.attentionStore.load();
    const persistedHashAliases = await this.attentionHashAliasStore.load();
    this.attentionHashAliases = new AttentionHashAliasRegistry(
      this.mergeBootAttentionHashAliases(persistedHashAliases),
    );
    this.attentionSystem = AttentionSystem.fromSnapshot(this.mergeBootAttentionSnapshot(persistedAttentionSnapshot));
    this.attentionSearchEngine = new AttentionSearchEngine(
      join(this.options.sessionRoot, ATTENTION_SEARCH_SQLITE_FILENAME),
      join(this.options.sessionRoot, ATTENTION_SEARCH_LEGACY_DUCKDB_FILENAME),
    );
    await this.persistAttentionSystem();
    await this.runtimeKernelHost.bootstrap();
    this.terminalKernelAdapter.syncFocusedDirtyTerminals();
    if (this.listAttentionVisibleContextMatches().length > 0) {
      this.attentionFactsVersion += 1;
      this.requestAttentionContextBoundaryRefresh();
    }
    if (this.messageSystemCleanup.length === 0) {
      this.bindMessageSystem();
    }
    this.ensureFollowUpSinkBound();
    if (this.terminalSystemCleanup.length === 0) {
      this.bindTerminalSystem();
    }
    for (const recovered of this.terminalControlPlane.replayRecoveredLifecycle()) {
      await this.scheduleKilledRuntimeTerminal(recovered);
    }
    this.settingsEditor = new SettingsEditor(this.config.agentCwd, {
      agenterPath: this.config.prompt.agenterPath,
    });
    await this.reloadSettingsLayers();
    try {
      await this.terminalControlPlane.startTransport({ port: 0 });
    } catch (error) {
      this.emit("error", {
        message: `terminal transport failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    try {
      await this.messageSystem.startTransport({ port: 0 });
    } catch (error) {
      this.emit("error", {
        message: `message transport failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const promptStore = this.createPromptStore(this.config);
    await promptStore.reload();
    this.promptStore = promptStore;
    this.runtimeSkillSystem = this.ensureRuntimeSkillSystem();
    await this.handleRuntimeSkillRefreshResult(this.runtimeSkillSystem.refresh({ publishReminders: false }), {
      notifyLoop: false,
    });
    if (this.listAttentionVisibleContextMatches().length > 0) {
      this.attentionFactsVersion += 1;
      this.requestAttentionContextBoundaryRefresh();
    }

    const modelClient = this.createModelClient(this.config);

    this.taskSources = resolveTaskSources({
      homeDir: this.getHomeDir(),
      projectRoot: this.config.agentCwd,
      sources: this.config.tasks.sources,
    });
    await this.pollTaskSources("boot");

    const sessionStore = new SessionStore({
      sessionRoot: this.options.sessionRoot,
      session: {
        id: this.options.sessionId,
        name: this.options.sessionName,
        cwd: this.options.cwd,
        avatar: this.config.avatar.nickname,
        avatarPrincipalId: this.options.avatarPrincipalId,
        storeTarget: this.options.storeTarget,
      },
    });
    this.sessionStore = sessionStore;
    this.sessionDb = new SessionDb(join(this.options.sessionRoot, "session.db"));
    this.usageAnalyticsDb = this.options.usageAnalyticsRoot
      ? new UsageAnalyticsDb(resolveUsageAnalyticsDbPathFromAvatarRoot(this.options.usageAnalyticsRoot))
      : null;
    const currentPromptWindowState = this.ensurePromptWindowStateInitialized();
    this.restoreAttentionDeliveryState();
    this.restoreAttentionRuntimeHistory();
    const restoredChat = readAllMessagesByScope(this.sessionDb, HEARTBEAT_MESSAGE_PART_SCOPE).filter(
      isPersistedChatProjectionMessage,
    );
    this.chatMessages = restoredChat.map((item) => projectHeartbeatMessageToChatMessage(item));
    const head = this.sessionDb.getHead();
    this.activeCycleId = head.currentRoundIndex;
    this.activeModelCallId = null;
    this.updateLoopKernelSnapshot({
      phase: "waiting_commits",
      currentCycleId: head.currentRoundIndex,
      lastWakeSource: null,
      lastError: null,
    });
    this.emitAttentionState();
    await this.ensureRuntimeLocalApiStarted();

    const agent = new AgenterAI({
      modelClient,
      promptStore,
      promptWindowStore: {
        append: ({ createdAt, messages, setCurrent }) => {
          if (!this.sessionDb) {
            throw new Error("session db not initialized");
          }
          const shouldRotateRound = (setCurrent ?? true) && this.activeCycle?.kind === "compact";
          const roundIndex = shouldRotateRound
            ? this.sessionDb.bumpRound(createdAt).currentRoundIndex
            : this.sessionDb.getHead().currentRoundIndex;
          const record = this.sessionDb.savePromptWindow({
            createdAt,
            roundIndex,
            messages,
            setCurrent,
          });
          if (shouldRotateRound) {
            this.sessionDb.pruneAiCallsBeforeRound(Math.max(0, roundIndex - 1));
          }
          return toAgentPromptWindowStateRecord(record);
        },
      },
      initialPromptWindowState: currentPromptWindowState,
      avatarName: this.getAvatarName(),
      resolveImageAttachment: async (attachment) => this.readImageAttachmentSource(attachment.assetId),
      commitAttentionItems: async () => await this.commitInterleavedAttentionItems(),
      onCanCommitAttentionItems: async (context) => {
        await context.commitAttentionItems();
      },
      onAssistantStream: async (stream) => {
        await this.handleAssistantStreamUpdate(stream);
      },
      onAssistantDelivery: async (event) => {
        await this.handleAssistantDeliveryEvent(event);
      },
      onModelCall: async (record) => {
        await this.handleModelCall(record);
      },
      logger: this.options.logger ?? { log: () => {} },
      locale: this.config.lang,
      compactPolicy: this.config.loop.compactPolicy,
      toolProviders: this.createAgentToolProviders(),
      attentionGateway: {
        listContexts: () => this.attentionSystem.listContexts(),
        listActive: () => this.attentionSystem.listActiveContexts(),
        query: async (input: AttentionSearchRequest) => await this.queryAttention(input),
        commit: async (input: AttentionCommitToolInput) => {
          const existing = this.attentionSystem.getContext(input.contextId);
          if (!existing) {
            this.attentionSystem.createContext({
              contextId: input.contextId,
              owner: input.meta?.author ?? this.getAvatarName(),
            });
          }
          const { commit } = this.attentionSystem.commit(input.contextId, {
            parentCommitIds: input.parentCommitIds,
            meta: input.meta,
            scores: input.scores,
            summary: input.summary,
            change: input.change,
          });
          await this.handleCommittedAttentionCommit(input.contextId, commit, { notifyLoop: true });
          return commit;
        },
      },
    });
    this.agent = agent;

    agent.onStats((stats) => {
      this.emit("stats", stats);
    });

    const loopProcessor = {
      send: async (messages: Parameters<AgenterAI["send"]>[0], context?: { signal?: AbortSignal }) => {
        const cycleId = String(this.activeCycleId ?? "pending");
        if (context?.signal) {
          await this.loopPluginRuntime?.notifyCycleWillCallModel({
            cycleId,
            signal: context.signal,
          });
        }
        try {
          const compactTrigger = this.readCompactCycleTriggerFromInputs(messages);
          const result = this.isCompactCycleInputMessage(messages[0] ?? {})
            ? await agent
                .runCompactCycle({ trigger: compactTrigger ?? "manual", signal: context?.signal })
                .then(() => undefined)
            : await agent.send(messages, context);
          const pendingCompactTrigger = agent.consumePendingCompactRequest();
          if (pendingCompactTrigger) {
            this.queueCompactCycle(pendingCompactTrigger);
          }
          if (context?.signal) {
            await this.loopPluginRuntime?.notifyCycleDidCallModel({
              cycleId,
              signal: context.signal,
              result,
            });
          }
          return result;
        } catch (error) {
          if (context?.signal && isAbortError(error)) {
            await this.loopPluginRuntime?.notifyCycleDidAbort({
              cycleId,
              signal: context.signal,
              reason: context.signal.reason ?? error,
            });
          }
          throw error;
        }
      },
    };

    this.runtime = new AgentRuntime({
      processor: loopProcessor,
      logger: this.options.logger ?? { log: () => {} },
      onLoopStateChange: (state) => {
        const previousPhase = this.loopPhase;
        this.loopPhase = state.phase;
        this.updateProjectionStageFromLoopPhase(state.phase);
        if (this.activeCycle) {
          if (state.phase === "waiting_commits" && previousPhase !== "waiting_commits") {
            const nextStatus = this.abortingActiveCycle || this.activeCycle.status === "error" ? "error" : "done";
            this.abortingActiveCycle = false;
            this.finalizeActiveCycle(nextStatus);
          } else if (state.phase === "calling_model" && this.activeCycle.status === "collecting") {
            this.updateActiveCycle({ status: "collecting" });
          } else if (
            (state.phase === "collecting_inputs" || state.phase === "persisting_cycle") &&
            this.activeCycle.status === "pending"
          ) {
            this.updateActiveCycle({ status: "collecting" });
          }
        }
        this.updateLoopKernelSnapshot({
          phase: state.phase,
          currentCycleId: state.currentCycleId,
          lastWakeSource: state.lastWakeSource,
          lastError: state.lastError ?? undefined,
          cycle: state.cycle,
          paused: state.paused,
        });
        this.emit("phase", { phase: state.phase });
      },
      onLoopTrace: (entry) => {
        this.upsertTraceRow({
          cycleId: entry.cycleId,
          traceId: entry.traceId,
          spanId: entry.spanId,
          parentSpanId: entry.parentSpanId,
          kind: entry.kind,
          name: entry.name,
          status: entry.status,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          refs: mergeTraceRefs(entry.refs, this.buildCycleTraceRefs(entry.cycleId)),
          links: entry.links,
          events: entry.events,
          attributes: entry.attributes,
          outcome: entry.outcome,
        });
      },
      waitForCommit: async () => this.waitForAnyInput(),
      collectInputs: async () => this.collectLoopInputs(),
      persistCycle: async ({ wakeSource, inputs }) => this.persistCycle({ wakeSource, inputs }),
    });

    this.runtime.start();
    this.sessionStore.setLifecycle({ status: "running" });
    this.started = true;
    this.loopSuspension = "active";

    for (const boot of this.config.bootTerminals) {
      if (!boot.autoRun) {
        continue;
      }
      const terminal = this.terminals.get(boot.terminalId);
      if (!terminal) {
        continue;
      }
      try {
        terminal.start();
        if (this.config.terminals[boot.terminalId]?.gitLog) {
          const mark = await terminal.markDirty();
          if (mark.ok) {
            this.terminalReadCursorHashById[boot.terminalId] = mark.hash;
          }
        }
        this.notifyInput("terminal");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("error", { message: `boot terminal failed (${boot.terminalId}): ${message}` });
      }
    }
  }

  async pause(): Promise<void> {
    await this.stopLoop("paused");
  }

  private async stopLoop(status: "paused" | "stopped"): Promise<void> {
    if (!this.started) {
      return;
    }
    if (this.activeCycle && this.loopPhase !== "waiting_commits") {
      this.abortingActiveCycle = true;
    }
    this.runtime?.pause(status === "stopped" ? "session.stop" : "session.pause");
    this.loopSuspension = status;
    // Wake commit waiters so the paused loop can settle without waiting for new external input.
    this.notifyInput("attention");
    if (status === "stopped") {
      this.messageSystem.setContactPresence(this.messageContactId, false);
      this.terminalControlPlane.setActorPresence(this.terminalActorId, false);
      this.releaseFollowUpSink();
      this.runtimeSkillSystem?.dispose();
      this.mcpSystem?.close();
      this.mcpSystem = null;
    }
    this.sessionStore?.setLifecycle({ status });
  }

  resume(): void {
    if (!this.started) {
      return;
    }
    this.messageSystem.setContactPresence(this.messageContactId, true);
    this.terminalControlPlane.setActorPresence(this.terminalActorId, true);
    this.ensureFollowUpSinkBound();
    this.runtime?.resume();
    this.loopSuspension = "active";
    this.sessionStore?.setLifecycle({ status: "running" });
  }

  requestCompact(trigger: CompactCycleTrigger = "manual"): { ok: boolean } {
    if (!this.started) {
      return { ok: false };
    }
    this.queueCompactCycle(trigger);
    return { ok: true };
  }

  async abort(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.abortWakeRequested = true;
    if (this.activeCycle && this.loopPhase !== "waiting_commits") {
      this.abortingActiveCycle = true;
    }
    // Wake commit waiters before tearing down the bus so idle runtimes can stop promptly.
    this.notifyInput("attention");
    await this.runtime?.stop("session.abort");
    this.runtime = null;
    this.agent = null;
    this.promptStore?.dispose();
    this.promptStore = null;
    this.loopPluginRuntime = null;
    this.runtimeKernelHost.dispose();
    await this.runtimeLocalApi?.stop().catch(() => {});
    this.runtimeLocalApi = null;
    this.mcpSystem?.close();
    this.mcpSystem = null;
    this.runtimeSkillSystem?.dispose();
    this.runtimeSkillSystem = null;
    this.skillKernelAdapter.reset();
    this.rootWorkspaceShellWorld = null;
    this.releaseFollowUpSink();
    this.messageSystem.setContactPresence(this.messageContactId, false);
    this.terminalControlPlane.setActorPresence(this.terminalActorId, false);
    this.sessionStore?.setLifecycle({ status: "stopped" });
    this.apiCallRecordingRefCount = 0;

    this.terminals.clear();
    this.taskAttentionDraftQueue.length = 0;
    this.effectLedgerRecords.clear();
    this.inboundMessageQueue.length = 0;
    this.messageKernelAdapter.reset();
    this.terminalKernelAdapter.reset();
    this.taskSourceMtime.clear();
    this.taskSources = [];
    for (const terminalId of Object.keys(this.terminalSnapshots)) {
      delete this.terminalSnapshots[terminalId];
    }
    for (const terminalId of Object.keys(this.terminalReads)) {
      delete this.terminalReads[terminalId];
    }
    for (const terminalId of Object.keys(this.terminalReadCursorHashById)) {
      delete this.terminalReadCursorHashById[terminalId];
    }
    for (const terminalId of Object.keys(this.terminalViewFingerprint)) {
      delete this.terminalViewFingerprint[terminalId];
    }
    for (const terminalId of Object.keys(this.terminalSemanticFingerprint)) {
      delete this.terminalSemanticFingerprint[terminalId];
    }
    for (const cleanup of this.messageSystemCleanup.splice(0, this.messageSystemCleanup.length)) {
      cleanup();
    }
    for (const cleanup of this.terminalSystemCleanup.splice(0, this.terminalSystemCleanup.length)) {
      cleanup();
    }
    if (this.ownsMessageSystem) {
      this.messageSystem.close();
    }
    this.sessionDb?.close();
    this.sessionDb = null;
    this.usageAnalyticsDb?.close();
    this.usageAnalyticsDb = null;
    this.loopKernelSnapshot = null;
    this.activeCycle = null;
    for (const signal of Object.values(this.inputSignals)) {
      signal.shutdown();
    }
    this.inputSignalCursor = { user: 0, terminal: 0, task: 0, attention: 0 };
    this.inputSignalVersion = { user: 0, terminal: 0, task: 0, attention: 0 };
    this.inputSignalAt = { user: null, terminal: null, task: null, attention: null };
    this.attentionSourceDigests.clear();
    this.dirtyAttentionContextIds.clear();
    this.dirtyAttentionCommitIdsByContext.clear();
    this.dirtyAttentionContextOrder.clear();
    this.nextAttentionDirtyOrder = 0;
    this.attentionContainment.clear();
    this.lastAttentionProgressAt = null;
    this.pendingTraceSpans.length = 0;
    this.traceRowIdBySpanId.clear();
    this.runningTraceRowsByName.clear();
    this.started = false;
    this.loopSuspension = "stopped";
    this.loopPhase = "stopped";
  }

  async stop(): Promise<void> {
    await this.stopLoop("stopped");
  }

  isStarted(): boolean {
    return this.started;
  }

  setSessionStatus(status: "stopped" | "paused" | "starting" | "running" | "error", lastError?: string): void {
    this.sessionStore?.setLifecycle({ status, lastError });
  }

  retainApiCallRecording(): { enabled: boolean; refCount: number } {
    this.apiCallRecordingRefCount += 1;
    const payload = {
      enabled: this.apiCallRecordingRefCount > 0,
      refCount: this.apiCallRecordingRefCount,
    };
    this.emit("apiRecording", payload);
    return payload;
  }

  releaseApiCallRecording(): { enabled: boolean; refCount: number } {
    this.apiCallRecordingRefCount = Math.max(0, this.apiCallRecordingRefCount - 1);
    const payload = {
      enabled: this.apiCallRecordingRefCount > 0,
      refCount: this.apiCallRecordingRefCount,
    };
    this.emit("apiRecording", payload);
    return payload;
  }

  isApiCallRecordingEnabled(): boolean {
    return this.apiCallRecordingRefCount > 0;
  }

  listModelCalls(afterId = 0, limit = 200): Array<SessionModelCallRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listAiCallsAfter(afterId, limit).map(projectAiCallToModelCall);
  }

  listModelCallsBefore(beforeId: number, limit = 200): Array<SessionModelCallRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listAiCallsBefore(beforeId, limit).map(projectAiCallToModelCall);
  }

  listCurrentBranchCycles(limit = 200) {
    return this.cycleRecords.slice(-limit);
  }

  async rollbackToCycle(cycleId: number): Promise<{ ok: boolean; cycleId?: number; reason?: string }> {
    const cycle = this.cycleRecords.find((item) => item.id === cycleId);
    if (!cycle) {
      return { ok: false, reason: `cycle not found: ${cycleId}` };
    }

    const attentionSnapshot = cycle.extendsRecord.attention;
    if (attentionSnapshot && typeof attentionSnapshot === "object") {
      this.attentionSystem = AttentionSystem.fromSnapshot(
        attentionSnapshot as Parameters<typeof AttentionSystem.fromSnapshot>[0],
      );
      await this.persistAttentionSystem();
    }
    const terminalExtend = cycle.extendsRecord.terminal;
    if (terminalExtend && typeof terminalExtend === "object") {
      const focused = (terminalExtend as { focusedTerminalIds?: string[] }).focusedTerminalIds;
      if (Array.isArray(focused)) {
        this.focusedTerminalIds = [...focused];
      }
    }

    this.activeCycleId = cycleId;
    this.activeModelCallId = null;
    this.pendingTraceSpans.length = 0;
    this.traceRowIdBySpanId.clear();
    this.runningTraceRowsByName.clear();
    this.attentionCycleFrames.clear();
    this.recentAttentionHooks = [];
    this.emitFocusedTerminal();
    this.emitAttentionState();
    this.updateLoopKernelSnapshot({
      phase: "waiting_commits",
      currentCycleId: cycleId,
      lastWakeSource: null,
      lastError: null,
    });
    if (this.runtime) {
      await this.runtime.stop();
      this.runtime.start();
    }
    return { ok: true, cycleId };
  }

  listApiCalls(afterId = 0, limit = 200): Array<SessionDbApiCallRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listAiCallsAfter(afterId, limit);
  }

  listApiCallsBefore(beforeId: number, limit = 200): Array<SessionDbApiCallRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listAiCallsBefore(beforeId, limit);
  }

  private ensurePromptWindowStateInitialized(): AgentPromptWindowStateRecord {
    if (!this.sessionDb) {
      throw new Error("session db not initialized");
    }
    const current = this.sessionDb.getCurrentPromptWindow();
    if (current) {
      return toAgentPromptWindowStateRecord(current);
    }
    return toAgentPromptWindowStateRecord(
      this.sessionDb.savePromptWindow({
        createdAt: Date.now(),
        messages: [],
        setCurrent: true,
      }),
    );
  }

  private readDurablePromptWindow(): ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"] {
    return clonePromptWindowMessages(this.sessionDb?.getCurrentPromptWindow()?.messages);
  }

  inspectModelDebug(): SessionRuntimeModelDebug {
    const modelState = this.agent?.inspectDebugState();
    const recentAiCalls = this.sessionDb?.listAiCalls(8) ?? [];
    return {
      config: this.config
        ? {
            providerId: this.config.ai.providerId,
            apiStandard: this.config.ai.apiStandard,
            vendor: this.config.ai.vendor,
            profile: this.config.ai.profile,
            extensions: this.config.ai.extensions,
            model: this.config.ai.model,
            baseUrl: this.config.ai.baseUrl,
            apiKey: this.config.ai.apiKey,
            apiKeyEnv: this.config.ai.apiKeyEnv,
            headers: this.config.ai.headers,
            temperature: this.config.ai.temperature,
            topK: this.config.ai.topK,
            transportMaxRetries: this.config.ai.transportMaxRetries,
            maxToken: this.config.ai.maxToken,
            maxContextTokens: this.config.ai.maxContextTokens,
            thinking: this.config.ai.thinking,
            retryPolicy: this.config.loop.retryPolicy,
            compactPolicy: this.config.loop.compactPolicy,
            capabilities: resolveModelCapabilities(this.config.ai),
          }
        : null,
      promptWindow: this.readDurablePromptWindow(),
      prompt: this.promptStore?.inspectRuntimePromptState() ?? null,
      stats: modelState?.stats ?? null,
      latestModelCall: recentAiCalls.at(-1) ? projectAiCallToModelCall(recentAiCalls.at(-1)!) : null,
      recentModelCalls: recentAiCalls.map(projectAiCallToModelCall),
      recentApiCalls: this.sessionDb?.listAiCalls(12) ?? [],
    };
  }

  listChatMessages(afterId = 0, limit = 200): Array<SessionDbChatMessageRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return readAllMessagesByScope(this.sessionDb, HEARTBEAT_MESSAGE_PART_SCOPE)
      .filter(isPersistedChatProjectionMessage)
      .filter((item) => item.id > afterId)
      .slice(-limit);
  }

  pageChatMessages(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbChatMessageRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return pageLocalRecords(
      readAllMessagesByScope(this.sessionDb, HEARTBEAT_MESSAGE_PART_SCOPE).filter(isPersistedChatProjectionMessage),
      input,
      (item) => item.createdAt,
    );
  }

  pageHeartbeatParts(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionMessageRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.pageMessagesByScopes(HEARTBEAT_INSPECTION_SCOPES, input);
  }

  listChatMessagesBefore(beforeId: number, limit = 200): Array<SessionDbChatMessageRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return readAllMessagesByScope(this.sessionDb, HEARTBEAT_MESSAGE_PART_SCOPE)
      .filter(isPersistedChatProjectionMessage)
      .filter((item) => item.id < beforeId)
      .slice(-limit);
  }

  listLoopbusStateLogs(afterId = 0, limit = 200): Array<SessionDbLoopbusStateLogRecord> {
    return this.loopStateLogEntries.filter((item) => item.id > afterId).slice(-limit);
  }

  listLoopbusStateLogsBefore(beforeId: number, limit = 200): Array<SessionDbLoopbusStateLogRecord> {
    if (beforeId <= 0) {
      return [];
    }
    return this.loopStateLogEntries.filter((item) => item.id < beforeId).slice(-limit);
  }

  pageLoopbusStateLogs(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbLoopbusStateLogRecord> {
    return pageLocalRecords(this.loopStateLogEntries, input, (item) => item.timestamp);
  }

  listLoopbusTraces(afterId = 0, limit = 200): Array<SessionDbLoopbusTraceRecord> {
    return this.loopTraceEntries.filter((item) => item.id > afterId).slice(-limit);
  }

  listLoopbusTracesBefore(beforeId: number, limit = 200): Array<SessionDbLoopbusTraceRecord> {
    return this.loopTraceEntries.filter((item) => item.id < beforeId).slice(-limit);
  }

  pageLoopbusTraces(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbLoopbusTraceRecord> {
    return pageLocalRecords(this.loopTraceEntries, input, (item) => item.endedAt);
  }

  listLoopbusTracesByRef(ref: string, limit = 200): Array<SessionDbLoopbusTraceRecord> {
    return this.loopTraceEntries.filter((item) => item.refs.some((entry) => entry.ref === ref)).slice(-limit);
  }

  inspectAttentionState(): SessionRuntimeAttentionState {
    return this.buildAttentionRuntimeState();
  }

  readRuntimeAttentionContext(input: { contextId: string; commitLimit?: number }) {
    const snapshot = this.attentionSystem.getContext(input.contextId)?.snapshot();
    if (!snapshot) {
      throw new Error(`attention context not found: ${input.contextId}`);
    }
    const commitLimit = input.commitLimit ?? 50;
    const commits = snapshot.commits.slice(-commitLimit);
    return projectRuntimeAttentionContext({
      ...snapshot,
      commits,
      commitCount: snapshot.commits.length,
      commitsTruncated: commits.length < snapshot.commits.length,
    });
  }

  inspectAttentionDeliveryState(): SessionRuntimeAttentionDeliveryState {
    return this.buildAttentionDeliveryRuntimeState();
  }

  queryAttentionDeliveryTimeline(input: {
    contextId?: string;
    commitId?: string;
    cycleId?: number;
    sessionModelCallId?: number;
    limit?: number;
  }): SessionRuntimeAttentionDeliveryState {
    const timeline = this.runtimeKernelHost.queryAttentionDeliveryTimeline(input);
    const projectionInput =
      input.contextId && input.commitId
        ? [
            this.runtimeKernelHost.getDeliveryProjection({
              contextId: input.contextId,
              commitId: input.commitId,
            }),
          ]
        : this.runtimeKernelHost.listDeliveryProjections();
    return {
      projections: projectionInput
        .filter((projection): projection is AttentionDeliveryProjection => projection !== null)
        .map(cloneAttentionDeliveryProjection),
      dispatches: timeline.dispatches.map(cloneAttentionDispatchRecord),
      receipts: timeline.receipts.map(cloneAttentionReceiptRecord),
      watches: [],
      effects: [...this.effectLedgerRecords.values()]
        .sort((left, right) => left.timestamp - right.timestamp || left.id - right.id)
        .map(cloneEffectLedgerRecord),
    };
  }

  inspectNotificationState(): SessionNotificationSnapshot {
    return projectSessionNotificationSnapshot({
      sessionId: this.options.sessionId,
      workspacePath: this.options.cwd,
      sessionName: this.options.sessionName,
      attention: this.attentionSystem.snapshot(),
    });
  }

  async setChatVisibility(input: {
    chatId: string;
    visible: boolean;
    focused: boolean;
  }): Promise<SessionNotificationSnapshot> {
    const contextId = this.ensureAttentionContextForChannel(input.chatId).contextId;
    await this.applyAttentionFocusState(contextId, toAttentionFocusStateFromVisibility(input));
    return this.inspectNotificationState();
  }

  async setTerminalVisibility(input: {
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }): Promise<SessionNotificationSnapshot> {
    const terminalId = input.terminalId ?? this.focusedTerminalIds[0];
    if (!terminalId) {
      return this.inspectNotificationState();
    }
    await this.applyAttentionFocusState(
      this.getTerminalAttentionContextId(terminalId),
      toAttentionFocusStateFromVisibility(input),
    );
    return this.inspectNotificationState();
  }

  async consumeNotifications(input: {
    chatId?: string;
    terminalId?: string;
    upToSrc?: string | null;
  }): Promise<SessionNotificationSnapshot> {
    const contextIds = input.chatId
      ? [this.ensureAttentionContextForChannel(input.chatId).contextId]
      : input.terminalId
        ? [this.getTerminalAttentionContextId(input.terminalId)]
        : this.attentionSystem
            .snapshot()
            .contexts.filter((context) => this.attentionSystem.listPushCommits(context.contextId).length > 0)
            .map((context) => context.contextId);
    let changed = false;
    for (const contextId of contextIds) {
      const commits = this.attentionSystem.listPushCommits(contextId);
      const upToSrc = input.upToSrc;
      const selectedCommitIds =
        typeof upToSrc === "string"
          ? commits
              .filter((commit) => {
                if (typeof commit.meta.src !== "string") {
                  return false;
                }
                const comparison = appAttentionSourceRegistry.compare(commit.meta.src, upToSrc);
                return comparison === null ? commit.meta.src === upToSrc : comparison <= 0;
              })
              .map((commit) => commit.commitId)
          : commits.map((commit) => commit.commitId);
      if (selectedCommitIds.length === 0) {
        continue;
      }
      if (this.attentionSystem.consumePushes(contextId, selectedCommitIds).length > 0) {
        changed = true;
      }
    }
    if (changed) {
      this.attentionFactsVersion += 1;
      await this.persistAttentionSystem();
      this.emitAttentionState();
    }
    return this.inspectNotificationState();
  }

  async queryAttention(input: AttentionSearchRequest): Promise<AttentionCommitMatch[]> {
    const engine =
      this.attentionSearchEngine ??
      (this.attentionSearchEngine = new AttentionSearchEngine(
        join(this.options.sessionRoot, ATTENTION_SEARCH_SQLITE_FILENAME),
        join(this.options.sessionRoot, ATTENTION_SEARCH_LEGACY_DUCKDB_FILENAME),
      ));
    return await engine.query({
      attentionSystem: this.attentionSystem,
      snapshot: this.attentionSystem.snapshot(),
      request: input,
    });
  }

  async commitAttention(input: AttentionCommitToolInput & { done?: boolean }): Promise<AttentionCommit> {
    const existing = this.attentionSystem.getContext(input.contextId);
    if (!existing) {
      this.attentionSystem.createContext({
        contextId: input.contextId,
        owner: input.meta?.author ?? this.getAvatarName(),
      });
    }
    const resolvedScores = input.done ? this.buildResolvedAttentionScoresForContext(input.contextId) : undefined;
    const effectiveScores =
      input.scores === undefined
        ? resolvedScores
        : resolvedScores
          ? {
              ...resolvedScores,
              ...input.scores,
            }
          : input.scores;
    const { commit } = this.attentionSystem.commit(input.contextId, {
      parentCommitIds: input.parentCommitIds,
      meta: input.meta,
      scores: effectiveScores,
      summary: input.summary,
      change: input.change,
    });
    await this.persistAttentionSystem();
    this.attentionFactsVersion += 1;
    this.resetAttentionDebtBackoff();
    // Direct attention commits update durable truth, but they are not new
    // ingress facts that should be restaged as fresh AttentionItems.
    this.emitAttentionState();
    return commit;
  }

  async settleAttention(
    input: Omit<AttentionCommitToolInput, "done"> & {
      reason?: string;
    },
  ): Promise<AttentionCommit> {
    return await this.commitAttention({
      ...input,
      summary: input.summary ?? `Settled attention for ${input.contextId}${input.reason ? ` (${input.reason})` : ""}`,
      done: true,
      meta: input.meta,
    });
  }

  inspectNotifyQuota(input: {
    contextId: string;
    sourceId: string;
    focusState?: AttentionFocusState;
  }): RuntimeNotifyQuotaStatusView {
    const focusState = input.focusState ?? this.resolveAttentionFocusState(input.contextId);
    return this.buildNotifyQuotaStatus({
      contextId: input.contextId,
      focusState,
      sourceId: input.sourceId,
    });
  }

  pageModelCalls(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionModelCallRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const page = this.sessionDb.pageAiCalls(input);
    return {
      items: page.items.map(projectAiCallToModelCall),
      nextBefore: page.nextBefore,
      hasMoreBefore: page.hasMoreBefore,
    };
  }

  pageApiCalls(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbApiCallRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.pageAiCalls(input);
  }

  pageCurrentBranchCycles(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionCycleRecord> {
    return pageLocalRecords(this.cycleRecords, input, (item) => item.createdAt);
  }

  pageTerminalActivity(
    terminalId: string,
    input?: {
      before?: SessionDbReverseTimeCursor;
      limit?: number;
    },
  ): SessionDbReversePage<SessionDbTerminalActivityRecord> {
    return pageLocalRecords(this.terminalActivityByTerminalId.get(terminalId) ?? [], input, (item) => item.createdAt);
  }

  listEditableKinds(): EditableKind[] {
    return ["settings", "agenter"];
  }

  getSettingsLayers(): SettingsLayersResult {
    return {
      effective: {
        content: this.settingsEffective,
      },
      layers: [...this.settingsLayers],
    };
  }

  async readSettingsLayer(
    layerId: string,
  ): Promise<{ layer: SettingsLayerSnapshot; path: string; content: string; mtimeMs: number }> {
    return await readWorkspaceSettingsLayer({
      workspacePath: this.options.cwd,
      layerId,
      avatar: this.options.avatar,
    });
  }

  async saveSettingsLayer(input: { layerId: string; content: string; baseMtimeMs: number }): Promise<
    | {
        ok: true;
        file: { layer: SettingsLayerSnapshot; path: string; content: string; mtimeMs: number };
        effective: { content: string };
      }
    | {
        ok: false;
        reason: "conflict";
        latest: { layer: SettingsLayerSnapshot; path: string; content: string; mtimeMs: number };
      }
    | { ok: false; reason: "readonly"; message: string }
  > {
    const result = await saveWorkspaceSettingsLayer({
      workspacePath: this.options.cwd,
      layerId: input.layerId,
      content: input.content,
      baseMtimeMs: input.baseMtimeMs,
      avatar: this.options.avatar,
    });
    if (!result.ok) {
      return result;
    }
    await this.reloadSettingsFromDisk({ persistPendingConfigFact: true });
    return {
      ok: true,
      file: result.file,
      effective: {
        content: this.settingsEffective,
      },
    };
  }

  matchesScopedSettingsTarget(input: {
    scope: "workspace" | "global";
    workspacePath?: string;
    avatar?: string;
  }): boolean {
    const runtimeAvatar = this.config?.avatar.nickname ?? this.options.avatar;
    if (input.avatar && input.avatar !== runtimeAvatar) {
      return false;
    }
    if (input.scope === "global") {
      return true;
    }
    if (!input.workspacePath) {
      return false;
    }
    return resolve(input.workspacePath) === resolve(this.options.cwd);
  }

  matchesWorkspaceSettingsTarget(input: { workspacePath: string; avatar?: string }): boolean {
    return this.matchesScopedSettingsTarget({
      scope: "workspace",
      workspacePath: input.workspacePath,
      avatar: input.avatar,
    });
  }

  async reloadSettingsFromDisk(input: { persistPendingConfigFact?: boolean } = {}): Promise<void> {
    const previousConfigPayload = this.buildPersistedModelConfigPayload();
    const nextConfig = await resolveSessionConfig(this.options.cwd, {
      avatar: this.options.avatar,
      avatarPrincipalId: this.options.avatarPrincipalId,
      homeDir: this.getHomeDir(),
    });
    const promptStore = this.createPromptStore(nextConfig);
    try {
      await promptStore.reload();
      const previousPromptStore = this.promptStore;
      this.config = nextConfig;
      this.promptStore = promptStore;
      this.settingsEditor = new SettingsEditor(nextConfig.agentCwd, nextConfig.prompt);
      await this.reloadSettingsLayers(nextConfig);
      this.agent?.setModelClient(this.createModelClient(nextConfig));
      this.agent?.setPromptStore(promptStore);
      previousPromptStore?.dispose();
    } catch (error) {
      promptStore.dispose();
      throw error;
    }
    const nextConfigPayload = this.buildPersistedModelConfigPayload(nextConfig);
    if (
      input.persistPendingConfigFact &&
      JSON.stringify(previousConfigPayload ?? null) !== JSON.stringify(nextConfigPayload ?? null)
    ) {
      this.persistLooseConfigAuxiliaryMessage(Date.now(), nextConfigPayload);
    }
  }

  async readEditable(kind: EditableKind): Promise<{ path: string; content: string; mtimeMs: number }> {
    if (!this.settingsEditor) {
      throw new Error("runtime not started");
    }
    return this.settingsEditor.read(kind);
  }

  async saveEditable(
    kind: EditableKind,
    content: string,
    baseMtimeMs: number,
  ): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    if (!this.settingsEditor) {
      throw new Error("runtime not started");
    }
    const result = await this.settingsEditor.save(kind, content, baseMtimeMs);
    if (result.ok) {
      await this.reloadSettingsFromDisk({ persistPendingConfigFact: kind === "settings" });
    }
    return result;
  }

  async uploadAssets(files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>): Promise<ChatSessionAsset[]> {
    if (!this.sessionDb) {
      throw new Error("session db not initialized");
    }
    const attachments: ChatSessionAsset[] = [];
    for (const file of files) {
      const assetId = crypto.randomUUID();
      const kind = resolveSessionAssetKind(file.mimeType);
      const relativePath = buildSessionAssetRelativePath(assetId, file.name, file.mimeType, kind);
      const filePath = join(this.options.sessionRoot, relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.bytes);
      const asset = this.sessionDb.appendAsset({
        id: assetId,
        kind,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.bytes.byteLength,
        relativePath,
      });
      attachments.push(toChatSessionAsset(this.options.sessionId, asset));
    }
    return attachments;
  }

  getAsset(assetId: string): { asset: SessionAssetRecord; filePath: string } | null {
    if (!this.sessionDb) {
      return null;
    }
    const asset = this.sessionDb.getAssetById(assetId);
    if (!asset) {
      return null;
    }
    return {
      asset,
      filePath: join(this.options.sessionRoot, asset.relativePath),
    };
  }

  private async readImageAttachmentSource(assetId: string): Promise<{ mimeType: string; dataBase64: string } | null> {
    const resolved = this.getAsset(assetId);
    if (!resolved || resolved.asset.kind !== "image") {
      return null;
    }
    try {
      const bytes = await readFile(resolved.filePath);
      return {
        mimeType: resolved.asset.mimeType,
        dataBase64: bytes.toString("base64"),
      };
    } catch {
      return null;
    }
  }

  private resolveChatAttachments(assetIds: string[]): ChatSessionAsset[] {
    if (!this.sessionDb || assetIds.length === 0) {
      return [];
    }
    return this.sessionDb.listAssetsByIds(assetIds).map((asset) => toChatSessionAsset(this.options.sessionId, asset));
  }

  async sendMessageChannel(input: {
    chatId: string;
    accessToken: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): Promise<RuntimeMessageSendResult> {
    const actionId = this.createRuntimeActionId("message_send");
    const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const attachments = this.resolveChatAttachments(input.assetIds ?? []);
    const message = this.messageSystem.sendAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      from: "User",
      kind: "text",
      content: input.text,
      clientMessageId: input.clientMessageId,
      attachments: attachments.map((attachment) => ({
        assetId: attachment.assetId,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
      })),
      metadata: input.clientMessageId ? { clientMessageId: input.clientMessageId } : undefined,
    });
    return await this.buildRuntimeMessageSendResult({
      actionId,
      chatId: input.chatId,
      accessToken: input.accessToken,
      message,
    });
  }

  editMessageChannel(input: { chatId: string; accessToken: string; messageId: number; text: string }): {
    ok: boolean;
    messageId: number;
    updatedAt: number;
  } {
    const actionId = this.createRuntimeActionId("message_edit");
    const message = this.messageSystem.editAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      messageId: input.messageId,
      content: input.text,
    });
    this.recordEffectLedger({
      actionId,
      actionKind: "message_edit",
      actorId: message.senderContactId ?? "unknown",
      target: `room:${input.chatId}`,
      effectKind: "message_row_updated",
      effectRecordId: `${input.chatId}/${message.messageId}`,
      timestamp: message.updatedAt,
      meta: {
        chatId: input.chatId,
        messageId: message.messageId,
      },
    });
    return {
      ok: true,
      messageId: message.messageId,
      updatedAt: message.updatedAt,
    };
  }

  recallMessageChannel(input: { chatId: string; accessToken: string; messageId: number }): {
    ok: boolean;
    messageId: number;
    updatedAt: number;
    recalledAt: number;
  } {
    const actionId = this.createRuntimeActionId("message_recall");
    const message = this.messageSystem.recallAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      messageId: input.messageId,
    });
    if (!message.recalledAt) {
      throw new Error("message recall did not persist recalledAt");
    }
    this.recordEffectLedger({
      actionId,
      actionKind: "message_recall",
      actorId: message.recalledByContactId ?? message.senderContactId ?? "unknown",
      target: `room:${input.chatId}`,
      effectKind: "message_row_recalled",
      effectRecordId: `${input.chatId}/${message.messageId}`,
      timestamp: message.recalledAt,
      meta: {
        chatId: input.chatId,
        messageId: message.messageId,
        recalledAt: message.recalledAt,
      },
    });
    return {
      ok: true,
      messageId: message.messageId,
      updatedAt: message.updatedAt,
      recalledAt: message.recalledAt,
    };
  }

  private appendLocalUserChatMessage(input: {
    chatId: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): MessageRecord {
    const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const attachments = this.resolveChatAttachments(input.assetIds ?? []);
    return this.messageSystem.send({
      chatId: input.chatId,
      from: "User",
      kind: "text",
      content: input.text,
      clientMessageId: input.clientMessageId,
      attachments: attachments.map((attachment) => ({
        assetId: attachment.assetId,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
      })),
      metadata: input.clientMessageId ? { clientMessageId: input.clientMessageId } : undefined,
    });
  }

  sendMessageChannelError(input: {
    chatId: string;
    accessToken: string;
    content: string;
    error: MessageErrorPayload;
    clientMessageId?: string;
  }): void {
    const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    this.messageSystem.sendErrorAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      from: this.getAvatarName(),
      kind: "error",
      content: input.content,
      clientMessageId: input.clientMessageId,
      payload: {
        error: input.error,
      },
      metadata: {
        source: "admin_error",
        ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
      },
    });
  }

  sendMessageChannelInteractive(input: {
    chatId: string;
    accessToken: string;
    content: string;
    interactive: MessageInteractivePayload;
    clientMessageId?: string;
  }): void {
    const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    this.messageSystem.sendInteractiveAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      from: this.getAvatarName(),
      kind: "interactive",
      content: input.content,
      clientMessageId: input.clientMessageId,
      payload: {
        interactive: input.interactive,
      },
      metadata: {
        source: "interactive",
        ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
      },
    });
  }

  pushUserRoomMessage(input: {
    chatId: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): void {
    const isCompactCommand = input.text.trim() === "/compact";
    if (isCompactCommand) {
      this.queueCompactCycle("manual");
    }

    const channelAccess = this.requireActorChannelWriteAccess(input.chatId);
    const channel =
      this.getActorRoom(channelAccess.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(channelAccess.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const message = this.appendLocalUserChatMessage({
      chatId: channel.chatId,
      text: input.text,
      assetIds: input.assetIds,
      clientMessageId: input.clientMessageId,
    });
    if (!this.isUnreadInboundMessage(message) || !channel.accessToken) {
      return;
    }

    if (isCompactCommand) {
      this.messageKernelAdapter.reserveUnreadMessages(channel, [message]);
      return;
    }

    // Let the normal unread collection path observe the new room message.
    // Pre-reserving it here can hide follow-up input that lands while the
    // previous cycle is still settling, because the next wait phase sees no
    // unread delta left to consume.
    this.notifyInput("user");
  }

  triggerTaskManual(input: { source: TaskSourceName; id: string }): { ok: boolean } {
    const task = this.taskEngine.triggerManual(input.source, input.id);
    if (!task) {
      return { ok: false };
    }
    this.emit("taskUpdated", { task });
    this.notifyInput("task");
    return { ok: true };
  }

  emitTaskEvent(input: { topic: string; payload?: unknown; source?: "api" | "file" | "tool" }): { ok: boolean } {
    const result = this.taskEngine.emitEvent({
      topic: input.topic,
      payload: input.payload,
      source: input.source ?? "api",
    });
    if (result.affected.length > 0) {
      this.emit("taskTriggered", result);
      for (const task of result.affected) {
        this.emit("taskUpdated", { task });
      }
      this.notifyInput("task");
    }
    return { ok: true };
  }

  async focusTerminal(terminalId: string): Promise<boolean> {
    return (await this.focusRuntimeTerminals({ op: "add", terminalIds: [terminalId] })).ok;
  }

  snapshot(): SessionRuntimeSnapshot {
    const planeEntries = new Map(
      this.terminalControlPlane.listForActor(this.terminalActorId).map((entry) => [entry.terminalId, entry] as const),
    );
    const terminals = [...planeEntries.values()].map((planeEntry) => {
      const managed = this.terminals.get(planeEntry.terminalId);
      const snapshot = managed?.getSnapshot();
      const statusEntry = this.terminalStatusById.get(planeEntry.terminalId);
      return {
        terminalId: planeEntry.terminalId,
        status: statusEntry?.status ?? managed?.getStatus() ?? planeEntry.status,
        processPhase: statusEntry?.processPhase ?? planeEntry.processPhase,
        lifecycleTransition: statusEntry?.lifecycleTransition ?? planeEntry.lifecycleTransition ?? null,
        seq: snapshot?.seq ?? 0,
        launchCwd: planeEntry.launchCwd,
        icon: planeEntry?.icon,
        configuredTitle: planeEntry?.configuredTitle,
        currentTitle: planeEntry?.currentTitle,
        currentPath: planeEntry?.currentPath,
        lastStopReason: planeEntry?.lastStopReason,
        lastExitCode: planeEntry?.lastExitCode,
        lastExitSignal: planeEntry?.lastExitSignal,
        lastStoppedAt: planeEntry?.lastStoppedAt,
        shortcuts: planeEntry?.shortcuts,
        transportUrl: planeEntry?.transportUrl,
      };
    });

    return {
      sessionId: this.options.sessionId,
      started: this.started,
      activityState:
        this.loopKernelSnapshot?.state.paused || (this.loopPhase === "waiting_commits" && this.stage === "idle")
          ? "idle"
          : "active",
      schedulerPhase: this.loopPhase,
      stage: this.stage,
      focusedTerminalId: this.focusedTerminalIds[0] ?? "",
      focusedTerminalIds: [...this.focusedTerminalIds],
      chatMessages: [...this.chatMessages],
      messageChannels: this.listMessageChannels(),
      terminalSnapshots: { ...this.terminalSnapshots },
      terminalReads: { ...this.terminalReads },
      terminals,
      tasks: this.taskEngine.list(),
      schedulerState: this.loopKernelSnapshot?.state ?? null,
      attention: this.buildAttentionRuntimePreviewState(),
      attentionDelivery: this.buildAttentionDeliveryRuntimeState(),
      schedulerSignals: {
        user: { version: this.inputSignalVersion.user, timestamp: this.inputSignalAt.user },
        terminal: { version: this.inputSignalVersion.terminal, timestamp: this.inputSignalAt.terminal },
        task: { version: this.inputSignalVersion.task, timestamp: this.inputSignalAt.task },
        attention: { version: this.inputSignalVersion.attention, timestamp: this.inputSignalAt.attention },
      },
      apiCallRecording: {
        enabled: this.apiCallRecordingRefCount > 0,
        refCount: this.apiCallRecordingRefCount,
      },
      attentionApi: this.runtimeLocalApi
        ? {
            baseUrl: this.runtimeLocalApi.baseUrl,
            principalId: this.options.avatarPrincipalId ?? "",
            managedSeatAuthorityUrl: this.options.managedSeatAuthorityUrl ?? null,
          }
        : null,
      modelCapabilities: this.config
        ? resolveModelCapabilities(this.config.ai)
        : {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
      activeCycle: this.cloneCycle(this.activeCycle),
    };
  }

  private async readTerminalRepresentation(
    terminalId: string,
    input: {
      mode: TerminalReadMode;
      remark: boolean;
      recordActivity?: boolean;
    },
  ): Promise<TerminalReadPayload> {
    const recordActivity = input.recordActivity ?? false;
    const controlPlane = this.terminalControlPlane;
    if (!controlPlane || !controlPlane.has(terminalId)) {
      const terminal = this.terminals.get(terminalId);
      const config = this.config?.terminals[terminalId];
      if (!terminal || !config) {
        return { ok: false, reason: `unknown terminal: ${terminalId}` };
      }

      let snapshotPayload = buildTerminalSnapshotPayload(
        terminalId,
        terminal.getSnapshot(),
        terminal.getStatus(),
        terminal.isRunning() ? "running" : "killed",
      );
      const snapshotJson = JSON.stringify(snapshotPayload);
      const cursorHash = this.terminalReadCursorHashById[terminalId] ?? null;

      if (config.gitLog && input.mode !== "snapshot") {
        const slice = await terminal.sliceDirty({
          fromHash: cursorHash,
          wait: false,
        });
        if (slice.ok && slice.changed && slice.fromHash !== slice.toHash) {
          const diffPayload = buildTerminalDiffPayload(terminalId, {
            fromHash: slice.fromHash,
            toHash: slice.toHash,
            diff: slice.diff,
            bytes: slice.bytes,
            status: terminal.getStatus(),
            processPhase: terminal.isRunning() ? "running" : "killed",
          });
          const shouldUseDiff =
            input.mode === "diff" ||
            (input.mode === "auto" && JSON.stringify(diffPayload).length <= snapshotJson.length);
          const readCursor: ControlPlaneTerminalReadResult["readCursor"] = {
            readerActorId: this.terminalActorId,
            fromHash: slice.fromHash,
            toHash: slice.toHash,
            consumed: input.remark,
          };
          if (shouldUseDiff) {
            if (input.remark) {
              this.terminalReadCursorHashById[terminalId] = slice.toHash;
              this.terminalKernelAdapter.markTerminalConsumed(terminalId);
            }
            return this.publishTerminalReadPayload(
              terminalId,
              attachTerminalReadCursor(diffPayload, readCursor),
              recordActivity,
            );
          }
        }
        const readCursor: ControlPlaneTerminalReadResult["readCursor"] = {
          readerActorId: this.terminalActorId,
          fromHash: slice.ok ? slice.fromHash : cursorHash,
          toHash: slice.ok ? slice.toHash : cursorHash,
          consumed: input.remark,
        };
        if (input.remark && slice.ok) {
          this.terminalReadCursorHashById[terminalId] = slice.toHash;
        }
        snapshotPayload = attachTerminalReadCursor(snapshotPayload, readCursor);
      } else if (config.gitLog && input.mode === "snapshot") {
        const mark = input.remark ? await terminal.markDirty() : null;
        const readCursor: ControlPlaneTerminalReadResult["readCursor"] = {
          readerActorId: this.terminalActorId,
          fromHash: cursorHash,
          toHash: mark?.ok ? mark.hash : cursorHash,
          consumed: input.remark,
        };
        if (mark?.ok) {
          this.terminalReadCursorHashById[terminalId] = mark.hash;
        }
        snapshotPayload = attachTerminalReadCursor(snapshotPayload, readCursor);
      }

      if (input.remark) {
        this.terminalKernelAdapter.markTerminalConsumed(terminalId);
      }
      return this.publishTerminalReadPayload(terminalId, snapshotPayload, recordActivity);
    }
    const payload = await controlPlane.readAuthorized({
      terminalId,
      mode: input.mode,
      remark: input.remark,
      recordActivity,
      actorId: this.terminalActorId,
    });
    if (input.remark) {
      this.terminalKernelAdapter.markTerminalConsumed(terminalId);
    }
    return this.publishTerminalReadPayload(terminalId, payload, recordActivity);
  }

  private publishTerminalReadPayload(
    terminalId: string,
    payload: ControlPlaneTerminalReadResult,
    recordActivity: boolean,
  ): ControlPlaneTerminalReadResult {
    const normalizedPayload: ControlPlaneTerminalReadResult = {
      ...payload,
      recordedActivity: payload.recordedActivity ?? recordActivity,
    };
    this.terminalReads[terminalId] = normalizedPayload;
    this.emit("terminalRead", { terminalId, result: normalizedPayload });
    if (normalizedPayload.recordedActivity) {
      this.appendTerminalActivity({
        terminalId,
        kind: "terminal_read",
        cycleId: this.activeCycleId,
        title: "Terminal read",
        content: normalizedPayload.eventId ? "" : JSON.stringify(normalizedPayload),
        detail: normalizedPayload.eventId
          ? this.createTerminalActivityRefDetail(terminalId, normalizedPayload.eventId, "terminal_read")
          : normalizedPayload,
      });
    }
    return normalizedPayload;
  }

  private async createTerminal(
    terminalId: string,
    config: SessionTerminalConfig,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    await this.ensureRuntimeLocalApiStarted();
    if (!this.runtimeLocalApi || !this.options.avatarPrivateKey) {
      return { ok: false, message: "runtime local api unavailable" };
    }
    const controlPlane = this.requireTerminalControlPlane();
    if (!controlPlane.has(terminalId)) {
      const cwdResolution = await this.resolveRuntimeTerminalCwd({ cwd: config.cwd });
      if (!cwdResolution.ok) {
        return cwdResolution;
      }
      await controlPlane.createForActor(this.terminalActorId, {
        terminalId,
        command: config.command,
        cwd: cwdResolution.cwd,
        profile: {
          cols: 80,
          rows: 24,
          gitLog: config.gitLog,
          logStyle: "rich",
          env: buildSharedTerminalEnvironment({}),
        },
        start: false,
      });
    }
    const terminal = controlPlane.getManagedTerminal(terminalId);
    if (!terminal) {
      return { ok: true };
    }
    this.attachRuntimeTerminal(terminalId, terminal);
    return { ok: true };
  }

  private attachRuntimeTerminal(terminalId: string, terminal: TerminalRuntime): void {
    if (this.terminals.has(terminalId)) {
      this.syncRuntimeTerminalStatus(terminalId);
      return;
    }
    terminal.onSnapshot((snapshot) => {
      const viewFingerprint = buildTerminalViewFingerprint(snapshot);
      const semanticFingerprint = buildTerminalSemanticFingerprint(snapshot);
      const viewChanged = this.terminalViewFingerprint[terminalId] !== viewFingerprint;
      const semanticChanged = this.terminalSemanticFingerprint[terminalId] !== semanticFingerprint;

      this.terminalViewFingerprint[terminalId] = viewFingerprint;
      this.terminalSemanticFingerprint[terminalId] = semanticFingerprint;
      this.terminalSnapshots[terminalId] = snapshot;
      this.terminalLatestSeq[terminalId] = snapshot.seq;
      if (semanticChanged) {
        this.terminalKernelAdapter.markTerminalDirty(terminalId);
      }
      if (viewChanged) {
        this.emit("terminalSnapshot", { terminalId, snapshot });
      }
    });

    terminal.onStatus((running, status) => {
      const previous = this.terminalStatusById.get(terminalId);
      this.syncRuntimeTerminalStatus(terminalId, {
        fallback: {
          processPhase: running ? "running" : "killed",
          status,
        },
      });
      void this.terminalKernelAdapter
        .handleStatusChange({
          terminalId,
          previousStatus: previous?.status ?? null,
          running,
          status,
        })
        .catch((error) => {
          this.emit("error", {
            message: `terminal idle bridge failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        });
    });

    this.terminals.set(terminalId, terminal);
    this.syncRuntimeTerminalStatus(terminalId);
  }

  private syncRuntimeTerminalStatus(
    terminalId: string,
    input: {
      fallback?: {
        processPhase: "not_started" | "running" | "killed";
        status: "IDLE" | "BUSY";
      };
    } = {},
  ): void {
    const planeEntry = this.terminalControlPlane
      .listForActor(this.terminalActorId, { touchPresence: false })
      .find((entry) => entry.terminalId === terminalId);
    if (!planeEntry) {
      this.terminalStatusById.delete(terminalId);
      return;
    }
    const managed = this.terminals.get(terminalId);
    const next = {
      processPhase: managed?.isRunning() ? "running" : (input.fallback?.processPhase ?? planeEntry.processPhase),
      lifecycleTransition: planeEntry.lifecycleTransition ?? null,
      status: input.fallback?.status ?? managed?.getStatus() ?? planeEntry.status,
    } as const;
    const previous = this.terminalStatusById.get(terminalId);
    if (
      previous?.processPhase === next.processPhase &&
      previous?.lifecycleTransition === next.lifecycleTransition &&
      previous?.status === next.status
    ) {
      return;
    }
    this.terminalStatusById.set(terminalId, next);
    this.emit("terminalStatus", {
      terminalId,
      processPhase: next.processPhase,
      lifecycleTransition: next.lifecycleTransition,
      status: next.status,
    });
  }

  private scheduleKilledRuntimeTerminal(terminal: TerminalControlPlaneEntry): Promise<void> {
    const existing = this.killedTerminalWorkById.get(terminal.terminalId);
    if (existing) {
      return existing;
    }
    const work = this.handleKilledRuntimeTerminal(terminal).finally(() => {
      this.killedTerminalWorkById.delete(terminal.terminalId);
    });
    this.killedTerminalWorkById.set(terminal.terminalId, work);
    return work;
  }

  private async handleKilledRuntimeTerminal(terminal: TerminalControlPlaneEntry): Promise<void> {
    this.terminals.delete(terminal.terminalId);
    delete this.terminalLatestSeq[terminal.terminalId];
    delete this.terminalSnapshots[terminal.terminalId];
    delete this.terminalReads[terminal.terminalId];
    delete this.terminalReadCursorHashById[terminal.terminalId];
    this.terminalStatusById.delete(terminal.terminalId);
    this.terminalKernelAdapter.markTerminalConsumed(terminal.terminalId);
    await this.enqueueTerminalLifecycleAttentionCommit({
      terminalId: terminal.terminalId,
      contextId: this.getTerminalAttentionContextId(terminal.terminalId),
      event: "terminal_killed",
      summary: `Terminal ${terminal.terminalId} was killed`,
      boundaryChannel: "world_fact",
      payload: {
        processPhase: terminal.processPhase,
        lastStopReason: terminal.lastStopReason ?? null,
        lastExitCode: terminal.lastExitCode ?? null,
        lastExitSignal: terminal.lastExitSignal ?? null,
        lastStoppedAt: terminal.lastStoppedAt ?? null,
      },
    });
  }

  private requireTerminalControlPlane(): TerminalControlPlane {
    return this.terminalControlPlane;
  }

  private notifyInput(kind: LoopInputKind): void {
    const version = this.inputSignals[kind].notify();
    const timestamp = Date.now();
    this.inputSignalVersion[kind] = version;
    this.inputSignalAt[kind] = timestamp;
    if (kind !== "attention") {
      this.resetAttentionDebtBackoff();
    }
    if ((kind === "user" || kind === "terminal") && this.getAttentionRetryPolicy().resetOnExternalInput) {
      this.clearAllAttentionContainment();
    }
    this.emit("schedulerSignal", { kind, version, timestamp });
  }

  private hasTimeBasedTask(): boolean {
    return this.taskEngine
      .list()
      .some(
        (task) =>
          task.triggers.some((trigger) => trigger.type === "at" || trigger.type === "cron") && task.status !== "done",
      );
  }

  private buildAttentionDebtState(): AttentionDebtState {
    const active = this.attentionSystem.listActiveContexts();
    let unresolvedScoreCount = 0;
    for (const match of active) {
      unresolvedScoreCount += Object.values(match.context.scoreMap).filter((score) => score >= 1).length;
    }
    return {
      activeContextCount: active.length,
      activeItemCount: active.length,
      unresolvedScoreCount,
    };
  }

  private getAttentionRetryPolicy() {
    return this.config?.loop.retryPolicy ?? DEFAULT_LOOP_RETRY_POLICY;
  }

  private getAttentionContainmentBackoffMs(retryCount: number): number {
    const policy = this.getAttentionRetryPolicy();
    const steps = Math.max(0, retryCount - 1);
    return Math.min(policy.maxBackoffMs, Math.round(policy.initialBackoffMs * policy.multiplier ** steps));
  }

  private pruneAttentionContainment(active: AttentionActiveContextMatch[]): void {
    const activeIds = new Set(active.map((match) => match.contextId));
    for (const contextId of [...this.attentionContainment.keys()]) {
      if (!activeIds.has(contextId)) {
        this.attentionContainment.delete(contextId);
      }
    }
  }

  private clearAttentionContainment(contextId: string): void {
    this.attentionContainment.delete(contextId);
  }

  private clearAllAttentionContainment(): void {
    this.attentionContainment.clear();
  }

  private clearAttentionContainmentMany(contextIds: Iterable<string>): void {
    for (const contextId of contextIds) {
      this.clearAttentionContainment(contextId);
    }
  }

  private markAttentionProgress(contextIds: Iterable<string>): void {
    if (this.getAttentionRetryPolicy().resetOnProgress) {
      this.clearAttentionContainmentMany(contextIds);
    }
    this.lastAttentionProgressAt = Date.now();
    this.resetAttentionDebtBackoff();
  }

  private buildAttentionFailureFingerprint(input: {
    status: "running" | "done" | "error" | "cancelled";
    provider: string;
    model: string;
    outcome?: {
      code?: string;
      reason?: string;
      message?: string;
    };
    error?: {
      message?: string;
      name?: string;
    };
  }): string {
    const reason = input.outcome?.reason?.trim();
    if (reason) {
      return reason;
    }
    const message = input.error?.message?.trim() || input.outcome?.message?.trim();
    const name = input.error?.name?.trim() || input.outcome?.code?.trim() || input.status;
    return `${input.provider}:${input.model}:${name}:${message ?? ""}`;
  }

  private recordAttentionContainmentFailure(
    contextIds: Iterable<string>,
    input: {
      status: "running" | "done" | "error" | "cancelled";
      provider: string;
      model: string;
      outcome?: {
        code?: string;
        reason?: string;
        message?: string;
      };
      error?: {
        message?: string;
        name?: string;
      };
    },
  ): void {
    const now = Date.now();
    const fingerprint = this.buildAttentionFailureFingerprint(input);
    for (const contextId of new Set(contextIds)) {
      const previous = this.attentionContainment.get(contextId);
      const retryCount = previous?.fingerprint === fingerprint ? previous.retryCount + 1 : 1;
      this.attentionContainment.set(contextId, {
        contextId,
        fingerprint,
        retryCount,
        nextWakeAt: now + this.getAttentionContainmentBackoffMs(retryCount),
        updatedAt: now,
      });
    }
  }

  private summarizeAttentionContainment(
    active: AttentionActiveContextMatch[],
    now = Date.now(),
  ): AttentionContainmentSummary {
    const policy = this.getAttentionRetryPolicy();
    this.pruneAttentionContainment(active);
    let hasReady = false;
    let nextWakeAt: number | null = null;
    let retryCount = 0;
    let hasBlocked = false;
    let blockedReason: string | null = null;

    for (const match of active) {
      const entry = this.attentionContainment.get(match.contextId);
      if (!entry) {
        hasReady = true;
        continue;
      }
      retryCount = Math.max(retryCount, entry.retryCount);
      if (policy.maxAttempts !== null && entry.retryCount >= policy.maxAttempts) {
        hasBlocked = true;
        blockedReason ??= `retry policy max attempts reached (${entry.retryCount}/${policy.maxAttempts})`;
        continue;
      }
      if (entry.nextWakeAt <= now) {
        hasReady = true;
        continue;
      }
      nextWakeAt = nextWakeAt === null ? entry.nextWakeAt : Math.min(nextWakeAt, entry.nextWakeAt);
    }

    if (hasReady) {
      return {
        state: "ready",
        nextWakeAt: null,
        retryCount,
        blockedReason,
      };
    }
    if (nextWakeAt !== null) {
      return {
        state: "backoff",
        nextWakeAt,
        retryCount,
        blockedReason,
      };
    }
    if (hasBlocked) {
      return {
        state: "blocked",
        nextWakeAt: null,
        retryCount,
        blockedReason,
      };
    }
    return {
      state: "none",
      nextWakeAt: null,
      retryCount: 0,
      blockedReason: null,
    };
  }

  private pruneDirtyAttentionContextIds(): void {
    for (const contextId of [...this.dirtyAttentionContextIds]) {
      const context = this.attentionSystem.getContext(contextId);
      if (!context || !context.isActive()) {
        this.clearDirtyAttentionContext(contextId);
      }
    }
  }

  private markAttentionContextDirty(contextId: string, commitId?: string): void {
    this.dirtyAttentionContextIds.add(contextId);
    this.dirtyAttentionContextOrder.set(contextId, ++this.nextAttentionDirtyOrder);
    if (commitId) {
      const existing = this.dirtyAttentionCommitIdsByContext.get(contextId);
      if (existing) {
        existing.add(commitId);
      } else {
        this.dirtyAttentionCommitIdsByContext.set(contextId, new Set([commitId]));
      }
    }
  }

  private buildStagedAttentionItemKey(contextId: string, commit: AttentionCommit): string {
    const src = typeof commit.meta.src === "string" && commit.meta.src.length > 0 ? commit.meta.src : commit.commitId;
    return `${contextId}:${src}`;
  }

  private stageAttentionCommit(contextId: string, commit: AttentionCommit): void {
    const key = this.buildStagedAttentionItemKey(contextId, commit);
    const entries = this.stagedAttentionItemsByContext.get(contextId) ?? new Map<string, StagedAttentionItemEntry>();
    entries.set(key, {
      key,
      commitId: commit.commitId,
      sourceId: typeof commit.meta.src === "string" ? commit.meta.src : commit.commitId,
      ingressType: commit.ingressType,
      isNotify: this.isNotificationAttentionCommit(commit),
      updatedAt: Date.parse(commit.createdAt) || Date.now(),
    });
    this.stagedAttentionItemsByContext.set(contextId, entries);
  }

  private unstageAttentionItems(contextId: string, keys: readonly string[]): void {
    const entries = this.stagedAttentionItemsByContext.get(contextId);
    if (!entries) {
      return;
    }
    for (const key of keys) {
      entries.delete(key);
    }
    if (entries.size === 0) {
      this.stagedAttentionItemsByContext.delete(contextId);
    }
  }

  private clearAttentionCurrentState(): void {
    this.attentionContextSnapshot.clear();
    this.pendingAttentionMessagePlans.clear();
    this.attentionBoundaryRefreshPending = false;
  }

  private commitInjectedAttentionPlans(input: {
    requestMessages?: readonly TextOnlyModelMessage[];
    collectedInputs?: readonly SessionCollectedInput[];
  }): void {
    const injectedPlanIds = new Set<string>();
    for (const item of input.collectedInputs ?? []) {
      if (item.source !== "attention") {
        continue;
      }
      const planId = (item.meta as AttentionCollectedInputMeta | undefined)?.attentionMessagePlanId;
      if (typeof planId === "string" && planId.length > 0) {
        injectedPlanIds.add(planId);
      }
    }
    if (injectedPlanIds.size === 0 && input.requestMessages) {
      for (const plan of this.pendingAttentionMessagePlans.values()) {
        const matched = input.requestMessages.some(
          (message) => modelMessageContentToText(message.content) === plan.text,
        );
        if (matched) {
          injectedPlanIds.add(plan.messageId);
        }
      }
    }
    let boundaryRefreshCleared = false;
    const nextSnapshots = new Map<string, AttentionVisibleSnapshot>();
    for (const [messageId, plan] of [...this.pendingAttentionMessagePlans.entries()]) {
      if (!injectedPlanIds.has(messageId)) {
        continue;
      }
      const previous = nextSnapshots.get(plan.contextId) ?? this.attentionContextSnapshot.get(plan.contextId) ?? null;
      const mergedSnapshot =
        plan.kind === "items"
          ? {
              contextId: plan.contextId,
              kind: previous?.kind ?? "items",
              text: previous?.text ?? plan.text,
              headCommitId: previous?.headCommitId ?? plan.headCommitId,
              updatedAt: previous?.updatedAt ?? plan.updatedAt,
              seededFocusState: previous?.seededFocusState ?? plan.seededFocusState,
            }
          : {
              contextId: plan.contextId,
              kind: plan.kind,
              text: plan.text,
              headCommitId: plan.headCommitId,
              updatedAt: plan.updatedAt,
              seededFocusState: plan.seededFocusState,
            };
      nextSnapshots.set(plan.contextId, mergedSnapshot);
      if (plan.clearStageKeys.length > 0) {
        this.unstageAttentionItems(plan.contextId, plan.clearStageKeys);
      }
      if (plan.notifyOnly && plan.notifyQuotaRecords && plan.notifyQuotaRecords.length > 0 && this.sessionDb) {
        const sentAt = Date.parse(plan.updatedAt) || Date.now();
        for (const [index, record] of plan.notifyQuotaRecords.entries()) {
          this.sessionDb.appendNotifyQuotaRecord({
            notifyId: `${plan.contextId}:${plan.messageId}:${record.sourceId}:${index}`,
            contextId: plan.contextId,
            quotaTarget: record.quotaTarget,
            focusState: record.focusState,
            sourceId: record.sourceId,
            commitId: plan.attentionCommitRefs[index]?.commitId ?? plan.headCommitId ?? plan.messageId,
            sentAt,
            windowMs: record.windowMs,
            meta: {
              attentionMessagePlanId: plan.messageId,
            },
          });
        }
      }
      if (plan.clearsBoundaryRefresh) {
        boundaryRefreshCleared = true;
      }
      this.pendingAttentionMessagePlans.delete(messageId);
    }
    for (const [contextId, snapshot] of nextSnapshots.entries()) {
      this.attentionContextSnapshot.set(contextId, snapshot);
    }
    if (boundaryRefreshCleared) {
      this.attentionBoundaryRefreshPending = false;
    }
  }

  private clearDirtyAttentionContext(contextId: string): void {
    this.dirtyAttentionContextIds.delete(contextId);
    this.dirtyAttentionCommitIdsByContext.delete(contextId);
    this.dirtyAttentionContextOrder.delete(contextId);
  }

  private resolveAttentionCollectionPriority(match: AttentionActiveContextMatch): number {
    if (this.resolveMessageChatIdForContext(match.contextId)) {
      return 3;
    }
    if (match.contextId.startsWith("ctx-task-")) {
      return 2;
    }
    if (this.isSkillAttentionContext(match)) {
      return -1;
    }
    if (match.contextId.startsWith("ctx-terminal-")) {
      return 0;
    }
    return 1;
  }

  private selectDirtyAttentionContexts(active: AttentionActiveContextMatch[]): AttentionActiveContextMatch[] {
    const activeById = new Map(active.map((match) => [match.contextId, match] as const));
    const ordered = [...this.dirtyAttentionContextOrder.entries()]
      .map(([contextId, order]) => ({
        order,
        match: activeById.get(contextId) ?? null,
      }))
      .filter(
        (
          entry,
        ): entry is {
          order: number;
          match: AttentionActiveContextMatch;
        } => entry.match !== null,
      )
      .sort((left, right) => {
        const priorityDelta =
          this.resolveAttentionCollectionPriority(right.match) - this.resolveAttentionCollectionPriority(left.match);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return right.order - left.order;
      })
      .map((entry) => entry.match);
    const hasNonSkillDirty = ordered.some((match) => !this.isSkillAttentionContext(match));
    if (!hasNonSkillDirty) {
      return ordered;
    }
    return ordered.filter((match) => !this.isSkillAttentionContext(match));
  }

  private selectAttentionDebtContexts(active: AttentionActiveContextMatch[]): AttentionActiveContextMatch[] {
    const now = Date.now();
    return [...active]
      .filter((match) => {
        const entry = this.attentionContainment.get(match.contextId);
        if (!entry) {
          return true;
        }
        return entry.nextWakeAt <= now;
      })
      .sort((left, right) => {
        const priorityDelta =
          this.resolveAttentionCollectionPriority(right) - this.resolveAttentionCollectionPriority(left);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        const leftUpdated = Date.parse(left.context.updatedAt);
        const rightUpdated = Date.parse(right.context.updatedAt);
        if (leftUpdated !== rightUpdated) {
          return rightUpdated - leftUpdated;
        }
        return left.contextId.localeCompare(right.contextId);
      })
      .slice(0, 1);
  }

  private hasPendingAttentionInputs(): boolean {
    this.pruneDirtyAttentionContextIds();
    const active = this.attentionSystem.listActiveContexts();
    const visible = this.listAttentionVisibleContextMatches();
    const selected = this.selectDirtyAttentionContexts(active);
    const planMatches = selected.length > 0 ? selected : this.attentionBoundaryRefreshPending ? visible : [];
    for (const match of planMatches) {
      for (const plan of this.selectAttentionProtocolPlan(match)) {
        if (!this.pendingAttentionMessagePlans.has(plan.messageId)) {
          return true;
        }
      }
    }
    return false;
  }

  private resetAttentionDebtBackoff(): void {
    this.attentionDebtBackoffMs = ATTENTION_DEBT_INITIAL_BACKOFF_MS;
    this.attentionDebtNextWakeAt = null;
    this.attentionForceCollect = false;
  }

  private requestAttentionContextBoundaryRefresh(): void {
    // Boundary refreshes rebuild the model's AttentionContext projection after
    // start/compact without pretending historical commits are new items.
    this.clearAttentionCurrentState();
    this.dirtyAttentionContextIds.clear();
    this.dirtyAttentionCommitIdsByContext.clear();
    this.dirtyAttentionContextOrder.clear();
    this.resetAttentionDebtBackoff();
    this.attentionForceCollect = true;
    this.attentionBoundaryRefreshPending = true;
    this.notifyInput("attention");
  }

  private listAttentionVisibleContextMatches(): AttentionActiveContextMatch[] {
    const activeById = new Map(
      this.attentionSystem.listActiveContexts().map((match) => [match.contextId, match] as const),
    );
    return this.attentionSystem
      .snapshot()
      .contexts.map((context) => activeById.get(context.contextId) ?? this.getAttentionContextMatch(context.contextId))
      .filter((match): match is AttentionActiveContextMatch => match !== null)
      .filter((match) => match.context.focusState !== "muted")
      .sort((left, right) => {
        const leftUpdated = Date.parse(left.context.updatedAt);
        const rightUpdated = Date.parse(right.context.updatedAt);
        if (leftUpdated !== rightUpdated) {
          return rightUpdated - leftUpdated;
        }
        return left.contextId.localeCompare(right.contextId);
      });
  }

  private advanceAttentionDebtBackoff(): void {
    this.attentionDebtBackoffMs = Math.min(
      ATTENTION_DEBT_MAX_BACKOFF_MS,
      Math.max(
        ATTENTION_DEBT_INITIAL_BACKOFF_MS,
        Math.round(this.attentionDebtBackoffMs * ATTENTION_DEBT_BACKOFF_MULTIPLIER),
      ),
    );
    this.attentionDebtNextWakeAt = null;
  }

  private resolveLoopWaitingReason(phase: LoopBusPhase, paused: boolean): string | null {
    if (!this.started) {
      return "stopped";
    }
    if (this.isLoopStopped()) {
      return "stopped";
    }
    const activeAttention = this.attentionSystem.listActiveContexts();
    if (activeAttention.length > 0) {
      const containment = this.summarizeAttentionContainment(activeAttention);
      if (containment.state === "backoff") {
        return "attention_backoff";
      }
      if (containment.state === "blocked") {
        return "attention_blocked";
      }
    }
    if (paused) {
      return "paused";
    }
    if (phase !== "waiting_commits") {
      return null;
    }
    if (this.hasPendingCompactCycle()) {
      return "ready_now";
    }
    if (this.hasUnreadRoomWork() || this.inboundMessageQueue.length > 0 || this.taskAttentionDraftQueue.length > 0) {
      return "ready_now";
    }
    if (this.inputSignals.task.current() > this.inputSignalCursor.task) {
      return "ready_now";
    }
    if (this.hasPendingAttentionInputs()) {
      return "ready_now";
    }
    if (activeAttention.length > 0) {
      return "attention_debt";
    }
    if (this.hasTimeBasedTask()) {
      return "task_timer";
    }
    return "external_input";
  }

  private async waitForAnyInput(): Promise<LoopInputKind> {
    if (!this.started) {
      if (this.loopSuspension === "fresh") {
        if (this.abortWakeRequested) {
          this.loopKernelLastWakeCause = "attention_signal";
          return "attention";
        }
        const hasPendingAttention = this.hasPendingAttentionInputs();
        const now = Date.now();
        const retryPolicy = this.getAttentionRetryPolicy();
        const hasDueAttentionContainmentWake = this.attentionSystem.listActiveContexts().some((match) => {
          const entry = this.attentionContainment.get(match.contextId);
          if (!entry) {
            return false;
          }
          if (retryPolicy.maxAttempts !== null && entry.retryCount >= retryPolicy.maxAttempts) {
            return false;
          }
          return entry.nextWakeAt <= now;
        });
        if (this.hasPendingCompactCycle()) {
          this.loopKernelLastWakeCause = "compact_cycle";
          this.resetAttentionDebtBackoff();
          return "attention";
        }
        if (this.inboundMessageQueue.length > 0) {
          this.loopKernelLastWakeCause = "user_input";
          this.resetAttentionDebtBackoff();
          return "user";
        }
        if (this.taskAttentionDraftQueue.length > 0) {
          this.loopKernelLastWakeCause = "task_input";
          this.resetAttentionDebtBackoff();
          return "task";
        }
        if (hasDueAttentionContainmentWake) {
          this.attentionForceCollect = true;
          this.loopKernelLastWakeCause = "attention_backoff";
          return "attention";
        }
        if (this.inputSignals.task.current() > this.inputSignalCursor.task) {
          this.loopKernelLastWakeCause = "task_input";
          this.resetAttentionDebtBackoff();
          return "task";
        }
        if (hasPendingAttention) {
          this.loopKernelLastWakeCause = "attention_signal";
          this.resetAttentionDebtBackoff();
          return "attention";
        }
        const activeAttention = this.attentionSystem.listActiveContexts();
        const attentionContainment = this.summarizeAttentionContainment(activeAttention);
        return await new Promise<LoopInputKind>((resolve) => {
          let attentionDebtTimer: ReturnType<typeof setTimeout> | null = null;
          const signalWaiters = (["user", "task", "attention"] as const).map((kind) => ({
            kind,
            ...this.inputSignals[kind].waitAfter(this.inputSignalCursor[kind]),
          }));
          const settle = (kind: LoopInputKind): void => {
            if (attentionDebtTimer) {
              clearTimeout(attentionDebtTimer);
            }
            for (const waiter of signalWaiters) {
              waiter.cancel();
            }
            resolve(kind);
          };
          if (attentionContainment.state === "ready") {
            const scheduledBackoffMs = this.attentionDebtBackoffMs;
            this.attentionDebtNextWakeAt = Date.now() + scheduledBackoffMs;
            attentionDebtTimer = setTimeout(() => {
              this.attentionForceCollect = true;
              this.loopKernelLastWakeCause = "attention_debt";
              settle("attention");
            }, scheduledBackoffMs);
          } else if (attentionContainment.state === "backoff" && attentionContainment.nextWakeAt !== null) {
            const waitMs = Math.max(0, attentionContainment.nextWakeAt - Date.now());
            this.attentionDebtNextWakeAt = attentionContainment.nextWakeAt;
            attentionDebtTimer = setTimeout(() => {
              this.attentionForceCollect = true;
              this.loopKernelLastWakeCause = "attention_backoff";
              settle("attention");
            }, waitMs);
          } else {
            this.attentionDebtNextWakeAt = null;
          }
          for (const waiter of signalWaiters) {
            void waiter.promise.then(() => {
              if (waiter.kind === "task") {
                this.loopKernelLastWakeCause ??= "task_input";
                this.resetAttentionDebtBackoff();
              } else if (waiter.kind === "user") {
                this.loopKernelLastWakeCause ??= "user_input";
                this.resetAttentionDebtBackoff();
              } else {
                this.loopKernelLastWakeCause ??= "attention_signal";
                this.resetAttentionDebtBackoff();
              }
              settle(waiter.kind);
            });
          }
        });
      }
      return new Promise<LoopInputKind>((resolve) => {
        const poll = (): void => {
          if (this.inputSignals.user.current() > this.inputSignalCursor.user) {
            this.loopKernelLastWakeCause = "user_input";
            resolve("user");
            return;
          }
          if (this.inputSignals.task.current() > this.inputSignalCursor.task) {
            this.loopKernelLastWakeCause = "task_input";
            resolve("task");
            return;
          }
          setTimeout(poll, 5);
        };
        poll();
      });
    }
    if (this.isLoopStopped()) {
      return new Promise<LoopInputKind>((resolve) => {
        const poll = (): void => {
          if (!this.isLoopStopped()) {
            resolve(this.waitForAnyInput());
            return;
          }
          if (this.inputSignals.user.current() > this.inputSignalCursor.user) {
            this.loopKernelLastWakeCause = "user_input";
            resolve("user");
            return;
          }
          if (this.inputSignals.task.current() > this.inputSignalCursor.task) {
            this.loopKernelLastWakeCause = "task_input";
            resolve("task");
            return;
          }
          setTimeout(poll, 5);
        };
        poll();
      });
    }
    if (this.abortWakeRequested) {
      this.loopKernelLastWakeCause = "attention_signal";
      return "attention";
    }
    const loopPaused = this.isLoopPaused();
    const hasPendingAttention = this.hasPendingAttentionInputs();
    const now = Date.now();
    const retryPolicy = this.getAttentionRetryPolicy();
    const hasDueAttentionContainmentWake = this.attentionSystem.listActiveContexts().some((match) => {
      const entry = this.attentionContainment.get(match.contextId);
      if (!entry) {
        return false;
      }
      if (retryPolicy.maxAttempts !== null && entry.retryCount >= retryPolicy.maxAttempts) {
        return false;
      }
      return entry.nextWakeAt <= now;
    });
    if (this.hasPendingCompactCycle()) {
      this.loopKernelLastWakeCause = "compact_cycle";
      this.resetAttentionDebtBackoff();
      return "attention";
    }
    if (!loopPaused && this.hasUnreadRoomWork()) {
      this.loopKernelLastWakeCause = "user_input";
      this.resetAttentionDebtBackoff();
      return "user";
    }
    if (this.inboundMessageQueue.length > 0) {
      this.loopKernelLastWakeCause = "user_input";
      this.resetAttentionDebtBackoff();
      return "user";
    }
    if (this.taskAttentionDraftQueue.length > 0) {
      this.loopKernelLastWakeCause = "task_input";
      this.resetAttentionDebtBackoff();
      return "task";
    }
    if (hasDueAttentionContainmentWake) {
      this.attentionForceCollect = true;
      this.loopKernelLastWakeCause = "attention_backoff";
      return "attention";
    }
    if (this.inputSignals.task.current() > this.inputSignalCursor.task) {
      this.loopKernelLastWakeCause = "task_input";
      this.resetAttentionDebtBackoff();
      return "task";
    }
    if (hasPendingAttention) {
      this.loopKernelLastWakeCause = "attention_signal";
      this.resetAttentionDebtBackoff();
      return "attention";
    }

    this.inputSignalCursor.user = this.inputSignals.user.current();
    if (this.taskAttentionDraftQueue.length === 0 && !this.hasTimeBasedTask()) {
      this.inputSignalCursor.task = this.inputSignals.task.current();
    }
    if (!hasPendingAttention) {
      this.inputSignalCursor.attention = this.inputSignals.attention.current();
    }
    if (!loopPaused) {
      this.inputSignalCursor.terminal = this.inputSignals.terminal.current();
    }

    const signalWaiters = ([...(loopPaused ? [] : (["terminal"] as const)), "user", "task", "attention"] as const).map(
      (kind) => ({
        kind,
        ...this.inputSignals[kind].waitAfter(this.inputSignalCursor[kind]),
      }),
    );
    const unreadHandle = loopPaused
      ? null
      : this.messageSystem.waitUnreadCommitted({
          contactId: this.messageContactId,
          fromVersion: this.messageSystem.getUnreadVersion(this.messageContactId),
        });

    const promises: Array<Promise<{ kind: LoopInputKind }>> = [
      ...(unreadHandle
        ? [
            unreadHandle.promise
              .then(() => ({ kind: "user" as const }))
              .catch((error) => {
                if (error === IGNORE_WAIT) {
                  return new Promise<{ kind: LoopInputKind }>(() => {});
                }
                throw error;
              }),
          ]
        : []),
      ...signalWaiters.map((item) => item.promise.then(() => ({ kind: item.kind }))),
    ];

    let timer: ReturnType<typeof setTimeout> | null = null;
    let attentionDebtTimer: ReturnType<typeof setTimeout> | null = null;
    const activeAttention = this.attentionSystem.listActiveContexts();
    const attentionContainment = this.summarizeAttentionContainment(activeAttention);
    this.attentionDebtNextWakeAt = null;
    if (this.hasTimeBasedTask()) {
      promises.push(
        new Promise<{ kind: LoopInputKind }>((resolve) => {
          timer = setTimeout(() => {
            this.notifyInput("task");
            resolve({ kind: "task" });
          }, 1_000);
        }),
      );
    }
    if (attentionContainment.state === "ready") {
      const scheduledBackoffMs = this.attentionDebtBackoffMs;
      this.attentionDebtNextWakeAt = Date.now() + scheduledBackoffMs;
      promises.push(
        new Promise<{ kind: LoopInputKind }>((resolve) => {
          attentionDebtTimer = setTimeout(() => {
            this.attentionForceCollect = true;
            this.loopKernelLastWakeCause = "attention_debt";
            resolve({ kind: "attention" });
          }, scheduledBackoffMs);
        }),
      );
    } else if (attentionContainment.state === "backoff" && attentionContainment.nextWakeAt !== null) {
      const waitMs = Math.max(0, attentionContainment.nextWakeAt - Date.now());
      this.attentionDebtNextWakeAt = attentionContainment.nextWakeAt;
      promises.push(
        new Promise<{ kind: LoopInputKind }>((resolve) => {
          attentionDebtTimer = setTimeout(() => {
            this.attentionForceCollect = true;
            this.loopKernelLastWakeCause = "attention_backoff";
            resolve({ kind: "attention" });
          }, waitMs);
        }),
      );
    }

    const winner = await Promise.race(promises);
    if (timer) {
      clearTimeout(timer);
    }
    if (attentionDebtTimer) {
      clearTimeout(attentionDebtTimer);
    }
    this.attentionDebtNextWakeAt = null;
    if (winner.kind === "attention" && this.attentionForceCollect) {
      if (attentionContainment.state === "ready") {
        this.advanceAttentionDebtBackoff();
      }
    } else if (winner.kind === "task") {
      this.loopKernelLastWakeCause ??= "task_timer";
      this.resetAttentionDebtBackoff();
    } else if (winner.kind === "user") {
      this.loopKernelLastWakeCause ??= "user_input";
      this.resetAttentionDebtBackoff();
    } else if (winner.kind === "attention" && !this.attentionForceCollect) {
      this.loopKernelLastWakeCause ??= "attention_signal";
      this.resetAttentionDebtBackoff();
    }
    unreadHandle?.reject(IGNORE_WAIT);
    for (const waiter of signalWaiters) {
      waiter.cancel();
    }
    return winner.kind;
  }

  private async collectLoopInputs(): Promise<LoopBusInput[] | undefined> {
    if (this.isLoopStopped()) {
      for (const kind of Object.keys(this.inputSignalCursor) as Array<LoopInputKind>) {
        if (kind === "user" || kind === "task") {
          continue;
        }
        this.inputSignalCursor[kind] = this.inputSignals[kind].current();
      }
      return undefined;
    }
    await this.flushPendingRuntimeSkillChanges();
    await this.pollTaskSources("watch");
    await this.pollTaskEventInbox();
    await this.collectUnreadRoomIngress();
    await this.flushPluginAttentionDrafts();
    const triggered = this.taskEngine.pollTime();
    if (triggered.affected.length > 0) {
      this.emit("taskTriggered", triggered);
      for (const task of triggered.affected) {
        this.emit("taskUpdated", { task });
      }
      this.enqueueTaskAttentionDraft({
        subjectId: buildStableAttentionSubjectId("trigger", `${triggered.source}:${triggered.topic}`),
        reason: "task-triggered",
        content: JSON.stringify({
          kind: "task-triggered",
          source: triggered.source,
          topic: triggered.topic,
          affected: triggered.affected.map((task) => ({ key: task.key, status: task.status, progress: task.progress })),
        }),
        from: "task-system",
      });
      this.notifyInput("task");
    }

    const pendingCompact = this.collectPendingCompactCycleInputs();
    if (pendingCompact) {
      for (const kind of Object.keys(this.inputSignalCursor) as Array<LoopInputKind>) {
        this.inputSignalCursor[kind] = this.inputSignals[kind].current();
      }
      return pendingCompact;
    }

    const outputs: LoopBusInput[] = [];
    if (this.inboundMessageQueue.length > 0) {
      const messageInputs = this.inboundMessageQueue.splice(0, this.inboundMessageQueue.length);
      if (!this.loopPluginRuntime) {
        outputs.push(...messageInputs);
        const drafts = messageInputs
          .filter((item) => item.text.trim() !== "/compact")
          .flatMap((item): AttentionDraft[] => {
            const messageId = item.id ? Number(item.id) : Number.NaN;
            const chatId = typeof item.meta?.chatId === "string" ? item.meta.chatId : null;
            if (!Number.isInteger(messageId) || messageId <= 0 || !chatId) {
              return [];
            }
            return [
              {
                sourceRef: this.createMessageSourceRef({
                  chatId,
                  messageId,
                }),
                content: item.text,
                from: item.name,
                score: 100,
                provenance: {
                  author: item.name,
                  source: "message",
                  src: formatMessageSourceSrc({
                    chatId,
                    messageId,
                  }),
                },
                presentation: {
                  summary: truncateAttentionTitle(item.text.trim()),
                  body: item.text,
                  bodyFormat: "text/plain",
                  changeType: "update",
                },
                contextMutation: "preserve",
              },
            ];
          });
        await this.commitAttentionDrafts(drafts);
      } else {
        outputs.push(...messageInputs.filter((item) => item.text.trim() === "/compact"));
      }
    }
    const pendingTaskDrafts = this.collectPendingTaskAttentionDrafts();
    if (pendingTaskDrafts.length > 0) {
      await this.commitAttentionDrafts(pendingTaskDrafts);
    }
    const attentionInputs = this.collectAttentionInputs();
    if (attentionInputs) {
      outputs.push(...attentionInputs);
    }
    for (const kind of Object.keys(this.inputSignalCursor) as Array<LoopInputKind>) {
      this.inputSignalCursor[kind] = this.inputSignals[kind].current();
    }
    return outputs.length > 0 ? outputs : undefined;
  }

  private markInputSignalsObserved(kinds: readonly LoopInputKind[]): void {
    for (const kind of kinds) {
      this.inputSignalCursor[kind] = this.inputSignals[kind].current();
    }
  }

  private drainInterleavedInboundQueue(): boolean {
    if (this.inboundMessageQueue.length === 0) {
      return false;
    }
    const retained = this.inboundMessageQueue.filter((item) => item.text.trim() === "/compact");
    const consumed = retained.length !== this.inboundMessageQueue.length;
    if (consumed) {
      this.inboundMessageQueue.splice(0, this.inboundMessageQueue.length, ...retained);
    }
    return consumed;
  }

  private async commitInterleavedAttentionItems(): Promise<LoopBusInput[] | undefined> {
    await this.flushPendingRuntimeSkillChanges();
    await this.collectUnreadRoomIngress();
    const consumedUserInputs = this.drainInterleavedInboundQueue();
    const pluginChanged = await this.flushPluginAttentionDrafts();
    const pendingTaskDrafts = this.collectPendingTaskAttentionDrafts();
    const taskChanged = pendingTaskDrafts.length > 0 ? await this.commitAttentionDrafts(pendingTaskDrafts) : false;
    const attentionInputs = this.collectAttentionInputs();
    await this.messageKernelAdapter.commitStagedReadAcks();

    const observedKinds: LoopInputKind[] = [];
    if (consumedUserInputs) {
      observedKinds.push("user");
    }
    if (pendingTaskDrafts.length > 0) {
      observedKinds.push("task");
    }
    if (pluginChanged || taskChanged || (attentionInputs?.length ?? 0) > 0) {
      observedKinds.push("attention");
    }
    if (observedKinds.length > 0) {
      this.markInputSignalsObserved(observedKinds);
    }
    return attentionInputs;
  }

  private collectPendingCompactCycleInputs(): LoopBusInput[] | undefined {
    const pending = this.consumePendingCompactCycle();
    if (!pending) {
      return undefined;
    }
    if (pending.trigger === "manual" && this.inboundMessageQueue.length > 0) {
      const compactMessages = this.inboundMessageQueue.filter((item) => item.text.trim() === "/compact");
      if (compactMessages.length > 0) {
        const remainingMessages = this.inboundMessageQueue.filter((item) => item.text.trim() !== "/compact");
        this.inboundMessageQueue.splice(0, this.inboundMessageQueue.length, ...remainingMessages);
        return compactMessages.map((item) => ({
          ...item,
          meta: {
            ...(item.meta ?? {}),
            cycleKind: "compact",
            compactTrigger: pending.trigger,
            exclusiveCycle: true,
          },
        }));
      }
    }
    return [this.buildCompactCycleInput(pending)];
  }

  private collectAttentionInputs(): LoopBusInput[] | undefined {
    const forceCollect = this.attentionForceCollect;
    this.attentionForceCollect = false;
    const active = this.attentionSystem.listActiveContexts();
    const visible = this.listAttentionVisibleContextMatches();
    if (active.length === 0 && !this.attentionBoundaryRefreshPending) {
      this.dirtyAttentionContextIds.clear();
      this.dirtyAttentionCommitIdsByContext.clear();
      this.dirtyAttentionContextOrder.clear();
      this.attentionContainment.clear();
      this.resetAttentionDebtBackoff();
      return undefined;
    }
    this.pruneDirtyAttentionContextIds();
    this.pruneAttentionContainment(active);

    const selected = forceCollect
      ? this.selectAttentionDebtContexts(active)
      : this.selectDirtyAttentionContexts(active);
    if (selected.length === 0 && !this.attentionBoundaryRefreshPending) {
      return undefined;
    }

    const outputs: LoopBusInput[] = [];
    const planMatches = selected.length > 0 ? selected : this.attentionBoundaryRefreshPending ? visible : [];
    const plannedContexts = new Set<string>();
    for (const match of planMatches) {
      for (const plan of this.selectAttentionProtocolPlan(match, {
        reseedForDebt: forceCollect,
      })) {
        if (!forceCollect && this.pendingAttentionMessagePlans.has(plan.messageId)) {
          continue;
        }
        this.pendingAttentionMessagePlans.set(plan.messageId, plan);
        outputs.push(this.createAttentionProtocolInput(plan));
        plannedContexts.add(plan.contextId);
      }
    }
    if (outputs.length > 0) {
      this.attentionFactsSentVersion = this.attentionFactsVersion;
    }
    for (const contextId of plannedContexts) {
      this.clearDirtyAttentionContext(contextId);
    }
    return outputs.length > 0 ? outputs : undefined;
  }

  private resolveMessageChannelForContext(contextId: string): MessageControlPlaneEntry | null {
    return (
      this.listActorRooms({
        includeArchived: true,
        touchPresence: false,
      }).find((entry) => (entry.contextId ?? this.getDefaultAttentionContextId(entry.chatId)) === contextId) ?? null
    );
  }

  private resolveMessageChatIdForContext(contextId: string): string | null {
    const channel = this.resolveMessageChannelForContext(contextId);
    if (channel) {
      return channel.chatId;
    }
    if (contextId.startsWith("ctx-chat-") || contextId.startsWith("ctx-room-")) {
      return contextId.slice(4);
    }
    return null;
  }

  private async syncCompanionRoomArchiveProjection(contextId: string, focusState: AttentionFocusState): Promise<void> {
    const channel = this.resolveMessageChannelForContext(contextId);
    if (!channel) {
      return;
    }
    if (focusState === "muted") {
      if (channel.archivedAt) {
        return;
      }
      const archived = this.messageSystem.archiveChannelAuthorized({
        chatId: channel.chatId,
        accessToken: channel.accessToken,
        archivedBy: this.getAvatarName(),
      });
      this.enqueueRoomLifecycleAttentionCommit({
        chatId: archived.chatId,
        contextId: archived.contextId ?? this.getDefaultAttentionContextId(archived.chatId),
        event: "channel_archive",
        summary: `Archived chat channel ${archived.chatId}`,
        payload: {
          cause: "attention_context_muted",
          archivedAt: archived.archivedAt ?? Date.now(),
          channel: this.projectMessageChannelForAttention(archived),
        },
      });
      return;
    }
    if (!channel.archivedAt) {
      return;
    }
    const restored = this.messageSystem.unarchiveChannelAuthorized({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
    });
    this.enqueueRoomLifecycleAttentionCommit({
      chatId: restored.chatId,
      contextId: restored.contextId ?? this.getDefaultAttentionContextId(restored.chatId),
      event: "channel_restore",
      summary: `Restored chat channel ${restored.chatId}`,
      payload: {
        cause: "attention_context_resumed",
        channel: this.projectMessageChannelForAttention(restored),
      },
    });
  }

  private collectPendingTaskAttentionDrafts(): AttentionDraft[] {
    const drafts = this.taskAttentionDraftQueue.splice(0, this.taskAttentionDraftQueue.length);
    const heartbeat = this.collectTaskHeartbeatDraft();
    if (heartbeat) {
      drafts.push(heartbeat);
    }
    return drafts;
  }

  private collectTaskHeartbeatDraft(): AttentionDraft | undefined {
    const now = Date.now();
    const active = this.taskEngine.list().filter((task) => task.status !== "done" && task.status !== "canceled");
    if (active.length === 0) {
      this.lastTaskHeartbeatDigest = "";
      return undefined;
    }

    const digest = active
      .map((task) => `${task.key}:${task.status}:${task.progress}:${task.meta.updatedAt}`)
      .sort((a, b) => a.localeCompare(b))
      .join("|");
    if (digest === this.lastTaskHeartbeatDigest && now - this.lastTaskHeartbeatAt < this.taskHeartbeatIntervalMs) {
      return undefined;
    }

    this.lastTaskHeartbeatAt = now;
    this.lastTaskHeartbeatDigest = digest;
    const byStatus = active.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      return acc;
    }, {});
    const top = active.slice(0, 5).map((task) => ({
      key: task.key,
      title: task.title,
      status: task.status,
      blockedBy: task.blockedBy.length,
      progress: task.progress,
    }));

    return {
      sourceRef: this.createTaskSourceRef("heartbeat", "task-heartbeat"),
      content: JSON.stringify({
        kind: "task-heartbeat",
        timestamp: new Date(now).toISOString(),
        activeCount: active.length,
        byStatus,
        top,
      }),
      provenance: {
        author: "task-system",
        source: "task",
        src: formatTaskSourceSrc("heartbeat"),
        createdAt: new Date(now).toISOString(),
      },
      presentation: {
        summary: `Task heartbeat: ${active.length} active`,
        body: mdFence(
          "yaml",
          toYaml({
            kind: "task-heartbeat",
            activeCount: active.length,
            byStatus,
            top,
          }),
        ),
        bodyFormat: "text/markdown",
        changeType: "update",
      },
      semanticHash: digest,
      from: "task-system",
      supersedeActive: {
        src: formatTaskSourceSrc("heartbeat"),
      },
    };
  }

  private async pollTaskSources(source: "boot" | "watch"): Promise<void> {
    if (this.taskSources.length === 0) {
      return;
    }
    for (const item of this.taskSources) {
      const files = await listMarkdownFiles(item.path);
      for (const file of files) {
        let info;
        try {
          info = await stat(file);
        } catch {
          continue;
        }
        const prev = this.taskSourceMtime.get(file);
        if (prev !== undefined && prev >= info.mtimeMs) {
          continue;
        }
        const markdown = await readFile(file, "utf8");
        this.taskSourceMtime.set(file, info.mtimeMs);
        this.emit("taskSourceChanged", { sourceName: item.name, sourcePath: item.path, file, source, markdown });
        this.enqueueTaskAttentionDraft({
          subjectId: buildStableAttentionSubjectId("source", `${item.name}:${file}`),
          reason: "task-source",
          content: JSON.stringify({
            kind: "task-source",
            sourceName: item.name,
            sourcePath: item.path,
            file,
            source,
            markdown,
          }),
          from: `task-source:${item.name}`,
          semanticHash: createHash("sha256").update(markdown).digest("hex"),
        });
        this.notifyInput("task");
      }
    }
  }

  private async pollTaskEventInbox(): Promise<void> {
    if (this.taskSources.length === 0) {
      return;
    }
    const inboxes = this.taskSources.map((entry) => ({
      sourceName: entry.name,
      root: entry.path,
      dir: join(entry.path, "events", "pending"),
    }));
    for (const inbox of inboxes) {
      let entries;
      try {
        entries = await readdir(inbox.dir);
      } catch {
        continue;
      }
      for (const name of entries) {
        if (!name.toLowerCase().endsWith(".json")) {
          continue;
        }
        const file = join(inbox.dir, name);
        const root = inbox.root;
        try {
          const payload = JSON.parse(await readFile(file, "utf8")) as { topic?: string; payload?: unknown };
          if (typeof payload.topic === "string" && payload.topic.trim().length > 0) {
            const triggered = this.taskEngine.emitEvent({
              topic: payload.topic.trim(),
              payload: payload.payload,
              source: "file",
            });
            if (triggered.affected.length > 0) {
              this.emit("taskTriggered", triggered);
              for (const task of triggered.affected) {
                this.emit("taskUpdated", { task });
              }
              this.notifyInput("task");
            }
          }
          await mkdir(join(root, "events", "done"), { recursive: true });
          await rename(file, join(root, "events", "done", name));
        } catch (error) {
          await mkdir(join(root, "events", "failed"), { recursive: true });
          await writeFile(
            join(root, "events", "failed", `${name}.error.txt`),
            error instanceof Error ? (error.stack ?? error.message) : String(error),
            "utf8",
          );
          await rename(file, join(root, "events", "failed", name));
        }
      }
    }
  }

  private async persistTask(task: TaskView): Promise<void> {
    if (this.taskSources.length === 0) {
      return;
    }
    const preferred = this.taskSources.find((item) => item.name === task.source.name) ?? this.taskSources[0];
    const root = preferred.path;
    const filePath = isAbsolute(task.source.file) ? task.source.file : join(root, task.source.file);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${serializeTaskMarkdown(task)}\n`, "utf8");
  }

  private trimChat(): void {
    if (this.chatMessages.length <= 120) {
      return;
    }
    this.chatMessages = this.chatMessages.slice(this.chatMessages.length - 120);
  }

  private cloneCycle(cycle: ChatCycle | null): ChatCycle | null {
    return cycle ? structuredClone(cycle) : null;
  }

  private emitActiveCycle(): void {
    this.emit("cycleUpdated", { cycle: this.cloneCycle(this.activeCycle) });
  }

  private createActiveCycle(input: {
    cycleId: number;
    seq: number;
    createdAt: number;
    wakeSource: string | null;
    inputs: SessionCollectedInput[];
    kind: ChatCycle["kind"];
    compactTrigger?: CompactCycleTrigger | null;
  }): void {
    this.activeCycle = {
      id: toChatCycleId({ cycleId: input.cycleId }),
      cycleId: input.cycleId,
      seq: input.seq,
      createdAt: input.createdAt,
      wakeSource: input.wakeSource,
      kind: input.kind,
      status: "collecting",
      clientMessageIds: collectClientMessageIds(input.inputs),
      inputs: structuredClone(input.inputs),
      outputs: [],
      liveMessages: [],
      streaming: null,
      modelCallId: null,
      compactTrigger: input.kind === "compact" ? (input.compactTrigger ?? null) : null,
    };
    this.emitActiveCycle();
  }

  private updateActiveCycle(input: {
    status?: ChatCycleStatus;
    streaming?: { content?: string } | null;
    upsertLiveMessage?: ChatMessage;
    clearLiveMessages?: boolean;
    appendOutput?: ChatMessage;
    modelCallId?: number | null;
  }): void {
    if (!this.activeCycle) {
      return;
    }
    if (input.status) {
      this.activeCycle.status = input.status;
    }
    if (input.streaming === null) {
      this.activeCycle.streaming = null;
    } else if (input.streaming) {
      const current = this.activeCycle.streaming ?? { content: "" };
      this.activeCycle.streaming = {
        content: input.streaming.content ?? current.content,
      };
    }
    if (input.clearLiveMessages) {
      this.activeCycle.liveMessages = [];
    }
    if (input.upsertLiveMessage) {
      const nextMessage = structuredClone({
        ...input.upsertLiveMessage,
        cycleId: input.upsertLiveMessage.cycleId ?? this.activeCycle.cycleId,
      });
      const nextMessages = [...this.activeCycle.liveMessages];
      const index = nextMessages.findIndex((message) => message.id === nextMessage.id);
      if (index >= 0) {
        nextMessages[index] = nextMessage;
      } else {
        nextMessages.push(nextMessage);
      }
      this.activeCycle.liveMessages = nextMessages;
    }
    if (input.appendOutput) {
      const nextOutput = structuredClone({
        ...input.appendOutput,
        cycleId: input.appendOutput.cycleId ?? this.activeCycle.cycleId,
      });
      this.activeCycle.outputs = [...this.activeCycle.outputs, nextOutput];
      if (nextOutput.channel !== "self_talk") {
        this.activeCycle.liveMessages = [];
        this.activeCycle.streaming = null;
      }
    }
    if (input.modelCallId !== undefined) {
      this.activeCycle.modelCallId = input.modelCallId;
    }
    this.emitActiveCycle();
  }

  private finalizeActiveCycle(status: "done" | "error"): void {
    if (!this.activeCycle) {
      return;
    }
    this.messageKernelAdapter.finalizeCycle();
    this.setProjectionStage(status === "error" ? "error" : "idle");
    if (status === "error" && this.activeCycle.liveMessages.length > 0) {
      const cancelledAt = Date.now();
      const liveMessages = [...this.activeCycle.liveMessages];
      for (const message of liveMessages) {
        if (message.channel !== "tool" || !message.tool) {
          continue;
        }
        if (message.tool.status !== "running" && message.tool.status !== "waiting") {
          continue;
        }
        this.recordChatMessage(
          {
            ...message,
            id: `${message.id}:cancelled`,
            timestamp: cancelledAt,
            tool: {
              ...message.tool,
              status: "cancelled",
              finishedAt: cancelledAt,
              error: message.tool.error ?? "cancelled by session stop",
            },
            content: buildToolInvocationMarkdown({
              invocationId: message.tool.invocationId,
              name: message.tool.name,
              status: "cancelled",
              startedAt: message.tool.startedAt,
              finishedAt: cancelledAt,
              call: message.tool.call?.value,
              result: message.tool.result?.value,
              error: message.tool.error ?? "cancelled by session stop",
            }),
          },
          this.activeCycle.cycleId,
          "tool",
        );
      }
    }
    if (this.activeCycle.cycleId !== null) {
      this.cycleReplyChatIds.delete(this.activeCycle.cycleId);
      this.deliveredRuntimeDispatchChatIds.delete(this.activeCycle.cycleId);
    }
    this.activeCycle.status = status;
    this.activeCycle.liveMessages = [];
    this.activeCycle.streaming = null;
    this.emitActiveCycle();
    this.activeCycle = null;
    this.emitActiveCycle();
  }

  private recordChatMessage(
    message: ChatMessage,
    cycleId: number | null = this.activeCycleId,
    channelOverride?: SessionDbTerminalActivityRecord["channel"],
    aiCallIdOverride?: number | null,
    persistInputOverride?: SessionMessageUpsertInput,
  ): void {
    const nextMessage: ChatMessage = {
      ...message,
      cycleId: message.cycleId ?? cycleId,
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
      tool: message.tool
        ? {
            ...message.tool,
            call: message.tool.call ? { ...message.tool.call } : undefined,
            result: message.tool.result ? { ...message.tool.result } : undefined,
          }
        : undefined,
    };
    const existingIndex = this.chatMessages.findIndex((candidate) => candidate.id === nextMessage.id);
    if (existingIndex === -1) {
      this.chatMessages.push(nextMessage);
    } else {
      this.chatMessages.splice(existingIndex, 1, nextMessage);
    }
    this.trimChat();
    this.emit("chat", nextMessage);
    if (!this.sessionDb) {
      return;
    }
    const persistedCycleId = nextMessage.cycleId ?? cycleId;
    const channel = channelOverride ?? nextMessage.channel ?? (nextMessage.role === "user" ? "user_input" : "to_user");
    this.upsertHeartbeatPartMessage(
      persistInputOverride ??
        toHeartbeatEventMessageUpsertInput({
          message: {
            ...nextMessage,
            channel: channel === "user_input" ? undefined : channel,
          },
          roundIndex: this.sessionDb.getHead().currentRoundIndex,
          aiCallId: aiCallIdOverride ?? null,
        }),
    );
    this.appendTerminalActivityForMessage(nextMessage, persistedCycleId, channel);
    if (
      this.activeCycle &&
      persistedCycleId !== null &&
      this.activeCycle.cycleId === persistedCycleId &&
      nextMessage.role === "assistant"
    ) {
      this.updateActiveCycle({
        appendOutput: nextMessage,
      });
    }
  }

  private recordHeartbeatCompactBoundary(modelCall: SessionAiCallRecord): void {
    if (!this.sessionDb || this.activeCycle?.kind !== "compact" || modelCall.status !== "done") {
      return;
    }
    const completedAt = modelCall.completedAt ?? modelCall.updatedAt ?? Date.now();
    const currentRoundIndex = this.sessionDb.getHead().currentRoundIndex;
    const compactTrigger = this.activeCycle.compactTrigger ?? null;
    this.recordChatMessage(
      {
        id: `heartbeat-part:ai-call:${modelCall.id}:compact`,
        role: "system",
        content:
          compactTrigger === null
            ? "Prompt window compacted. Later Heartbeat rows continue from the rebuilt context."
            : `Prompt window compacted (${compactTrigger}). Later Heartbeat rows continue from the rebuilt context.`,
        timestamp: completedAt,
        updatedAt: completedAt,
        format: "plain",
        heartbeatKind: "compact_separator",
        compactTrigger: compactTrigger ?? null,
      },
      this.activeCycleId,
      "self_talk",
      modelCall.id,
      toHeartbeatPartCompactSeparatorUpsertInput({
        aiCallId: modelCall.id,
        timestamp: completedAt,
        callRoundIndex: modelCall.roundIndex,
        currentRoundIndex,
        compactTrigger: compactTrigger ?? null,
      }),
    );
    if (this.listAttentionVisibleContextMatches().length > 0) {
      this.requestAttentionContextBoundaryRefresh();
    }
  }

  private appendTerminalActivity(input: {
    terminalId: string;
    createdAt?: number;
    kind: SessionDbTerminalActivityRecord["kind"];
    cycleId?: number | null;
    role?: SessionDbTerminalActivityRecord["role"];
    channel?: SessionDbTerminalActivityRecord["channel"];
    title: string;
    content: string;
    tool?: SessionDbTerminalActivityRecord["tool"];
    detail?: unknown;
  }): SessionDbTerminalActivityRecord | null {
    const entry: SessionDbTerminalActivityRecord = {
      id: ++this.terminalActivitySeq,
      terminalId: input.terminalId,
      createdAt: input.createdAt ?? Date.now(),
      kind: input.kind,
      cycleId: input.cycleId ?? null,
      role: input.role,
      channel: input.channel,
      title: input.title,
      content: input.content,
      tool: input.tool,
      detail: input.detail,
    };
    const current = this.terminalActivityByTerminalId.get(input.terminalId) ?? [];
    current.push(entry);
    this.terminalActivityByTerminalId.set(input.terminalId, current);
    return entry;
  }

  private appendTerminalActivityForMessage(
    message: ChatMessage,
    cycleId: number | null,
    channel: RuntimeTerminalActivityRecord["channel"],
  ): void {
    if (message.heartbeatKind === "compact_separator") {
      return;
    }
    const matches = extractKnownTerminalIds(message.content, this.terminals.keys());
    if (matches.length === 0) {
      return;
    }
    for (const terminalId of matches) {
      this.appendTerminalActivity({
        terminalId,
        createdAt: message.timestamp,
        kind: "message",
        cycleId,
        role: message.role,
        channel,
        title:
          channel === "tool"
            ? `Tool · ${message.tool?.name ?? "tool"}`
            : channel === "self_talk"
              ? "Assistant internal note"
              : "Assistant message",
        content: message.content,
        tool: message.tool,
        detail: {
          messageId: message.id,
        },
      });
    }
  }

  private toCollectedInputParts(input: LoopBusInput): SessionCollectedInputPart[] {
    const parts: SessionCollectedInputPart[] = [{ type: "text", text: input.text }];
    for (const attachment of input.attachments ?? []) {
      parts.push({
        type: attachment.kind,
        assetId: attachment.assetId,
        kind: attachment.kind,
        mimeType: attachment.mimeType,
        name: attachment.name,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
      });
    }
    return parts;
  }

  private async persistCycle(input: {
    wakeSource: LoopBusWakeSource;
    inputs: LoopBusInput[];
  }): Promise<{ cycleId: number }> {
    if (!this.sessionDb) {
      throw new Error("session db not initialized");
    }

    const previousHead = this.cycleRecords.at(-1)?.id ?? null;
    const collectedInputs: SessionCollectedInput[] = input.inputs.map((item) => ({
      source:
        item.source === "chat"
          ? "message"
          : item.source === "attention"
            ? "attention"
            : item.source === "tool"
              ? "message"
              : item.source,
      sourceId: typeof item.meta?.terminalId === "string" ? item.meta.terminalId : undefined,
      role: item.role,
      name: item.name,
      parts: this.toCollectedInputParts(item),
      meta: item.meta,
    }));

    const terminals = Object.fromEntries(
      [...this.terminals.entries()].map(([terminalId, terminal]) => [
        terminalId,
        {
          headHash: terminal.getHeadHash(),
          running: terminal.isRunning(),
          status: terminal.getStatus(),
          snapshot: terminal.getSnapshot(),
        },
      ]),
    );
    const cycleKind = detectChatCycleKind(collectedInputs);
    const compactTrigger = cycleKind === "compact" ? this.readCompactCycleTriggerFromInputs(input.inputs) : null;
    const activeContextIds = this.collectActiveAttentionContextIds();
    const inputContextIds = [
      ...new Set(
        collectedInputs
          .filter((item) => item.source === "attention")
          .flatMap((item) => {
            const contextIds = parseAttentionContextIds(item.meta?.attentionContextIds);
            if (contextIds.length > 0) {
              return contextIds;
            }
            return typeof item.meta?.attentionContextId === "string" ? [item.meta.attentionContextId] : [];
          }),
      ),
    ];
    const inputCommitRefs = dedupeAttentionCommitRefs(
      collectedInputs.flatMap((item) => {
        if (item.source !== "attention") {
          return [];
        }
        const refs = parseAttentionCommitRefs(item.meta?.attentionCommitRefs);
        if (refs.length > 0) {
          return refs;
        }
        const contextId = typeof item.meta?.attentionContextId === "string" ? item.meta.attentionContextId : null;
        return contextId
          ? parseAttentionCommitIds(item.meta?.attentionCommitIds).map((commitId) => ({
              contextId,
              commitId,
            }))
          : [];
      }),
    );
    const protocolMode: AttentionProtocolMode =
      cycleKind === "compact"
        ? "compact"
        : collectedInputs.some(
              (item) => parseAttentionInputProtocolKind(item.meta?.attentionProtocolKind) === "context",
            )
          ? "bootstrap"
          : collectedInputs.some(
                (item) => parseAttentionInputProtocolKind(item.meta?.attentionProtocolKind) === "items",
              )
            ? "delta"
            : "none";

    const cycle: SessionCycleRecord = {
      id: previousHead === null ? 1 : previousHead + 1,
      seq: ++this.cycleSeq,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      prevCycleId: previousHead,
      wake: { source: input.wakeSource },
      collectedInputs,
      extendsRecord: {
        attention: this.attentionSystem.snapshot(),
        attentionCycleFrame: {
          cycleId: -1,
          seq: -1,
          createdAt: 0,
          wakeSource: input.wakeSource,
          protocolMode,
          inputContextIds,
          inputCommitRefs,
          activeContextIds,
          producedCommitRefs: [],
          modelCallIds: [],
          hookIds: [],
        } satisfies AttentionCycleFrame,
        attentionHooks: [],
        task: { items: this.taskEngine.list() },
        terminal: { focusedTerminalIds: [...this.focusedTerminalIds], terminals },
        message: { channels: this.messageSystem.listChannels() },
      },
      result: {
        kind: cycleKind,
        ...(cycleKind === "compact" && compactTrigger ? { compactTrigger } : {}),
      },
    };
    this.cycleRecords.push(cycle);
    const attentionCycleFrame: AttentionCycleFrame = {
      cycleId: cycle.id,
      seq: cycle.seq,
      createdAt: cycle.createdAt,
      wakeSource: input.wakeSource,
      protocolMode,
      inputContextIds,
      inputCommitRefs,
      activeContextIds,
      producedCommitRefs: [],
      modelCallIds: [],
      hookIds: [],
    };
    this.attentionCycleFrames.set(cycle.id, attentionCycleFrame);
    this.messageKernelAdapter.beginCycle();
    this.flushPendingTraceSpans(cycle.id);
    this.persistAttentionCycleState(cycle.id);
    this.emitAttentionState();
    const replyChatId = this.resolveCycleReplyChatId(input.inputs);
    if (replyChatId) {
      this.cycleReplyChatIds.set(cycle.id, replyChatId);
    }
    for (const collectedInput of collectedInputs) {
      if (collectedInput.source !== "terminal" || !collectedInput.sourceId) {
        continue;
      }
      const content = collectedInput.parts
        .filter((part): part is Extract<SessionCollectedInputPart, { type: "text" }> => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      this.appendTerminalActivity({
        terminalId: collectedInput.sourceId,
        createdAt: cycle.createdAt,
        kind: "cycle_input",
        cycleId: cycle.id,
        title: collectedInput.name,
        content,
        detail: {
          meta: collectedInput.meta ?? {},
          parts: collectedInput.parts,
        },
      });
    }
    this.activeCycleId = cycle.id;
    this.activeModelCallId = null;
    this.activeAgentCallId = null;
    this.createActiveCycle({
      cycleId: cycle.id,
      seq: cycle.seq,
      createdAt: cycle.createdAt,
      wakeSource: input.wakeSource,
      inputs: collectedInputs,
      kind: cycleKind,
      compactTrigger,
    });
    return { cycleId: cycle.id };
  }

  private resolveCycleReplyChatId(inputs: LoopBusInput[]): string | null {
    let best: { chatId: string; createdAtMs: number; index: number } | null = null;
    for (let index = inputs.length - 1; index >= 0; index -= 1) {
      const item = inputs[index];
      const chatId = typeof item?.meta?.chatId === "string" ? item.meta.chatId : undefined;
      if (chatId) {
        const createdAtMs =
          typeof item.meta?.createdAt === "string" ? Date.parse(item.meta.createdAt) : Number.NEGATIVE_INFINITY;
        if (
          best === null ||
          createdAtMs > best.createdAtMs ||
          (createdAtMs === best.createdAtMs && index > best.index)
        ) {
          best = { chatId, createdAtMs, index };
        }
      }
    }
    return best?.chatId ?? null;
  }

  private updateLoopKernelSnapshot(input: {
    phase: LoopBusPhase;
    currentCycleId: number | null;
    lastWakeSource: string | null;
    lastError?: string | null;
    cycle?: number;
    paused?: boolean;
  }): void {
    const previous = this.loopKernelSnapshot?.state ?? createInitialLoopKernelState(Date.now(), input.phase);
    const paused = input.paused ?? previous.paused;
    const attentionDebt = this.buildAttentionDebtState();
    const attentionContainment = this.summarizeAttentionContainment(this.attentionSystem.listActiveContexts());
    const waitingReason = this.resolveLoopWaitingReason(input.phase, paused);
    const nextAutoWakeAt =
      waitingReason === "attention_debt"
        ? (this.attentionDebtNextWakeAt ?? Date.now() + this.attentionDebtBackoffMs)
        : waitingReason === "attention_backoff"
          ? attentionContainment.nextWakeAt
          : null;
    const runtimeStatus: LoopBusKernelState["runtimeStatus"] = !this.started
      ? "idle"
      : this.isLoopStopped()
        ? "paused"
        : waitingReason === "attention_blocked"
          ? "blocked"
          : waitingReason === "attention_backoff"
            ? "backoff"
            : paused
              ? "paused"
              : input.phase !== "waiting_commits"
                ? "running"
                : waitingReason === "attention_debt"
                  ? "waiting"
                  : waitingReason === "ready_now"
                    ? "running"
                    : "idle";
    const next: LoopBusKernelState = {
      ...previous,
      phase: input.phase,
      running: this.started,
      paused,
      runtimeStatus,
      gate: input.phase === "waiting_commits" ? "waiting_input" : "open",
      queueSize: 0,
      cycle: input.cycle ?? previous.cycle,
      sentBatches: previous.sentBatches,
      updatedAt: Date.now(),
      stateVersion: previous.stateVersion + 1,
      lastWakeAt: input.lastWakeSource ? Date.now() : previous.lastWakeAt,
      lastWakeSource: input.lastWakeSource,
      lastWakeCause: input.lastWakeSource ? this.loopKernelLastWakeCause : previous.lastWakeCause,
      activeContextCount: attentionDebt.activeContextCount,
      activeItemCount: attentionDebt.activeItemCount,
      unresolvedScoreCount: attentionDebt.unresolvedScoreCount,
      waitingReason,
      nextAutoWakeAt,
      backoffMs:
        waitingReason === "attention_debt"
          ? this.attentionDebtBackoffMs
          : waitingReason === "attention_backoff" && nextAutoWakeAt !== null
            ? Math.max(0, nextAutoWakeAt - Date.now())
            : null,
      retryCount: attentionContainment.retryCount,
      blockedReason: attentionContainment.blockedReason,
      lastProgressAt: this.lastAttentionProgressAt,
      lastError: input.lastError === undefined ? previous.lastError : input.lastError,
      lastResponseAt: previous.lastResponseAt,
      lastMessageAt: previous.lastMessageAt,
    };
    const previousHash = this.loopKernelSnapshot?.stateHash ?? null;
    const nextHash = hashLoopState(next);
    const patch = createLoopStatePatch(previous, next);
    this.loopKernelSnapshot = {
      timestamp: next.updatedAt,
      stateHash: nextHash,
      state: next,
    };
    const entry: SessionDbLoopbusStateLogRecord = {
      id: ++this.loopStateLogSeq,
      timestamp: next.updatedAt,
      stateVersion: next.stateVersion,
      event: input.phase,
      prevHash: previousHash,
      stateHash: nextHash,
      patch,
    };
    this.loopStateLogEntries.push(entry);
    this.emit("schedulerLog", { entry });
    this.emit("schedulerSnapshot", { snapshot: this.loopKernelSnapshot });
    if (input.lastWakeSource) {
      this.loopKernelLastWakeCause = null;
    }
  }

  private resolveCurrentModelCallId(): number | null {
    return this.activeModelCallId ?? this.activeCycle?.modelCallId ?? null;
  }

  private emitModelCallDelta(input: {
    timestamp: number;
    kind: ModelCallDeltaKind;
    data: unknown;
    modelCallId?: number | null;
  }): void {
    if (this.activeCycleId === null) {
      return;
    }
    const modelCallId = input.modelCallId ?? this.resolveCurrentModelCallId();
    if (modelCallId === null) {
      return;
    }
    this.modelCallDeltaSeq += 1;
    const entry: SessionModelCallDeltaRecord = {
      id: this.modelCallDeltaSeq,
      seq: this.modelCallDeltaSeq,
      modelCallId,
      cycleId: this.activeCycleId,
      timestamp: input.timestamp,
      kind: input.kind,
      data: input.data,
    };
    this.emit("modelCallDelta", { entry });
  }

  private getActiveCycleInputCommitRefs(cycleId: number | null): DeliveryCommitRefRecord[] {
    if (cycleId === null) {
      return [];
    }
    const frame = this.attentionCycleFrames.get(cycleId);
    if (!frame) {
      return [];
    }
    return frame.inputCommitRefs.map((ref) => ({
      contextId: ref.contextId,
      commitId: ref.commitId,
      createdAt: frame.createdAt,
    }));
  }

  private async beginAttentionDeliveryAttempt(input: {
    agentCallId: string;
    attemptIndex: number;
    cycleId: number | null;
    timestamp: number;
    sessionModelCallId: number | null;
  }): Promise<string[]> {
    const commitRefs = this.getActiveCycleInputCommitRefs(input.cycleId);
    if (commitRefs.length === 0 || input.cycleId === null) {
      return [];
    }
    const dispatchIds: string[] = [];
    for (const commitRef of commitRefs) {
      const result = await this.runtimeKernelHost.createDispatch({
        contextId: commitRef.contextId,
        commitId: commitRef.commitId,
        cycleId: input.cycleId,
        agentCallId: input.agentCallId,
        sessionModelCallId: input.sessionModelCallId,
        createdAt: input.timestamp,
      });
      dispatchIds.push(result.dispatch.dispatchId);
    }
    const attempts = this.deliveryDispatchIdsByAgentCallAttempt.get(input.agentCallId) ?? new Map<number, string[]>();
    attempts.set(input.attemptIndex, dispatchIds);
    this.deliveryDispatchIdsByAgentCallAttempt.set(input.agentCallId, attempts);
    return dispatchIds;
  }

  private listAttentionDispatchIdsForAttempt(agentCallId: string, attemptIndex: number): string[] {
    return this.deliveryDispatchIdsByAgentCallAttempt.get(agentCallId)?.get(attemptIndex) ?? [];
  }

  private bindAttentionDispatchesForAttempt(input: {
    agentCallId: string;
    attemptIndex: number;
    sessionModelCallId: number;
  }): void {
    const dispatchIds = this.listAttentionDispatchIdsForAttempt(input.agentCallId, input.attemptIndex);
    for (const dispatchId of dispatchIds) {
      this.runtimeKernelHost.bindDispatchModelCall({
        dispatchId,
        sessionModelCallId: input.sessionModelCallId,
      });
    }
  }

  private async appendAttentionReceiptForAttempt(input: {
    agentCallId: string;
    attemptIndex: number;
    status: AttentionReceiptRecord["status"];
    providerEventKind: AttentionReceiptProviderEventKind;
    timestamp: number;
    finishReason?: string | null;
    usage?: AttentionReceiptRecord["usage"];
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    const dispatchIds = this.listAttentionDispatchIdsForAttempt(input.agentCallId, input.attemptIndex);
    for (const dispatchId of dispatchIds) {
      await this.runtimeKernelHost.appendReceipt({
        dispatchId,
        status: input.status,
        providerEventKind: input.providerEventKind,
        timestamp: input.timestamp,
        finishReason: input.finishReason,
        usage: input.usage,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      });
    }
  }

  private async handleAssistantDeliveryEvent(event: AssistantDeliveryEvent): Promise<void> {
    const agentCallId = this.activeAgentCallId;
    if (!agentCallId) {
      return;
    }
    if (event.kind === "attempt_started") {
      if (this.listAttentionDispatchIdsForAttempt(agentCallId, event.attemptIndex).length > 0) {
        return;
      }
      await this.beginAttentionDeliveryAttempt({
        agentCallId,
        attemptIndex: event.attemptIndex,
        cycleId: this.activeCycleId,
        timestamp: event.timestamp,
        sessionModelCallId: this.activeModelCallId,
      });
      return;
    }
    if (event.status === "accepted" && this.activeModelCallId !== null && this.sessionDb) {
      const requestBody = this.sessionDb.getAiCallById(this.activeModelCallId)?.requestBody as
        | {
            messages?: AgentModelCallRecord["request"]["messages"];
            meta?: { collectedInputs?: SessionCollectedInput[] };
          }
        | undefined;
      const requestMessages = requestBody?.messages;
      const collectedInputs = Array.isArray(requestBody?.meta?.collectedInputs) ? requestBody.meta.collectedInputs : [];
      if (Array.isArray(requestMessages) || collectedInputs.length > 0) {
        this.commitInjectedAttentionPlans({
          requestMessages: Array.isArray(requestMessages) ? requestMessages : undefined,
          collectedInputs,
        });
      }
    }
    await this.appendAttentionReceiptForAttempt({
      agentCallId,
      attemptIndex: event.attemptIndex,
      status: event.status,
      providerEventKind: event.providerEventKind,
      timestamp: event.timestamp,
      finishReason: event.finishReason,
      usage: event.usage,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
    });
  }

  private buildPersistedModelConfigPayload(
    config: ResolvedSessionConfig | null = this.config,
  ): Record<string, unknown> | null {
    if (!config) {
      return null;
    }
    return {
      providerId: config.ai.providerId,
      apiStandard: config.ai.apiStandard,
      vendor: config.ai.vendor ?? null,
      profile: config.ai.profile ?? null,
      extensions: config.ai.extensions ?? [],
      model: config.ai.model,
      baseUrl: config.ai.baseUrl ?? null,
      headers: config.ai.headers ?? {},
      temperature: config.ai.temperature,
      topK: config.ai.topK ?? null,
      transportMaxRetries: config.ai.transportMaxRetries,
      maxToken: config.ai.maxToken ?? null,
      maxContextTokens: config.ai.maxContextTokens ?? null,
      providerSnapshot: buildProviderSnapshot(config),
      thinking:
        config.ai.thinking === undefined
          ? null
          : {
              enabled: config.ai.thinking.enabled ?? false,
              budgetTokens: config.ai.thinking.budgetTokens ?? null,
            },
      retryPolicy: config.loop.retryPolicy,
      compactPolicy: config.loop.compactPolicy,
      lang: config.lang,
    };
  }

  private buildUsageAnalyticsFactInput(linkedModelCall: SessionAiCallRecord): UsageAnalyticsFactInput | null {
    if (linkedModelCall.status === "running" || !this.options.avatarPrincipalId) {
      return null;
    }
    const responseEnvelope =
      linkedModelCall.responseBody &&
      typeof linkedModelCall.responseBody === "object" &&
      !Array.isArray(linkedModelCall.responseBody)
        ? linkedModelCall.responseBody
        : null;
    const response =
      responseEnvelope && "response" in responseEnvelope
        ? (responseEnvelope as { response?: unknown }).response
        : linkedModelCall.responseBody;
    const responseRecord = response && typeof response === "object" && !Array.isArray(response) ? response : null;
    const usage = normalizeTokenUsage(
      responseRecord && "usage" in responseRecord ? (responseRecord as { usage?: unknown }).usage : undefined,
    );
    if (!usage) {
      return null;
    }
    const providerSnapshot =
      readProviderSnapshotFromRequestBody(linkedModelCall.requestBody) ?? buildProviderSnapshot(this.config);
    if (!providerSnapshot) {
      return null;
    }
    const requestRecord =
      linkedModelCall.requestBody &&
      typeof linkedModelCall.requestBody === "object" &&
      !Array.isArray(linkedModelCall.requestBody)
        ? linkedModelCall.requestBody
        : null;
    const requestMeta = requestRecord && "meta" in requestRecord ? (requestRecord as { meta?: unknown }).meta : null;
    const cycleId =
      requestMeta && typeof requestMeta === "object" && !Array.isArray(requestMeta) && "cycleId" in requestMeta
        ? (() => {
            const candidate = (requestMeta as { cycleId?: unknown }).cycleId;
            return typeof candidate === "number" && Number.isInteger(candidate) ? candidate : null;
          })()
        : null;
    return {
      principalId: this.options.avatarPrincipalId,
      sessionId: this.options.sessionId,
      aiCallId: linkedModelCall.id,
      cycleId,
      roundIndex: linkedModelCall.roundIndex,
      kind: linkedModelCall.kind,
      status: linkedModelCall.status,
      providerId: providerSnapshot.providerId,
      apiStandard: providerSnapshot.apiStandard,
      vendor: providerSnapshot.vendor,
      profile: providerSnapshot.profile,
      model: providerSnapshot.model,
      createdAt: linkedModelCall.createdAt,
      completedAt: linkedModelCall.completedAt ?? linkedModelCall.updatedAt,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      cachedInputTokens: usage.cachedInputTokens,
      reasoningTokens: usage.reasoningTokens,
      uncachedInputTokens: usage.uncachedInputTokens,
      maxContextTokens: providerSnapshot.maxContextTokens,
    };
  }

  private persistUsageAnalyticsFact(linkedModelCall: SessionAiCallRecord): void {
    const fact = this.buildUsageAnalyticsFactInput(linkedModelCall);
    if (!fact) {
      return;
    }
    this.usageAnalyticsDb?.upsertFact(fact);
  }

  private createPromptStore(config: ResolvedSessionConfig): FilePromptStore {
    const resourceLoader = new ResourceLoader({
      context: {
        projectRoot: config.agentCwd,
        cwd: config.agentCwd,
      },
    });
    return new FilePromptStore({
      lang: config.lang,
      rootDir: config.prompt.rootDir,
      publicRootDir: config.prompt.publicRootDir,
      privateRootDir: config.prompt.privateRootDir,
      globalRootDir: config.prompt.globalRootDir,
      promptLayers: config.prompt.promptLayers,
      agenterPath: config.prompt.agenterPath,
      avatarNickname: config.avatar.nickname,
      loader: resourceLoader,
    });
  }

  private createModelClient(config: ResolvedSessionConfig): ModelClient {
    return new ModelClient({
      providerId: config.ai.providerId,
      apiStandard: config.ai.apiStandard,
      vendor: config.ai.vendor,
      profile: config.ai.profile,
      extensions: config.ai.extensions,
      lang: config.lang,
      apiKey: config.ai.apiKey,
      apiKeyEnv: config.ai.apiKeyEnv,
      model: config.ai.model,
      baseUrl: config.ai.baseUrl,
      headers: config.ai.headers,
      temperature: config.ai.temperature,
      topK: config.ai.topK,
      maxRetries: config.ai.transportMaxRetries,
      maxToken: config.ai.maxToken,
      maxContextTokens: config.ai.maxContextTokens,
      thinking: config.ai.thinking,
    });
  }

  private normalizePersistedModelRequest(
    request: Partial<AgentModelCallRecord["request"]> | undefined,
  ): AgentModelCallRecord["request"] {
    if (!this.sessionDb) {
      return {
        systemPrompt: typeof request?.systemPrompt === "string" ? request.systemPrompt : "",
        promptWindowStateId: typeof request?.promptWindowStateId === "string" ? request.promptWindowStateId : "",
        roundIndex: typeof request?.roundIndex === "number" ? request.roundIndex : 0,
        messages: structuredClone(request?.messages ?? []),
        tools: structuredClone(request?.tools ?? []),
        meta: request?.meta ? structuredClone(request.meta) : undefined,
      };
    }
    const currentPromptWindow =
      this.sessionDb.getCurrentPromptWindow() ??
      this.sessionDb.savePromptWindow({
        createdAt: Date.now(),
        messages: [],
        setCurrent: true,
      });
    return {
      systemPrompt: typeof request?.systemPrompt === "string" ? request.systemPrompt : "",
      promptWindowStateId:
        typeof request?.promptWindowStateId === "string" && request.promptWindowStateId.length > 0
          ? request.promptWindowStateId
          : currentPromptWindow.promptWindowId,
      roundIndex:
        typeof request?.roundIndex === "number" && Number.isFinite(request.roundIndex)
          ? request.roundIndex
          : currentPromptWindow.roundIndex,
      messages:
        request?.messages !== undefined
          ? structuredClone(request.messages)
          : clonePromptWindowMessages(currentPromptWindow.messages),
      tools: Array.isArray(request?.tools) ? structuredClone(request.tools) : [],
      meta: request?.meta ? structuredClone(request.meta) : undefined,
    };
  }

  private persistRequestAuxiliaryMessages(input: {
    timestamp: number;
    request: AgentModelCallRecord["request"];
  }): string[] {
    const sessionDb = this.sessionDb;
    if (!sessionDb) {
      return [];
    }
    const entries = [
      {
        partType: "systemPrompt",
        role: "system" as const,
        payload: input.request.systemPrompt,
      },
      {
        partType: "tools",
        role: "system" as const,
        payload: structuredClone(input.request.tools),
      },
      {
        partType: "config",
        role: "config" as const,
        payload: this.buildPersistedModelConfigPayload(),
      },
    ];

    return entries
      .map((entry) => {
        const latest = sessionDb.getLatestAuxiliaryMessage(entry.partType);
        const latestPayload = latest?.parts[0]?.payload ?? null;
        if (JSON.stringify(latestPayload) === JSON.stringify(entry.payload ?? null)) {
          return latest?.messageId ?? "";
        }
        const record = sessionDb.upsertMessage({
          messageId: `request_aux:${entry.partType}:${input.timestamp}:${createId()}`,
          roundIndex: input.request.roundIndex,
          scope: "request_aux",
          role: entry.role,
          createdAt: input.timestamp,
          updatedAt: input.timestamp,
          parts: [
            {
              partType: entry.partType,
              payload: structuredClone(entry.payload),
              isComplete: true,
            },
          ],
        });
        this.emitHeartbeatPart(record);
        return record.messageId;
      })
      .filter((messageId) => messageId.length > 0);
  }

  private persistLooseConfigAuxiliaryMessage(
    timestamp: number,
    payload: Record<string, unknown> | null,
  ): string | null {
    const sessionDb = this.sessionDb;
    if (!sessionDb) {
      return null;
    }
    const latest = sessionDb.getLatestAuxiliaryMessage("config");
    const latestPayload = latest?.parts[0]?.payload ?? null;
    if (JSON.stringify(latestPayload) === JSON.stringify(payload ?? null)) {
      return latest?.messageId ?? null;
    }
    const record = sessionDb.upsertMessage({
      messageId: `request_aux:config:${timestamp}:${createId()}`,
      roundIndex: sessionDb.getHead().currentRoundIndex,
      scope: "request_aux",
      role: "config",
      createdAt: timestamp,
      updatedAt: timestamp,
      parts: [
        {
          partType: "config",
          payload: structuredClone(payload),
          isComplete: true,
        },
      ],
    });
    this.emitHeartbeatPart(record);
    return record.messageId;
  }

  private emitHeartbeatPart(entry: SessionMessageRecord): void {
    this.emit("heartbeatPart", { entry });
  }

  private upsertHeartbeatPartMessage(input: SessionMessageUpsertInput): SessionMessageRecord | null {
    if (!this.sessionDb) {
      return null;
    }
    const record = this.sessionDb.upsertMessage(input);
    this.emitHeartbeatPart(record);
    return record;
  }

  private persistHeartbeatRequestMessages(input: {
    aiCallId: number;
    timestamp: number;
    request: AgentModelCallRecord["request"];
  }): string[] {
    const entries = toHeartbeatRequestMessageUpsertInputs({
      aiCallId: input.aiCallId,
      roundIndex: input.request.roundIndex,
      createdAt: input.timestamp,
      messages: input.request.messages,
    });
    for (const entry of entries) {
      this.upsertHeartbeatPartMessage(entry);
    }
    return entries.map((entry) => entry.messageId);
  }

  private createEmptyActiveModelResponseDraft(): NonNullable<SessionRuntime["activeModelResponseDraft"]> {
    return {
      assistantSegments: [],
      toolTrace: [],
    };
  }

  private ensureActiveModelResponseDraft(): NonNullable<SessionRuntime["activeModelResponseDraft"]> {
    this.activeModelResponseDraft ??= this.createEmptyActiveModelResponseDraft();
    return this.activeModelResponseDraft;
  }

  private readPersistedAssistantResponseSegments(
    response: AgentModelCallRecord["response"] | undefined,
  ): HeartbeatAssistantResponseSegment[] {
    const candidate =
      response && typeof response === "object" && "assistantSegments" in response
        ? response.assistantSegments
        : undefined;
    if (!Array.isArray(candidate)) {
      return [];
    }
    return candidate.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const partType = "partType" in entry ? entry.partType : undefined;
      const content = "content" in entry ? entry.content : undefined;
      const startedAt = "startedAt" in entry ? entry.startedAt : undefined;
      const updatedAt = "updatedAt" in entry ? entry.updatedAt : undefined;
      const isComplete = "isComplete" in entry ? entry.isComplete : undefined;
      if (
        (partType !== "thinking" && partType !== "text") ||
        typeof content !== "string" ||
        typeof startedAt !== "number" ||
        typeof updatedAt !== "number"
      ) {
        return [];
      }
      return [
        {
          partType,
          content,
          startedAt,
          updatedAt,
          isComplete: typeof isComplete === "boolean" ? isComplete : true,
        } satisfies HeartbeatAssistantResponseSegment,
      ];
    });
  }

  private resolveAssistantSegmentDelta(input: {
    partType: HeartbeatAssistantResponseSegment["partType"];
    content: string;
    delta?: string;
  }): string {
    if (typeof input.delta === "string") {
      return input.delta;
    }
    const activeSegment = this.activeModelResponseDraft?.assistantSegments.at(-1);
    if (!activeSegment || activeSegment.partType !== input.partType || activeSegment.isComplete) {
      return input.content;
    }
    if (input.content.startsWith(activeSegment.content)) {
      return input.content.slice(activeSegment.content.length);
    }
    return input.content;
  }

  private closeActiveAssistantResponseSegment(timestamp: number): void {
    const activeSegment = this.activeModelResponseDraft?.assistantSegments.at(-1);
    if (!activeSegment || activeSegment.isComplete) {
      return;
    }
    activeSegment.updatedAt = Math.max(activeSegment.updatedAt, timestamp);
    activeSegment.isComplete = true;
  }

  private appendAssistantResponseSegment(input: {
    partType: HeartbeatAssistantResponseSegment["partType"];
    content: string;
    delta?: string;
    timestamp: number;
  }): void {
    const draft = this.ensureActiveModelResponseDraft();
    const activeSegment = draft.assistantSegments.at(-1);
    if (activeSegment && activeSegment.partType !== input.partType && !activeSegment.isComplete) {
      this.closeActiveAssistantResponseSegment(input.timestamp);
    }
    const delta = this.resolveAssistantSegmentDelta(input);
    const currentSegment = draft.assistantSegments.at(-1);
    if (currentSegment && currentSegment.partType === input.partType && !currentSegment.isComplete) {
      currentSegment.content = delta.length > 0 ? currentSegment.content + delta : input.content;
      currentSegment.updatedAt = Math.max(currentSegment.updatedAt, input.timestamp);
      return;
    }
    const nextContent = delta.length > 0 ? delta : input.content;
    if (nextContent.length === 0) {
      return;
    }
    draft.assistantSegments.push({
      partType: input.partType,
      content: nextContent,
      startedAt: input.timestamp,
      updatedAt: input.timestamp,
      isComplete: false,
    });
  }

  private collectAssistantSummaryFromDraft():
    | {
        thinking?: string;
        text?: string;
        finishReason?: string | null;
      }
    | undefined {
    if (!this.activeModelResponseDraft) {
      return undefined;
    }
    const persisted = this.activeModelResponseDraft.assistant;
    const segments = this.activeModelResponseDraft.assistantSegments;
    if (segments.length === 0) {
      if (!persisted) {
        return undefined;
      }
      const summary: {
        thinking?: string;
        text?: string;
        finishReason?: string | null;
      } = {};
      if (typeof persisted.thinking === "string" && persisted.thinking.length > 0) {
        summary.thinking = persisted.thinking;
      }
      if (typeof persisted.text === "string" && persisted.text.length > 0) {
        summary.text = persisted.text;
      }
      if (persisted.finishReason !== undefined) {
        summary.finishReason = persisted.finishReason ?? null;
      }
      return Object.keys(summary).length > 0 ? summary : undefined;
    }
    const summary: {
      thinking?: string;
      text?: string;
      finishReason?: string | null;
    } = {};
    const thinking = segments
      .filter((segment) => segment.partType === "thinking")
      .map((segment) => segment.content)
      .join("");
    const text = segments
      .filter((segment) => segment.partType === "text")
      .map((segment) => segment.content)
      .join("");
    if (thinking.length > 0) {
      summary.thinking = thinking;
    }
    if (text.length > 0) {
      summary.text = text;
    }
    if (persisted?.finishReason !== undefined) {
      summary.finishReason = persisted.finishReason ?? null;
    }
    return Object.keys(summary).length > 0 ? summary : undefined;
  }

  private cloneAssistantResponseSegments(): HeartbeatAssistantResponseSegment[] {
    return this.activeModelResponseDraft?.assistantSegments.map((segment) => ({ ...segment })) ?? [];
  }

  private hasMeaningfulHeartbeatToolInput(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  private mergeHeartbeatToolInput(current: unknown, incoming: unknown): unknown {
    const currentMeaningful = this.hasMeaningfulHeartbeatToolInput(current);
    const incomingMeaningful = this.hasMeaningfulHeartbeatToolInput(incoming);
    if (typeof incoming === "string" && incoming.length === 0 && current === null) {
      return incoming;
    }
    if (!incomingMeaningful) {
      return current;
    }
    if (!currentMeaningful) {
      return incoming;
    }
    if (typeof current === "object" && current !== null && !Array.isArray(current)) {
      if (typeof incoming === "string") {
        return current;
      }
    }
    if (typeof incoming === "object" && incoming !== null && !Array.isArray(incoming)) {
      if (typeof current === "string") {
        return incoming;
      }
    }
    if (typeof current === "string" && typeof incoming === "string") {
      return incoming.length >= current.length ? incoming : current;
    }
    return incoming;
  }

  private persistHeartbeatResponseSegments(input: { aiCallId: number; roundIndex: number }): string[] {
    if (!this.activeModelResponseDraft || !this.sessionDb) {
      return [];
    }
    const upsertInputs = toHeartbeatResponseSegmentMessageUpsertInputs({
      aiCallId: input.aiCallId,
      roundIndex: input.roundIndex,
      segments: this.cloneAssistantResponseSegments(),
    });
    return upsertInputs.flatMap((upsertInput) => {
      const record = this.upsertHeartbeatPartMessage(upsertInput);
      return record ? [record.messageId] : [];
    });
  }

  private persistHeartbeatResponseArtifacts(input: {
    aiCallId: number;
    timestamp: number;
    roundIndex: number;
  }): string[] {
    if (!this.activeModelResponseDraft || !this.sessionDb) {
      return [];
    }
    return [
      ...new Set([
        ...this.persistHeartbeatResponseSegments(input),
        ...this.activeModelResponseDraft.toolTrace.flatMap((entry) =>
          this.persistHeartbeatToolInvocationMessage({
            aiCallId: input.aiCallId,
            roundIndex: input.roundIndex,
            invocationId: entry.invocationId,
            timestamp: input.timestamp,
          }),
        ),
      ]),
    ];
  }

  private persistHeartbeatToolInvocationMessage(input: {
    aiCallId: number;
    roundIndex: number;
    invocationId: string;
    timestamp: number;
  }): string[] {
    if (!this.activeModelResponseDraft || !this.sessionDb) {
      return [];
    }
    const invocation = this.activeModelResponseDraft.toolTrace.find(
      (entry) => entry.invocationId === input.invocationId,
    );
    if (!invocation) {
      return [];
    }
    const messageId = buildHeartbeatToolInvocationMessageId(input.aiCallId, input.invocationId);
    const existing = this.sessionDb.getMessageById(messageId);
    const upsertInput = toHeartbeatToolInvocationMessageUpsertInput({
      aiCallId: input.aiCallId,
      roundIndex: input.roundIndex,
      updatedAt: input.timestamp,
      invocation: {
        ...invocation,
        startedAt: existing?.createdAt ?? invocation.startedAt,
      },
    });
    const record = this.upsertHeartbeatPartMessage(upsertInput);
    return record ? [record.messageId] : [];
  }

  private upsertActiveModelToolTrace(input: {
    invocationId: string;
    tool: string;
    payload: Partial<{
      input: unknown;
      output: unknown;
      error: string;
      startedAt: number;
      finishedAt: number;
    }>;
  }): void {
    if (!this.activeModelResponseDraft) {
      this.activeModelResponseDraft = this.createEmptyActiveModelResponseDraft();
    }
    const existingIndex = this.activeModelResponseDraft.toolTrace.findIndex(
      (entry) => entry.invocationId === input.invocationId,
    );
    const current =
      existingIndex >= 0
        ? this.activeModelResponseDraft.toolTrace[existingIndex]
        : {
            invocationId: input.invocationId,
            tool: input.tool,
            input: null,
            startedAt: input.payload.startedAt ?? Date.now(),
            finishedAt: input.payload.finishedAt ?? input.payload.startedAt ?? Date.now(),
          };
    const next = {
      ...current,
      tool: input.tool,
      ...input.payload,
      input:
        "input" in input.payload ? this.mergeHeartbeatToolInput(current.input, input.payload.input) : current.input,
      startedAt:
        input.payload.startedAt === undefined
          ? current.startedAt
          : Math.min(current.startedAt, input.payload.startedAt),
      finishedAt: input.payload.finishedAt ?? current.finishedAt,
    };
    if (existingIndex >= 0) {
      this.activeModelResponseDraft.toolTrace[existingIndex] = next;
      return;
    }
    this.activeModelResponseDraft.toolTrace.push(next);
  }

  private buildActiveModelResponseEnvelope(input?: {
    baseResponse?: AgentModelCallRecord["response"];
    outcome?: SessionTerminalOutcome | null;
  }): { response: Record<string, unknown> | null; outcome: SessionTerminalOutcome | null } {
    const response = input?.baseResponse ? structuredClone(input.baseResponse as Record<string, unknown>) : {};
    const assistant = this.collectAssistantSummaryFromDraft();
    if (assistant) {
      response.assistant = assistant;
    } else {
      delete response.assistant;
    }
    const assistantSegments = this.cloneAssistantResponseSegments();
    if (assistantSegments.length > 0) {
      response.assistantSegments = assistantSegments;
    } else {
      delete response.assistantSegments;
    }
    if (this.activeModelResponseDraft?.usage) {
      response.usage = { ...this.activeModelResponseDraft.usage };
    } else {
      delete response.usage;
    }
    if ((this.activeModelResponseDraft?.toolTrace.length ?? 0) > 0) {
      response.toolTrace = this.activeModelResponseDraft?.toolTrace.map((entry) => ({ ...entry })) ?? [];
    } else {
      delete response.toolTrace;
    }
    return {
      response: Object.keys(response).length > 0 ? response : null,
      outcome: input?.outcome ?? null,
    };
  }

  private persistActiveModelResponse(timestamp: number): void {
    if (!this.sessionDb || this.activeModelCallId === null || !this.activeModelResponseDraft) {
      return;
    }
    this.sessionDb.updateAiCall(this.activeModelCallId, {
      responseBody: this.buildActiveModelResponseEnvelope(),
      updatedAt: timestamp,
      status: "running",
      isComplete: false,
    });
    const responseMessageIds = this.persistHeartbeatResponseArtifacts({
      aiCallId: this.activeModelCallId,
      timestamp,
      roundIndex: this.sessionDb.getHead().currentRoundIndex,
    });
    if (responseMessageIds.length > 0) {
      this.sessionDb.updateAiCall(this.activeModelCallId, {
        responseMessageIds,
        updatedAt: timestamp,
      });
    }
  }

  private async handleAssistantStreamUpdate(input: AssistantStreamUpdate): Promise<void> {
    if (!this.activeCycle) {
      return;
    }
    switch (input.kind) {
      case "thinking":
        this.appendAssistantResponseSegment({
          partType: "thinking",
          content: input.content,
          delta: input.delta,
          timestamp: input.timestamp,
        });
        this.persistActiveModelResponse(input.timestamp);
        this.setProjectionStage("decide");
        this.updateActiveCycle({
          status: "streaming",
        });
        return;
      case "draft":
        this.appendAssistantResponseSegment({
          partType: "text",
          content: input.content,
          delta: input.delta,
          timestamp: input.timestamp,
        });
        const draft = this.ensureActiveModelResponseDraft();
        draft.assistant = {
          ...(draft.assistant ?? {}),
          finishReason: input.finishReason ?? null,
        };
        if (input.usage) {
          draft.usage = { ...input.usage };
        }
        this.persistActiveModelResponse(input.timestamp);
        this.setProjectionStage("decide");
        this.updateActiveCycle({
          status: "streaming",
          streaming: {
            content: input.content,
          },
        });
        this.emitModelCallDelta({
          timestamp: input.timestamp,
          kind: "assistant_draft",
          data: {
            content: input.content,
            usage: input.usage,
            finishReason: input.finishReason ?? null,
          },
        });
        return;
      case "run_finished":
        this.closeActiveAssistantResponseSegment(input.timestamp);
        const finishedDraft = this.ensureActiveModelResponseDraft();
        finishedDraft.assistant = {
          ...(finishedDraft.assistant ?? {}),
          finishReason: input.finishReason ?? null,
        };
        if (input.usage) {
          finishedDraft.usage = { ...input.usage };
        }
        this.persistActiveModelResponse(input.timestamp);
        this.setProjectionStage("decide");
        this.updateActiveCycle({
          status: this.activeCycle.status === "error" ? "error" : "applying",
        });
        this.emitModelCallDelta({
          timestamp: input.timestamp,
          kind: "run_finished",
          data: {
            usage: input.usage,
            finishReason: input.finishReason ?? null,
          },
        });
        return;
      case "tool_call": {
        this.closeActiveAssistantResponseSegment(input.timestamp);
        this.upsertActiveModelToolTrace({
          invocationId: input.toolCallId,
          tool: input.toolName,
          payload: {
            input: input.input ?? input.argsText,
            startedAt: input.timestamp,
            finishedAt: input.timestamp,
          },
        });
        this.persistActiveModelResponse(input.timestamp);
        this.setProjectionStage("act");
        const invocationId = input.toolCallId;
        const callValue = input.input ?? input.argsText;
        this.updateActiveCycle({
          status: "streaming",
          upsertLiveMessage: {
            id: `live-tool:${invocationId}`,
            role: "assistant",
            content: buildToolInvocationMarkdown({
              invocationId,
              name: input.toolName,
              status: "running",
              startedAt: input.timestamp,
              call: callValue,
            }),
            timestamp: input.timestamp,
            channel: "tool",
            format: "markdown",
            tool: {
              invocationId,
              name: input.toolName,
              status: "running",
              startedAt: input.timestamp,
              call: {
                value: callValue,
                rawText: typeof input.argsText === "string" ? input.argsText : undefined,
              },
            },
          },
        });
        this.emitModelCallDelta({
          timestamp: input.timestamp,
          kind: "tool_call",
          data: {
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            argsText: input.argsText,
            input: input.input ?? callValue,
          },
        });
        return;
      }
      case "tool_result": {
        this.upsertActiveModelToolTrace({
          invocationId: input.toolCallId,
          tool: input.toolName,
          payload: {
            output: input.result,
            error: typeof input.error === "string" && input.error.trim().length > 0 ? input.error.trim() : undefined,
            finishedAt: input.timestamp,
          },
        });
        this.persistActiveModelResponse(input.timestamp);
        this.setProjectionStage("act");
        const invocationId = input.toolCallId;
        const liveMessage = this.activeCycle.liveMessages.find((message) => message.id === `live-tool:${invocationId}`);
        const call = liveMessage?.tool?.call;
        const startedAt = liveMessage?.tool?.startedAt ?? input.timestamp;
        const errorText =
          typeof input.error === "string" && input.error.trim().length > 0 ? input.error.trim() : undefined;
        this.updateActiveCycle({
          status: "streaming",
          upsertLiveMessage: {
            id: `live-tool:${invocationId}`,
            role: "assistant",
            content: buildToolInvocationMarkdown({
              invocationId,
              name: input.toolName,
              status: input.ok ? "success" : "failed",
              startedAt,
              finishedAt: input.timestamp,
              call: call?.value,
              result: input.result,
              error: errorText,
            }),
            timestamp: input.timestamp,
            channel: "tool",
            format: "markdown",
            tool: {
              invocationId,
              name: input.toolName,
              status: input.ok ? "success" : "failed",
              startedAt,
              finishedAt: input.timestamp,
              ...(call ? { call } : {}),
              result: {
                value: input.result ?? null,
              },
              ...(errorText ? { error: errorText } : {}),
            },
          },
        });
        this.emitModelCallDelta({
          timestamp: input.timestamp,
          kind: "tool_result",
          data: {
            toolCallId: input.toolCallId,
            toolName: input.toolName,
            ok: input.ok,
            result: input.result,
            error: errorText ?? null,
          },
        });
        return;
      }
    }
  }

  private async persistAttentionSystem(): Promise<void> {
    if (!this.attentionStore || !this.attentionHashAliasStore) {
      return;
    }
    const snapshot = this.attentionSystem.snapshot();
    await Promise.all([
      this.attentionStore.save(snapshot),
      this.attentionHashAliasStore.save(this.attentionHashAliases.snapshot()),
    ]);
  }

  private async handleModelCall(record: AgentModelCallRecord): Promise<void> {
    if (record.status === "running") {
      await this.messageKernelAdapter.commitActiveCycleReadAcks();
      this.activeModelResponseDraft = this.createEmptyActiveModelResponseDraft();
    }
    if (!this.sessionDb || this.activeCycleId === null) {
      return;
    }
    const traceRow = this.currentRunningTraceRow("call_model");
    const traceIdentity =
      traceRow === null
        ? undefined
        : {
            traceId: traceRow.traceId,
            spanId: traceRow.spanId,
            parentSpanId: traceRow.parentSpanId ?? null,
          };
    const attemptOneDispatchIds =
      record.status === "running"
        ? await this.beginAttentionDeliveryAttempt({
            agentCallId: record.id,
            attemptIndex: 1,
            cycleId: this.activeCycleId,
            timestamp: record.timestamp,
            sessionModelCallId: null,
          })
        : [];
    const normalizedRequest = this.normalizePersistedModelRequest(record.request);
    const requestMeta = {
      ...(normalizedRequest.meta ?? {}),
      agentCallId: record.id,
      cycleId: this.activeCycleId,
      wakeSource: this.activeCycle?.wakeSource ?? null,
      collectedInputs: this.activeCycle ? structuredClone(this.activeCycle.inputs) : [],
      trace: traceIdentity ?? null,
    };
    const requestBody = {
      ...normalizedRequest,
      messages: structuredClone(normalizedRequest.messages),
      meta: requestMeta,
      config: this.buildPersistedModelConfigPayload(),
    };
    const auxiliaryMessageIds = this.persistRequestAuxiliaryMessages({
      timestamp: record.timestamp,
      request: normalizedRequest,
    });
    if (record.status !== "running" && record.response) {
      this.activeModelResponseDraft ??= this.createEmptyActiveModelResponseDraft();
      const persistedAssistantSegments = this.readPersistedAssistantResponseSegments(record.response);
      if (persistedAssistantSegments.length > 0) {
        this.activeModelResponseDraft.assistantSegments = persistedAssistantSegments;
      }
      if (record.response.assistant) {
        this.activeModelResponseDraft.assistant = {
          ...(this.activeModelResponseDraft.assistant ?? {}),
          ...record.response.assistant,
        };
      }
      if (record.response.usage) {
        this.activeModelResponseDraft.usage = { ...record.response.usage };
      }
      if (record.response.toolTrace) {
        this.activeModelResponseDraft.toolTrace = record.response.toolTrace.map((entry) => ({ ...entry }));
      }
      this.closeActiveAssistantResponseSegment(record.completedAt ?? record.timestamp);
    }
    const responseBody = this.buildActiveModelResponseEnvelope({
      baseResponse: record.response,
      outcome: record.outcome ?? null,
    });
    const existingModelCallId = this.activeModelCallId ?? null;
    const modelCall =
      record.status === "running" || existingModelCallId === null
        ? this.sessionDb.appendAiCall({
            roundIndex: normalizedRequest.roundIndex,
            kind: this.activeCycle?.kind ?? "attention",
            createdAt: record.timestamp,
            status: record.status,
            completedAt: record.completedAt,
            provider: record.provider,
            model: record.model,
            requestUrl: this.config?.ai.baseUrl ?? "",
            requestBody,
            responseBody,
            error: record.error,
            outcome: record.outcome,
            requestMessageIds: [],
            responseMessageIds: [],
            auxiliaryMessageIds,
            isComplete: record.status !== "running",
            updatedAt: record.timestamp,
          })
        : this.sessionDb.updateAiCall(existingModelCallId, {
            roundIndex: normalizedRequest.roundIndex,
            kind: this.activeCycle?.kind ?? "attention",
            provider: record.provider,
            model: record.model,
            requestUrl: this.config?.ai.baseUrl ?? "",
            requestBody,
            responseBody,
            error: record.error,
            outcome: record.outcome,
            completedAt: record.completedAt ?? null,
            status: record.status,
            auxiliaryMessageIds,
            updatedAt: record.timestamp,
            isComplete: true,
          });
    const requestMessageIds =
      record.status === "running" || modelCall.requestMessageIds.length === 0
        ? this.persistHeartbeatRequestMessages({
            aiCallId: modelCall.id,
            timestamp: modelCall.createdAt,
            request: normalizedRequest,
          })
        : modelCall.requestMessageIds;
    const responseMessageIds =
      record.status === "running"
        ? modelCall.responseMessageIds
        : this.persistHeartbeatResponseArtifacts({
            aiCallId: modelCall.id,
            timestamp: record.completedAt ?? record.timestamp,
            roundIndex: normalizedRequest.roundIndex,
          });
    const linkedModelCall = this.sessionDb.updateAiCall(modelCall.id, {
      requestMessageIds,
      responseMessageIds,
      auxiliaryMessageIds,
      updatedAt: record.timestamp,
      ...(record.status === "running"
        ? {}
        : {
            status: record.status,
            completedAt: record.completedAt ?? null,
            isComplete: true,
          }),
    });
    if (record.status === "running") {
      if (attemptOneDispatchIds.length > 0) {
        this.bindAttentionDispatchesForAttempt({
          agentCallId: record.id,
          attemptIndex: 1,
          sessionModelCallId: linkedModelCall.id,
        });
      }
      this.activeAgentCallId = record.id;
    }
    if (traceRow) {
      this.upsertTraceRow({
        cycleId: traceRow.cycleId,
        traceId: traceRow.traceId,
        spanId: traceRow.spanId,
        parentSpanId: traceRow.parentSpanId,
        kind: traceRow.kind,
        name: traceRow.name,
        status: traceRow.status,
        startedAt: traceRow.startedAt,
        endedAt: traceRow.endedAt,
        refs: mergeTraceRefs(traceRow.refs, [toModelCallTraceRef(linkedModelCall.id)]),
        links: traceRow.links,
        events: traceRow.events,
        attributes: {
          ...traceRow.attributes,
          provider: linkedModelCall.provider,
          model: linkedModelCall.model,
        },
        outcome: record.outcome ?? traceRow.outcome,
      });
    }
    this.activeModelCallId =
      record.status === "running" ? linkedModelCall.id : (this.activeModelCallId ?? linkedModelCall.id);
    if (this.activeCycleId !== null) {
      const frame = this.attentionCycleFrames.get(this.activeCycleId);
      if (frame && !frame.modelCallIds.includes(linkedModelCall.id)) {
        frame.modelCallIds = [...frame.modelCallIds, linkedModelCall.id];
        frame.activeContextIds = this.collectActiveAttentionContextIds();
        this.upsertAttentionCycleFrame(frame);
      }
      if (frame && record.status !== "running") {
        const progressedContextIds = new Set([
          ...frame.inputContextIds,
          ...frame.producedCommitRefs.map((ref) => ref.contextId),
        ]);
        if (frame.producedCommitRefs.length > 0) {
          this.markAttentionProgress(progressedContextIds);
          this.refreshLoopKernelSnapshot();
        } else if (
          record.status === "error" &&
          record.outcome?.code !== "stopped" &&
          record.outcome?.code !== "aborted" &&
          record.outcome?.code !== "cancelled"
        ) {
          const errorMessage =
            record.error && typeof record.error === "object" && "message" in record.error
              ? typeof record.error.message === "string"
                ? record.error.message
                : undefined
              : undefined;
          const errorName =
            record.error && typeof record.error === "object" && "name" in record.error
              ? typeof record.error.name === "string"
                ? record.error.name
                : undefined
              : undefined;
          this.recordAttentionContainmentFailure(frame.inputContextIds, {
            status: record.status,
            provider: record.provider,
            model: record.model,
            outcome: record.outcome,
            error: errorMessage || errorName ? { message: errorMessage, name: errorName } : undefined,
          });
          this.refreshLoopKernelSnapshot();
        }
      }
    }
    this.updateActiveCycle({
      modelCallId: linkedModelCall.id,
      status: linkedModelCall.status === "error" ? "error" : this.activeCycle?.status,
    });
    if (record.status === "done") {
      this.recordHeartbeatCompactBoundary(linkedModelCall);
    }
    if (record.status !== "running") {
      this.persistUsageAnalyticsFact(linkedModelCall);
    }
    if (record.status === "error") {
      this.setProjectionStage("error");
    } else if (record.status === "done") {
      const toolTrace = record.response?.toolTrace ?? [];
      this.setProjectionStage(toolTrace.length > 0 ? this.deriveProjectionStageFromToolTrace(toolTrace) : "idle");
    }
    if (record.status === "error" && record.error?.message) {
      this.setLoopKernelLastError(record.error.message);
      this.emit("error", { message: record.error.message });
    } else if (record.status === "done" && (this.loopKernelSnapshot?.state.lastError ?? null) !== null) {
      this.setLoopKernelLastError(null);
    }
    this.emit("modelCall", { entry: projectAiCallToModelCall(linkedModelCall) });
    if (record.response?.toolTrace && traceRow) {
      for (const tool of record.response.toolTrace) {
        this.upsertTraceRow({
          cycleId: this.activeCycleId,
          traceId: traceRow.traceId,
          spanId: createSpanId(),
          parentSpanId: traceRow.spanId,
          kind: "tool.call",
          name: tool.tool,
          status: tool.error ? "error" : "done",
          startedAt: Number.isFinite(tool.startedAt) ? tool.startedAt : record.timestamp,
          endedAt: Number.isFinite(tool.finishedAt) ? tool.finishedAt : record.timestamp,
          refs: mergeTraceRefs(this.buildCycleTraceRefs(this.activeCycleId), [toModelCallTraceRef(linkedModelCall.id)]),
          links: [
            {
              kind: "child_of",
              traceId: traceRow.traceId,
              spanId: traceRow.spanId,
            },
          ],
          events: [
            createTraceEvent("tool.call", {
              status: tool.error ? "error" : "ok",
              attributes: {
                tool: tool.tool,
              },
            }),
          ],
          attributes: {
            tool: tool.tool,
            input: tool.input,
          },
          outcome: tool.error
            ? {
                code: "error",
                message: tool.error,
                error: { message: tool.error },
              }
            : {
                code: "done",
              },
        });
      }
    }
    if (record.status !== "running") {
      if (this.activeAgentCallId === record.id) {
        this.activeAgentCallId = null;
      }
      this.deliveryDispatchIdsByAgentCallAttempt.delete(record.id);
      this.activeModelCallId = null;
      this.activeModelResponseDraft = null;
    }
    if (this.isApiCallRecordingEnabled()) {
      this.emit("apiCall", {
        entry: modelCall,
      });
    }
  }

  private setLoopKernelLastError(lastError: string | null): void {
    const current = this.loopKernelSnapshot?.state.lastError ?? null;
    if (current === lastError) {
      return;
    }
    this.updateLoopKernelSnapshot({
      phase: this.loopPhase,
      currentCycleId: this.activeCycleId,
      lastWakeSource: null,
      lastError,
      cycle: this.loopKernelSnapshot?.state.cycle,
      paused: this.loopKernelSnapshot?.state.paused,
    });
  }

  private refreshLoopKernelSnapshot(): void {
    if (!this.loopKernelSnapshot) {
      return;
    }
    this.updateLoopKernelSnapshot({
      phase: this.loopPhase,
      currentCycleId: this.activeCycleId,
      lastWakeSource: null,
      lastError: this.loopKernelSnapshot.state.lastError,
      cycle: this.loopKernelSnapshot.state.cycle,
      paused: this.loopKernelSnapshot.state.paused,
    });
  }

  private emit<TType extends keyof RuntimeEventMap>(type: TType, payload: RuntimeEventMap[TType]): void {
    const event: RuntimeEvent<TType> = {
      type,
      timestamp: Date.now(),
      payload,
    };
    for (const listener of this.listeners) {
      listener(event as RuntimeEvent);
    }
  }

  private async reloadSettingsLayers(config: ResolvedSessionConfig | null = this.config): Promise<void> {
    if (!config) {
      return;
    }
    const loaded = await listWorkspaceSettingsLayers({
      workspacePath: config.agentCwd,
      avatar: config.avatar.nickname,
    });
    this.settingsEffective = loaded.effective.content;
    this.settingsLayers = loaded.layers;
  }
}
