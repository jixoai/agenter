import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";
import {
  createCachedResourceState,
  defaultHeartbeatConfigDraft,
  readHeartbeatConfigBinding,
  writeHeartbeatConfigLayer,
  type AgenterHeartbeatConnection,
  type AgenterHeartbeatConnectionState,
  type AvatarRuntimeStatus,
  type HeartbeatConfigBinding,
  type GlobalAvatarCatalogEntry,
  type HeartbeatConfigDraft,
  type HeartbeatConfigLayerFile,
  type HeartbeatRecordPageAnchor,
  type HeartbeatTargetIdentity,
  type HeartbeatViewState,
  type SessionEntry,
} from "@agenter/web-heartbeat-view";

type ConnectionOptions = {
  wsUrl: string;
  authToken?: string | null;
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
    try {
      await this.tryAutoLogin();
      await this.store.connect();
      await this.refreshAvatars();
    } catch (error) {
      this.state = {
        ...this.state,
        error: toErrorMessage(error),
        connectionStatus: "offline",
        connected: false,
      };
      this.emit();
    }
  }

  disconnect(): void {
    this.store.disconnect();
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
  }

  async refreshAvatars(): Promise<void> {
    try {
      await this.store.hydrateGlobalAvatarCatalog({ force: true });
      this.syncFromRuntimeStore();
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
      throw error;
    }
  }

  private async tryAutoLogin(): Promise<void> {
    if (this.options.authToken?.trim()) {
      return;
    }
    try {
      const result = await this.store.autoLogin();
      if (result.ok) {
        this.store.setAuthToken(result.session.token);
      }
    } catch {
      // Auth remains a transport concern; unavailable auto-login should fall through to the explicit connection error path.
    }
  }

  async openAvatar(input: { avatar: GlobalAvatarCatalogEntry; autoStart?: boolean }): Promise<HeartbeatTargetIdentity> {
    // Avatar Heartbeat is a DB target even when no runtime is currently pushing live events.
    const session = await this.store.createSession({
      cwd: input.avatar.globalPath,
      avatar: input.avatar.nickname,
      autoStart: input.autoStart ?? false,
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
    return target;
  }

  async refreshHeartbeat(target: HeartbeatTargetIdentity): Promise<void> {
    // The adapter stays on existing client-sdk session-scoped reads; no Avatar-specific backend endpoint is introduced here.
    await this.store.hydrateSessionArtifacts(target.sessionId, {
      includeChatHistory: false,
      observabilityMode: "heartbeat",
    });
    await Promise.all([
      this.store.loadHeartbeatGroups(target.sessionId),
      this.store.loadHeartbeatRecords(target.sessionId, { anchor: { kind: "latest" } }),
      this.refreshConfigBinding(target),
    ]);
    this.state = {
      ...this.state,
      selectedTarget: target,
      selectedHeartbeat: this.buildHeartbeatState(target),
      error: null,
    };
    this.emit();
  }

  async loadOlderHeartbeat(target: HeartbeatTargetIdentity): Promise<{ items: number; hasMore: boolean }> {
    const result = await this.store.loadMoreHeartbeatGroups(target.sessionId);
    this.syncFromRuntimeStore();
    return result;
  }

  async loadHeartbeatRecordPage(target: HeartbeatTargetIdentity, anchor: HeartbeatRecordPageAnchor): Promise<void> {
    await this.store.loadHeartbeatRecords(target.sessionId, { anchor });
    this.syncFromRuntimeStore();
  }

  async loadHeartbeatRecordDetail(target: HeartbeatTargetIdentity, recordId: number): Promise<void> {
    await this.store.loadHeartbeatRecordDetail(target.sessionId, recordId);
    this.syncFromRuntimeStore();
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
      recordsState: runtimeState.heartbeatRecordsBySession[target.sessionId],
      recordDetailsState: runtimeState.heartbeatRecordDetailsBySession[target.sessionId],
      modelCalls: runtimeState.modelCallsBySession[target.sessionId] ?? [],
      attention: runtimeState.attentionBySession?.[target.sessionId] ?? runtime?.attention ?? null,
      attentionDelivery: runtimeState.attentionDeliveryBySession?.[target.sessionId] ?? runtime?.attentionDelivery ?? null,
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

  private findAvatarSession(avatar: GlobalAvatarCatalogEntry, sessions: ReadonlyArray<SessionEntry>): SessionEntry | null {
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
        livePushStatus: session && runtime && session.status === "running" ? "active" : session ? "inactive" : "unknown",
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
