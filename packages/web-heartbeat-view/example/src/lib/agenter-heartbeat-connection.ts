import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";
import {
  createCachedResourceState,
  defaultHeartbeatConfigDraft,
  readHeartbeatConfigBinding,
  writeHeartbeatConfigLayer,
  type AgenterHeartbeatConnection,
  type AgenterHeartbeatConnectionState,
  type AvatarRuntimeStatus,
  type GlobalAvatarCatalogEntry,
  type HeartbeatConfigBinding,
  type HeartbeatConfigDraft,
  type HeartbeatConfigLayerFile,
  type HeartbeatRecordPage,
  type HeartbeatRecordPageAnchor,
  type HeartbeatTargetIdentity,
  type HeartbeatViewState,
  type SessionEntry,
} from "@agenter/web-heartbeat-view";

import { heartbeatPerfLog } from "./heartbeat-performance-log";

type ConnectionOptions = {
  wsUrl: string;
  authToken?: string | null;
  recordPageSize?: number;
  recordPageCount?: number;
  preserveHeartbeatRecordPageSizeOnRefresh?: boolean;
};

type HeartbeatConfigLayerSnapshot = HeartbeatConfigLayerFile & {
  mtimeMs: number;
};

type RuntimeStoreBase = ReturnType<typeof createRuntimeStore>;

type RuntimeLifecycleStore = RuntimeStoreBase & {
  startSession(sessionId: string): Promise<void>;
  stopSession(sessionId: string): Promise<void>;
};

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const normalizeWsUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.endsWith("/trpc")) {
    return trimmed;
  }
  return `${trimmed.replace(/\/+$/u, "")}/trpc`;
};

const createInitialState = (): AgenterHeartbeatConnectionState => ({
  connectionStatus: "connecting",
  connected: false,
  avatars: createCachedResourceState<GlobalAvatarCatalogEntry[]>([]),
  avatarStatuses: {},
  selectedTarget: null,
  selectedHeartbeat: null,
  error: null,
});

const hasRuntimeLifecycle = (store: RuntimeStoreBase): store is RuntimeLifecycleStore => {
  const candidate = store as {
    startSession?: unknown;
    stopSession?: unknown;
  };
  return typeof candidate.startSession === "function" && typeof candidate.stopSession === "function";
};

export class ClientSdkAgenterHeartbeatConnection implements AgenterHeartbeatConnection {
  private readonly listeners = new Set<(state: AgenterHeartbeatConnectionState) => void>();
  private readonly store: RuntimeLifecycleStore;
  private readonly configBindingsBySession = new Map<string, HeartbeatConfigBinding>();
  private readonly configLayerBySession = new Map<string, HeartbeatConfigLayerSnapshot>();
  private readonly configErrorsBySession = new Map<string, string>();
  private readonly configLoadingBySession = new Set<string>();
  private readonly configSavingBySession = new Set<string>();
  private readonly heartbeatSecondaryRefreshTasks = new Map<string, Promise<void>>();
  private unsubscribeStore: (() => void) | null = null;
  state: AgenterHeartbeatConnectionState = createInitialState();

  constructor(private readonly options: ConnectionOptions) {
    const client = createAgenterClient({
      wsUrl: normalizeWsUrl(options.wsUrl),
      initialAuthToken: options.authToken,
    });
    const store = createRuntimeStore(client);
    if (!hasRuntimeLifecycle(store)) {
      throw new Error("The connected Agenter client-sdk does not expose runtime lifecycle controls.");
    }
    this.store = store;
    this.unsubscribeStore = this.store.subscribe(() => {
      this.syncFromRuntimeStore();
    });
  }

  subscribe(listener: (state: AgenterHeartbeatConnectionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    const endConnect = heartbeatPerfLog.start("connection.connect", { wsUrl: normalizeWsUrl(this.options.wsUrl) });
    try {
      await this.tryAutoLogin();
      await this.store.connect();
      await this.refreshAvatars();
      endConnect({
        connected: this.state.connected,
        avatars: this.state.avatars.data.length,
      });
    } catch (error) {
      this.state = {
        ...this.state,
        error: toErrorMessage(error),
        connectionStatus: "offline",
        connected: false,
      };
      this.emit();
      heartbeatPerfLog.error("connection.connect", error);
      endConnect({ connected: false });
    }
  }

  disconnect(): void {
    this.store.disconnect();
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.heartbeatSecondaryRefreshTasks.clear();
  }

  async refreshAvatars(): Promise<void> {
    const endRefresh = heartbeatPerfLog.start("avatars.refresh");
    try {
      await this.store.hydrateGlobalAvatarCatalog({ force: true });
      this.syncFromRuntimeStore();
      endRefresh({
        avatars: this.state.avatars.data.length,
        statuses: Object.keys(this.state.avatarStatuses).length,
      });
    } catch (error) {
      this.state = {
        ...this.state,
        avatars: {
          ...this.state.avatars,
          loading: false,
          refreshing: false,
          error: toErrorMessage(error),
        },
        error: toErrorMessage(error),
      };
      this.emit();
      heartbeatPerfLog.error("avatars.refresh", error);
      endRefresh({ avatars: this.state.avatars.data.length });
      throw error;
    }
  }

  private async tryAutoLogin(): Promise<void> {
    if (this.options.authToken?.trim()) {
      heartbeatPerfLog.mark("auth.autoLogin:skip", { reason: "explicit-token" });
      return;
    }
    const endAutoLogin = heartbeatPerfLog.start("auth.autoLogin");
    try {
      const result = await this.store.autoLogin();
      if (result.ok) {
        this.store.setAuthToken(result.session.token);
      }
      endAutoLogin({ ok: result.ok });
    } catch {
      // Auth remains a transport concern; unavailable auto-login should fall through to the explicit connection error path.
      endAutoLogin({ ok: false });
    }
  }

  async openAvatar(input: { avatar: GlobalAvatarCatalogEntry; autoStart?: boolean }): Promise<HeartbeatTargetIdentity> {
    // Avatar Heartbeat is a DB target even when no runtime is currently pushing live events.
    const openFields = {
      runtimeId: input.avatar.runtimeId,
      avatar: input.avatar.nickname,
      autoStart: input.autoStart ?? false,
    };
    const endOpenAvatar = heartbeatPerfLog.start("avatar.open", openFields);
    const existingSession = this.findAvatarSession(input.avatar, this.store.getState().sessions);
    const session = existingSession ?? (await this.createAvatarSession(input.avatar, input.autoStart ?? false));
    heartbeatPerfLog.mark("avatar.open.sessionTarget", {
      ...openFields,
      sessionId: session.id,
      source: existingSession ? "existing" : "created",
    });
    const avatarPrincipalId = input.avatar.avatarPrincipalId ?? null;
    const target: HeartbeatTargetIdentity = {
      avatar: input.avatar.nickname,
      avatarPrincipalId,
      displayName: input.avatar.displayName,
      runtimeId: input.avatar.runtimeId,
      sessionId: session.id,
      cwd: input.avatar.globalPath,
      iconUrl: input.avatar.iconUrl ?? null,
    };
    this.state = {
      ...this.state,
      selectedTarget: target,
      selectedHeartbeat: this.buildHeartbeatState(target),
      error: null,
    };
    this.emit();
    await this.refreshHeartbeat(target);
    endOpenAvatar({ sessionId: session.id });
    return target;
  }

  private async createAvatarSession(
    avatar: GlobalAvatarCatalogEntry,
    autoStart: boolean,
  ): Promise<SessionEntry> {
    const fields = {
      runtimeId: avatar.runtimeId,
      avatar: avatar.nickname,
      autoStart,
    };
    const endCreateSession = heartbeatPerfLog.start("avatar.open.createSession", fields);
    const session = await this.store.createSession({
      cwd: avatar.globalPath,
      avatar: avatar.nickname,
      autoStart,
      hydrationMode: "none",
      refreshWorkspaces: false,
    });
    endCreateSession({ sessionId: session.id });
    return session;
  }

  async refreshHeartbeat(target: HeartbeatTargetIdentity): Promise<void> {
    // The adapter stays on existing client-sdk session-scoped reads; no Avatar-specific backend endpoint is introduced here.
    const endRefresh = heartbeatPerfLog.start("heartbeat.records.refresh", {
      runtimeId: target.runtimeId,
      sessionId: target.sessionId,
    });
    const currentRecordsState = this.store.getState().heartbeatRecordsBySession[target.sessionId];
    const pageSize =
      this.options.preserveHeartbeatRecordPageSizeOnRefresh && currentRecordsState?.data?.pageSize
        ? currentRecordsState.data.pageSize
        : this.options.recordPageSize;
    const pageCount =
      this.options.preserveHeartbeatRecordPageSizeOnRefresh && currentRecordsState?.data?.pageCount
        ? currentRecordsState.data.pageCount
        : this.options.recordPageCount;
    const anchor =
      this.options.preserveHeartbeatRecordPageSizeOnRefresh && currentRecordsState?.data?.anchor
        ? currentRecordsState.data.anchor
        : { kind: "latest" as const };
    await this.store.loadHeartbeatRecords(target.sessionId, { pageSize, pageCount, anchor });
    this.syncFromRuntimeStore();
    const recordsState = this.store.getState().heartbeatRecordsBySession[target.sessionId];
    endRefresh({
      pageSize: recordsState?.data?.pageSize ?? pageSize ?? null,
      records: recordsState?.data?.records.length ?? null,
      totalRecords: recordsState?.data?.totalRecords ?? null,
      anchor: anchor.kind,
    });
    this.queueHeartbeatSecondaryRefresh(target);
  }

  private queueHeartbeatSecondaryRefresh(target: HeartbeatTargetIdentity): void {
    if (this.heartbeatSecondaryRefreshTasks.has(target.sessionId)) {
      heartbeatPerfLog.mark("heartbeat.secondaryRefresh:skip", {
        runtimeId: target.runtimeId,
        sessionId: target.sessionId,
        reason: "in-flight",
      });
      return;
    }
    const task = this.refreshHeartbeatSecondary(target).finally(() => {
      this.heartbeatSecondaryRefreshTasks.delete(target.sessionId);
    });
    this.heartbeatSecondaryRefreshTasks.set(target.sessionId, task);
    void task;
  }

  private async refreshHeartbeatSecondary(target: HeartbeatTargetIdentity): Promise<void> {
    const endRefresh = heartbeatPerfLog.start("heartbeat.secondaryRefresh", {
      runtimeId: target.runtimeId,
      sessionId: target.sessionId,
    });
    const results = await Promise.allSettled([
      this.store.hydrateSessionArtifacts(target.sessionId, {
        includeChatHistory: false,
        observabilityMode: "heartbeat",
        observability: {
          includeHeartbeatGroups: false,
          includeHeartbeatRecords: false,
          includeModelCalls: true,
        },
      }),
      this.store.loadHeartbeatGroups(target.sessionId),
      this.refreshConfigBinding(target),
    ]);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejected && this.state.selectedTarget?.sessionId === target.sessionId) {
      heartbeatPerfLog.error("heartbeat.secondaryRefresh", rejected.reason, {
        runtimeId: target.runtimeId,
        sessionId: target.sessionId,
      });
      this.state = {
        ...this.state,
        error: toErrorMessage(rejected.reason),
      };
      this.emit();
      endRefresh({ ok: false });
      return;
    }
    if (this.state.selectedTarget?.sessionId !== target.sessionId) {
      endRefresh({ ok: true, stale: true });
      return;
    }
    this.state = {
      ...this.state,
      selectedTarget: target,
      selectedHeartbeat: this.buildHeartbeatState(target),
      error: null,
    };
    this.emit();
    const runtimeState = this.store.getState();
    endRefresh({
      ok: true,
      groups: runtimeState.heartbeatGroupsBySession[target.sessionId]?.data.length ?? null,
      modelCalls: runtimeState.modelCallsBySession[target.sessionId]?.length ?? null,
      configLoaded: this.configBindingsBySession.has(target.sessionId),
    });
  }

  async loadOlderHeartbeat(target: HeartbeatTargetIdentity): Promise<{ items: number; hasMore: boolean }> {
    const result = await this.store.loadMoreHeartbeatGroups(target.sessionId);
    this.syncFromRuntimeStore();
    return result;
  }

  async loadHeartbeatRecordPage(target: HeartbeatTargetIdentity, anchor: HeartbeatRecordPageAnchor): Promise<void> {
    const endLoad = heartbeatPerfLog.start("heartbeat.records.page", {
      runtimeId: target.runtimeId,
      sessionId: target.sessionId,
      anchor: anchor.kind,
    });
    await this.store.loadHeartbeatRecords(target.sessionId, {
      pageSize: this.options.recordPageSize,
      pageCount: this.options.recordPageCount,
      anchor,
    });
    this.syncFromRuntimeStore();
    const recordsState = this.store.getState().heartbeatRecordsBySession[target.sessionId];
    endLoad({
      pageSize: recordsState?.data?.pageSize ?? this.options.recordPageSize ?? null,
      records: recordsState?.data?.records.length ?? null,
      totalRecords: recordsState?.data?.totalRecords ?? null,
    });
  }

  async loadHeartbeatRecordDetail(target: HeartbeatTargetIdentity, recordId: number): Promise<void> {
    const endLoad = heartbeatPerfLog.start("heartbeat.recordDetail", {
      runtimeId: target.runtimeId,
      sessionId: target.sessionId,
      recordId,
    });
    await this.store.loadHeartbeatRecordDetail(target.sessionId, recordId);
    this.syncFromRuntimeStore();
    const detailState = this.store.getState().heartbeatRecordDetailsBySession[target.sessionId]?.[recordId];
    endLoad({
      loaded: detailState?.loaded ?? false,
      aiCalls: detailState?.data?.aiCalls.length ?? null,
      messages: detailState?.data?.messages.length ?? null,
      sourceRefs: detailState?.data?.sourceRefs.length ?? null,
    });
  }

  async startRuntime(target: HeartbeatTargetIdentity): Promise<void> {
    await this.store.startSession(target.sessionId);
    await this.refreshHeartbeat(target);
  }

  async stopRuntime(target: HeartbeatTargetIdentity): Promise<void> {
    await this.store.stopSession(target.sessionId);
    await this.refreshHeartbeat(target);
  }

  async requestCompact(target: HeartbeatTargetIdentity): Promise<void> {
    await this.store.requestRuntimeCompact(target.sessionId);
    this.syncFromRuntimeStore();
  }

  async saveConfig(target: HeartbeatTargetIdentity, draft: HeartbeatConfigDraft): Promise<boolean> {
    const layerFile = this.configLayerBySession.get(target.sessionId);
    const layerId = layerFile?.layer?.layerId;
    if (!layerFile || !layerId) {
      this.configErrorsBySession.set(target.sessionId, "No editable config layer is available for this target");
      this.syncFromRuntimeStore();
      return false;
    }
    this.configSavingBySession.add(target.sessionId);
    this.configErrorsBySession.delete(target.sessionId);
    this.syncFromRuntimeStore();
    try {
      const content = writeHeartbeatConfigLayer({
        path: layerFile.path,
        content: layerFile.content,
        draft,
      });
      const result = await this.store.saveRuntimeSettingsLayer({
        sessionId: target.sessionId,
        layerId,
        content,
        baseMtimeMs: layerFile.mtimeMs,
      });
      if (!result.ok) {
        const message =
          result.reason === "conflict" ? "Config changed on disk. Refresh before saving again." : result.message;
        this.configErrorsBySession.set(target.sessionId, message);
        if (result.reason === "conflict") {
          this.configLayerBySession.set(target.sessionId, {
            path: result.latest.path,
            content: result.latest.content,
            mtimeMs: result.latest.mtimeMs,
            layer: result.latest.layer,
          });
        }
        return false;
      }
      const nextLayerFile: HeartbeatConfigLayerSnapshot = {
        path: result.file.path,
        content: result.file.content,
        mtimeMs: result.file.mtimeMs,
        layer: result.file.layer,
      };
      this.configLayerBySession.set(target.sessionId, nextLayerFile);
      await this.refreshConfigBinding(target);
      return true;
    } catch (error) {
      this.configErrorsBySession.set(target.sessionId, toErrorMessage(error));
      return false;
    } finally {
      this.configSavingBySession.delete(target.sessionId);
      this.syncFromRuntimeStore();
    }
  }

  private buildHeartbeatState(target: HeartbeatTargetIdentity): HeartbeatViewState {
    const runtimeState = this.store.getState();
    const session = runtimeState.sessions.find((entry) => entry.id === target.sessionId);
    const runtime = runtimeState.runtimes[target.sessionId] ?? null;
    return {
      sessionStatus: session?.status ?? "stopped",
      schedulerState: runtime?.schedulerState ?? null,
      groupsState: runtimeState.heartbeatGroupsBySession[target.sessionId] ?? createCachedResourceState([]),
      recordsState:
        runtimeState.heartbeatRecordsBySession[target.sessionId] ??
        createCachedResourceState<HeartbeatRecordPage | null>(null),
      recordDetailsState: runtimeState.heartbeatRecordDetailsBySession[target.sessionId],
      modelCalls: runtimeState.modelCallsBySession[target.sessionId] ?? [],
      attention: runtimeState.attentionBySession?.[target.sessionId] ?? runtime?.attention ?? null,
      attentionDelivery:
        runtimeState.attentionDeliveryBySession?.[target.sessionId] ?? runtime?.attentionDelivery ?? null,
      compactPending: false,
      compactDisabled: false,
      configBinding: this.configBindingsBySession.get(target.sessionId) ?? {
        editableLayerId: null,
        editableLayerSource: null,
        activeProviderId: null,
        providerLabel: null,
        providerMetadata: null,
        draft: defaultHeartbeatConfigDraft(),
      },
      configLoading: this.configLoadingBySession.has(target.sessionId),
      configSaving: this.configSavingBySession.has(target.sessionId),
      configError: this.configErrorsBySession.get(target.sessionId) ?? null,
      livePushStatus: runtime && session?.status === "running" ? "active" : "inactive",
      runtime,
    };
  }

  private findAvatarSession(
    avatar: GlobalAvatarCatalogEntry,
    sessions: ReadonlyArray<SessionEntry>,
  ): SessionEntry | null {
    const matches = sessions.filter((session) => {
      if (avatar.avatarPrincipalId && session.avatarPrincipalId === avatar.avatarPrincipalId) {
        return true;
      }
      if (session.id === avatar.runtimeId) {
        return true;
      }
      if (session.avatar === avatar.nickname && session.cwd === avatar.globalPath) {
        return true;
      }
      return false;
    });
    return matches.find((session) => session.status === "running") ?? matches[matches.length - 1] ?? null;
  }

  private buildAvatarStatuses(): Record<string, AvatarRuntimeStatus> {
    const runtimeState = this.store.getState();
    const statuses: Record<string, AvatarRuntimeStatus> = {};
    for (const avatar of runtimeState.globalAvatarCatalog.data) {
      const session = this.findAvatarSession(avatar, runtimeState.sessions);
      const runtime = session ? (runtimeState.runtimes[session.id] ?? null) : null;
      statuses[avatar.runtimeId] = {
        sessionId: session?.id ?? null,
        status: session?.status ?? "unknown",
        livePushStatus:
          session && runtime && session.status === "running" ? "active" : session ? "inactive" : "unknown",
      };
    }
    return statuses;
  }

  private async refreshConfigBinding(target: HeartbeatTargetIdentity): Promise<void> {
    this.configLoadingBySession.add(target.sessionId);
    this.configErrorsBySession.delete(target.sessionId);
    this.syncFromRuntimeStore();
    try {
      const graph = await this.store.listRuntimeSettingsScope(target.sessionId);
      const provisionalBinding = readHeartbeatConfigBinding(graph, null);
      const editableLayerId = provisionalBinding.editableLayerId;
      if (!editableLayerId) {
        this.configBindingsBySession.set(target.sessionId, provisionalBinding);
        this.configLayerBySession.delete(target.sessionId);
        return;
      }
      const file = await this.store.readRuntimeSettingsLayer(target.sessionId, editableLayerId);
      const layerFile: HeartbeatConfigLayerSnapshot = {
        path: file.path,
        content: file.content,
        mtimeMs: file.mtimeMs,
        layer: file.layer,
      };
      this.configLayerBySession.set(target.sessionId, layerFile);
      this.configBindingsBySession.set(target.sessionId, readHeartbeatConfigBinding(graph, layerFile));
    } catch (error) {
      this.configBindingsBySession.set(target.sessionId, {
        editableLayerId: null,
        editableLayerSource: null,
        activeProviderId: null,
        providerLabel: null,
        providerMetadata: null,
        draft: defaultHeartbeatConfigDraft(),
      });
      this.configErrorsBySession.set(target.sessionId, toErrorMessage(error));
    } finally {
      this.configLoadingBySession.delete(target.sessionId);
      this.syncFromRuntimeStore();
    }
  }

  private syncFromRuntimeStore(): void {
    const runtimeState = this.store.getState();
    const selectedTarget = this.state.selectedTarget;
    this.state = {
      ...this.state,
      connectionStatus: runtimeState.connectionStatus,
      connected: runtimeState.connected,
      avatars: runtimeState.globalAvatarCatalog,
      avatarStatuses: this.buildAvatarStatuses(),
      selectedHeartbeat: selectedTarget ? this.buildHeartbeatState(selectedTarget) : this.state.selectedHeartbeat,
      error: null,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const createClientSdkAgenterHeartbeatConnection = (
  options: ConnectionOptions,
): ClientSdkAgenterHeartbeatConnection => new ClientSdkAgenterHeartbeatConnection(options);
