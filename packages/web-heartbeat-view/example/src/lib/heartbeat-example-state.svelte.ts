import {
  createCachedResourceState,
  type AgenterHeartbeatConnectionState,
  type AvatarRuntimeStatus,
  type GlobalAvatarCatalogEntry,
  type HeartbeatCapabilityMode,
  type HeartbeatConfigDraft,
  type HeartbeatRecordPageAnchor,
  type HeartbeatTargetIdentity,
} from "@agenter/web-heartbeat-view";

import { createClientSdkAgenterHeartbeatConnection, type ClientSdkAgenterHeartbeatConnection } from "./agenter-heartbeat-connection";
import { defaultWsUrl, normalizeMode, normalizeRecordPageSize, normalizeSilentConnect } from "./defaults";
import { heartbeatPerfLog } from "./heartbeat-performance-log";

export type HeartbeatConnectionPhase = "idle" | "editing" | "connecting" | "success" | "failed";

type ConnectionAttemptSource = "visible" | "silent";

type HeartbeatExampleRouter = {
  navigate: (url: string) => void;
};

type HeartbeatExampleStateInit = {
  initialMode?: string | null;
  initialRuntimeId?: string | null;
  initialRecordId?: string | number | null;
  initialRecordPageSize?: number | string | null;
  initialSilentConnect?: boolean | string | null;
  initialWsUrl?: string | null;
};

const connectionSuccessCloseDelayMs = 720;

const createInitialConnectionState = (): AgenterHeartbeatConnectionState => ({
  connectionStatus: "connecting",
  connected: false,
  avatars: createCachedResourceState<GlobalAvatarCatalogEntry[]>([]),
  avatarStatuses: {},
  selectedTarget: null,
  selectedHeartbeat: null,
  error: null,
});

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export class HeartbeatExampleState {
  wsUrl = $state(defaultWsUrl);
  authToken = $state("");
  mode = $state<HeartbeatCapabilityMode>("readonly");
  initialRuntimeId = $state<string | null>(null);
  initialRecordId = $state<string | number | null>(null);
  recordPageSize = $state(20);
  silentConnect = $state(false);
  connection = $state<ClientSdkAgenterHeartbeatConnection | null>(null);
  connectionState = $state<AgenterHeartbeatConnectionState>(createInitialConnectionState());
  selectedTarget = $state<HeartbeatTargetIdentity | null>(null);
  connecting = $state(false);
  openingRuntimeId = $state<string | null>(null);
  connectionSheetOpen = $state(true);
  connectionPhase = $state<HeartbeatConnectionPhase>("editing");
  error = $state<string | null>(null);
  private unsubscribe: (() => void) | null = null;
  private connectTask: Promise<void> | null = null;
  private connectionCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRuntimeId: string | null = null;
  private router: HeartbeatExampleRouter | null = null;
  private destroyed = false;

  constructor(init: HeartbeatExampleStateInit = {}) {
    this.wsUrl = init.initialWsUrl ?? defaultWsUrl;
    this.mode = normalizeMode(init.initialMode);
    this.initialRuntimeId = init.initialRuntimeId ?? null;
    this.initialRecordId = init.initialRecordId ?? null;
    this.recordPageSize = normalizeRecordPageSize(init.initialRecordPageSize);
    this.pendingRuntimeId = this.initialRuntimeId;
    this.silentConnect = normalizeSilentConnect(init.initialSilentConnect);
    this.startConnectionService();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearConnectionCloseTimer();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.connection?.disconnect();
    this.connection = null;
    this.router = null;
  }

  setRouter(router: HeartbeatExampleRouter | null): void {
    this.router = router;
  }

  async connect(): Promise<void> {
    await this.connectFromSource("visible");
  }

  openConnectionSheet(): void {
    this.clearConnectionCloseTimer();
    this.connectionSheetOpen = true;
    if (this.connectionState.connected && this.connectionPhase !== "connecting") {
      this.connectionPhase = "editing";
    }
  }

  requestConnectionSheetClosed(): void {
    if (!this.connectionState.connected) {
      this.connectionSheetOpen = true;
      return;
    }
    this.clearConnectionCloseTimer();
    this.connectionSheetOpen = false;
    if (this.connectionPhase !== "connecting") {
      this.connectionPhase = "editing";
    }
  }

  async ensureConnected(): Promise<ClientSdkAgenterHeartbeatConnection> {
    if (this.connectTask) {
      await this.connectTask;
    }
    if (!this.connection || !this.connectionState.connected) {
      this.openConnectionSheet();
      throw new Error("Agenter connection is required before opening this Heartbeat target.");
    }
    return this.connection;
  }

  async openAvatar(avatar: GlobalAvatarCatalogEntry): Promise<HeartbeatTargetIdentity> {
    const connection = await this.ensureConnected();
    return await this.openAvatarWithConnection(connection, avatar);
  }

  async openRuntimeId(runtimeId: string): Promise<void> {
    if (!this.connectionState.connected) {
      this.pendingRuntimeId = runtimeId;
      if (this.connectTask) {
        await this.connectTask;
        if (this.pendingRuntimeId !== runtimeId) {
          return;
        }
      } else {
        this.openConnectionSheet();
        return;
      }
    }
    const connection = this.connection;
    if (!connection || !this.connectionState.connected) {
      this.openConnectionSheet();
      return;
    }
    this.pendingRuntimeId = null;
    await this.openRuntimeIdWithConnection(connection, runtimeId);
  }

  private async openAvatarWithConnection(
    connection: ClientSdkAgenterHeartbeatConnection,
    avatar: GlobalAvatarCatalogEntry,
  ): Promise<HeartbeatTargetIdentity> {
    const endOpen = heartbeatPerfLog.start("state.openAvatar", {
      runtimeId: avatar.runtimeId,
      avatar: avatar.nickname,
    });
    this.openingRuntimeId = avatar.runtimeId;
    this.error = null;
    try {
      const target = await connection.openAvatar({ avatar, autoStart: false });
      this.selectedTarget = target;
      endOpen({ sessionId: target.sessionId });
      return target;
    } catch (error) {
      this.error = toErrorMessage(error);
      heartbeatPerfLog.error("state.openAvatar", error, { runtimeId: avatar.runtimeId });
      endOpen({ ok: false });
      throw error;
    } finally {
      this.openingRuntimeId = null;
    }
  }

  private async openRuntimeIdWithConnection(
    connection: ClientSdkAgenterHeartbeatConnection,
    runtimeId: string,
  ): Promise<void> {
    const endOpen = heartbeatPerfLog.start("state.openRuntimeId", { runtimeId });
    if (this.selectedTarget?.runtimeId === runtimeId && this.connectionState.selectedHeartbeat) {
      endOpen({ ok: true, skipped: true, reason: "already-selected" });
      return;
    }
    const avatar = connection.state.avatars.data.find((entry) => entry.runtimeId === runtimeId);
    if (!avatar) {
      this.error = `Heartbeat target ${runtimeId} was not returned by this Agenter target.`;
      endOpen({ ok: false, reason: "avatar-not-found" });
      return;
    }
    await this.openAvatarWithConnection(connection, avatar);
    endOpen({ ok: true });
  }

  async refreshSelectedHeartbeat(): Promise<void> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection) {
      return;
    }
    await connection.refreshHeartbeat(target);
  }

  async loadOlderSelectedHeartbeat(): Promise<{ items: number; hasMore: boolean }> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection) {
      return { items: 0, hasMore: false };
    }
    return await connection.loadOlderHeartbeat(target);
  }

  async loadSelectedHeartbeatRecordPage(anchor: HeartbeatRecordPageAnchor): Promise<void> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection?.loadHeartbeatRecordPage) {
      return;
    }
    await connection.loadHeartbeatRecordPage(target, anchor);
  }

  async loadSelectedHeartbeatRecordDetail(recordId: number): Promise<void> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection?.loadHeartbeatRecordDetail) {
      return;
    }
    await connection.loadHeartbeatRecordDetail(target, recordId);
  }

  async compactSelectedHeartbeat(): Promise<void> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection?.requestCompact) {
      return;
    }
    await connection.requestCompact(target);
  }

  async startSelectedRuntime(): Promise<void> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection?.startRuntime) {
      return;
    }
    await connection.startRuntime(target);
  }

  async stopSelectedRuntime(): Promise<void> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection?.stopRuntime) {
      return;
    }
    await connection.stopRuntime(target);
  }

  async saveSelectedConfig(draft: HeartbeatConfigDraft): Promise<boolean> {
    const target = this.selectedTarget;
    const connection = this.connection;
    if (!target || !connection?.saveConfig) {
      return false;
    }
    return await connection.saveConfig(target, draft);
  }

  buildHeartbeatSearch(): string {
    const query = new URLSearchParams({
      mode: this.mode,
      silentConnect: this.silentConnect ? "true" : "false",
      wsUrl: this.wsUrl,
    });
    if (this.recordPageSize !== 20) {
      query.set("pageSize", String(this.recordPageSize));
    }
    return query.toString();
  }

  buildHeartbeatListHref(runtimeId: string): string {
    const query = new URLSearchParams({
      mode: this.mode,
      silentConnect: this.silentConnect ? "true" : "false",
      wsUrl: this.wsUrl,
    });
    const search = query.toString();
    return `/heartbeat/${encodeURIComponent(runtimeId)}${search ? `?${search}` : ""}`;
  }

  buildHeartbeatHref(runtimeId: string): string {
    const search = this.buildHeartbeatSearch();
    return `/heartbeat/${encodeURIComponent(runtimeId)}${search ? `?${search}` : ""}`;
  }

  buildHeartbeatRecordHref(runtimeId: string, recordId: string | number): string {
    const listHref = this.buildHeartbeatHref(runtimeId);
    const [path, query = ""] = listHref.split("?");
    return `${path}/records/${encodeURIComponent(String(recordId))}${query ? `?${query}` : ""}`;
  }

  openHeartbeatRecordRoute(runtimeId: string, recordId: string | number): boolean {
    if (!this.router) {
      return false;
    }
    this.router.navigate(this.buildHeartbeatRecordHref(runtimeId, recordId));
    return true;
  }

  avatarStatus(avatar: GlobalAvatarCatalogEntry): AvatarRuntimeStatus {
    return (
      this.connectionState.avatarStatuses[avatar.runtimeId] ?? {
        sessionId: null,
        status: "unknown",
        livePushStatus: "unknown",
      }
    );
  }

  avatarStatusLabel(avatar: GlobalAvatarCatalogEntry): string {
    const status = this.avatarStatus(avatar);
    if (status.status === "running") {
      return status.livePushStatus === "active" ? "Running" : "Running · no live push";
    }
    if (status.status === "starting") {
      return "Starting";
    }
    if (status.status === "paused") {
      return "Paused";
    }
    if (status.status === "error") {
      return "Error";
    }
    if (status.status === "stopped") {
      return "Stopped";
    }
    return "Not running";
  }

  loadedEmptyEvidence(): string | null {
    const heartbeat = this.connectionState.selectedHeartbeat;
    if (heartbeat?.recordsState?.loaded && (heartbeat.recordsState.data?.records.length ?? 0) === 0) {
      return "Backend returned 0 Heartbeat records for this session.";
    }
    if (!heartbeat?.groupsState.loaded || heartbeat.groupsState.data.length > 0) {
      return null;
    }
    return "Backend returned 0 grouped Heartbeat rows for this session.";
  }

  private startConnectionService(): void {
    if (!this.silentConnect || !this.hasConnectionConfig()) {
      this.connectionPhase = "editing";
      this.connectionSheetOpen = false;
      queueMicrotask(() => {
        if (!this.destroyed && !this.connectionState.connected) {
          this.connectionSheetOpen = true;
        }
      });
      return;
    }
    // Connection lifecycle is owned by this front-end service so visible sheets only render state.
    this.connectionSheetOpen = false;
    this.connectionPhase = "idle";
    queueMicrotask(() => {
      if (!this.destroyed) {
        void this.connectFromSource("silent");
      }
    });
  }

  private hasConnectionConfig(): boolean {
    return this.wsUrl.trim().length > 0;
  }

  private async connectFromSource(source: ConnectionAttemptSource): Promise<void> {
    if (this.connectTask) {
      heartbeatPerfLog.mark("state.connect:join", { source });
      if (source === "visible") {
        this.connectionSheetOpen = true;
      }
      await this.connectTask;
      return;
    }
    this.connectTask = this.connectInternal(source);
    try {
      await this.connectTask;
    } finally {
      this.connectTask = null;
    }
  }

  private async connectInternal(source: ConnectionAttemptSource): Promise<void> {
    const endConnect = heartbeatPerfLog.start("state.connect", {
      source,
      silentConnect: this.silentConnect,
      hasInitialRuntime: this.initialRuntimeId !== null,
    });
    this.clearConnectionCloseTimer();
    this.connecting = true;
    this.connectionPhase = "connecting";
    this.error = null;
    this.connectionSheetOpen = source === "visible";
    this.unsubscribe?.();
    this.connection?.disconnect();
    const next = createClientSdkAgenterHeartbeatConnection({
      wsUrl: this.wsUrl,
      authToken: this.authToken,
      recordPageSize: this.recordPageSize,
      preserveHeartbeatRecordPageSizeOnRefresh: this.initialRecordId === null,
    });
    this.connection = next;
    this.unsubscribe = next.subscribe((state) => {
      this.connectionState = state;
      this.selectedTarget = state.selectedTarget;
    });
    try {
      await next.connect();
      if (!next.state.connected) {
        this.error = next.state.error ?? "Agenter connection failed.";
        this.connectionPhase = "failed";
        this.connectionSheetOpen = true;
        endConnect({ ok: false, reason: "not-connected" });
        return;
      }
      this.error = null;
      this.connectionPhase = "success";
      await this.resolveRuntimeAfterConnect();
      if (source === "visible") {
        this.scheduleConnectionSheetClose();
      } else {
        this.connectionSheetOpen = false;
      }
      endConnect({
        ok: true,
        avatars: this.connectionState.avatars.data.length,
        selectedRuntime: this.selectedTarget?.runtimeId ?? null,
      });
    } catch (error) {
      this.error = toErrorMessage(error);
      this.connectionPhase = "failed";
      this.connectionSheetOpen = true;
      heartbeatPerfLog.error("state.connect", error, { source });
      endConnect({ ok: false });
    } finally {
      this.connecting = false;
    }
  }

  private async resolveRuntimeAfterConnect(): Promise<void> {
    const runtimeId = this.pendingRuntimeId ?? this.initialRuntimeId;
    const connection = this.connection;
    if (!runtimeId || !connection?.state.connected) {
      return;
    }
    this.pendingRuntimeId = null;
    await this.openRuntimeIdWithConnection(connection, runtimeId);
  }

  private scheduleConnectionSheetClose(): void {
    this.clearConnectionCloseTimer();
    this.connectionCloseTimer = setTimeout(() => {
      if (!this.destroyed && this.connectionState.connected) {
        this.connectionSheetOpen = false;
        this.connectionPhase = "editing";
      }
      this.connectionCloseTimer = null;
    }, connectionSuccessCloseDelayMs);
  }

  private clearConnectionCloseTimer(): void {
    if (!this.connectionCloseTimer) {
      return;
    }
    clearTimeout(this.connectionCloseTimer);
    this.connectionCloseTimer = null;
  }
}
