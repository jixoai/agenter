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
export type HeartbeatLivePushStatus = "active" | "inactive" | "unknown";

export interface SessionEntry {
  id: string;
  status: SessionStatus;
  avatar?: string | null;
  avatarPrincipalId?: string | null;
  cwd?: string | null;
  createdAt?: string;
}

export interface AvatarRuntimeStatus {
  sessionId: string | null;
  status: SessionStatus | "unknown";
  livePushStatus: HeartbeatLivePushStatus;
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

export type HeartbeatRecordKind = "model_call" | "compact" | "config" | (string & {});
export type HeartbeatRecordStatus =
  | "running"
  | "completed"
  | "error"
  | "blocked"
  | "cancelled"
  | (string & {});

export type HeartbeatRecordSourceRef =
  | { kind: "ai_call"; id: number; role: "primary" | "related" | (string & {}) }
  | {
      kind: "message_part";
      messageId: string;
      partId: string;
      role: "input" | "output" | "tool_call" | "tool_result" | "config" | "compact" | (string & {});
    }
  | { kind: "effect"; id: string; role: "compact" | "config" | "other" | (string & {}) };

export interface HeartbeatRecordPartSummary {
  messageId: string;
  partId: string;
  role: HeartbeatPartRole;
  type: string;
  mimeType: string | null;
  aiCallId: number | null;
  startedAt: number;
  completedAt: number | null;
  label: string;
  isComplete: boolean;
  /** Exact or estimated token count for text-like parts, when the record projection can provide it. */
  tokenCount?: number | null;
  /** Byte size for image, file, or other binary payload parts, when known. */
  sizeBytes?: number | null;
  /** Duration in milliseconds for timed media parts, when known. */
  durationMs?: number | null;
}

export interface HeartbeatRecordSummary {
  provider: string | null;
  model: string | null;
  parts: HeartbeatRecordPartSummary[];
  counts: {
    parts: number;
    toolCalls: number;
    toolResults: number;
    errors: number;
  };
  firstFrameMs: number | null;
  thinkingDurationMs: number;
}

export interface HeartbeatRecordItem {
  id: number;
  recordKey: string;
  kind: HeartbeatRecordKind;
  status: HeartbeatRecordStatus;
  primaryAiCallId: number | null;
  aiCallIds: number[];
  sourceRefs: HeartbeatRecordSourceRef[];
  featureFlags: Record<string, boolean>;
  summary: HeartbeatRecordSummary;
  previewText: string | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  isComplete: boolean;
}

export type HeartbeatRecordPageAnchor =
  | { kind: "latest" }
  | { kind: "fixed"; pageIndex: number; latestRecordId?: number | null };

export interface HeartbeatRecordPage {
  records: HeartbeatRecordItem[];
  pageIndex: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  windowTotalRecords: number;
  windowTotalPages: number;
  latestRecordId: number | null;
  anchor: HeartbeatRecordPageAnchor;
  hasOlder: boolean;
  hasNewer: boolean;
  newRecordsAvailable: boolean;
}

export interface HeartbeatRecordDetail {
  record: HeartbeatRecordItem;
  aiCalls: ModelCallItem[];
  messages: HeartbeatPartItem[];
  sourceRefs: HeartbeatRecordSourceRef[];
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
  avatarPrincipalId?: string | null;
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

export type HeartbeatRuntimeActionIntent = "start" | "stop";

export interface HeartbeatRuntimeActions {
  start?: HeartbeatCapabilityAction;
  stop?: HeartbeatCapabilityAction;
  onStartRuntime?: () => void | Promise<void>;
  onStopRuntime?: () => void | Promise<void>;
}

export interface HeartbeatViewState {
  sessionStatus: SessionStatus;
  schedulerState?: RuntimeSchedulerState | null;
  groupsState: CachedResourceState<HeartbeatGroupItem[]>;
  recordsState?: CachedResourceState<HeartbeatRecordPage | null>;
  recordDetailsState?: Record<number, CachedResourceState<HeartbeatRecordDetail | null>>;
  modelCalls?: ModelCallItem[];
  attention?: RuntimeAttentionState | null;
  attentionDelivery?: RuntimeAttentionDeliveryState | null;
  compactPending?: boolean;
  compactDisabled?: boolean;
  configBinding?: HeartbeatConfigBinding | null;
  configLoading?: boolean;
  configSaving?: boolean;
  configError?: string | null;
  livePushStatus?: HeartbeatLivePushStatus;
  runtime?: RuntimeSnapshotEntry | null;
}

export interface HeartbeatTargetIdentity {
  avatar: string;
  avatarPrincipalId?: string | null;
  runtimeId: string;
  sessionId: string;
  cwd?: string | null;
  iconUrl?: string | null;
  displayName?: string | null;
}

export interface HeartbeatViewCallbacks {
  onLoadOlder?: () => Promise<{ items: number; hasMore: boolean }>;
  onLoadRecordPage?: (anchor: HeartbeatRecordPageAnchor) => Promise<void>;
  onLoadRecordDetail?: (recordId: number) => Promise<void>;
  onOpenRecordDetail?: (recordId: number) => void | Promise<void>;
  actions?: HeartbeatConfigActions;
  runtimeActions?: HeartbeatRuntimeActions;
}

export interface AgenterHeartbeatConnectionState {
  connectionStatus: RuntimeConnectionStatus;
  connected: boolean;
  avatars: CachedResourceState<GlobalAvatarCatalogEntry[]>;
  avatarStatuses: Record<string, AvatarRuntimeStatus>;
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
  loadHeartbeatRecordPage?(target: HeartbeatTargetIdentity, anchor: HeartbeatRecordPageAnchor): Promise<void>;
  loadHeartbeatRecordDetail?(target: HeartbeatTargetIdentity, recordId: number): Promise<void>;
  startRuntime?(target: HeartbeatTargetIdentity): Promise<void>;
  stopRuntime?(target: HeartbeatTargetIdentity): Promise<void>;
  requestCompact?(target: HeartbeatTargetIdentity): Promise<void>;
  saveConfig?(target: HeartbeatTargetIdentity, draft: HeartbeatConfigDraft): Promise<boolean>;
}
