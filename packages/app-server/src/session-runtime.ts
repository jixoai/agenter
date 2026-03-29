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
  type AttentionCycleFrame,
  type AttentionHookRecord,
  type AttentionProtocolMode,
  type AttentionQueryInput,
  type AttentionSystemSnapshot,
} from "@agenter/attention-system";
import {
  MessageControlPlane,
  type MessageChannelGrantRecord,
  type MessageChannelKind,
  type MessageChannelPatchInput,
  type MessageControlPlaneEntry,
  type MessageErrorPayload,
  type MessageFocusOp,
  type MessageInteractivePayload,
  type MessageIssueGrantInput,
  type MessageIssuedGrant,
  type MessageRecord,
} from "@agenter/message-system";
import {
  SessionDb,
  type SessionAssetRecord,
  type SessionCollectedInput,
  type SessionCollectedInputPart,
  type SessionCycleRecord,
  type ApiCallRecord as SessionDbApiCallRecord,
  type SessionBlockRecord as SessionDbChatMessageRecord,
  type LoopbusStateLogRecord as SessionDbLoopbusStateLogRecord,
  type LoopbusTraceRecord as SessionDbLoopbusTraceRecord,
  type ReversePage as SessionDbReversePage,
  type ReverseTimeCursor as SessionDbReverseTimeCursor,
  type TerminalActivityRecord as SessionDbTerminalActivityRecord,
  type SessionModelCallRecord,
  type SessionTerminalOutcome,
  type SessionTraceRef,
} from "@agenter/session-system";
import { ResourceLoader } from "@agenter/settings";
import {
  TaskEngine,
  resolveTaskSources,
  serializeTaskMarkdown,
  type TaskCreateInput,
  type TaskEventInput,
  type TaskImportItem,
  type TaskSourceName,
  type TaskSourceResolved,
  type TaskUpdateInput,
  type TaskView,
} from "@agenter/task-system";
import {
  TerminalControlPlane,
  type TerminalControlPlaneConfig,
  type TerminalReadResult as ControlPlaneTerminalReadResult,
  type TerminalControlPlaneConfigPatch,
  type TerminalControlPlaneEntry,
  type TerminalProcessProfile,
} from "@agenter/terminal-system";
import { toolDefinition } from "@tanstack/ai";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import { createRuntimeAttentionPreview } from "./attention-runtime-view";

import { AgentRuntime } from "./agent-runtime";
import {
  AgenterAI,
  type AgentModelCallRecord,
  type AgentRuntimeStats,
  type AgentToolProvider,
  type AgentToolTraceEntry,
} from "./agenter-ai";
import { AttentionHashAliasRegistry, AttentionHashAliasStore } from "./attention-hash-alias-registry";
import { projectAttentionActiveContextForModel, projectAttentionCommitMatchForModel } from "./attention-model-view";
import {
  collectClientMessageIds,
  detectChatCycleKind,
  toChatCycleId,
  type ChatCycle,
  type ChatCycleStatus,
} from "./chat-cycles";
import type { LoopBusInput, LoopBusPhase, LoopBusWakeSource } from "./loop-bus";
import type { LoopBusKernelSnapshot, LoopBusKernelState } from "./loopbus-kernel";
import { createInitialLoopKernelState, createLoopStatePatch, hashLoopState } from "./loopbus-kernel";
import {
  LoopBusPluginRuntime,
  type AttentionDraft,
  type LoopBusPlugin,
  type LoopSourceReadRequest,
  type LoopSourceReadResult,
  type LoopSourceRef,
} from "./loopbus-plugin-runtime";
import { ManagedTerminal, type ManagedTerminalSnapshot } from "./managed-terminal";
import { resolveModelCapabilities } from "./model-capabilities";
import { ModelClient, type AssistantStreamUpdate } from "./model-client";
import { FilePromptStore } from "./prompt-store";
import { createSpanId, createTraceEvent, createTraceId, createTraceRef } from "./runtime-trace";
import { buildSessionAssetRelativePath, resolveSessionAssetKind, toChatSessionAsset } from "./session-assets";
import { DEFAULT_MESSAGE_CHAT_ID, resolveSessionBlockChatId } from "./session-chat-projection";
import { resolveSessionConfig, type ResolvedSessionConfig, type SessionTerminalConfig } from "./session-config";
import { SessionStore } from "./session-store";
import { SettingsEditor, type EditableKind } from "./settings-editor";
import { buildTerminalSemanticFingerprint, buildTerminalViewFingerprint } from "./terminal-snapshot-fingerprint";
import type { ChatMessage, ChatSessionAsset, ModelCapabilities, TaskStage } from "./types";
import {
  listWorkspaceSettingsLayers,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
  type SettingsLayerSnapshot,
  type SettingsLayersResult,
} from "./workspace-settings";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const DEFAULT_CHAT_ID = DEFAULT_MESSAGE_CHAT_ID;
const DEFAULT_CHAT_OWNER = "agenter";

const slugifyMessageChannelTitle = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : fallback;
};
const ATTENTION_TITLE_LIMIT = 140;
const MAX_TERMINAL_ATTENTION_DETAIL_CHARS = 4_000;
const MAX_TASK_ATTENTION_DETAIL_CHARS = 4_000;
const ATTENTION_DEBT_INITIAL_BACKOFF_MS = 600;
const ATTENTION_DEBT_MAX_BACKOFF_MS = 5_000;
const ATTENTION_DEBT_BACKOFF_MULTIPLIER = 2;
const PASSIVE_LIFECYCLE_ATTENTION_SCORE = 0;
const ACTIVE_LIFECYCLE_ATTENTION_SCORE = 1;

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

interface AttentionReplyTarget {
  systemId?: string;
  subjectId?: string;
  channelId?: string;
  rootId?: string;
  from?: string;
  to?: string;
}

const readAttentionReplyTarget = (value: unknown): AttentionReplyTarget | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = value as Record<string, unknown>;
  return {
    systemId: typeof input.systemId === "string" ? input.systemId : undefined,
    subjectId: typeof input.subjectId === "string" ? input.subjectId : undefined,
    channelId: typeof input.channelId === "string" ? input.channelId : undefined,
    rootId: typeof input.rootId === "string" ? input.rootId : undefined,
    from: typeof input.from === "string" ? input.from : undefined,
    to: typeof input.to === "string" ? input.to : undefined,
  };
};

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
  mdFence("yaml+attention_commit", toYaml(projectAttentionCommitMatchForModel(match)));

const serializeAttentionActiveContext = (match: AttentionActiveContextMatch): string =>
  mdFence("yaml+attention_context", toYaml(projectAttentionActiveContextForModel(match)));

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

const stableAttentionDraftDigest = (draft: AttentionDraft): string => {
  const semanticHint =
    typeof draft.meta?.semanticHash === "string"
      ? draft.meta.semanticHash
      : typeof draft.meta?.toHash === "string"
        ? draft.meta.toHash
        : JSON.stringify({
            content: draft.content,
            meta: draft.meta ?? null,
          });
  return `${draft.sourceRef.systemId}:${draft.sourceRef.subjectId}:${semanticHint}`;
};

const buildAttentionScoreSubjectSeed = (draft: AttentionDraft): string =>
  `subject:${draft.sourceRef.systemId}:${draft.sourceRef.subjectId}`;

const buildAttentionScoreSemanticSeed = (draft: AttentionDraft): string | null => {
  const semanticHash = typeof draft.meta?.semanticHash === "string" ? draft.meta.semanticHash.trim() : "";
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
  modelCapabilities: ModelCapabilities;
  activeCycle: ChatCycle | null;
}

export interface SessionRuntimeOptions {
  sessionId: string;
  cwd: string;
  avatar?: string;
  sessionRoot: string;
  sessionName: string;
  storeTarget: "global" | "workspace";
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
    maxRetries: number;
    maxToken?: number;
    compactThreshold?: number;
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
  private attentionStore: AttentionStore | null = null;
  private attentionHashAliasStore: AttentionHashAliasStore | null = null;
  private attentionSystem = new AttentionSystem();
  private attentionHashAliases = new AttentionHashAliasRegistry();
  private readonly messageSystem: MessageControlPlane;
  private readonly inboundMessageQueue: LoopBusInput[] = [];
  private readonly messageSystemCleanup: Array<() => void> = [];
  private agent: AgenterAI | null = null;
  private terminalControlPlane: TerminalControlPlane | null = null;
  private terminals = new Map<string, ManagedTerminal>();
  private runtime: AgentRuntime | null = null;
  private started = false;
  private loopPhase: LoopBusPhase = "waiting_commits";
  private stage: TaskStage = "idle";
  private readonly taskHeartbeatIntervalMs = 30_000;
  private lastTaskHeartbeatAt = 0;
  private lastTaskHeartbeatDigest = "";
  private focusedTerminalIds: string[] = [];
  private chatMessages: ChatMessage[] = [];
  private activeCycle: ChatCycle | null = null;
  private loopKernelSnapshot: LoopBusKernelSnapshot | null = null;
  private activeCycleId: number | null = null;
  private activeModelCallId: number | null = null;
  private modelCallDeltaSeq = 0;
  private readonly pendingTraceSpans: PendingTraceSpan[] = [];
  private readonly traceRowIdBySpanId = new Map<string, number>();
  private readonly runningTraceRowsByName = new Map<string, SessionDbLoopbusTraceRecord>();
  private readonly cycleReplyChatIds = new Map<number, string>();
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

  constructor(private readonly options: SessionRuntimeOptions) {
    this.messageSystem = new MessageControlPlane({
      dbPath: join(options.sessionRoot, "message-system", "chat.db"),
      initialConfig: {
        defaultOwner: DEFAULT_CHAT_OWNER,
        transport: {
          port: 0,
        },
      },
    });
    this.bindMessageSystem();
  }

  private createMessageSourceRef(input: {
    chatId: string;
    messageId: string;
    rootId?: string;
    from: string;
    to?: string;
    content: string;
    attachments: ChatSessionAsset[];
    meta?: Record<string, string | number | boolean | null>;
  }): LoopSourceRef {
    return {
      systemId: "message",
      subjectId: input.messageId,
      reason: "message-committed",
      meta: {
        chatId: input.chatId,
        rootId: input.rootId,
        from: input.from,
        to: input.to,
        content: input.content,
        attachments: input.attachments,
        meta: input.meta,
      },
    };
  }

  private getDefaultChatId(): string {
    return DEFAULT_CHAT_ID;
  }

  private getAvatarName(): string {
    return this.config?.avatar?.nickname ?? this.options.avatar ?? DEFAULT_CHAT_OWNER;
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

  private resolveLifecycleAttentionScore(input: { systemId: "message" | "terminal"; event: string }): number {
    if (input.systemId === "message") {
      switch (input.event) {
        case "channel_create":
        case "channel_update":
        case "channel_archive":
          return ACTIVE_LIFECYCLE_ATTENTION_SCORE;
        default:
          return PASSIVE_LIFECYCLE_ATTENTION_SCORE;
      }
    }
    switch (input.event) {
      case "terminal_create":
      case "terminal_delete":
      case "terminal_config_update":
        return ACTIVE_LIFECYCLE_ATTENTION_SCORE;
      default:
        return PASSIVE_LIFECYCLE_ATTENTION_SCORE;
    }
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
      this.enqueueLifecycleAttentionCommit({
        systemId: "terminal",
        subjectId: terminalId,
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
      this.enqueueLifecycleAttentionCommit({
        systemId: "terminal",
        subjectId: terminalId,
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
    this.enqueueLifecycleAttentionCommit({
      systemId: "terminal",
      subjectId: "control-plane",
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
    const channel = this.messageSystem.getChannel(chatId);
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
    const created = this.attentionSystem.createContext({ contextId, owner });
    const state = created.getState();
    return {
      contextId: state.contextId,
      owner: state.owner,
      headCommitId: state.headCommitId,
      unresolvedScoreCount: created.unresolvedScoreCount(),
      updatedAt: state.updatedAt,
    };
  }

  private ensureDefaultChatChannel(): MessageControlPlaneEntry {
    const chatId = this.getDefaultChatId();
    const context = this.ensureAttentionContextForChannel(chatId);
    const existing = this.messageSystem.getChannel(chatId);
    if (existing) {
      this.messageSystem.focus("add", [chatId]);
      return existing;
    }
    const avatar = this.getAvatarName();
    const defaults = this.config?.message?.chatMainDefaults;
    const created = this.messageSystem.createChannel({
      chatId,
      kind: "direct",
      title: defaults?.title ?? "Chat",
      owner: avatar,
      contextId: context.contextId,
      participants:
        defaults?.participants && defaults.participants.length > 0
          ? defaults.participants
          : [
              { id: `avatar:${avatar}`, label: avatar, role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
      metadata: {
        builtIn: true,
        ...(defaults?.metadata ?? {}),
      },
      adminToken: defaults?.adminToken,
    });
    this.messageSystem.focus("add", [chatId]);
    return created;
  }

  private allocateMessageChannelId(kind: MessageChannelKind, title?: string): string {
    const prefix = kind === "room" ? "room-" : "chat-";
    const base = `${prefix}${slugifyMessageChannelTitle(title ?? "", kind === "room" ? "room" : "chat")}`;
    if (!this.messageSystem.getChannel(base)) {
      return base;
    }
    let suffix = 2;
    while (this.messageSystem.getChannel(`${base}-${suffix}`)) {
      suffix += 1;
    }
    return `${base}-${suffix}`;
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
        role: participant.role,
      })),
      metadata:
        channel.metadata && typeof channel.metadata === "object"
          ? ({ ...(channel.metadata as Record<string, unknown>) } satisfies Record<string, unknown>)
          : {},
      focused: channel.focused,
      archivedAt: channel.archivedAt ?? null,
      archivedBy: channel.archivedBy ?? null,
    };
  }

  private projectMessageChannelForTooling(channel: MessageControlPlaneEntry): {
    chatId: string;
    kind: "direct" | "room";
    title: string;
    owner: string;
    contextId?: string;
    participants: Array<{
      id: string;
      label?: string;
      role?: "avatar" | "user" | "system";
    }>;
    metadata?: Record<string, unknown>;
    focused: boolean;
    archivedAt?: number;
    archivedBy?: string;
  } {
    return {
      chatId: channel.chatId,
      kind: channel.kind,
      title: channel.title,
      owner: channel.owner,
      contextId: channel.contextId,
      participants: channel.participants.map((participant) => ({
        id: participant.id,
        label: participant.label,
        role: participant.role,
      })),
      metadata:
        channel.metadata && typeof channel.metadata === "object"
          ? ({ ...(channel.metadata as Record<string, unknown>) } satisfies Record<string, unknown>)
          : undefined,
      focused: channel.focused,
      archivedAt: channel.archivedAt,
      archivedBy: channel.archivedBy,
    };
  }

  private listMessageChannelsForTooling(input: { includeArchived?: boolean } = {}): Array<{
    chatId: string;
    kind: "direct" | "room";
    title: string;
    owner: string;
    contextId?: string;
    participants: Array<{
      id: string;
      label?: string;
      role?: "avatar" | "user" | "system";
    }>;
    metadata?: Record<string, unknown>;
    focused: boolean;
    archivedAt?: number;
    archivedBy?: string;
  }> {
    return this.listMessageChannels({ includeArchived: input.includeArchived }).map((channel) =>
      this.projectMessageChannelForTooling(channel),
    );
  }

  private getMessageChannelForTooling(input: { chatId: string; includeArchived?: boolean }): {
    chatId: string;
    kind: "direct" | "room";
    title: string;
    owner: string;
    contextId?: string;
    participants: Array<{
      id: string;
      label?: string;
      role?: "avatar" | "user" | "system";
    }>;
    metadata?: Record<string, unknown>;
    focused: boolean;
    archivedAt?: number;
    archivedBy?: string;
  } | null {
    if (input.chatId === this.getDefaultChatId()) {
      this.ensureDefaultChatChannel();
    }
    const channel = this.messageSystem.getChannel(input.chatId, {
      includeArchived: input.includeArchived ?? false,
    });
    return channel ? this.projectMessageChannelForTooling(channel) : null;
  }

  private async sendMessageTool(input: {
    chatId: string;
    content: string;
    rootId?: string;
    from?: string;
    to?: string;
  }): Promise<{ ok: boolean; messageId: string }> {
    const channel = this.messageSystem.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const replyCycleId = this.activeCycleId;
    const author = input.from ?? this.getAvatarName();
    const redundant = this.findRedundantVisibleReply({
      chatId: input.chatId,
      content: input.content,
      from: author,
    });
    if (redundant) {
      return {
        ok: true,
        messageId: redundant.messageId,
      };
    }
    const message = this.messageSystem.reply({
      chatId: input.chatId,
      rootId: input.rootId ?? (replyCycleId !== null ? String(replyCycleId) : undefined),
      from: author,
      to: input.to,
      content: input.content,
      metadata: {
        channel: "to_user",
        source: "message_send",
        cycleId: replyCycleId,
      },
    });
    return {
      ok: true,
      messageId: message.messageId,
    };
  }

  listMessageChannels(input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry[] {
    this.ensureDefaultChatChannel();
    return this.messageSystem.listChannels({ includeArchived: input.includeArchived });
  }

  createMessageChannel(input: {
    kind: MessageChannelKind;
    title?: string;
    participants?: Array<{
      id: string;
      label?: string;
      role?: "avatar" | "user" | "system";
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): MessageControlPlaneEntry {
    const avatar = this.getAvatarName();
    const chatId = this.allocateMessageChannelId(input.kind, input.title);
    const context = this.ensureAttentionContextForChannel(chatId);
    const channel = this.messageSystem.createChannel({
      chatId,
      kind: input.kind,
      title: input.title ?? (input.kind === "room" ? "Room" : "Chat"),
      owner: avatar,
      contextId: context.contextId,
      participants:
        input.participants && input.participants.length > 0
          ? input.participants
          : [
              { id: `avatar:${avatar}`, label: avatar, role: "avatar" },
              { id: "user", label: "User", role: "user" },
            ],
      metadata: input.metadata ?? { builtIn: false },
      adminToken: input.adminToken,
    });
    this.enqueueLifecycleAttentionCommit({
      systemId: "message",
      subjectId: chatId,
      contextId: context.contextId,
      event: "channel_create",
      summary: `Created chat channel ${chatId}`,
      payload: {
        kind: input.kind,
        title: channel.title,
        focused: Boolean(input.focus ?? true),
        channel: this.projectMessageChannelForAttention(channel),
      },
    });
    if (input.focus ?? true) {
      this.messageSystem.focus("replace", [chatId]);
      this.enqueueLifecycleAttentionCommit({
        systemId: "message",
        subjectId: chatId,
        contextId: context.contextId,
        event: "channel_focus",
        summary: `Focused chat channel ${chatId}`,
        payload: {
          op: "replace",
          channels: [chatId],
          focused: true,
          channel: this.projectMessageChannelForAttention(channel),
        },
      });
      return this.messageSystem.getChannel(chatId) ?? channel;
    }
    return channel;
  }

  focusMessageChannels(input: {
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken: string }>;
  }): MessageControlPlaneEntry[] {
    const focusedBefore = new Set(this.messageSystem.getFocusedChatIds());
    const focusedAfter = new Set(this.messageSystem.focusAuthorized(input.op, input.channels));
    const channels = this.messageSystem.listChannels();
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
      const wasFocused = focusedBefore.has(chatId);
      if (focused === wasFocused && !input.channels.some((item) => item.chatId === chatId)) {
        continue;
      }
      this.enqueueLifecycleAttentionCommit({
        systemId: "message",
        subjectId: chatId,
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
    this.enqueueLifecycleAttentionCommit({
      systemId: "message",
      subjectId: updated.chatId,
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
    const channel = this.messageSystem.getChannel(input.chatId, { includeArchived: true });
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const builtIn = Boolean(
      channel.metadata && typeof channel.metadata === "object" && channel.metadata.builtIn === true,
    );
    if (channel.chatId === this.getDefaultChatId() || builtIn) {
      throw new Error("chat-main is protected and cannot be archived");
    }
    const archived = this.messageSystem.archiveChannelAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      archivedBy: input.archivedBy ?? this.getAvatarName(),
    });
    this.enqueueLifecycleAttentionCommit({
      systemId: "message",
      subjectId: archived.chatId,
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

  listMessageChannelGrants(input: { chatId: string; accessToken: string }): MessageChannelGrantRecord[] {
    return this.messageSystem.listChannelGrantsAuthorized(input);
  }

  issueMessageChannelGrant(
    input: { chatId: string; accessToken: string } & MessageIssueGrantInput,
  ): MessageIssuedGrant {
    const issued = this.messageSystem.issueChannelGrantAuthorized(input);
    const channel = this.messageSystem.getChannel(issued.chatId, { includeArchived: true });
    this.enqueueLifecycleAttentionCommit({
      systemId: "message",
      subjectId: issued.chatId,
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
      this.enqueueLifecycleAttentionCommit({
        systemId: "message",
        subjectId: input.chatId,
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
    return this.requireTerminalControlPlane().list();
  }

  async createRuntimeTerminal(input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: TerminalControlPlaneEntry }> {
    const controlPlane = this.requireTerminalControlPlane();
    const targetTerminalId = input.terminalId;
    try {
      let createdTerminalId: string;
      if (targetTerminalId && this.config?.terminals[targetTerminalId]) {
        await this.createTerminal(targetTerminalId, this.config.terminals[targetTerminalId]);
        controlPlane.start(targetTerminalId);
        if (this.config.terminals[targetTerminalId]?.gitLog) {
          await controlPlane.markDirty(targetTerminalId);
        }
        this.terminalDirtyState[targetTerminalId] = false;
        createdTerminalId = targetTerminalId;
      } else {
        const created = await controlPlane.create({
          terminalId: input.terminalId,
          processKind: input.processKind,
          command: input.command,
          cwd: input.cwd,
          profile: input.profile,
        });
        const managed = controlPlane.getManagedTerminal(created.terminalId);
        if (managed) {
          this.attachRuntimeTerminal(created.terminalId, managed);
        }
        this.terminalDirtyState[created.terminalId] = false;
        createdTerminalId = created.terminalId;
      }

      this.enqueueLifecycleAttentionCommit({
        systemId: "terminal",
        subjectId: createdTerminalId,
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

      const terminal = controlPlane.list().find((item) => item.terminalId === createdTerminalId);
      return {
        ok: true,
        message: terminal ? "terminal created" : "terminal created but unavailable in snapshot",
        terminal,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `terminal create failed (${targetTerminalId ?? "dynamic"}): ${message}` });
      return { ok: false, message };
    }
  }

  focusRuntimeTerminals(input: { op: TerminalFocusOp; terminalIds: string[] }): {
    ok: boolean;
    message: string;
    focusedTerminalIds: string[];
  } {
    const controlPlane = this.requireTerminalControlPlane();
    const unknown = input.terminalIds.filter((terminalId) => !controlPlane.has(terminalId));
    if (unknown.length > 0) {
      return {
        ok: false,
        message: `unknown terminal: ${unknown[0]}`,
        focusedTerminalIds: [...this.focusedTerminalIds],
      };
    }
    const focusedBefore = [...this.focusedTerminalIds];
    const focusedTerminalIds = this.updateFocusedTerminals(input.op, input.terminalIds);
    this.recordTerminalFocusTransitions({
      before: focusedBefore,
      after: focusedTerminalIds,
      op: input.op,
    });
    return { ok: true, message: `focus ${input.op}`, focusedTerminalIds };
  }

  async deleteRuntimeTerminal(terminalId: string): Promise<{ ok: boolean; message: string }> {
    const controlPlane = this.requireTerminalControlPlane();
    const result = await controlPlane.kill(terminalId);
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
    this.focusedTerminalIds = controlPlane.getFocusedTerminalIds();
    this.emitFocusedTerminal();
    this.enqueueLifecycleAttentionCommit({
      systemId: "terminal",
      subjectId: terminalId,
      contextId: this.getTerminalAttentionContextId(terminalId),
      event: "terminal_delete",
      summary: `Deleted terminal ${terminalId}`,
    });
    return result;
  }

  private resolveMessageRole(message: MessageRecord): ChatMessage["role"] {
    return message.from === this.getAvatarName() ? "assistant" : "user";
  }

  private isInboundMessage(message: MessageRecord): boolean {
    return message.kind === "text" && this.resolveMessageRole(message) === "user";
  }

  private toLoopInputFromMessage(message: MessageRecord): LoopBusInput {
    const meta =
      message.metadata && typeof message.metadata === "object"
        ? { ...(message.metadata as Record<string, string | number | boolean | null>) }
        : {};
    const channel = this.messageSystem.getChannel(message.chatId, { includeArchived: true });
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
      id: message.messageId,
    };
  }

  private toChatMessageFromChannel(message: MessageRecord): ChatMessage {
    const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata : {};
    const role = this.resolveMessageRole(message);
    return {
      id: message.messageId,
      chatId: message.chatId,
      role,
      content: message.content,
      messageKind: message.kind,
      messagePayload: message.payload,
      timestamp: message.createdAt,
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
        const channel = this.messageSystem.getChannel(chatId);
        if (!channel) {
          return;
        }
        this.recordChatMessage(this.toChatMessageFromChannel(message));
        if (!this.isInboundMessage(message)) {
          return;
        }
        this.inboundMessageQueue.push(this.toLoopInputFromMessage(message));
        this.loopPluginRuntime?.invalidate(
          this.createMessageSourceRef({
            chatId,
            messageId: message.messageId,
            rootId: message.rootId,
            from: message.from,
            to: message.to,
            content: message.content,
            attachments: this.toChatMessageFromChannel(message).attachments ?? [],
            meta:
              message.metadata && typeof message.metadata === "object"
                ? (message.metadata as Record<string, string | number | boolean | null>)
                : undefined,
          }),
        );
        this.notifyInput("user");
      }),
    );
    this.messageSystemCleanup.push(
      this.messageSystem.onFocus(() => {
        this.notifyInput("attention");
      }),
    );
  }

  private createTerminalSourceRef(terminalId: string, reason: string, versionHint?: string | number): LoopSourceRef {
    return {
      systemId: "terminal",
      subjectId: terminalId,
      reason,
      versionHint,
    };
  }

  private createTaskSourceRef(
    subjectId: string,
    reason: string,
    meta?: Record<string, unknown>,
    versionHint?: string | number,
  ): LoopSourceRef {
    return {
      systemId: "task",
      subjectId,
      reason,
      versionHint,
      meta,
    };
  }

  private enqueueTaskAttentionDraft(input: {
    subjectId: string;
    reason: string;
    content: string;
    from: string;
    meta?: Record<string, unknown>;
    score?: number;
    versionHint?: string | number;
  }): void {
    const meta = input.meta ? { ...input.meta } : undefined;
    this.taskAttentionDraftQueue.push({
      sourceRef: this.createTaskSourceRef(input.subjectId, input.reason, meta, input.versionHint),
      content: input.content,
      from: input.from,
      score: input.score ?? 100,
      meta: {
        source: "task",
        ...(meta ?? {}),
      },
      supersedeActive: {
        systemId: "task",
        subjectId: input.subjectId,
      },
    });
  }

  private hasDeliveredMessageSendForCycle(chatId: string, cycleId: number | null): boolean {
    if (cycleId === null) {
      return false;
    }
    return this.messageSystem
      .queryMessages({ chatId, limit: 12 })
      .items.some(
        (message) =>
          message.metadata &&
          typeof message.metadata === "object" &&
          message.metadata.source === "message_send" &&
          message.metadata.cycleId === cycleId,
      );
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
            systemId: "message",
            match: (ref) => ref.systemId === "message",
            read: async (request) => this.readMessageSource(request),
            toAttentionDrafts: async (result, request) => this.toMessageAttentionDrafts(result, request),
          });
        },
        attentionCommitted: async ({ contextId, commit }) => {
          const replyTarget = readAttentionReplyTarget(commit.meta.replyTarget);
          if (!replyTarget || replyTarget.systemId !== "message") {
            return {
              hookId: "builtin-message-bridge",
              systemId: "message",
              status: "ignored",
            };
          }
          const chatId = replyTarget.channelId ?? replyTarget.subjectId ?? null;
          if (!chatId) {
            return {
              hookId: "builtin-message-bridge",
              systemId: "message",
              status: "ignored",
              error: "missing chat target",
            };
          }
          const channel = this.messageSystem.getChannel(chatId);
          if (!channel) {
            return {
              hookId: "builtin-message-bridge",
              systemId: "message",
              status: "failed",
              target: { chatId },
              error: `unknown chat channel: ${chatId}`,
            };
          }
          try {
            const replyCycleId = this.activeCycleId;
            if (this.hasDeliveredMessageSendForCycle(chatId, replyCycleId)) {
              return {
                hookId: "builtin-message-bridge",
                systemId: "message",
                status: "ignored",
                target: {
                  chatId,
                  rootId: replyTarget.rootId ?? (replyCycleId !== null ? String(replyCycleId) : null),
                  to: replyTarget.to ?? null,
                },
                output: {
                  reason: "duplicate-visible-dispatch",
                  attentionContextId: contextId,
                  attentionCommitId: commit.commitId,
                },
              };
            }
            const replyContent =
              commit.change.type === "update" && commit.change.value.trim().length > 0
                ? commit.change.value
                : commit.summary;
            const message = this.messageSystem.reply({
              chatId,
              rootId: replyTarget.rootId ?? (replyCycleId !== null ? String(replyCycleId) : undefined),
              from: replyTarget.from ?? this.getAvatarName(),
              to: replyTarget.to,
              content: replyContent,
              metadata: {
                attentionContextId: contextId,
                attentionCommitId: commit.commitId,
                cycleId: replyCycleId,
              },
            });
            return {
              hookId: "builtin-message-bridge",
              systemId: "message",
              status: "delivered",
              target: {
                chatId,
                rootId: replyTarget.rootId ?? null,
                to: replyTarget.to ?? null,
              },
              output: {
                messageId: message.messageId,
                rowId: message.rowId,
                attentionContextId: contextId,
                attentionCommitId: commit.commitId,
              },
            };
          } catch (error) {
            return {
              hookId: "builtin-message-bridge",
              systemId: "message",
              status: "failed",
              target: {
                chatId,
                rootId: replyTarget.rootId ?? null,
                to: replyTarget.to ?? null,
              },
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "builtin-terminal-source",
        setup: (api) => {
          api.registerSource({
            systemId: "terminal",
            match: (ref) => ref.systemId === "terminal",
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
    if (trace.some((entry) => entry.tool === "attention_commit")) {
      return "done";
    }
    if (
      trace.some((entry) =>
        ["message_send", "terminal_create", "terminal_focus", "terminal_kill", "terminal_write", "terminal_set_config"].includes(
          entry.tool,
        ),
      )
    ) {
      return "act";
    }
    if (trace.some((entry) => entry.tool.startsWith("task_"))) {
      return "act";
    }
    if (
      trace.some((entry) =>
        [
          "message_channel_list",
          "message_channel_get",
          "terminal_list",
          "terminal_read",
          "terminal_snapshot",
          "terminal_get_config",
          "task_list",
          "task_get",
        ].includes(entry.tool),
      )
    ) {
      return "observe";
    }
    return "decide";
  }

  private createAgentToolProviders(): AgentToolProvider[] {
    return [this.createMessageToolProvider(), this.createTerminalToolProvider(), this.createTaskToolProvider()];
  }

  private createMessageToolProvider(): AgentToolProvider {
    return {
      name: "message",
      createTools: ({ runtimeText, traceTool }) => {
        const messageChannelSchema = z.object({
          chatId: z.string(),
          kind: z.enum(["direct", "room"]),
          title: z.string(),
          owner: z.string(),
          contextId: z.string().optional(),
          participants: z.array(
            z.object({
              id: z.string(),
              label: z.string().optional(),
              role: z.enum(["avatar", "user", "system"]).optional(),
            }),
          ),
          metadata: z.record(z.string(), z.unknown()).optional(),
          focused: z.boolean(),
          archivedAt: z.number().optional(),
          archivedBy: z.string().optional(),
        });

        const listTool = toolDefinition({
          name: "message_channel_list",
          description: runtimeText.t("tool.message_channel_list.description"),
          inputSchema: z.object({
            includeArchived: z.boolean().optional(),
          }),
          outputSchema: z.object({
            channels: z.array(messageChannelSchema),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              includeArchived: z.boolean().optional(),
            })
            .parse(rawInput);
          return traceTool("message_channel_list", input, async () => ({
            channels: this.listMessageChannelsForTooling(input),
          }));
        });

        const getTool = toolDefinition({
          name: "message_channel_get",
          description: runtimeText.t("tool.message_channel_get.description"),
          inputSchema: z.object({
            chatId: z.string().min(1),
            includeArchived: z.boolean().optional(),
          }),
          outputSchema: z.object({
            channel: messageChannelSchema.nullable(),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              chatId: z.string().min(1),
              includeArchived: z.boolean().optional(),
            })
            .parse(rawInput);
          return traceTool("message_channel_get", input, async () => ({
            channel: this.getMessageChannelForTooling(input),
          }));
        });

        const sendTool = toolDefinition({
          name: "message_send",
          description: runtimeText.t("tool.message_send.description"),
          inputSchema: z.object({
            chatId: z.string().min(1),
            content: z.string().min(1),
            rootId: z.string().optional(),
            from: z.string().optional(),
            to: z.string().optional(),
          }),
          outputSchema: z.object({
            ok: z.boolean(),
            messageId: z.string(),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              chatId: z.string().min(1),
              content: z.string().min(1),
              rootId: z.string().optional(),
              from: z.string().optional(),
              to: z.string().optional(),
            })
            .parse(rawInput);
          return traceTool("message_send", input, async () => await this.sendMessageTool(input));
        });

        return [listTool, getTool, sendTool];
      },
    };
  }

  private createTerminalToolProvider(): AgentToolProvider {
    return {
      name: "terminal",
      createTools: ({ runtimeText, traceTool }) => {
        const terminalProcessProfileSchema = z.object({
          command: z.array(z.string()).optional(),
          cwd: z.string().optional(),
          cols: z.number().optional(),
          rows: z.number().optional(),
          gitLog: z.union([z.literal(false), z.enum(["normal", "verbose"])]).optional(),
          logStyle: z.enum(["rich", "plain"]).optional(),
          icon: z.string().optional(),
          title: z.string().optional(),
          shortcuts: z.record(z.string(), z.string()).optional(),
        });

        const terminalControlPlaneConfigPatchSchema = z.object({
          defaults: terminalProcessProfileSchema.optional(),
          processProfiles: z.record(z.string(), terminalProcessProfileSchema).optional(),
          terminalProfiles: z.record(z.string(), terminalProcessProfileSchema).optional(),
          transport: z
            .object({
              host: z.string().optional(),
              port: z.number().nullable().optional(),
              pathPrefix: z.string().optional(),
            })
            .optional(),
        });

        const listTool = toolDefinition({
          name: "terminal_list",
          description: runtimeText.t("tool.terminal_list.description"),
          outputSchema: z.object({
            terminals: z.array(
              z.object({
                terminalId: z.string(),
                running: z.boolean(),
                cwd: z.string().optional(),
                cols: z.number(),
                rows: z.number(),
                focused: z.boolean().optional(),
                dirty: z.boolean().optional(),
                latestSeq: z.number().optional(),
                icon: z.string().optional(),
                title: z.string().optional(),
                shortcuts: z.record(z.string(), z.string()).optional(),
                transportUrl: z.string().optional(),
              }),
            ),
          }),
        }).server(async () =>
          traceTool("terminal_list", {}, async () => {
            const plane = this.requireTerminalControlPlane();
            const planeEntries = new Map(plane.list().map((entry) => [entry.terminalId, entry] as const));
            const configured = Object.values(this.config?.terminals ?? {}).map((terminal) => {
              const entry = planeEntries.get(terminal.terminalId);
              return {
                terminalId: terminal.terminalId,
                running: entry?.running ?? false,
                cwd: entry?.cwd ?? terminal.cwd,
                cols: entry ? plane.getSnapshot(terminal.terminalId).cols : 0,
                rows: entry ? plane.getSnapshot(terminal.terminalId).rows : 0,
                focused: this.focusedTerminalIds.includes(terminal.terminalId),
                dirty: this.terminalDirtyState[terminal.terminalId] ?? false,
                latestSeq: this.terminalLatestSeq[terminal.terminalId] ?? 0,
                icon: entry?.icon,
                title: entry?.title,
                shortcuts: entry?.shortcuts,
                transportUrl: entry?.transportUrl,
              };
            });
            const dynamic = plane
              .list()
              .filter((entry) => !this.config?.terminals[entry.terminalId])
              .map((entry) => ({
                terminalId: entry.terminalId,
                running: entry.running,
                cwd: entry.cwd,
                cols: plane.getSnapshot(entry.terminalId).cols,
                rows: plane.getSnapshot(entry.terminalId).rows,
                focused: this.focusedTerminalIds.includes(entry.terminalId),
                dirty: this.terminalDirtyState[entry.terminalId] ?? false,
                latestSeq: this.terminalLatestSeq[entry.terminalId] ?? 0,
                icon: entry.icon,
                title: entry.title,
                shortcuts: entry.shortcuts,
                transportUrl: entry.transportUrl,
              }));
            return {
              terminals: [...configured, ...dynamic],
            };
          }),
        );

        const createTool = toolDefinition({
          name: "terminal_create",
          description: runtimeText.t("tool.terminal_create.description"),
          inputSchema: z.object({
            terminalId: z.string().optional(),
            processKind: z.string().optional(),
            command: z.array(z.string()).optional(),
            cwd: z.string().optional(),
            profile: terminalProcessProfileSchema.optional(),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({
              terminalId: z.string().optional(),
              processKind: z.string().optional(),
              command: z.array(z.string()).optional(),
              cwd: z.string().optional(),
              profile: terminalProcessProfileSchema.optional(),
            })
            .parse(rawInput);
          return traceTool(
            "terminal_create",
            input,
            async () =>
              await this.createRuntimeTerminal({
                terminalId: input.terminalId,
                processKind: input.processKind,
                command: input.command,
                cwd: input.cwd,
                profile: input.profile,
                focus: false,
              }),
          );
        });

        const focusTool = toolDefinition({
          name: "terminal_focus",
          description: runtimeText.t("tool.terminal_focus.description"),
          inputSchema: z.object({
            op: z.enum(["add", "remove", "replace", "clear"]).optional(),
            terminalIds: z.array(z.string()).optional(),
          }),
          outputSchema: z.object({
            ok: z.boolean(),
            message: z.string(),
            focusedTerminalIds: z.array(z.string()).optional(),
          }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              op: z.enum(["add", "remove", "replace", "clear"]).optional(),
              terminalIds: z.array(z.string()).optional(),
            })
            .parse(rawInput);
          return traceTool("terminal_focus", input, async () =>
            this.focusRuntimeTerminals({
              op: input.op ?? "replace",
              terminalIds: input.terminalIds ?? [],
            }),
          );
        });

        const killTool = toolDefinition({
          name: "terminal_kill",
          description: runtimeText.t("tool.terminal_kill.description"),
          inputSchema: z.object({ terminalId: z.string() }),
          outputSchema: z.object({ ok: z.boolean(), message: z.string() }),
        }).server(async (rawInput) => {
          const input = z.object({ terminalId: z.string() }).parse(rawInput);
          return traceTool("terminal_kill", input, async () => await this.deleteRuntimeTerminal(input.terminalId));
        });

        const writeTool = toolDefinition({
          name: "terminal_write",
          description: runtimeText.t("tool.terminal_write.description"),
          inputSchema: z.object({
            terminalId: z.string(),
            text: z.string(),
            submit: z.boolean().optional(),
            submitKey: z.enum(["enter", "linefeed"]).optional(),
          }),
          outputSchema: z.object({ ok: z.boolean(), message: z.string() }),
        }).server(async (rawInput) => {
          const input = z
            .object({
              terminalId: z.string(),
              text: z.string(),
              submit: z.boolean().optional(),
              submitKey: z.enum(["enter", "linefeed"]).optional(),
            })
            .parse(rawInput);
          return traceTool("terminal_write", input, async () => {
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
              });
              if (result.ok) {
                this.appendTerminalActivity({
                  terminalId: input.terminalId,
                  kind: "terminal_write",
                  cycleId: this.activeCycleId,
                  title: input.submit || input.submitKey ? "Terminal write + submit" : "Terminal write",
                  content: input.text,
                  detail: {
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
          });
        });

        const readTool = toolDefinition({
          name: "terminal_read",
          description: runtimeText.t("tool.terminal_read.description"),
          inputSchema: z.object({
            terminalId: z.string(),
            mode: z.enum(["auto", "diff", "snapshot"]).optional(),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({
              terminalId: z.string(),
              mode: z.enum(["auto", "diff", "snapshot"]).optional(),
            })
            .parse(rawInput);
          return traceTool(
            "terminal_read",
            input,
            async () =>
              await this.readTerminalRepresentation(input.terminalId, {
                mode: input.mode ?? "auto",
                remark: false,
              }),
          );
        });

        const snapshotTool = toolDefinition({
          name: "terminal_snapshot",
          description: runtimeText.t("tool.terminal_snapshot.description"),
          inputSchema: z.object({ terminalId: z.string() }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ terminalId: z.string() }).parse(rawInput);
          return traceTool(
            "terminal_snapshot",
            input,
            async () =>
              await this.readTerminalRepresentation(input.terminalId, {
                mode: "snapshot",
                remark: false,
              }),
          );
        });

        const getConfigTool = toolDefinition({
          name: "terminal_get_config",
          description: runtimeText.t("tool.terminal_get_config.description"),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async () =>
          traceTool("terminal_get_config", {}, async () => await this.requireTerminalControlPlane().getConfig()),
        );

        const setConfigTool = toolDefinition({
          name: "terminal_set_config",
          description: runtimeText.t("tool.terminal_set_config.description"),
          inputSchema: z.object({
            patch: terminalControlPlaneConfigPatchSchema,
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({
              patch: terminalControlPlaneConfigPatchSchema,
            })
            .parse(rawInput);
      return traceTool(
            "terminal_set_config",
            input,
            async () =>
              await this.updateTerminalControlPlaneConfig(input.patch as TerminalControlPlaneConfigPatch),
          );
        });

        return [
          listTool,
          createTool,
          focusTool,
          killTool,
          writeTool,
          readTool,
          snapshotTool,
          getConfigTool,
          setConfigTool,
        ];
      },
    };
  }

  private createTaskToolProvider(): AgentToolProvider {
    return {
      name: "task",
      createTools: ({ runtimeText, traceTool }) => {
        const taskSourceSchema = z.string().min(1);
        const taskIdSchema = z.string().min(1);
        const taskRefSchema = z.object({
          source: taskSourceSchema,
          id: taskIdSchema,
        });
        const taskRefLikeSchema = z.union([z.string().min(1), taskRefSchema]);
        const taskRelationshipTypeSchema = z.enum([
          "blocks",
          "blocked_by",
          "relates_to",
          "parent_of",
          "child_of",
          "duplicates",
        ]);
        const taskRelationshipSchema = z.object({
          type: taskRelationshipTypeSchema,
          target: taskRefLikeSchema,
        });
        const taskTriggerSchema = z.union([
          z.object({ type: z.literal("manual") }),
          z.object({ type: z.literal("event"), topic: z.string().min(1) }),
          z.object({ type: z.literal("at"), at: z.string().min(1) }),
          z.object({ type: z.literal("cron"), expr: z.string().min(1) }),
        ]);
        const taskStatusSchema = z.enum(["backlog", "pending", "ready", "running", "done", "failed", "canceled"]);
        const taskCreateSchema = z.object({
          source: taskSourceSchema,
          id: taskIdSchema.optional(),
          title: z.string().min(1),
          body: z.string().optional(),
          status: taskStatusSchema.optional(),
          type: z.string().optional(),
          assignees: z.array(z.string()).optional(),
          labels: z.array(z.string()).optional(),
          milestone: z.string().optional(),
          projects: z.array(z.string()).optional(),
          dependsOn: z.array(taskRefLikeSchema).optional(),
          relationships: z.array(taskRelationshipSchema).optional(),
          triggers: z.array(taskTriggerSchema).optional(),
          sourceFile: z.string().optional(),
        });
        const taskPatchSchema = z.object({
          title: z.string().optional(),
          body: z.string().optional(),
          status: taskStatusSchema.optional(),
          type: z.string().optional(),
          assignees: z.array(z.string()).optional(),
          labels: z.array(z.string()).optional(),
          milestone: z.string().optional(),
          projects: z.array(z.string()).optional(),
          dependsOn: z.array(taskRefLikeSchema).optional(),
          relationships: z.array(taskRelationshipSchema).optional(),
          triggers: z.array(taskTriggerSchema).optional(),
        });
        const taskUpdateSchema = z.object({
          source: taskSourceSchema,
          id: taskIdSchema,
          patch: taskPatchSchema,
        });
        const taskImportTaskSchema = z.object({
          id: taskIdSchema.optional(),
          title: z.string().min(1),
          body: z.string().optional(),
          status: taskStatusSchema.optional(),
          type: z.string().optional(),
          assignees: z.array(z.string()).optional(),
          labels: z.array(z.string()).optional(),
          milestone: z.string().optional(),
          projects: z.array(z.string()).optional(),
          dependsOn: z.array(taskRefLikeSchema).optional(),
          relationships: z.array(taskRelationshipSchema).optional(),
          triggers: z.array(taskTriggerSchema).optional(),
        });
        const taskImportItemSchema = z.object({
          source: taskSourceSchema,
          file: z.string().min(1),
          task: taskImportTaskSchema,
        });

        const taskListTool = toolDefinition({
          name: "task_list",
          description: runtimeText.t("tool.task_list.description"),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async () => traceTool("task_list", {}, async () => ({ tasks: this.taskEngine.list() })));

        const taskGetTool = toolDefinition({
          name: "task_get",
          description: runtimeText.t("tool.task_get.description"),
          inputSchema: z.object({
            source: taskSourceSchema,
            id: z.string().min(1),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ source: taskSourceSchema, id: z.string().min(1) }).parse(rawInput);
          return traceTool("task_get", input, async () => ({
            task: this.taskEngine.get(input.source, input.id) ?? null,
          }));
        });

        const taskImportTool = toolDefinition({
          name: "task_import_markdown_batch",
          description: runtimeText.t("tool.task_import.description"),
          inputSchema: z.object({
            items: z.array(taskImportItemSchema).min(1),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ items: z.array(taskImportItemSchema).min(1) }).parse(rawInput);
          return traceTool("task_import_markdown_batch", input, async () => {
            const result = this.taskEngine.import(input.items as TaskImportItem[]);
            for (const task of result.items) {
              void this.persistTask(task).catch((error) => {
                this.emit("error", { message: error instanceof Error ? error.message : String(error) });
              });
              this.emit("taskUpdated", { task });
            }
            if (result.items.length > 0) {
              this.notifyInput("task");
            }
            return result;
          });
        });

        const taskCreateTool = toolDefinition({
          name: "task_create",
          description: runtimeText.t("tool.task_create.description"),
          inputSchema: taskCreateSchema,
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = taskCreateSchema.parse(rawInput) as TaskCreateInput;
          return traceTool("task_create", input, async () => {
            const task = this.taskEngine.create(input);
            void this.persistTask(task).catch((error) => {
              this.emit("error", { message: error instanceof Error ? error.message : String(error) });
            });
            this.emit("taskUpdated", { task });
            this.notifyInput("task");
            return task;
          });
        });

        const taskUpdateTool = toolDefinition({
          name: "task_update",
          description: runtimeText.t("tool.task_update.description"),
          inputSchema: taskUpdateSchema,
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = taskUpdateSchema.parse(rawInput) as TaskUpdateInput;
          return traceTool("task_update", input, async () => {
            const task = this.taskEngine.update(input);
            void this.persistTask(task).catch((error) => {
              this.emit("error", { message: error instanceof Error ? error.message : String(error) });
            });
            this.emit("taskUpdated", { task });
            this.notifyInput("task");
            return task;
          });
        });

        const taskDoneTool = toolDefinition({
          name: "task_done",
          description: runtimeText.t("tool.task_done.description"),
          inputSchema: z.object({
            source: taskSourceSchema,
            id: z.string().min(1),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ source: taskSourceSchema, id: z.string().min(1) }).parse(rawInput);
          return traceTool("task_done", input, async () => {
            const result = this.taskEngine.done(input.source, input.id);
            if (result.task) {
              void this.persistTask(result.task).catch((error) => {
                this.emit("error", { message: error instanceof Error ? error.message : String(error) });
              });
              this.emit("taskUpdated", { task: result.task });
            }
            for (const task of result.affected) {
              this.emit("taskUpdated", { task });
            }
            this.notifyInput("task");
            return result;
          });
        });

        const taskAddDependencyTool = toolDefinition({
          name: "task_add_dependency",
          description: runtimeText.t("tool.task_add_dependency.description"),
          inputSchema: z.object({
            source: taskSourceSchema,
            id: z.string().min(1),
            target: z.string().min(1),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({ source: taskSourceSchema, id: z.string().min(1), target: z.string().min(1) })
            .parse(rawInput);
          return traceTool("task_add_dependency", input, async () => {
            const task = this.taskEngine.addDependency(input.source, input.id, input.target);
            void this.persistTask(task).catch((error) => {
              this.emit("error", { message: error instanceof Error ? error.message : String(error) });
            });
            this.emit("taskUpdated", { task });
            this.notifyInput("task");
            return task;
          });
        });

        const taskRemoveDependencyTool = toolDefinition({
          name: "task_remove_dependency",
          description: runtimeText.t("tool.task_remove_dependency.description"),
          inputSchema: z.object({
            source: taskSourceSchema,
            id: z.string().min(1),
            target: z.string().min(1),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z
            .object({ source: taskSourceSchema, id: z.string().min(1), target: z.string().min(1) })
            .parse(rawInput);
          return traceTool("task_remove_dependency", input, async () => {
            const task = this.taskEngine.removeDependency(input.source, input.id, input.target);
            void this.persistTask(task).catch((error) => {
              this.emit("error", { message: error instanceof Error ? error.message : String(error) });
            });
            this.emit("taskUpdated", { task });
            this.notifyInput("task");
            return task;
          });
        });

        const taskTriggerManualTool = toolDefinition({
          name: "task_trigger_manual",
          description: runtimeText.t("tool.task_trigger_manual.description"),
          inputSchema: z.object({
            source: taskSourceSchema,
            id: z.string().min(1),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ source: taskSourceSchema, id: z.string().min(1) }).parse(rawInput);
          return traceTool("task_trigger_manual", input, async () => {
            const task = this.taskEngine.triggerManual(input.source, input.id);
            if (task) {
              this.emit("taskUpdated", { task });
              this.notifyInput("task");
            }
            return { task: task ?? null };
          });
        });

        const taskEmitEventTool = toolDefinition({
          name: "task_emit_event",
          description: runtimeText.t("tool.task_emit_event.description"),
          inputSchema: z.object({
            topic: z.string().min(1),
            payload: z.unknown().optional(),
          }),
          outputSchema: z.record(z.string(), z.unknown()),
        }).server(async (rawInput) => {
          const input = z.object({ topic: z.string().min(1), payload: z.unknown().optional() }).parse(rawInput);
          return traceTool("task_emit_event", input, async () => {
            const result = this.taskEngine.emitEvent({
              topic: input.topic,
              payload: input.payload,
              source: "tool",
            } satisfies TaskEventInput);
            if (result.affected.length > 0) {
              this.emit("taskTriggered", result);
              for (const task of result.affected) {
                this.emit("taskUpdated", { task });
              }
              this.notifyInput("task");
            }
            return result;
          });
        });

        return [
          taskListTool,
          taskGetTool,
          taskImportTool,
          taskCreateTool,
          taskUpdateTool,
          taskDoneTool,
          taskAddDependencyTool,
          taskRemoveDependencyTool,
          taskTriggerManualTool,
          taskEmitEventTool,
        ];
      },
    };
  }

  private async readMessageSource(request: LoopSourceReadRequest): Promise<LoopSourceReadResult> {
    const content = typeof request.ref.meta?.content === "string" ? request.ref.meta.content : "";
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
      meta: request.ref.meta ? { ...request.ref.meta } : undefined,
    };
  }

  private async toMessageAttentionDrafts(
    result: LoopSourceReadResult,
    request: LoopSourceReadRequest,
  ): Promise<AttentionDraft[]> {
    const chatId = typeof request.ref.meta?.chatId === "string" ? request.ref.meta.chatId : this.getDefaultChatId();
    const channel = this.messageSystem.getChannel(chatId);
    if (result.content.trim().length === 0 || result.content.trim() === "/compact") {
      return [];
    }
    return [
      {
        sourceRef: request.ref,
        content: result.content,
        from: typeof request.ref.meta?.from === "string" ? request.ref.meta.from : (channel?.title ?? chatId),
        score: 100,
        meta: {
          ...(request.ref.meta ? { ...request.ref.meta } : {}),
          source: "message",
          chatId,
          chatTitle: channel?.title ?? chatId,
          chatKind: channel?.kind ?? "direct",
          chatContextId: channel?.contextId ?? this.getDefaultAttentionContextId(chatId),
          chatFocused: channel?.focused ?? false,
        },
      },
    ];
  }

  private async readTerminalSource(request: LoopSourceReadRequest): Promise<LoopSourceReadResult> {
    const payload = await this.readTerminalRepresentation(request.ref.subjectId, {
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
        meta: {
          terminalId: request.ref.subjectId,
          reason: payload.reason,
        },
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
      semanticHash: this.terminalSemanticFingerprint[request.ref.subjectId] ?? null,
      viewHash: this.terminalViewFingerprint[request.ref.subjectId] ?? null,
      meta: {
        terminalId: request.ref.subjectId,
        representation: kind,
        semanticHash: this.terminalSemanticFingerprint[request.ref.subjectId] ?? null,
        viewHash: this.terminalViewFingerprint[request.ref.subjectId] ?? null,
      },
    };
  }

  private async toTerminalAttentionDrafts(
    result: LoopSourceReadResult,
    request: LoopSourceReadRequest,
  ): Promise<AttentionDraft[]> {
    if (result.content.trim().length === 0 || !hasMeaningfulTerminalAttentionPayload(result.content)) {
      return [];
    }
    return [
      {
        sourceRef: request.ref,
        content: result.content,
        from: `terminal:${request.ref.subjectId}`,
        meta: {
          terminalId: request.ref.subjectId,
          representation: result.kind,
          ...(result.meta ?? {}),
        },
        supersedeActive: {
          systemId: request.ref.systemId,
          subjectId: request.ref.subjectId,
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
    const deduped = new Set<string>();
    for (const terminalId of input) {
      if (!this.terminals.has(terminalId) || deduped.has(terminalId)) {
        continue;
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
    if (this.terminalControlPlane) {
      const next = this.terminalControlPlane.focus(op, terminalIds);
      this.focusedTerminalIds = [...next];
      this.emitFocusedTerminal();
      this.invalidateFocusedTerminals(`focus-${op}`);
      return next;
    }
    const incoming = this.normalizeFocusedTerminalIds(terminalIds);
    const current = new Set(this.focusedTerminalIds);
    switch (op) {
      case "add":
        for (const terminalId of incoming) {
          current.add(terminalId);
        }
        break;
      case "remove":
        for (const terminalId of incoming) {
          current.delete(terminalId);
        }
        break;
      case "replace":
        current.clear();
        for (const terminalId of incoming) {
          current.add(terminalId);
        }
        break;
      case "clear":
        current.clear();
        break;
    }
    this.focusedTerminalIds = [...current];
    this.emitFocusedTerminal();
    this.invalidateFocusedTerminals(`focus-${op}`);
    return [...this.focusedTerminalIds];
  }

  private resolveAttentionContextId(draft: AttentionDraft): string {
    const explicitChatId =
      typeof draft.meta?.chatId === "string"
        ? draft.meta.chatId
        : typeof draft.meta?.channelId === "string"
          ? draft.meta.channelId
          : null;
    if (explicitChatId) {
      return this.ensureAttentionContextForChannel(explicitChatId).contextId;
    }
    const systemId = draft.sourceRef.systemId;
    if (systemId === "message") {
      return this.ensureAttentionContextForChannel(this.getDefaultChatId()).contextId;
    }
    const contextId = `ctx-${systemId}-${draft.sourceRef.subjectId}`;
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
    const input = draft.meta ?? {};
    const source = typeof input.source === "string" ? input.source : draft.sourceRef.systemId;
    const chatId =
      typeof input.chatId === "string"
        ? input.chatId
        : typeof input.channelId === "string"
          ? input.channelId
          : undefined;
    return {
      ...input,
      author: draft.from,
      source,
      systemId: typeof input.systemId === "string" ? input.systemId : draft.sourceRef.systemId,
      subjectId: typeof input.subjectId === "string" ? input.subjectId : draft.sourceRef.subjectId,
      channelId: chatId,
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
    const normalizedContent = draft.content.trim();
    const presentation =
      draft.sourceRef.systemId === "terminal"
        ? (() => {
            const terminalPresentation = buildTerminalAttentionPresentation(draft.content, draft.sourceRef.subjectId);
            return {
              summary: terminalPresentation.title,
              content: terminalPresentation.detailValue,
              format: terminalPresentation.detailFormat,
              changeType: terminalPresentation.detailKind === "patch" ? ("diff" as const) : ("update" as const),
            };
          })()
        : draft.sourceRef.systemId === "task"
          ? (() => {
              const taskPresentation = buildTaskAttentionPresentation(draft.content, draft.sourceRef.subjectId);
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
              format: draft.sourceRef.systemId === "message" ? "text/markdown" : "application/json",
              changeType: "update" as const,
            };
    return {
      contextId: this.resolveAttentionContextId(draft),
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

  private enqueueLifecycleAttentionCommit(input: Parameters<SessionRuntime["commitLifecycleAttentionItem"]>[0]): void {
    void this.commitLifecycleAttentionItem(input).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("error", { message: `lifecycle attention commit failed: ${message}` });
    });
  }

  private async commitLifecycleAttentionItem(input: {
    systemId: "message" | "terminal";
    subjectId: string;
    contextId: string;
    event: string;
    summary: string;
    payload?: Record<string, unknown>;
    score?: number;
  }): Promise<void> {
    const context = this.attentionSystem.getContext(input.contextId);
    if (!context) {
      this.attentionSystem.createContext({
        contextId: input.contextId,
        owner: this.getAvatarName(),
      });
    }
    const scoreToken = this.attentionHashAliases.ensureTokenForDigest(
      buildAttentionScoreDigest(`lifecycle:${input.systemId}:${input.subjectId}:${input.event}`),
    );
    const score = Math.max(
      0,
      Math.trunc(
        input.score ??
          this.resolveLifecycleAttentionScore({
            systemId: input.systemId,
            event: input.event,
          }),
      ),
    );
    const detail = toYaml({
      event: input.event,
      systemId: input.systemId,
      subjectId: input.subjectId,
      ...input.payload,
    });
    const commit = this.attentionSystem.commit(input.contextId, {
      meta: {
        author: this.getAvatarName(),
        source: "lifecycle",
        systemId: input.systemId,
        subjectId: input.subjectId,
        channelId: input.systemId === "message" ? input.subjectId : undefined,
        lifecycleEvent: input.event,
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
      .filter((commit) => commit.meta.systemId === supersede.systemId && commit.meta.subjectId === supersede.subjectId);
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
          systemId: supersede.systemId,
          subjectId: supersede.subjectId,
          supersededAt,
          supersededReason: "source-refresh",
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
    this.markAttentionContextDirty(contextId);
    this.recordAttentionCommitTrace(contextId, commit, input);
    this.attentionFactsVersion += 1;
    const externalAttentionIngress = commit.meta.source !== "attention";
    if (externalAttentionIngress) {
      this.clearAttentionContainment(contextId);
      this.resetAttentionDebtBackoff();
    }
    await this.persistAttentionSystem();
    this.markActiveCycleProducedCommitRef(contextId, commit.commitId);
    this.emitAttentionState();
    if (input.notifyLoop && externalAttentionIngress) {
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
      const sourceKey = `${draft.sourceRef.systemId}:${draft.sourceRef.subjectId}`;
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
    if (!this.sessionDb || typeof (input as { cycleId?: number }).cycleId !== "number") {
      return null;
    }
    const nextInput = input as Omit<SessionDbLoopbusTraceRecord, "id" | "seq">;
    const existingRowId = this.traceRowIdBySpanId.get(nextInput.spanId);
    const current = existingRowId === undefined ? null : this.sessionDb.getLoopTraceById(existingRowId);
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
        ? this.sessionDb.appendLoopTrace({
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
          })
        : this.sessionDb.updateLoopTrace(existingRowId, {
            parentSpanId: mergedInput.parentSpanId,
            status: mergedInput.status,
            endedAt: mergedInput.endedAt,
            refs: mergedInput.refs,
            links: mergedInput.links,
            events: mergedInput.events,
            attributes: mergedInput.attributes,
            outcome: mergedInput.outcome,
          });
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
        refs: event.refs ? mergeTraceRefs(event.refs) : undefined,
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
    const refs: SessionTraceRef[] = [
      createTraceRef("source.read", `${draft.sourceRef.systemId}:${draft.sourceRef.subjectId}`, {
        label: draft.sourceRef.reason,
        attributes: {
          systemId: draft.sourceRef.systemId,
          subjectId: draft.sourceRef.subjectId,
          reason: draft.sourceRef.reason,
        },
      }),
    ];
    const channelId = typeof draft.meta?.chatId === "string" ? draft.meta.chatId : undefined;
    if (channelId) {
      refs.push(toMessageChannelTraceRef(channelId));
    }
    if (draft.sourceRef.systemId === "terminal") {
      refs.push(toTerminalTraceRef(draft.sourceRef.subjectId));
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
    const refs: SessionTraceRef[] = [
      toAttentionContextTraceRef(contextId),
      toAttentionCommitTraceRef(contextId, commit.commitId),
    ];
    if (typeof commit.meta.channelId === "string" && commit.meta.channelId.length > 0) {
      refs.push(toMessageChannelTraceRef(commit.meta.channelId));
    }
    if (
      typeof commit.meta.systemId === "string" &&
      typeof commit.meta.channelId === "string" &&
      commit.meta.subjectId === commit.meta.channelId
    ) {
      refs.push(toMessageChannelTraceRef(commit.meta.channelId));
    }
    if (commit.meta.systemId === "terminal" && typeof commit.meta.subjectId === "string") {
      refs.push(toTerminalTraceRef(commit.meta.subjectId));
    }
    return mergeTraceRefs(refs);
  }

  private recordDraftSourceReadTrace(draft: AttentionDraft, contextId: string, commitId: string): void {
    this.queuePendingTraceSpan({
      traceId: createTraceId(),
      spanId: createSpanId(),
      parentSpanId: null,
      kind: "source.read",
      name: `${draft.sourceRef.systemId}.read`,
      status: "done",
      startedAt: Date.now(),
      endedAt: Date.now(),
      refs: this.buildDraftTraceRefs(draft, { contextId, commitId }),
      links: [],
      events: [
        createTraceEvent("attention.draft.loaded", {
          status: "ok",
          attributes: {
            source: draft.sourceRef.systemId,
            subjectId: draft.sourceRef.subjectId,
          },
        }),
      ],
      attributes: {
        systemId: draft.sourceRef.systemId,
        subjectId: draft.sourceRef.subjectId,
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
      name: "attention_commit",
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
    if (!this.sessionDb) {
      return;
    }
    for (const cycle of this.sessionDb.listCurrentBranchCycles(limit)) {
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
    if (!this.sessionDb) {
      return;
    }
    const cycle = this.sessionDb.getCycleById(cycleId);
    if (!cycle) {
      return;
    }
    const frame = this.attentionCycleFrames.get(cycleId);
    const hooks = this.recentAttentionHooks.filter((record) => record.cycleId === cycleId);
    this.sessionDb.updateCycle(cycleId, {
      extendsRecord: {
        ...cycle.extendsRecord,
        attention: this.attentionSystem.snapshot(),
        attentionCycleFrame: frame ? cloneAttentionCycleFrame(frame) : undefined,
        attentionHooks: hooks.map(cloneAttentionHookRecord),
      },
    });
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

  private serializeAttentionItemsInput(contextId: string, commits: readonly AttentionCommit[]): string {
    return mdFence(
      "yaml+attention_items",
      toYaml({
        contextId,
        commits: commits.map((commit) => ({
          commitId: commit.commitId,
          parentCommitIds: [...commit.parentCommitIds],
          meta: { ...commit.meta },
          scores: { ...commit.scores },
          summary: commit.summary,
          change: commit.change.type === "clean" ? { type: "clean" } : { ...commit.change },
          createdAt: commit.createdAt,
        })),
      }),
    );
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
      systemId: result.systemId,
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
        name: result.systemId,
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
              systemId: record.systemId,
              status: record.status,
            },
          }),
        ],
        attributes: {
          hookId: record.hookId,
          systemId: record.systemId,
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
    this.config = await resolveSessionConfig(this.options.cwd, {
      avatar: this.options.avatar,
    });
    this.focusedTerminalIds = [...this.config.focusedTerminalIds];
    this.terminalControlPlane = new TerminalControlPlane({
      outputRoot: join(this.options.sessionRoot, "logs", "terminals"),
      initialConfig: {
        transport: {
          port: 0,
        },
      },
    });
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
    await this.persistAttentionSystem();
    if (this.attentionSystem.listActiveContexts().length > 0) {
      this.attentionFactsVersion += 1;
      this.resetAttentionDebtBackoff();
      this.notifyInput("attention");
    }
    if (this.messageSystemCleanup.length === 0) {
      this.bindMessageSystem();
    }
    this.ensureDefaultChatChannel();
    this.settingsEditor = new SettingsEditor(this.config.agentCwd, {
      agenterPath: this.config.prompt.agenterPath,
      agenterSystemPath: this.config.prompt.agenterSystemPath,
      systemTemplatePath: this.config.prompt.systemTemplatePath,
      responseContractPath: this.config.prompt.responseContractPath,
    });
    await this.reloadSettingsLayers();

    for (const [terminalId, terminalConfig] of Object.entries(this.config.terminals)) {
      await this.createTerminal(terminalId, terminalConfig);
    }
    this.requireTerminalControlPlane().focus("replace", this.focusedTerminalIds);
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

    const resourceLoader = new ResourceLoader({
      context: {
        projectRoot: this.config.agentCwd,
        cwd: this.config.agentCwd,
      },
    });

    const promptStore = new FilePromptStore({
      lang: this.config.lang,
      rootDir: this.config.prompt.rootDir,
      agenterPath: this.config.prompt.agenterPath,
      agenterSystemPath: this.config.prompt.agenterSystemPath,
      systemTemplatePath: this.config.prompt.systemTemplatePath,
      responseContractPath: this.config.prompt.responseContractPath,
      loader: resourceLoader,
    });

    await promptStore.reload();

    const modelClient = new ModelClient({
      providerId: this.config.ai.providerId,
      apiStandard: this.config.ai.apiStandard,
      vendor: this.config.ai.vendor,
      profile: this.config.ai.profile,
      extensions: this.config.ai.extensions,
      lang: this.config.lang,
      apiKey: this.config.ai.apiKey,
      apiKeyEnv: this.config.ai.apiKeyEnv,
      model: this.config.ai.model,
      baseUrl: this.config.ai.baseUrl,
      headers: this.config.ai.headers,
      temperature: this.config.ai.temperature,
      maxRetries: this.config.ai.maxRetries,
      maxToken: this.config.ai.maxToken,
      compactThreshold: this.config.ai.compactThreshold,
    });

    this.taskSources = resolveTaskSources({
      homeDir: homedir(),
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
        storeTarget: this.options.storeTarget,
      },
    });
    this.sessionStore = sessionStore;
    this.sessionDb = new SessionDb(join(this.options.sessionRoot, "session.db"));
    this.restoreAttentionRuntimeHistory();
    const restoredChat = this.sessionDb.listBlocksAfter(0, 200);
    const restoredChatIds = new Map<number, string>();
    const resolveRestoredChatId = (item: SessionDbChatMessageRecord): string => {
      if (item.cycleId === null) {
        return DEFAULT_CHAT_ID;
      }
      const cached = restoredChatIds.get(item.cycleId);
      if (cached) {
        return cached;
      }
      const chatId = resolveSessionBlockChatId({
        block: item,
        getCycleById: (cycleId) => this.sessionDb?.getCycleById(cycleId) ?? null,
        fallback: DEFAULT_CHAT_ID,
      });
      restoredChatIds.set(item.cycleId, chatId);
      return chatId;
    };
    this.chatMessages = restoredChat.map((item) => this.toChatMessage(item, resolveRestoredChatId(item)));
    const head = this.sessionDb.getHead();
    this.activeCycleId = head.headCycleId;
    this.activeModelCallId = null;
    this.updateLoopKernelSnapshot({
      phase: "waiting_commits",
      currentCycleId: head.headCycleId,
      lastWakeSource: null,
      lastError: null,
    });
    this.emitAttentionState();

    const agent = new AgenterAI({
      modelClient,
      promptStore,
      sessionStore,
      resolveImageAttachment: async (attachment) => this.readImageAttachmentSource(attachment.assetId),
      onAssistantStream: (stream) => {
        this.handleAssistantStreamUpdate(stream);
      },
      onModelCall: async (record) => {
        await this.handleModelCall(record);
      },
      logger: this.options.logger ?? { log: () => {} },
      locale: this.config.lang,
      toolProviders: this.createAgentToolProviders(),
      attentionGateway: {
        listContexts: () => this.attentionSystem.listContexts(),
        listActive: () => this.attentionSystem.listActiveContexts(),
        query: async (input: AttentionQueryInput) => this.attentionSystem.query(input),
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
            ? await agent.runCompactCycle({ trigger: compactTrigger ?? "manual", signal: context?.signal }).then(() => undefined)
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
    this.sessionStore?.setLifecycle({ status });
  }

  resume(): void {
    if (!this.started) {
      return;
    }
    this.runtime?.resume();
    this.sessionStore?.setLifecycle({ status: "running" });
  }

  async abort(): Promise<void> {
    if (!this.started) {
      return;
    }
    if (this.activeCycle && this.loopPhase !== "waiting_commits") {
      this.abortingActiveCycle = true;
    }
    // Wake commit waiters before tearing down the bus so idle runtimes can stop promptly.
    this.notifyInput("attention");
    await this.runtime?.stop("session.abort");
    this.runtime = null;
    this.agent = null;
    this.loopPluginRuntime = null;
    this.sessionStore?.setLifecycle({ status: "stopped" });
    this.apiCallRecordingRefCount = 0;

    await this.terminalControlPlane?.dispose();
    this.terminalControlPlane = null;
    this.terminals.clear();
    this.taskAttentionDraftQueue.length = 0;
    this.inboundMessageQueue.length = 0;
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
    this.messageSystem.close();
    this.sessionDb?.close();
    this.sessionDb = null;
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
    return this.sessionDb.listModelCallsAfter(afterId, limit);
  }

  listModelCallsBefore(beforeId: number, limit = 200): Array<SessionModelCallRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listModelCallsBefore(beforeId, limit);
  }

  listCurrentBranchCycles(limit = 200) {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listCurrentBranchCycles(limit);
  }

  async rollbackToCycle(cycleId: number): Promise<{ ok: boolean; cycleId?: number; reason?: string }> {
    if (!this.sessionDb) {
      return { ok: false, reason: "session db not initialized" };
    }
    const cycle = this.sessionDb.getCycleById(cycleId);
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

    this.sessionDb.setHead(cycleId);
    this.activeCycleId = cycleId;
    this.activeModelCallId = null;
    this.pendingTraceSpans.length = 0;
    this.traceRowIdBySpanId.clear();
    this.runningTraceRowsByName.clear();
    this.restoreAttentionRuntimeHistory();
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
    return this.sessionDb.listApiCallsAfter(afterId, limit);
  }

  listApiCallsBefore(beforeId: number, limit = 200): Array<SessionDbApiCallRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listApiCallsBefore(beforeId, limit);
  }

  inspectModelDebug(): SessionRuntimeModelDebug {
    const modelState = this.agent?.inspectDebugState();
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
            maxRetries: this.config.ai.maxRetries,
            maxToken: this.config.ai.maxToken,
            compactThreshold: this.config.ai.compactThreshold,
            capabilities: resolveModelCapabilities(this.config.ai),
          }
        : null,
      promptWindow: modelState?.promptWindow ?? [],
      stats: modelState?.stats ?? null,
      latestModelCall: this.sessionDb?.listModelCalls(1)[0] ?? null,
      recentModelCalls: this.sessionDb?.listModelCalls(8) ?? [],
      recentApiCalls: this.sessionDb?.listApiCallsAfter(0, 12) ?? [],
    };
  }

  listChatMessages(afterId = 0, limit = 200): Array<SessionDbChatMessageRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listBlocksAfter(afterId, limit);
  }

  pageChatMessages(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbChatMessageRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listBlocksPage(input);
  }

  listChatMessagesBefore(beforeId: number, limit = 200): Array<SessionDbChatMessageRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listBlocksBefore(beforeId, limit);
  }

  listLoopbusStateLogs(afterId = 0, limit = 200): Array<SessionDbLoopbusStateLogRecord> {
    if (!this.sessionDb) {
      return [];
    }
    const page = this.sessionDb.listLoopStateLogsPage({ limit });
    return page.items.filter((item) => item.id > afterId);
  }

  listLoopbusStateLogsBefore(beforeId: number, limit = 200): Array<SessionDbLoopbusStateLogRecord> {
    if (!this.sessionDb || beforeId <= 0) {
      return [];
    }
    const before = this.sessionDb.getLoopStateLogById(beforeId);
    if (!before) {
      return [];
    }
    return this.sessionDb.listLoopStateLogsPage({
      before: {
        beforeTimeMs: before.timestamp,
        beforeId: before.id,
      },
      limit,
    }).items;
  }

  pageLoopbusStateLogs(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbLoopbusStateLogRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listLoopStateLogsPage(input);
  }

  listLoopbusTraces(afterId = 0, limit = 200): Array<SessionDbLoopbusTraceRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listLoopTracesAfter(afterId, limit);
  }

  listLoopbusTracesBefore(beforeId: number, limit = 200): Array<SessionDbLoopbusTraceRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listLoopTracesBefore(beforeId, limit);
  }

  pageLoopbusTraces(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbLoopbusTraceRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listLoopTracesPage(input);
  }

  listLoopbusTracesByRef(ref: string, limit = 200): Array<SessionDbLoopbusTraceRecord> {
    if (!this.sessionDb) {
      return [];
    }
    return this.sessionDb.listLoopTracesByRef(ref, limit);
  }

  inspectAttentionState(): SessionRuntimeAttentionState {
    return this.buildAttentionRuntimeState();
  }

  queryAttention(input: AttentionQueryInput): AttentionCommitMatch[] {
    return this.attentionSystem.query(input);
  }

  pageModelCalls(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionModelCallRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listModelCallsPage(input);
  }

  pageApiCalls(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionDbApiCallRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listApiCallsPage(input);
  }

  pageCurrentBranchCycles(input?: {
    before?: SessionDbReverseTimeCursor;
    limit?: number;
  }): SessionDbReversePage<SessionCycleRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listCurrentBranchCyclesPage(input);
  }

  pageTerminalActivity(
    terminalId: string,
    input?: {
      before?: SessionDbReverseTimeCursor;
      limit?: number;
    },
  ): SessionDbReversePage<SessionDbTerminalActivityRecord> {
    if (!this.sessionDb) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.sessionDb.listTerminalActivityPage(terminalId, input);
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
    await this.reloadSettingsLayers();
    return {
      ok: true,
      file: result.file,
      effective: {
        content: this.settingsEffective,
      },
    };
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
    return this.settingsEditor.save(kind, content, baseMtimeMs);
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
  }): void {
    const channel = this.messageSystem.getChannel(input.chatId);
    if (!channel) {
      throw new Error(`unknown chat channel: ${input.chatId}`);
    }
    const attachments = this.resolveChatAttachments(input.assetIds ?? []);
    this.messageSystem.sendAuthorized({
      chatId: input.chatId,
      accessToken: input.accessToken,
      messageId: input.clientMessageId,
      from: "User",
      to: channel.owner,
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
      messageId: input.clientMessageId,
      from: this.getAvatarName(),
      to: channel.owner,
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
      messageId: input.clientMessageId,
      from: this.getAvatarName(),
      to: channel.owner,
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

    const channel = this.ensureDefaultChatChannel();
    this.sendMessageChannel({
      chatId: channel.chatId,
      accessToken: channel.accessToken,
      text,
      assetIds,
      clientMessageId,
    });
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

  focusTerminal(terminalId: string): boolean {
    return this.focusRuntimeTerminals({ op: "add", terminalIds: [terminalId] }).ok;
  }

  snapshot(): SessionRuntimeSnapshot {
    const planeEntries = new Map(
      this.terminalControlPlane?.list().map((entry) => [entry.terminalId, entry] as const) ?? [],
    );
    const configuredIds = new Set<string>();
    const terminals = Object.values(this.config?.terminals ?? {}).map((terminal) => {
      configuredIds.add(terminal.terminalId);
      const managed = this.terminals.get(terminal.terminalId);
      const snapshot = managed?.getSnapshot();
      const planeEntry = planeEntries.get(terminal.terminalId);
      return {
        terminalId: terminal.terminalId,
        running: managed?.isRunning() ?? false,
        status: managed?.getStatus() ?? "IDLE",
        seq: snapshot?.seq ?? 0,
        cwd: terminal.cwd,
        icon: planeEntry?.icon,
        title: planeEntry?.title,
        shortcuts: planeEntry?.shortcuts,
        transportUrl: planeEntry?.transportUrl,
      };
    });
    for (const entry of planeEntries.values()) {
      if (configuredIds.has(entry.terminalId)) {
        continue;
      }
      terminals.push({
        terminalId: entry.terminalId,
        running: entry.running,
        status: entry.status,
        seq: entry.seq,
        cwd: entry.cwd,
        icon: entry.icon,
        title: entry.title,
        shortcuts: entry.shortcuts,
        transportUrl: entry.transportUrl,
      });
    }

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
    },
  ): Promise<TerminalReadPayload> {
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
            this.terminalReads[terminalId] = diffPayload;
            this.emit("terminalRead", { terminalId, result: diffPayload });
            this.appendTerminalActivity({
              terminalId,
              kind: "terminal_read",
              cycleId: this.activeCycleId,
              title: "Terminal read",
              content: JSON.stringify(diffPayload),
              detail: diffPayload,
            });
            return diffPayload;
          }
        }
      }

      if (input.remark) {
        this.terminalDirtyState[terminalId] = false;
        this.dirtyQueue.delete(terminalId);
      }
      this.terminalReads[terminalId] = snapshotPayload;
      this.emit("terminalRead", { terminalId, result: snapshotPayload });
      this.appendTerminalActivity({
        terminalId,
        kind: "terminal_read",
        cycleId: this.activeCycleId,
        title: "Terminal read",
        content: JSON.stringify(snapshotPayload),
        detail: snapshotPayload,
      });
      return snapshotPayload;
    }
    const payload = await controlPlane.read(terminalId, input.mode, { remark: input.remark });
    if (input.remark) {
      this.terminalDirtyState[terminalId] = false;
      this.dirtyQueue.delete(terminalId);
    }
    this.terminalReads[terminalId] = payload;
    this.emit("terminalRead", { terminalId, result: payload });
    this.appendTerminalActivity({
      terminalId,
      kind: "terminal_read",
      cycleId: this.activeCycleId,
      title: "Terminal read",
      content: JSON.stringify(payload),
      detail: payload,
    });
    return payload;
  }

  private async createTerminal(terminalId: string, config: SessionTerminalConfig): Promise<void> {
    const controlPlane = this.requireTerminalControlPlane();
    if (!controlPlane.has(terminalId)) {
      await controlPlane.create({
        terminalId,
        command: config.command,
        cwd: config.cwd,
        profile: {
          cols: 80,
          rows: 24,
          gitLog: config.gitLog,
          logStyle: "rich",
        },
        start: false,
      });
    }
    const terminal = controlPlane.getManagedTerminal(terminalId);
    if (!terminal) {
      return;
    }
    this.attachRuntimeTerminal(terminalId, terminal);
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
      this.emit("terminalStatus", { terminalId, running, status });
    });

    this.terminals.set(terminalId, terminal);
  }

  private requireTerminalControlPlane(): TerminalControlPlane {
    if (!this.terminalControlPlane) {
      throw new Error("terminal control plane is not initialized");
    }
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
    if (this.inboundMessageQueue.length > 0 || this.taskAttentionDraftQueue.length > 0) {
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
    const loopPaused = this.runtime?.getLoopState().paused ?? false;
    const hasPendingAttention = this.hasPendingAttentionInputs();
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
    if (this.inputSignals.task.current() > this.inputSignalCursor.task) {
      this.loopKernelLastWakeCause = "task_input";
      this.resetAttentionDebtBackoff();
      return "task";
    }
    if (hasPendingAttention) {
      this.loopKernelLastWakeCause = "attention_commit";
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

    const promises: Array<Promise<{ kind: LoopInputKind }>> = [
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
      this.loopKernelLastWakeCause ??= "attention_commit";
      this.resetAttentionDebtBackoff();
    }

    for (const item of terminalHandles) {
      item.handle.reject(IGNORE_WAIT);
    }
    for (const waiter of signalWaiters) {
      waiter.cancel();
    }
    return winner.kind;
  }

  private async collectLoopInputs(): Promise<LoopBusInput[] | undefined> {
    await this.pollTaskSources("watch");
    await this.pollTaskEventInbox();
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
        meta: {
          triggerSource: triggered.source,
          topic: triggered.topic,
          affectedTaskKeys: triggered.affected.map((task) => task.key),
        },
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
          .map(
            (item): AttentionDraft => ({
              sourceRef: this.createMessageSourceRef({
                chatId: this.getDefaultChatId(),
                messageId: item.id ?? createId(),
                from: item.name,
                content: item.text,
                attachments: item.attachments ?? [],
                meta: item.meta,
              }),
              content: item.text,
              from: item.name,
              score: 100,
              meta: item.meta ?? undefined,
            }),
          );
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
      if (this.attentionFactsVersion > this.attentionFactsSentVersion) {
        this.attentionFactsSentVersion = this.attentionFactsVersion;
      }
      return undefined;
    }

    for (const match of selected) {
      this.clearDirtyAttentionContext(match.contextId);
    }
    if (this.attentionFactsVersion > this.attentionFactsSentVersion) {
      this.attentionFactsSentVersion = this.attentionFactsVersion;
    }

    const protocolState = this.buildAttentionProtocolState();
    const outputs: LoopBusInput[] = [];
    for (const match of selected) {
      const protocol = protocolState.get(match.contextId) ?? { bootstrapped: false, lastSeenCommitId: null };
      const commits = this.selectAttentionProtocolCommits(match, protocol.lastSeenCommitId);
      const channel = this.resolveMessageChannelForContext(match.contextId);
      const chatId = channel?.chatId ?? this.resolveMessageChatIdForContext(match.contextId);
      const commonMeta = {
        attentionContextId: match.contextId,
        attentionHeadCommitId: match.context.headCommitId,
        owner: match.context.owner,
        createdAt: match.context.updatedAt,
        ...(channel ? { chatFocused: channel.focused } : {}),
        ...(chatId ? { chatId } : {}),
      };
      if (!protocol.bootstrapped) {
        outputs.push({
          name: `AttentionContext-${match.contextId}`,
          role: "user",
          type: "text",
          source: "attention",
          text: serializeAttentionActiveContext(match),
          meta: {
            ...commonMeta,
            attentionProtocolKind: "context",
          },
        });
      }
      if (commits.length > 0) {
        outputs.push({
          name: `AttentionItems-${match.contextId}`,
          role: "user",
          type: "text",
          source: "attention",
          text: this.serializeAttentionItemsInput(match.contextId, commits),
          meta: {
            ...commonMeta,
            attentionProtocolKind: "items",
            attentionCommitIds: serializeAttentionCommitIds(commits.map((commit) => commit.commitId)) ?? null,
          },
        });
      }
    }
    return outputs.length > 0 ? outputs : undefined;
  }

  private resolveMessageChannelForContext(contextId: string): MessageControlPlaneEntry | null {
    return this.messageSystem.listChannels().find((entry) => entry.contextId === contextId) ?? null;
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
      sourceRef: this.createTaskSourceRef("heartbeat", "task-heartbeat", {
        activeCount: active.length,
      }),
      content: JSON.stringify({
        kind: "task-heartbeat",
        timestamp: new Date(now).toISOString(),
        activeCount: active.length,
        byStatus,
        top,
      }),
      meta: {
        source: "task",
        activeCount: active.length,
      },
      from: "task-system",
      supersedeActive: {
        systemId: "task",
        subjectId: "heartbeat",
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
          meta: {
            sourceName: item.name,
            sourcePath: item.path,
            file,
            taskSourceEvent: source,
            semanticHash: createHash("sha256").update(markdown).digest("hex"),
          },
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
    channelOverride?: SessionDbChatMessageRecord["channel"],
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
    this.chatMessages.push(nextMessage);
    this.trimChat();
    this.emit("chat", nextMessage);
    if (!this.sessionDb) {
      return;
    }
    const persistedCycleId = nextMessage.cycleId ?? cycleId;
    const channel = channelOverride ?? nextMessage.channel ?? (nextMessage.role === "user" ? "user_input" : "to_user");
    const block = this.sessionDb.appendBlock({
      cycleId: persistedCycleId,
      createdAt: nextMessage.timestamp,
      role: nextMessage.role,
      channel,
      format: nextMessage.format ?? "markdown",
      content: nextMessage.content,
      tool: nextMessage.tool,
    });
    if (nextMessage.attachments && nextMessage.attachments.length > 0) {
      this.sessionDb.linkBlockAssets(
        block.id,
        nextMessage.attachments.map((attachment) => attachment.assetId),
      );
    }
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

  private toChatMessage(record: SessionDbChatMessageRecord, chatId = DEFAULT_CHAT_ID): ChatMessage {
    return {
      id: `${record.id}`,
      chatId,
      role: record.role,
      content: record.content,
      timestamp: record.createdAt,
      cycleId: record.cycleId,
      channel: record.channel === "user_input" ? undefined : record.channel,
      format: record.format,
      tool: record.tool,
      attachments: record.attachments.map((attachment) => toChatSessionAsset(this.options.sessionId, attachment)),
    };
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
    if (!this.sessionDb) {
      return null;
    }
    return this.sessionDb.appendTerminalActivity(input);
  }

  private appendTerminalActivityForMessage(
    message: ChatMessage,
    cycleId: number | null,
    channel: SessionDbChatMessageRecord["channel"],
  ): void {
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

    const previousHead = this.sessionDb.getHead().headCycleId;
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
          .map((item) => item.meta?.attentionContextId)
          .filter((contextId): contextId is string => typeof contextId === "string"),
      ),
    ];
    const inputCommitRefs = dedupeAttentionCommitRefs(
      collectedInputs.flatMap((item) => {
        if (item.source !== "attention") {
          return [];
        }
        const contextId = typeof item.meta?.attentionContextId === "string" ? item.meta.attentionContextId : null;
        if (!contextId) {
          return [];
        }
        return parseAttentionCommitIds(item.meta?.attentionCommitIds).map((commitId) => ({
          contextId,
          commitId,
        }));
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

    const cycle = this.sessionDb.appendCycle({
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
    });
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
    this.sessionDb.setHead(cycle.id);
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
    const entry = this.sessionDb?.appendLoopStateLog({
      timestamp: next.updatedAt,
      stateVersion: next.stateVersion,
      event: input.phase,
      prevHash: previousHash,
      stateHash: nextHash,
      patch,
    });
    if (entry) {
      this.emit("schedulerLog", { entry });
    }
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

  private handleAssistantStreamUpdate(input: AssistantStreamUpdate): void {
    if (!this.activeCycle) {
      return;
    }
    switch (input.kind) {
      case "draft":
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
    await Promise.all([
      this.attentionStore.save(this.attentionSystem.snapshot()),
      this.attentionHashAliasStore.save(this.attentionHashAliases.snapshot()),
    ]);
  }

  private async handleModelCall(record: AgentModelCallRecord): Promise<void> {
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
    const existingModelCallId =
      this.activeModelCallId ?? this.sessionDb.getModelCallByCycleId(this.activeCycleId)?.id ?? null;
    const modelCall =
      record.status === "running" || existingModelCallId === null
        ? this.sessionDb.appendModelCall({
            cycleId: this.activeCycleId,
            createdAt: record.timestamp,
            status: record.status,
            completedAt: record.completedAt,
            provider: record.provider,
            model: record.model,
            request: record.request,
            response: record.response,
            error: record.error,
            trace: traceIdentity,
            outcome: record.outcome,
          })
        : this.sessionDb.updateModelCall(existingModelCallId, {
            status: record.status,
            completedAt: record.completedAt ?? null,
            response: record.response,
            error: record.error,
            trace: traceIdentity,
            outcome: record.outcome,
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
        refs: mergeTraceRefs(traceRow.refs, [toModelCallTraceRef(modelCall.id)]),
        links: traceRow.links,
        events: traceRow.events,
        attributes: {
          ...traceRow.attributes,
          provider: modelCall.provider,
          model: modelCall.model,
        },
        outcome: record.outcome ?? traceRow.outcome,
      });
    }
    this.activeModelCallId = record.status === "running" ? modelCall.id : (this.activeModelCallId ?? modelCall.id);
    if (this.activeCycleId !== null) {
      const frame = this.attentionCycleFrames.get(this.activeCycleId);
      if (frame && !frame.modelCallIds.includes(modelCall.id)) {
        frame.modelCallIds = [...frame.modelCallIds, modelCall.id];
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
      modelCallId: modelCall.id,
      status: modelCall.status === "error" ? "error" : this.activeCycle?.status,
    });
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
    this.emit("modelCall", { entry: modelCall });
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
          refs: mergeTraceRefs(this.buildCycleTraceRefs(this.activeCycleId), [toModelCallTraceRef(modelCall.id)]),
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
    }
    if (!this.isApiCallRecordingEnabled()) {
      return;
    }
    const apiRow = this.sessionDb.appendApiCall({
      modelCallId: modelCall.id,
      createdAt: record.timestamp,
      request: record.request,
      response: record.response,
      error: record.error,
    });
    this.emit("apiCall", {
      entry: apiRow,
    });
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

  private async reloadSettingsLayers(): Promise<void> {
    const config = this.config;
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
