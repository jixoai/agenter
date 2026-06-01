export type HeartbeatCapabilityMode = "readonly" | "configable";

export type HeartbeatToolUiState = "input-streaming" | "input-available" | "output-available" | "output-error";

export interface CachedResourceState<T> {
  data: T;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshedAt: number | null;
}

export type RuntimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

export type SessionStatus = "starting" | "running" | "paused" | "error" | "stopped" | (string & {});

export interface SessionEntry {
  id: string;
  status: SessionStatus;
  createdAt?: string;
}

export type HeartbeatGroupKind = "before-call" | "call" | "compact" | "before-call-pending" | (string & {});
export type HeartbeatPartScope = "heartbeat_part" | "request_aux" | (string & {});
export type HeartbeatPartRole = "system" | "user" | "assistant" | "tool" | "config" | (string & {});

export interface HeartbeatPart {
  partId: number;
  partIndex: number;
  messageId: string;
  windowId: string | null;
  aiCallId: number | null;
  roundIndex: number;
  scope: HeartbeatPartScope;
  role: HeartbeatPartRole;
  partType: string;
  mimeType: string | null;
  payload: unknown;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
}

export interface HeartbeatPartItem {
  id: number;
  messageId: string;
  windowId: string | null;
  aiCallId: number | null;
  roundIndex: number;
  scope: HeartbeatPartScope;
  role: HeartbeatPartRole;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
  parts: HeartbeatPart[];
  text: string;
}

export interface HeartbeatGroupItem {
  id: number;
  groupId: string;
  kind: HeartbeatGroupKind;
  aiCallId: number | null;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
  items: HeartbeatPartItem[];
}

export interface ModelCallItem {
  id: number;
  kind: string;
  status: string;
  provider: string | null;
  model: string | null;
  roundIndex: number;
  createdAt: number;
  updatedAt: number;
  isComplete: boolean;
  providerSnapshot: unknown;
  request: unknown;
  response: unknown;
}

export interface RuntimeAttentionState {
  snapshot: {
    contexts: Array<{
      focusState?: string | null;
    }>;
  };
}

export type RuntimeAttentionDeliveryState = unknown;

export interface RuntimeSchedulerState {
  runtimeStatus: "running" | "waiting" | "backoff" | "blocked" | "paused" | "idle" | (string & {});
  waitingReason?: string | null;
  nextAutoWakeAt?: number | null;
  backoffMs?: number | null;
  retryCount?: number | null;
  blockedReason?: string | null;
  lastProgressAt?: number | null;
  lastError?: string | null;
}

export interface RuntimeSnapshotEntry {
  schedulerState?: RuntimeSchedulerState | null;
  attention?: RuntimeAttentionState | null;
  attentionDelivery?: RuntimeAttentionDeliveryState | null;
}

export interface GlobalAvatarCatalogEntry {
  runtimeId: string;
  nickname: string;
  globalPath: string;
  displayName?: string | null;
  iconUrl?: string | null;
  defaultAvatar?: boolean;
}

export interface ScopedSettingsLayerEntry {
  editable: boolean;
  sourceId: string;
  kind: string;
  layerId: string;
}

export interface ScopedSettingsOutput {
  effective: {
    value: unknown;
  };
  layers: ScopedSettingsLayerEntry[];
}

export interface HeartbeatConfigDraft {
  temperature: number | null;
  topK: number | null;
  maxToken: number | null;
  thinkingEnabled: boolean;
  thinkingBudgetTokens: number | null;
}

export interface HeartbeatProviderPricingBand {
  upToTokens: number | null;
  inputPerMillion: number;
  cachedInputPerMillion: number | null;
  outputPerMillion: number;
}

export interface HeartbeatProviderMetadata {
  providerId: string;
  model: string | null;
  maxContextTokens: number | null;
  pricingCurrency: string | null;
  pricingBands: HeartbeatProviderPricingBand[];
}

export interface HeartbeatConfigBinding {
  editableLayerId: string | null;
  editableLayerSource: string | null;
  activeProviderId: string | null;
  providerLabel: string | null;
  providerMetadata: HeartbeatProviderMetadata | null;
  draft: HeartbeatConfigDraft;
}

export interface HeartbeatConfigLayerFile {
  path?: string | null;
  content: string;
  layer?: {
    layerId: string;
    sourceId: string;
  } | null;
}

export interface HeartbeatCapabilityAction {
  available: boolean;
  reason?: string | null;
}

export interface HeartbeatConfigActions {
  compact?: HeartbeatCapabilityAction;
  config?: HeartbeatCapabilityAction;
  onRequestCompact?: () => void | Promise<void>;
  onRefreshConfig?: () => void | Promise<void>;
  onSaveConfig?: (draft: HeartbeatConfigDraft) => boolean | Promise<boolean>;
}

export interface HeartbeatViewState {
  sessionStatus: SessionStatus;
  schedulerState?: RuntimeSchedulerState | null;
  groupsState: CachedResourceState<HeartbeatGroupItem[]>;
  modelCalls?: ModelCallItem[];
  attention?: RuntimeAttentionState | null;
  attentionDelivery?: RuntimeAttentionDeliveryState | null;
  compactPending?: boolean;
  compactDisabled?: boolean;
  configBinding?: HeartbeatConfigBinding | null;
  configLoading?: boolean;
  configSaving?: boolean;
  configError?: string | null;
  livePushStatus?: "active" | "inactive" | "unknown";
  runtime?: RuntimeSnapshotEntry | null;
}

export interface HeartbeatTargetIdentity {
  avatar: string;
  runtimeId: string;
  sessionId: string;
  cwd?: string | null;
  iconUrl?: string | null;
  displayName?: string | null;
}

export interface HeartbeatViewCallbacks {
  onLoadOlder?: () => Promise<{ items: number; hasMore: boolean }>;
  actions?: HeartbeatConfigActions;
}

export interface AgenterHeartbeatConnectionState {
  connectionStatus: RuntimeConnectionStatus;
  connected: boolean;
  avatars: CachedResourceState<GlobalAvatarCatalogEntry[]>;
  selectedTarget: HeartbeatTargetIdentity | null;
  selectedHeartbeat: HeartbeatViewState | null;
  error: string | null;
}

export interface AgenterHeartbeatConnection {
  readonly state: AgenterHeartbeatConnectionState;
  subscribe(listener: (state: AgenterHeartbeatConnectionState) => void): () => void;
  connect(): Promise<void>;
  disconnect(): void;
  refreshAvatars(): Promise<void>;
  openAvatar(input: { avatar: GlobalAvatarCatalogEntry; autoStart?: boolean }): Promise<HeartbeatTargetIdentity>;
  refreshHeartbeat(target: HeartbeatTargetIdentity): Promise<void>;
  loadOlderHeartbeat(target: HeartbeatTargetIdentity): Promise<{ items: number; hasMore: boolean }>;
  requestCompact?(target: HeartbeatTargetIdentity): Promise<void>;
  saveConfig?(target: HeartbeatTargetIdentity, draft: HeartbeatConfigDraft): Promise<boolean>;
}
