import type { AgenterClient } from "./trpc-client";
import type { RuntimeClientState, RuntimeEvent, SessionEntry } from "./types";

const createInitialState = (): RuntimeClientState => ({
  connected: false,
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  chatsBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
});

type Listener = (state: RuntimeClientState) => void;
type SubscriptionHandle = { unsubscribe: () => void };

const sortSessions = (sessions: SessionEntry[]): SessionEntry[] => {
  return [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export class RuntimeStore {
  private state: RuntimeClientState = createInitialState();
  private readonly listeners = new Set<Listener>();
  private eventSub: SubscriptionHandle | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connecting = false;
  private shouldReconnect = false;

  constructor(private readonly client: AgenterClient) {}

  getState(): RuntimeClientState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    await this.connectOnce();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.eventSub?.unsubscribe();
    this.eventSub = null;
    this.state = {
      ...this.state,
      connected: false,
    };
    this.emit();
    this.client.close();
  }

  private async connectOnce(): Promise<void> {
    if (this.connecting) {
      return;
    }
    this.connecting = true;

    try {
      const snapshot = await this.client.trpc.runtime.snapshot.query();
      const recentWorkspaces = await this.client.trpc.workspace.recent.query({ limit: 8 });
      this.state = {
        ...this.state,
        connected: true,
        sessions: sortSessions(snapshot.sessions),
        runtimes: snapshot.runtimes,
        lastEventId: snapshot.lastEventId,
        recentWorkspaces: recentWorkspaces.items,
        activityBySession: Object.fromEntries(
          Object.entries(snapshot.runtimes).map(([sessionId, runtime]) => [sessionId, runtime.activityState ?? "idle"]),
        ),
        terminalSnapshotsBySession: Object.fromEntries(
          Object.entries(snapshot.runtimes).map(([sessionId, runtime]) => [sessionId, runtime.terminalSnapshots ?? {}]),
        ),
        chatsBySession: Object.fromEntries(
          Object.entries(snapshot.runtimes).map(([sessionId, runtime]) => [sessionId, runtime.chatMessages ?? []]),
        ),
        tasksBySession: Object.fromEntries(
          Object.entries(snapshot.runtimes).map(([sessionId, runtime]) => [sessionId, runtime.tasks ?? []]),
        ),
      };
      this.emit();

      this.reconnectAttempt = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.eventSub?.unsubscribe();
      this.eventSub = this.client.trpc.runtime.events.subscribe(
        { afterEventId: snapshot.lastEventId },
        {
          onData: (event) => {
            this.applyEvent(event);
            this.state = { ...this.state, connected: true };
            this.emit();
          },
          onError: () => {
            this.handleConnectionLoss();
          },
        },
      );
    } catch {
      this.handleConnectionLoss();
    } finally {
      this.connecting = false;
    }
  }

  private handleConnectionLoss(): void {
    this.state = { ...this.state, connected: false };
    this.emit();

    if (!this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    const delayMs = Math.min(250 * 2 ** this.reconnectAttempt, 4_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectOnce();
    }, delayMs);
  }

  async createSession(input: {
    cwd: string;
    name?: string;
    avatar?: string;
    autoStart?: boolean;
  }): Promise<SessionEntry> {
    const result = await this.client.trpc.session.create.mutate(input);
    this.upsertSession(result.session);
    await this.hydrateRuntime(result.session.id);
    return result.session;
  }

  async startSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.start.mutate({ sessionId });
    this.upsertSession(result.session);
    await this.hydrateRuntime(sessionId);
  }

  async stopSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.stop.mutate({ sessionId });
    this.upsertSession(result.session);
    await this.hydrateRuntime(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.trpc.session.delete.mutate({ sessionId });
    this.state.sessions = this.state.sessions.filter((item) => item.id !== sessionId);
    delete this.state.runtimes[sessionId];
    delete this.state.activityBySession[sessionId];
    delete this.state.terminalSnapshotsBySession[sessionId];
    delete this.state.chatsBySession[sessionId];
    delete this.state.tasksBySession[sessionId];
    this.emit();
  }

  async sendChat(sessionId: string, text: string): Promise<void> {
    const result = await this.client.trpc.chat.send.mutate({ sessionId, text });
    if (!result.ok) {
      throw new Error(result.reason ?? "chat send failed");
    }
  }

  async readSettings(sessionId: string, kind: "settings" | "agenter" | "system" | "template" | "contract") {
    return await this.client.trpc.settings.read.query({ sessionId, kind });
  }

  async saveSettings(input: {
    sessionId: string;
    kind: "settings" | "agenter" | "system" | "template" | "contract";
    content: string;
    baseMtimeMs: number;
  }) {
    return await this.client.trpc.settings.save.mutate(input);
  }

  async listSettingsLayers(sessionId: string) {
    return await this.client.trpc.settings.layers.list.query({ sessionId });
  }

  async readSettingsLayer(sessionId: string, layerId: string) {
    return await this.client.trpc.settings.layers.read.query({ sessionId, layerId });
  }

  async saveSettingsLayer(input: { sessionId: string; layerId: string; content: string; baseMtimeMs: number }) {
    return await this.client.trpc.settings.layers.save.mutate(input);
  }

  async listTasks(sessionId: string) {
    return await this.client.trpc.task.list.query({ sessionId });
  }

  async triggerTaskManual(sessionId: string, input: { source: string; id: string }) {
    return await this.client.trpc.task.triggerManual.mutate({ sessionId, ...input });
  }

  async emitTaskEvent(sessionId: string, input: { topic: string; payload?: unknown }) {
    return await this.client.trpc.task.emitEvent.mutate({ sessionId, ...input });
  }

  async listRecentWorkspaces(limit = 8): Promise<string[]> {
    const output = await this.client.trpc.workspace.recent.query({ limit });
    this.state = { ...this.state, recentWorkspaces: output.items };
    this.emit();
    return output.items;
  }

  async listDirectories(input?: {
    path?: string;
    includeHidden?: boolean;
  }): Promise<Array<{ name: string; path: string }>> {
    const output = await this.client.trpc.fs.listDirectories.query(input);
    return output.items;
  }

  async validateDirectory(path: string): Promise<{ ok: boolean; path: string }> {
    return await this.client.trpc.fs.validateDirectory.query({ path });
  }

  private applyEvent(event: RuntimeEvent): void {
    if (event.eventId <= this.state.lastEventId) {
      return;
    }
    this.state.lastEventId = event.eventId;

    if (event.type === "session.updated") {
      const payload = event.payload as { session: SessionEntry };
      const next = this.state.sessions.filter((item) => item.id !== payload.session.id);
      next.push(payload.session);
      this.state.sessions = sortSessions(next);
      return;
    }

    if (event.type === "session.deleted") {
      const payload = event.payload as { sessionId: string };
      this.state.sessions = this.state.sessions.filter((item) => item.id !== payload.sessionId);
      delete this.state.runtimes[payload.sessionId];
      delete this.state.activityBySession[payload.sessionId];
      delete this.state.terminalSnapshotsBySession[payload.sessionId];
      delete this.state.chatsBySession[payload.sessionId];
      delete this.state.tasksBySession[payload.sessionId];
      return;
    }

    if (event.type === "chat.message") {
      const payload = event.payload as {
        message: {
          id: string;
          role: "user" | "assistant";
          content: string;
          timestamp: number;
          channel?: "to_user" | "self_talk" | "tool_call" | "tool_result";
          format?: "plain" | "markdown";
          tool?: {
            name: string;
            ok?: boolean;
          };
        };
      };
      const sessionId = event.sessionId;
      if (!sessionId) {
        return;
      }
      const current = this.state.chatsBySession[sessionId] ?? [];
      this.state.chatsBySession[sessionId] = [...current, payload.message].slice(-200);
      return;
    }

    if (
      event.type === "runtime.phase" ||
      event.type === "runtime.stage" ||
      event.type === "runtime.stats" ||
      event.type === "runtime.focusedTerminal" ||
      event.type === "terminal.snapshot" ||
      event.type === "terminal.status" ||
      event.type === "runtime.error" ||
      event.type === "task.updated" ||
      event.type === "task.deleted" ||
      event.type === "task.triggered" ||
      event.type === "task.source.changed"
    ) {
      const sessionId = event.sessionId;
      if (!sessionId) {
        return;
      }
      const runtime = this.state.runtimes[sessionId];
      if (!runtime) {
        return;
      }
      if (event.type === "runtime.phase") {
        runtime.loopPhase = (event.payload as { phase: typeof runtime.loopPhase }).phase;
        this.state.activityBySession[sessionId] =
          runtime.loopPhase === "waiting_messages" && runtime.stage === "idle" ? "idle" : "active";
      } else if (event.type === "runtime.stage") {
        runtime.stage = (event.payload as { stage: typeof runtime.stage }).stage;
        this.state.activityBySession[sessionId] =
          runtime.loopPhase === "waiting_messages" && runtime.stage === "idle" ? "idle" : "active";
      } else if (event.type === "runtime.focusedTerminal") {
        runtime.focusedTerminalId = (event.payload as { terminalId: string }).terminalId;
      } else if (event.type === "terminal.status") {
        const payload = event.payload as { terminalId: string; running: boolean; status: "IDLE" | "BUSY" };
        runtime.terminals = runtime.terminals.map((item) =>
          item.terminalId === payload.terminalId
            ? {
                ...item,
                running: payload.running,
                status: payload.status,
              }
            : item,
        );
      } else if (event.type === "terminal.snapshot") {
        const payload = event.payload as {
          terminalId: string;
          snapshot: {
            seq: number;
            timestamp: number;
            cols: number;
            rows: number;
            lines: string[];
            cursor: { x: number; y: number };
          };
        };
        runtime.terminals = runtime.terminals.map((item) =>
          item.terminalId === payload.terminalId
            ? {
                ...item,
                seq: payload.snapshot.seq,
              }
            : item,
        );
        this.state.terminalSnapshotsBySession[sessionId] = {
          ...(this.state.terminalSnapshotsBySession[sessionId] ?? {}),
          [payload.terminalId]: payload.snapshot,
        };
      } else if (event.type === "task.updated") {
        const payload = event.payload as { task: { key: string } };
        const current = this.state.tasksBySession[sessionId] ?? [];
        const next = current.filter((item) => item.key !== payload.task.key);
        next.push(payload.task as (typeof current)[number]);
        this.state.tasksBySession[sessionId] = next;
      } else if (event.type === "task.deleted") {
        const payload = event.payload as { key: string };
        const current = this.state.tasksBySession[sessionId] ?? [];
        this.state.tasksBySession[sessionId] = current.filter((item) => item.key !== payload.key);
      }
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private async hydrateRuntime(sessionId: string): Promise<void> {
    const snapshot = await this.client.trpc.runtime.snapshot.query();
    const runtime = snapshot.runtimes[sessionId];
    if (!runtime) {
      return;
    }
    this.state.runtimes[sessionId] = runtime;
    this.state.activityBySession[sessionId] = runtime.activityState ?? "idle";
    this.state.terminalSnapshotsBySession[sessionId] = runtime.terminalSnapshots ?? {};
    this.state.chatsBySession[sessionId] = runtime.chatMessages ?? [];
    this.state.tasksBySession[sessionId] = runtime.tasks ?? [];
    this.state.lastEventId = Math.max(this.state.lastEventId, snapshot.lastEventId);
    this.emit();
  }

  private upsertSession(session: SessionEntry): void {
    const next = this.state.sessions.filter((item) => item.id !== session.id);
    next.push(session);
    this.state.sessions = sortSessions(next);

    if (!this.state.runtimes[session.id]) {
      this.state.runtimes[session.id] = {
        sessionId: session.id,
        started: session.status === "running" || session.status === "starting",
        activityState: "idle",
        loopPhase: "waiting_messages",
        stage: "idle",
        focusedTerminalId: "",
        chatMessages: [],
        terminalSnapshots: {},
        tasks: [],
        terminals: [],
      };
    }
    this.state.activityBySession[session.id] = this.state.activityBySession[session.id] ?? "idle";
    this.state.terminalSnapshotsBySession[session.id] = this.state.terminalSnapshotsBySession[session.id] ?? {};
    this.state.chatsBySession[session.id] = this.state.chatsBySession[session.id] ?? [];
    this.state.tasksBySession[session.id] = this.state.tasksBySession[session.id] ?? [];
    this.emit();
  }
}

export const createRuntimeStore = (client: AgenterClient): RuntimeStore => new RuntimeStore(client);
