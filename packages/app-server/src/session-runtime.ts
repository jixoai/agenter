import { AttentionEngine, AttentionStore, type AttentionRecord } from "@agenter/attention-system";
import { MessageSystem } from "@agenter/message-system";
import {
  SessionDb,
  type SessionAssetRecord,
  type SessionCollectedInput,
  type SessionCollectedInputPart,
  type ApiCallRecord as SessionDbApiCallRecord,
  type LoopbusStateLogRecord as SessionDbLoopbusStateLogRecord,
  type ReversePage as SessionDbReversePage,
  type ReverseTimeCursor as SessionDbReverseTimeCursor,
  type SessionBlockRecord as SessionDbChatMessageRecord,
  type SessionCycleRecord,
  type LoopbusTraceRecord as SessionDbLoopbusTraceRecord,
  type SessionModelCallRecord,
  type TerminalActivityRecord as SessionDbTerminalActivityRecord,
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
  type TerminalControlPlaneConfig,
  type TerminalControlPlaneEntry,
  type TerminalReadResult as ControlPlaneTerminalReadResult,
} from "@agenter/terminal-system";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import { AgentRuntime } from "./agent-runtime";
import { AgenterAI, type AgentModelCallRecord, type AgentRuntimeStats } from "./agenter-ai";
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
import { ManagedTerminal, type ManagedTerminalSnapshot } from "./managed-terminal";
import { resolveModelCapabilities } from "./model-capabilities";
import { ModelClient, type AssistantStreamUpdate } from "./model-client";
import {
  LoopBusPluginRuntime,
  type AttentionDraft,
  type LoopBusPlugin,
  type LoopSourceReadRequest,
  type LoopSourceReadResult,
  type LoopSourceRef,
} from "./loopbus-plugin-runtime";
import { FilePromptStore } from "./prompt-store";
import {
  buildSessionAssetRelativePath,
  resolveSessionAssetKind,
  toChatSessionAsset,
} from "./session-assets";
import { resolveSessionConfig, type ResolvedSessionConfig, type SessionTerminalConfig } from "./session-config";
import {
  listWorkspaceSettingsLayers,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
  type SettingsLayerSnapshot,
  type SettingsLayersResult,
} from "./workspace-settings";
import { SessionStore } from "./session-store";
import { SettingsEditor, type EditableKind } from "./settings-editor";
import { buildTerminalSemanticFingerprint, buildTerminalViewFingerprint } from "./terminal-snapshot-fingerprint";
import type { ChatMessage, ChatSessionAsset, ModelCapabilities, TaskStage } from "./types";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type TerminalFocusOp = "add" | "remove" | "replace" | "clear";
type TerminalReadMode = "auto" | "diff" | "snapshot";
type TerminalReadRepresentation = "diff" | "snapshot";

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
): string =>
  JSON.stringify(buildTerminalDiffPayload(terminalId, input));

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

type TerminalReadPayload = ControlPlaneTerminalReadResult | { ok: false; reason: string };

const serializeAttentionSystemFacts = (records: AttentionRecord[]): string =>
  JSON.stringify({
    kind: "attention-system-list",
    count: records.length,
    items: records.map((record) => ({
      id: record.id,
      from: record.from,
      score: record.score,
      remark: record.remark,
      updatedAt: record.updatedAt,
      content: record.content,
    })),
  });

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
  loopbusSnapshot: { snapshot: LoopBusKernelSnapshot };
  loopbusStateLog: { entry: SessionDbLoopbusStateLogRecord };
  loopbusTrace: { entry: SessionDbLoopbusTraceRecord };
  loopbusInputSignal: { kind: LoopInputKind; version: number; timestamp: number };
  modelCall: { entry: SessionModelCallRecord };
  apiCall: { entry: SessionDbApiCallRecord };
  apiRecording: { enabled: boolean; refCount: number };
  cycleUpdated: { cycle: ChatCycle | null };
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
  loopPhase: LoopBusPhase;
  stage: TaskStage;
  focusedTerminalId: string;
  focusedTerminalIds: string[];
  chatMessages: ChatMessage[];
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
  loopKernelState: LoopBusKernelState | null;
  loopInputSignals: Record<LoopInputKind, { version: number; timestamp: number | null }>;
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
  private attentionEngine: AttentionEngine = new AttentionEngine();
  private readonly messageSystem = new MessageSystem();
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
  private readonly attentionSourceDigests = new Map<string, string>();
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
  private messageConsumedHash: string | null = null;
  private loopPluginRuntime: LoopBusPluginRuntime | null = null;

  constructor(private readonly options: SessionRuntimeOptions) {}

  private createMessageSourceRef(input: {
    channelId: string;
    messageId: string;
    content: string;
    attachments: ChatSessionAsset[];
    meta?: Record<string, string | number | boolean | null>;
  }): LoopSourceRef {
    return {
      systemId: "message",
      subjectId: input.messageId,
      reason: "message-committed",
      meta: {
        channelId: input.channelId,
        content: input.content,
        attachments: input.attachments,
        meta: input.meta,
      },
    };
  }

  private createTerminalSourceRef(terminalId: string, reason: string, versionHint?: string | number): LoopSourceRef {
    return {
      systemId: "terminal",
      subjectId: terminalId,
      reason,
      versionHint,
    };
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
    const channelId = typeof request.ref.meta?.channelId === "string" ? request.ref.meta.channelId : "user";
    const channel = this.messageSystem.getChannel(channelId);
    if (channel?.useAttention === false || result.content.trim().length === 0 || result.content.trim() === "/compact") {
      return [];
    }
    return [
      {
        sourceRef: request.ref,
        content: result.content,
        from: channel?.displayName ?? channelId,
        score: channelId === "user" ? 100 : undefined,
        meta: request.ref.meta ? { ...request.ref.meta } : undefined,
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
    if (result.content.trim().length === 0) {
      return [];
    }
    return [
      {
        sourceRef: request.ref,
        content: result.content,
        from: "terminal",
        meta: {
          terminalId: request.ref.subjectId,
          representation: result.kind,
          ...(result.meta ?? {}),
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
      this.attentionEngine.add({
        content: draft.content,
        from: draft.from,
        score: draft.score,
        remark: draft.meta ? JSON.stringify(draft.meta) : undefined,
      });
      changed = true;
    }
    if (!changed) {
      return false;
    }
    this.attentionFactsVersion += 1;
    await this.persistAttentionSystem();
    return true;
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
    this.attentionStore = new AttentionStore(join(this.options.sessionRoot, "attention-system"));
    this.attentionEngine = new AttentionEngine(await this.attentionStore.load());
    if (this.attentionEngine.list().length > 0) {
      this.attentionFactsVersion += 1;
      this.notifyInput("attention");
    }
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
    const restoredChat = this.sessionDb.listBlocksAfter(0, 200);
    this.chatMessages = restoredChat.map((item) => this.toChatMessage(item));
    const head = this.sessionDb.getHead();
    this.activeCycleId = head.headCycleId;
    this.activeModelCallId = null;
    this.updateLoopKernelSnapshot({
      phase: "waiting_commits",
      currentCycleId: head.headCycleId,
      lastWakeSource: null,
      lastError: null,
    });

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
        list: () => this.attentionEngine.list(),
        add: async (input) => {
          const added = this.attentionEngine.add(input);
          this.attentionFactsVersion += 1;
          this.notifyInput("attention");
          await this.persistAttentionSystem();
          return added;
        },
        remark: async (input) => {
          const updated = this.attentionEngine.remark(input);
          if (updated) {
            this.attentionFactsVersion += 1;
            this.notifyInput("attention");
          }
          await this.persistAttentionSystem();
          return updated;
        },
        query: async (input) => this.attentionEngine.query(input),
        update: async (input) => {
          const result = this.attentionEngine.update(input);
          this.attentionFactsVersion += 1;
          this.notifyInput("attention");
          await this.persistAttentionSystem();
          return result;
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

    this.runtime = new AgentRuntime({
      processor: agent,
      logger: this.options.logger ?? { log: () => {} },
      onLoopStateChange: (state) => {
        const previousPhase = this.loopPhase;
        this.loopPhase = state.phase;
        if (this.activeCycle) {
          if (state.phase === "waiting_commits" && previousPhase !== "waiting_commits") {
            const nextStatus =
              this.abortingActiveCycle || this.activeCycle.status === "error" ? "error" : "done";
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
          lastError: state.lastError,
          cycle: state.cycle,
          paused: state.paused,
        });
        this.emit("phase", { phase: state.phase });
      },
      onLoopTrace: (entry) => {
        const row = this.sessionDb?.appendLoopTrace({
          cycleId: entry.cycleId,
          step: entry.step,
          status: entry.status,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          detail: entry.detail,
        });
        if (row) {
          this.emit("loopbusTrace", { entry: row });
        }
      },
      waitForCommit: async () => this.waitForAnyInput(),
      collectInputs: async () => this.collectLoopInputs(),
      persistCycle: async ({ wakeSource, inputs }) => this.persistCycle({ wakeSource, inputs }),
      onUserMessage: (message, context) => {
        this.recordChatMessage(message, context.cycleId);
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
    if (!this.started) {
      return;
    }
    if (this.activeCycle && this.loopPhase !== "waiting_commits") {
      this.abortingActiveCycle = true;
    }
    this.runtime?.pause();
    // Wake commit waiters so the paused loop can settle without waiting for new external input.
    this.notifyInput("attention");
    this.sessionStore?.setLifecycle({ status: "paused" });
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
    this.runtime?.stop();
    this.runtime = null;
    this.agent = null;
    this.loopPluginRuntime = null;
    this.sessionStore?.setLifecycle({ status: "stopped" });
    this.apiCallRecordingRefCount = 0;

    await this.terminalControlPlane?.dispose();
    this.terminalControlPlane = null;
    this.terminals.clear();
    this.taskSourceQueue.length = 0;
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
    this.started = false;
    this.loopPhase = "stopped";
  }

  async stop(): Promise<void> {
    await this.abort();
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
      this.attentionEngine = new AttentionEngine(attentionSnapshot as ConstructorParameters<typeof AttentionEngine>[0]);
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
    this.emitFocusedTerminal();
    this.updateLoopKernelSnapshot({
      phase: "waiting_commits",
      currentCycleId: cycleId,
      lastWakeSource: null,
      lastError: null,
    });
    if (this.runtime) {
      this.runtime.stop();
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

  listLoopbusStateLogs(
    afterId = 0,
    limit = 200,
  ): Array<SessionDbLoopbusStateLogRecord> {
    if (!this.sessionDb) {
      return [];
    }
    const page = this.sessionDb.listLoopStateLogsPage({ limit });
    return page.items.filter((item) => item.id > afterId);
  }

  listLoopbusStateLogsBefore(
    beforeId: number,
    limit = 200,
  ): Array<SessionDbLoopbusStateLogRecord> {
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

  async uploadAssets(
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>,
  ): Promise<ChatSessionAsset[]> {
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

  pushUserChat(text: string, assetIds: string[] = [], clientMessageId?: string): void {
    const isCompactCommand = text.trim() === "/compact";
    if (isCompactCommand) {
      this.agent?.requestCompact("user-command");
    }

    const attachments = this.resolveChatAttachments(assetIds);
    const message: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
      attachments,
    };
    this.recordChatMessage(message, null, "user_input");
    this.messageSystem.push({
      channelId: "user",
      content: text,
      attachments,
      meta: clientMessageId ? { clientMessageId } : undefined,
    });
    this.loopPluginRuntime?.invalidate(
      this.createMessageSourceRef({
        channelId: "user",
        messageId: message.id,
        content: text,
        attachments,
        meta: clientMessageId ? { clientMessageId } : undefined,
      }),
    );
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
      loopPhase: this.loopPhase,
      stage: this.stage,
      focusedTerminalId: this.focusedTerminalIds[0] ?? "",
      focusedTerminalIds: [...this.focusedTerminalIds],
      chatMessages: [...this.chatMessages],
      terminalSnapshots: { ...this.terminalSnapshots },
      terminalReads: { ...this.terminalReads },
      terminals,
      tasks: this.taskEngine.list(),
      loopKernelState: this.loopKernelSnapshot?.state ?? null,
      loopInputSignals: {
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
            input.mode === "diff" || (input.mode === "auto" && JSON.stringify(diffPayload).length <= snapshotJson.length);
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
    this.emit("loopbusInputSignal", { kind, version, timestamp });
  }

  private hasTimeBasedTask(): boolean {
    return this.taskEngine
      .list()
      .some(
        (task) =>
          task.triggers.some((trigger) => trigger.type === "at" || trigger.type === "cron") && task.status !== "done",
      );
  }

  private async waitForAnyInput(): Promise<LoopInputKind> {
    if (this.messageSystem.getDirty().length > 0) {
      return "user";
    }
    if (this.focusedTerminalIds.some((terminalId) => this.terminalDirtyState[terminalId])) {
      return "terminal";
    }
    if (this.taskSourceQueue.length > 0) {
      return "task";
    }
    if (this.attentionFactsVersion > this.attentionFactsSentVersion) {
      return "attention";
    }

    const signalWaiters = (["task", "attention"] as const).map((kind) => ({
      kind,
      ...this.inputSignals[kind].waitAfter(this.inputSignalCursor[kind]),
    }));

    const messageHandle = this.messageSystem.waitCommitted({ fromHash: this.messageConsumedHash });
    const terminalHandles = this.focusedTerminalIds
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
      messageHandle.promise
        .then(() => ({ kind: "user" as const }))
        .catch((error) => {
          if (error === IGNORE_WAIT) {
            return new Promise<{ kind: LoopInputKind }>(() => {});
          }
          throw error;
        }),
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

    const winner = await Promise.race(promises);
    if (timer) {
      clearTimeout(timer);
    }

    messageHandle.reject(IGNORE_WAIT);
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
    const messageDiff = this.messageSystem.consumeDiff({ fromHash: this.messageConsumedHash });
    if (messageDiff.changed) {
      this.messageConsumedHash = messageDiff.toHash;
      let addedLegacyAttention = false;
      for (const draft of messageDiff.drafts) {
        const channel = this.messageSystem.getChannel(draft.channelId);
        outputs.push({
          name: channel?.displayName ?? draft.channelId,
          role: "user",
          type: "text",
          source: "chat",
          text: draft.content,
          meta: draft.meta,
          attachments: draft.attachments,
        });
        if (!this.loopPluginRuntime && draft.content.trim() !== "/compact") {
          this.attentionEngine.add({
            content: draft.content,
            from: "user",
            score: 100,
          });
          addedLegacyAttention = true;
        }
      }
      if (addedLegacyAttention) {
        this.attentionFactsVersion += 1;
        void this.persistAttentionSystem().catch((error) => {
          this.emit("error", { message: error instanceof Error ? error.message : String(error) });
        });
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
    const attentionFacts = this.collectAttentionSystemInput();
    if (attentionFacts) {
      outputs.push(attentionFacts);
    }
    for (const kind of Object.keys(this.inputSignalCursor) as Array<"task" | "attention">) {
      this.inputSignalCursor[kind] = this.inputSignals[kind].current();
    }
    return outputs.length > 0 ? outputs : undefined;
  }

  private collectAttentionSystemInput(): LoopBusInput | undefined {
    const active = this.attentionEngine.list();
    if (active.length === 0) {
      return undefined;
    }
    if (this.attentionFactsVersion <= this.attentionFactsSentVersion) {
      return undefined;
    }
    this.attentionFactsSentVersion = this.attentionFactsVersion;
    return {
      name: "AttentionSystem",
      role: "user",
      type: "text",
      source: "attention-system",
      text: serializeAttentionSystemFacts(active),
      meta: {
        count: active.length,
      },
    };
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
    const channel = channelOverride ?? nextMessage.channel ?? (nextMessage.role === "user" ? "user_input" : "to_user");
    const block = this.sessionDb.appendBlock({
      cycleId,
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
    this.appendTerminalActivityForMessage(nextMessage, cycleId, channel);
    if (this.activeCycle && cycleId !== null && this.activeCycle.cycleId === cycleId && nextMessage.role === "assistant") {
      this.updateActiveCycle({
        appendOutput: nextMessage,
      });
    }
  }

  private toChatMessage(record: SessionDbChatMessageRecord): ChatMessage {
    return {
      id: `${record.id}`,
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
          : item.source === "attention-system"
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

    const cycle = this.sessionDb.appendCycle({
      prevCycleId: previousHead,
      wake: { source: input.wakeSource },
      collectedInputs,
      extendsRecord: {
        attention: this.attentionEngine.snapshot(),
        task: { items: this.taskEngine.list() },
        terminal: { focusedTerminalIds: [...this.focusedTerminalIds], terminals },
        message: { channels: this.messageSystem.listChannels() },
      },
      result: { kind: detectChatCycleKind(collectedInputs) },
    });
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

  private updateLoopKernelSnapshot(input: {
    phase: LoopBusPhase;
    currentCycleId: number | null;
    lastWakeSource: string | null;
    lastError: string | null;
    cycle?: number;
    paused?: boolean;
  }): void {
    const previous = this.loopKernelSnapshot?.state ?? createInitialLoopKernelState(Date.now(), input.phase);
    const next: LoopBusKernelState = {
      ...previous,
      phase: input.phase,
      running: this.started,
      paused: input.paused ?? previous.paused,
      gate: input.phase === "waiting_commits" ? "waiting_input" : "open",
      queueSize: 0,
      cycle: input.cycle ?? previous.cycle,
      sentBatches: previous.sentBatches,
      updatedAt: Date.now(),
      stateVersion: previous.stateVersion + 1,
      lastWakeAt: input.lastWakeSource ? Date.now() : previous.lastWakeAt,
      lastWakeSource: input.lastWakeSource,
      lastError: input.lastError,
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
      this.emit("loopbusStateLog", { entry });
    }
    this.emit("loopbusSnapshot", { snapshot: this.loopKernelSnapshot });
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
    if (!this.attentionStore) {
      return;
    }
    await this.attentionStore.save(this.attentionEngine.snapshot());
  }

  private async handleModelCall(record: AgentModelCallRecord): Promise<void> {
    if (!this.sessionDb || this.activeCycleId === null) {
      return;
    }
    const existingModelCallId = this.activeModelCallId ?? this.sessionDb.getModelCallByCycleId(this.activeCycleId)?.id ?? null;
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
          })
        : this.sessionDb.updateModelCall(existingModelCallId, {
            status: record.status,
            completedAt: record.completedAt ?? null,
            response: record.response,
            error: record.error,
          });
    this.activeModelCallId = record.status === "running" ? modelCall.id : this.activeModelCallId ?? modelCall.id;
    this.updateActiveCycle({
      modelCallId: modelCall.id,
      status: modelCall.status === "error" ? "error" : this.activeCycle?.status,
    });
    this.emit("modelCall", { entry: modelCall });
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
