import { ResourceLoader } from "@agenter/settings";

import { AgentRuntime } from "./agent-runtime";
import { AgenterAI, type AgentRuntimeStats } from "./agenter-ai";
import { DeepseekClient } from "./deepseek-client";
import type { LoopBusInput, LoopBusPhase } from "./loop-bus";
import { FilePromptStore } from "./prompt-store";
import { SessionStore } from "./session-store";
import type { ChatMessage, TaskStage } from "./types";
import { ManagedTerminal, type ManagedTerminalSnapshot } from "./managed-terminal";
import { resolveInstanceConfig, type InstanceTerminalConfig, type ResolvedInstanceConfig } from "./instance-config";
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

export interface RuntimeEventMap {
  phase: { phase: LoopBusPhase };
  stage: { stage: TaskStage };
  stats: AgentRuntimeStats;
  chat: ChatMessage;
  terminalSnapshot: { terminalId: string; snapshot: ManagedTerminalSnapshot };
  terminalStatus: { terminalId: string; running: boolean; status: "IDLE" | "BUSY" };
  focusedTerminal: { terminalId: string };
  error: { message: string };
}

export type RuntimeEvent<TType extends keyof RuntimeEventMap = keyof RuntimeEventMap> = {
  [K in TType]: {
    type: K;
    timestamp: number;
    payload: RuntimeEventMap[K];
  };
}[TType];

export interface InstanceRuntimeSnapshot {
  instanceId: string;
  started: boolean;
  loopPhase: LoopBusPhase;
  stage: TaskStage;
  focusedTerminalId: string;
  chatMessages: ChatMessage[];
  terminals: Array<{
    terminalId: string;
    running: boolean;
    status: "IDLE" | "BUSY";
    seq: number;
    cwd: string;
  }>;
}

export interface InstanceRuntimeOptions {
  instanceId: string;
  cwd: string;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

export class InstanceRuntime {
  private readonly listeners: Array<(event: RuntimeEvent) => void> = [];
  private readonly dirtyQueue = new Set<string>();
  private readonly terminalDirtyState: Record<string, boolean> = {};
  private readonly terminalLatestSeq: Record<string, number> = {};

  private config: ResolvedInstanceConfig | null = null;
  private settingsEditor: SettingsEditor | null = null;
  private terminals = new Map<string, ManagedTerminal>();
  private runtime: AgentRuntime | null = null;
  private started = false;
  private loopPhase: LoopBusPhase = "waiting_messages";
  private stage: TaskStage = "idle";
  private focusedTerminalId = "";
  private chatMessages: ChatMessage[] = [];

  constructor(private readonly options: InstanceRuntimeOptions) {}

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
    this.config = await resolveInstanceConfig(this.options.cwd);
    this.focusedTerminalId = this.config.focusedTerminalId;
    this.settingsEditor = new SettingsEditor(this.config.agentCwd, {
      agenterPath: this.config.prompt.agenterPath,
      agenterSystemPath: this.config.prompt.agenterSystemPath,
      systemTemplatePath: this.config.prompt.systemTemplatePath,
      responseContractPath: this.config.prompt.responseContractPath,
    });

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

    const deepseek = new DeepseekClient(this.config.ai.apiKey, this.config.ai.model, this.config.ai.baseUrl, {
      temperature: this.config.ai.temperature,
      maxRetries: this.config.ai.maxRetries,
    });

    const sessionStore = new SessionStore(`${this.config.agentCwd}/.agenter/logs`);

    const agent = new AgenterAI({
      deepseek,
      promptStore,
      sessionStore,
      logger: this.options.logger ?? { log: () => {} },
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
          terminal.start();
          if (this.config?.terminals[terminalId]?.gitLog) {
            await terminal.markDirty();
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
            terminal.start();
            if (this.config?.terminals[terminalId]?.gitLog) {
              await terminal.markDirty();
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
    });

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
      collectInputs: async () => this.collectTerminalInputs(),
      onUserMessage: (message) => {
        this.chatMessages.push(message);
        this.trimChat();
        this.emit("chat", message);
      },
    });

    this.runtime.start();
    this.started = true;

    for (const boot of this.config.bootTerminals) {
      if (!boot.autoRun) {
        continue;
      }
      const terminal = this.terminals.get(boot.terminalId);
      if (!terminal) {
        continue;
      }
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
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.runtime?.stop();
    this.runtime = null;

    for (const terminal of this.terminals.values()) {
      await terminal.stop();
    }
    this.terminals.clear();
    this.started = false;
    this.loopPhase = "stopped";
  }

  isStarted(): boolean {
    return this.started;
  }

  listEditableKinds(): EditableKind[] {
    return ["settings", "agenter", "system", "template", "contract"];
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
    const message: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    this.chatMessages.push(message);
    this.trimChat();
    this.emit("chat", message);
    this.runtime?.pushMessage({
      name: "User",
      role: "user",
      type: "text",
      source: "chat",
      text,
    });
  }

  focusTerminal(terminalId: string): boolean {
    if (!this.terminals.has(terminalId)) {
      return false;
    }
    this.focusedTerminalId = terminalId;
    this.emit("focusedTerminal", { terminalId });
    return true;
  }

  snapshot(): InstanceRuntimeSnapshot {
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
      instanceId: this.options.instanceId,
      started: this.started,
      loopPhase: this.loopPhase,
      stage: this.stage,
      focusedTerminalId: this.focusedTerminalId,
      chatMessages: [...this.chatMessages],
      terminals,
    };
  }

  private createTerminal(terminalId: string, config: InstanceTerminalConfig): void {
    const terminal = new ManagedTerminal({
      terminalId,
      command: config.command,
      cwd: config.cwd,
      cols: 80,
      rows: 24,
      outputRoot: config.outputRoot,
      gitLog: config.gitLog,
      logStyle: "rich",
    });

    terminal.onSnapshot((snapshot) => {
      this.terminalLatestSeq[terminalId] = snapshot.seq;
      this.terminalDirtyState[terminalId] = true;
      this.dirtyQueue.add(terminalId);
      this.runtime?.pushMessage({
        name: `Terminal-${terminalId}`,
        role: "user",
        type: "text",
        source: "terminal",
        text: "__dirty__",
        meta: {
          terminalId,
          signal: true,
          seq: snapshot.seq,
        },
      });
      this.emit("terminalSnapshot", { terminalId, snapshot });
    });

    terminal.onStatus((running, status) => {
      this.emit("terminalStatus", { terminalId, running, status });
    });

    this.terminals.set(terminalId, terminal);
  }

  private collectTerminalInputs(): LoopBusInput[] | undefined {
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

      const focused = this.focusedTerminalId === terminalId;
      const seq = this.terminalLatestSeq[terminalId] ?? 0;

      if (!focused) {
        this.terminalDirtyState[terminalId] = false;
        outputs.push({
          name: `Terminal-${terminalId}`,
          role: "user",
          type: "text",
          source: "terminal",
          text: JSON.stringify({
            kind: "terminal-dirty-summary",
            terminalId,
            focused: false,
            dirty: true,
            seq,
            status: terminal.getStatus(),
          }),
          meta: {
            terminalId,
            focused: false,
            seq,
            signal: "summary",
          },
        });
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

      // Best-effort slice for focused terminal with git history enabled.
      // Keep remark=true to advance mark and avoid replaying old diffs.
      void terminal.sliceDirty({ remark: true }).then((slice) => {
        if (!slice.ok || !slice.changed || slice.fromHash === slice.toHash) {
          this.terminalDirtyState[terminalId] = false;
          return;
        }
        this.runtime?.pushMessage({
          name: `Terminal-${terminalId}`,
          role: "user",
          type: "text",
          source: "terminal",
          text: serializeTerminalDiff(terminalId, {
            fromHash: slice.fromHash,
            toHash: slice.toHash,
            diff: slice.diff,
            bytes: slice.bytes,
            status: terminal.getStatus(),
          }),
          meta: {
            terminalId,
            focused: true,
            fromHash: slice.fromHash ?? "none",
            toHash: slice.toHash ?? "none",
            bytes: slice.bytes,
          },
        });
      });
    }

    return outputs.length > 0 ? outputs : undefined;
  }

  private trimChat(): void {
    if (this.chatMessages.length <= 120) {
      return;
    }
    this.chatMessages = this.chatMessages.slice(this.chatMessages.length - 120);
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
}
