import { ResourceLoader, loadSettings } from "@agenter/settings";
import { ChatEngine, ChatStore, type ChatRecord } from "@agenter/chat-system";
import {
  TaskEngine,
  resolveTaskSources,
  serializeTaskMarkdown,
  type TaskSourceName,
  type TaskSourceResolved,
  type TaskView,
} from "@agenter/task-system";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

import { AgentRuntime } from "./agent-runtime";
import { AgenterAI, type AgentRuntimeStats } from "./agenter-ai";
import { ModelClient } from "./model-client";
import type { LoopBusInput, LoopBusPhase } from "./loop-bus";
import { FilePromptStore } from "./prompt-store";
import { SessionStore } from "./session-store";
import type { ChatMessage, TaskStage } from "./types";
import { ManagedTerminal, type ManagedTerminalSnapshot } from "./managed-terminal";
import { resolveSessionConfig, type SessionTerminalConfig, type ResolvedSessionConfig } from "./session-config";
import { SettingsEditor, type EditableKind } from "./settings-editor";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  JSON.stringify({
    kind: "terminal-diff",
    terminalId,
    fromHash: input.fromHash,
    toHash: input.toHash,
    bytes: input.bytes,
    status: input.status,
    diff: input.diff,
  });

const buildTerminalSnapshotPayload = (terminalId: string, snapshot: ManagedTerminalSnapshot) => ({
  kind: "terminal-snapshot",
  terminalId,
  seq: snapshot.seq,
  cols: snapshot.cols,
  rows: snapshot.rows,
  cursor: snapshot.cursor,
  tail: snapshot.lines.slice(-20),
});

const snapshotFingerprint = (snapshot: ManagedTerminalSnapshot): string =>
  `${snapshot.cols}:${snapshot.rows}:${snapshot.cursor.x}:${snapshot.cursor.y}\n${snapshot.lines.join("\n")}`;

const serializeChatSystemFacts = (records: ChatRecord[]): string =>
  JSON.stringify({
    kind: "chat-system-list",
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

export interface RuntimeEventMap {
  phase: { phase: LoopBusPhase };
  stage: { stage: TaskStage };
  stats: AgentRuntimeStats;
  chat: ChatMessage;
  terminalSnapshot: { terminalId: string; snapshot: ManagedTerminalSnapshot };
  terminalStatus: { terminalId: string; running: boolean; status: "IDLE" | "BUSY" };
  focusedTerminal: { terminalId: string };
  taskUpdated: { task: TaskView };
  taskDeleted: { key: string };
  taskTriggered: { topic: string; source: "api" | "file" | "scheduler" | "tool"; affected: TaskView[] };
  taskSourceChanged: { sourceName: string; sourcePath: string; file: string; source: "boot" | "watch"; markdown: string };
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
  chatMessages: ChatMessage[];
  terminalSnapshots: Record<string, ManagedTerminalSnapshot>;
  terminals: Array<{
    terminalId: string;
    running: boolean;
    status: "IDLE" | "BUSY";
    seq: number;
    cwd: string;
  }>;
  tasks: TaskView[];
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

export interface SettingsLayerSnapshot {
  layerId: string;
  sourceId: string;
  path: string;
  exists: boolean;
  editable: boolean;
  readonlyReason?: string;
}

export interface SettingsLayersResult {
  effective: {
    content: string;
  };
  layers: SettingsLayerSnapshot[];
}

export class SessionRuntime {
  private readonly listeners: Array<(event: RuntimeEvent) => void> = [];
  private readonly dirtyQueue = new Set<string>();
  private readonly terminalSnapshots: Record<string, ManagedTerminalSnapshot> = {};
  private readonly terminalDirtyState: Record<string, boolean> = {};
  private readonly terminalLatestSeq: Record<string, number> = {};
  private readonly terminalSnapshotFingerprint: Record<string, string> = {};
  private readonly taskEngine = new TaskEngine();
  private readonly taskSourceMtime = new Map<string, number>();
  private readonly taskSourceQueue: LoopBusInput[] = [];
  private taskSources: TaskSourceResolved[] = [];

  private config: ResolvedSessionConfig | null = null;
  private settingsLayers: SettingsLayerSnapshot[] = [];
  private settingsEffective = "{}";
  private settingsEditor: SettingsEditor | null = null;
  private sessionStore: SessionStore | null = null;
  private chatStore: ChatStore | null = null;
  private chatEngine: ChatEngine = new ChatEngine();
  private agent: AgenterAI | null = null;
  private terminals = new Map<string, ManagedTerminal>();
  private runtime: AgentRuntime | null = null;
  private started = false;
  private loopPhase: LoopBusPhase = "waiting_messages";
  private stage: TaskStage = "idle";
  private readonly taskHeartbeatIntervalMs = 30_000;
  private lastTaskHeartbeatAt = 0;
  private lastTaskHeartbeatDigest = "";
  private focusedTerminalId = "";
  private chatMessages: ChatMessage[] = [];

  constructor(private readonly options: SessionRuntimeOptions) {}

  onEvent(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.config = await resolveSessionConfig(this.options.cwd, {
      avatar: this.options.avatar,
    });
    this.focusedTerminalId = this.config.focusedTerminalId;
    this.chatStore = new ChatStore(join(this.options.sessionRoot, "chat-system"));
    this.chatEngine = new ChatEngine(await this.chatStore.load());
    this.settingsEditor = new SettingsEditor(this.config.agentCwd, {
      agenterPath: this.config.prompt.agenterPath,
      agenterSystemPath: this.config.prompt.agenterSystemPath,
      systemTemplatePath: this.config.prompt.systemTemplatePath,
      responseContractPath: this.config.prompt.responseContractPath,
    });
    await this.reloadSettingsLayers();

    for (const [terminalId, terminalConfig] of Object.entries(this.config.terminals)) {
      this.createTerminal(terminalId, terminalConfig);
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
      kind: this.config.ai.kind,
      lang: this.config.lang,
      apiKey: this.config.ai.apiKey,
      model: this.config.ai.model,
      baseUrl: this.config.ai.baseUrl,
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

    const agent = new AgenterAI({
      modelClient,
      promptStore,
      sessionStore,
      logger: this.options.logger ?? { log: () => {} },
      locale: this.config.lang,
      terminalGateway: {
        list: () =>
          Object.values(this.config?.terminals ?? {}).map((terminal) => ({
            terminalId: terminal.terminalId,
            running: this.terminals.get(terminal.terminalId)?.isRunning() ?? false,
            cwd: terminal.cwd,
            cols: this.terminals.get(terminal.terminalId)?.getSnapshot().cols ?? 0,
            rows: this.terminals.get(terminal.terminalId)?.getSnapshot().rows ?? 0,
            focused: this.focusedTerminalId === terminal.terminalId,
            dirty: this.terminalDirtyState[terminal.terminalId] ?? false,
            latestSeq: this.terminalLatestSeq[terminal.terminalId] ?? 0,
          })),
        run: async ({ terminalId }) => {
          const terminal = this.terminals.get(terminalId);
          if (!terminal) {
            return { ok: false, message: `unknown terminal: ${terminalId}` };
          }
          try {
            terminal.start();
            if (this.config?.terminals[terminalId]?.gitLog) {
              await terminal.markDirty();
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.emit("error", { message: `terminal start failed (${terminalId}): ${message}` });
            return { ok: false, message };
          }
          this.terminalDirtyState[terminalId] = false;
          return { ok: true, message: "terminal started" };
        },
        kill: async ({ terminalId }) => {
          const terminal = this.terminals.get(terminalId);
          if (!terminal) {
            return { ok: false, message: `unknown terminal: ${terminalId}` };
          }
          await terminal.stop();
          return { ok: true, message: "terminal stopped" };
        },
        focus: async ({ terminalId, focus = true }) => {
          if (!this.terminals.has(terminalId)) {
            return { ok: false, message: `unknown terminal: ${terminalId}`, focusedTerminalId: this.focusedTerminalId };
          }
          if (!focus) {
            return { ok: true, message: "focus=false ignored in exclusive mode", focusedTerminalId: this.focusedTerminalId };
          }
          this.focusedTerminalId = terminalId;
          this.emit("focusedTerminal", { terminalId });
          return { ok: true, message: "focus updated", focusedTerminalId: terminalId };
        },
        write: async ({ terminalId, text, submit, submitKey }) => {
          const terminal = this.terminals.get(terminalId);
          if (!terminal) {
            return { ok: false, message: `unknown terminal: ${terminalId}` };
          }
          if (!terminal.isRunning()) {
            try {
              terminal.start();
              if (this.config?.terminals[terminalId]?.gitLog) {
                await terminal.markDirty();
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              this.emit("error", { message: `terminal start failed (${terminalId}): ${message}` });
              return { ok: false, message };
            }
          }
          const submitGapMs = this.config?.terminals[terminalId]?.submitGapMs ?? 80;
          await terminal.write(text, submit ?? true, submitKey ?? "enter", submitGapMs);
          return { ok: true, message: "written" };
        },
        read: async ({ terminalId }) => {
          const terminal = this.terminals.get(terminalId);
          if (!terminal) {
            return { ok: false, reason: `unknown terminal: ${terminalId}` };
          }
          return buildTerminalSnapshotPayload(terminalId, terminal.getSnapshot());
        },
        sliceDirty: async ({ terminalId, remark, wait, timeoutMs }) => {
          const terminal = this.terminals.get(terminalId);
          if (!terminal) {
            return {
              ok: false,
              changed: false,
              fromHash: null,
              toHash: null,
              diff: "",
              bytes: 0,
              reason: `unknown terminal: ${terminalId}`,
            };
          }
          if (this.focusedTerminalId === terminalId) {
            return {
              ok: true,
              ignored: true,
              changed: false,
              fromHash: null,
              toHash: null,
              diff: "",
              bytes: 0,
              reason: "focused terminal is auto-fed by LoopBus",
            };
          }
          const result = await terminal.sliceDirty({
            remark: remark ?? true,
            wait: wait ?? false,
            timeoutMs: timeoutMs ?? 30_000,
          });
          if (result.ok && (remark ?? true)) {
            this.terminalDirtyState[terminalId] = false;
          }
          return result;
        },
      },
      chatGateway: {
        list: () => this.chatEngine.list(),
        add: async (input) => {
          const added = this.chatEngine.add(input);
          await this.persistChatSystem();
          return added;
        },
        remark: async (input) => {
          const updated = this.chatEngine.remark(input);
          await this.persistChatSystem();
          return updated;
        },
        query: async (input) => this.chatEngine.query(input),
        reply: async (input) => {
          const result = this.chatEngine.reply(input);
          await this.persistChatSystem();
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
          return task;
        },
        update: (input) => {
          const task = this.taskEngine.update(input);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
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
          return result;
        },
        addDependency: ({ source, id, target }) => {
          const task = this.taskEngine.addDependency(source, id, target);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
          return task;
        },
        removeDependency: ({ source, id, target }) => {
          const task = this.taskEngine.removeDependency(source, id, target);
          void this.persistTask(task).catch((error) => {
            this.emit("error", { message: error instanceof Error ? error.message : String(error) });
          });
          this.emit("taskUpdated", { task });
          return task;
        },
        triggerManual: ({ source, id }) => {
          const task = this.taskEngine.triggerManual(source, id);
          if (task) {
            this.emit("taskUpdated", { task });
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
        this.loopPhase = state.phase;
        this.emit("phase", { phase: state.phase });
      },
      collectInputs: async () => this.collectLoopInputs(),
      onUserMessage: (message) => {
        this.chatMessages.push(message);
        this.trimChat();
        this.emit("chat", message);
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
        this.runtime.pushMessage({
          name: `Terminal-${boot.terminalId}`,
          role: "user",
          type: "text",
          source: "terminal",
          text: JSON.stringify(buildTerminalSnapshotPayload(boot.terminalId, terminal.getSnapshot())),
          meta: {
            terminalId: boot.terminalId,
            boot: true,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("error", { message: `boot terminal failed (${boot.terminalId}): ${message}` });
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.runtime?.stop();
    this.runtime = null;
    this.agent = null;
    this.sessionStore?.setLifecycle({ status: "stopped" });

    for (const terminal of this.terminals.values()) {
      await terminal.stop();
    }
    this.terminals.clear();
    this.taskSourceQueue.length = 0;
    this.taskSourceMtime.clear();
    this.taskSources = [];
    for (const terminalId of Object.keys(this.terminalSnapshots)) {
      delete this.terminalSnapshots[terminalId];
    }
    for (const terminalId of Object.keys(this.terminalSnapshotFingerprint)) {
      delete this.terminalSnapshotFingerprint[terminalId];
    }
    this.started = false;
    this.loopPhase = "stopped";
  }

  isStarted(): boolean {
    return this.started;
  }

  setSessionStatus(status: "stopped" | "starting" | "running" | "error", lastError?: string): void {
    this.sessionStore?.setLifecycle({ status, lastError });
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

  async readSettingsLayer(layerId: string): Promise<{ layer: SettingsLayerSnapshot; path: string; content: string; mtimeMs: number }> {
    const layer = this.settingsLayers.find((item) => item.layerId === layerId);
    if (!layer) {
      throw new Error(`settings layer not found: ${layerId}`);
    }
    const filePath = this.resolveLayerFilePath(layer.path);
    if (!filePath) {
      return {
        layer,
        path: layer.path,
        content: "",
        mtimeMs: 0,
      };
    }
    try {
      const [content, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
      return {
        layer,
        path: filePath,
        content,
        mtimeMs: info.mtimeMs,
      };
    } catch {
      return {
        layer,
        path: filePath,
        content: "",
        mtimeMs: 0,
      };
    }
  }

  async saveSettingsLayer(input: { layerId: string; content: string; baseMtimeMs: number }): Promise<
    | { ok: true; file: { layer: SettingsLayerSnapshot; path: string; content: string; mtimeMs: number }; effective: { content: string } }
    | { ok: false; reason: "conflict"; latest: { layer: SettingsLayerSnapshot; path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "readonly"; message: string }
  > {
    const layer = this.settingsLayers.find((item) => item.layerId === input.layerId);
    if (!layer) {
      throw new Error(`settings layer not found: ${input.layerId}`);
    }
    if (!layer.editable) {
      return {
        ok: false,
        reason: "readonly",
        message: layer.readonlyReason ?? "layer is readonly",
      };
    }
    const filePath = this.resolveLayerFilePath(layer.path);
    if (!filePath) {
      return {
        ok: false,
        reason: "readonly",
        message: "layer is not a local file",
      };
    }

    let currentContent = "";
    let currentMtimeMs = 0;
    try {
      const [content, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
      currentContent = content;
      currentMtimeMs = info.mtimeMs;
    } catch {
      // New file is allowed.
    }
    if (Math.abs(currentMtimeMs - input.baseMtimeMs) > 0.5) {
      return {
        ok: false,
        reason: "conflict",
        latest: {
          layer,
          path: filePath,
          content: currentContent,
          mtimeMs: currentMtimeMs,
        },
      };
    }

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.content, "utf8");
    const [content, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    await this.reloadSettingsLayers();
    return {
      ok: true,
      file: {
        layer,
        path: filePath,
        content,
        mtimeMs: info.mtimeMs,
      },
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

  async saveEditable(kind: EditableKind, content: string, baseMtimeMs: number): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    if (!this.settingsEditor) {
      throw new Error("runtime not started");
    }
    return this.settingsEditor.save(kind, content, baseMtimeMs);
  }

  pushUserChat(text: string): void {
    const isCompactCommand = text.trim() === "/compact";
    if (isCompactCommand) {
      this.agent?.requestCompact("user-command");
    }

    const message: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    this.chatMessages.push(message);
    this.trimChat();
    this.emit("chat", message);
    if (!isCompactCommand) {
      this.chatEngine.add({
        content: text,
        from: "user",
        score: 100,
      });
      void this.persistChatSystem().catch((error) => {
        this.emit("error", { message: error instanceof Error ? error.message : String(error) });
      });
    }
    this.runtime?.pushMessage({
      name: "User",
      role: "user",
      type: "text",
      source: "chat",
      text,
    });
  }

  triggerTaskManual(input: { source: TaskSourceName; id: string }): { ok: boolean } {
    const task = this.taskEngine.triggerManual(input.source, input.id);
    if (!task) {
      return { ok: false };
    }
    this.emit("taskUpdated", { task });
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
    }
    return { ok: true };
  }

  focusTerminal(terminalId: string): boolean {
    if (!this.terminals.has(terminalId)) {
      return false;
    }
    this.focusedTerminalId = terminalId;
    this.emit("focusedTerminal", { terminalId });
    return true;
  }

  snapshot(): SessionRuntimeSnapshot {
    const terminals = Object.values(this.config?.terminals ?? {}).map((terminal) => {
      const managed = this.terminals.get(terminal.terminalId);
      const snapshot = managed?.getSnapshot();
      return {
        terminalId: terminal.terminalId,
        running: managed?.isRunning() ?? false,
        status: managed?.getStatus() ?? "IDLE",
        seq: snapshot?.seq ?? 0,
        cwd: terminal.cwd,
      };
    });

    return {
      sessionId: this.options.sessionId,
      started: this.started,
      activityState: this.loopPhase === "waiting_messages" && this.stage === "idle" ? "idle" : "active",
      loopPhase: this.loopPhase,
      stage: this.stage,
      focusedTerminalId: this.focusedTerminalId,
      chatMessages: [...this.chatMessages],
      terminalSnapshots: { ...this.terminalSnapshots },
      terminals,
      tasks: this.taskEngine.list(),
    };
  }

  private createTerminal(terminalId: string, config: SessionTerminalConfig): void {
    const terminal = new ManagedTerminal({
      terminalId,
      command: config.command,
      cwd: config.cwd,
      cols: 80,
      rows: 24,
      outputRoot: config.outputRoot ?? join(this.options.sessionRoot, "logs", "terminals", terminalId),
      gitLog: config.gitLog,
      logStyle: "rich",
    });

    terminal.onSnapshot((snapshot) => {
      const fingerprint = snapshotFingerprint(snapshot);
      if (this.terminalSnapshotFingerprint[terminalId] === fingerprint) {
        return;
      }
      this.terminalSnapshotFingerprint[terminalId] = fingerprint;
      this.terminalSnapshots[terminalId] = snapshot;
      this.terminalLatestSeq[terminalId] = snapshot.seq;
      this.terminalDirtyState[terminalId] = true;
      this.dirtyQueue.add(terminalId);
      this.emit("terminalSnapshot", { terminalId, snapshot });
    });

    terminal.onStatus((running, status) => {
      this.emit("terminalStatus", { terminalId, running, status });
    });

    this.terminals.set(terminalId, terminal);
  }

  private async collectLoopInputs(): Promise<LoopBusInput[] | undefined> {
    await this.pollTaskSources("watch");
    await this.pollTaskEventInbox();
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
    }

    const outputs: LoopBusInput[] = [];
    if (this.taskSourceQueue.length > 0) {
      outputs.push(...this.taskSourceQueue.splice(0, this.taskSourceQueue.length));
    }
    const taskHeartbeat = this.collectTaskHeartbeatInput();
    if (taskHeartbeat) {
      outputs.push(taskHeartbeat);
    }
    const terminalInputs = await this.collectTerminalInputs();
    if (terminalInputs) {
      outputs.push(...terminalInputs);
    }
    if (outputs.length === 0) {
      const chatFacts = this.collectChatSystemInput();
      if (chatFacts) {
        outputs.push(chatFacts);
      }
    }
    return outputs.length > 0 ? outputs : undefined;
  }

  private collectChatSystemInput(): LoopBusInput | undefined {
    const active = this.chatEngine.list();
    if (active.length === 0) {
      return undefined;
    }
    return {
      name: "ChatSystem",
      role: "user",
      type: "text",
      source: "chat-system",
      text: serializeChatSystemFacts(active),
      meta: {
        count: active.length,
      },
    };
  }

  private collectTaskHeartbeatInput(): LoopBusInput | undefined {
    const now = Date.now();
    const active = this.taskEngine
      .list()
      .filter((task) => task.status !== "done" && task.status !== "canceled");
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

      const focused = this.focusedTerminalId === terminalId;
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
          text: JSON.stringify(buildTerminalSnapshotPayload(terminalId, snapshot)),
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
            }
          }
          await mkdir(join(root, "events", "done"), { recursive: true });
          await rename(file, join(root, "events", "done", name));
        } catch (error) {
          await mkdir(join(root, "events", "failed"), { recursive: true });
          await writeFile(
            join(root, "events", "failed", `${name}.error.txt`),
            error instanceof Error ? error.stack ?? error.message : String(error),
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

  private async persistChatSystem(): Promise<void> {
    if (!this.chatStore) {
      return;
    }
    await this.chatStore.save(this.chatEngine.snapshot());
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
    const loaded = await loadSettings({
      projectRoot: config.agentCwd,
      cwd: config.agentCwd,
      avatar: config.avatar.nickname,
    });
    this.settingsEffective = JSON.stringify(loaded.settings, null, 2);
    this.settingsLayers = loaded.meta.sources.map((source, index) => {
      const editable = this.isEditableLayerPath(source.path);
      return {
        layerId: `${index}:${source.id}`,
        sourceId: source.id,
        path: source.path,
        exists: source.exists,
        editable,
        readonlyReason: editable ? undefined : "remote settings source",
      };
    });
  }

  private isEditableLayerPath(path: string): boolean {
    if (isAbsolute(path) || path.startsWith("~/")) {
      return true;
    }
    if (path.startsWith("file://")) {
      return true;
    }
    return !/^[a-z][a-z0-9+.-]*:\/\//i.test(path);
  }

  private resolveLayerFilePath(path: string): string | null {
    if (isAbsolute(path)) {
      return path;
    }
    if (path.startsWith("~/")) {
      return join(homedir(), path.slice(2));
    }
    if (path.startsWith("file://")) {
      try {
        return fileURLToPath(path);
      } catch {
        return null;
      }
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
      return null;
    }
    return join(this.options.cwd, path);
  }
}
