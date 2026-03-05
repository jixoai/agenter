import { accessSync, constants as fsConstants, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  settingsKindSchema,
  type AnyRuntimeEvent,
  type RuntimeEventEnvelope,
  type RuntimeEventType,
  type RuntimeSnapshotPayload,
} from "./realtime-types";
import { SessionCatalog, type SessionMeta } from "./session-catalog";
import { resolveSessionConfig } from "./session-config";
import { SessionRuntime, type RuntimeEvent } from "./session-runtime";
import type { ChatMessage } from "./types";
import { WorkspacesStore } from "./workspaces-store";

const now = (): number => Date.now();

type KernelListener = (event: AnyRuntimeEvent) => void;

export interface AppKernelOptions {
  globalSessionRoot?: string;
  workspacesPath?: string;
  initialWorkspace?: string;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

export class AppKernel {
  private readonly sessions: SessionCatalog;
  private readonly workspaces: WorkspacesStore;
  private readonly runtimes = new Map<string, SessionRuntime>();
  private readonly runtimeStopListeners = new Map<string, () => void>();
  private readonly listeners = new Set<KernelListener>();
  private readonly eventLog: AnyRuntimeEvent[] = [];
  private eventSeq = 0;

  constructor(private readonly options: AppKernelOptions = {}) {
    this.sessions = new SessionCatalog({ globalRoot: options.globalSessionRoot });
    this.workspaces = new WorkspacesStore({ filePath: options.workspacesPath });
  }

  async start(): Promise<void> {
    if (this.options.initialWorkspace) {
      this.workspaces.add(this.options.initialWorkspace);
    }
    this.sessions.refresh(this.workspaces.list());
  }

  async stop(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      await runtime.stop();
    }
    this.runtimes.clear();
    this.runtimeStopListeners.clear();
  }

  getSnapshot(): RuntimeSnapshotPayload {
    const runtimes = Object.fromEntries(
      [...this.runtimes.entries()].map(([sessionId, runtime]) => [sessionId, runtime.snapshot()]),
    );

    return {
      version: 1,
      timestamp: now(),
      lastEventId: this.eventSeq,
      sessions: this.sessions.list(),
      runtimes,
    };
  }

  onEvent(listener: KernelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEventsAfter(afterEventId: number): AnyRuntimeEvent[] {
    if (afterEventId >= this.eventSeq || this.eventLog.length === 0) {
      return [];
    }
    return this.eventLog.filter((event) => event.eventId > afterEventId);
  }

  listSessions(): SessionMeta[] {
    this.sessions.refresh(this.workspaces.list());
    return this.sessions.list();
  }

  listRecentWorkspaces(limit = 8): string[] {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 128));
    const list = this.workspaces.list();
    if (list.length <= safeLimit) {
      return list;
    }
    return list.slice(-safeLimit);
  }

  listDirectories(input: { path?: string; includeHidden?: boolean }): Array<{ name: string; path: string }> {
    const root = resolve(input.path ?? "/");
    const includeHidden = input.includeHidden ?? false;
    try {
      accessSync(root, fsConstants.R_OK);
      const entries = readdirSync(root, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => includeHidden || !entry.name.startsWith("."))
        .map((entry) => ({
          name: entry.name,
          path: join(root, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  validateDirectory(path: string): { ok: boolean; path: string } {
    try {
      const stat = statSync(path);
      if (!stat.isDirectory()) {
        return { ok: false, path };
      }
      accessSync(path, fsConstants.R_OK);
      return { ok: true, path };
    } catch {
      return { ok: false, path };
    }
  }

  getSession(sessionId: string): SessionMeta | undefined {
    return this.sessions.get(sessionId);
  }

  async createSession(input: {
    name?: string;
    cwd: string;
    avatar?: string;
    autoStart?: boolean;
  }): Promise<SessionMeta> {
    const resolved = await resolveSessionConfig(input.cwd, { avatar: input.avatar });
    this.workspaces.add(input.cwd);

    const session = this.sessions.create({
      name: input.name,
      cwd: input.cwd,
      avatar: resolved.avatar.nickname,
      storeTarget: resolved.sessionStoreTarget,
    });
    this.emit("session.updated", { session }, session.id);

    if (input.autoStart === false) {
      return session;
    }

    return await this.startSession(session.id);
  }

  updateSession(sessionId: string, patch: { name?: string }): SessionMeta {
    const session = this.sessions.update(sessionId, {
      name: patch.name,
    });
    this.emit("session.updated", { session }, session.id);
    return session;
  }

  async deleteSession(sessionId: string): Promise<{ removed: boolean }> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(sessionId);
    }
    const removed = this.sessions.remove(sessionId);
    if (removed) {
      this.emit("session.deleted", { sessionId, removed }, sessionId);
    }
    return { removed };
  }

  async startSession(sessionId: string): Promise<SessionMeta> {
    const meta = this.sessions.get(sessionId);
    if (!meta) {
      throw new Error(`session not found: ${sessionId}`);
    }

    this.workspaces.add(meta.cwd);

    const existing = this.runtimes.get(sessionId);
    if (existing?.isStarted()) {
      const running = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      this.emit("session.updated", { session: running }, sessionId);
      return running;
    }

    this.sessions.update(sessionId, { status: "starting", lastError: undefined });
    const runtime = new SessionRuntime({
      sessionId: meta.id,
      cwd: meta.cwd,
      avatar: meta.avatar,
      sessionRoot: meta.sessionRoot,
      sessionName: meta.name,
      storeTarget: meta.storeTarget,
      logger: this.options.logger,
    });
    runtime.setSessionStatus("starting");

    const unsubscribe = runtime.onEvent((event) => {
      this.forwardRuntimeEvent(meta.id, event);
    });

    this.runtimes.set(sessionId, runtime);
    this.runtimeStopListeners.set(sessionId, unsubscribe);

    try {
      await runtime.start();
      const updated = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      runtime.setSessionStatus("running");
      this.emit("session.updated", { session: updated }, sessionId);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.setSessionStatus("error", message);
      this.detachRuntime(sessionId);
      const failed = this.sessions.update(sessionId, { status: "error", lastError: message });
      this.emit("session.updated", { session: failed }, sessionId);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<SessionMeta> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.stop();
      this.detachRuntime(sessionId);
    }
    const stopped = this.sessions.update(sessionId, { status: "stopped", lastError: undefined });
    this.emit("session.updated", { session: stopped }, sessionId);
    return stopped;
  }

  focusTerminal(sessionId: string, terminalId: string): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    const ok = runtime.focusTerminal(terminalId);
    return { ok };
  }

  async sendChat(sessionId: string, text: string): Promise<{ ok: boolean; reason?: string }> {
    try {
      const runtime = await this.ensureRuntime(sessionId);
      runtime.pushUserChat(text);
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, reason };
    }
  }

  listTasks(sessionId: string): { ok: boolean; tasks: ReturnType<SessionRuntime["snapshot"]>["tasks"] } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false, tasks: [] };
    }
    return { ok: true, tasks: runtime.snapshot().tasks };
  }

  triggerTaskManual(sessionId: string, input: { source: string; id: string }): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.triggerTaskManual(input);
  }

  emitTaskEvent(
    sessionId: string,
    input: { topic: string; payload?: unknown; source?: "api" | "file" | "tool" },
  ): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.emitTaskEvent(input);
  }

  async readSettings(input: {
    sessionId: string;
    kind: unknown;
  }): Promise<{ path: string; content: string; mtimeMs: number }> {
    const runtime = await this.ensureRuntime(input.sessionId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.readEditable(kind);
  }

  async listSettingsLayers(sessionId: string): Promise<ReturnType<SessionRuntime["getSettingsLayers"]>> {
    const runtime = await this.ensureRuntime(sessionId);
    return runtime.getSettingsLayers();
  }

  async readSettingsLayer(input: {
    sessionId: string;
    layerId: string;
  }): Promise<Awaited<ReturnType<SessionRuntime["readSettingsLayer"]>>> {
    const runtime = await this.ensureRuntime(input.sessionId);
    return runtime.readSettingsLayer(input.layerId);
  }

  async saveSettingsLayer(input: {
    sessionId: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }): Promise<Awaited<ReturnType<SessionRuntime["saveSettingsLayer"]>>> {
    const runtime = await this.ensureRuntime(input.sessionId);
    return runtime.saveSettingsLayer({
      layerId: input.layerId,
      content: input.content,
      baseMtimeMs: input.baseMtimeMs,
    });
  }

  async saveSettings(input: {
    sessionId: string;
    kind: unknown;
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    const runtime = await this.ensureRuntime(input.sessionId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.saveEditable(kind, input.content, input.baseMtimeMs);
  }

  private async ensureRuntime(sessionId: string): Promise<SessionRuntime> {
    if (this.runtimes.has(sessionId)) {
      return this.runtimes.get(sessionId)!;
    }
    await this.startSession(sessionId);
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      throw new Error(`runtime not found for session ${sessionId}`);
    }
    return runtime;
  }

  private detachRuntime(sessionId: string): void {
    this.runtimes.delete(sessionId);
    const unsubscribe = this.runtimeStopListeners.get(sessionId);
    if (unsubscribe) {
      unsubscribe();
      this.runtimeStopListeners.delete(sessionId);
    }
  }

  private forwardRuntimeEvent(sessionId: string, event: RuntimeEvent): void {
    switch (event.type) {
      case "chat":
        this.emit("chat.message", { message: event.payload as ChatMessage }, sessionId, event.timestamp);
        return;
      case "phase":
        this.emit("runtime.phase", { phase: event.payload.phase }, sessionId, event.timestamp);
        return;
      case "stage":
        this.emit("runtime.stage", { stage: event.payload.stage }, sessionId, event.timestamp);
        return;
      case "stats":
        this.emit("runtime.stats", event.payload, sessionId, event.timestamp);
        return;
      case "focusedTerminal":
        this.emit("runtime.focusedTerminal", { terminalId: event.payload.terminalId }, sessionId, event.timestamp);
        return;
      case "terminalSnapshot":
        this.emit("terminal.snapshot", event.payload, sessionId, event.timestamp);
        return;
      case "terminalStatus":
        this.emit("terminal.status", event.payload, sessionId, event.timestamp);
        return;
      case "taskUpdated":
        this.emit("task.updated", event.payload, sessionId, event.timestamp);
        return;
      case "taskDeleted":
        this.emit("task.deleted", event.payload, sessionId, event.timestamp);
        return;
      case "taskTriggered":
        this.emit("task.triggered", event.payload, sessionId, event.timestamp);
        return;
      case "taskSourceChanged":
        this.emit("task.source.changed", event.payload, sessionId, event.timestamp);
        return;
      case "error":
        this.emit("runtime.error", event.payload, sessionId, event.timestamp);
        return;
    }
  }

  private emit<TType extends RuntimeEventType>(
    type: TType,
    payload: unknown,
    sessionId?: string,
    timestamp = now(),
  ): RuntimeEventEnvelope<TType, unknown> {
    const event: RuntimeEventEnvelope<TType, unknown> = {
      version: 1,
      eventId: ++this.eventSeq,
      timestamp,
      type,
      sessionId,
      payload,
    };
    this.eventLog.push(event);
    if (this.eventLog.length > 2048) {
      this.eventLog.splice(0, this.eventLog.length - 2048);
    }
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }
}
