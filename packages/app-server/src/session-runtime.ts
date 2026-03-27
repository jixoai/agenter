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
  type TaskSourceName,
  type TaskSourceResolved,
  type TaskView,
} from "@agenter/task-system";
import {
  TerminalControlPlane,
  type TerminalReadResult as ControlPlaneTerminalReadResult,
} from "@agenter/terminal-system";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { createRuntimeAttentionPreview } from "./attention-runtime-view";

import { AgentRuntime } from "./agent-runtime";
import { AgenterAI, type AgentModelCallRecord, type AgentRuntimeStats } from "./agenter-ai";
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
const ATTENTION_DEBT_INITIAL_BACKOFF_MS = 600;
const ATTENTION_DEBT_MAX_BACKOFF_MS = 5_000;
const ATTENTION_DEBT_BACKOFF_MULTIPLIER = 2;
const ATTENTION_FAILURE_BLOCK_THRESHOLD = 2;

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
  status: "backoff" | "blocked";
  nextWakeAt: number | null;
  blockedReason: string | null;
  updatedAt: number;
}

interface AttentionContainmentSummary {
  state: "none" | "ready" | "backoff" | "blocked";
  nextWakeAt: number | null;
  retryCount: number;
  blockedReason: string | null;
}

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
  if (value.length <= MAX_TERMINAL_ATTENTION_DETAIL_CHARS) {
    return value;
  }
  const remaining = value.length - MAX_TERMINAL_ATTENTION_DETAIL_CHARS;
  return `${value.slice(0, MAX_TERMINAL_ATTENTION_DETAIL_CHARS)}\n... [truncated ${remaining} chars]`;
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

const buildLiveToolCallMarkdown = (toolName: string, input: unknown, timestamp: number): string =>
  mdFence(
    "yaml+tool_call",
    toYaml({
      tool: toolName,
      input,
      timestamp: new Date(timestamp).toISOString(),
    }),
  );

const buildLiveToolResultMarkdown = (
  toolName: string,
  input: {
    ok: boolean;
    output?: unknown;
    error?: string | null;
    timestamp: number;
  },
): string =>
  mdFence(
    "yaml+tool_result",
    toYaml({
      tool: toolName,
      ok: input.ok,
      output: input.output ?? null,
      error: input.error ?? null,
      timestamp: new Date(input.timestamp).toISOString(),
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
  history: ReturnType<AgenterAI["inspectDebugState"]>["history"];
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
  private readonly taskSourceQueue: LoopBusInput[] = [];
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
  private readonly pendingTraceSpans: PendingTraceSpan[] = [];
  private readonly traceRowIdBySpanId = new Map<string, number>();
  private readonly runningTraceRowsByName = new Map<string, SessionDbLoopbusTraceRecord>();
  private readonly cycleReplyChatIds = new Map<number, string>();
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
    const created = this.messageSystem.createChannel({
      chatId,
      kind: "direct",
      title: "Chat",
      owner: avatar,
      contextId: context.contextId,
      participants: [
        { id: `avatar:${avatar}`, label: avatar, role: "avatar" },
        { id: "user", label: "User", role: "user" },
      ],
      metadata: { builtIn: true },
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

  listMessageChannels(): MessageControlPlaneEntry[] {
    this.ensureDefaultChatChannel();
    return this.messageSystem.listChannels();
  }

  createMessageChannel(input: {
    kind: MessageChannelKind;
    title?: string;
    participants?: Array<{
      id: string;
      label?: string;
      role?: "avatar" | "user" | "system";
    }>;
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
      metadata: { builtIn: false },
    });
    if (input.focus ?? true) {
      this.messageSystem.focus("replace", [chatId]);
      return this.messageSystem.getChannel(chatId) ?? channel;
    }
    return channel;
  }

  focusMessageChannels(input: {
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken: string }>;
  }): MessageControlPlaneEntry[] {
    this.messageSystem.focusAuthorized(input.op, input.channels);
    return this.messageSystem.listChannels();
  }

  updateMessageChannel(input: {
    chatId: string;
    accessToken: string;
    patch: MessageChannelPatchInput;
  }): MessageControlPlaneEntry {
    return this.messageSystem.updateChannelAuthorized(input);
  }

  listMessageChannelGrants(input: { chatId: string; accessToken: string }): MessageChannelGrantRecord[] {
    return this.messageSystem.listChannelGrantsAuthorized(input);
  }

  issueMessageChannelGrant(
    input: { chatId: string; accessToken: string } & MessageIssueGrantInput,
  ): MessageIssuedGrant {
    return this.messageSystem.issueChannelGrantAuthorized(input);
  }

  revokeMessageChannelGrant(input: { chatId: string; accessToken: string; grantId: string }): { ok: boolean } {
    return this.messageSystem.revokeChannelGrantAuthorized(input);
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
    if (message.chatId) {
      meta.chatId = message.chatId;
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
    this.attentionHashAliases = new AttentionHashAliasRegistry(this.mergeBootAttentionHashAliases(persistedHashAliases));
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
      onAssistantLiveMessage: async (message) => {
        this.updateActiveCycle({
          status: "streaming",
          streaming: {
            content: message.content,
          },
        });
      },
      logger: this.options.logger ?? { log: () => {} },
      locale: this.config.lang,
      terminalGateway: {
        list: () => {
          const planeEntries = new Map(
            this.requireTerminalControlPlane()
              .list()
              .map((entry) => [entry.terminalId, entry] as const),
          );
          const configured = Object.values(this.config?.terminals ?? {}).map((terminal) => {
            const entry = planeEntries.get(terminal.terminalId);
            return {
              terminalId: terminal.terminalId,
              running: entry?.running ?? false,
              cwd: entry?.cwd ?? terminal.cwd,
              cols: entry ? this.requireTerminalControlPlane().getSnapshot(terminal.terminalId).cols : 0,
              rows: entry ? this.requireTerminalControlPlane().getSnapshot(terminal.terminalId).rows : 0,
              focused: this.focusedTerminalIds.includes(terminal.terminalId),
              dirty: this.terminalDirtyState[terminal.terminalId] ?? false,
              latestSeq: this.terminalLatestSeq[terminal.terminalId] ?? 0,
              icon: entry?.icon,
              title: entry?.title,
              shortcuts: entry?.shortcuts,
              transportUrl: entry?.transportUrl,
            };
          });
          const dynamic = this.requireTerminalControlPlane()
            .list()
            .filter((entry) => !this.config?.terminals[entry.terminalId])
            .map((entry) => ({
              terminalId: entry.terminalId,
              running: entry.running,
              cwd: entry.cwd,
              cols: this.requireTerminalControlPlane().getSnapshot(entry.terminalId).cols,
              rows: this.requireTerminalControlPlane().getSnapshot(entry.terminalId).rows,
              focused: this.focusedTerminalIds.includes(entry.terminalId),
              dirty: this.terminalDirtyState[entry.terminalId] ?? false,
              latestSeq: this.terminalLatestSeq[entry.terminalId] ?? 0,
              icon: entry.icon,
              title: entry.title,
              shortcuts: entry.shortcuts,
              transportUrl: entry.transportUrl,
            }));
          return [...configured, ...dynamic];
        },
        create: async ({ terminalId, processKind, command, cwd, profile }) => {
          const controlPlane = this.requireTerminalControlPlane();
          try {
            if (terminalId && this.config?.terminals[terminalId]) {
              await this.createTerminal(terminalId, this.config.terminals[terminalId]);
              controlPlane.start(terminalId);
              if (this.config.terminals[terminalId]?.gitLog) {
                await controlPlane.markDirty(terminalId);
              }
              this.terminalDirtyState[terminalId] = false;
              return {
                ok: true,
                message: "terminal started",
                terminal: controlPlane.list().find((entry) => entry.terminalId === terminalId),
              };
            }
            const created = await controlPlane.create({
              terminalId,
              processKind,
              command,
              cwd,
              profile,
            });
            const managed = controlPlane.getManagedTerminal(created.terminalId);
            if (managed) {
              this.attachRuntimeTerminal(created.terminalId, managed);
            }
            this.terminalDirtyState[created.terminalId] = false;
            return { ok: true, message: "terminal created", terminal: created };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emit("error", { message: `terminal create failed (${terminalId ?? "dynamic"}): ${message}` });
            return { ok: false, message };
          }
        },
        kill: async ({ terminalId }) => {
          const result = await this.requireTerminalControlPlane().kill(terminalId);
          if (result.ok) {
            this.terminals.delete(terminalId);
            delete this.terminalDirtyState[terminalId];
            delete this.terminalLatestSeq[terminalId];
            delete this.terminalSnapshots[terminalId];
            delete this.terminalReads[terminalId];
            this.focusedTerminalIds = this.requireTerminalControlPlane().getFocusedTerminalIds();
            this.emitFocusedTerminal();
          }
          return result;
        },
        focus: async ({ op = "replace", terminalIds = [] }) => {
          const unknown = terminalIds.filter((terminalId) => !this.requireTerminalControlPlane().has(terminalId));
          if (unknown.length > 0) {
            return {
              ok: false,
              message: `unknown terminal: ${unknown[0]}`,
              focusedTerminalIds: [...this.focusedTerminalIds],
            };
          }
          const next = this.updateFocusedTerminals(op, terminalIds);
          return {
            ok: true,
            message: `focus ${op}`,
            focusedTerminalIds: next,
          };
        },
        write: async ({ terminalId, text, submit, submitKey }) => {
          const controlPlane = this.requireTerminalControlPlane();
          if (!controlPlane.has(terminalId)) {
            return { ok: false, message: `unknown terminal: ${terminalId}` };
          }
          const submitGapMs = this.config?.terminals[terminalId]?.submitGapMs ?? 80;
          try {
            if (this.config?.terminals[terminalId]?.gitLog && !controlPlane.isRunning(terminalId)) {
              controlPlane.start(terminalId);
              await controlPlane.markDirty(terminalId);
            }
            const result = await controlPlane.write({
              terminalId,
              text,
              submit,
              submitKey,
              submitGapMs,
            });
            if (result.ok) {
              this.appendTerminalActivity({
                terminalId,
                kind: "terminal_write",
                cycleId: this.activeCycleId,
                title: submit || submitKey ? "Terminal write + submit" : "Terminal write",
                content: text,
                detail: {
                  submit,
                  submitKey: submitKey ?? null,
                },
              });
            }
            return { ok: result.ok, message: result.message };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emit("error", { message: `terminal write failed (${terminalId}): ${message}` });
            return { ok: false, message };
          }
        },
        read: async ({ terminalId, mode = "auto" }) =>
          this.readTerminalRepresentation(terminalId, {
            mode,
            remark: false,
          }),
        snapshot: async ({ terminalId }) =>
          this.readTerminalRepresentation(terminalId, {
            mode: "snapshot",
            remark: false,
          }),
        getConfig: async () => this.requireTerminalControlPlane().getConfig(),
        setConfig: async ({ patch }) => this.requireTerminalControlPlane().setConfig(patch),
      },
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
      messageGateway: {
        send: async ({ chatId, content, rootId, from, to }) => {
          const channel = this.messageSystem.getChannel(chatId);
          if (!channel) {
            throw new Error(`unknown chat channel: ${chatId}`);
          }
          const replyCycleId = this.activeCycleId;
          const author = from ?? this.getAvatarName();
          const redundant = this.findRedundantVisibleReply({
            chatId,
            content,
            from: author,
          });
          if (redundant) {
            return {
              ok: true,
              messageId: redundant.messageId,
            };
          }
          const message = this.messageSystem.reply({
            chatId,
            rootId: rootId ?? (replyCycleId !== null ? String(replyCycleId) : undefined),
            from: author,
            to,
            content,
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
        },
      },
      taskGateway: {
        list: () => this.taskEngine.list(),
        get: ({ source, id }) => this.taskEngine.get(source, id),
        create: (input) => {
          const task = this.taskEngine.create(input);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
          this.notifyInput("task");
          return task;
        },
        update: (input) => {
          const task = this.taskEngine.update(input);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
          this.notifyInput("task");
          return task;
        },
        done: ({ source, id }) => {
          const result = this.taskEngine.done(source, id);
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
        },
        addDependency: ({ source, id, target }) => {
          const task = this.taskEngine.addDependency(source, id, target);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
          this.notifyInput("task");
          return task;
        },
        removeDependency: ({ source, id, target }) => {
          const task = this.taskEngine.removeDependency(source, id, target);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
          this.notifyInput("task");
          return task;
        },
        triggerManual: ({ source, id }) => {
          const task = this.taskEngine.triggerManual(source, id);
          if (task) {
            this.emit("taskUpdated", { task });
            this.notifyInput("task");
          }
          return task;
        },
        emitEvent: (input) => {
          const result = this.taskEngine.emitEvent(input);
          if (result.affected.length > 0) {
            this.emit("taskTriggered", {
              topic: result.topic,
              source: result.source,
              affected: result.affected,
            });
            for (const task of result.affected) {
              this.emit("taskUpdated", { task });
            }
            this.notifyInput("task");
          }
          return result;
        },
        import: (items) => {
          const result = this.taskEngine.import(items);
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
        },
      },
    });
    this.agent = agent;

    agent.onTaskEvent((event) => {
      this.stage = event.stage;
      this.emit("stage", { stage: event.stage });
    });

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
          const result = await agent.send(messages, context);
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
        if (this.activeCycle) {
          if (state.phase === "waiting_commits" && previousPhase !== "waiting_commits") {
            const nextStatus = this.abortingActiveCycle || this.activeCycle.status === "error" ? "error" : "done";
            this.abortingActiveCycle = false;
            this.finalizeActiveCycle(nextStatus);
          } else if (state.phase === "applying_outputs") {
            this.updateActiveCycle({ status: "applying" });
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
      onUserMessage: (message, context) => {
        if (message.channel && message.channel !== "to_user") {
          this.recordChatMessage(message, context.cycleId);
          return;
        }
        const replyCycleId = context.cycleId ?? this.activeCycleId;
        const replyChatId = this.cycleReplyChatIds.get(context.cycleId) ?? this.getDefaultChatId();
        this.messageSystem.reply({
          chatId: replyChatId,
          rootId: replyCycleId ? String(replyCycleId) : undefined,
          from: this.getAvatarName(),
          content: message.content,
          metadata: {
            channel: message.channel ?? "to_user",
            format: message.format ?? "markdown",
            cycleId: replyCycleId,
          },
        });
      },
      onTerminalDispatch: async (_command, context) => {
        this.activeCycleId = context.cycleId;
      },
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
    this.taskSourceQueue.length = 0;
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
      history: modelState?.history ?? [],
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
      this.agent?.requestCompact("user-command");
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
    if (!this.terminals.has(terminalId)) {
      return false;
    }
    this.updateFocusedTerminals("add", [terminalId]);
    return true;
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
      immediateBlock?: boolean;
    },
  ): void {
    const now = Date.now();
    const fingerprint = this.buildAttentionFailureFingerprint(input);
    for (const contextId of contextIds) {
      const previous = this.attentionContainment.get(contextId);
      const retryCount = previous?.fingerprint === fingerprint ? previous.retryCount + 1 : 1;
      const blockNow = input.immediateBlock === true || retryCount >= ATTENTION_FAILURE_BLOCK_THRESHOLD;
      this.attentionContainment.set(contextId, {
        contextId,
        fingerprint,
        retryCount,
        status: blockNow ? "blocked" : "backoff",
        nextWakeAt: blockNow ? null : now + this.getAttentionContainmentBackoffMs(retryCount),
        blockedReason: blockNow ? input.outcome?.message ?? input.error?.message ?? fingerprint : null,
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
    let blockedReason: string | null = null;
    let hasBlocked = false;

    for (const match of active) {
      const entry = this.attentionContainment.get(match.contextId);
      if (!entry) {
        hasReady = true;
        continue;
      }
      retryCount = Math.max(retryCount, entry.retryCount);
      if (entry.status === "blocked") {
        hasBlocked = true;
        blockedReason ??= entry.blockedReason;
        continue;
      }
      if (entry.nextWakeAt === null || entry.nextWakeAt <= now) {
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
        blockedReason: null,
      };
    }
    if (nextWakeAt !== null) {
      return {
        state: "backoff",
        nextWakeAt,
        retryCount,
        blockedReason: null,
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
        if (entry.status === "blocked") {
          return false;
        }
        return entry.nextWakeAt === null || entry.nextWakeAt <= now;
      })
      .sort((left, right) => {
        const priorityDelta = this.resolveAttentionCollectionPriority(right) - this.resolveAttentionCollectionPriority(left);
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
    if (this.inboundMessageQueue.length > 0 || this.taskSourceQueue.length > 0) {
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
      if (containment.state === "blocked") {
        return "blocked";
      }
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
    if (this.taskSourceQueue.length > 0) {
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
    if (this.taskSourceQueue.length === 0 && !this.hasTimeBasedTask()) {
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
      this.taskSourceQueue.push({
        name: "TaskSystem",
        role: "user",
        type: "text",
        source: "task",
        text: JSON.stringify({
          kind: "task-triggered",
          source: triggered.source,
          topic: triggered.topic,
          affected: triggered.affected.map((task) => ({ key: task.key, status: task.status, progress: task.progress })),
        }),
      });
      this.notifyInput("task");
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
    if (this.taskSourceQueue.length > 0) {
      outputs.push(...this.taskSourceQueue.splice(0, this.taskSourceQueue.length));
    }
    const taskHeartbeat = this.collectTaskHeartbeatInput();
    if (taskHeartbeat) {
      outputs.push(taskHeartbeat);
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

    return selected.map((match) => {
      const channel = this.resolveMessageChannelForContext(match.contextId);
      const chatId = channel?.chatId ?? this.resolveMessageChatIdForContext(match.contextId);
      return {
        name: `Attention-${match.contextId}`,
        role: "user",
        type: "text",
        source: "attention",
        text: serializeAttentionActiveContext(match),
        meta: {
          attentionContextId: match.contextId,
          attentionHeadCommitId: match.context.headCommitId,
          owner: match.context.owner,
          createdAt: match.context.updatedAt,
          ...(channel ? { chatFocused: channel.focused } : {}),
          ...(chatId ? { chatId } : {}),
        },
      };
    });
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

  private collectTaskHeartbeatInput(): LoopBusInput | undefined {
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
      name: "TaskHeartbeat",
      role: "user",
      type: "text",
      source: "task",
      text: JSON.stringify({
        kind: "task-heartbeat",
        timestamp: new Date(now).toISOString(),
        activeCount: active.length,
        byStatus,
        top,
      }),
      meta: {
        activeCount: active.length,
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
        this.taskSourceQueue.push({
          name: "TaskSource",
          role: "user",
          type: "text",
          source: "task",
          text: JSON.stringify({
            kind: "task-source",
            sourceName: item.name,
            sourcePath: item.path,
            file,
            source,
            markdown,
          }),
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
  }): void {
    this.activeCycle = {
      id: toChatCycleId({ cycleId: input.cycleId }),
      cycleId: input.cycleId,
      seq: input.seq,
      createdAt: input.createdAt,
      wakeSource: input.wakeSource,
      kind: detectChatCycleKind(input.inputs),
      status: "collecting",
      clientMessageIds: collectClientMessageIds(input.inputs),
      inputs: structuredClone(input.inputs),
      outputs: [],
      liveMessages: [],
      streaming: null,
      modelCallId: null,
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
      tool: message.tool ? { ...message.tool } : undefined,
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
          channel === "tool_call"
            ? `Tool call · ${message.tool?.name ?? "tool"}`
            : channel === "tool_result"
              ? `Tool result · ${message.tool?.name ?? "tool"}`
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
    const activeContextIds = this.collectActiveAttentionContextIds();
    const inputContextIds = collectedInputs
      .filter((item) => item.source === "attention")
      .map((item) => item.meta?.attentionContextId)
      .filter((contextId): contextId is string => typeof contextId === "string");

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
          inputContextIds,
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
      result: { kind: detectChatCycleKind(collectedInputs) },
    });
    const attentionCycleFrame: AttentionCycleFrame = {
      cycleId: cycle.id,
      seq: cycle.seq,
      createdAt: cycle.createdAt,
      wakeSource: input.wakeSource,
      inputContextIds,
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
    const runtimeStatus: LoopBusKernelState["runtimeStatus"] =
      !this.started
        ? "idle"
        : paused
          ? "paused"
          : input.phase !== "waiting_commits"
            ? "running"
            : waitingReason === "blocked"
              ? "blocked"
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

  private handleAssistantStreamUpdate(input: AssistantStreamUpdate): void {
    if (!this.activeCycle) {
      return;
    }
    switch (input.kind) {
      case "draft":
        return;
      case "run_finished":
        this.updateActiveCycle({
          status: this.activeCycle.status === "error" ? "error" : "applying",
        });
        return;
      case "tool_call": {
        this.updateActiveCycle({
          status: "streaming",
          upsertLiveMessage: {
            id: `live-tool-call:${input.toolCallId}`,
            role: "assistant",
            content: buildLiveToolCallMarkdown(input.toolName, input.input ?? input.argsText, input.timestamp),
            timestamp: input.timestamp,
            channel: "tool_call",
            format: "markdown",
            tool: { name: input.toolName },
          },
        });
        return;
      }
      case "tool_result":
        this.updateActiveCycle({
          status: "streaming",
          upsertLiveMessage: {
            id: `live-tool-result:${input.toolCallId}`,
            role: "assistant",
            content: buildLiveToolResultMarkdown(input.toolName, {
              ok: input.ok,
              output: input.result,
              error: input.error ?? null,
              timestamp: input.timestamp,
            }),
            timestamp: input.timestamp,
            channel: "tool_result",
            format: "markdown",
            tool: { name: input.toolName, ok: input.ok },
          },
        });
        return;
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
            immediateBlock: record.outcome?.reason === "attention.no_progress" && record.outcome.retryable === false,
          });
        }
      }
    }
    this.updateActiveCycle({
      modelCallId: modelCall.id,
      status: modelCall.status === "error" ? "error" : this.activeCycle?.status,
    });
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
          startedAt: Date.parse(tool.timestamp) || record.timestamp,
          endedAt: Date.parse(tool.timestamp) || record.timestamp,
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
