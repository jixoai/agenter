import type { AgenterClient } from "./trpc-client";
import type {
  ChatListItem,
  ChatCycleItem,
  DraftResolutionOutput,
  ModelDebugOutput,
  RuntimeChatMessage,
  RuntimeChatCycle,
  RuntimeClientState,
  RuntimeEvent,
  RuntimeSnapshotEntry,
  SessionEntry,
  UploadedSessionImage,
  WorkspacePathSearchOutput,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceSessionTab,
} from "./types";

const createInitialState = (): RuntimeClientState => ({
  connected: false,
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  chatsBySession: {},
  chatCyclesBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  loopbusStateLogsBySession: {},
  loopbusTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  apiCallRecordingBySession: {},
});

type Listener = (state: RuntimeClientState) => void;
type SubscriptionHandle = { unsubscribe: () => void };

const sortSessions = (sessions: SessionEntry[]): SessionEntry[] => {
  return [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const LOOPBUS_LRU_LIMIT = 100;

const withTrailingSlashTrimmed = (value: string): string => value.replace(/\/$/, "");

export class RuntimeStore {
  private state: RuntimeClientState = createInitialState();
  private readonly listeners = new Set<Listener>();
  private eventSub: SubscriptionHandle | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connecting = false;
  private shouldReconnect = false;
  private readonly apiCallStreams = new Map<
    string,
    { count: number; sub: SubscriptionHandle | null; cursor: number }
  >();
  private readonly loopbusLogsAccessBySession = new Map<string, Map<number, number>>();
  private readonly loopbusTracesAccessBySession = new Map<string, Map<number, number>>();
  private readonly apiCallsAccessBySession = new Map<string, Map<number, number>>();
  private readonly modelCallsAccessBySession = new Map<string, Map<number, number>>();
  private readonly loopbusLogsBeforeCursorBySession = new Map<string, number>();
  private readonly loopbusTracesBeforeCursorBySession = new Map<string, number>();
  private readonly apiCallsBeforeCursorBySession = new Map<string, number>();
  private readonly modelCallsBeforeCursorBySession = new Map<string, number>();
  private readonly chatBeforeCursorBySession = new Map<string, number>();
  private readonly chatCyclesBeforeCursorBySession = new Map<string, number>();
  private accessTick = 0;

  constructor(private readonly client: AgenterClient) {}

  private resolveHttpUrl(pathname: string): string {
    return `${withTrailingSlashTrimmed(this.client.httpUrl)}${pathname}`;
  }

  private resolveMediaUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return url.startsWith("/") ? this.resolveHttpUrl(url) : url;
  }

  private normalizeRuntimeChatMessage(message: RuntimeChatMessage): RuntimeChatMessage {
    return {
      ...message,
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        url: this.resolveMediaUrl(attachment.url),
      })),
    };
  }

  private normalizeRuntimeChatCycle(cycle: RuntimeChatCycle): RuntimeChatCycle {
    return {
      ...cycle,
      inputs: cycle.inputs.map((input) => ({
        ...input,
        parts: input.parts.map((part) =>
          part.type === "image"
            ? {
                ...part,
                url: this.resolveMediaUrl(part.url),
              }
            : part,
        ),
      })),
      outputs: cycle.outputs.map((message) => this.normalizeRuntimeChatMessage(message)),
      liveMessages: cycle.liveMessages.map((message) => this.normalizeRuntimeChatMessage(message)),
    };
  }

  private toRuntimeChatMessage(item: ChatListItem): RuntimeChatMessage {
    return {
      id: item.messageId,
      role: item.role,
      content: item.content,
      timestamp: item.timestamp,
      channel: item.channel === "user_input" ? undefined : item.channel,
      format: item.format,
      tool: item.tool,
      attachments: item.attachments?.map((attachment) => ({
        ...attachment,
        url: this.resolveMediaUrl(attachment.url),
      })),
    };
  }

  private toRuntimeChatCycle(item: ChatCycleItem): RuntimeChatCycle {
    return this.normalizeRuntimeChatCycle(item);
  }

  private mergeChatCycles(current: RuntimeChatCycle[], incoming: RuntimeChatCycle[]): RuntimeChatCycle[] {
    const pendingMatches = new Set<string>();
    for (const cycle of incoming) {
      for (const clientMessageId of cycle.clientMessageIds ?? []) {
        pendingMatches.add(`pending:${clientMessageId}`);
      }
    }

    const entries = new Map<string, RuntimeChatCycle>();
    for (const cycle of current) {
      if (pendingMatches.has(cycle.id)) {
        continue;
      }
      entries.set(cycle.id, cycle);
    }
    for (const cycle of incoming) {
      const previous = entries.get(cycle.id);
      if (!previous) {
        entries.set(cycle.id, cycle);
        continue;
      }
      if (previous.status !== "done" && cycle.status === "done") {
        const incomingLooksIncomplete = cycle.outputs.length === 0 && cycle.modelCallId === null;
        if (incomingLooksIncomplete) {
          entries.set(cycle.id, {
            ...cycle,
            status: previous.status,
            outputs: previous.outputs,
            liveMessages: previous.liveMessages,
            streaming: previous.streaming ?? cycle.streaming,
            modelCallId: previous.modelCallId ?? cycle.modelCallId,
          });
          continue;
        }
        entries.set(cycle.id, {
          ...cycle,
          outputs: cycle.outputs.length >= previous.outputs.length ? cycle.outputs : previous.outputs,
          liveMessages: cycle.liveMessages,
          streaming: cycle.streaming,
          modelCallId: cycle.modelCallId ?? previous.modelCallId,
        });
        continue;
      }
      entries.set(cycle.id, {
        ...previous,
        ...cycle,
        outputs: cycle.outputs.length >= previous.outputs.length ? cycle.outputs : previous.outputs,
        liveMessages: cycle.liveMessages,
        streaming: cycle.streaming,
        modelCallId: cycle.modelCallId ?? previous.modelCallId,
      });
    }

    return [...entries.values()].sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }
      if (left.cycleId !== null && right.cycleId !== null && left.cycleId !== right.cycleId) {
        return left.cycleId - right.cycleId;
      }
      return left.id.localeCompare(right.id);
    });
  }

  private createOptimisticCycle(input: {
    text: string;
    clientMessageId: string;
    attachments?: UploadedSessionImage[];
  }): RuntimeChatCycle {
    const now = Date.now();
    return {
      id: `pending:${input.clientMessageId}`,
      cycleId: null,
      seq: null,
      createdAt: now,
      wakeSource: "user",
      kind: input.text.trim() === "/compact" ? "compact" : "model",
      status: "pending",
      clientMessageIds: [input.clientMessageId],
      inputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [
            { type: "text", text: input.text },
            ...(input.attachments ?? []).map((attachment) => ({
              type: "image" as const,
              assetId: attachment.assetId,
              mimeType: attachment.mimeType,
              name: attachment.name,
              sizeBytes: attachment.sizeBytes,
              url: this.resolveMediaUrl(attachment.url),
            })),
          ],
          meta: {
            clientMessageId: input.clientMessageId,
          },
        },
      ],
      outputs: [],
      liveMessages: [],
      streaming: null,
      modelCallId: null,
    };
  }

  private normalizeRuntimeEntry(runtime: RuntimeSnapshotEntry): RuntimeSnapshotEntry {
    return {
      ...runtime,
      chatMessages: runtime.chatMessages.map((message) => this.normalizeRuntimeChatMessage(message)),
      activeCycle: runtime.activeCycle ? this.normalizeRuntimeChatCycle(runtime.activeCycle) : null,
      modelCapabilities: runtime.modelCapabilities ?? { imageInput: false },
    };
  }

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
    for (const stream of this.apiCallStreams.values()) {
      stream.sub?.unsubscribe();
    }
    this.apiCallStreams.clear();
    this.loopbusLogsAccessBySession.clear();
    this.loopbusTracesAccessBySession.clear();
    this.apiCallsAccessBySession.clear();
    this.modelCallsAccessBySession.clear();
    this.loopbusLogsBeforeCursorBySession.clear();
    this.loopbusTracesBeforeCursorBySession.clear();
    this.apiCallsBeforeCursorBySession.clear();
    this.modelCallsBeforeCursorBySession.clear();
    this.chatBeforeCursorBySession.clear();
    this.chatCyclesBeforeCursorBySession.clear();
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
      const workspaces = await this.client.trpc.workspace.listAll.query();
      const runtimes = Object.fromEntries(
        Object.entries(snapshot.runtimes).map(([sessionId, runtime]) => [
          sessionId,
          this.normalizeRuntimeEntry(runtime),
        ]),
      );
      this.state = {
        ...this.state,
        connected: true,
        sessions: sortSessions(snapshot.sessions),
        runtimes,
        lastEventId: snapshot.lastEventId,
        recentWorkspaces: recentWorkspaces.items,
        activityBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.activityState ?? "idle"]),
        ),
        terminalSnapshotsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.terminalSnapshots ?? {}]),
        ),
        chatsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.chatMessages ?? []]),
        ),
        chatCyclesBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [
            sessionId,
            runtime.activeCycle ? [runtime.activeCycle] : [],
          ]),
        ),
        tasksBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.tasks ?? []]),
        ),
        loopbusStateLogsBySession: Object.fromEntries(Object.entries(runtimes).map(([sessionId]) => [sessionId, []])),
        loopbusTracesBySession: Object.fromEntries(Object.entries(runtimes).map(([sessionId]) => [sessionId, []])),
        apiCallsBySession: Object.fromEntries(Object.entries(runtimes).map(([sessionId]) => [sessionId, []])),
        modelCallsBySession: Object.fromEntries(Object.entries(runtimes).map(([sessionId]) => [sessionId, []])),
        apiCallRecordingBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.apiCallRecording]),
        ),
        workspaces: workspaces.items,
      };
      for (const session of this.state.sessions) {
        this.ensureRuntimeScaffold(session.id, session.status);
      }
      this.emit();
      for (const sessionId of this.state.sessions.map((session) => session.id)) {
        void this.hydrateLoopbusArtifacts(sessionId);
      }

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
    await this.listAllWorkspaces();
    return result.session;
  }

  async startSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.start.mutate({ sessionId });
    this.upsertSession(result.session);
    await this.hydrateRuntime(sessionId);
    await this.listAllWorkspaces();
  }

  async stopSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.stop.mutate({ sessionId });
    this.upsertSession(result.session);
    await this.hydrateRuntime(sessionId);
    await this.listAllWorkspaces();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.trpc.session.delete.mutate({ sessionId });
    this.state.sessions = this.state.sessions.filter((item) => item.id !== sessionId);
    delete this.state.runtimes[sessionId];
    delete this.state.activityBySession[sessionId];
    delete this.state.terminalSnapshotsBySession[sessionId];
    delete this.state.chatsBySession[sessionId];
    delete this.state.chatCyclesBySession[sessionId];
    delete this.state.tasksBySession[sessionId];
    delete this.state.loopbusStateLogsBySession[sessionId];
    delete this.state.loopbusTracesBySession[sessionId];
    delete this.state.apiCallsBySession[sessionId];
    delete this.state.modelCallsBySession[sessionId];
    delete this.state.apiCallRecordingBySession[sessionId];
    this.loopbusLogsAccessBySession.delete(sessionId);
    this.loopbusTracesAccessBySession.delete(sessionId);
    this.apiCallsAccessBySession.delete(sessionId);
    this.modelCallsAccessBySession.delete(sessionId);
    this.loopbusLogsBeforeCursorBySession.delete(sessionId);
    this.loopbusTracesBeforeCursorBySession.delete(sessionId);
    this.apiCallsBeforeCursorBySession.delete(sessionId);
    this.modelCallsBeforeCursorBySession.delete(sessionId);
    this.chatBeforeCursorBySession.delete(sessionId);
    this.chatCyclesBeforeCursorBySession.delete(sessionId);
    this.emit();
    await this.listAllWorkspaces();
  }

  async archiveSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.archive.mutate({ sessionId });
    this.upsertSession(result.session);
    delete this.state.runtimes[sessionId];
    delete this.state.activityBySession[sessionId];
    delete this.state.terminalSnapshotsBySession[sessionId];
    await this.listAllWorkspaces();
  }

  async restoreSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.restore.mutate({ sessionId });
    this.upsertSession(result.session);
    await this.listAllWorkspaces();
  }

  async toggleSessionFavorite(sessionId: string): Promise<{ sessionId: string; favorite: boolean }> {
    const result = await this.client.trpc.workspace.toggleSessionFavorite.mutate({ sessionId });
    await this.listAllWorkspaces();
    return result;
  }

  async listWorkspaceSessions(input: {
    path: string;
    tab: WorkspaceSessionTab;
    cursor?: number;
    limit?: number;
  }): Promise<{ items: WorkspaceSessionEntry[]; nextCursor: number | null; counts: WorkspaceSessionCounts }> {
    return await this.client.trpc.workspace.listSessions.query(input);
  }

  async inspectModelDebug(sessionId: string): Promise<ModelDebugOutput> {
    return await this.client.trpc.runtime.modelDebug.query({ sessionId });
  }

  async resolveDraft(input: { cwd: string; avatar?: string }): Promise<DraftResolutionOutput> {
    return await this.client.trpc.draft.resolve.query(input);
  }

  async searchWorkspacePaths(input: {
    cwd: string;
    query?: string;
    limit?: number;
  }): Promise<WorkspacePathSearchOutput["items"]> {
    const output = await this.client.trpc.workspace.searchPaths.query(input);
    return output.items;
  }

  async uploadSessionImages(sessionId: string, files: File[]): Promise<UploadedSessionImage[]> {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
    }
    const response = await fetch(this.resolveHttpUrl(`/api/sessions/${encodeURIComponent(sessionId)}/images`), {
      method: "POST",
      body: form,
    });
    const payload = (await response.json()) as {
      ok: boolean;
      items?: UploadedSessionImage[];
      error?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `image upload failed (${response.status})`);
    }
    return (payload.items ?? []).map((item) => ({
      ...item,
      url: this.resolveMediaUrl(item.url),
    }));
  }

  async sendChat(
    sessionId: string,
    text: string,
    assetIds: string[] = [],
    attachments: UploadedSessionImage[] = [],
  ): Promise<void> {
    const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticId = `pending:${clientMessageId}`;
    this.state.chatCyclesBySession[sessionId] = this.mergeChatCycles(this.state.chatCyclesBySession[sessionId] ?? [], [
      this.createOptimisticCycle({ text, clientMessageId, attachments }),
    ]);
    this.emit();
    try {
      const result = await this.client.trpc.chat.send.mutate({ sessionId, text, assetIds, clientMessageId });
      if (!result.ok) {
        throw new Error(result.reason ?? "chat send failed");
      }
    } catch (error) {
      this.state.chatCyclesBySession[sessionId] = (this.state.chatCyclesBySession[sessionId] ?? []).filter(
        (cycle) => cycle.id !== optimisticId,
      );
      this.emit();
      throw error;
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

  async listAllWorkspaces() {
    const output = await this.client.trpc.workspace.listAll.query();
    this.state = { ...this.state, workspaces: output.items };
    this.emit();
    return output.items;
  }

  async toggleWorkspaceFavorite(path: string) {
    await this.client.trpc.workspace.toggleFavorite.mutate({ path });
    await this.listAllWorkspaces();
    await this.listRecentWorkspaces(8);
  }

  async removeWorkspace(path: string) {
    await this.client.trpc.workspace.delete.mutate({ path });
    await this.listAllWorkspaces();
    await this.listRecentWorkspaces(8);
  }

  async cleanMissingWorkspaces(): Promise<string[]> {
    const result = await this.client.trpc.workspace.cleanMissing.mutate();
    await this.listAllWorkspaces();
    await this.listRecentWorkspaces(8);
    return result.removed;
  }

  async loadChatMessages(sessionId: string, limit = 120): Promise<void> {
    const output = await this.client.trpc.chat.list.query({ sessionId, afterId: 0, limit });
    const mapped = output.items.map((item) => this.toRuntimeChatMessage(item));
    this.state.chatsBySession[sessionId] = mapped;
    if (output.items.length > 0) {
      this.chatBeforeCursorBySession.set(sessionId, output.items[0].id);
    }
    this.emit();
  }

  async loadChatCycles(sessionId: string, limit = 120): Promise<void> {
    const output = await this.client.trpc.chat.cycles.query({ sessionId, limit });
    const mapped = output.items.map((item) => this.toRuntimeChatCycle(item));
    this.state.chatCyclesBySession[sessionId] = this.mergeChatCycles(
      this.state.chatCyclesBySession[sessionId] ?? [],
      mapped,
    );
    if (output.items.length > 0) {
      this.chatCyclesBeforeCursorBySession.set(sessionId, output.items[0].cycleId ?? 0);
    }
    this.emit();
  }

  async loadMoreChatMessagesBefore(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.chatsBySession[sessionId] ?? [];
    const beforeId = this.chatBeforeCursorBySession.get(sessionId) ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isFinite(beforeId)) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.chat.listBefore.query({ sessionId, beforeId, limit });
    if (output.items.length === 0) {
      return { items: 0, hasMore: false };
    }

    this.chatBeforeCursorBySession.set(sessionId, output.items[0].id);
    const mapped = output.items.map((item) => this.toRuntimeChatMessage(item));
    const known = new Set(current.map((item) => item.id));
    const merged = [...mapped.filter((item) => !known.has(item.id)), ...current];
    this.state.chatsBySession[sessionId] = merged;
    this.emit();
    return { items: mapped.length, hasMore: output.items.length >= limit };
  }

  async loadMoreChatCyclesBefore(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.chatCyclesBySession[sessionId] ?? [];
    const beforeCycleId = this.chatCyclesBeforeCursorBySession.get(sessionId) ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isFinite(beforeCycleId) || beforeCycleId <= 0) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.chat.cyclesBefore.query({ sessionId, beforeCycleId, limit });
    if (output.items.length === 0) {
      return { items: 0, hasMore: false };
    }
    this.chatCyclesBeforeCursorBySession.set(sessionId, output.items[0].cycleId ?? 0);
    const mapped = output.items.map((item) => this.toRuntimeChatCycle(item));
    const next = this.mergeChatCycles(current, mapped);
    this.state.chatCyclesBySession[sessionId] = next;
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.items.length >= limit,
    };
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

  async loadMoreLoopbusTimeline(
    sessionId: string,
    limit = 120,
  ): Promise<{ logs: number; traces: number; hasMore: boolean }> {
    const currentLogs = this.state.loopbusStateLogsBySession[sessionId] ?? [];
    const currentTraces = this.state.loopbusTracesBySession[sessionId] ?? [];
    const beforeLogId =
      this.loopbusLogsBeforeCursorBySession.get(sessionId) ??
      (currentLogs.length > 0 ? currentLogs[0].id : Number.MAX_SAFE_INTEGER);
    const beforeTraceId =
      this.loopbusTracesBeforeCursorBySession.get(sessionId) ??
      (currentTraces.length > 0 ? currentTraces[0].id : Number.MAX_SAFE_INTEGER);

    const [logs, traces] = await Promise.all([
      this.client.trpc.runtime.loopbusStateLogsBefore.query({
        sessionId,
        beforeId: beforeLogId,
        limit,
      }),
      this.client.trpc.runtime.loopbusTracesBefore.query({
        sessionId,
        beforeId: beforeTraceId,
        limit,
      }),
    ]);

    if (logs.items.length > 0) {
      this.loopbusLogsBeforeCursorBySession.set(sessionId, logs.items[0].id);
    }
    if (traces.items.length > 0) {
      this.loopbusTracesBeforeCursorBySession.set(sessionId, traces.items[0].id);
    }

    const nextLogs = this.applyLruEntries(
      this.loopbusLogsAccessBySession,
      sessionId,
      currentLogs,
      logs.items,
      LOOPBUS_LRU_LIMIT,
    );
    const nextTraces = this.applyLruEntries(
      this.loopbusTracesAccessBySession,
      sessionId,
      currentTraces,
      traces.items,
      LOOPBUS_LRU_LIMIT,
    );
    this.state.loopbusStateLogsBySession[sessionId] = nextLogs;
    this.state.loopbusTracesBySession[sessionId] = nextTraces;
    this.emit();

    const addedLogs = nextLogs.length - currentLogs.length;
    const addedTraces = nextTraces.length - currentTraces.length;
    return {
      logs: Math.max(0, addedLogs),
      traces: Math.max(0, addedTraces),
      hasMore: logs.items.length >= limit || traces.items.length >= limit,
    };
  }

  async loadMoreModelCalls(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.modelCallsBySession[sessionId] ?? [];
    const beforeId =
      this.modelCallsBeforeCursorBySession.get(sessionId) ??
      (current.length > 0 ? current[0].id : Number.MAX_SAFE_INTEGER);
    const output = await this.client.trpc.runtime.modelCallsPage.query({
      sessionId,
      beforeId,
      limit,
    });
    if (output.items.length > 0) {
      this.modelCallsBeforeCursorBySession.set(sessionId, output.items[0].id);
    }
    const next = this.applyLruEntries(
      this.modelCallsAccessBySession,
      sessionId,
      current,
      output.items,
      LOOPBUS_LRU_LIMIT,
    );
    this.state.modelCallsBySession[sessionId] = next;
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.items.length >= limit,
    };
  }

  async loadMoreApiCalls(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.apiCallsBySession[sessionId] ?? [];
    const beforeId =
      this.apiCallsBeforeCursorBySession.get(sessionId) ??
      (current.length > 0 ? current[0].id : Number.MAX_SAFE_INTEGER);
    const output = await this.client.trpc.runtime.apiCallsPage.query({
      sessionId,
      beforeId,
      limit,
    });
    if (output.items.length > 0) {
      this.apiCallsBeforeCursorBySession.set(sessionId, output.items[0].id);
    }
    const next = this.applyLruEntries(
      this.apiCallsAccessBySession,
      sessionId,
      current,
      output.items,
      LOOPBUS_LRU_LIMIT,
    );
    this.state.apiCallsBySession[sessionId] = next;
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.items.length >= limit,
    };
  }

  retainApiCallStream(sessionId: string): () => void {
    const existing = this.apiCallStreams.get(sessionId);
    if (existing) {
      existing.count += 1;
      return () => this.releaseApiCallStream(sessionId);
    }

    const cursor = this.state.apiCallsBySession[sessionId]?.at(-1)?.id ?? 0;
    const stream = {
      count: 1,
      cursor,
      sub: this.client.trpc.runtime.apiCalls.subscribe(
        { sessionId, afterId: cursor },
        {
          onData: (payload) => {
            if (payload.type === "recording") {
              this.state.apiCallRecordingBySession[sessionId] = payload.payload;
              this.emit();
              return;
            }
            const current = this.state.apiCallsBySession[sessionId] ?? [];
            if (current.some((entry) => entry.id === payload.payload.id)) {
              return;
            }
            this.state.apiCallsBySession[sessionId] = this.applyLruEntries(
              this.apiCallsAccessBySession,
              sessionId,
              current,
              [payload.payload],
              LOOPBUS_LRU_LIMIT,
            );
            this.emit();
          },
          onError: () => {
            // Stream reconnect is handled by full runtime reconnect path.
          },
        },
      ),
    };
    this.apiCallStreams.set(sessionId, stream);
    return () => this.releaseApiCallStream(sessionId);
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
      void this.listAllWorkspaces();
      return;
    }

    if (event.type === "session.deleted") {
      const payload = event.payload as { sessionId: string };
      this.state.sessions = this.state.sessions.filter((item) => item.id !== payload.sessionId);
      delete this.state.runtimes[payload.sessionId];
      delete this.state.activityBySession[payload.sessionId];
      delete this.state.terminalSnapshotsBySession[payload.sessionId];
      delete this.state.chatsBySession[payload.sessionId];
      delete this.state.chatCyclesBySession[payload.sessionId];
      delete this.state.tasksBySession[payload.sessionId];
      delete this.state.loopbusStateLogsBySession[payload.sessionId];
      delete this.state.loopbusTracesBySession[payload.sessionId];
      delete this.state.apiCallsBySession[payload.sessionId];
      delete this.state.modelCallsBySession[payload.sessionId];
      delete this.state.apiCallRecordingBySession[payload.sessionId];
      void this.listAllWorkspaces();
      return;
    }

    if (event.type === "chat.message") {
      const payload = event.payload as {
        message: RuntimeChatMessage;
      };
      const sessionId = event.sessionId;
      if (!sessionId) {
        return;
      }
      const message = this.normalizeRuntimeChatMessage(payload.message);
      const current = this.state.chatsBySession[sessionId] ?? [];
      if (current.some((item) => item.id === message.id)) {
        return;
      }
      this.state.chatsBySession[sessionId] = [...current, message].slice(-200);
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
      event.type === "task.source.changed" ||
      event.type === "runtime.loopbus.snapshot" ||
      event.type === "runtime.loopbus.stateLog" ||
      event.type === "runtime.loopbus.trace" ||
      event.type === "runtime.loopbus.inputSignal" ||
      event.type === "runtime.modelCall" ||
      event.type === "runtime.apiCall" ||
      event.type === "runtime.apiRecording" ||
      event.type === "runtime.cycle.updated"
    ) {
      const sessionId = event.sessionId;
      if (!sessionId) {
        return;
      }
      let runtime = this.state.runtimes[sessionId];
      if (!runtime) {
        const session = this.state.sessions.find((item) => item.id === sessionId);
        this.ensureRuntimeScaffold(sessionId, session?.status);
        runtime = this.state.runtimes[sessionId];
        if (!runtime) {
          return;
        }
      }
      if (event.type === "runtime.phase") {
        runtime.loopPhase = (event.payload as { phase: typeof runtime.loopPhase }).phase;
        this.state.activityBySession[sessionId] =
          runtime.loopPhase === "waiting_commits" && runtime.stage === "idle" ? "idle" : "active";
      } else if (event.type === "runtime.stage") {
        runtime.stage = (event.payload as { stage: typeof runtime.stage }).stage;
        this.state.activityBySession[sessionId] =
          runtime.loopPhase === "waiting_commits" && runtime.stage === "idle" ? "idle" : "active";
      } else if (event.type === "runtime.focusedTerminal") {
        const payload = event.payload as { terminalId?: string | null; terminalIds?: string[] };
        runtime.focusedTerminalIds = payload.terminalIds ?? (payload.terminalId ? [payload.terminalId] : []);
        runtime.focusedTerminalId = payload.terminalId ?? runtime.focusedTerminalIds[0] ?? "";
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
      } else if (event.type === "runtime.loopbus.snapshot") {
        const payload = event.payload as {
          snapshot: {
            state: typeof runtime.loopKernelState;
          };
        };
        runtime.loopKernelState = payload.snapshot.state;
      } else if (event.type === "runtime.loopbus.inputSignal") {
        const payload = event.payload as {
          kind: "user" | "terminal" | "task" | "attention";
          version: number;
          timestamp: number;
        };
        runtime.loopInputSignals = {
          ...runtime.loopInputSignals,
          [payload.kind]: {
            version: payload.version,
            timestamp: payload.timestamp,
          },
        };
      } else if (event.type === "runtime.loopbus.stateLog") {
        const payload = event.payload as {
          entry: {
            id: number;
            timestamp: number;
            stateVersion: number;
            event: string;
            prevHash: string | null;
            stateHash: string;
            patch: Array<{ op: "add" | "replace" | "remove"; path: string; value?: unknown }>;
          };
        };
        const current = this.state.loopbusStateLogsBySession[sessionId] ?? [];
        this.state.loopbusStateLogsBySession[sessionId] = this.applyLruEntries(
          this.loopbusLogsAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
      } else if (event.type === "runtime.loopbus.trace") {
        const payload = event.payload as {
          entry: {
            id: number;
            cycleId: number;
            seq: number;
            step: string;
            status: "ok" | "error" | "running";
            startedAt: number;
            endedAt: number;
            detail: Record<string, unknown>;
          };
        };
        const current = this.state.loopbusTracesBySession[sessionId] ?? [];
        this.state.loopbusTracesBySession[sessionId] = this.applyLruEntries(
          this.loopbusTracesAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
      } else if (event.type === "runtime.modelCall") {
        const payload = event.payload as {
          entry: {
            id: number;
            cycleId: number;
            createdAt: number;
            provider: string;
            model: string;
            request: unknown;
            response?: unknown;
            error?: unknown;
          };
        };
        const current = this.state.modelCallsBySession[sessionId] ?? [];
        this.state.modelCallsBySession[sessionId] = this.applyLruEntries(
          this.modelCallsAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
      } else if (event.type === "runtime.apiCall") {
        const payload = event.payload as {
          entry: {
            id: number;
            modelCallId: number;
            createdAt: number;
            request: unknown;
            response?: unknown;
            error?: unknown;
          };
        };
        const current = this.state.apiCallsBySession[sessionId] ?? [];
        if (current.some((entry) => entry.id === payload.entry.id)) {
          return;
        }
        this.state.apiCallsBySession[sessionId] = this.applyLruEntries(
          this.apiCallsAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
      } else if (event.type === "runtime.apiRecording") {
        const payload = event.payload as { enabled: boolean; refCount: number };
        this.state.apiCallRecordingBySession[sessionId] = payload;
      } else if (event.type === "runtime.cycle.updated") {
        const payload = event.payload as { cycle: RuntimeChatCycle | null };
        if (!payload.cycle) {
          runtime.activeCycle = null;
          return;
        }
        const cycle = this.normalizeRuntimeChatCycle(payload.cycle);
        runtime.activeCycle = cycle.status === "done" || cycle.status === "error" ? null : cycle;
        const current = this.state.chatCyclesBySession[sessionId] ?? [];
        this.state.chatCyclesBySession[sessionId] = this.mergeChatCycles(current, [cycle]);
      }
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private ensureRuntimeScaffold(sessionId: string, status?: "stopped" | "starting" | "running" | "error"): void {
    if (!this.state.runtimes[sessionId]) {
      this.state.runtimes[sessionId] = {
        sessionId,
        started: status === "running" || status === "starting",
        activityState: "idle",
        loopPhase: "waiting_commits",
        stage: "idle",
        focusedTerminalId: "",
        focusedTerminalIds: [],
        chatMessages: [],
        terminalSnapshots: {},
        tasks: [],
        terminals: [],
        loopKernelState: null,
        loopInputSignals: {
          user: { version: 0, timestamp: null },
          terminal: { version: 0, timestamp: null },
          task: { version: 0, timestamp: null },
          attention: { version: 0, timestamp: null },
        },
        apiCallRecording: {
          enabled: false,
          refCount: 0,
        },
        modelCapabilities: {
          imageInput: false,
        },
        activeCycle: null,
      };
    }
    this.state.activityBySession[sessionId] = this.state.activityBySession[sessionId] ?? "idle";
    this.state.terminalSnapshotsBySession[sessionId] = this.state.terminalSnapshotsBySession[sessionId] ?? {};
    this.state.chatsBySession[sessionId] = this.state.chatsBySession[sessionId] ?? [];
    this.state.chatCyclesBySession[sessionId] = this.state.chatCyclesBySession[sessionId] ?? [];
    this.state.tasksBySession[sessionId] = this.state.tasksBySession[sessionId] ?? [];
    this.state.loopbusStateLogsBySession[sessionId] = this.state.loopbusStateLogsBySession[sessionId] ?? [];
    this.state.loopbusTracesBySession[sessionId] = this.state.loopbusTracesBySession[sessionId] ?? [];
    this.state.apiCallsBySession[sessionId] = this.state.apiCallsBySession[sessionId] ?? [];
    this.state.modelCallsBySession[sessionId] = this.state.modelCallsBySession[sessionId] ?? [];
    this.state.apiCallRecordingBySession[sessionId] = this.state.apiCallRecordingBySession[sessionId] ?? {
      enabled: false,
      refCount: 0,
    };
  }

  private applyLruEntries<T extends { id: number }>(
    accessBySession: Map<string, Map<number, number>>,
    sessionId: string,
    current: T[],
    incoming: T[],
    limit: number,
  ): T[] {
    const entries = new Map<number, T>();
    for (const item of current) {
      entries.set(item.id, item);
    }
    for (const item of incoming) {
      entries.set(item.id, item);
    }

    const accessMap = accessBySession.get(sessionId) ?? new Map<number, number>();
    if (!accessBySession.has(sessionId)) {
      accessBySession.set(sessionId, accessMap);
    }

    for (const id of entries.keys()) {
      if (!accessMap.has(id)) {
        this.accessTick += 1;
        accessMap.set(id, this.accessTick);
      }
    }

    for (const item of incoming) {
      this.accessTick += 1;
      accessMap.set(item.id, this.accessTick);
    }

    if (entries.size > limit) {
      const ranked = [...entries.keys()]
        .map((id) => ({ id, access: accessMap.get(id) ?? 0 }))
        .sort((a, b) => a.access - b.access);
      const removeCount = entries.size - limit;
      for (const row of ranked.slice(0, removeCount)) {
        entries.delete(row.id);
        accessMap.delete(row.id);
      }
    }

    return [...entries.values()].sort((a, b) => a.id - b.id);
  }

  private releaseApiCallStream(sessionId: string): void {
    const stream = this.apiCallStreams.get(sessionId);
    if (!stream) {
      return;
    }
    stream.count -= 1;
    if (stream.count > 0) {
      return;
    }
    stream.sub?.unsubscribe();
    this.apiCallStreams.delete(sessionId);
  }

  private async hydrateRuntime(sessionId: string): Promise<void> {
    const snapshot = await this.client.trpc.runtime.snapshot.query();
    const runtime = snapshot.runtimes[sessionId];
    if (!runtime) {
      return;
    }
    const normalizedRuntime = this.normalizeRuntimeEntry(runtime);
    this.state.runtimes[sessionId] = normalizedRuntime;
    this.state.activityBySession[sessionId] = normalizedRuntime.activityState ?? "idle";
    this.state.terminalSnapshotsBySession[sessionId] = normalizedRuntime.terminalSnapshots ?? {};
    this.state.chatsBySession[sessionId] = normalizedRuntime.chatMessages ?? [];
    this.state.chatCyclesBySession[sessionId] = normalizedRuntime.activeCycle
      ? this.mergeChatCycles(this.state.chatCyclesBySession[sessionId] ?? [], [normalizedRuntime.activeCycle])
      : (this.state.chatCyclesBySession[sessionId] ?? []);
    this.state.tasksBySession[sessionId] = normalizedRuntime.tasks ?? [];
    this.state.loopbusStateLogsBySession[sessionId] = this.state.loopbusStateLogsBySession[sessionId] ?? [];
    this.state.loopbusTracesBySession[sessionId] = this.state.loopbusTracesBySession[sessionId] ?? [];
    this.state.apiCallsBySession[sessionId] = this.state.apiCallsBySession[sessionId] ?? [];
    this.state.modelCallsBySession[sessionId] = this.state.modelCallsBySession[sessionId] ?? [];
    this.state.apiCallRecordingBySession[sessionId] = runtime.apiCallRecording;
    this.state.lastEventId = Math.max(this.state.lastEventId, snapshot.lastEventId);
    this.emit();
    await this.hydrateLoopbusArtifacts(sessionId);
  }

  private async hydrateLoopbusArtifacts(sessionId: string): Promise<void> {
    try {
      const [logs, traces, modelCalls] = await Promise.all([
        this.client.trpc.runtime.loopbusStateLogs.query({ sessionId, afterId: 0, limit: 200 }),
        this.client.trpc.runtime.loopbusTraces.query({ sessionId, afterId: 0, limit: 200 }),
        this.client.trpc.runtime.modelCallsPage.query({ sessionId, afterId: 0, limit: 200 }),
      ]);
      this.state.loopbusStateLogsBySession[sessionId] = this.applyLruEntries(
        this.loopbusLogsAccessBySession,
        sessionId,
        [],
        logs.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.state.loopbusTracesBySession[sessionId] = this.applyLruEntries(
        this.loopbusTracesAccessBySession,
        sessionId,
        [],
        traces.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.state.modelCallsBySession[sessionId] = this.applyLruEntries(
        this.modelCallsAccessBySession,
        sessionId,
        [],
        modelCalls.items,
        LOOPBUS_LRU_LIMIT,
      );
      if (logs.items.length > 0) {
        this.loopbusLogsBeforeCursorBySession.set(sessionId, logs.items[0].id);
      }
      if (traces.items.length > 0) {
        this.loopbusTracesBeforeCursorBySession.set(sessionId, traces.items[0].id);
      }
      if (modelCalls.items.length > 0) {
        this.modelCallsBeforeCursorBySession.set(sessionId, modelCalls.items[0].id);
      }
      this.emit();
    } catch {
      // Keep local buffers unchanged on hydration failures.
    }
  }

  private upsertSession(session: SessionEntry): void {
    const next = this.state.sessions.filter((item) => item.id !== session.id);
    next.push(session);
    this.state.sessions = sortSessions(next);
    this.ensureRuntimeScaffold(session.id, session.status);
    this.emit();
  }
}

export const createRuntimeStore = (client: AgenterClient): RuntimeStore => new RuntimeStore(client);
