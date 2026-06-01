import type {
  CachedResourceState,
  GlobalAvatarCatalogEntry,
  HeartbeatGroupItem,
  ModelCallItem,
  RuntimeAttentionDeliveryState,
  RuntimeAttentionState,
  RuntimeConnectionStatus,
  RuntimeSnapshotEntry,
  ScopedSettingsOutput,
  SessionEntry,
} from "@agenter/web-heartbeat-view";

export interface AgenterClientOptions {
  wsUrl: string;
  initialAuthToken?: string | null;
}

export interface AgenterClient {
  wsUrl: string;
  httpUrl: string;
  close(): void;
}

export interface RuntimeClientState {
  connected: boolean;
  connectionStatus: RuntimeConnectionStatus;
  sessions: SessionEntry[];
  runtimes: Record<string, RuntimeSnapshotEntry | undefined>;
  globalAvatarCatalog: CachedResourceState<GlobalAvatarCatalogEntry[]>;
  heartbeatGroupsBySession: Record<string, CachedResourceState<HeartbeatGroupItem[]> | undefined>;
  modelCallsBySession: Record<string, ModelCallItem[] | undefined>;
  attentionBySession?: Record<string, RuntimeAttentionState | undefined>;
  attentionDeliveryBySession?: Record<string, RuntimeAttentionDeliveryState | undefined>;
}

export interface RuntimeStore {
  subscribe(listener: (state: RuntimeClientState) => void): () => void;
  setAuthToken(token: string | null | undefined): void;
  autoLogin(): Promise<
    | {
        ok: true;
        session: {
          token: string;
        };
        source: "local_env" | "managed_local";
      }
    | {
        ok: false;
        reason: "unavailable" | "failed";
        message: string;
      }
  >;
  connect(): Promise<void>;
  disconnect(): void;
  hydrateGlobalAvatarCatalog(input?: { force?: boolean }): Promise<void>;
  createSession(input: {
    cwd: string;
    avatar: string;
    autoStart?: boolean;
  }): Promise<SessionEntry>;
  hydrateSessionArtifacts(
    sessionId: string,
    options: {
      includeChatHistory: boolean;
      observabilityMode: "heartbeat";
    },
  ): Promise<void>;
  loadHeartbeatGroups(sessionId: string): Promise<void>;
  loadMoreHeartbeatGroups(sessionId: string): Promise<{ items: number; hasMore: boolean }>;
  requestRuntimeCompact(sessionId: string): Promise<{ ok: boolean }>;
  listRuntimeSettingsScope(sessionId: string): Promise<ScopedSettingsOutput>;
  readRuntimeSettingsLayer(
    sessionId: string,
    layerId: string,
  ): Promise<{
    layer: {
      layerId: string;
      sourceId: string;
    };
    path: string;
    content: string;
    mtimeMs: number;
  }>;
  saveRuntimeSettingsLayer(input: {
    sessionId: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | {
        ok: true;
        file: {
          layer: {
            layerId: string;
            sourceId: string;
          };
          path: string;
          content: string;
          mtimeMs: number;
        };
      }
    | {
        ok: false;
        reason: "conflict";
        latest: {
          layer: {
            layerId: string;
            sourceId: string;
          };
          path: string;
          content: string;
          mtimeMs: number;
        };
      }
    | { ok: false; reason: "readonly"; message: string }
  >;
  getState(): RuntimeClientState;
}

export function createAgenterClient(options: AgenterClientOptions): AgenterClient;
export function createRuntimeStore(client: AgenterClient): RuntimeStore;
