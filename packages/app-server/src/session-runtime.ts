import {
  AttentionStore,
  AttentionSystem,
  type AttentionActiveContextMatch,
  type AttentionCommit,
  type AttentionCommitChange,
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
import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  type MessageActorId,
  type MessageChannelGrantRecord,
  type MessageChannelKind,
  type MessageChannelPatchInput,
  type MessageControlPlaneEntry,
  type MessageErrorPayload,
  type MessageFocusOp,
  type MessageInteractivePayload,
  type MessageIssueGrantInput,
  type MessageIssuedGrant,
  type MessageQueryRequest,
  type MessageRecord,
  type MessageSnapshot,
  type ReverseTimeCursor,
} from "@agenter/message-system";
import {
  SessionDb,
  type SessionAiCallRecord,
  type SessionAssetRecord,
  type SessionCollectedInput,
  type SessionCollectedInputPart,
  type ReversePage as SessionDbReversePage,
  type ReverseTimeCursor as SessionDbReverseTimeCursor,
  type SessionMessageRecord,
  type SessionMessageUpsertInput,
  type SessionPromptWindowRecord,
  type SessionTerminalOutcome,
  type SessionTraceRef,
} from "@agenter/session-system";
import { ResourceLoader } from "@agenter/settings";
import {
  TaskEngine,
  resolveTaskSources,
  serializeTaskMarkdown,
  type TaskSourceName,
  type TaskSourceResolved,
  type TaskView,
} from "@agenter/task-system";
import {
  TerminalControlPlane,
  type TerminalReadResult as ControlPlaneTerminalReadResult,
  type TerminalActorId,
  type TerminalControlPlaneConfig,
  type TerminalControlPlaneConfigPatch,
  type TerminalControlPlaneEntry,
  type TerminalProcessProfile,
} from "@agenter/terminal-system";
import { toolDefinition } from "@tanstack/ai";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { createRuntimeAttentionPreview } from "./attention-runtime-view";
import { AttentionSearchEngine, type AttentionSearchRequest } from "./attention-search";

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
  type AttentionDraft,
  type LoopBusPlugin,
  type LoopMessageSourceRef,
  type LoopSourceReadRequest,
  type LoopSourceReadResult,
  type LoopSourceRef,
  type LoopTaskSourceRef,
  type LoopTerminalSourceRef,
} from "./loopbus-plugin-runtime";
import { ManagedTerminal, type ManagedTerminalSnapshot } from "./managed-terminal";
import { listMessageSeatEntries, summarizeMessageChannelPresence } from "./message-channel-presence";
import { repairRoomParticipantsIfNeeded } from "./message-room-participant-repair";
import { resolveModelCapabilities } from "./model-capabilities";
import { ModelClient, type AssistantStreamUpdate } from "./model-client";
import { FilePromptStore } from "./prompt-store";
import { buildProviderSnapshot, normalizeTokenUsage, readProviderSnapshotFromRequestBody } from "./provider-snapshot";
import { createRuntimeShellCommands } from "./runtime-cli";
import type {
  RuntimeCycleRecord,
  RuntimeLoopStateLogRecord,
  RuntimeLoopTraceRecord,
  RuntimeTerminalActivityRecord,
} from "./runtime-history-records";
import { startRuntimeLocalApi, type RuntimeLocalApiHandle } from "./runtime-local-api";
import { buildRuntimeTerminalEnvironment } from "./runtime-shell-bin";
import {
  RUNTIME_API_BASE_URL_ENV,
  RUNTIME_HOME_DIR_ENV,
  RUNTIME_PRINCIPAL_ID_ENV,
  RUNTIME_PRIVATE_KEY_ENV,
  RUNTIME_ROOT_WORKSPACE_ENV,
  buildRuntimeSkillsList,
  listRuntimeSkillMountRoots,
  listRuntimeSkills,
  type RuntimeSkillRecord,
} from "./runtime-skills";
import {
  projectRuntimeAttentionActiveMatch,
  projectRuntimeMessageChannel,
  projectRuntimeMessageOverview,
  projectRuntimeMessageSnapshot,
  projectRuntimeTerminal,
  projectRuntimeWorkspaceSurface,
  type RuntimeMessageChannelView,
  type RuntimeMessageQueryResult,
  type RuntimeMessageOverviewItem,
  type RuntimeMessageSendResult,
  type RuntimeMessageSnapshotView,
  type RuntimeReachableParticipantView,
  type RuntimeVisibleMessageRoomView,
  type RuntimeWorkspaceSurface,
} from "./runtime-tool-views";
import { listRuntimeToolFiles } from "./runtime-tools";
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
import {
  appAttentionSourceRegistry,
  formatMessageAttentionSrc,
  formatTaskAttentionSrc,
  formatTerminalAttentionSrc,
  parseMessageAttentionSrc,
  parseTaskAttentionSrc,
  parseTerminalAttentionSrc,
  MESSAGE_ATTENTION_NAMESPACE,
  TASK_ATTENTION_NAMESPACE,
  TERMINAL_ATTENTION_NAMESPACE,
  type MessageAttentionSrc,
  type TerminalAttentionSrc,
} from "./attention-src";
import { SessionStore } from "./session-store";
import { SettingsEditor, type EditableKind } from "./settings-editor";
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
  executeRootWorkspaceBash,
  type RootWorkspaceBashExecResult,
  type RootWorkspaceMountInput,
  type WorkspaceGrantRecord,
  type WorkspaceMountRecord,
} from "./workspace-system";
import { listWorkspaceHiddenPrivatePaths } from "./workspace-system/private-isolation";

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
  state: "none" | "ready" | "backoff";
  nextWakeAt: number | null;
  retryCount: number;
}

type CompactCycleTrigger = "manual" | "threshold" | "error" | "attention_retry";
type AttentionInputProtocolKind = "context" | "items";
interface AttentionCommitRefEnvelope {
  contextId: string;
  commitId: string;
}

interface PendingCompactRequest {
  trigger: CompactCycleTrigger;
  requestedAt: number;
}

const COMPACT_CYCLE_TRIGGER_VALUES = new Set<CompactCycleTrigger>(["manual", "threshold", "error", "attention_retry"]);
const ATTENTION_INPUT_PROTOCOL_KINDS = new Set<AttentionInputProtocolKind>(["context", "items"]);
const COMPACT_CYCLE_INPUT_NAME = "CompactCycle";
const MAX_ATTENTION_PROTOCOL_COMMITS = 24;

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
  },
): ControlPlaneTerminalReadResult => ({
  kind: "terminal-diff",
  representation: "diff" as const,
  terminalId,
  fromHash: input.fromHash,
  toHash: input.toHash,
  bytes: input.bytes,
  status: input.status,
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
  },
): string => JSON.stringify(buildTerminalDiffPayload(terminalId, input));

const truncateAttentionDetail = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  const remaining = value.length - maxChars;
  return `${value.slice(0, maxChars)}\n... [truncated ${remaining} chars]`;
};

const buildTerminalSnapshotPayload = (
  terminalId: string,
  snapshot: ManagedTerminalSnapshot,
  status: "IDLE" | "BUSY",
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
});

const truncateTerminalAttentionDetail = (value: string): string => {
  return truncateAttentionDetail(value, MAX_TERMINAL_ATTENTION_DETAIL_CHARS);
};

const getTerminalTail = (payload: Record<string, unknown>): string => {
  if (typeof payload.tail === "string") {
    return payload.tail;
  }
  if (Array.isArray(payload.tail)) {
    return payload.tail.filter((line): line is string => typeof line === "string").join("\n");
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

type TerminalReadPayload = ControlPlaneTerminalReadResult | { ok: false; reason: string };

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
  focusState: match.context.focusState,
  updatedAt: match.context.updatedAt,
  headCommitId: match.context.headCommitId,
  scoreMap: match.context.scoreMap,
  contentPreview: truncateAttentionDetail(match.context.content, 280),
  recentCommitSummaries: match.recentCommits.slice(-3).map((commit) => ({
    commitId: commit.commitId,
    summary: commit.summary,
    scores: commit.scores,
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
  scores: { ...commit.scores },
  summary: commit.summary,
  change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
  createdAt: commit.createdAt,
});

const projectAttentionActiveContextForPrompt = (match: AttentionActiveContextMatch): Record<string, unknown> => ({
  contextId: match.contextId,
  context: {
    contextId: match.context.contextId,
    owner: match.context.owner,
    focusState: match.context.focusState,
    content: truncateAttentionDetail(match.context.content, 1_600),
    contentFormat: match.context.contentFormat,
    scoreMap: { ...match.context.scoreMap },
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

const serializeBackgroundAttentionContext = (match: AttentionActiveContextMatch): string =>
  mdFence("yaml+background-attention-context", toYaml(projectBackgroundAttentionContextForModel(match)));

const serializeBackgroundAttentionContexts = (matches: readonly AttentionActiveContextMatch[]): string =>
  mdFence(
    "yaml+background-attention-context",
    toYaml(collapseSingleAttentionValue(matches.map((match) => projectBackgroundAttentionContextForModel(match)))),
  );

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

interface PendingUnreadReadAck {
  chatId: string;
  accessToken: string;
  targetMessageId: number;
  selectedMessageIds: number[];
}

const MESSAGE_SRC_NAMESPACE = MESSAGE_ATTENTION_NAMESPACE;
const TERMINAL_SRC_NAMESPACE = TERMINAL_ATTENTION_NAMESPACE;
const TASK_SRC_NAMESPACE = TASK_ATTENTION_NAMESPACE;

type RuntimeSourceKind = "message" | "terminal" | "task" | "unknown";
type LifecycleBridgeId = "message" | "terminal";

type MessageSourceParts = MessageAttentionSrc & { messageId: number };

type TerminalSourceParts = TerminalAttentionSrc;

const formatMessageSourceSrc = (input: MessageSourceParts): LoopMessageSourceRef["src"] =>
  `${MESSAGE_SRC_NAMESPACE}:${input.chatId}/${input.messageId}`;

const parseMessageSourceSrc = (src: string): MessageSourceParts | null => {
  const parsed = parseMessageAttentionSrc(src);
  return parsed && typeof parsed.messageId === "number"
    ? {
        chatId: parsed.chatId,
        messageId: parsed.messageId,
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
  if (namespace === MESSAGE_ATTENTION_NAMESPACE) {
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
          });
  return `${draft.sourceRef.src}:${semanticHint}`;
};

const buildAttentionScoreSubjectSeed = (draft: AttentionDraft): string =>
  `subject:${draft.sourceRef.src}`;

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

export interface SessionRuntimeAttentionState {
  snapshot: AttentionSystemSnapshot;
  active: AttentionActiveContextMatch[];
  cycleFrames: AttentionCycleFrame[];
  hooks: AttentionHookRecord[];
}

export interface SessionRuntimeAttentionApiSurface {
  baseUrl: string;
  principalId: string;
}

export interface SessionRuntimeRootWorkspaceSurface {
  path: string;
  commandNames: string[];
  toolNames: string[];
  skillRoots: string[];
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
  terminalStatus: { terminalId: string; running: boolean; status: "IDLE" | "BUSY" };
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
    running: boolean;
    status: "IDLE" | "BUSY";
    seq: number;
    cwd: string;
    icon?: string;
    title?: string;
    shortcuts?: Record<string, string>;
    transportUrl?: string;
  }>;
  tasks: TaskView[];
  schedulerState: LoopBusKernelState | null;
  attention?: SessionRuntimeAttentionState;
  schedulerSignals: Record<LoopInputKind, { version: number; timestamp: number | null }>;
  apiCallRecording: {
    enabled: boolean;
    refCount: number;
  };
  attentionApi: SessionRuntimeAttentionApiSurface | null;
  rootWorkspace: SessionRuntimeRootWorkspaceSurface | null;
  modelCapabilities: ModelCapabilities;
  activeCycle: ChatCycle | null;
}

export interface SessionRuntimeOptions {
  sessionId: string;
  cwd: string;
  avatar?: string;
  avatarPrincipalId?: string;
  avatarPrivateKey?: string;
  homeDir?: string;
  rootWorkspacePath?: string;
  usageAnalyticsRoot?: string;
  sessionRoot: string;
  sessionName: string;
  storeTarget: "global" | "workspace";
  messageSystem?: MessageControlPlane;
  messageActorId?: MessageActorId;
  terminalSystem: TerminalControlPlane;
  terminalActorId?: TerminalActorId;
  primaryRoomId: string;
  resolveRuntimeTerminalCwd?: (input: {
    sessionId: string;
    cwd?: string;
  }) =>
    | Promise<{ ok: true; cwd: string } | { ok: false; message: string }>
    | { ok: true; cwd: string }
    | { ok: false; message: string };
  listRuntimeWorkspaceAuthorities?: () => Array<{
    mount: WorkspaceMountRecord;
    grants: WorkspaceGrantRecord[];
  }>;
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
    maxRetries: number;
    maxToken?: number;
    maxContextTokens?: number;
    compactThreshold?: number;
    thinking?: {
      enabled?: boolean;
      budgetTokens?: number;
    };
    capabilities: ModelCapabilities;
  } | null;
  promptWindow: ReturnType<AgenterAI["inspectDebugState"]>["promptWindow"];
  stats: ReturnType<AgenterAI["inspectDebugState"]>["stats"] | null;
  latestModelCall: SessionModelCallRecord | null;
  recentModelCalls: SessionModelCallRecord[];
  recentApiCalls: SessionDbApiCallRecord[];
}

export class SessionRuntime {
  private readonly listeners: Array<(event: RuntimeEvent) => void> = [];
  private readonly dirtyQueue = new Set<string>();
  private readonly terminalSnapshots: Record<string, ManagedTerminalSnapshot> = {};
  private readonly terminalReads: Record<string, ControlPlaneTerminalReadResult> = {};
  private readonly terminalDirtyState: Record<string, boolean> = {};
  private readonly terminalLatestSeq: Record<string, number> = {};
  private readonly terminalViewFingerprint: Record<string, string> = {};
  private readonly terminalSemanticFingerprint: Record<string, string> = {};
  private readonly terminalStatusById = new Map<string, { running: boolean; status: "IDLE" | "BUSY" }>();
  private readonly taskEngine = new TaskEngine();
  private readonly taskSourceMtime = new Map<string, number>();
  private readonly taskAttentionDraftQueue: AttentionDraft[] = [];
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
  private readonly messageActorId: MessageActorId;
  private readonly terminalActorId: TerminalActorId;
  private readonly primaryRoomId: string;
  private readonly inboundMessageQueue: LoopBusInput[] = [];
  private readonly pendingUnreadMessageIds = new Set<number>();
  private readonly messageSystemCleanup: Array<() => void> = [];
  private readonly terminalSystemCleanup: Array<() => void> = [];
  private agent: AgenterAI | null = null;
  private runtimeLocalApi: RuntimeLocalApiHandle | null = null;
  private runtimeSkills: RuntimeSkillRecord[] = [];
  private runtimeSkillsList = "";
  private readonly terminalControlPlane: TerminalControlPlane;
  private terminals = new Map<string, ManagedTerminal>();
  private runtime: AgentRuntime | null = null;
  private started = false;
  private abortWakeRequested = false;
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
  private readonly dirtyAttentionContextIds = new Set<string>();
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
  private stagedUnreadReadAcks: PendingUnreadReadAck[] = [];
  private activeCycleUnreadReadAcks: PendingUnreadReadAck[] = [];
  private activeCycleUnreadReadCommitted = false;

  constructor(private readonly options: SessionRuntimeOptions) {
    this.messageActorId = options.messageActorId ?? resolveSessionRoomActorId(options.sessionId);
    this.terminalActorId = options.terminalActorId ?? (resolveSessionRoomActorId(options.sessionId) as TerminalActorId);
    this.primaryRoomId = options.primaryRoomId;
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
    this.bindMessageSystem();
  }

  private getHomeDir(): string {
    return this.options.homeDir ?? homedir();
  }

  private getRootWorkspacePath(): string {
    return this.options.rootWorkspacePath ?? this.options.cwd;
  }

  private listWorkspaceAuthorities(): Array<{
    mount: WorkspaceMountRecord;
    grants: WorkspaceGrantRecord[];
  }> {
    return this.options.listRuntimeWorkspaceAuthorities?.() ?? [];
  }

  private getRootWorkspaceSkillRoots(): string[] {
    return listRuntimeSkillMountRoots({
      homeDir: this.getHomeDir(),
      rootWorkspacePath: this.getRootWorkspacePath(),
      principalId: this.options.avatarPrincipalId,
    });
  }

  private getRootWorkspaceToolFiles(): string[] {
    return listRuntimeToolFiles({
      homeDir: this.getHomeDir(),
      rootWorkspacePath: this.getRootWorkspacePath(),
    });
  }

  private getRootWorkspaceSkillMounts(): RootWorkspaceMountInput[] {
    const rootWorkspacePath = resolve(this.getRootWorkspacePath());
    return this.getRootWorkspaceSkillRoots()
      .map((path) => resolve(path))
      .filter((path) => {
        if (path === rootWorkspacePath) {
          return false;
        }
        const rel = relative(rootWorkspacePath, path);
        return rel.startsWith("..") || rel === "";
      })
      .map((path) => ({
        path,
        mode: "ro" as const,
      }));
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

  private getMessageSourceChannelId(ref: LoopSourceRef): string {
    return this.parseMessageSource(ref)?.chatId ?? this.getDefaultChatId();
  }

  private getDefaultChatId(): string {
    return this.primaryRoomId;
  }

  private getAvatarName(): string {
    return this.config?.avatar?.nickname ?? this.options.avatar ?? DEFAULT_CHAT_OWNER;
  }

  private listActorRooms(
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry[] {
    return this.messageSystem.listChannelsForActor(this.messageActorId, input);
  }

  private getActorRoom(
    chatId: string,
    input: { includeArchived?: boolean; touchPresence?: boolean } = {},
  ): MessageControlPlaneEntry | undefined {
    return this.messageSystem.getChannelForActor(chatId, this.messageActorId, input);
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

  private resolveAttentionIngressType(contextId: string): "commit" | "push" {
    return this.resolveAttentionFocusState(contextId) === "focused" ? "commit" : "push";
  }

  private isNotificationAttentionCommit(commit: AttentionCommit): boolean {
    return Array.isArray(commit.meta.tags) && commit.meta.tags.includes("notification");
  }

  private isWakeableAttentionIngress(contextId: string, commit: AttentionCommit): boolean {
    if (commit.ingressType === "commit") {
      return true;
    }
    if (this.isNotificationAttentionCommit(commit)) {
      return true;
    }
    return this.resolveAttentionFocusState(contextId) === "background";
  }

  private async applyAttentionFocusState(contextId: string, focusState: AttentionFocusState): Promise<void> {
    const before = this.ensureAttentionContext(contextId, focusState);
    if (before.focusState === focusState) {
      return;
    }
    this.attentionSystem.setContextFocusState(contextId, focusState);
    this.attentionFactsVersion += 1;
    await this.persistAttentionSystem();
    this.emitAttentionState();
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
    op: TerminalFocusOp;
  }): void {
    const beforeSet = new Set(input.before);
    const afterSet = new Set(input.after);
    for (const terminalId of input.after) {
      if (beforeSet.has(terminalId)) {
        continue;
      }
      this.enqueueTerminalLifecycleAttentionCommit({
        terminalId,
        contextId: this.getTerminalAttentionContextId(terminalId),
        event: "terminal_focus",
        summary: `Focused terminal ${terminalId}`,
        payload: {
          op: input.op,
          focused: true,
          focusedTerminalIds: [...input.after],
        },
      });
    }
    for (const terminalId of input.before) {
      if (afterSet.has(terminalId)) {
        continue;
      }
      this.enqueueTerminalLifecycleAttentionCommit({
        terminalId,
        contextId: this.getTerminalAttentionContextId(terminalId),
        event: "terminal_unfocus",
        summary: `Unfocused terminal ${terminalId}`,
        payload: {
          op: input.op,
          focused: false,
          focusedTerminalIds: [...input.after],
        },
      });
    }
  }

  private async updateTerminalControlPlaneConfig(
    patch: TerminalControlPlaneConfigPatch,
  ): Promise<TerminalControlPlaneConfig> {
    const updated = await this.requireTerminalControlPlane().setConfig(patch);
    this.enqueueTerminalLifecycleAttentionCommit({
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
          : chatId === this.getDefaultChatId()
            ? "focused"
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

  private requireDefaultChatChannel(): MessageControlPlaneEntry {
    const chatId = this.getDefaultChatId();
    const context = this.ensureAttentionContextForChannel(chatId);
    const existing = this.getActorRoom(chatId);
    if (!existing) {
      throw new Error(`default room is not attached: ${chatId}`);
    }
    const created = repairRoomParticipantsIfNeeded(this.messageSystem, existing);
    if (this.resolveAttentionFocusState(context.contextId) === "focused") {
      this.messageSystem.focusForActor(this.messageActorId, "add", [chatId]);
    } else {
      this.messageSystem.focusForActor(this.messageActorId, "remove", [chatId]);
    }
    return created;
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
      readProgress: channel.readProgress
        ? {
            ...channel.readProgress,
          }
        : undefined,
      readStates: channel.readStates?.map((state) => ({
        actorId: state.actorId,
        label: state.label,
        role: state.role,
        currentAdmin: state.currentAdmin,
        online: state.online,
        focused: state.focused,
        hasReadLatestVisible: state.hasReadLatestVisible,
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
    if (input.chatId === this.getDefaultChatId()) {
      this.requireDefaultChatChannel();
    }
    const channel =
      this.getActorRoom(input.chatId, {
        includeArchived: input.includeArchived ?? false,
      }) ??
      this.messageSystem.getChannel(input.chatId, {
        includeArchived: input.includeArchived ?? false,
      });
    return channel ? this.projectMessageChannelForTooling(channel) : null;
  }

  private readMessageChannelForTooling(input: { chatId: string; limit?: number }): RuntimeMessageSnapshotView {
    const visibleRooms = this.listVisibleMessageRoomSummaries(input.chatId);
    const snapshot = this.readMessageChannel(input);
    return projectRuntimeMessageSnapshot(snapshot, {
      visibleRooms,
      reachableParticipants: this.projectReachableMessageParticipants(visibleRooms),
      referencedItems: this.resolveReferencedRoomMessages(snapshot),
    });
  }

  private resolveReferencedRoomMessages(snapshot: MessageSnapshot): MessageRecord[] {
    const refs = [...new Set(snapshot.items.map((item) => item.ref).filter((value): value is number => value !== undefined))];
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
      .sort((left, right) => {
        if (left.focused !== right.focused) {
          return left.focused ? -1 : 1;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 8);
  }

  private projectReachableMessageParticipants(
    visibleRooms: RuntimeVisibleMessageRoomView[],
  ): RuntimeReachableParticipantView[] {
    const directory = new Map<string, RuntimeVisibleMessageRoomView[]>();
    for (const room of visibleRooms) {
      for (const label of room.participantLabels) {
        const normalizedLabel = label.trim();
        if (normalizedLabel.length === 0) {
          continue;
        }
        const rooms = directory.get(normalizedLabel) ?? [];
        rooms.push(room);
        directory.set(normalizedLabel, rooms);
      }
    }
    return [...directory.entries()]
      .map(([label, rooms]) => ({
        label,
        rooms: rooms.sort((left, right) => {
          if (left.focused !== right.focused) {
            return left.focused ? -1 : 1;
          }
          return left.title.localeCompare(right.title);
        }),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
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

  private shouldTreatSharedMessageAsReplyPending(input: {
    message: MessageRecord;
    selfActorId: string;
    selfLabel: string;
    audience: "direct" | "group";
  }): boolean {
    const senderActorId = input.message.senderActorId ?? null;
    if (senderActorId === null || senderActorId === input.selfActorId) {
      return false;
    }
    if (input.audience === "direct") {
      return true;
    }
    if (senderActorId.startsWith("auth:")) {
      return true;
    }
    return /[?？]/u.test(input.message.content);
  }

  private buildMessageLoopMeta(
    message: MessageRecord,
    channel: MessageControlPlaneEntry | undefined,
    existingMeta: Record<string, string | number | boolean | null>,
  ): Record<string, string | number | boolean | null> {
    const nextMeta = { ...existingMeta };
    if (!channel) {
      return nextMeta;
    }

    const seatEntries = listMessageSeatEntries(channel);
    const toLabels = (
      entries: Array<{
        label: string;
      }>,
    ): string[] => entries.map((entry) => entry.label);

    const selfActorId = this.messageActorId;
    const selfState = seatEntries.find((state) => state.actorId === selfActorId);
    const senderActorId = message.senderActorId ?? null;
    const senderState =
      (senderActorId ? seatEntries.find((state) => state.actorId === senderActorId) : undefined) ??
      seatEntries.find((state) => state.label === message.from);
    const otherStates = seatEntries.filter((state) => state.actorId !== selfActorId);
    const onlineStates = seatEntries.filter((state) => state.online === true);
    const offlineStates = seatEntries.filter((state) => state.online === false);
    const focusedStates = seatEntries.filter((state) => state.focused === true);
    const otherOnlineStates = otherStates.filter((state) => state.online === true);
    const otherOfflineStates = otherStates.filter((state) => state.online === false);
    const chatAudience = seatEntries.length > 2 ? "group" : "direct";

    nextMeta.chatParticipantCount = seatEntries.length;
    nextMeta.chatParticipantLabels = JSON.stringify(toLabels(seatEntries));
    nextMeta.chatOtherParticipantLabels = JSON.stringify(toLabels(otherStates));
    nextMeta.chatOnlineParticipantLabels = JSON.stringify(toLabels(onlineStates));
    nextMeta.chatOfflineParticipantLabels = JSON.stringify(toLabels(offlineStates));
    nextMeta.chatFocusedParticipantLabels = JSON.stringify(toLabels(focusedStates));
    nextMeta.chatOtherOnlineParticipantLabels = JSON.stringify(toLabels(otherOnlineStates));
    nextMeta.chatOtherOfflineParticipantLabels = JSON.stringify(toLabels(otherOfflineStates));
    nextMeta.chatSelfActorId = selfActorId;
    nextMeta.chatSelfLabel = selfState?.label ?? this.getAvatarName();
    const latestMessagePerspective = senderActorId !== null && senderActorId === selfActorId ? "self" : "other";
    const replyPending =
      latestMessagePerspective === "other" &&
      this.shouldTreatSharedMessageAsReplyPending({
        message,
        selfActorId,
        selfLabel: String(nextMeta.chatSelfLabel ?? ""),
        audience: chatAudience,
      });
    nextMeta.chatSenderActorId = senderActorId;
    nextMeta.chatSenderLabel = senderState?.label ?? message.from;
    nextMeta.chatMessagePerspective = latestMessagePerspective;
    nextMeta.chatTurnState = replyPending ? "your_turn" : "waiting";
    nextMeta.chatObligationKind = replyPending ? "room_reply_pending" : "self_update";
    nextMeta.chatAudience = chatAudience;
    const visibleRooms = this.listVisibleMessageRoomSummaries(channel.chatId);
    nextMeta.chatVisibleRoomCount = visibleRooms.length;
    nextMeta.chatVisibleRoomSummaries = JSON.stringify(visibleRooms);
    return nextMeta;
  }

  private parseMessageMetaLabelList(value: unknown): string[] {
    if (typeof value !== "string" || value.trim().length === 0) {
      return [];
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  private parseMessageMetaRoomSummaries(value: unknown): Array<{
    chatId: string;
    title: string;
    participantLabels: string[];
    focused: boolean;
  }> {
    if (typeof value !== "string" || value.trim().length === 0) {
      return [];
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const record = entry as Record<string, unknown>;
        const chatId = typeof record.chatId === "string" ? record.chatId : null;
        const title = typeof record.title === "string" ? record.title : null;
        if (!chatId || !title) {
          return [];
        }
        const participantLabels = Array.isArray(record.participantLabels)
          ? record.participantLabels.filter(
              (label): label is string => typeof label === "string" && label.trim().length > 0,
            )
          : [];
        return [
          {
            chatId,
            title,
            participantLabels,
            focused: record.focused === true,
          },
        ];
      });
    } catch {
      return [];
    }
  }

  private buildMessageModelEnvelope(
    content: string,
    meta: Record<string, unknown>,
    attachments: ChatSessionAsset[] = [],
  ): string {
    const participantLabels = this.parseMessageMetaLabelList(meta.chatParticipantLabels);
    const otherParticipantLabels = this.parseMessageMetaLabelList(meta.chatOtherParticipantLabels);
    const onlineLabels = this.parseMessageMetaLabelList(meta.chatOnlineParticipantLabels);
    const offlineLabels = this.parseMessageMetaLabelList(meta.chatOfflineParticipantLabels);
    const focusedLabels = this.parseMessageMetaLabelList(meta.chatFocusedParticipantLabels);
    const visibleRooms = this.parseMessageMetaRoomSummaries(meta.chatVisibleRoomSummaries);
    const socialContext = {
      channel: {
        chatId: typeof meta.chatId === "string" ? meta.chatId : null,
        title: typeof meta.chatTitle === "string" ? meta.chatTitle : null,
        kind: typeof meta.chatKind === "string" ? meta.chatKind : null,
        audience: typeof meta.chatAudience === "string" ? meta.chatAudience : null,
        participantCount:
          typeof meta.chatParticipantCount === "number" ? meta.chatParticipantCount : participantLabels.length || null,
        participants: participantLabels,
        otherParticipants: otherParticipantLabels,
      },
      perspective: {
        latestMessage: typeof meta.chatMessagePerspective === "string" ? meta.chatMessagePerspective : null,
        senderActorId: typeof meta.chatSenderActorId === "string" ? meta.chatSenderActorId : null,
        senderLabel: typeof meta.chatSenderLabel === "string" ? meta.chatSenderLabel : null,
        selfActorId: typeof meta.chatSelfActorId === "string" ? meta.chatSelfActorId : null,
        selfLabel: typeof meta.chatSelfLabel === "string" ? meta.chatSelfLabel : null,
        turnState: typeof meta.chatTurnState === "string" ? meta.chatTurnState : null,
      },
      obligation: {
        kind: typeof meta.chatObligationKind === "string" ? meta.chatObligationKind : null,
        settlesWhen:
          meta.chatObligationKind === "room_reply_pending" ? "required_room_reply_sent" : "no_external_reply_needed",
      },
      presence: {
        online: onlineLabels,
        offline: offlineLabels,
        focused: focusedLabels,
      },
      visibleRooms,
    };
    const attachmentFacts =
      attachments.length === 0
        ? []
        : [
            "attachments:",
            ...attachments.map(
              (attachment) =>
                `- ${attachment.kind}: ${attachment.name} (${attachment.mimeType}, ${attachment.sizeBytes} bytes)`,
            ),
          ];
    return [mdFence("yaml", toYaml(socialContext)), content, ...attachmentFacts].join("\n\n");
  }

  private async sendMessageTool(input: {
    chatId: string;
    content: string;
    ref?: number;
    from?: string;
    originAckFallback?: string;
  }): Promise<RuntimeMessageSendResult> {
    const channel = this.getActorRoom(input.chatId) ?? this.messageSystem.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const replyCycleId = this.activeCycleId;
    const author = input.from ?? this.getAvatarName();
    const originChatId = this.getOriginChatIdForCycle(replyCycleId);
    if (
      originChatId &&
      input.chatId !== originChatId &&
      !this.hasDeliveredRuntimeDispatchForCycle(originChatId, replyCycleId)
    ) {
      const originChannel = this.getActorRoom(originChatId) ?? this.messageSystem.getChannel(originChatId);
      const originAckFallback = input.originAckFallback?.trim();
      if (originChannel) {
        this.deliverRuntimeMessageDispatch({
          chatId: originChatId,
          content:
            originAckFallback && originAckFallback.length > 0
              ? originAckFallback
              : this.getMessageSendOriginAckFallback(),
          from: author,
          cycleId: replyCycleId,
        });
      }
    }
    return this.deliverRuntimeMessageDispatch({
      chatId: input.chatId,
      content: input.content,
      ref: input.ref,
      from: author,
      cycleId: replyCycleId,
    });
  }

  private async editMessageTool(input: {
    chatId: string;
    messageId: number;
    content: string;
  }): Promise<{ ok: boolean; messageId: number; updatedAt: number }> {
    const access = this.requireActorChannelWriteAccess(input.chatId);
    const message = this.messageSystem.editAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      messageId: input.messageId,
      content: input.content,
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
    const access = this.requireActorChannelWriteAccess(input.chatId);
    const message = this.messageSystem.recallAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      messageId: input.messageId,
    });
    if (!message.recalledAt) {
      throw new Error("message recall did not persist recalledAt");
    }
    return {
      ok: true,
      messageId: message.messageId,
      updatedAt: message.updatedAt,
      recalledAt: message.recalledAt,
    };
  }

  private requireActorChannelWriteAccess(chatId: string): { chatId: string; accessToken: string } {
    if (chatId === this.getDefaultChatId()) {
      this.requireDefaultChatChannel();
    }
    const actorChannel = this.getActorRoom(chatId);
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
    metadata?: Record<string, unknown>;
  }): MessageRecord {
    const access = this.requireActorChannelWriteAccess(input.chatId);
    return this.messageSystem.replyAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      senderActorId: this.messageActorId,
      ref: input.ref,
      from: input.from,
      content: input.content,
      metadata: input.metadata,
    });
  }

  private getMessageSendOriginAckFallback(): string {
    return this.config?.lang === "zh-Hans" ? "收到，我先处理一下。" : "Understood. I'll handle it and report back.";
  }

  private maybeAutoAcknowledgeOriginRoomForToolWork(command: string): void {
    const cycleId = this.activeCycleId;
    const originChatId = this.getOriginChatIdForCycle(cycleId);
    if (!originChatId || this.hasDeliveredRuntimeDispatchForCycle(originChatId, cycleId)) {
      return;
    }
    const originChannel = this.getActorRoom(originChatId) ?? this.messageSystem.getChannel(originChatId);
    if (!originChannel) {
      return;
    }
    this.deliverRuntimeMessageDispatch({
      chatId: originChatId,
      content: this.getMessageSendOriginAckFallback(),
      from: this.getAvatarName(),
      cycleId,
    });
  }

  private deliverRuntimeMessageDispatch(input: {
    chatId: string;
    content: string;
    ref?: number;
    from: string;
    cycleId: number | null;
  }): RuntimeMessageSendResult {
    const redundant = this.findRedundantVisibleReply({
      chatId: input.chatId,
      content: input.content,
      from: input.from,
    });
    if (redundant) {
      this.markRuntimeDispatchDelivered(input.chatId, input.cycleId);
      return this.buildRuntimeMessageSendResult({
        chatId: input.chatId,
        message: redundant,
      });
    }
    const message = this.appendActorChannelReply({
      chatId: input.chatId,
      ref: input.ref,
      from: input.from,
      content: input.content,
    });
    this.markRuntimeDispatchDelivered(input.chatId, input.cycleId);
    return this.buildRuntimeMessageSendResult({
      chatId: input.chatId,
      message,
    });
  }

  listMessageChannels(input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry[] {
    return this.listActorRooms({ includeArchived: input.includeArchived });
  }

  readMessageChannel(input: { chatId: string; limit?: number }): MessageSnapshot {
    const access = this.getActorRoom(input.chatId);
    if (!access?.accessToken) {
      throw new Error(`runtime actor has no grant for chat channel: ${input.chatId}`);
    }
    return this.messageSystem.snapshotAuthorized({
      chatId: access.chatId,
      accessToken: access.accessToken,
      limit: input.limit,
    });
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
      actorId: this.messageActorId,
    });
  }

  private listRecentMessageOverview(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
  }): RuntimeMessageOverviewItem[] {
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
    return projectRuntimeMessageOverview(this.readMessageChannel(input).items, input.limit);
  }

  private buildRuntimeMessageSendResult(input: {
    chatId: string;
    message: MessageRecord;
    accessToken?: string;
  }): RuntimeMessageSendResult {
    return {
      ok: true,
      messageId: input.message.messageId,
      recentMessages: this.listRecentMessageOverview({
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
    originAckFallback?: string;
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
      bootstrapActorId: this.messageActorId,
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
      this.messageSystem.focusForActor(this.messageActorId, "replace", [chatId]);
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
    this.messageSystem.focusForActor(this.messageActorId, "remove", [chatId]);
    return this.getActorRoom(chatId) ?? channel;
  }

  async focusMessageChannels(input: {
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<MessageControlPlaneEntry[]> {
    const focusedBefore = new Set(this.messageSystem.getFocusedChatIds(this.messageActorId));
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

  archiveMessageChannel(input: { chatId: string; accessToken: string; archivedBy?: string }): MessageControlPlaneEntry {
    const channel =
      this.getActorRoom(input.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const builtIn = Boolean(
      channel.metadata && typeof channel.metadata === "object" && channel.metadata.builtIn === true,
    );
    if (channel.chatId === this.getDefaultChatId() || builtIn) {
      throw new Error("built-in room is protected and cannot be archived");
    }
    const archived = this.messageSystem.archiveChannelAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      archivedBy: input.archivedBy ?? this.getAvatarName(),
    });
    this.enqueueRoomLifecycleAttentionCommit({
      chatId: archived.chatId,
      contextId: archived.contextId ?? this.getDefaultAttentionContextId(archived.chatId),
      event: "channel_archive",
      summary: `Archived chat channel ${archived.chatId}`,
      payload: {
        archivedAt: archived.archivedAt ?? Date.now(),
        channel: this.projectMessageChannelForAttention(archived),
      },
    });
    return archived;
  }

  deleteMessageChannel(input: { chatId: string; accessToken: string }): MessageControlPlaneEntry {
    const channel =
      this.getActorRoom(input.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const builtIn = Boolean(
      channel.metadata && typeof channel.metadata === "object" && channel.metadata.builtIn === true,
    );
    if (channel.chatId === this.getDefaultChatId() || builtIn) {
      throw new Error("built-in room is protected and cannot be deleted");
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
    return this.requireTerminalControlPlane().listForActor(this.terminalActorId);
  }

  async readRuntimeTerminal(input: {
    terminalId: string;
    mode?: TerminalReadMode;
    recordActivity?: boolean;
  }): Promise<TerminalReadPayload> {
    return await this.readTerminalRepresentation(input.terminalId, {
      mode: input.mode ?? "auto",
      remark: false,
      recordActivity: input.recordActivity ?? false,
    });
  }

  async writeRuntimeTerminal(input: {
    terminalId: string;
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
  }): Promise<{ ok: boolean; message: string }> {
    const controlPlane = this.requireTerminalControlPlane();
    if (!controlPlane.has(input.terminalId)) {
      return { ok: false, message: `unknown terminal: ${input.terminalId}` };
    }
    const submitGapMs = this.config?.terminals[input.terminalId]?.submitGapMs ?? 80;
    try {
      if (this.config?.terminals[input.terminalId]?.gitLog && !controlPlane.isRunning(input.terminalId)) {
        controlPlane.start(input.terminalId);
        await controlPlane.markDirty(input.terminalId);
      }
      const result = await controlPlane.write({
        terminalId: input.terminalId,
        text: input.text,
        submit: input.submit,
        submitKey: input.submitKey,
        submitGapMs,
        actorId: this.terminalActorId,
      });
      if (result.ok) {
        this.appendTerminalActivity({
          terminalId: input.terminalId,
          kind: "terminal_write",
          cycleId: this.activeCycleId,
          title: input.submit || input.submitKey ? "Terminal write + submit" : "Terminal write",
          content: result.eventId ? "" : input.text,
          detail: result.eventId
            ? this.createTerminalActivityRefDetail(input.terminalId, result.eventId, "terminal_write")
            : {
                submit: input.submit,
                submitKey: input.submitKey ?? null,
              },
        });
      }
      return { ok: result.ok, message: result.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `terminal write failed (${input.terminalId}): ${message}` });
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
        controlPlane.start(targetTerminalId);
        if (this.config.terminals[targetTerminalId]?.gitLog) {
          await controlPlane.markDirty(targetTerminalId);
        }
        this.terminalDirtyState[targetTerminalId] = false;
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
            env: buildRuntimeTerminalEnvironment({
              rootWorkspacePath: this.getRootWorkspacePath(),
              homeDir: this.getHomeDir(),
              apiBaseUrl: this.runtimeLocalApi.baseUrl,
              privateKey: this.options.avatarPrivateKey,
              principalId: this.options.avatarPrincipalId,
              env: input.profile?.env,
            }),
          },
        });
        const managed = controlPlane.getManagedTerminal(created.terminalId);
        if (managed) {
          this.attachRuntimeTerminal(created.terminalId, managed);
        }
        this.terminalDirtyState[created.terminalId] = false;
        createdTerminalId = created.terminalId;
      }

      await this.applyAttentionFocusState(
        this.getTerminalAttentionContextId(createdTerminalId),
        (input.focus ?? true) ? "focused" : "background",
      );

      this.enqueueTerminalLifecycleAttentionCommit({
        terminalId: createdTerminalId,
        contextId: this.getTerminalAttentionContextId(createdTerminalId),
        event: "terminal_create",
        summary: `Created terminal ${createdTerminalId}`,
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
    const result = await controlPlane.killAuthorized({
      terminalId,
      actorId: this.terminalActorId,
    });
    if (!result.ok) {
      return result;
    }
    this.terminals.delete(terminalId);
    delete this.terminalDirtyState[terminalId];
    delete this.terminalLatestSeq[terminalId];
    delete this.terminalSnapshots[terminalId];
    delete this.terminalReads[terminalId];
    this.dirtyQueue.delete(terminalId);
    if (this.config?.terminals[terminalId]) {
      delete this.config.terminals[terminalId];
      this.config.bootTerminals = this.config.bootTerminals.filter((entry) => entry.terminalId !== terminalId);
      if (this.config.primaryTerminalId === terminalId) {
        this.config.primaryTerminalId = Object.keys(this.config.terminals)[0] ?? this.config.primaryTerminalId;
      }
    }
    this.focusedTerminalIds = controlPlane.getFocusedTerminalIds(this.terminalActorId);
    this.emitFocusedTerminal();
    await this.applyAttentionFocusState(this.getTerminalAttentionContextId(terminalId), "background");
    this.enqueueTerminalLifecycleAttentionCommit({
      terminalId,
      contextId: this.getTerminalAttentionContextId(terminalId),
      event: "terminal_delete",
      summary: `Deleted terminal ${terminalId}`,
    });
    return result;
  }

  private resolveMessageRole(message: MessageRecord): ChatMessage["role"] {
    const metadata = message.metadata;
    if (
      metadata &&
      typeof metadata === "object" &&
      metadata.channel === "to_user" &&
      message.senderActorId === this.messageActorId
    ) {
      return "assistant";
    }
    return message.from === this.getAvatarName() ? "assistant" : "user";
  }

  private isInboundMessage(message: MessageRecord): boolean {
    return message.kind === "text" && this.resolveMessageRole(message) === "user";
  }

  private isUnreadInboundMessage(message: MessageRecord): boolean {
    return this.isInboundMessage(message) && message.unreadActorIds.includes(this.messageActorId);
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

  private hasUnreadRoomWork(): boolean {
    return this.messageSystem.getActorUnreadState(this.messageActorId).unreadTotal > this.pendingUnreadMessageIds.size;
  }

  private stageUnreadReadAck(ack: PendingUnreadReadAck): void {
    const existing = this.stagedUnreadReadAcks.find((candidate) => candidate.chatId === ack.chatId);
    if (!existing) {
      this.stagedUnreadReadAcks.push({
        ...ack,
        selectedMessageIds: [...ack.selectedMessageIds],
      });
      return;
    }
    existing.accessToken = ack.accessToken;
    existing.targetMessageId = ack.targetMessageId;
    existing.selectedMessageIds = [...new Set([...existing.selectedMessageIds, ...ack.selectedMessageIds])];
  }

  private releaseUnreadReadAcks(acks: readonly PendingUnreadReadAck[]): void {
    for (const ack of acks) {
      for (const messageId of ack.selectedMessageIds) {
        this.pendingUnreadMessageIds.delete(messageId);
      }
    }
  }

  private clearActiveCycleUnreadReadAcks(): void {
    if (!this.activeCycleUnreadReadCommitted) {
      this.releaseUnreadReadAcks(this.activeCycleUnreadReadAcks);
    }
    this.activeCycleUnreadReadAcks = [];
    this.activeCycleUnreadReadCommitted = false;
  }

  private consumeStagedUnreadReadAcks(): PendingUnreadReadAck[] {
    const staged = this.stagedUnreadReadAcks.map((ack) => ({
      ...ack,
      selectedMessageIds: [...ack.selectedMessageIds],
    }));
    this.stagedUnreadReadAcks = [];
    return staged;
  }

  private buildUnreadReadAck(
    channel: Pick<MessageControlPlaneEntry, "chatId" | "accessToken">,
    messages: readonly MessageRecord[],
    targetMessageId = messages[messages.length - 1]?.messageId,
  ): PendingUnreadReadAck | null {
    if (!channel.accessToken || !targetMessageId || messages.length === 0) {
      return null;
    }
    return {
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      targetMessageId,
      selectedMessageIds: messages.map((message) => message.messageId),
    };
  }

  private reserveUnreadMessages(
    channel: Pick<MessageControlPlaneEntry, "chatId" | "accessToken">,
    messages: readonly MessageRecord[],
    targetMessageId = messages[messages.length - 1]?.messageId,
  ): void {
    const ack = this.buildUnreadReadAck(channel, messages, targetMessageId);
    if (!ack) {
      return;
    }
    for (const messageId of ack.selectedMessageIds) {
      this.pendingUnreadMessageIds.add(messageId);
    }
    this.stageUnreadReadAck(ack);
  }

  private invalidatePluginForMessage(message: MessageRecord): void {
    if (!this.loopPluginRuntime) {
      return;
    }
    this.loopPluginRuntime.invalidate(
      this.createMessageSourceRef({
        chatId: message.chatId,
        messageId: message.messageId,
      }),
    );
  }

  private collectUnreadMessagesForRoom(chatId: string, limit: number): MessageRecord[] {
    const selected: MessageRecord[] = [];
    let before: ReverseTimeCursor | null = null;
    do {
      const page = this.messageSystem.queryMessages({
        chatId,
        before,
        limit: Math.max(limit * 3, 64),
      });
      selected.push(
        ...page.items.filter(
          (message) => this.isUnreadInboundMessage(message) && !this.pendingUnreadMessageIds.has(message.messageId),
        ),
      );
      before = page.nextBefore;
      if (selected.length >= limit) {
        break;
      }
    } while (before);
    return selected.slice(0, limit).reverse();
  }

  private collectUnreadRoomIngress(): void {
    if (this.isLoopPaused()) {
      return;
    }
    const roomLimit = this.getMaxFocusedRoomCount();
    const messageLimit = this.getMaxBatchReadRoomMessageCount();
    if (roomLimit <= 0 || messageLimit <= 0) {
      return;
    }

    const roomSelections = this.messageSystem
      .listUnreadRoomSummaries(this.messageActorId)
      .map((summary) => ({
        summary,
        channel: this.getActorRoom(summary.chatId, {
          includeArchived: true,
          touchPresence: false,
        }),
      }))
      .filter(
        (
          item,
        ): item is {
          summary: ReturnType<MessageControlPlane["listUnreadRoomSummaries"]>[number];
          channel: MessageControlPlaneEntry & { accessToken: string };
        } => item.channel?.accessToken !== undefined,
      )
      .sort((left, right) => {
        if (left.channel.focused !== right.channel.focused) {
          return left.channel.focused ? -1 : 1;
        }
        if ((left.summary.latestUnreadAt ?? 0) !== (right.summary.latestUnreadAt ?? 0)) {
          return (right.summary.latestUnreadAt ?? 0) - (left.summary.latestUnreadAt ?? 0);
        }
        if (left.summary.unreadCount !== right.summary.unreadCount) {
          return right.summary.unreadCount - left.summary.unreadCount;
        }
        return left.summary.chatId.localeCompare(right.summary.chatId);
      })
      .slice(0, roomLimit)
      .map((item) => ({
        channel: item.channel,
        messages: this.collectUnreadMessagesForRoom(item.channel.chatId, messageLimit),
      }))
      .filter((item) => item.messages.length > 0);

    if (roomSelections.length === 0) {
      return;
    }

    const compactSelections = roomSelections
      .map((item) => ({
        channel: item.channel,
        compactMessages: item.messages.filter((message) => message.content.trim() === "/compact"),
      }))
      .filter((item) => item.compactMessages.length > 0);
    if (compactSelections.length > 0) {
      for (const selection of compactSelections) {
        const targetMessageId = selection.compactMessages[selection.compactMessages.length - 1]?.messageId;
        this.reserveUnreadMessages(selection.channel, selection.compactMessages, targetMessageId);
      }
      this.queueCompactCycle("manual");
      return;
    }

    for (const selection of roomSelections) {
      this.reserveUnreadMessages(selection.channel, selection.messages);
      for (const message of selection.messages) {
        if (this.loopPluginRuntime) {
          this.invalidatePluginForMessage(message);
          continue;
        }
        this.inboundMessageQueue.push(this.toLoopInputFromMessage(message));
      }
    }
  }

  private commitActiveCycleUnreadReadAcks(): void {
    if (this.activeCycleUnreadReadCommitted || this.activeCycleUnreadReadAcks.length === 0) {
      return;
    }
    const acks = [...this.activeCycleUnreadReadAcks];
    this.activeCycleUnreadReadCommitted = true;
    this.releaseUnreadReadAcks(acks);
    for (const ack of acks) {
      try {
        this.messageSystem.markChannelReadAuthorized({
          chatId: ack.chatId,
          accessToken: ack.accessToken,
          messageId: ack.targetMessageId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("error", {
          message: `message unread ack failed (${ack.chatId}): ${message}`,
        });
      }
    }
  }

  private toLoopInputFromMessage(message: MessageRecord): LoopBusInput {
    const existingMeta =
      message.metadata && typeof message.metadata === "object"
        ? { ...(message.metadata as Record<string, string | number | boolean | null>) }
        : {};
    const channel =
      this.getActorRoom(message.chatId, { includeArchived: true }) ??
      this.messageSystem.getChannel(message.chatId, { includeArchived: true });
    const meta = this.buildMessageLoopMeta(message, channel, existingMeta);
    if (message.chatId) {
      meta.chatId = message.chatId;
    }
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
        const channel = this.messageSystem.getChannel(chatId);
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

  private bindTerminalSystem(): void {
    this.terminalSystemCleanup.push(
      this.terminalControlPlane.onFocus(({ actorId, terminalIds }) => {
        if (actorId !== this.terminalActorId) {
          return;
        }
        const next = this.normalizeFocusedTerminalIds(terminalIds);
        if (next.join("\u0000") === this.focusedTerminalIds.join("\u0000")) {
          return;
        }
        this.focusedTerminalIds = next;
        this.emitFocusedTerminal();
        this.invalidateFocusedTerminals("focus-sync");
      }),
    );
    this.terminalSystemCleanup.push(
      this.terminalControlPlane.onApprovalRequest(({ terminalId, request }) => {
        const isAdminWork = request.assignedAdminId === this.terminalActorId && request.status === "pending";
        const isRequesterUpdate = request.participantId === this.terminalActorId && request.status !== "pending";
        if (!isAdminWork && !isRequesterUpdate) {
          return;
        }
        this.enqueueTerminalLifecycleAttentionCommit({
          terminalId,
          contextId: this.getTerminalControlPlaneAttentionContextId(),
          event: isAdminWork ? "terminal_write_request" : "terminal_write_request_update",
          summary: isAdminWork
            ? `Terminal ${terminalId} has a pending write request`
            : `Terminal ${terminalId} write request is ${request.status}`,
          payload: {
            requestId: request.requestId,
            participantId: request.participantId,
            assignedAdminId: request.assignedAdminId ?? null,
            status: request.status,
            expiresAt: request.expiresAt,
            leaseId: request.leaseId ?? null,
          },
        });
        this.notifyInput("attention");
      }),
    );
  }

  private createTerminalSourceRef(
    terminalId: string,
    reason: string,
    versionHint?: string | number,
  ): LoopTerminalSourceRef {
    return {
      src: formatTerminalSourceSrc({
        terminalId,
        eventId: typeof versionHint === "number" ? versionHint : undefined,
      }),
      reason,
      versionHint,
    };
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
    const recent = this.messageSystem.queryMessages({ chatId: input.chatId, limit: 16 }).items;
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
    if (trace.some((entry) => entry.tool === "root_workspace_bash")) {
      return "act";
    }
    if (trace.some((entry) => entry.tool === "root_workspace_list")) {
      return "observe";
    }
    return "decide";
  }

  private createAgentToolProviders(): AgentToolProvider[] {
    return [this.createRootWorkspaceToolProvider()];
  }

  private listRootWorkspaceToolCommands(): string[] {
    return ["attention", "message", "workspace", "terminal", "ccski", "tool"];
  }

  private projectRuntimeWorkspaceList(): RuntimeWorkspaceSurface[] {
    return this.listWorkspaceAuthorities().map((entry) => projectRuntimeWorkspaceSurface(entry));
  }

  private async ensureRuntimeLocalApiStarted(): Promise<void> {
    if (this.runtimeLocalApi || !this.options.avatarPrincipalId) {
      return;
    }
    if (!this.options.avatarPrivateKey) {
      throw new Error("runtime avatar private key missing");
    }
    this.runtimeLocalApi = await startRuntimeLocalApi({
      expectedPrincipalId: this.options.avatarPrincipalId,
      handlers: {
        attentionList: () => this.attentionSystem.listContexts(),
        attentionActive: () => this.attentionSystem.listActiveContexts().map(projectRuntimeAttentionActiveMatch),
        attentionQuery: async (input) => (await this.queryAttention(input)).map(projectAttentionCommitMatchForModel),
        attentionCommit: async (input) => {
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
          this.markAttentionContextDirty(input.contextId);
          this.emitAttentionState();
          this.notifyInput("attention");
          return commit;
        },
        messageList: (input) => this.listMessageChannelsForTooling(input),
        messageRead: (input) => this.readMessageChannelForTooling(input),
        messageQuery: async (input) => await this.queryRuntimeMessages(input),
        messageSend: async (input) => await this.sendRuntimeMessage(input),
        messageEdit: async (input) => await this.editRuntimeMessage(input),
        messageRecall: async (input) => await this.recallRuntimeMessage(input),
        workspaceList: () => this.projectRuntimeWorkspaceList(),
        terminalList: () => this.listRuntimeTerminals().map(projectRuntimeTerminal),
        terminalCreate: async (input) => {
          const result = await this.createRuntimeTerminal(input);
          return result.terminal ? { ...result, terminal: projectRuntimeTerminal(result.terminal) } : result;
        },
        terminalRead: async (input) => await this.readRuntimeTerminal(input),
        terminalWrite: async (input) => await this.writeRuntimeTerminal(input),
        terminalFocus: async (input) => await this.focusRuntimeTerminals(input),
        terminalKill: async (input) => await this.deleteRuntimeTerminal(input.terminalId),
      },
    });
  }

  private async execRootWorkspaceBash(input: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }): Promise<RootWorkspaceBashExecResult> {
    await this.ensureRuntimeLocalApiStarted();
    this.maybeAutoAcknowledgeOriginRoomForToolWork(input.command);
    if (!this.runtimeLocalApi || !this.options.avatarPrivateKey) {
      throw new Error("runtime local api unavailable");
    }
    return await executeRootWorkspaceBash({
      rootWorkspacePath: this.getRootWorkspacePath(),
      command: input.command,
      cwd: input.cwd,
      env: {
        HOME: this.getRootWorkspacePath(),
        [RUNTIME_API_BASE_URL_ENV]: this.runtimeLocalApi.baseUrl,
        [RUNTIME_HOME_DIR_ENV]: this.getHomeDir(),
        [RUNTIME_PRINCIPAL_ID_ENV]: this.options.avatarPrincipalId ?? "",
        [RUNTIME_PRIVATE_KEY_ENV]: this.options.avatarPrivateKey,
        [RUNTIME_ROOT_WORKSPACE_ENV]: this.getRootWorkspacePath(),
        ...(input.env ?? {}),
      },
      stdin: input.stdin,
      mounts: [
        ...this.getRootWorkspaceSkillMounts(),
        ...this.listWorkspaceAuthorities().map((entry) => {
          const mode: RootWorkspaceMountInput["mode"] = entry.grants.some((grant) => grant.mode === "rw") ? "rw" : "ro";
          const avatar = this.options.avatar ?? this.config?.avatar.nickname ?? "default";
          return {
            path: entry.mount.workspacePath,
            mode,
            grants: entry.grants,
            hiddenPaths: listWorkspaceHiddenPrivatePaths({
              workspacePath: entry.mount.workspacePath,
              avatar,
            }),
          };
        }),
      ],
      customCommands: createRuntimeShellCommands({
        baseUrl: this.runtimeLocalApi.baseUrl,
        privateKey: this.options.avatarPrivateKey,
        homeDir: this.getHomeDir(),
        rootWorkspacePath: this.getRootWorkspacePath(),
        principalId: this.options.avatarPrincipalId,
      }),
    });
  }

  private createRootWorkspaceToolProvider(): AgentToolProvider {
    return {
      name: "root-workspace",
      createTools: ({ traceTool }) => {
        const traceWithContext = <TInput, TOutput>(
          toolName: string,
          input: TInput,
          handler: () => Promise<TOutput>,
          context?: { toolCallId?: string },
        ): Promise<TOutput> => traceTool(toolName, input, handler, { invocationId: context?.toolCallId });

        const listTool = toolDefinition({
          name: "root_workspace_list",
          description: "List the fixed avatar root workspace, mounted workspaces, grants, and shell commands.",
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (_rawInput, context) =>
          traceWithContext(
            "root_workspace_list",
            {},
            async () => ({
              rootWorkspace: {
                path: this.getRootWorkspacePath(),
                commandNames: this.listRootWorkspaceToolCommands(),
                toolNames: this.getRootWorkspaceToolFiles(),
                skillRoots: this.getRootWorkspaceSkillRoots(),
              },
              attentionApi: this.runtimeLocalApi
                ? {
                    baseUrl: this.runtimeLocalApi.baseUrl,
                    principalId: this.options.avatarPrincipalId ?? null,
                  }
                : null,
              workspaces: this.projectRuntimeWorkspaceList(),
            }),
            context,
          ),
        );

        const bashTool = toolDefinition({
          name: "root_workspace_bash",
          description:
            "Execute bash inside the fixed avatar root workspace with real absolute paths and in-shell CLI commands.",
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
            "root_workspace_bash",
            parsed,
            async () => await this.execRootWorkspaceBash(parsed),
            context,
          );
        });

        return [listTool, bashTool];
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
    return match.contextId.startsWith("ctx-task-") || match.recentCommits.some((commit) => parseTaskSourceSrc(commit.meta.src ?? "") !== null);
  }

  private isWorkspaceAttentionContext(match: AttentionActiveContextMatch): boolean {
    return (
      match.contextId.startsWith("ctx-workspace-") ||
      match.recentCommits.some((commit) => commit.meta.source === "workspace")
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
    if (this.isWorkspaceAttentionContext(match)) {
      return "workspace";
    }
    const latestSource = match.recentCommits.find((commit) => typeof commit.meta.source === "string")?.meta.source;
    return latestSource ?? "attention";
  }

  private buildAttentionContextBootstrapInput(
    active: readonly AttentionActiveContextMatch[],
    selected: readonly AttentionActiveContextMatch[],
  ): LoopBusInput | null {
    const primary = selected[0];
    if (!primary) {
      return null;
    }
    const metadata = active.map((match) => ({
      contextId: match.contextId,
      source: this.resolveAttentionSourceSystemId(match),
      focusState: match.context.focusState,
      scoreSum: Object.values(match.context.scoreMap).reduce((sum, value) => sum + Math.max(0, value), 0),
      headCommitId: match.context.headCommitId,
      owner: match.context.owner,
      updatedAt: match.context.updatedAt,
    }));
    const text = [
      "## AttentionContexts.metadata",
      "",
      toYaml({
        primaryContextId: primary.contextId,
        selectedContextIds: selected.map((match) => match.contextId),
        activeContextCount: active.length,
        items: metadata,
      }),
    ].join("\n");

    const channel = this.resolveMessageChannelForContext(primary.contextId);
    const chatId = channel?.chatId ?? this.resolveMessageChatIdForContext(primary.contextId);
    const attentionContextIds = metadata.map((item) => item.contextId);

    return {
      name: `AttentionContext-${primary.contextId}`,
      role: "user",
      type: "text",
      source: "attention",
      text,
      meta: {
        attentionContextId: primary.contextId,
        attentionContextIds: serializeAttentionContextIds(attentionContextIds) ?? null,
        attentionCommitRefs: null,
        attentionHeadCommitId: primary.context.headCommitId,
        owner: primary.context.owner,
        createdAt: primary.context.updatedAt,
        attentionProtocolKind: "context",
        ...(channel ? { chatFocused: channel.focused } : {}),
        ...(chatId ? { chatId } : {}),
      },
    };
  }

  private buildAttentionItemsInput(selected: readonly AttentionActiveContextMatch[]): LoopBusInput | null {
    const primary = selected[0];
    if (!primary) {
      return null;
    }
    const protocolState = this.buildAttentionProtocolState();
    const items = selected.flatMap((match) => {
      const cursorCommitId = protocolState.get(match.contextId)?.lastSeenCommitId ?? null;
      return this.selectAttentionProtocolCommits(match, cursorCommitId).map((commit) => ({
        contextId: match.contextId,
        commit,
      }));
    });
    if (items.length === 0) {
      return null;
    }
    const attentionContextIds = [...new Set(items.map((item) => item.contextId))];
    const attentionCommitRefs = items.map((item) => ({
      contextId: item.contextId,
      commitId: item.commit.commitId,
    }));
    const channel = this.resolveMessageChannelForContext(primary.contextId);
    const chatId = channel?.chatId ?? this.resolveMessageChatIdForContext(primary.contextId);
    const primaryUpdatedAt = Date.parse(primary.context.updatedAt);
    const latestCreatedAt = items.reduce(
      (maxCreatedAt, item) => Math.max(maxCreatedAt, Date.parse(item.commit.createdAt)),
      Number.isFinite(primaryUpdatedAt) ? primaryUpdatedAt : 0,
    );
    return {
      name: `AttentionItems-${primary.contextId}`,
      role: "user",
      type: "text",
      source: "attention",
      text: this.serializeAttentionItemsInput(items),
      meta: {
        attentionContextId: primary.contextId,
        attentionContextIds: serializeAttentionContextIds(attentionContextIds) ?? null,
        attentionCommitRefs: serializeAttentionCommitRefs(attentionCommitRefs) ?? null,
        attentionHeadCommitId: primary.context.headCommitId,
        owner: primary.context.owner,
        createdAt: latestCreatedAt,
        attentionProtocolKind: "items",
        ...(channel ? { chatFocused: channel.focused } : {}),
        ...(chatId ? { chatId } : {}),
      },
    };
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
    const channel = actorRoom ?? this.messageSystem.getChannel(chatId);
    const content = message?.content ?? result.content;
    if (content.trim().length === 0 || content.trim() === "/compact") {
      return [];
    }
    const from = message?.from ?? channel?.title ?? chatId;
    const attachments =
      message?.attachments?.map((attachment) => ({
        assetId: attachment.assetId,
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: attachment.url,
      })) ?? [];
    const socialMeta =
      message && channel
        ? this.buildMessageLoopMeta(
            message,
            channel,
            message.metadata && typeof message.metadata === "object"
              ? (message.metadata as Record<string, string | number | boolean | null>)
              : {},
          )
        : {};
    const envelopeMeta = {
      ...socialMeta,
      chatId,
      chatTitle: channel?.title ?? chatId,
      chatKind: channel?.kind ?? "direct",
      chatContextId: channel?.contextId ?? this.getDefaultAttentionContextId(chatId),
      chatFocused: channel?.focused ?? false,
      messageId: message?.messageId ?? sourceMessageId,
      visibleAt: message?.visibleAt ?? message?.createdAt ?? null,
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
          body: this.buildMessageModelEnvelope(content, envelopeMeta, attachments),
          bodyFormat: "text/markdown",
          changeType: "update",
        },
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
    let invalidated = false;
    for (const terminalId of this.focusedTerminalIds) {
      if (!this.terminalDirtyState[terminalId]) {
        continue;
      }
      const terminal = this.terminals.get(terminalId);
      if (!terminal?.isRunning()) {
        continue;
      }
      this.dirtyQueue.add(terminalId);
      this.loopPluginRuntime?.invalidate(
        this.createTerminalSourceRef(terminalId, reason, this.terminalLatestSeq[terminalId]),
      );
      invalidated = true;
    }
    if (invalidated) {
      this.notifyInput("terminal");
    }
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
    const explicitMessageSource = typeof draft.provenance?.src === "string" ? parseMessageSourceSrc(draft.provenance.src) : null;
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

  private buildAttentionCommitInput(draft: AttentionDraft): AttentionCommitToolInput {
    const contextId = this.resolveAttentionContextId(draft);
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
      ingressType: this.resolveAttentionIngressType(contextId),
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

  private enqueueLifecycleAttentionCommit(input: Parameters<SessionRuntime["commitLifecycleAttentionItem"]>[0]): void {
    void this.commitLifecycleAttentionItem(input).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `lifecycle attention commit failed: ${message}` });
    });
  }

  private enqueueRoomLifecycleAttentionCommit(
    input: Omit<Parameters<SessionRuntime["commitLifecycleAttentionItem"]>[0], "src"> & { chatId: string },
  ): void {
    this.enqueueLifecycleAttentionCommit({
      ...input,
      src: formatMessageAttentionSrc({ chatId: input.chatId }),
    });
  }

  private enqueueTerminalLifecycleAttentionCommit(
    input: Omit<Parameters<SessionRuntime["commitLifecycleAttentionItem"]>[0], "src"> & { terminalId: string },
  ): void {
    this.enqueueLifecycleAttentionCommit({
      ...input,
      src: formatTerminalSourceSrc({ terminalId: input.terminalId }),
    });
  }

  private async commitLifecycleAttentionItem(input: {
    src: string;
    contextId: string;
    event: string;
    summary: string;
    payload?: Record<string, unknown>;
    score?: number;
    ingressType?: "commit" | "push";
  }): Promise<void> {
    const context = this.attentionSystem.getContext(input.contextId);
    if (!context) {
      this.attentionSystem.createContext({
        contextId: input.contextId,
        owner: this.getAvatarName(),
      });
    }
    const bridgeId = resolveLifecycleBridgeId(input.src);
    const scoreToken = this.attentionHashAliases.ensureTokenForDigest(
      buildAttentionScoreDigest(`lifecycle:${input.src}:${input.event}`),
    );
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
    const commit = this.attentionSystem.commit(input.contextId, {
      ingressType: input.ingressType ?? "commit",
      meta: {
        author: this.getAvatarName(),
        source: "lifecycle",
        src: input.src,
        tags: ["lifecycle", input.event],
        createdAt: new Date().toISOString(),
      },
      scores: { [scoreToken]: score },
      summary: input.summary,
      change: {
        type: "update",
        value: mdFence("yaml", detail),
        format: "text/markdown",
      },
    }).commit;
    await this.handleCommittedAttentionCommit(input.contextId, commit, { notifyLoop: true });
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
    if (wakeableAttentionIngress) {
      this.markAttentionContextDirty(contextId);
    }
    this.recordAttentionCommitTrace(contextId, commit, input);
    this.attentionFactsVersion += 1;
    const externalAttentionIngress = commit.meta.source !== "attention";
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

  private async commitAttentionDrafts(drafts: AttentionDraft[]): Promise<boolean> {
    if (drafts.length === 0) {
      return false;
    }
    let changed = false;
    for (const draft of drafts) {
      const digest = stableAttentionDraftDigest(draft);
      const sourceKey = draft.sourceRef.src;
      if (this.attentionSourceDigests.get(sourceKey) === digest) {
        continue;
      }
      this.attentionSourceDigests.set(sourceKey, digest);
      const contextId = this.resolveAttentionContextId(draft);
      this.supersedeAttentionDraftItems(draft, contextId);
      const commitInput = this.buildAttentionCommitInput(draft);
      const { commit } = this.attentionSystem.commit(contextId, {
        parentCommitIds: commitInput.parentCommitIds,
        meta: commitInput.meta,
        scores: commitInput.scores,
        summary: commitInput.summary,
        change: commitInput.change,
      });
      this.recordDraftSourceReadTrace(draft, commitInput.contextId, commit.commitId);
      await this.handleCommittedAttentionCommit(commitInput.contextId, commit, { notifyLoop: false });
      changed = true;
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

  private emitAttentionState(): void {
    this.emit("attentionUpdated", this.buildAttentionRuntimePreviewState());
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

  private buildAttentionProtocolState(): Map<string, { bootstrapped: boolean; lastSeenCommitId: string | null }> {
    const state = new Map<string, { bootstrapped: boolean; lastSeenCommitId: string | null }>();
    const frames = [...this.attentionCycleFrames.values()].sort(
      (left, right) => left.seq - right.seq || left.cycleId - right.cycleId,
    );

    const ensure = (contextId: string) => {
      const existing = state.get(contextId);
      if (existing) {
        return existing;
      }
      const next = { bootstrapped: false, lastSeenCommitId: null as string | null };
      state.set(contextId, next);
      return next;
    };

    for (const frame of frames) {
      if (frame.protocolMode === "compact" || frame.protocolMode === "none") {
        continue;
      }
      for (const contextId of frame.inputContextIds) {
        ensure(contextId).bootstrapped = true;
      }
      for (const ref of [...frame.inputCommitRefs, ...frame.producedCommitRefs]) {
        const entry = ensure(ref.contextId);
        entry.bootstrapped = true;
        entry.lastSeenCommitId = ref.commitId;
      }
    }

    return state;
  }

  private selectAttentionProtocolCommits(
    match: AttentionActiveContextMatch,
    cursorCommitId: string | null,
  ): AttentionCommit[] {
    const context = this.attentionSystem.getContext(match.contextId);
    const allCommits = context?.listCommits() ?? match.recentCommits;
    if (allCommits.length === 0) {
      return [];
    }
    const cursorIndex =
      cursorCommitId === null ? -1 : allCommits.findIndex((commit) => commit.commitId === cursorCommitId);
    let commits = allCommits.slice(cursorIndex + 1);
    if (commits.length === 0) {
      commits = allCommits.slice(-1);
    }
    if (commits.length > MAX_ATTENTION_PROTOCOL_COMMITS) {
      commits = commits.slice(-MAX_ATTENTION_PROTOCOL_COMMITS);
    }
    return commits;
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
            scores: { ...commit.scores },
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
    this.messageSystem.setActorPresence(this.messageActorId, true);
    this.terminalControlPlane.setActorPresence(this.terminalActorId, true);
    this.config = await resolveSessionConfig(this.options.cwd, {
      avatar: this.options.avatar,
      homeDir: this.getHomeDir(),
    });
    this.focusedTerminalIds = this.requireTerminalControlPlane().getFocusedTerminalIds(this.terminalActorId);
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
    this.attentionSearchEngine = new AttentionSearchEngine(join(this.options.sessionRoot, "attention-search.duckdb"));
    await this.persistAttentionSystem();
    if (this.attentionSystem.listActiveContexts().length > 0) {
      this.attentionFactsVersion += 1;
      this.resetAttentionDebtBackoff();
      this.notifyInput("attention");
    }
    if (this.messageSystemCleanup.length === 0) {
      this.bindMessageSystem();
    }
    if (this.terminalSystemCleanup.length === 0) {
      this.bindTerminalSystem();
    }
    this.settingsEditor = new SettingsEditor(this.config.agentCwd, {
      agenterPath: this.config.prompt.agenterPath,
      agenterSystemPath: this.config.prompt.agenterSystemPath,
      systemTemplatePath: this.config.prompt.systemTemplatePath,
      responseContractPath: this.config.prompt.responseContractPath,
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
    this.runtimeSkills = listRuntimeSkills({
      homeDir: this.getHomeDir(),
      rootWorkspacePath: this.getRootWorkspacePath(),
      principalId: this.options.avatarPrincipalId,
    });
    this.runtimeSkillsList = buildRuntimeSkillsList(this.runtimeSkills);

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
        primaryRoomId: this.options.primaryRoomId,
        storeTarget: this.options.storeTarget,
      },
    });
    this.sessionStore = sessionStore;
    this.sessionDb = new SessionDb(join(this.options.sessionRoot, "session.db"));
    this.usageAnalyticsDb = this.options.usageAnalyticsRoot
      ? new UsageAnalyticsDb(resolveUsageAnalyticsDbPathFromAvatarRoot(this.options.usageAnalyticsRoot))
      : null;
    const currentPromptWindowState = this.ensurePromptWindowStateInitialized();
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
      collectInterleavedInputs: async () => await this.collectInterleavedAgentInputs(),
      onAssistantStream: (stream) => {
        this.handleAssistantStreamUpdate(stream);
      },
      onModelCall: async (record) => {
        await this.handleModelCall(record);
      },
      logger: this.options.logger ?? { log: () => {} },
      locale: this.config.lang,
      skillsList: this.runtimeSkillsList,
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
          await terminal.markDirty();
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
    // Wake commit waiters so the paused loop can settle without waiting for new external input.
    this.notifyInput("attention");
    if (status === "stopped") {
      this.messageSystem.setActorPresence(this.messageActorId, false);
      this.terminalControlPlane.setActorPresence(this.terminalActorId, false);
    }
    this.sessionStore?.setLifecycle({ status });
  }

  resume(): void {
    if (!this.started) {
      return;
    }
    this.messageSystem.setActorPresence(this.messageActorId, true);
    this.terminalControlPlane.setActorPresence(this.terminalActorId, true);
    this.runtime?.resume();
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
    this.loopPluginRuntime = null;
    await this.runtimeLocalApi?.stop().catch(() => {});
    this.runtimeLocalApi = null;
    this.runtimeSkills = [];
    this.runtimeSkillsList = "";
    this.messageSystem.setActorPresence(this.messageActorId, false);
    this.terminalControlPlane.setActorPresence(this.terminalActorId, false);
    this.sessionStore?.setLifecycle({ status: "stopped" });
    this.apiCallRecordingRefCount = 0;

    this.terminals.clear();
    this.taskAttentionDraftQueue.length = 0;
    this.inboundMessageQueue.length = 0;
    this.pendingUnreadMessageIds.clear();
    this.stagedUnreadReadAcks = [];
    this.activeCycleUnreadReadAcks = [];
    this.activeCycleUnreadReadCommitted = false;
    this.taskSourceMtime.clear();
    this.taskSources = [];
    for (const terminalId of Object.keys(this.terminalSnapshots)) {
      delete this.terminalSnapshots[terminalId];
    }
    for (const terminalId of Object.keys(this.terminalReads)) {
      delete this.terminalReads[terminalId];
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
    this.dirtyAttentionContextOrder.clear();
    this.nextAttentionDirtyOrder = 0;
    this.attentionContainment.clear();
    this.lastAttentionProgressAt = null;
    this.pendingTraceSpans.length = 0;
    this.traceRowIdBySpanId.clear();
    this.runningTraceRowsByName.clear();
    this.started = false;
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
            maxRetries: this.config.ai.maxRetries,
            maxToken: this.config.ai.maxToken,
            maxContextTokens: this.config.ai.maxContextTokens,
            compactThreshold: this.config.ai.compactThreshold,
            thinking: this.config.ai.thinking,
            capabilities: resolveModelCapabilities(this.config.ai),
          }
        : null,
      promptWindow: this.readDurablePromptWindow(),
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

  inspectNotificationState(): SessionNotificationSnapshot {
    return projectSessionNotificationSnapshot({
      sessionId: this.options.sessionId,
      workspacePath: this.options.cwd,
      sessionName: this.options.sessionName,
      attention: this.attentionSystem.snapshot(),
    });
  }

  async setChatVisibility(input: {
    chatId?: string;
    visible: boolean;
    focused: boolean;
  }): Promise<SessionNotificationSnapshot> {
    const chatId = input.chatId ?? this.getDefaultChatId();
    const contextId = this.ensureAttentionContextForChannel(chatId).contextId;
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
        join(this.options.sessionRoot, "attention-search.duckdb"),
      ));
    return await engine.query({
      attentionSystem: this.attentionSystem,
      snapshot: this.attentionSystem.snapshot(),
      request: input,
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
    return ["settings", "agenter", "system", "template", "contract"];
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
      homeDir: this.getHomeDir(),
    });
    const promptStore = this.createPromptStore(nextConfig);
    await promptStore.reload();
    this.config = nextConfig;
    this.settingsEditor = new SettingsEditor(nextConfig.agentCwd, nextConfig.prompt);
    await this.reloadSettingsLayers(nextConfig);
    this.agent?.setModelClient(this.createModelClient(nextConfig));
    this.agent?.setPromptStore(promptStore);
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

  sendMessageChannel(input: {
    chatId: string;
    accessToken: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): RuntimeMessageSendResult {
    const channel = this.messageSystem.getChannel(input.chatId);
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
    return this.buildRuntimeMessageSendResult({
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
    const message = this.messageSystem.editAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      messageId: input.messageId,
      content: input.text,
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
    const message = this.messageSystem.recallAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      messageId: input.messageId,
    });
    if (!message.recalledAt) {
      throw new Error("message recall did not persist recalledAt");
    }
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
    const channel = this.messageSystem.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const attachments = this.resolveChatAttachments(input.assetIds ?? []);
    return this.messageSystem.send({
      chatId: input.chatId,
      from: "User",
      kind: "text",
      content: input.text,
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
    const channel = this.messageSystem.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    this.messageSystem.sendErrorAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      from: this.getAvatarName(),
      kind: "error",
      content: input.content,
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
    const channel = this.messageSystem.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    this.messageSystem.sendInteractiveAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      from: this.getAvatarName(),
      kind: "interactive",
      content: input.content,
      payload: {
        interactive: input.interactive,
      },
      metadata: {
        source: "interactive",
        ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
      },
    });
  }

  pushUserChat(text: string, assetIds: string[] = [], clientMessageId?: string): void {
    const isCompactCommand = text.trim() === "/compact";
    if (isCompactCommand) {
      this.queueCompactCycle("manual");
    }

    const channel = this.requireDefaultChatChannel();
    const message = this.appendLocalUserChatMessage({
      chatId: channel.chatId,
      text,
      assetIds,
      clientMessageId,
    });
    if (!this.isUnreadInboundMessage(message) || !channel.accessToken) {
      return;
    }

    if (isCompactCommand) {
      this.reserveUnreadMessages(channel, [message]);
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
      return {
        terminalId: planeEntry.terminalId,
        running: managed?.isRunning() ?? planeEntry.running,
        status: managed?.getStatus() ?? planeEntry.status,
        seq: snapshot?.seq ?? 0,
        cwd: planeEntry.cwd,
        icon: planeEntry?.icon,
        title: planeEntry?.title,
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
          }
        : null,
      rootWorkspace: this.options.rootWorkspacePath
        ? {
            path: this.getRootWorkspacePath(),
            commandNames: this.listRootWorkspaceToolCommands(),
            toolNames: this.getRootWorkspaceToolFiles(),
            skillRoots: this.getRootWorkspaceSkillRoots(),
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

      const snapshotPayload = buildTerminalSnapshotPayload(terminalId, terminal.getSnapshot(), terminal.getStatus());
      const snapshotJson = JSON.stringify(snapshotPayload);

      if (config.gitLog && input.mode !== "snapshot") {
        const slice = await terminal.sliceDirty({
          remark: input.remark,
          wait: false,
        });
        if (slice.ok && slice.changed && slice.fromHash !== slice.toHash) {
          const diffPayload = buildTerminalDiffPayload(terminalId, {
            fromHash: slice.fromHash,
            toHash: slice.toHash,
            diff: slice.diff,
            bytes: slice.bytes,
            status: terminal.getStatus(),
          });
          const shouldUseDiff =
            input.mode === "diff" ||
            (input.mode === "auto" && JSON.stringify(diffPayload).length <= snapshotJson.length);
          if (shouldUseDiff) {
            if (input.remark) {
              this.terminalDirtyState[terminalId] = false;
              this.dirtyQueue.delete(terminalId);
            }
            return this.publishTerminalReadPayload(terminalId, diffPayload, recordActivity);
          }
        }
      }

      if (input.remark) {
        this.terminalDirtyState[terminalId] = false;
        this.dirtyQueue.delete(terminalId);
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
      this.terminalDirtyState[terminalId] = false;
      this.dirtyQueue.delete(terminalId);
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
          env: buildRuntimeTerminalEnvironment({
            rootWorkspacePath: this.getRootWorkspacePath(),
            homeDir: this.getHomeDir(),
            apiBaseUrl: this.runtimeLocalApi.baseUrl,
            privateKey: this.options.avatarPrivateKey,
            principalId: this.options.avatarPrincipalId,
          }),
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

  private attachRuntimeTerminal(terminalId: string, terminal: ManagedTerminal): void {
    if (this.terminals.has(terminalId)) {
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
        this.terminalDirtyState[terminalId] = true;
        if (this.focusedTerminalIds.includes(terminalId)) {
          this.dirtyQueue.add(terminalId);
          this.loopPluginRuntime?.invalidate(this.createTerminalSourceRef(terminalId, "semantic-change", snapshot.seq));
          this.notifyInput("terminal");
        }
      }
      if (viewChanged) {
        this.emit("terminalSnapshot", { terminalId, snapshot });
      }
    });

    terminal.onStatus((running, status) => {
      const previous = this.terminalStatusById.get(terminalId);
      this.terminalStatusById.set(terminalId, { running, status });
      this.emit("terminalStatus", { terminalId, running, status });
      if (
        previous?.status === "BUSY" &&
        status === "IDLE" &&
        running &&
        !this.focusedTerminalIds.includes(terminalId)
      ) {
        this.enqueueTerminalLifecycleAttentionCommit({
          terminalId,
          contextId: this.getTerminalAttentionContextId(terminalId),
          event: "terminal_idle_ready",
          summary: `Terminal ${terminalId} is ready for your input.`,
          ingressType: "push",
          payload: {
            running,
            status,
          },
          score: 100,
        });
      }
    });

    this.terminals.set(terminalId, terminal);
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

  private getAttentionContainmentBackoffMs(retryCount: number): number {
    const steps = Math.max(0, retryCount - 1);
    return Math.min(
      ATTENTION_DEBT_MAX_BACKOFF_MS,
      Math.round(ATTENTION_DEBT_INITIAL_BACKOFF_MS * ATTENTION_DEBT_BACKOFF_MULTIPLIER ** steps),
    );
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

  private clearAttentionContainmentMany(contextIds: Iterable<string>): void {
    for (const contextId of contextIds) {
      this.clearAttentionContainment(contextId);
    }
  }

  private markAttentionProgress(contextIds: Iterable<string>): void {
    this.clearAttentionContainmentMany(contextIds);
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
    this.pruneAttentionContainment(active);
    let hasReady = false;
    let nextWakeAt: number | null = null;
    let retryCount = 0;

    for (const match of active) {
      const entry = this.attentionContainment.get(match.contextId);
      if (!entry) {
        hasReady = true;
        continue;
      }
      retryCount = Math.max(retryCount, entry.retryCount);
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
      };
    }
    if (nextWakeAt !== null) {
      return {
        state: "backoff",
        nextWakeAt,
        retryCount,
      };
    }
    return {
      state: "none",
      nextWakeAt: null,
      retryCount: 0,
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

  private markAttentionContextDirty(contextId: string): void {
    this.dirtyAttentionContextIds.add(contextId);
    this.dirtyAttentionContextOrder.set(contextId, ++this.nextAttentionDirtyOrder);
  }

  private clearDirtyAttentionContext(contextId: string): void {
    this.dirtyAttentionContextIds.delete(contextId);
    this.dirtyAttentionContextOrder.delete(contextId);
  }

  private resolveAttentionCollectionPriority(match: AttentionActiveContextMatch): number {
    if (this.resolveMessageChatIdForContext(match.contextId)) {
      return 3;
    }
    if (match.contextId.startsWith("ctx-task-")) {
      return 2;
    }
    if (match.contextId.startsWith("ctx-terminal-")) {
      return 0;
    }
    return 1;
  }

  private selectDirtyAttentionContexts(active: AttentionActiveContextMatch[]): AttentionActiveContextMatch[] {
    const activeById = new Map(active.map((match) => [match.contextId, match] as const));
    return [...this.dirtyAttentionContextOrder.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([contextId]) => activeById.get(contextId) ?? null)
      .filter((match): match is AttentionActiveContextMatch => match !== null)
      .slice(0, 1);
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
    return this.dirtyAttentionContextIds.size > 0;
  }

  private resetAttentionDebtBackoff(): void {
    this.attentionDebtBackoffMs = ATTENTION_DEBT_INITIAL_BACKOFF_MS;
    this.attentionDebtNextWakeAt = null;
    this.attentionForceCollect = false;
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
    if (this.focusedTerminalIds.some((terminalId) => this.terminalDirtyState[terminalId])) {
      return "ready_now";
    }
    if (this.hasPendingAttentionInputs()) {
      return "ready_now";
    }
    const activeAttention = this.attentionSystem.listActiveContexts();
    if (activeAttention.length > 0) {
      const containment = this.summarizeAttentionContainment(activeAttention);
      if (containment.state === "backoff") {
        return "attention_backoff";
      }
      return "attention_debt";
    }
    if (this.hasTimeBasedTask()) {
      return "task_timer";
    }
    return "external_input";
  }

  private async waitForAnyInput(): Promise<LoopInputKind> {
    if (this.abortWakeRequested) {
      this.loopKernelLastWakeCause = "attention_signal";
      return "attention";
    }
    const loopPaused = this.isLoopPaused();
    const hasPendingAttention = this.hasPendingAttentionInputs();
    const now = Date.now();
    const hasDueAttentionContainmentWake = this.attentionSystem.listActiveContexts().some((match) => {
      const entry = this.attentionContainment.get(match.contextId);
      return entry ? entry.nextWakeAt <= now : false;
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
    if (!loopPaused && this.focusedTerminalIds.some((terminalId) => this.terminalDirtyState[terminalId])) {
      this.loopKernelLastWakeCause = "terminal_activity";
      this.resetAttentionDebtBackoff();
      return "terminal";
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

    const signalWaiters = (["user", "task", "attention"] as const).map((kind) => ({
      kind,
      ...this.inputSignals[kind].waitAfter(this.inputSignalCursor[kind]),
    }));
    const terminalHandles = loopPaused
      ? []
      : this.focusedTerminalIds
          .map((terminalId) => {
            const terminal = this.terminals.get(terminalId);
            if (!terminal || !terminal.isRunning()) {
              return null;
            }
            return {
              kind: "terminal" as const,
              terminalId,
              handle: terminal.waitCommitted({ fromHash: terminal.getHeadHash() }),
            };
          })
          .filter(
            (
              item,
            ): item is {
              kind: "terminal";
              terminalId: string;
              handle: { promise: Promise<{ toHash: string | null }>; reject: (reason: unknown) => void };
            } => item !== null,
          );
    const unreadHandle = loopPaused
      ? null
      : this.messageSystem.waitUnreadCommitted({
          actorId: this.messageActorId,
          fromVersion: this.messageSystem.getUnreadVersion(this.messageActorId),
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
      ...terminalHandles.map((item) =>
        item.handle.promise
          .then(() => ({ kind: item.kind }))
          .catch((error) => {
            if (error === IGNORE_WAIT) {
              return new Promise<{ kind: LoopInputKind }>(() => {});
            }
            throw error;
          }),
      ),
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
    } else if (winner.kind === "terminal") {
      this.loopKernelLastWakeCause ??= "terminal_activity";
      this.resetAttentionDebtBackoff();
    } else if (winner.kind === "attention" && !this.attentionForceCollect) {
      this.loopKernelLastWakeCause ??= "attention_signal";
      this.resetAttentionDebtBackoff();
    }

    for (const item of terminalHandles) {
      item.handle.reject(IGNORE_WAIT);
    }
    unreadHandle?.reject(IGNORE_WAIT);
    for (const waiter of signalWaiters) {
      waiter.cancel();
    }
    return winner.kind;
  }

  private async collectLoopInputs(): Promise<LoopBusInput[] | undefined> {
    await this.pollTaskSources("watch");
    await this.pollTaskEventInbox();
    this.collectUnreadRoomIngress();
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
            if (!Number.isInteger(messageId) || messageId <= 0) {
              return [];
            }
            return [
              {
                sourceRef: this.createMessageSourceRef({
                  chatId: this.getDefaultChatId(),
                  messageId,
                }),
                content: item.text,
                from: item.name,
                score: 100,
                provenance: {
                  author: item.name,
                  source: "message",
                  src: formatMessageSourceSrc({
                    chatId: this.getDefaultChatId(),
                    messageId,
                  }),
                },
                presentation: {
                  summary: truncateAttentionTitle(item.text.trim()),
                  body: item.text,
                  bodyFormat: "text/plain",
                  changeType: "update",
                },
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
    const terminalInputs = this.loopPluginRuntime ? undefined : await this.collectTerminalInputs();
    if (terminalInputs) {
      outputs.push(...terminalInputs);
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

  private async collectInterleavedAgentInputs(): Promise<LoopBusInput[] | undefined> {
    this.collectUnreadRoomIngress();
    const consumedUserInputs = this.drainInterleavedInboundQueue();
    const pluginChanged = await this.flushPluginAttentionDrafts();
    const pendingTaskDrafts = this.collectPendingTaskAttentionDrafts();
    const taskChanged = pendingTaskDrafts.length > 0 ? await this.commitAttentionDrafts(pendingTaskDrafts) : false;
    const attentionInputs = this.collectAttentionInputs();

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
    if (active.length === 0) {
      this.dirtyAttentionContextIds.clear();
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
    if (selected.length === 0) {
      return undefined;
    }

    for (const match of selected) {
      this.clearDirtyAttentionContext(match.contextId);
    }

    const outputs: LoopBusInput[] = [];
    const bootstrapInput = this.buildAttentionContextBootstrapInput(active, selected);
    if (bootstrapInput) {
      outputs.push(bootstrapInput);
      this.attentionFactsSentVersion = this.attentionFactsVersion;
    }
    const itemsInput = this.buildAttentionItemsInput(selected);
    if (itemsInput) {
      outputs.push(itemsInput);
    }
    return outputs.length > 0 ? outputs : undefined;
  }

  private resolveMessageChannelForContext(contextId: string): MessageControlPlaneEntry | null {
    return this.listActorRooms().find((entry) => entry.contextId === contextId) ?? null;
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

  private async collectTerminalInputs(): Promise<LoopBusInput[] | undefined> {
    const pendingIds = [...this.dirtyQueue.values()];
    if (pendingIds.length === 0) {
      return undefined;
    }
    this.dirtyQueue.clear();

    const outputs: LoopBusInput[] = [];
    for (const terminalId of pendingIds) {
      const terminal = this.terminals.get(terminalId);
      const config = this.config?.terminals[terminalId];
      if (!terminal || !config) {
        continue;
      }
      const status = terminal.getStatus();
      if (status === "BUSY") {
        this.dirtyQueue.add(terminalId);
        continue;
      }

      const focused = this.focusedTerminalIds.includes(terminalId);
      const seq = this.terminalLatestSeq[terminalId] ?? 0;

      if (!focused) {
        this.dirtyQueue.add(terminalId);
        continue;
      }

      if (!config.gitLog) {
        const snapshot = terminal.getSnapshot();
        this.terminalDirtyState[terminalId] = false;
        outputs.push({
          name: `Terminal-${terminalId}`,
          role: "user",
          type: "text",
          source: "terminal",
          text: JSON.stringify(buildTerminalSnapshotPayload(terminalId, snapshot, terminal.getStatus())),
          meta: { terminalId, seq: snapshot.seq, focused: true },
        });
        continue;
      }

      const slice = await terminal.sliceDirty({ remark: true });
      if (!slice.ok || !slice.changed || slice.fromHash === slice.toHash) {
        this.terminalDirtyState[terminalId] = false;
        continue;
      }
      outputs.push({
        name: `Terminal-${terminalId}`,
        role: "user",
        type: "text",
        source: "terminal",
        text: serializeTerminalDiff(terminalId, {
          fromHash: slice.fromHash,
          toHash: slice.toHash,
          diff: slice.diff,
          bytes: slice.bytes,
          status,
        }),
        meta: {
          terminalId,
          focused: true,
          fromHash: slice.fromHash ?? "none",
          toHash: slice.toHash ?? "none",
          bytes: slice.bytes,
        },
      });
    }

    return outputs.length > 0 ? outputs : undefined;
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
    this.clearActiveCycleUnreadReadAcks();
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
    this.activeCycleUnreadReadAcks = this.consumeStagedUnreadReadAcks();
    this.activeCycleUnreadReadCommitted = false;
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
      : paused
        ? "paused"
        : input.phase !== "waiting_commits"
          ? "running"
          : waitingReason === "attention_backoff"
            ? "backoff"
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
      blockedReason: null,
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
      maxRetries: config.ai.maxRetries,
      maxToken: config.ai.maxToken ?? null,
      maxContextTokens: config.ai.maxContextTokens ?? null,
      compactThreshold: config.ai.compactThreshold ?? null,
      providerSnapshot: buildProviderSnapshot(config),
      thinking:
        config.ai.thinking === undefined
          ? null
          : {
              enabled: config.ai.thinking.enabled ?? false,
              budgetTokens: config.ai.thinking.budgetTokens ?? null,
            },
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
      agenterPath: config.prompt.agenterPath,
      agenterSystemPath: config.prompt.agenterSystemPath,
      systemTemplatePath: config.prompt.systemTemplatePath,
      responseContractPath: config.prompt.responseContractPath,
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
      maxRetries: config.ai.maxRetries,
      maxToken: config.ai.maxToken,
      compactThreshold: config.ai.compactThreshold,
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

  private handleAssistantStreamUpdate(input: AssistantStreamUpdate): void {
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
      this.attentionSearchEngine?.sync(snapshot) ?? Promise.resolve(),
    ]);
  }

  private async handleModelCall(record: AgentModelCallRecord): Promise<void> {
    if (record.status === "running") {
      this.commitActiveCycleUnreadReadAcks();
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
    const normalizedRequest = this.normalizePersistedModelRequest(record.request);
    const requestMeta = {
      ...(normalizedRequest.meta ?? {}),
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
    const persistedRequestBody =
      existingModelCallId === null
        ? requestBody
        : (this.sessionDb.getAiCallById(existingModelCallId)?.requestBody ?? requestBody);
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
            requestBody: persistedRequestBody,
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
            requestBody: persistedRequestBody,
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
