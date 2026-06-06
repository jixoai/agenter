import type { AgenterClient, AgenterTransportEvent } from "./trpc-client";
import type {
  ApiCallItem,
  AttentionQueryItem,
  AuthDraftCreateOutput,
  AuthDraftDeleteOutput,
  AuthDraftEntry,
  AuthDraftEvent,
  AuthDraftKind,
  AuthDraftSaveOutput,
  AuthDraftSnapshotOutput,
  AuthKvDeleteOutput,
  AuthKvEvent,
  AuthKvSetOutput,
  AuthKvSnapshotOutput,
  AuthServiceInfoOutput,
  AuthSessionOutput,
  AvatarCreateDraftState,
  CachedResourceState,
  ChatCycleItem,
  ChatListItem,
  DraftResolutionOutput,
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomAssetEntry,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalRoomGrantIssueOutput,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  GlobalTerminalActorId,
  GlobalTerminalApprovalRequest,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  GlobalTerminalGrantIssueOutput,
  GlobalTerminalPermissionRequestEvent,
  GlobalTerminalPermissionRequestsInput,
  HeartbeatGroupItem,
  HeartbeatPartItem,
  HeartbeatRecordDetailOutput,
  HeartbeatRecordPageAnchorInput,
  HeartbeatRecordsPageOutput,
  HistoryPageCursor,
  JsonValue,
  MessageChannelEntry,
  MessageChannelGrantEntry,
  MessageSendSuccessOutput,
  McpAddInput,
  McpAddOutput,
  McpCallInput,
  McpCallOutput,
  McpDisableInput,
  McpDisableOutput,
  McpEnableInput,
  McpEnableOutput,
  McpListInput,
  McpListOutput,
  McpQueryInput,
  McpQueryOutput,
  McpRemoveInput,
  McpRemoveOutput,
  McpRestartInput,
  McpRestartOutput,
  McpStartInput,
  McpStartOutput,
  McpStopInput,
  McpStopOutput,
  ModelCallItem,
  NoteCatalogOutput,
  NotePageOutput,
  NoteReferenceInput,
  NoteRenameOutput,
  NoteSearchOutput,
  NoteSqlQueryOutput,
  NoteTagsOutput,
  NoteWriteOutput,
  NotificationSnapshotOutput,
  RuntimeAttentionDeliveryState,
  RuntimeAttentionState,
  RuntimeChatCycle,
  RuntimeChatMessage,
  RuntimeClientState,
  RuntimeEvent,
  RuntimeSchedulerContainmentState,
  RuntimeSnapshotEntry,
  RuntimeUsageAnalyticsInput,
  RuntimeUsageAnalyticsOutput,
  RuntimeWorkspaceAssetRootsOutput,
  RuntimeWorkspaceExecOutput,
  RuntimeWorkspaceGrantEntry,
  RuntimeWorkspaceMountEntry,
  SessionEntry,
  SkillAvatarCatalogOutput,
  SkillAvatarPreviewOutput,
  SkillAvatarTreeOutput,
  SkillCatalogOutput,
  SkillPreviewOutput,
  SkillTreeOutput,
  TerminalActivityItem,
  UploadedSessionAsset,
  WorkspaceAvatarCatalogEntry,
  WorkspaceCliCatalogOutput,
  WorkspacePathSearchOutput,
  WorkspacePrivateTextAssetEnsureOutput,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceSessionTab,
  WorkspaceWorkbenchPreviewOutput,
  WorkspaceWorkbenchTreeOutput,
} from "./types";

const createInitialState = (): RuntimeClientState => ({
  connected: false,
  connectionStatus: "connecting",
  profileService: null,
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  terminalReadsBySession: {},
  chatsBySession: {},
  messageChannelsBySession: {},
  chatCyclesBySession: {},
  attentionBySession: {},
  attentionDeliveryBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  globalAvatarCatalog: createCachedResourceState<GlobalAvatarCatalogEntry[]>([]),
  workspaceAvatarCatalogByPath: {},
  globalRooms: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalRoomSnapshotsById: {},
  globalRoomGrantsById: {},
  globalRoomAssetsById: {},
  globalTerminals: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalTerminalHistory: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalTerminalIndex: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalTerminalArchive: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalTerminalGrantsById: {},
  globalTerminalApprovalsById: {},
  globalTerminalActivityById: {},
  schedulerLogsBySession: {},
  observabilityTracesBySession: {},
  apiCallsBySession: {},
  heartbeatGroupsBySession: {},
  heartbeatRecordsBySession: {},
  heartbeatRecordDetailsBySession: {},
  modelCallsBySession: {},
  requestAuxBySession: {},
  modelCallDeltasBySession: {},
  terminalActivityBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession: {},
  unreadByBucket: {},
});

type Listener = (state: RuntimeClientState) => void;
type SubscriptionHandle = { unsubscribe: () => void };
type ApiCallStreamHandle = { count: number; sub: SubscriptionHandle | null; cursor: number };
type TerminalPermissionRequestStreamHandle = { count: number; sub: SubscriptionHandle | null };
type HistoryCursorValue = HistoryPageCursor | null;
type SessionResourceHandle = { sessionId: string };
type GlobalRoomSnapshotRefreshTask = {
  promise: Promise<GlobalRoomSnapshotOutput | null>;
  query: { accessToken?: string; limit?: number };
};
const hasBrowserFrameLoop = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.requestAnimationFrame === "function" &&
  typeof window.cancelAnimationFrame === "function" &&
  typeof document !== "undefined" &&
  typeof document.createElement === "function";
type GlobalRoomAssetsRefreshTask = {
  promise: Promise<GlobalRoomAssetEntry[]>;
  query: { accessToken?: string };
};
type GlobalTerminalActivityRefreshTask = {
  promise: Promise<TerminalActivityItem[]>;
  limit: number;
};
type GlobalRoomUpdateEvent = {
  chatId: string;
  roomRevision: string;
  transcriptRevision: string;
  refreshCatalog?: boolean;
  refreshSnapshot?: boolean;
  refreshGrants?: boolean;
  refreshAssets?: boolean;
};

const sortSessions = (sessions: SessionEntry[]): SessionEntry[] => {
  return [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const LOOPBUS_LRU_LIMIT = 100;
const HEARTBEAT_GROUP_PAGE_LIMIT = 5;
const HEARTBEAT_GROUP_LRU_LIMIT = HEARTBEAT_GROUP_PAGE_LIMIT * 3;
const HEARTBEAT_RECORD_PAGE_LIMIT = 20;
const MODEL_CALL_DELTA_LRU_LIMIT = 400;
const DEFAULT_GLOBAL_TERMINAL_ACTIVITY_LIMIT = 20;
const TERMINAL_ACTIVITY_PREVIEW_MAX_CHARS = 4_000;
const DEFAULT_MODEL_CAPABILITIES = {
  streaming: false,
  tools: false,
  imageInput: false,
  nativeCompact: false,
  summarizeFallback: false,
  fileUpload: false,
  mcpCatalog: false,
} as const;

const createEmptyAttentionState = (): RuntimeAttentionState => ({
  snapshot: { contexts: [] },
  active: [],
  cycleFrames: [],
  hooks: [],
});

const createEmptyAttentionDeliveryState = (): RuntimeAttentionDeliveryState => ({
  projections: [],
  dispatches: [],
  receipts: [],
  watches: [],
  effects: [],
});

const cloneRuntimeAttentionState = (attention: RuntimeAttentionState): RuntimeAttentionState => ({
  snapshot: {
    contexts: attention.snapshot.contexts.map((context) => ({
      ...context,
      scoreMap: { ...context.scoreMap },
      commits: context.commits.map((commit) => ({
        ...commit,
        parentCommitIds: [...commit.parentCommitIds],
        meta: { ...commit.meta },
        scores: { ...commit.scores },
        change: { ...commit.change },
      })),
    })),
  },
  active: attention.active.map((match) => ({
    contextId: match.contextId,
    context: { ...match.context, scoreMap: { ...match.context.scoreMap } },
    recentCommits: match.recentCommits.map((commit) => ({
      ...commit,
      parentCommitIds: [...commit.parentCommitIds],
      meta: { ...commit.meta },
      scores: { ...commit.scores },
      change: { ...commit.change },
    })),
  })),
  cycleFrames: attention.cycleFrames.map((frame) => ({
    ...frame,
    inputContextIds: [...frame.inputContextIds],
    activeContextIds: [...frame.activeContextIds],
    producedCommitRefs: frame.producedCommitRefs.map((ref) => ({ ...ref })),
    modelCallIds: [...frame.modelCallIds],
    hookIds: [...frame.hookIds],
  })),
  hooks: attention.hooks.map((record) => ({
    ...record,
    target: record.target ? { ...record.target } : undefined,
    output: record.output ? { ...record.output } : undefined,
  })),
});

const cloneRuntimeAttentionDeliveryState = (
  delivery: RuntimeAttentionDeliveryState,
): RuntimeAttentionDeliveryState => ({
  projections: delivery.projections.map((projection) => ({
    ...projection,
    latestError: projection.latestError ? { ...projection.latestError } : null,
  })),
  dispatches: delivery.dispatches.map((dispatch) => ({ ...dispatch })),
  receipts: delivery.receipts.map((receipt) => ({
    ...receipt,
    usage: receipt.usage ? { ...receipt.usage } : undefined,
    meta: receipt.meta ? structuredClone(receipt.meta) : undefined,
  })),
  watches: (delivery.watches ?? []).map((watch) => ({
    ...watch,
    predicate: structuredClone(watch.predicate),
    meta: watch.meta ? structuredClone(watch.meta) : undefined,
  })),
  effects: (delivery.effects ?? []).map((effect) => ({
    ...effect,
    meta: effect.meta ? structuredClone(effect.meta) : undefined,
  })),
});

const upsertAttentionDeliveryProjection = (
  projections: RuntimeAttentionDeliveryState["projections"],
  incoming: RuntimeAttentionDeliveryState["projections"][number],
): RuntimeAttentionDeliveryState["projections"] => {
  const next = projections.filter(
    (projection) => projection.contextId !== incoming.contextId || projection.commitId !== incoming.commitId,
  );
  next.push({
    ...incoming,
    latestError: incoming.latestError ? { ...incoming.latestError } : null,
  });
  return next;
};

const upsertAttentionDeliveryDispatch = (
  dispatches: RuntimeAttentionDeliveryState["dispatches"],
  incoming: RuntimeAttentionDeliveryState["dispatches"][number],
): RuntimeAttentionDeliveryState["dispatches"] => {
  const next = dispatches.filter((dispatch) => dispatch.dispatchId !== incoming.dispatchId);
  next.push({ ...incoming });
  next.sort(
    (left, right) =>
      left.createdAt - right.createdAt ||
      left.attemptIndex - right.attemptIndex ||
      left.dispatchId.localeCompare(right.dispatchId),
  );
  return next;
};

const upsertAttentionDeliveryReceipt = (
  receipts: RuntimeAttentionDeliveryState["receipts"],
  incoming: RuntimeAttentionDeliveryState["receipts"][number],
): RuntimeAttentionDeliveryState["receipts"] => {
  const next = receipts.filter((receipt) => receipt.receiptId !== incoming.receiptId);
  next.push({
    ...incoming,
    usage: incoming.usage ? { ...incoming.usage } : undefined,
    meta: incoming.meta ? structuredClone(incoming.meta) : undefined,
  });
  next.sort((left, right) => left.timestamp - right.timestamp || left.receiptId.localeCompare(right.receiptId));
  return next;
};

const patchRuntimeAttentionDeliveryState = (
  current: RuntimeAttentionDeliveryState,
  input: {
    dispatch?: RuntimeAttentionDeliveryState["dispatches"][number];
    receipt?: RuntimeAttentionDeliveryState["receipts"][number];
    projection?: RuntimeAttentionDeliveryState["projections"][number] | null;
  },
): RuntimeAttentionDeliveryState => {
  const next = cloneRuntimeAttentionDeliveryState(current);
  if (input.dispatch) {
    next.dispatches = upsertAttentionDeliveryDispatch(next.dispatches, input.dispatch);
    if (input.dispatch.sessionModelCallId !== null) {
      next.receipts = next.receipts.map((receipt) =>
        receipt.dispatchId === input.dispatch!.dispatchId
          ? {
              ...receipt,
              sessionModelCallId: input.dispatch!.sessionModelCallId,
            }
          : receipt,
      );
    }
  }
  if (input.receipt) {
    next.receipts = upsertAttentionDeliveryReceipt(next.receipts, input.receipt);
  }
  if (input.projection) {
    next.projections = upsertAttentionDeliveryProjection(next.projections, input.projection);
  }
  return next;
};

const replaceRuntimeAttentionDeliveryState = (delivery: RuntimeAttentionDeliveryState): RuntimeAttentionDeliveryState =>
  cloneRuntimeAttentionDeliveryState(delivery);

const createCachedResourceState = <T>(data: T): CachedResourceState<T> => ({
  data,
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: null,
});

const createHydratedCachedResourceState = <T>(data: T): CachedResourceState<T> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: Date.now(),
});

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const compareWorkspaceAvatarCatalogEntry = (
  left: WorkspaceAvatarCatalogEntry,
  right: WorkspaceAvatarCatalogEntry,
): number => {
  if (left.defaultAvatar !== right.defaultAvatar) {
    return left.defaultAvatar ? -1 : 1;
  }
  return left.nickname.localeCompare(right.nickname);
};

const sortWorkspaceAvatarCatalog = (items: WorkspaceAvatarCatalogEntry[]): WorkspaceAvatarCatalogEntry[] => {
  return [...items].sort(compareWorkspaceAvatarCatalogEntry);
};

const compareGlobalRoomEntry = (left: GlobalRoomEntry, right: GlobalRoomEntry): number => {
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }
  return left.chatId.localeCompare(right.chatId);
};

const sortGlobalRooms = (items: GlobalRoomEntry[]): GlobalRoomEntry[] => [...items].sort(compareGlobalRoomEntry);

const compareGlobalRoomAssetEntry = (left: GlobalRoomAssetEntry, right: GlobalRoomAssetEntry): number => {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  return right.assetId.localeCompare(left.assetId);
};

const sortGlobalRoomAssets = (items: GlobalRoomAssetEntry[]): GlobalRoomAssetEntry[] =>
  [...items].sort(compareGlobalRoomAssetEntry);

const withTrailingSlashTrimmed = (value: string): string => value.replace(/\/$/, "");

const hasOwnProjectionField = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

const mergeTerminalSnapshot = (
  current: GlobalTerminalEntry["snapshot"],
  incoming: GlobalTerminalEntry["snapshot"],
): GlobalTerminalEntry["snapshot"] => {
  if (!current) {
    return incoming;
  }
  if (!incoming) {
    return current;
  }
  return incoming.seq > current.seq ? incoming : current;
};

const normalizeOptionalAccessToken = (value: string | null | undefined): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const buildGlobalRoomReadInflightKey = (input: { chatId: string; accessToken?: string; messageId?: number }): string =>
  [input.chatId, input.accessToken ?? "", input.messageId === undefined ? "" : String(input.messageId)].join("\u0000");

const compareGlobalRoomMessage = (left: GlobalRoomMessage, right: GlobalRoomMessage): number => {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.rowId !== right.rowId) {
    return left.rowId - right.rowId;
  }
  return left.messageId - right.messageId;
};

const mergeGlobalRoomMessages = (
  base: readonly GlobalRoomMessage[],
  pending: readonly GlobalRoomMessage[],
): GlobalRoomMessage[] => {
  if (pending.length === 0) {
    return [...base];
  }
  const confirmedClientMessageIds = new Set(
    base
      .map((message) => message.clientMessageId)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  const merged = [...base];
  for (const message of pending) {
    if (message.clientMessageId && confirmedClientMessageIds.has(message.clientMessageId)) {
      continue;
    }
    merged.push(message);
  }
  merged.sort(compareGlobalRoomMessage);
  return merged;
};

const mergeGlobalTerminalEntry = (
  current: GlobalTerminalEntry | undefined,
  incoming: GlobalTerminalEntry,
): GlobalTerminalEntry => {
  if (!current) {
    return incoming;
  }
  return {
    ...current,
    ...incoming,
    snapshot: mergeTerminalSnapshot(current.snapshot, incoming.snapshot),
    backend: incoming.backend ?? current.backend,
    rendererPreference: incoming.rendererPreference ?? current.rendererPreference,
    theme: incoming.theme ?? current.theme,
    cursor: incoming.cursor ?? current.cursor,
    font: incoming.font ?? current.font,
    launchCwd: incoming.launchCwd,
    configuredTitle: hasOwnProjectionField(incoming, "configuredTitle")
      ? incoming.configuredTitle
      : current.configuredTitle,
    currentTitle: hasOwnProjectionField(incoming, "currentTitle") ? incoming.currentTitle : current.currentTitle,
    currentPath: hasOwnProjectionField(incoming, "currentPath") ? incoming.currentPath : current.currentPath,
    transportUrl: hasOwnProjectionField(incoming, "transportUrl") ? incoming.transportUrl : current.transportUrl,
    icon: hasOwnProjectionField(incoming, "icon") ? incoming.icon : current.icon,
    shortcuts: hasOwnProjectionField(incoming, "shortcuts") ? incoming.shortcuts : current.shortcuts,
    currentAdminId: incoming.currentAdminId ?? current.currentAdminId,
    approvalTimeoutMs: incoming.approvalTimeoutMs ?? current.approvalTimeoutMs,
    pendingRequestCount: incoming.pendingRequestCount ?? current.pendingRequestCount,
    access: incoming.access ?? current.access,
    actors: incoming.actors ?? current.actors,
  };
};

const isHistoryProjectionTerminal = (terminal: Pick<GlobalTerminalEntry, "processPhase" | "archivedAt">): boolean =>
  terminal.processPhase === "killed" && terminal.archivedAt == null;

const isArchivedProjectionTerminal = (terminal: Pick<GlobalTerminalEntry, "processPhase" | "archivedAt">): boolean =>
  terminal.processPhase === "killed" && terminal.archivedAt != null;

const isLiveProjectionTerminal = (terminal: Pick<GlobalTerminalEntry, "processPhase" | "archivedAt">): boolean =>
  terminal.processPhase !== "killed" && terminal.archivedAt == null;

const compareGlobalTerminalIndexEntries = (left: GlobalTerminalEntry, right: GlobalTerminalEntry): number => {
  const leftKilled = isHistoryProjectionTerminal(left);
  const rightKilled = isHistoryProjectionTerminal(right);
  if (leftKilled !== rightKilled) {
    return leftKilled ? 1 : -1;
  }
  if (leftKilled && rightKilled) {
    const leftStoppedAt = left.lastStoppedAt ?? left.updatedAt ?? 0;
    const rightStoppedAt = right.lastStoppedAt ?? right.updatedAt ?? 0;
    if (leftStoppedAt !== rightStoppedAt) {
      return rightStoppedAt - leftStoppedAt;
    }
  } else if (!leftKilled && !rightKilled) {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
  }
  return left.terminalId.localeCompare(right.terminalId);
};

const sortGlobalTerminalIndexEntries = (entries: readonly GlobalTerminalEntry[]): GlobalTerminalEntry[] =>
  [...entries].sort(compareGlobalTerminalIndexEntries);

const isTrpcErrorCode = (error: unknown, code: string): boolean =>
  Boolean(
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "code" in error.data &&
    error.data.code === code,
  );

const AUTH_REQUIRED_MESSAGE = "auth token required";
const unauthorizedErrorMessage = (error: unknown): string | null =>
  isTrpcErrorCode(error, "UNAUTHORIZED") ? AUTH_REQUIRED_MESSAGE : null;

const projectGlobalTerminalFromConfigMutation = (
  current: GlobalTerminalEntry | null,
  result: {
    config: {
      terminalId: string;
      processKind: string;
      backend: "xterm" | "ghostty-native";
      command: string[];
      launchCwd: string;
      profile: {
        cols?: number;
        rows?: number;
        icon?: string;
        title?: string;
        shortcuts?: Record<string, string>;
        rendererPreference?: "auto" | "ghostty-web" | "wterm" | "xterm";
        theme?: "default-dark" | "default-light" | "monokai";
        cursor?: "block" | "bar" | "underline";
        font?: {
          family: string;
          sizePx: number;
          lineHeight: number;
          letterSpacing: number;
          weight: string;
          weightBold: string;
          ligatures: boolean;
        };
      };
      processPhase: "running" | "killed" | "not_started";
    };
  },
): GlobalTerminalEntry => {
  const currentSnapshot = current?.snapshot;
  const nextCols = result.config.profile.cols;
  const nextRows = result.config.profile.rows;
  const snapshot =
    currentSnapshot && (nextCols !== undefined || nextRows !== undefined)
      ? {
          ...currentSnapshot,
          seq: currentSnapshot.seq + 1,
          timestamp: Date.now(),
          cols: nextCols ?? currentSnapshot.cols,
          rows: nextRows ?? currentSnapshot.rows,
        }
      : (currentSnapshot ?? undefined);

  return {
    terminalId: result.config.terminalId,
    processKind: result.config.processKind,
    backend: result.config.backend,
    command: [...result.config.command],
    launchCwd: result.config.launchCwd,
    workspace: current?.workspace ?? null,
    status: current?.status ?? "IDLE",
    processPhase:
      result.config.processPhase === "not_started"
        ? (current?.processPhase ?? "not_started")
        : result.config.processPhase,
    seq: current?.seq ?? 0,
    snapshot,
    focused: current?.focused ?? false,
    icon: result.config.profile.icon ?? current?.icon,
    configuredTitle: result.config.profile.title ?? current?.configuredTitle,
    currentTitle: current?.currentTitle,
    currentPath: current?.currentPath,
    shortcuts: result.config.profile.shortcuts ?? current?.shortcuts,
    rendererPreference: result.config.profile.rendererPreference ?? current?.rendererPreference ?? "auto",
    theme: result.config.profile.theme ?? current?.theme ?? "default-dark",
    cursor: result.config.profile.cursor ?? current?.cursor ?? "block",
    font: result.config.profile.font ??
      current?.font ?? {
        family:
          "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        sizePx: 14,
        lineHeight: 1,
        letterSpacing: 0,
        weight: "400",
        weightBold: "700",
        ligatures: true,
      },
    transportUrl: current?.transportUrl,
    currentAdminId: current?.currentAdminId,
    approvalTimeoutMs: current?.approvalTimeoutMs,
    pendingRequestCount: current?.pendingRequestCount,
    createdAt: current?.createdAt ?? 0,
    updatedAt: current?.updatedAt ?? current?.createdAt ?? 0,
    access: current?.access,
    actors: current?.actors,
  };
};

const compareChatMessage = (left: RuntimeChatMessage, right: RuntimeChatMessage): number => {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }
  return left.id.localeCompare(right.id);
};

const mergeTerminalActivityItems = (
  current: TerminalActivityItem[],
  incoming: TerminalActivityItem[],
  limit: number,
): TerminalActivityItem[] => {
  const entries = new Map<number, TerminalActivityItem>();
  for (const item of current) {
    entries.set(item.id, item);
  }
  for (const item of incoming) {
    entries.set(item.id, item);
  }
  const merged = [...entries.values()].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left.id - right.id;
  });
  return merged.length > limit ? merged.slice(-limit) : merged;
};

const isTerminalReadResultLike = (
  value: unknown,
): value is {
  representation: "snapshot" | "diff";
  terminalId: string;
  eventId?: number;
  seq?: number;
  cols?: number;
  rows?: number;
  cursor?: { x: number; y: number };
  tail?: string;
  snapshot?: {
    seq?: number;
    cols?: number;
    rows?: number;
    cursor?: { x: number; y: number };
    lines?: string[];
  };
  fromHash?: string | null;
  toHash?: string | null;
  diff?: string;
  bytes?: number;
  status?: "IDLE" | "BUSY";
  title?: string;
  running?: boolean;
  readCursor?: {
    readerActorId: GlobalTerminalActorId;
    fromHash: string | null;
    toHash: string | null;
    consumed: boolean;
  };
} => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as { representation?: unknown };
  return record.representation === "snapshot" || record.representation === "diff";
};

const trimTerminalActivityPreview = (
  raw: string | undefined,
): {
  preview: string;
  truncated: boolean;
} => {
  const normalized = raw?.trimEnd() ?? "";
  if (normalized.length <= TERMINAL_ACTIVITY_PREVIEW_MAX_CHARS) {
    return {
      preview: normalized,
      truncated: false,
    };
  }
  return {
    preview: `${normalized.slice(0, TERMINAL_ACTIVITY_PREVIEW_MAX_CHARS)}\n…`,
    truncated: true,
  };
};

const projectTerminalReadActivitySummary = (
  output: unknown,
): Pick<TerminalActivityItem, "content" | "detail"> | null => {
  if (!isTerminalReadResultLike(output)) {
    return null;
  }

  if (output.representation === "diff") {
    const diffPreview = trimTerminalActivityPreview(output.diff);
    const preview =
      diffPreview.preview ||
      [output.title ?? "Terminal read", output.bytes ? `${output.bytes} bytes` : null].filter(Boolean).join(" · ");
    return {
      content: preview,
      detail: {
        source: "terminal-read-activity",
        eventId: output.eventId ?? null,
        terminalId: output.terminalId,
        representation: output.representation,
        status: output.status ?? null,
        title: output.title,
        running: output.running ?? false,
        fromHash: output.fromHash ?? null,
        toHash: output.toHash ?? null,
        readCursor: output.readCursor ?? null,
        bytes: output.bytes ?? null,
        preview,
        truncated: diffPreview.truncated,
      },
    };
  }

  const snapshot = output.snapshot;
  const cols = output.cols ?? snapshot?.cols ?? null;
  const rows = output.rows ?? snapshot?.rows ?? null;
  const lineCount = snapshot?.lines?.length ?? null;
  const tailPreview = trimTerminalActivityPreview(output.tail ?? snapshot?.lines?.slice(-20).join("\n"));
  const preview =
    tailPreview.preview ||
    [
      output.title ?? "Terminal read",
      cols && rows ? `${cols}x${rows}` : null,
      lineCount !== null ? `${lineCount} lines` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return {
    content: preview,
    detail: {
      source: "terminal-read-activity",
      eventId: output.eventId ?? null,
      terminalId: output.terminalId,
      representation: output.representation,
      status: output.status ?? null,
      title: output.title,
      running: output.running ?? false,
      seq: output.seq ?? snapshot?.seq ?? null,
      cols,
      rows,
      cursor: output.cursor ?? snapshot?.cursor ?? null,
      readCursor: output.readCursor ?? null,
      lineCount,
      preview,
      truncated: tailPreview.truncated,
    },
  };
};

const pickNewerHeartbeatGroup = (current: HeartbeatGroupItem, incoming: HeartbeatGroupItem): HeartbeatGroupItem => {
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt ? incoming : current;
  }
  if (incoming.id !== current.id) {
    return incoming.id > current.id ? incoming : current;
  }
  return incoming;
};

const mergeHeartbeatGroup = (current: HeartbeatGroupItem, incoming: HeartbeatGroupItem): HeartbeatGroupItem => {
  const preferred = pickNewerHeartbeatGroup(current, incoming);
  const items = mergeHeartbeatPartItems(current.items, incoming.items);
  const maxItemUpdatedAt = items.reduce((latest, item) => Math.max(latest, item.updatedAt), 0);
  return {
    ...preferred,
    createdAt: items[0]?.createdAt ?? Math.min(current.createdAt, incoming.createdAt),
    updatedAt: Math.max(current.updatedAt, incoming.updatedAt, maxItemUpdatedAt),
    isComplete: preferred.isComplete && items.every((item) => item.isComplete),
    items,
  };
};

const pickNewerHeartbeatPartItem = (current: HeartbeatPartItem, incoming: HeartbeatPartItem): HeartbeatPartItem => {
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt ? incoming : current;
  }
  if (incoming.id !== current.id) {
    return incoming.id > current.id ? incoming : current;
  }
  return incoming;
};

const mergeHeartbeatPartItems = (current: HeartbeatPartItem[], incoming: HeartbeatPartItem[]): HeartbeatPartItem[] => {
  const entries = new Map<string, HeartbeatPartItem>();
  for (const item of current) {
    entries.set(item.messageId, item);
  }
  for (const item of incoming) {
    const existing = entries.get(item.messageId);
    entries.set(item.messageId, existing ? pickNewerHeartbeatPartItem(existing, item) : item);
  }
  return [...entries.values()].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left.id - right.id;
  });
};

const sameChatAttachmentSet = (
  left: RuntimeChatMessage["attachments"],
  right: RuntimeChatMessage["attachments"],
): boolean => {
  if ((left?.length ?? 0) !== (right?.length ?? 0)) {
    return false;
  }
  return (left ?? []).every((attachment, index) => {
    const other = right?.[index];
    return (
      attachment.assetId === other?.assetId &&
      attachment.kind === other?.kind &&
      attachment.mimeType === other?.mimeType &&
      attachment.name === other?.name &&
      attachment.sizeBytes === other?.sizeBytes
    );
  });
};

type RuntimeToolPayload = NonNullable<RuntimeChatMessage["tool"]>["call"];

const sameToolPayload = (left: RuntimeToolPayload, right: RuntimeToolPayload): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.rawText === right.rawText && JSON.stringify(left.value) === JSON.stringify(right.value);
};

const sameChatToolInvocation = (left: RuntimeChatMessage["tool"], right: RuntimeChatMessage["tool"]): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.invocationId === right.invocationId &&
    left.name === right.name &&
    left.status === right.status &&
    left.startedAt === right.startedAt &&
    left.finishedAt === right.finishedAt &&
    left.error === right.error &&
    sameToolPayload(left.call, right.call) &&
    sameToolPayload(left.result, right.result)
  );
};

const isPersistedChatMessageId = (messageId: string): boolean => /^\d+$/.test(messageId);

const normalizeChatChannel = (
  channel: RuntimeChatMessage["channel"] | "user_input" | null | undefined,
): RuntimeChatMessage["channel"] => {
  if (channel === "to_user" || channel === "self_talk" || channel === "tool") {
    return channel;
  }
  return undefined;
};

const sameChatMessageRecord = (left: RuntimeChatMessage, right: RuntimeChatMessage): boolean => {
  const leftFormat = left.format ?? "markdown";
  const rightFormat = right.format ?? "markdown";
  return (
    left.chatId === right.chatId &&
    (left.heartbeatKind ?? "message") === (right.heartbeatKind ?? "message") &&
    (left.compactTrigger ?? null) === (right.compactTrigger ?? null) &&
    left.role === right.role &&
    (left.visibleAt ?? null) === (right.visibleAt ?? null) &&
    (left.cycleId ?? null) === (right.cycleId ?? null) &&
    left.channel === right.channel &&
    leftFormat === rightFormat &&
    left.content === right.content &&
    left.timestamp === right.timestamp &&
    sameChatToolInvocation(left.tool, right.tool) &&
    sameChatAttachmentSet(left.attachments, right.attachments)
  );
};

const compareHistoryCursor = (left: HistoryPageCursor, right: HistoryPageCursor): number => {
  if (left.beforeTimeMs !== right.beforeTimeMs) {
    return left.beforeTimeMs - right.beforeTimeMs;
  }
  return left.beforeId - right.beforeId;
};

const normalizeFocusedTerminalState = (input: {
  focusedTerminalIds?: string[];
  focusedTerminalId?: string | null;
}): {
  focusedTerminalIds: string[];
  focusedTerminalId: string;
} => {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const terminalId of input.focusedTerminalIds ?? []) {
    if (!terminalId || seen.has(terminalId)) {
      continue;
    }
    seen.add(terminalId);
    deduped.push(terminalId);
  }
  if (deduped.length === 0 && input.focusedTerminalId) {
    deduped.push(input.focusedTerminalId);
  }
  return {
    focusedTerminalIds: deduped,
    focusedTerminalId: deduped[0] ?? "",
  };
};

export class RuntimeStore {
  private state: RuntimeClientState = createInitialState();
  private readonly listeners = new Set<Listener>();
  private pendingEmitFrame: number | null = null;
  private eventSub: SubscriptionHandle | null = null;
  private transportUnsubscribe: (() => void) | null = null;
  private browserListenersAttached = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private connecting = false;
  private connectTask: Promise<void> | null = null;
  private shouldReconnect = false;
  private readonly sessionResourceHandles = new Map<string, SessionResourceHandle>();
  private readonly messageChannelRefreshTasks = new WeakMap<SessionResourceHandle, Promise<MessageChannelEntry[]>>();
  private globalAvatarCatalogRefreshTask: Promise<GlobalAvatarCatalogEntry[]> | null = null;
  private globalAvatarCatalogWatchCount = 0;
  private readonly workspaceAvatarCatalogRefreshTasks = new Map<string, Promise<WorkspaceAvatarCatalogEntry[]>>();
  private readonly workspaceAvatarCatalogWatchCountByPath = new Map<string, number>();
  private globalRoomsRefreshTask: Promise<GlobalRoomEntry[]> | null = null;
  private globalRoomsWatchCount = 0;
  private readonly globalRoomSnapshotRefreshTasks = new Map<string, GlobalRoomSnapshotRefreshTask>();
  private readonly globalRoomSnapshotWatchCountById = new Map<string, number>();
  private readonly globalRoomSnapshotQueryById = new Map<string, { accessToken?: string; limit?: number }>();
  private readonly globalRoomGrantRefreshTasks = new Map<string, Promise<GlobalRoomGrantEntry[]>>();
  private readonly globalRoomGrantWatchCountById = new Map<string, number>();
  private readonly globalRoomGrantQueryById = new Map<string, { accessToken?: string }>();
  private readonly globalRoomAssetRefreshTasks = new Map<string, GlobalRoomAssetsRefreshTask>();
  private readonly globalRoomAssetWatchCountById = new Map<string, number>();
  private readonly globalRoomAssetQueryById = new Map<string, { accessToken?: string }>();
  private readonly globalRoomReadMutations = new Map<string, Promise<GlobalRoomEntry>>();
  private globalTerminalsRefreshTask: Promise<GlobalTerminalEntry[]> | null = null;
  private globalTerminalsWatchCount = 0;
  private globalTerminalHistoryWatchCount = 0;
  private globalTerminalIndexWatchCount = 0;
  private globalTerminalArchiveWatchCount = 0;
  private readonly globalTerminalGrantRefreshTasks = new Map<string, Promise<GlobalTerminalGrantEntry[]>>();
  private readonly globalTerminalGrantWatchCountById = new Map<string, number>();
  private readonly globalTerminalApprovalRefreshTasks = new Map<string, Promise<GlobalTerminalApprovalRequest[]>>();
  private readonly globalTerminalApprovalWatchCountById = new Map<string, number>();
  private readonly terminalPermissionRequestStreams = new Map<string, TerminalPermissionRequestStreamHandle>();
  private readonly globalTerminalActivityRefreshTasks = new Map<string, GlobalTerminalActivityRefreshTask>();
  private readonly globalTerminalActivityWatchCountById = new Map<string, number>();
  private readonly apiCallStreams = new Map<string, ApiCallStreamHandle>();
  private readonly schedulerLogsAccessBySession = new Map<string, Map<number, number>>();
  private readonly observabilityTracesAccessBySession = new Map<string, Map<number, number>>();
  private readonly apiCallsAccessBySession = new Map<string, Map<number, number>>();
  private readonly modelCallsAccessBySession = new Map<string, Map<number, number>>();
  private readonly requestAuxAccessBySession = new Map<string, Map<number, number>>();
  private readonly modelCallDeltasAccessBySession = new Map<string, Map<number, number>>();
  private readonly schedulerLogsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly observabilityTracesBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly apiCallsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly heartbeatGroupsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly heartbeatGroupRefreshTimerBySession = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly heartbeatGroupRefreshInFlightBySession = new Set<string>();
  private readonly heartbeatGroupRefreshPendingLimitBySession = new Map<string, number>();
  private readonly heartbeatRecordRefreshTimerBySession = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly heartbeatRecordRefreshInFlightBySession = new Set<string>();
  private readonly modelCallsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly requestAuxBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly chatBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly chatCyclesBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly terminalActivityBeforeCursorByKey = new Map<string, HistoryCursorValue>();
  private readonly chatHydrationTasksBySession = new Map<
    string,
    Promise<{ messagesHasMore: boolean; cyclesHasMore: boolean }>
  >();
  private accessTick = 0;
  private connectSequence = 0;

  constructor(private readonly client: AgenterClient) {}

  private runBackgroundTask(task: Promise<unknown>): void {
    void task.catch(() => undefined);
  }

  private resolveHttpUrl(pathname: string): string {
    return `${withTrailingSlashTrimmed(this.client.httpUrl)}${pathname}`;
  }

  private resolveMediaUrl(url: string): string {
    const resolvedUrl = /^https?:\/\//i.test(url) ? url : url.startsWith("/") ? this.resolveHttpUrl(url) : url;
    const authToken = this.client.getAuthToken();
    if (!authToken) {
      return resolvedUrl;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(resolvedUrl, this.client.httpUrl);
    } catch {
      return resolvedUrl;
    }
    const appServerOrigin = new URL(this.client.httpUrl).origin;
    const isBrowserMediaPath =
      /^\/media\/sessions\/[^/]+\/assets\/[^/]+$/u.test(parsedUrl.pathname) ||
      /^\/media\/rooms\/[^/]+\/assets\/[^/]+$/u.test(parsedUrl.pathname);
    if (parsedUrl.origin !== appServerOrigin || !isBrowserMediaPath || parsedUrl.searchParams.has("authToken")) {
      return parsedUrl.toString();
    }
    parsedUrl.searchParams.set("authToken", authToken);
    return parsedUrl.toString();
  }

  private buildProfileServiceUrl(pathname: string): string | null {
    const endpoint = this.state.profileService?.endpoint;
    return endpoint ? `${withTrailingSlashTrimmed(endpoint)}${pathname}` : null;
  }

  private async ensureProfileServiceInfo(force = false): Promise<AuthServiceInfoOutput> {
    if (!force && this.state.profileService) {
      return this.state.profileService;
    }
    const profileService = await this.client.trpc.auth.service.query();
    this.state = {
      ...this.state,
      profileService,
    };
    this.emit();
    return profileService;
  }

  private async resolveProfileServiceUrl(pathname: string): Promise<string> {
    const profileService = await this.ensureProfileServiceInfo();
    return `${withTrailingSlashTrimmed(profileService.endpoint)}${pathname}`;
  }

  setAuthToken(token: string | null | undefined): void {
    this.client.setAuthToken(token);
  }

  clearAuthToken(): void {
    this.client.setAuthToken(null);
  }

  getAuthToken(): string | null {
    return this.client.getAuthToken();
  }

  async getAuthServiceDescriptor(input?: { force?: boolean }): Promise<AuthServiceInfoOutput> {
    return await this.ensureProfileServiceInfo(input?.force);
  }

  async listAuthActors() {
    const output = await this.client.trpc.auth.actors.query();
    return output.items;
  }

  async startAuthChallenge(authId: string) {
    return await this.client.trpc.auth.challengeStart.mutate({ authId });
  }

  async autoLogin() {
    return await this.client.trpc.auth.autoLogin.mutate();
  }

  async storeAutoLoginKey(input?: { privateKey?: string | null }) {
    return await this.client.trpc.auth.storeAutoLoginKey.mutate(
      input?.privateKey?.trim() ? { privateKey: input.privateKey.trim() } : undefined,
    );
  }

  async verifyAuthChallenge(input: { challengeId: string; signature: string }) {
    return await this.client.trpc.auth.challengeVerify.mutate(input);
  }

  async getAuthSession(): Promise<AuthSessionOutput | null> {
    try {
      return await this.client.trpc.auth.session.query();
    } catch (error) {
      if (isTrpcErrorCode(error, "UNAUTHORIZED")) {
        return null;
      }
      throw error;
    }
  }

  async listAuthDrafts(input?: { kind?: AuthDraftKind; draftIds?: string[] }): Promise<AuthDraftSnapshotOutput> {
    return await this.client.trpc.drafts.list.query(input);
  }

  async getAuthDraft(draftId: string): Promise<AuthDraftEntry | null> {
    return await this.client.trpc.drafts.get.query({ draftId });
  }

  async createAuthDraft(input: {
    kind: "avatar_create";
    state: AvatarCreateDraftState;
  }): Promise<AuthDraftCreateOutput> {
    return await this.client.trpc.drafts.create.mutate(input);
  }

  async saveAuthDraft(input: {
    draftId: string;
    kind: "avatar_create";
    state: AvatarCreateDraftState;
    baseVersion?: number;
  }): Promise<AuthDraftSaveOutput> {
    return await this.client.trpc.drafts.save.mutate(input);
  }

  async deleteAuthDraft(input: { draftId: string; baseVersion?: number }): Promise<AuthDraftDeleteOutput> {
    return await this.client.trpc.drafts.delete.mutate(input);
  }

  subscribeAuthDraftEvents(
    input:
      | {
          afterEventId?: number;
          kind?: AuthDraftKind;
          draftIds?: string[];
        }
      | undefined,
    handlers: {
      onData: (event: AuthDraftEvent) => void;
      onError?: (error: unknown) => void;
    },
  ): SubscriptionHandle {
    return this.client.trpc.drafts.events.subscribe(input, handlers);
  }

  async snapshotAuthKv(input?: { keys?: string[]; prefix?: string }): Promise<AuthKvSnapshotOutput> {
    return await this.client.trpc.kv.snapshot.query(input);
  }

  async setAuthKv(input: { key: string; value: JsonValue; baseVersion?: number | null }): Promise<AuthKvSetOutput> {
    return await this.client.trpc.kv.set.mutate(input);
  }

  async deleteAuthKv(input: { key: string; baseVersion?: number | null }): Promise<AuthKvDeleteOutput> {
    return await this.client.trpc.kv.delete.mutate(input);
  }

  subscribeAuthKvEvents(
    input:
      | {
          afterEventId?: number;
          keys?: string[];
          prefix?: string;
        }
      | undefined,
    handlers: {
      onData: (event: AuthKvEvent) => void;
      onError?: (error: unknown) => void;
    },
  ): SubscriptionHandle {
    return this.client.trpc.kv.events.subscribe(input, handlers);
  }

  async getSuperadminStatus() {
    return await this.client.trpc.auth.superadminStatus.query();
  }

  private normalizeRuntimeChatMessage(message: RuntimeChatMessage): RuntimeChatMessage {
    return {
      ...message,
      cycleId: message.cycleId ?? null,
      updatedAt: message.updatedAt ?? message.timestamp,
      visibleAt: message.visibleAt,
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
          part.type !== "text"
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

  private normalizeGlobalRoomAssetEntry(asset: GlobalRoomAssetEntry): GlobalRoomAssetEntry {
    return {
      ...asset,
      url: this.resolveMediaUrl(asset.url),
    };
  }

  private toRuntimeChatMessage(item: ChatListItem): RuntimeChatMessage {
    return {
      id: item.messageId,
      chatId: item.chatId,
      role: item.role,
      content: item.content,
      timestamp: item.timestamp,
      updatedAt: item.updatedAt ?? item.timestamp,
      visibleAt: item.visibleAt,
      cycleId: item.cycleId ?? null,
      channel: normalizeChatChannel(item.channel as RuntimeChatMessage["channel"] | "user_input" | null | undefined),
      format: item.format,
      heartbeatKind: item.heartbeatKind,
      compactTrigger: item.compactTrigger,
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

  private mergeChatMessages(current: RuntimeChatMessage[], incoming: RuntimeChatMessage[]): RuntimeChatMessage[] {
    const entries = new Map<string, RuntimeChatMessage>();
    for (const message of current) {
      entries.set(message.id, message);
    }
    for (const message of incoming) {
      entries.set(message.id, message);
    }
    const merged = [...entries.values()];
    const persistedMessages = merged.filter((message) => isPersistedChatMessageId(message.id));

    return merged
      .filter((message) => {
        if (isPersistedChatMessageId(message.id)) {
          return true;
        }
        return !persistedMessages.some((persisted) => sameChatMessageRecord(persisted, message));
      })
      .sort(compareChatMessage);
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

  private ensureSessionResourceHandle(sessionId: string): SessionResourceHandle {
    const existing = this.sessionResourceHandles.get(sessionId);
    if (existing) {
      return existing;
    }
    const handle = { sessionId };
    this.sessionResourceHandles.set(sessionId, handle);
    return handle;
  }

  private releaseSessionResourceHandle(sessionId: string): void {
    this.sessionResourceHandles.delete(sessionId);
  }

  private clearHeartbeatRecordRefresh(sessionId: string): void {
    const timer = this.heartbeatRecordRefreshTimerBySession.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.heartbeatRecordRefreshTimerBySession.delete(sessionId);
    }
    this.heartbeatRecordRefreshInFlightBySession.delete(sessionId);
  }

  private ensureMessageChannelsState(sessionId: string): CachedResourceState<MessageChannelEntry[]> {
    return this.state.messageChannelsBySession[sessionId] ?? createCachedResourceState<MessageChannelEntry[]>([]);
  }

  private setMessageChannelsState(
    sessionId: string,
    updater: (current: CachedResourceState<MessageChannelEntry[]>) => CachedResourceState<MessageChannelEntry[]>,
  ): CachedResourceState<MessageChannelEntry[]> {
    const next = updater(this.ensureMessageChannelsState(sessionId));
    this.state.messageChannelsBySession[sessionId] = next;
    return next;
  }

  private ensureHeartbeatGroupsState(sessionId: string): CachedResourceState<HeartbeatGroupItem[]> {
    return this.state.heartbeatGroupsBySession[sessionId] ?? createCachedResourceState<HeartbeatGroupItem[]>([]);
  }

  private setHeartbeatGroupsState(
    sessionId: string,
    updater: (current: CachedResourceState<HeartbeatGroupItem[]>) => CachedResourceState<HeartbeatGroupItem[]>,
  ): CachedResourceState<HeartbeatGroupItem[]> {
    const next = updater(this.ensureHeartbeatGroupsState(sessionId));
    this.state.heartbeatGroupsBySession[sessionId] = next;
    return next;
  }

  private ensureHeartbeatRecordsState(sessionId: string): CachedResourceState<HeartbeatRecordsPageOutput | null> {
    return (
      this.state.heartbeatRecordsBySession[sessionId] ??
      createCachedResourceState<HeartbeatRecordsPageOutput | null>(null)
    );
  }

  private setHeartbeatRecordsState(
    sessionId: string,
    updater: (
      current: CachedResourceState<HeartbeatRecordsPageOutput | null>,
    ) => CachedResourceState<HeartbeatRecordsPageOutput | null>,
  ): CachedResourceState<HeartbeatRecordsPageOutput | null> {
    const next = updater(this.ensureHeartbeatRecordsState(sessionId));
    this.state.heartbeatRecordsBySession[sessionId] = next;
    return next;
  }

  private ensureHeartbeatRecordDetailState(
    sessionId: string,
    recordId: number,
  ): CachedResourceState<HeartbeatRecordDetailOutput> {
    const detailsById = this.state.heartbeatRecordDetailsBySession[sessionId] ?? {};
    return detailsById[recordId] ?? createCachedResourceState<HeartbeatRecordDetailOutput>(null);
  }

  private setHeartbeatRecordDetailState(
    sessionId: string,
    recordId: number,
    updater: (
      current: CachedResourceState<HeartbeatRecordDetailOutput>,
    ) => CachedResourceState<HeartbeatRecordDetailOutput>,
  ): CachedResourceState<HeartbeatRecordDetailOutput> {
    const detailsById = this.state.heartbeatRecordDetailsBySession[sessionId] ?? {};
    const next = updater(this.ensureHeartbeatRecordDetailState(sessionId, recordId));
    this.state.heartbeatRecordDetailsBySession[sessionId] = {
      ...detailsById,
      [recordId]: next,
    };
    return next;
  }

  private ensureGlobalAvatarCatalogState(): CachedResourceState<GlobalAvatarCatalogEntry[]> {
    return this.state.globalAvatarCatalog;
  }

  private setGlobalAvatarCatalogState(
    updater: (
      current: CachedResourceState<GlobalAvatarCatalogEntry[]>,
    ) => CachedResourceState<GlobalAvatarCatalogEntry[]>,
  ): CachedResourceState<GlobalAvatarCatalogEntry[]> {
    const next = updater(this.ensureGlobalAvatarCatalogState());
    this.state.globalAvatarCatalog = next;
    return next;
  }

  private reconcileGlobalAvatarCatalogEntry(entry: GlobalAvatarCatalogEntry): void {
    this.setGlobalAvatarCatalogState((resource) => {
      const nextData = resource.data.filter(
        (candidate) => candidate.avatarPrincipalId !== entry.avatarPrincipalId && candidate.nickname !== entry.nickname,
      );
      nextData.push(entry);
      return {
        ...resource,
        data: sortWorkspaceAvatarCatalog(nextData),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private async refreshGlobalAvatarCatalogInternal(
    input: { force?: boolean } = {},
  ): Promise<GlobalAvatarCatalogEntry[]> {
    const current = this.ensureGlobalAvatarCatalogState();
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    if (this.globalAvatarCatalogRefreshTask) {
      return await this.globalAvatarCatalogRefreshTask;
    }

    this.setGlobalAvatarCatalogState((resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.avatar.catalog
      .query()
      .then((output) => {
        const data = sortWorkspaceAvatarCatalog(output.items);
        this.setGlobalAvatarCatalogState((resource) => ({
          ...resource,
          data,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return data;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalAvatarCatalogState((resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        this.globalAvatarCatalogRefreshTask = null;
      });

    this.globalAvatarCatalogRefreshTask = task;
    return await task;
  }

  private ensureWorkspaceAvatarCatalogState(workspacePath: string): CachedResourceState<WorkspaceAvatarCatalogEntry[]> {
    return (
      this.state.workspaceAvatarCatalogByPath[workspacePath] ??
      createCachedResourceState<WorkspaceAvatarCatalogEntry[]>([])
    );
  }

  private setWorkspaceAvatarCatalogState(
    workspacePath: string,
    updater: (
      current: CachedResourceState<WorkspaceAvatarCatalogEntry[]>,
    ) => CachedResourceState<WorkspaceAvatarCatalogEntry[]>,
  ): CachedResourceState<WorkspaceAvatarCatalogEntry[]> {
    const next = updater(this.ensureWorkspaceAvatarCatalogState(workspacePath));
    this.state.workspaceAvatarCatalogByPath[workspacePath] = next;
    return next;
  }

  private reconcileWorkspaceAvatarCatalogEntry(
    workspacePath: string,
    entry: WorkspaceAvatarCatalogEntry,
    optimisticNickname?: string,
  ): void {
    this.setWorkspaceAvatarCatalogState(workspacePath, (resource) => {
      const nextData = resource.data.filter(
        (candidate) => candidate.nickname !== entry.nickname && candidate.nickname !== optimisticNickname,
      );
      nextData.push(entry);
      return {
        ...resource,
        data: sortWorkspaceAvatarCatalog(nextData),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private insertOptimisticWorkspaceAvatarCopy(input: {
    workspacePath: string;
    sourceAvatar: string;
    targetAvatar: string;
  }): { applied: boolean; optimisticNickname: string } {
    const optimisticNickname = input.targetAvatar.trim();
    if (optimisticNickname.length === 0) {
      return { applied: false, optimisticNickname };
    }

    const resource = this.ensureWorkspaceAvatarCatalogState(input.workspacePath);
    if (!resource.loaded || resource.data.some((entry) => entry.nickname === optimisticNickname)) {
      return { applied: false, optimisticNickname };
    }

    const sourceEntry = resource.data.find((entry) => entry.nickname === input.sourceAvatar);
    const sameNicknameCopy = input.sourceAvatar === optimisticNickname;
    const optimisticEntry: WorkspaceAvatarCatalogEntry = {
      avatarPrincipalId: sameNicknameCopy ? (sourceEntry?.avatarPrincipalId ?? null) : null,
      runtimeId: sameNicknameCopy ? (sourceEntry?.runtimeId ?? optimisticNickname) : optimisticNickname,
      nickname: optimisticNickname,
      displayName: sameNicknameCopy ? (sourceEntry?.displayName ?? null) : null,
      classify: sameNicknameCopy ? (sourceEntry?.classify ?? null) : null,
      iconUrl: sameNicknameCopy ? (sourceEntry?.iconUrl ?? null) : null,
      defaultAvatar: optimisticNickname === "default",
      sourceScope: "global",
      globalAvailable: sameNicknameCopy ? (sourceEntry?.globalAvailable ?? true) : false,
      workspacePrivateSlotReady: true,
      globalPath: sameNicknameCopy ? (sourceEntry?.globalPath ?? "") : "",
      workspacePrivatePath: "",
      effectivePath: "",
    };
    this.setWorkspaceAvatarCatalogState(input.workspacePath, (current) => ({
      ...current,
      data: sortWorkspaceAvatarCatalog([...current.data, optimisticEntry]),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: current.refreshedAt,
    }));
    this.emit();
    return { applied: true, optimisticNickname };
  }

  private rollbackOptimisticWorkspaceAvatarCopy(workspacePath: string, optimisticNickname: string): void {
    if (optimisticNickname.length === 0) {
      return;
    }
    this.setWorkspaceAvatarCatalogState(workspacePath, (resource) => ({
      ...resource,
      data: resource.data.filter((entry) => entry.nickname !== optimisticNickname),
      loading: false,
      refreshing: false,
      error: null,
    }));
  }

  private async refreshWorkspaceAvatarCatalogInternal(
    workspacePath: string,
    input: { force?: boolean } = {},
  ): Promise<WorkspaceAvatarCatalogEntry[]> {
    const current = this.ensureWorkspaceAvatarCatalogState(workspacePath);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const inflight = this.workspaceAvatarCatalogRefreshTasks.get(workspacePath);
    if (inflight) {
      return await inflight;
    }

    this.setWorkspaceAvatarCatalogState(workspacePath, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.workspace.avatarCatalog
      .query({ workspacePath })
      .then((output) => {
        const data = sortWorkspaceAvatarCatalog(output.items);
        this.setWorkspaceAvatarCatalogState(workspacePath, (resource) => ({
          ...resource,
          data,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return data;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setWorkspaceAvatarCatalogState(workspacePath, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        this.workspaceAvatarCatalogRefreshTasks.delete(workspacePath);
      });

    this.workspaceAvatarCatalogRefreshTasks.set(workspacePath, task);
    return await task;
  }

  private ensureGlobalRoomsState(): CachedResourceState<GlobalRoomEntry[]> {
    return this.state.globalRooms;
  }

  private setGlobalRoomsState(
    updater: (current: CachedResourceState<GlobalRoomEntry[]>) => CachedResourceState<GlobalRoomEntry[]>,
  ): CachedResourceState<GlobalRoomEntry[]> {
    const next = updater(this.ensureGlobalRoomsState());
    this.state.globalRooms = next;
    return next;
  }

  private ensureGlobalRoomSnapshotState(chatId: string): CachedResourceState<GlobalRoomSnapshotOutput | null> {
    return (
      this.state.globalRoomSnapshotsById[chatId] ?? createCachedResourceState<GlobalRoomSnapshotOutput | null>(null)
    );
  }

  private setGlobalRoomSnapshotState(
    chatId: string,
    updater: (
      current: CachedResourceState<GlobalRoomSnapshotOutput | null>,
    ) => CachedResourceState<GlobalRoomSnapshotOutput | null>,
  ): CachedResourceState<GlobalRoomSnapshotOutput | null> {
    const next = updater(this.ensureGlobalRoomSnapshotState(chatId));
    this.state.globalRoomSnapshotsById[chatId] = next;
    return next;
  }

  private appendOptimisticGlobalRoomMessage(input: { chatId: string; text: string; clientMessageId: string }): void {
    this.setGlobalRoomSnapshotState(input.chatId, (resource) => {
      if (!resource.data) {
        return resource;
      }
      const now = Date.now();
      const optimisticMessage: GlobalRoomMessage = {
        rowId: Number.MAX_SAFE_INTEGER,
        messageId: Number.MAX_SAFE_INTEGER,
        chatId: input.chatId,
        sourceSystemId: resource.data.channel.createdBySystemId,
        from: "You",
        kind: "text",
        content: input.text,
        createdAt: now,
        updatedAt: now,
        readContactIds: [],
        unreadContactIds: [],
        clientMessageId: input.clientMessageId,
        metadata: { optimistic: true },
      };
      return {
        ...resource,
        data: {
          ...resource.data,
          items: mergeGlobalRoomMessages(resource.data.items, [optimisticMessage]),
        },
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private getPendingOptimisticGlobalRoomMessages(chatId: string): GlobalRoomMessage[] {
    const snapshot = this.state.globalRoomSnapshotsById[chatId]?.data;
    if (!snapshot) {
      return [];
    }
    return snapshot.items.filter((message) => message.metadata?.optimistic === true);
  }

  private ensureGlobalRoomGrantsState(chatId: string): CachedResourceState<GlobalRoomGrantEntry[]> {
    return this.state.globalRoomGrantsById[chatId] ?? createCachedResourceState<GlobalRoomGrantEntry[]>([]);
  }

  private setGlobalRoomGrantsState(
    chatId: string,
    updater: (current: CachedResourceState<GlobalRoomGrantEntry[]>) => CachedResourceState<GlobalRoomGrantEntry[]>,
  ): CachedResourceState<GlobalRoomGrantEntry[]> {
    const next = updater(this.ensureGlobalRoomGrantsState(chatId));
    this.state.globalRoomGrantsById[chatId] = next;
    return next;
  }

  private ensureGlobalRoomAssetsState(chatId: string): CachedResourceState<GlobalRoomAssetEntry[]> {
    return this.state.globalRoomAssetsById[chatId] ?? createCachedResourceState<GlobalRoomAssetEntry[]>([]);
  }

  private setGlobalRoomAssetsState(
    chatId: string,
    updater: (current: CachedResourceState<GlobalRoomAssetEntry[]>) => CachedResourceState<GlobalRoomAssetEntry[]>,
  ): CachedResourceState<GlobalRoomAssetEntry[]> {
    const next = updater(this.ensureGlobalRoomAssetsState(chatId));
    this.state.globalRoomAssetsById[chatId] = next;
    return next;
  }

  private resolveGlobalRoomEntry(chatId: string): GlobalRoomEntry | null {
    return this.state.globalRooms.data.find((room) => room.chatId === chatId) ?? null;
  }

  private reconcileGlobalRoomEntry(entry: GlobalRoomEntry): void {
    this.setGlobalRoomsState((resource) => {
      const nextData = resource.data.filter((candidate) => candidate.chatId !== entry.chatId);
      nextData.push(entry);
      return {
        ...resource,
        data: sortGlobalRooms(nextData),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
    this.setGlobalRoomSnapshotState(entry.chatId, (resource) => {
      if (!resource.loaded || !resource.data) {
        return resource;
      }
      return {
        ...resource,
        data: {
          ...resource.data,
          channel: entry,
        },
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private removeGlobalRoomEntry(chatId: string): void {
    this.setGlobalRoomsState((resource) => ({
      ...resource,
      data: resource.data.filter((candidate) => candidate.chatId !== chatId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
  }

  private resolveGlobalRoomSnapshotQuery(
    chatId: string,
    input: { accessToken?: string; limit?: number } = {},
  ): { accessToken?: string; limit?: number } {
    const previous = this.globalRoomSnapshotQueryById.get(chatId) ?? {};
    const fromCatalog = this.resolveGlobalRoomEntry(chatId);
    const next = {
      accessToken:
        normalizeOptionalAccessToken(input.accessToken) ??
        normalizeOptionalAccessToken(previous.accessToken) ??
        normalizeOptionalAccessToken(fromCatalog?.accessToken),
      limit: input.limit ?? previous.limit ?? 120,
    };
    this.globalRoomSnapshotQueryById.set(chatId, next);
    return next;
  }

  private shouldRefreshGlobalRoomSnapshot(chatId: string): boolean {
    const resource = this.state.globalRoomSnapshotsById[chatId];
    return Boolean(resource?.loaded || this.globalRoomSnapshotWatchCountById.has(chatId));
  }

  private shouldRefreshGlobalRoomGrants(chatId: string): boolean {
    const resource = this.state.globalRoomGrantsById[chatId];
    return Boolean(resource?.loaded || this.globalRoomGrantWatchCountById.has(chatId));
  }

  private shouldRefreshGlobalRoomAssets(chatId: string): boolean {
    const resource = this.state.globalRoomAssetsById[chatId];
    return Boolean(resource?.loaded || this.globalRoomAssetWatchCountById.has(chatId));
  }

  private sameGlobalRoomSnapshotQuery(
    left: { accessToken?: string; limit?: number },
    right: { accessToken?: string; limit?: number },
  ): boolean {
    return left.accessToken === right.accessToken && left.limit === right.limit;
  }

  private resolveGlobalRoomGrantQuery(chatId: string, input: { accessToken?: string } = {}): { accessToken?: string } {
    const previous = this.globalRoomGrantQueryById.get(chatId) ?? {};
    const fromCatalog = this.resolveGlobalRoomEntry(chatId);
    const next = {
      accessToken:
        normalizeOptionalAccessToken(input.accessToken) ??
        normalizeOptionalAccessToken(previous.accessToken) ??
        normalizeOptionalAccessToken(fromCatalog?.accessToken),
    };
    this.globalRoomGrantQueryById.set(chatId, next);
    return next;
  }

  private resolveGlobalRoomAssetQuery(chatId: string, input: { accessToken?: string } = {}): { accessToken?: string } {
    const previous = this.globalRoomAssetQueryById.get(chatId) ?? {};
    const fromCatalog = this.resolveGlobalRoomEntry(chatId);
    const next = {
      accessToken:
        normalizeOptionalAccessToken(input.accessToken) ??
        normalizeOptionalAccessToken(previous.accessToken) ??
        normalizeOptionalAccessToken(fromCatalog?.accessToken),
    };
    this.globalRoomAssetQueryById.set(chatId, next);
    return next;
  }

  private async refreshGlobalRoomsInternal(input: { force?: boolean } = {}): Promise<GlobalRoomEntry[]> {
    const current = this.ensureGlobalRoomsState();
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    if (this.globalRoomsRefreshTask) {
      return await this.globalRoomsRefreshTask;
    }

    this.setGlobalRoomsState((resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.message.globalList
      .query({ includeArchived: true })
      .then((output) => {
        const data = sortGlobalRooms(output.items);
        this.setGlobalRoomsState((resource) => ({
          ...resource,
          data,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return data;
      })
      .catch((error) => {
        const unauthorizedMessage = unauthorizedErrorMessage(error);
        if (unauthorizedMessage) {
          this.setGlobalRoomsState((resource) => ({
            ...resource,
            data: [],
            loaded: true,
            loading: false,
            refreshing: false,
            error: unauthorizedMessage,
            refreshedAt: Date.now(),
          }));
          this.emit();
          return [];
        }
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalRoomsState((resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        this.globalRoomsRefreshTask = null;
      });

    this.globalRoomsRefreshTask = task;
    return await task;
  }

  private async refreshGlobalRoomSnapshotInternal(
    chatId: string,
    input: { accessToken?: string; limit?: number; force?: boolean } = {},
  ): Promise<GlobalRoomSnapshotOutput | null> {
    const current = this.ensureGlobalRoomSnapshotState(chatId);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const query = this.resolveGlobalRoomSnapshotQuery(chatId, input);
    const inflight = this.globalRoomSnapshotRefreshTasks.get(chatId);
    if (!input.force && inflight && this.sameGlobalRoomSnapshotQuery(inflight.query, query)) {
      return await inflight.promise;
    }
    this.setGlobalRoomSnapshotState(chatId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.message.globalSnapshot
      .query({
        chatId,
        accessToken: query.accessToken,
        limit: query.limit,
      })
      .then((snapshot) => {
        const latest = this.globalRoomSnapshotRefreshTasks.get(chatId);
        if (latest?.promise !== task) {
          return snapshot;
        }
        const optimisticMessages = this.getPendingOptimisticGlobalRoomMessages(chatId);
        this.reconcileGlobalRoomEntry(snapshot.channel);
        this.setGlobalRoomSnapshotState(chatId, (resource) => ({
          ...resource,
          data: {
            ...snapshot,
            items: mergeGlobalRoomMessages(snapshot.items, optimisticMessages),
          },
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return snapshot;
      })
      .catch((error) => {
        const latest = this.globalRoomSnapshotRefreshTasks.get(chatId);
        if (latest?.promise !== task) {
          throw error;
        }
        const unauthorizedMessage = unauthorizedErrorMessage(error);
        if (unauthorizedMessage) {
          this.setGlobalRoomSnapshotState(chatId, (resource) => ({
            ...resource,
            data: null,
            loaded: true,
            loading: false,
            refreshing: false,
            error: unauthorizedMessage,
            refreshedAt: Date.now(),
          }));
          this.emit();
          return null;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalRoomSnapshotState(chatId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        const latest = this.globalRoomSnapshotRefreshTasks.get(chatId);
        if (latest?.promise === task) {
          this.globalRoomSnapshotRefreshTasks.delete(chatId);
        }
      });

    this.globalRoomSnapshotRefreshTasks.set(chatId, { promise: task, query });
    return await task;
  }

  private async refreshGlobalRoomGrantsInternal(
    chatId: string,
    input: { accessToken?: string; force?: boolean } = {},
  ): Promise<GlobalRoomGrantEntry[]> {
    const current = this.ensureGlobalRoomGrantsState(chatId);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const inflight = this.globalRoomGrantRefreshTasks.get(chatId);
    if (inflight) {
      return await inflight;
    }

    const query = this.resolveGlobalRoomGrantQuery(chatId, input);
    this.setGlobalRoomGrantsState(chatId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.message.globalListGrants
      .query({
        chatId,
        accessToken: query.accessToken,
      })
      .then((output) => {
        this.setGlobalRoomGrantsState(chatId, (resource) => ({
          ...resource,
          data: output.items,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return output.items;
      })
      .catch((error) => {
        const unauthorizedMessage = unauthorizedErrorMessage(error);
        if (unauthorizedMessage) {
          this.setGlobalRoomGrantsState(chatId, (resource) => ({
            ...resource,
            data: [],
            loaded: true,
            loading: false,
            refreshing: false,
            error: unauthorizedMessage,
            refreshedAt: Date.now(),
          }));
          this.emit();
          return [];
        }
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalRoomGrantsState(chatId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        this.globalRoomGrantRefreshTasks.delete(chatId);
      });

    this.globalRoomGrantRefreshTasks.set(chatId, task);
    return await task;
  }

  private async refreshGlobalRoomAssetsInternal(
    chatId: string,
    input: { accessToken?: string; force?: boolean } = {},
  ): Promise<GlobalRoomAssetEntry[]> {
    const current = this.ensureGlobalRoomAssetsState(chatId);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const query = this.resolveGlobalRoomAssetQuery(chatId, input);
    const inflight = this.globalRoomAssetRefreshTasks.get(chatId);
    if (inflight && inflight.query.accessToken === query.accessToken) {
      return await inflight.promise;
    }

    this.setGlobalRoomAssetsState(chatId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.message.globalListAssets
      .query({
        chatId,
        accessToken: query.accessToken,
      })
      .then((output) => {
        const data = sortGlobalRoomAssets(output.items.map((item) => this.normalizeGlobalRoomAssetEntry(item)));
        this.setGlobalRoomAssetsState(chatId, (resource) => ({
          ...resource,
          data,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return data;
      })
      .catch((error) => {
        const unauthorizedMessage = unauthorizedErrorMessage(error);
        if (unauthorizedMessage) {
          this.setGlobalRoomAssetsState(chatId, (resource) => ({
            ...resource,
            data: [],
            loaded: true,
            loading: false,
            refreshing: false,
            error: unauthorizedMessage,
            refreshedAt: Date.now(),
          }));
          this.emit();
          return [];
        }
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalRoomAssetsState(chatId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        const latest = this.globalRoomAssetRefreshTasks.get(chatId);
        if (latest?.promise === task) {
          this.globalRoomAssetRefreshTasks.delete(chatId);
        }
      });

    this.globalRoomAssetRefreshTasks.set(chatId, { promise: task, query });
    return await task;
  }

  private ensureGlobalTerminalsState(): CachedResourceState<GlobalTerminalEntry[]> {
    return this.state.globalTerminals;
  }

  private setGlobalTerminalsState(
    updater: (current: CachedResourceState<GlobalTerminalEntry[]>) => CachedResourceState<GlobalTerminalEntry[]>,
  ): CachedResourceState<GlobalTerminalEntry[]> {
    const next = updater(this.ensureGlobalTerminalsState());
    this.state.globalTerminals = next;
    return next;
  }

  private patchGlobalTerminalIndexEntry(
    terminalId: string,
    updater: (entry: GlobalTerminalEntry) => GlobalTerminalEntry,
  ): void {
    this.setGlobalTerminalIndexState((resource) => {
      const index = resource.data.findIndex((terminal) => terminal.terminalId === terminalId);
      if (index < 0) {
        return resource;
      }
      const data = [...resource.data];
      data[index] = updater(data[index]!);
      return {
        ...resource,
        data: sortGlobalTerminalIndexEntries(data),
        loaded: resource.loaded,
        loading: false,
        refreshing: resource.loading || resource.refreshing,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private ensureGlobalTerminalGrantsState(terminalId: string): CachedResourceState<GlobalTerminalGrantEntry[]> {
    return this.state.globalTerminalGrantsById[terminalId] ?? createCachedResourceState<GlobalTerminalGrantEntry[]>([]);
  }

  private setGlobalTerminalGrantsState(
    terminalId: string,
    updater: (
      current: CachedResourceState<GlobalTerminalGrantEntry[]>,
    ) => CachedResourceState<GlobalTerminalGrantEntry[]>,
  ): CachedResourceState<GlobalTerminalGrantEntry[]> {
    const next = updater(this.ensureGlobalTerminalGrantsState(terminalId));
    this.state.globalTerminalGrantsById[terminalId] = next;
    return next;
  }

  private ensureGlobalTerminalApprovalsState(terminalId: string): CachedResourceState<GlobalTerminalApprovalRequest[]> {
    return (
      this.state.globalTerminalApprovalsById[terminalId] ??
      createCachedResourceState<GlobalTerminalApprovalRequest[]>([])
    );
  }

  private setGlobalTerminalApprovalsState(
    terminalId: string,
    updater: (
      current: CachedResourceState<GlobalTerminalApprovalRequest[]>,
    ) => CachedResourceState<GlobalTerminalApprovalRequest[]>,
  ): CachedResourceState<GlobalTerminalApprovalRequest[]> {
    const next = updater(this.ensureGlobalTerminalApprovalsState(terminalId));
    this.state.globalTerminalApprovalsById[terminalId] = next;
    return next;
  }

  private ensureGlobalTerminalActivityState(terminalId: string): CachedResourceState<TerminalActivityItem[]> {
    return this.state.globalTerminalActivityById[terminalId] ?? createCachedResourceState<TerminalActivityItem[]>([]);
  }

  private setGlobalTerminalActivityState(
    terminalId: string,
    updater: (current: CachedResourceState<TerminalActivityItem[]>) => CachedResourceState<TerminalActivityItem[]>,
  ): CachedResourceState<TerminalActivityItem[]> {
    const next = updater(this.ensureGlobalTerminalActivityState(terminalId));
    this.state.globalTerminalActivityById[terminalId] = next;
    return next;
  }

  private projectTerminalActivityFact(item: TerminalActivityItem): void {
    this.setGlobalTerminalActivityState(item.terminalId, (resource) => {
      if (resource.data.some((candidate) => candidate.id === item.id)) {
        return resource;
      }
      const data = [...resource.data, item].sort((left, right) => {
        if (left.createdAt !== right.createdAt) {
          return left.createdAt - right.createdAt;
        }
        return left.id - right.id;
      });
      return {
        ...resource,
        data,
        loaded: true,
        loading: false,
        refreshing: resource.loading || resource.refreshing,
        error: null,
        refreshedAt: Date.now(),
      };
    });
    this.emit();
  }

  private projectGlobalTerminalLeaseFact(input: {
    terminalId: string;
    requestId: string;
    lease: {
      leaseId: string;
      participantId: string;
      expiresAt: number;
    };
  }): void {
    this.setGlobalTerminalApprovalsState(input.terminalId, (resource) => ({
      ...resource,
      data: resource.data.filter((request) => request.requestId !== input.requestId),
      loaded: true,
      loading: false,
      refreshing: resource.loading || resource.refreshing,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.setGlobalTerminalsState((resource) => ({
      ...resource,
      data: resource.data.map((terminal) => {
        if (terminal.terminalId !== input.terminalId) {
          return terminal;
        }
        return {
          ...terminal,
          pendingRequestCount: Math.max(0, (terminal.pendingRequestCount ?? 0) - 1),
          actors: (terminal.actors ?? []).map((actor) =>
            actor.actorId === input.lease.participantId
              ? {
                  ...actor,
                  leaseId: input.lease.leaseId,
                  leaseExpiresAt: input.lease.expiresAt,
                }
              : actor,
          ),
        };
      }),
      loaded: resource.loaded || resource.data.length > 0,
      loading: false,
      refreshing: resource.loading || resource.refreshing,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.patchGlobalTerminalIndexEntry(input.terminalId, (terminal) => ({
      ...terminal,
      pendingRequestCount: Math.max(0, (terminal.pendingRequestCount ?? 0) - 1),
      actors: (terminal.actors ?? []).map((actor) =>
        actor.actorId === input.lease.participantId
          ? {
              ...actor,
              leaseId: input.lease.leaseId,
              leaseExpiresAt: input.lease.expiresAt,
            }
          : actor,
      ),
    }));
    this.emit();
  }

  private resolveGlobalTerminalEntry(terminalId: string): GlobalTerminalEntry | null {
    return (
      this.state.globalTerminals.data.find((terminal) => terminal.terminalId === terminalId) ??
      this.state.globalTerminalIndex.data.find((terminal) => terminal.terminalId === terminalId) ??
      this.state.globalTerminalHistory.data.find((terminal) => terminal.terminalId === terminalId) ??
      this.state.globalTerminalArchive.data.find((terminal) => terminal.terminalId === terminalId) ??
      null
    );
  }

  private ensureGlobalTerminalHistoryState(): CachedResourceState<GlobalTerminalEntry[]> {
    return this.state.globalTerminalHistory;
  }

  private ensureGlobalTerminalIndexState(): CachedResourceState<GlobalTerminalEntry[]> {
    return this.state.globalTerminalIndex;
  }

  private ensureGlobalTerminalArchiveState(): CachedResourceState<GlobalTerminalEntry[]> {
    return this.state.globalTerminalArchive;
  }

  private setGlobalTerminalHistoryState(
    updater: (current: CachedResourceState<GlobalTerminalEntry[]>) => CachedResourceState<GlobalTerminalEntry[]>,
  ): CachedResourceState<GlobalTerminalEntry[]> {
    const next = updater(this.ensureGlobalTerminalHistoryState());
    this.state.globalTerminalHistory = next;
    return next;
  }

  private setGlobalTerminalIndexState(
    updater: (current: CachedResourceState<GlobalTerminalEntry[]>) => CachedResourceState<GlobalTerminalEntry[]>,
  ): CachedResourceState<GlobalTerminalEntry[]> {
    const next = updater(this.ensureGlobalTerminalIndexState());
    this.state.globalTerminalIndex = next;
    return next;
  }

  private setGlobalTerminalArchiveState(
    updater: (current: CachedResourceState<GlobalTerminalEntry[]>) => CachedResourceState<GlobalTerminalEntry[]>,
  ): CachedResourceState<GlobalTerminalEntry[]> {
    const next = updater(this.ensureGlobalTerminalArchiveState());
    this.state.globalTerminalArchive = next;
    return next;
  }

  private reconcileGlobalTerminalIndexEntry(entry: GlobalTerminalEntry): void {
    if (isArchivedProjectionTerminal(entry)) {
      this.removeGlobalTerminalIndexEntry(entry.terminalId);
      return;
    }
    this.setGlobalTerminalIndexState((resource) => {
      const nextData = [...resource.data];
      const index = nextData.findIndex((candidate) => candidate.terminalId === entry.terminalId);
      if (index >= 0) {
        nextData[index] = mergeGlobalTerminalEntry(nextData[index], entry);
      } else {
        nextData.unshift(entry);
      }
      return {
        ...resource,
        data: sortGlobalTerminalIndexEntries(nextData),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private removeGlobalTerminalIndexEntry(terminalId: string): void {
    this.setGlobalTerminalIndexState((resource) => ({
      ...resource,
      data: resource.data.filter((candidate) => candidate.terminalId !== terminalId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
  }

  private reconcileGlobalTerminalEntry(entry: GlobalTerminalEntry): void {
    if (isArchivedProjectionTerminal(entry)) {
      this.removeGlobalTerminalEntry(entry.terminalId);
      this.removeGlobalTerminalHistoryEntry(entry.terminalId);
      this.removeGlobalTerminalIndexEntry(entry.terminalId);
      this.reconcileGlobalTerminalArchiveEntry(entry);
      return;
    }
    this.setGlobalTerminalsState((resource) => {
      const nextData = [...resource.data];
      const index = nextData.findIndex((candidate) => candidate.terminalId === entry.terminalId);
      if (!isLiveProjectionTerminal(entry)) {
        if (index >= 0) {
          nextData.splice(index, 1);
        }
        return {
          ...resource,
          data: nextData,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        };
      }
      if (index >= 0) {
        nextData[index] = mergeGlobalTerminalEntry(nextData[index], entry);
      } else {
        nextData.unshift(entry);
      }
      return {
        ...resource,
        data: nextData,
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
    this.removeGlobalTerminalArchiveEntry(entry.terminalId);
    this.reconcileGlobalTerminalHistoryEntry(entry);
    this.reconcileGlobalTerminalIndexEntry(entry);
  }

  private removeGlobalTerminalEntry(terminalId: string): void {
    this.setGlobalTerminalsState((resource) => ({
      ...resource,
      data: resource.data.filter((candidate) => candidate.terminalId !== terminalId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
  }

  private reconcileGlobalTerminalHistoryEntry(entry: GlobalTerminalEntry): void {
    if (isArchivedProjectionTerminal(entry)) {
      this.removeGlobalTerminalHistoryEntry(entry.terminalId);
      this.reconcileGlobalTerminalArchiveEntry(entry);
      return;
    }
    this.setGlobalTerminalHistoryState((resource) => {
      const nextData = [...resource.data];
      const index = nextData.findIndex((candidate) => candidate.terminalId === entry.terminalId);
      if (!isHistoryProjectionTerminal(entry)) {
        if (index >= 0) {
          nextData.splice(index, 1);
        }
        return {
          ...resource,
          data: nextData,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        };
      }
      if (index >= 0) {
        nextData[index] = mergeGlobalTerminalEntry(nextData[index], entry);
      } else {
        nextData.unshift(entry);
      }
      return {
        ...resource,
        data: sortGlobalTerminalIndexEntries(nextData).filter(isHistoryProjectionTerminal),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private removeGlobalTerminalHistoryEntry(terminalId: string): void {
    this.setGlobalTerminalHistoryState((resource) => ({
      ...resource,
      data: resource.data.filter((candidate) => candidate.terminalId !== terminalId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
  }

  private reconcileGlobalTerminalArchiveEntry(entry: GlobalTerminalEntry): void {
    this.setGlobalTerminalArchiveState((resource) => {
      const nextData = [...resource.data];
      const index = nextData.findIndex((candidate) => candidate.terminalId === entry.terminalId);
      if (index >= 0) {
        nextData[index] = mergeGlobalTerminalEntry(nextData[index], entry);
      } else {
        nextData.unshift(entry);
      }
      return {
        ...resource,
        data: nextData,
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      };
    });
  }

  private removeGlobalTerminalArchiveEntry(terminalId: string): void {
    this.setGlobalTerminalArchiveState((resource) => ({
      ...resource,
      data: resource.data.filter((candidate) => candidate.terminalId !== terminalId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
  }

  private shouldRefreshGlobalTerminalGrants(terminalId: string): boolean {
    const resource = this.state.globalTerminalGrantsById[terminalId];
    return Boolean(resource?.loaded || this.globalTerminalGrantWatchCountById.has(terminalId));
  }

  private shouldRefreshGlobalTerminalApprovals(terminalId: string): boolean {
    const resource = this.state.globalTerminalApprovalsById[terminalId];
    return Boolean(resource?.loaded || this.globalTerminalApprovalWatchCountById.has(terminalId));
  }

  private shouldRefreshGlobalTerminalActivity(terminalId: string): boolean {
    const resource = this.state.globalTerminalActivityById[terminalId];
    return Boolean(resource?.loaded || this.globalTerminalActivityWatchCountById.has(terminalId));
  }

  private collectGlobalTerminalSurfaceRefreshes(input: {
    terminalIds?: string[];
    grants?: boolean;
    approvals?: boolean;
    activity?: boolean;
    catalog?: boolean;
    history?: boolean;
    index?: boolean;
    archive?: boolean;
    force?: boolean;
  }): Array<Promise<unknown>> {
    const refreshes: Array<Promise<unknown>> = [];
    const force = input.force ?? false;
    const terminalIds = [...new Set(input.terminalIds ?? [])];

    for (const terminalId of terminalIds) {
      if (input.grants && this.shouldRefreshGlobalTerminalGrants(terminalId)) {
        refreshes.push(
          this.hydrateGlobalTerminalGrants({
            terminalId,
            force,
          }),
        );
      }
      if (input.approvals && this.shouldRefreshGlobalTerminalApprovals(terminalId)) {
        refreshes.push(
          this.hydrateGlobalTerminalApprovals({
            terminalId,
            force,
          }),
        );
      }
      if (input.activity && this.shouldRefreshGlobalTerminalActivity(terminalId)) {
        refreshes.push(
          this.hydrateGlobalTerminalActivity({
            terminalId,
            force,
          }),
        );
      }
    }

    if (input.catalog && (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0)) {
      refreshes.push(this.hydrateGlobalTerminals({ force }));
    }
    if (input.history && (this.state.globalTerminalHistory.loaded || this.globalTerminalHistoryWatchCount > 0)) {
      refreshes.push(this.hydrateGlobalTerminalHistory({ force }));
    }
    if (input.index && (this.state.globalTerminalIndex.loaded || this.globalTerminalIndexWatchCount > 0)) {
      refreshes.push(this.hydrateGlobalTerminalIndex({ force }));
    }
    if (input.archive && (this.state.globalTerminalArchive.loaded || this.globalTerminalArchiveWatchCount > 0)) {
      refreshes.push(this.hydrateGlobalTerminalArchive({ force }));
    }

    return refreshes;
  }

  private async refreshGlobalTerminalSurface(input: {
    terminalIds?: string[];
    grants?: boolean;
    approvals?: boolean;
    activity?: boolean;
    catalog?: boolean;
    history?: boolean;
    index?: boolean;
    archive?: boolean;
    force?: boolean;
  }): Promise<void> {
    const refreshes = this.collectGlobalTerminalSurfaceRefreshes(input);
    if (refreshes.length === 0) {
      return;
    }
    await Promise.allSettled(refreshes);
  }

  private invalidateGlobalTerminalSurface(input: {
    terminalIds?: string[];
    grants?: boolean;
    approvals?: boolean;
    activity?: boolean;
    catalog?: boolean;
    history?: boolean;
    index?: boolean;
    archive?: boolean;
    force?: boolean;
  }): void {
    const refreshes = this.collectGlobalTerminalSurfaceRefreshes(input);
    if (refreshes.length === 0) {
      return;
    }
    void Promise.allSettled(refreshes).catch(() => undefined);
  }

  private async refreshGlobalTerminalsInternal(input: { force?: boolean } = {}): Promise<GlobalTerminalEntry[]> {
    const current = this.ensureGlobalTerminalsState();
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    if (!input.force && this.globalTerminalsRefreshTask) {
      return await this.globalTerminalsRefreshTask;
    }

    this.setGlobalTerminalsState((resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.terminal.globalList
      .query()
      .then((output) => {
        const liveItems = output.items.filter(isLiveProjectionTerminal);
        this.setGlobalTerminalsState((resource) => ({
          ...resource,
          data: liveItems.map((entry) =>
            mergeGlobalTerminalEntry(
              resource.data.find((candidate) => candidate.terminalId === entry.terminalId),
              entry,
            ),
          ),
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return liveItems;
      })
      .catch((error) => {
        const unauthorizedMessage = unauthorizedErrorMessage(error);
        if (unauthorizedMessage) {
          this.setGlobalTerminalsState((resource) => ({
            ...resource,
            data: [],
            loaded: true,
            loading: false,
            refreshing: false,
            error: unauthorizedMessage,
            refreshedAt: Date.now(),
          }));
          this.emit();
          return [];
        }
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalTerminalsState((resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        if (this.globalTerminalsRefreshTask === task) {
          this.globalTerminalsRefreshTask = null;
        }
      });

    this.globalTerminalsRefreshTask = task;
    return await task;
  }

  private async refreshGlobalTerminalGrantsInternal(
    terminalId: string,
    input: { force?: boolean } = {},
  ): Promise<GlobalTerminalGrantEntry[]> {
    const current = this.ensureGlobalTerminalGrantsState(terminalId);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const inflight = this.globalTerminalGrantRefreshTasks.get(terminalId);
    if (!input.force && inflight) {
      return await inflight;
    }

    this.setGlobalTerminalGrantsState(terminalId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.terminal.listGrants
      .query({ terminalId })
      .then((output) => {
        this.setGlobalTerminalGrantsState(terminalId, (resource) => ({
          ...resource,
          data: output.items,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return output.items;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalTerminalGrantsState(terminalId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        if (this.globalTerminalGrantRefreshTasks.get(terminalId) === task) {
          this.globalTerminalGrantRefreshTasks.delete(terminalId);
        }
      });

    this.globalTerminalGrantRefreshTasks.set(terminalId, task);
    return await task;
  }

  private async refreshGlobalTerminalApprovalsInternal(
    terminalId: string,
    input: { force?: boolean } = {},
  ): Promise<GlobalTerminalApprovalRequest[]> {
    const current = this.ensureGlobalTerminalApprovalsState(terminalId);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const inflight = this.globalTerminalApprovalRefreshTasks.get(terminalId);
    if (!input.force && inflight) {
      return await inflight;
    }

    this.setGlobalTerminalApprovalsState(terminalId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.terminal.listApprovalRequests
      .query({
        terminalId,
        statuses: ["pending"],
      })
      .then((output) => {
        this.setGlobalTerminalApprovalsState(terminalId, (resource) => ({
          ...resource,
          data: output.items,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return output.items;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalTerminalApprovalsState(terminalId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        if (this.globalTerminalApprovalRefreshTasks.get(terminalId) === task) {
          this.globalTerminalApprovalRefreshTasks.delete(terminalId);
        }
      });

    this.globalTerminalApprovalRefreshTasks.set(terminalId, task);
    return await task;
  }

  private async refreshGlobalTerminalActivityInternal(
    terminalId: string,
    input: { limit?: number; force?: boolean } = {},
  ): Promise<TerminalActivityItem[]> {
    const current = this.ensureGlobalTerminalActivityState(terminalId);
    const limit = input.limit ?? DEFAULT_GLOBAL_TERMINAL_ACTIVITY_LIMIT;
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const inflight = this.globalTerminalActivityRefreshTasks.get(terminalId);
    if (!input.force && inflight && inflight.limit === limit) {
      return await inflight.promise;
    }

    this.setGlobalTerminalActivityState(terminalId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.terminal.activityPage
      .query({
        terminalId,
        limit,
      })
      .then((output) => {
        const items = mergeTerminalActivityItems(current.data, output.items, limit);
        this.setGlobalTerminalActivityState(terminalId, (resource) => ({
          ...resource,
          data: items,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return items;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setGlobalTerminalActivityState(terminalId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        const latest = this.globalTerminalActivityRefreshTasks.get(terminalId);
        if (latest?.promise === task) {
          this.globalTerminalActivityRefreshTasks.delete(terminalId);
        }
      });

    this.globalTerminalActivityRefreshTasks.set(terminalId, { promise: task, limit });
    return await task;
  }

  private async refreshMessageChannelsInternal(
    sessionId: string,
    input: { force?: boolean } = {},
  ): Promise<MessageChannelEntry[]> {
    const handle = this.ensureSessionResourceHandle(sessionId);
    const current = this.ensureMessageChannelsState(sessionId);
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }
    const inflight = this.messageChannelRefreshTasks.get(handle);
    if (inflight) {
      return await inflight;
    }

    this.setMessageChannelsState(sessionId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    const task = this.client.trpc.message.listChannels
      .query({ sessionId, includeArchived: true })
      .then((output) => {
        this.setMessageChannelsState(sessionId, (resource) => ({
          ...resource,
          data: output.items,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return output.items;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setMessageChannelsState(sessionId, (resource) => ({
          ...resource,
          loading: false,
          refreshing: false,
          error: message,
        }));
        this.emit();
        throw error;
      })
      .finally(() => {
        this.messageChannelRefreshTasks.delete(handle);
      });

    this.messageChannelRefreshTasks.set(handle, task);
    return await task;
  }

  private terminalActivityKey(sessionId: string, terminalId: string): string {
    return `${sessionId}:${terminalId}`;
  }

  private toChatHistoryCursor(message: RuntimeChatMessage): HistoryPageCursor | null {
    const numericId = Number(message.id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return null;
    }
    return {
      beforeTimeMs: message.timestamp,
      beforeId: numericId,
    };
  }

  private toCycleHistoryCursor(cycle: RuntimeChatCycle): HistoryPageCursor | null {
    if (cycle.cycleId === null || cycle.cycleId <= 0) {
      return null;
    }
    return {
      beforeTimeMs: cycle.createdAt,
      beforeId: cycle.cycleId,
    };
  }

  private toRecordHistoryCursor(record: { id: number; createdAt: number }): HistoryPageCursor {
    return {
      beforeTimeMs: record.createdAt,
      beforeId: record.id,
    };
  }

  private toStartedAtHistoryCursor(record: { id: number; startedAt: number }): HistoryPageCursor {
    return {
      beforeTimeMs: record.startedAt,
      beforeId: record.id,
    };
  }

  private toTimestampHistoryCursor(record: { id: number; timestamp: number }): HistoryPageCursor {
    return {
      beforeTimeMs: record.timestamp,
      beforeId: record.id,
    };
  }

  private resolveBeforeCursor<T>(
    cursorMap: Map<string, HistoryCursorValue>,
    key: string,
    current: T[],
    resolveFromOldest: (item: T) => HistoryPageCursor | null,
  ): HistoryCursorValue | undefined {
    if (cursorMap.has(key)) {
      return cursorMap.get(key) ?? null;
    }
    const oldest = current[0];
    return oldest ? resolveFromOldest(oldest) : undefined;
  }

  private updateBeforeCursor(
    cursorMap: Map<string, HistoryCursorValue>,
    key: string,
    nextBefore: HistoryCursorValue,
  ): void {
    cursorMap.set(key, nextBefore ?? null);
  }

  private mergeAscendingByCursor<T>(
    current: T[],
    incoming: T[],
    resolveKey: (item: T) => string | number,
    resolveCursor: (item: T) => HistoryPageCursor | null,
  ): T[] {
    const entries = new Map<string | number, T>();
    for (const item of current) {
      entries.set(resolveKey(item), item);
    }
    for (const item of incoming) {
      entries.set(resolveKey(item), item);
    }
    return [...entries.values()].sort((left, right) => {
      const leftCursor = resolveCursor(left);
      const rightCursor = resolveCursor(right);
      if (leftCursor && rightCursor) {
        const byCursor = compareHistoryCursor(leftCursor, rightCursor);
        if (byCursor !== 0) {
          return byCursor;
        }
      }
      const leftKey = resolveKey(left);
      const rightKey = resolveKey(right);
      return String(leftKey).localeCompare(String(rightKey));
    });
  }

  private mergeHeartbeatGroups(
    current: HeartbeatGroupItem[],
    incoming: HeartbeatGroupItem[],
    limit: number,
  ): HeartbeatGroupItem[] {
    const entries = new Map<string, HeartbeatGroupItem>();
    for (const item of current) {
      entries.set(item.groupId, item);
    }
    for (const item of incoming) {
      const existing = entries.get(item.groupId);
      entries.set(item.groupId, existing ? mergeHeartbeatGroup(existing, item) : item);
    }
    const merged = [...entries.values()].sort((left, right) => {
      const byCursor = compareHistoryCursor(this.toRecordHistoryCursor(left), this.toRecordHistoryCursor(right));
      if (byCursor !== 0) {
        return byCursor;
      }
      return left.groupId.localeCompare(right.groupId);
    });
    return merged.length > limit ? merged.slice(-limit) : merged;
  }

  private resolveLiveHeartbeatGroupKind(
    sessionId: string,
    entry: HeartbeatPartItem,
  ): Extract<HeartbeatGroupItem["kind"], "call" | "compact"> | null {
    if (entry.scope !== "heartbeat_part" || entry.aiCallId === null) {
      return null;
    }
    const modelCall = this.state.modelCallsBySession[sessionId]?.find((item) => item.id === entry.aiCallId);
    if (modelCall?.kind === "compact") {
      return "compact";
    }
    return entry.parts.some((part) => part.partType === "compact") ? "compact" : "call";
  }

  private applyLiveHeartbeatPart(sessionId: string, entry: HeartbeatPartItem): void {
    const resource = this.state.heartbeatGroupsBySession[sessionId];
    if (!resource?.loaded) {
      return;
    }
    const aiCallId = entry.aiCallId;
    const kind = this.resolveLiveHeartbeatGroupKind(sessionId, entry);
    if (aiCallId === null || !kind) {
      return;
    }
    const groupId = `heartbeat-group:${kind}:${aiCallId}`;
    const existing =
      resource.data.find((group) => group.groupId === groupId) ??
      resource.data.find((group) => group.aiCallId === aiCallId && (group.kind === "call" || group.kind === "compact"));
    const items = mergeHeartbeatPartItems(existing?.items ?? [], [entry]);
    const updatedAt = items.reduce((latest, item) => Math.max(latest, item.updatedAt), existing?.updatedAt ?? 0);
    const nextGroup: HeartbeatGroupItem = {
      id: existing?.id ?? aiCallId * 10 + 1,
      groupId,
      kind,
      aiCallId,
      createdAt: items[0]?.createdAt ?? existing?.createdAt ?? entry.createdAt,
      updatedAt: Math.max(updatedAt, entry.updatedAt),
      isComplete: items.every((item) => item.isComplete),
      items,
    };
    this.setHeartbeatGroupsState(sessionId, (current) => ({
      ...current,
      data: this.mergeHeartbeatGroups(
        current.data.filter(
          (group) =>
            group.groupId === nextGroup.groupId ||
            group.aiCallId !== aiCallId ||
            (group.kind !== "call" && group.kind !== "compact"),
        ),
        [nextGroup],
        HEARTBEAT_GROUP_LRU_LIMIT,
      ),
    }));
  }

  private createOptimisticCycle(input: {
    text: string;
    clientMessageId: string;
    attachments?: UploadedSessionAsset[];
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
              type: attachment.kind,
              assetId: attachment.assetId,
              kind: attachment.kind,
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
    const focused = normalizeFocusedTerminalState(runtime);
    return {
      ...runtime,
      ...focused,
      terminalReads: runtime.terminalReads ?? {},
      chatMessages: runtime.chatMessages.map((message) => this.normalizeRuntimeChatMessage(message)),
      activeCycle: runtime.activeCycle ? this.normalizeRuntimeChatCycle(runtime.activeCycle) : null,
      attention: runtime.attention ? cloneRuntimeAttentionState(runtime.attention) : createEmptyAttentionState(),
      attentionDelivery: runtime.attentionDelivery
        ? cloneRuntimeAttentionDeliveryState(runtime.attentionDelivery)
        : createEmptyAttentionDeliveryState(),
      modelCapabilities: runtime.modelCapabilities ?? DEFAULT_MODEL_CAPABILITIES,
    };
  }

  private toDetachedSchedulerState(
    schedulerState: RuntimeSnapshotEntry["schedulerState"],
    status?: "stopped" | "paused" | "starting" | "running" | "error",
  ): RuntimeSnapshotEntry["schedulerState"] {
    if (!schedulerState || status !== "paused") {
      return null;
    }
    return {
      ...schedulerState,
      runtimeStatus: "paused",
      waitingReason: null,
      nextAutoWakeAt: null,
      backoffMs: 0,
      blockedReason: null,
    };
  }

  private applyNotificationSnapshot(snapshot: NotificationSnapshotOutput): void {
    this.state.notifications = snapshot.items;
    this.state.unreadBySession = snapshot.unreadBySession;
    this.state.unreadByBucket = snapshot.unreadByBucket;
  }

  private async refreshNotifications(): Promise<NotificationSnapshotOutput> {
    const snapshot = await this.client.trpc.notification.snapshot.query();
    this.applyNotificationSnapshot(snapshot);
    this.emit();
    return snapshot;
  }

  private setConnectionStatus(status: RuntimeClientState["connectionStatus"]): void {
    this.state = {
      ...this.state,
      connectionStatus: status,
      connected: status === "connected",
    };
  }

  private getBrowserOnlineState(): boolean | null {
    if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
      return null;
    }
    return navigator.onLine;
  }

  private resolveDisconnectedStatus(): RuntimeClientState["connectionStatus"] {
    return this.getBrowserOnlineState() === false ? "offline" : "reconnecting";
  }

  private getBrowserEventTarget(): {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  } | null {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function" ||
      typeof window.removeEventListener !== "function"
    ) {
      return null;
    }
    return {
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
    };
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private attachTransportSubscription(): void {
    if (this.transportUnsubscribe) {
      return;
    }
    this.transportUnsubscribe = this.client.subscribeTransport((event) => {
      this.handleTransportEvent(event);
    });
  }

  private detachTransportSubscription(): void {
    this.transportUnsubscribe?.();
    this.transportUnsubscribe = null;
  }

  private attachBrowserListeners(): void {
    const eventTarget = this.getBrowserEventTarget();
    if (this.browserListenersAttached || !eventTarget) {
      return;
    }
    eventTarget.addEventListener("online", this.handleBrowserOnline);
    eventTarget.addEventListener("offline", this.handleBrowserOffline);
    this.browserListenersAttached = true;
  }

  private detachBrowserListeners(): void {
    const eventTarget = this.getBrowserEventTarget();
    if (!this.browserListenersAttached || !eventTarget) {
      return;
    }
    eventTarget.removeEventListener("online", this.handleBrowserOnline);
    eventTarget.removeEventListener("offline", this.handleBrowserOffline);
    this.browserListenersAttached = false;
  }

  private readonly handleBrowserOnline = (): void => {
    if (!this.shouldReconnect) {
      return;
    }
    this.clearReconnectTimer();
    if (this.state.connectionStatus !== "connected") {
      this.setConnectionStatus("reconnecting");
      this.emit();
    }
    if (!this.connecting) {
      void this.connectOnce();
    }
  };

  private readonly handleBrowserOffline = (): void => {
    this.handleTransportLoss("offline");
  };

  private handleTransportEvent(event: AgenterTransportEvent): void {
    if (!this.shouldReconnect) {
      return;
    }
    if (event.type === "open") {
      this.clearReconnectTimer();
      if (!this.state.connected && !this.connecting) {
        void this.connectOnce();
      }
      return;
    }
    this.handleTransportLoss(event.type === "close" ? "close" : "error");
  }

  getState(): RuntimeClientState {
    return this.state;
  }

  async listSessions(): Promise<SessionEntry[]> {
    const output = await this.client.trpc.session.list.query();
    this.state = {
      ...this.state,
      sessions: sortSessions(output.sessions),
    };
    this.emit();
    return this.state.sessions;
  }

  getRuntime(sessionId: string): RuntimeSnapshotEntry | null {
    return this.state.runtimes[sessionId] ?? null;
  }

  getSchedulerState(sessionId: string): RuntimeSnapshotEntry["schedulerState"] | null {
    return this.getRuntime(sessionId)?.schedulerState ?? null;
  }

  getSchedulerContainment(sessionId: string): RuntimeSchedulerContainmentState | null {
    const scheduler = this.getSchedulerState(sessionId);
    if (!scheduler) {
      return null;
    }
    return {
      runtimeStatus: scheduler.runtimeStatus,
      waitingReason: scheduler.waitingReason,
      nextAutoWakeAt: scheduler.nextAutoWakeAt,
      backoffMs: scheduler.backoffMs,
      retryCount: scheduler.retryCount,
      blockedReason: scheduler.blockedReason,
      lastProgressAt: scheduler.lastProgressAt,
      lastError: scheduler.lastError,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    this.attachTransportSubscription();
    this.attachBrowserListeners();
    this.setConnectionStatus(this.getBrowserOnlineState() === false ? "offline" : "connecting");
    this.emit();
    await this.connectOnce();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.cancelPendingEmit();
    this.detachTransportSubscription();
    this.detachBrowserListeners();
    this.eventSub?.unsubscribe();
    this.eventSub = null;
    for (const stream of this.apiCallStreams.values()) {
      stream.sub?.unsubscribe();
    }
    this.apiCallStreams.clear();
    this.pauseRetainedTerminalPermissionRequestStreams();
    this.terminalPermissionRequestStreams.clear();
    this.schedulerLogsAccessBySession.clear();
    this.observabilityTracesAccessBySession.clear();
    this.apiCallsAccessBySession.clear();
    this.modelCallsAccessBySession.clear();
    this.requestAuxAccessBySession.clear();
    this.modelCallDeltasAccessBySession.clear();
    this.schedulerLogsBeforeCursorBySession.clear();
    this.observabilityTracesBeforeCursorBySession.clear();
    this.apiCallsBeforeCursorBySession.clear();
    this.heartbeatGroupsBeforeCursorBySession.clear();
    for (const timer of this.heartbeatGroupRefreshTimerBySession.values()) {
      clearTimeout(timer);
    }
    this.heartbeatGroupRefreshTimerBySession.clear();
    this.heartbeatGroupRefreshInFlightBySession.clear();
    this.heartbeatGroupRefreshPendingLimitBySession.clear();
    for (const timer of this.heartbeatRecordRefreshTimerBySession.values()) {
      clearTimeout(timer);
    }
    this.heartbeatRecordRefreshTimerBySession.clear();
    this.heartbeatRecordRefreshInFlightBySession.clear();
    this.modelCallsBeforeCursorBySession.clear();
    this.requestAuxBeforeCursorBySession.clear();
    this.chatBeforeCursorBySession.clear();
    this.chatCyclesBeforeCursorBySession.clear();
    this.terminalActivityBeforeCursorByKey.clear();
    this.sessionResourceHandles.clear();
    this.globalAvatarCatalogRefreshTask = null;
    this.globalAvatarCatalogWatchCount = 0;
    this.workspaceAvatarCatalogRefreshTasks.clear();
    this.workspaceAvatarCatalogWatchCountByPath.clear();
    this.globalRoomsRefreshTask = null;
    this.globalRoomsWatchCount = 0;
    this.globalRoomSnapshotRefreshTasks.clear();
    this.globalRoomSnapshotWatchCountById.clear();
    this.globalRoomSnapshotQueryById.clear();
    this.globalRoomGrantRefreshTasks.clear();
    this.globalRoomGrantWatchCountById.clear();
    this.globalRoomGrantQueryById.clear();
    this.globalRoomAssetRefreshTasks.clear();
    this.globalRoomAssetWatchCountById.clear();
    this.globalRoomAssetQueryById.clear();
    this.globalTerminalsRefreshTask = null;
    this.globalTerminalsWatchCount = 0;
    this.globalTerminalHistoryWatchCount = 0;
    this.globalTerminalIndexWatchCount = 0;
    this.globalTerminalArchiveWatchCount = 0;
    this.globalTerminalGrantRefreshTasks.clear();
    this.globalTerminalGrantWatchCountById.clear();
    this.globalTerminalApprovalRefreshTasks.clear();
    this.globalTerminalApprovalWatchCountById.clear();
    this.globalTerminalActivityRefreshTasks.clear();
    this.globalTerminalActivityWatchCountById.clear();
    this.setConnectionStatus("offline");
    this.emit();
    this.client.close();
  }

  private async connectOnce(): Promise<void> {
    if (this.connectTask) {
      await this.connectTask;
      return;
    }
    if (this.getBrowserOnlineState() === false) {
      this.setConnectionStatus("offline");
      this.emit();
      return;
    }
    this.connectTask = (async () => {
      this.connecting = true;
      if (this.state.connectionStatus !== "connected") {
        const nextStatus =
          this.reconnectAttempt > 0 || this.state.connectionStatus === "reconnecting" ? "reconnecting" : "connecting";
        this.setConnectionStatus(nextStatus);
        this.emit();
      }

      try {
        const connectSequence = ++this.connectSequence;
        const previousState = this.state;
        const [snapshot, recentWorkspaces, profileService] = await Promise.all([
          this.client.trpc.runtime.snapshot.query(),
          this.client.trpc.workspace.recent.query({ limit: 8 }),
          this.client.trpc.auth.service.query().catch(() => previousState.profileService),
        ]);
        const runtimes = Object.fromEntries(
          Object.entries(snapshot.runtimes).map(([sessionId, runtime]) => [
            sessionId,
            this.normalizeRuntimeEntry(runtime),
          ]),
        );
        const sessions = sortSessions(snapshot.sessions);
        const sessionIds = sessions.map((session) => session.id);
        this.state = {
          ...previousState,
          sessions,
          runtimes,
          profileService: profileService ?? previousState.profileService ?? null,
          lastEventId: snapshot.lastEventId,
          recentWorkspaces: recentWorkspaces.items,
          activityBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.activityState ?? previousState.activityBySession[sessionId] ?? "idle",
            ]),
          ),
          terminalSnapshotsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.terminalSnapshots ?? previousState.terminalSnapshotsBySession[sessionId] ?? {},
            ]),
          ),
          terminalReadsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.terminalReads ?? previousState.terminalReadsBySession[sessionId] ?? {},
            ]),
          ),
          chatsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]
                ? this.mergeChatMessages(
                    previousState.chatsBySession[sessionId] ?? [],
                    runtimes[sessionId].chatMessages ?? [],
                  )
                : (previousState.chatsBySession[sessionId] ?? []),
            ]),
          ),
          messageChannelsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.messageChannels
                ? createHydratedCachedResourceState(runtimes[sessionId].messageChannels)
                : (previousState.messageChannelsBySession[sessionId] ??
                  createCachedResourceState<MessageChannelEntry[]>([])),
            ]),
          ),
          chatCyclesBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.activeCycle
                ? this.mergeChatCycles(previousState.chatCyclesBySession[sessionId] ?? [], [
                    runtimes[sessionId].activeCycle,
                  ])
                : (previousState.chatCyclesBySession[sessionId] ?? []),
            ]),
          ),
          attentionBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.attention ??
                previousState.attentionBySession?.[sessionId] ??
                createEmptyAttentionState(),
            ]),
          ),
          attentionDeliveryBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.attentionDelivery ??
                previousState.attentionDeliveryBySession?.[sessionId] ??
                createEmptyAttentionDeliveryState(),
            ]),
          ),
          tasksBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.tasks ?? previousState.tasksBySession[sessionId] ?? [],
            ]),
          ),
          schedulerLogsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.schedulerLogsBySession[sessionId] ?? []]),
          ),
          observabilityTracesBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.observabilityTracesBySession[sessionId] ?? []]),
          ),
          apiCallsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.apiCallsBySession[sessionId] ?? []]),
          ),
          heartbeatGroupsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              previousState.heartbeatGroupsBySession[sessionId] ?? createCachedResourceState<HeartbeatGroupItem[]>([]),
            ]),
          ),
          heartbeatRecordsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              previousState.heartbeatRecordsBySession[sessionId] ??
                createCachedResourceState<HeartbeatRecordsPageOutput | null>(null),
            ]),
          ),
          heartbeatRecordDetailsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.heartbeatRecordDetailsBySession[sessionId] ?? {}]),
          ),
          modelCallsBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.modelCallsBySession[sessionId] ?? []]),
          ),
          requestAuxBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.requestAuxBySession[sessionId] ?? []]),
          ),
          modelCallDeltasBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.modelCallDeltasBySession?.[sessionId] ?? []]),
          ),
          terminalActivityBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [sessionId, previousState.terminalActivityBySession[sessionId] ?? {}]),
          ),
          apiCallRecordingBySession: Object.fromEntries(
            sessionIds.map((sessionId) => [
              sessionId,
              runtimes[sessionId]?.apiCallRecording ??
                previousState.apiCallRecordingBySession[sessionId] ?? {
                  enabled: false,
                  refCount: 0,
                },
            ]),
          ),
          workspaces: previousState.workspaces,
          globalAvatarCatalog: previousState.globalAvatarCatalog,
          workspaceAvatarCatalogByPath: previousState.workspaceAvatarCatalogByPath,
          globalRooms: previousState.globalRooms,
          globalRoomSnapshotsById: previousState.globalRoomSnapshotsById,
          globalRoomGrantsById: previousState.globalRoomGrantsById,
          globalTerminals: previousState.globalTerminals,
          globalTerminalHistory: previousState.globalTerminalHistory,
          globalTerminalIndex: previousState.globalTerminalIndex,
          globalTerminalArchive: previousState.globalTerminalArchive,
          globalTerminalGrantsById: previousState.globalTerminalGrantsById,
          globalTerminalApprovalsById: previousState.globalTerminalApprovalsById,
          globalTerminalActivityById: previousState.globalTerminalActivityById,
          notifications: previousState.notifications,
          unreadBySession: previousState.unreadBySession,
          unreadByBucket: previousState.unreadByBucket,
        };
        this.setConnectionStatus("connected");
        for (const session of sessions) {
          if (!runtimes[session.id] && (session.status === "stopped" || session.status === "paused")) {
            this.clearRuntimeState(session.id, session.status, this.state.attentionBySession?.[session.id]);
            continue;
          }
          this.ensureRuntimeScaffold(session.id, session.status);
        }

        this.reconnectAttempt = 0;
        this.clearReconnectTimer();

        this.eventSub?.unsubscribe();
        this.eventSub = this.subscribeRuntimeEvents(snapshot.lastEventId);
        this.restoreRetainedApiCallStreams();
        this.restoreRetainedTerminalPermissionRequestStreams();
        this.emit();
        if (previousState.globalAvatarCatalog.loaded || this.globalAvatarCatalogWatchCount > 0) {
          this.runBackgroundTask(this.hydrateGlobalAvatarCatalog({ force: true }));
        }
        for (const [workspacePath, resource] of Object.entries(previousState.workspaceAvatarCatalogByPath)) {
          if (!resource.loaded && !this.workspaceAvatarCatalogWatchCountByPath.has(workspacePath)) {
            continue;
          }
          this.runBackgroundTask(this.hydrateWorkspaceAvatarCatalog(workspacePath, { force: true }));
        }
        if (previousState.globalRooms.loaded || this.globalRoomsWatchCount > 0) {
          this.runBackgroundTask(this.hydrateGlobalRooms({ force: true }));
        }
        for (const [chatId, resource] of Object.entries(previousState.globalRoomSnapshotsById)) {
          if (!resource.loaded && !this.globalRoomSnapshotWatchCountById.has(chatId)) {
            continue;
          }
          this.runBackgroundTask(this.hydrateGlobalRoomSnapshot({ chatId, force: true }));
        }
        for (const [chatId, resource] of Object.entries(previousState.globalRoomGrantsById)) {
          if (!resource.loaded && !this.globalRoomGrantWatchCountById.has(chatId)) {
            continue;
          }
          this.runBackgroundTask(this.hydrateGlobalRoomGrants({ chatId, force: true }));
        }
        if (previousState.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
          this.runBackgroundTask(this.hydrateGlobalTerminals({ force: true }));
        }
        if (previousState.globalTerminalHistory.loaded || this.globalTerminalHistoryWatchCount > 0) {
          this.runBackgroundTask(this.hydrateGlobalTerminalHistory({ force: true }));
        }
        if (previousState.globalTerminalIndex.loaded || this.globalTerminalIndexWatchCount > 0) {
          this.runBackgroundTask(this.hydrateGlobalTerminalIndex({ force: true }));
        }
        if (previousState.globalTerminalArchive.loaded || this.globalTerminalArchiveWatchCount > 0) {
          this.runBackgroundTask(this.hydrateGlobalTerminalArchive({ force: true }));
        }
        for (const [terminalId, resource] of Object.entries(previousState.globalTerminalGrantsById)) {
          if (!resource.loaded && !this.globalTerminalGrantWatchCountById.has(terminalId)) {
            continue;
          }
          this.runBackgroundTask(this.hydrateGlobalTerminalGrants({ terminalId, force: true }));
        }
        for (const [terminalId, resource] of Object.entries(previousState.globalTerminalApprovalsById)) {
          if (!resource.loaded && !this.globalTerminalApprovalWatchCountById.has(terminalId)) {
            continue;
          }
          this.runBackgroundTask(this.hydrateGlobalTerminalApprovals({ terminalId, force: true }));
        }
        for (const [terminalId, resource] of Object.entries(previousState.globalTerminalActivityById)) {
          if (!resource.loaded && !this.globalTerminalActivityWatchCountById.has(terminalId)) {
            continue;
          }
          this.runBackgroundTask(this.hydrateGlobalTerminalActivity({ terminalId, force: true }));
        }

        const scheduleSecondaryChrome = (run: () => void) => {
          setTimeout(() => {
            if (connectSequence !== this.connectSequence || this.state.connectionStatus !== "connected") {
              return;
            }
            run();
          }, 0);
        };

        scheduleSecondaryChrome(() => {
          void this.client.trpc.workspace.listAll
            .query()
            .then((workspaces) => {
              if (connectSequence !== this.connectSequence || this.state.connectionStatus !== "connected") {
                return;
              }
              this.state.workspaces = workspaces.items;
              this.emit();
            })
            .catch(() => {
              // Keep the last known workspace chrome until the next refresh succeeds.
            });
        });

        scheduleSecondaryChrome(() => {
          void this.client.trpc.workspace.recent
            .query({ limit: 8 })
            .then((recent) => {
              if (connectSequence !== this.connectSequence || this.state.connectionStatus !== "connected") {
                return;
              }
              this.state.recentWorkspaces = recent.items;
              this.emit();
            })
            .catch(() => {
              // Keep the last known recent workspace chrome until the next refresh succeeds.
            });
        });

        scheduleSecondaryChrome(() => {
          void this.refreshNotifications()
            .then(() => {
              if (connectSequence !== this.connectSequence || this.state.connectionStatus !== "connected") {
                return;
              }
            })
            .catch(() => {
              // Keep the last known notification snapshot until the next refresh succeeds.
            });
        });
      } catch {
        this.handleTransportLoss("error");
      } finally {
        this.connecting = false;
        this.connectTask = null;
      }
    })();
    await this.connectTask;
  }

  private handleTransportLoss(_reason: "close" | "error" | "offline"): void {
    const nextStatus = this.resolveDisconnectedStatus();
    this.eventSub?.unsubscribe();
    this.eventSub = null;
    this.pauseRetainedApiCallStreams();
    this.pauseRetainedTerminalPermissionRequestStreams();
    if (nextStatus === "offline") {
      this.clearReconnectTimer();
    }
    if (this.state.connectionStatus !== nextStatus || this.state.connected) {
      this.setConnectionStatus(nextStatus);
      this.emit();
    }

    if (!this.shouldReconnect || nextStatus === "offline" || this.reconnectTimer) {
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

  async requestRuntimeCompact(sessionId: string): Promise<{ ok: boolean }> {
    return await this.client.trpc.runtime.requestCompact.mutate({ sessionId });
  }

  async abortSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.abort.mutate({ sessionId });
    this.upsertSession(result.session);
    delete this.state.messageChannelsBySession[sessionId];
    this.releaseSessionResourceHandle(sessionId);
    await this.hydrateRuntime(sessionId);
    await this.listAllWorkspaces();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.trpc.session.delete.mutate({ sessionId });
    this.state.attentionBySession ??= {};
    this.state.sessions = this.state.sessions.filter((item) => item.id !== sessionId);
    delete this.state.runtimes[sessionId];
    delete this.state.activityBySession[sessionId];
    delete this.state.terminalSnapshotsBySession[sessionId];
    delete this.state.terminalReadsBySession[sessionId];
    delete this.state.chatsBySession[sessionId];
    delete this.state.messageChannelsBySession[sessionId];
    delete this.state.chatCyclesBySession[sessionId];
    delete this.state.attentionBySession[sessionId];
    delete this.state.attentionDeliveryBySession[sessionId];
    delete this.state.tasksBySession[sessionId];
    delete this.state.schedulerLogsBySession[sessionId];
    delete this.state.observabilityTracesBySession[sessionId];
    delete this.state.apiCallsBySession[sessionId];
    delete this.state.heartbeatGroupsBySession[sessionId];
    delete this.state.heartbeatRecordsBySession[sessionId];
    delete this.state.heartbeatRecordDetailsBySession[sessionId];
    delete this.state.modelCallsBySession[sessionId];
    delete this.state.requestAuxBySession[sessionId];
    delete this.state.modelCallDeltasBySession?.[sessionId];
    delete this.state.terminalActivityBySession[sessionId];
    delete this.state.apiCallRecordingBySession[sessionId];
    this.schedulerLogsAccessBySession.delete(sessionId);
    this.observabilityTracesAccessBySession.delete(sessionId);
    this.apiCallsAccessBySession.delete(sessionId);
    this.modelCallsAccessBySession.delete(sessionId);
    this.requestAuxAccessBySession.delete(sessionId);
    this.modelCallDeltasAccessBySession.delete(sessionId);
    this.schedulerLogsBeforeCursorBySession.delete(sessionId);
    this.observabilityTracesBeforeCursorBySession.delete(sessionId);
    this.apiCallsBeforeCursorBySession.delete(sessionId);
    this.heartbeatGroupsBeforeCursorBySession.delete(sessionId);
    const heartbeatGroupRefreshTimer = this.heartbeatGroupRefreshTimerBySession.get(sessionId);
    if (heartbeatGroupRefreshTimer) {
      clearTimeout(heartbeatGroupRefreshTimer);
      this.heartbeatGroupRefreshTimerBySession.delete(sessionId);
    }
    this.heartbeatGroupRefreshInFlightBySession.delete(sessionId);
    this.heartbeatGroupRefreshPendingLimitBySession.delete(sessionId);
    this.clearHeartbeatRecordRefresh(sessionId);
    this.modelCallsBeforeCursorBySession.delete(sessionId);
    this.requestAuxBeforeCursorBySession.delete(sessionId);
    this.chatBeforeCursorBySession.delete(sessionId);
    this.chatCyclesBeforeCursorBySession.delete(sessionId);
    for (const key of [...this.terminalActivityBeforeCursorByKey.keys()]) {
      if (key.startsWith(`${sessionId}:`)) {
        this.terminalActivityBeforeCursorByKey.delete(key);
      }
    }
    this.releaseSessionResourceHandle(sessionId);
    this.emit();
    await this.listAllWorkspaces();
  }

  async archiveSession(sessionId: string): Promise<void> {
    const result = await this.client.trpc.session.archive.mutate({ sessionId });
    this.upsertSession(result.session);
    this.state.attentionBySession ??= {};
    delete this.state.runtimes[sessionId];
    delete this.state.activityBySession[sessionId];
    delete this.state.terminalSnapshotsBySession[sessionId];
    delete this.state.terminalReadsBySession[sessionId];
    delete this.state.messageChannelsBySession[sessionId];
    delete this.state.attentionBySession[sessionId];
    delete this.state.attentionDeliveryBySession[sessionId];
    this.releaseSessionResourceHandle(sessionId);
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

  getGlobalAvatarCatalogState(): CachedResourceState<GlobalAvatarCatalogEntry[]> {
    return this.ensureGlobalAvatarCatalogState();
  }

  retainGlobalAvatarCatalog(): () => void {
    this.globalAvatarCatalogWatchCount += 1;
    return () => {
      this.globalAvatarCatalogWatchCount = Math.max(0, this.globalAvatarCatalogWatchCount - 1);
    };
  }

  async hydrateGlobalAvatarCatalog(input: { force?: boolean } = {}): Promise<GlobalAvatarCatalogEntry[]> {
    return await this.refreshGlobalAvatarCatalogInternal(input);
  }

  async createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }): Promise<GlobalAvatarCatalogEntry> {
    const output = await this.client.trpc.avatar.create.mutate(input);
    this.reconcileGlobalAvatarCatalogEntry(output.avatar);
    this.emit();
    this.runBackgroundTask(this.hydrateGlobalAvatarCatalog({ force: true }));
    return output.avatar;
  }

  getWorkspaceAvatarCatalogState(workspacePath: string): CachedResourceState<WorkspaceAvatarCatalogEntry[]> {
    return this.ensureWorkspaceAvatarCatalogState(workspacePath);
  }

  retainWorkspaceAvatarCatalog(workspacePath: string): () => void {
    this.workspaceAvatarCatalogWatchCountByPath.set(
      workspacePath,
      (this.workspaceAvatarCatalogWatchCountByPath.get(workspacePath) ?? 0) + 1,
    );
    this.state.workspaceAvatarCatalogByPath[workspacePath] =
      this.state.workspaceAvatarCatalogByPath[workspacePath] ??
      createCachedResourceState<WorkspaceAvatarCatalogEntry[]>([]);
    return () => {
      const current = this.workspaceAvatarCatalogWatchCountByPath.get(workspacePath) ?? 0;
      if (current <= 1) {
        this.workspaceAvatarCatalogWatchCountByPath.delete(workspacePath);
        return;
      }
      this.workspaceAvatarCatalogWatchCountByPath.set(workspacePath, current - 1);
    };
  }

  async hydrateWorkspaceAvatarCatalog(
    workspacePath: string,
    input: { force?: boolean } = {},
  ): Promise<WorkspaceAvatarCatalogEntry[]> {
    return await this.refreshWorkspaceAvatarCatalogInternal(workspacePath, input);
  }

  async listWorkspaceAvatarCatalog(workspacePath: string): Promise<WorkspaceAvatarCatalogEntry[]> {
    return await this.hydrateWorkspaceAvatarCatalog(workspacePath, { force: true });
  }

  async forkWorkspaceAvatar(input: { workspacePath: string; avatar: string }) {
    const output = await this.client.trpc.workspace.forkAvatar.mutate(input);
    this.reconcileWorkspaceAvatarCatalogEntry(input.workspacePath, output.avatar);
    this.emit();
    this.runBackgroundTask(this.hydrateWorkspaceAvatarCatalog(input.workspacePath, { force: true }));
    return output.avatar;
  }

  async copyWorkspaceAvatar(input: { workspacePath: string; sourceAvatar: string; targetAvatar: string }) {
    const optimistic = this.insertOptimisticWorkspaceAvatarCopy(input);
    try {
      const output = await this.client.trpc.workspace.copyAvatar.mutate(input);
      this.reconcileWorkspaceAvatarCatalogEntry(input.workspacePath, output.avatar, optimistic.optimisticNickname);
      this.emit();
      this.runBackgroundTask(this.hydrateWorkspaceAvatarCatalog(input.workspacePath, { force: true }));
      return output.avatar;
    } catch (error) {
      if (optimistic.applied) {
        this.rollbackOptimisticWorkspaceAvatarCopy(input.workspacePath, optimistic.optimisticNickname);
        this.emit();
      }
      throw error;
    }
  }

  async inspectWorkspaceWelcome(input: { workspacePath: string; avatar?: string }) {
    return await this.client.trpc.workspace.welcomeSnapshot.query(input);
  }

  async listRuntimeWorkspaceMounts(runtimeId: string): Promise<RuntimeWorkspaceMountEntry[]> {
    const output = await this.client.trpc.workspace.runtimeMounts.query({ runtimeId });
    return output.items;
  }

  async listRuntimeWorkspaceGrants(input: {
    runtimeId: string;
    workspacePath: string;
  }): Promise<RuntimeWorkspaceGrantEntry[]> {
    const output = await this.client.trpc.workspace.runtimeGrants.query(input);
    return output.items;
  }

  async grantRuntimeWorkspace(input: {
    runtimeId: string;
    workspacePath: string;
    grants: Array<{ pattern: string; mode: "ro" | "rw" }>;
  }): Promise<RuntimeWorkspaceGrantEntry[]> {
    const output = await this.client.trpc.workspace.grantRuntime.mutate(input);
    return output.items;
  }

  async detachRuntimeWorkspace(input: { runtimeId: string; workspacePath: string }): Promise<{ detached: boolean }> {
    return await this.client.trpc.workspace.detachRuntime.mutate(input);
  }

  async getRuntimeWorkspaceAssetRoots(input: {
    workspacePath: string;
    avatar: string;
  }): Promise<RuntimeWorkspaceAssetRootsOutput> {
    return await this.client.trpc.workspace.assetRoots.query(input);
  }

  async listSkillCatalog(input: {
    rootKind: "builtin" | "shared" | "global" | "skills-home";
  }): Promise<SkillCatalogOutput> {
    return await this.client.trpc.skill.catalog.query(input);
  }

  async listSkillAvatarCatalog(): Promise<SkillAvatarCatalogOutput> {
    return await this.client.trpc.skill.avatarCatalog.query();
  }

  async listSkillCatalogTree(input: {
    rootKind: "builtin" | "shared" | "global" | "skills-home";
    name: string;
    path?: string;
    offset?: number;
    limit?: number;
  }): Promise<SkillTreeOutput> {
    return await this.client.trpc.skill.catalogTree.query(input);
  }

  async readSkillCatalogPreview(input: {
    rootKind: "builtin" | "shared" | "global" | "skills-home";
    name: string;
    path: string;
    maxBytes?: number;
  }): Promise<SkillPreviewOutput> {
    return await this.client.trpc.skill.catalogPreview.query(input);
  }

  async listSkillAvatarTree(input: {
    avatarNickname: string;
    workspacePath: string;
    name: string;
    path?: string;
    offset?: number;
    limit?: number;
  }): Promise<SkillAvatarTreeOutput> {
    return await this.client.trpc.skill.avatarTree.query(input);
  }

  async readSkillAvatarPreview(input: {
    avatarNickname: string;
    workspacePath: string;
    name: string;
    path: string;
    maxBytes?: number;
  }): Promise<SkillAvatarPreviewOutput> {
    return await this.client.trpc.skill.avatarPreview.query(input);
  }

  async addMcpGlobal(input: McpAddInput): Promise<McpAddOutput> {
    return await this.client.trpc.mcp.add.mutate(input);
  }

  async removeMcpGlobal(input: McpRemoveInput): Promise<McpRemoveOutput> {
    return await this.client.trpc.mcp.remove.mutate(input);
  }

  async enableMcpProject(input: McpEnableInput): Promise<McpEnableOutput> {
    return await this.client.trpc.mcp.enable.mutate(input);
  }

  async disableMcpProject(input: McpDisableInput): Promise<McpDisableOutput> {
    return await this.client.trpc.mcp.disable.mutate(input);
  }

  async listMcpProject(input: McpListInput): Promise<McpListOutput> {
    return await this.client.trpc.mcp.list.query(input);
  }

  async queryMcp(input: McpQueryInput): Promise<McpQueryOutput> {
    return await this.client.trpc.mcp.query.query(input);
  }

  async startMcpProject(input: McpStartInput): Promise<McpStartOutput> {
    return await this.client.trpc.mcp.start.mutate(input);
  }

  async stopMcpProject(input: McpStopInput): Promise<McpStopOutput> {
    return await this.client.trpc.mcp.stop.mutate(input);
  }

  async restartMcpProject(input: McpRestartInput): Promise<McpRestartOutput> {
    return await this.client.trpc.mcp.restart.mutate(input);
  }

  async callMcpTool(input: McpCallInput): Promise<McpCallOutput> {
    return await this.client.trpc.mcp.invoke.mutate(input);
  }

  async listNoteCatalog(input: { avatarNickname?: string; limit?: number } = {}): Promise<NoteCatalogOutput> {
    return await this.client.trpc.note.catalog.query(input);
  }

  async readNotePage(input: {
    avatarNickname?: string;
    notebook: string;
    section: string;
    page: string;
  }): Promise<NotePageOutput> {
    return await this.client.trpc.note.page.query(input);
  }

  async searchNotes(input: {
    avatarNickname?: string;
    query?: string;
    limit?: number;
    tags?: readonly string[];
  }): Promise<NoteSearchOutput> {
    return await this.client.trpc.note.search.query({ ...input, tags: input.tags ? [...input.tags] : undefined });
  }

  async listNoteTags(
    input: { avatarNickname?: string; notebook?: string; section?: string } = {},
  ): Promise<NoteTagsOutput> {
    return await this.client.trpc.note.tags.query(input);
  }

  async queryNotes(input: { avatarNickname?: string; sql: string; limit?: number }): Promise<NoteSqlQueryOutput> {
    return await this.client.trpc.note.query.query(input);
  }

  async renameNotePages(input: {
    avatarNickname?: string;
    notebook: string;
    section: string;
    page?: string;
    toNotebook?: string;
    toSection?: string;
    toPage?: string;
  }): Promise<NoteRenameOutput> {
    return await this.client.trpc.note.rename.mutate(input);
  }

  async writeNotePage(input: {
    avatarNickname?: string;
    notebook: string;
    section: string;
    page: string;
    content?: string;
    contentFile?: string;
    mode?: "append" | "override";
    mime: string;
    tags?: readonly string[];
    references?: readonly NoteReferenceInput[];
  }): Promise<NoteWriteOutput> {
    return await this.client.trpc.note.write.mutate({
      ...input,
      tags: input.tags ? [...input.tags] : undefined,
      references: input.references ? [...input.references] : undefined,
    });
  }

  async readWorkspaceCliCatalog(input: { workspacePath: string; avatar: string }): Promise<WorkspaceCliCatalogOutput> {
    return await this.client.trpc.workspace.cliCatalog.query(input);
  }

  async listWorkspaceWorkbenchTree(input: {
    workspacePath: string;
    avatar: string;
    mode: "explorer" | "private";
    path?: string;
    offset?: number;
    limit?: number;
  }): Promise<WorkspaceWorkbenchTreeOutput> {
    return await this.client.trpc.workspace.workbenchTree.query(input);
  }

  async readWorkspaceWorkbenchPreview(input: {
    workspacePath: string;
    avatar: string;
    mode: "explorer" | "private";
    path: string;
    maxBytes?: number;
  }): Promise<WorkspaceWorkbenchPreviewOutput> {
    return await this.client.trpc.workspace.workbenchPreview.query(input);
  }

  async createWorkspacePrivateAsset(input: {
    workspacePath: string;
    avatar: string;
    parentPath?: string;
    name: string;
    kind: "file" | "directory";
  }): Promise<{ path: string }> {
    return await this.client.trpc.workspace.createPrivateAsset.mutate(input);
  }

  async ensureWorkspacePrivateTextAsset(input: {
    workspacePath: string;
    avatarNickname: string;
    assetKind: "skills" | "memory" | "tools" | "archive";
    relativePath: string;
    seedContent: string;
  }): Promise<WorkspacePrivateTextAssetEnsureOutput> {
    return await this.client.trpc.workspace.ensurePrivateTextAsset.mutate(input);
  }

  async execRuntimeWorkspace(input: {
    runtimeId: string;
    workspacePath: string;
    avatar: string;
    surface?: "root-workspace" | "public-workspace";
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }): Promise<RuntimeWorkspaceExecOutput> {
    return await this.client.trpc.workspace.exec.mutate(input);
  }

  async saveWorkspaceAvatarRoomSeat(input: {
    workspacePath: string;
    avatar: string;
    chatId: string;
    accessToken: string;
    accessRole: "admin" | "member" | "readonly";
    state?: "active" | "credential-invalid";
  }) {
    return await this.client.trpc.workspace.saveAvatarRoomSeat.mutate(input);
  }

  async saveWorkspaceAvatarTerminalSeat(input: {
    workspacePath: string;
    avatar: string;
    terminalId: string;
    accessToken: string;
    accessRole: "admin" | "writer" | "guard" | "readonly";
    state?: "active" | "credential-invalid";
  }) {
    return await this.client.trpc.workspace.saveAvatarTerminalSeat.mutate(input);
  }

  async inspectAttentionState(sessionId: string): Promise<RuntimeAttentionState> {
    return await this.client.trpc.runtime.attentionState.query({ sessionId });
  }

  async inspectAttentionDeliveryState(sessionId: string): Promise<RuntimeAttentionDeliveryState> {
    return await this.client.trpc.runtime.attentionDeliveryState.query({ sessionId });
  }

  async queryAttentionDeliveryTimeline(input: {
    sessionId: string;
    contextId?: string;
    commitId?: string;
    cycleId?: number;
    sessionModelCallId?: number;
    limit?: number;
  }): Promise<RuntimeAttentionDeliveryState> {
    return await this.client.trpc.runtime.attentionDeliveryTimeline.query(input);
  }

  async queryAttention(input: {
    sessionId: string;
    query: string;
    offset?: number;
    limit?: number;
  }): Promise<AttentionQueryItem[]> {
    const output = await this.client.trpc.runtime.attentionQuery.query(input);
    return output.items;
  }

  async commitAttention(input: {
    sessionId: string;
    contextId: string;
    summary?: string;
    body?: string;
    done?: boolean;
    scores?: Record<string, number>;
    meta?: Record<string, unknown>;
  }) {
    return await this.client.trpc.runtime.attentionCommit.mutate(input);
  }

  async settleAttention(input: {
    sessionId: string;
    contextId: string;
    summary?: string;
    body?: string;
    scores?: Record<string, number>;
    reason?: string;
    meta?: Record<string, unknown>;
  }) {
    return await this.client.trpc.runtime.attentionSettle.mutate(input);
  }

  async queryUsageAnalytics(input: RuntimeUsageAnalyticsInput): Promise<RuntimeUsageAnalyticsOutput> {
    return await this.client.trpc.runtime.usageAnalytics.query(input);
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

  async uploadSessionAssets(sessionId: string, files: File[]): Promise<UploadedSessionAsset[]> {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
    }
    const authToken = this.client.getAuthToken();
    if (!authToken) {
      throw new Error("auth token required");
    }
    const response = await fetch(this.resolveHttpUrl(`/api/sessions/${encodeURIComponent(sessionId)}/assets`), {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      body: form,
    });
    const payload = (await response.json()) as {
      ok: boolean;
      items?: UploadedSessionAsset[];
      error?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `asset upload failed (${response.status})`);
    }
    return (payload.items ?? []).map((item) => ({
      ...item,
      url: this.resolveMediaUrl(item.url),
    }));
  }

  async uploadRoomAssets(chatId: string, accessToken: string, files: File[]): Promise<GlobalRoomAssetEntry[]> {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
    }
    const authToken = this.client.getAuthToken();
    if (!authToken) {
      throw new Error("auth token required");
    }
    const response = await fetch(this.resolveHttpUrl(`/api/rooms/${encodeURIComponent(chatId)}/assets`), {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "x-agenter-room-access-token": accessToken,
      },
      body: form,
    });
    const payload = (await response.json()) as {
      ok: boolean;
      items?: GlobalRoomAssetEntry[];
      error?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `room asset upload failed (${response.status})`);
    }
    const items = sortGlobalRoomAssets((payload.items ?? []).map((item) => this.normalizeGlobalRoomAssetEntry(item)));
    if (items.length > 0) {
      this.setGlobalRoomAssetsState(chatId, (resource) => {
        const mergedById = new Map(resource.data.map((asset) => [asset.assetId, asset]));
        for (const item of items) {
          mergedById.set(item.assetId, item);
        }
        return {
          ...resource,
          data: sortGlobalRoomAssets([...mergedById.values()]),
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        };
      });
      this.emit();
    }
    return items;
  }

  sessionIconUrl(sessionId: string): string | null {
    return this.buildProfileServiceUrl(`/media/sessions/${encodeURIComponent(sessionId)}/icon`);
  }

  avatarIconUrl(principalId: string): string | null {
    return this.buildProfileServiceUrl(`/media/avatars/${encodeURIComponent(principalId)}/icon`);
  }

  roomIconUrl(roomId: string): string | null {
    return this.buildProfileServiceUrl(`/media/rooms/${encodeURIComponent(roomId)}/icon`);
  }

  async uploadSessionIcon(sessionId: string, file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
    const response = await fetch(
      await this.resolveProfileServiceUrl(`/sessions/${encodeURIComponent(sessionId)}/icon`),
      {
        method: "POST",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
        body: file,
      },
    );
    const payload = (await response.json()) as { ok: boolean; url?: string; iconUrl?: string; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `session icon upload failed (${response.status})`);
    }
    return {
      ok: true,
      url: payload.url ?? payload.iconUrl,
    };
  }

  async uploadRoomIcon(roomId: string, file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
    const response = await fetch(await this.resolveProfileServiceUrl(`/rooms/${encodeURIComponent(roomId)}/icon`), {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });
    const payload = (await response.json()) as { ok: boolean; url?: string; iconUrl?: string; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `room icon upload failed (${response.status})`);
    }
    return {
      ok: true,
      url: payload.url ?? payload.iconUrl,
    };
  }

  profileIconUrl(reference: string): string | null {
    return this.buildProfileServiceUrl(`/media/profiles/${encodeURIComponent(reference)}/icon`);
  }

  async uploadProfileIcon(
    reference: string,
    file: File,
    token?: string,
  ): Promise<{ ok: boolean; url?: string; error?: string }> {
    const authorizationToken = token ?? this.client.getAuthToken();
    if (!authorizationToken) {
      throw new Error("auth token required");
    }
    const response = await fetch(
      await this.resolveProfileServiceUrl(`/profiles/${encodeURIComponent(reference)}/icon`),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${authorizationToken}`,
          "content-type": file.type || "application/octet-stream",
        },
        body: file,
      },
    );
    const payload = (await response.json()) as { ok: boolean; url?: string; iconUrl?: string; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `profile icon upload failed (${response.status})`);
    }
    return {
      ok: true,
      url: payload.url ?? payload.iconUrl,
    };
  }

  private async resolveFocusedMessageChannel(sessionId: string): Promise<MessageChannelEntry> {
    const channels = await this.ensureMessageChannels(sessionId);
    const focused = channels.filter((channel) => channel.focused && channel.accessToken);
    if (focused.length !== 1) {
      throw new Error("room must be specified");
    }
    return focused[0];
  }

  // File-truth law: session-local user input may reuse explicit message focus,
  // but it may not invent a room from session identity alone.
  async sendFocusedMessageChannel(
    sessionId: string,
    text: string,
    assetIds: string[] = [],
    attachments: UploadedSessionAsset[] = [],
  ): Promise<MessageSendSuccessOutput> {
    const channel = await this.resolveFocusedMessageChannel(sessionId);
    return await this.sendMessageChannel(
      {
        sessionId,
        chatId: channel.chatId,
        accessToken: channel.accessToken!,
        text,
        assetIds,
      },
      attachments,
    );
  }

  async ensureMessageChannels(sessionId: string): Promise<MessageChannelEntry[]> {
    return await this.refreshMessageChannelsInternal(sessionId, { force: false });
  }

  async refreshMessageChannels(sessionId: string): Promise<MessageChannelEntry[]> {
    return await this.refreshMessageChannelsInternal(sessionId, { force: true });
  }

  async listMessageChannels(
    sessionId: string,
    input: {
      includeArchived?: boolean;
    } = {},
  ): Promise<MessageChannelEntry[]> {
    if (input.includeArchived) {
      const output = await this.client.trpc.message.listChannels.query({
        sessionId,
        includeArchived: true,
      });
      return output.items as MessageChannelEntry[];
    }
    return await this.refreshMessageChannels(sessionId);
  }

  async createMessageChannel(input: {
    sessionId: string;
    kind: "room";
    title?: string;
    participants?: Array<{ id: string; label?: string }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): Promise<MessageChannelEntry> {
    const output = await this.client.trpc.message.createChannel.mutate(input);
    this.setMessageChannelsState(input.sessionId, (resource) => ({
      ...resource,
      data: resource.data.some((item) => item.chatId === output.channel.chatId)
        ? resource.data.map((item) => (item.chatId === output.channel.chatId ? output.channel : item))
        : [...resource.data, output.channel],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    return output.channel;
  }

  async focusMessageChannels(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<MessageChannelEntry[]> {
    const output = await this.client.trpc.message.focus.mutate(input);
    this.setMessageChannelsState(input.sessionId, (resource) => ({
      ...resource,
      data: output.items,
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    return output.items;
  }

  async sendMessageChannel(
    input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      text: string;
      assetIds?: string[];
    },
    attachments: UploadedSessionAsset[] = [],
  ): Promise<MessageSendSuccessOutput> {
    const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previousCycles = this.state.chatCyclesBySession[input.sessionId] ?? [];
    this.state.chatCyclesBySession[input.sessionId] = this.mergeChatCycles(previousCycles, [
      this.createOptimisticCycle({
        text: input.text,
        clientMessageId,
        attachments,
      }),
    ]);
    this.emit();
    try {
      const result = await this.client.trpc.message.send.mutate({
        sessionId: input.sessionId,
        chatId: input.chatId,
        accessToken: input.accessToken,
        text: input.text,
        assetIds: input.assetIds,
        clientMessageId,
      });
      if (!result.ok) {
        throw new Error(result.reason ?? "message send failed");
      }
      return result;
    } catch (error) {
      this.state.chatCyclesBySession[input.sessionId] = previousCycles;
      this.emit();
      throw error;
    }
  }

  async editMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    messageId: number;
    text: string;
  }): Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number }> {
    return await this.client.trpc.message.edit.mutate(input);
  }

  async recallMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    messageId: number;
  }): Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number; recalledAt?: number }> {
    return await this.client.trpc.message.recall.mutate(input);
  }

  async sendMessageChannelError(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    content: string;
    error: {
      title?: string;
      code?: string;
      detail?: string;
    };
  }): Promise<void> {
    const result = await this.client.trpc.message.sendError.mutate(input);
    if (!result.ok) {
      throw new Error(result.reason ?? "message error send failed");
    }
  }

  async sendMessageChannelInteractive(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    content: string;
    interactive: {
      version: "v1";
      kind: "form";
      title: string;
      description?: string;
      submitLabel?: string;
      fields: Array<{
        id: string;
        label: string;
        placeholder?: string;
        required?: boolean;
        multiline?: boolean;
        initialValue?: string;
      }>;
    };
  }): Promise<void> {
    const result = await this.client.trpc.message.sendInteractive.mutate(input);
    if (!result.ok) {
      throw new Error(result.reason ?? "message interactive send failed");
    }
  }

  async updateMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string }>;
      metadata?: Record<string, unknown>;
    };
  }): Promise<MessageChannelEntry> {
    const output = await this.client.trpc.message.updateChannel.mutate(input);
    this.setMessageChannelsState(input.sessionId, (resource) => ({
      ...resource,
      data: resource.data.map((item) => (item.chatId === output.channel.chatId ? output.channel : item)),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    return output.channel;
  }

  async listMessageChannelGrants(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }): Promise<MessageChannelGrantEntry[]> {
    const output = await this.client.trpc.message.listChannelGrants.query(input);
    return output.items;
  }

  async issueMessageChannelGrant(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
    accessTokenHint?: string;
  }) {
    const output = await this.client.trpc.message.issueChannelGrant.mutate(input);
    return output.grant;
  }

  async archiveMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    archivedBy?: string;
  }): Promise<MessageChannelEntry> {
    const output = await this.client.trpc.message.archiveChannel.mutate(input);
    this.setMessageChannelsState(input.sessionId, (resource) => ({
      ...resource,
      data: resource.data.filter((item) => item.chatId !== output.channel.chatId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    return output.channel;
  }

  async deleteMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }): Promise<MessageChannelEntry> {
    const output = await this.client.trpc.message.deleteChannel.mutate(input);
    this.setMessageChannelsState(input.sessionId, (resource) => ({
      ...resource,
      data: resource.data.filter((item) => item.chatId !== output.channel.chatId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    return output.channel;
  }

  async revokeMessageChannelGrant(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    grantId: string;
  }): Promise<{ ok: boolean }> {
    return await this.client.trpc.message.revokeChannelGrant.mutate(input);
  }

  getGlobalRoomsState(): CachedResourceState<GlobalRoomEntry[]> {
    return this.ensureGlobalRoomsState();
  }

  retainGlobalRooms(): () => void {
    this.globalRoomsWatchCount += 1;
    return () => {
      this.globalRoomsWatchCount = Math.max(0, this.globalRoomsWatchCount - 1);
    };
  }

  async hydrateGlobalRooms(input: { force?: boolean } = {}): Promise<GlobalRoomEntry[]> {
    return await this.refreshGlobalRoomsInternal(input);
  }

  async listGlobalRooms(input: { includeArchived?: boolean } = {}): Promise<GlobalRoomEntry[]> {
    if (input.includeArchived) {
      const output = await this.client.trpc.message.globalList.query(input);
      return sortGlobalRooms(output.items);
    }
    return await this.hydrateGlobalRooms({ force: true });
  }

  getGlobalRoomSnapshotState(chatId: string): CachedResourceState<GlobalRoomSnapshotOutput | null> {
    return this.ensureGlobalRoomSnapshotState(chatId);
  }

  retainGlobalRoomSnapshot(chatId: string): () => void {
    this.globalRoomSnapshotWatchCountById.set(chatId, (this.globalRoomSnapshotWatchCountById.get(chatId) ?? 0) + 1);
    this.state.globalRoomSnapshotsById[chatId] =
      this.state.globalRoomSnapshotsById[chatId] ?? createCachedResourceState<GlobalRoomSnapshotOutput | null>(null);
    return () => {
      const current = this.globalRoomSnapshotWatchCountById.get(chatId) ?? 0;
      if (current <= 1) {
        this.globalRoomSnapshotWatchCountById.delete(chatId);
        return;
      }
      this.globalRoomSnapshotWatchCountById.set(chatId, current - 1);
    };
  }

  async hydrateGlobalRoomSnapshot(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
    force?: boolean;
  }): Promise<GlobalRoomSnapshotOutput | null> {
    return await this.refreshGlobalRoomSnapshotInternal(input.chatId, input);
  }

  getGlobalRoomAssetsState(chatId: string): CachedResourceState<GlobalRoomAssetEntry[]> {
    return this.ensureGlobalRoomAssetsState(chatId);
  }

  retainGlobalRoomAssets(chatId: string): () => void {
    this.globalRoomAssetWatchCountById.set(chatId, (this.globalRoomAssetWatchCountById.get(chatId) ?? 0) + 1);
    this.state.globalRoomAssetsById[chatId] =
      this.state.globalRoomAssetsById[chatId] ?? createCachedResourceState<GlobalRoomAssetEntry[]>([]);
    return () => {
      const current = this.globalRoomAssetWatchCountById.get(chatId) ?? 0;
      if (current <= 1) {
        this.globalRoomAssetWatchCountById.delete(chatId);
        return;
      }
      this.globalRoomAssetWatchCountById.set(chatId, current - 1);
    };
  }

  async hydrateGlobalRoomAssets(input: {
    chatId: string;
    accessToken?: string;
    force?: boolean;
  }): Promise<GlobalRoomAssetEntry[]> {
    return await this.refreshGlobalRoomAssetsInternal(input.chatId, input);
  }

  async listGlobalRoomAssets(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomAssetEntry[]> {
    return await this.refreshGlobalRoomAssetsInternal(input.chatId, {
      accessToken: input.accessToken,
      force: true,
    });
  }

  async createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    participants?: Array<{ id: string; label?: string }>;
    initialUsers?: Array<{
      contactId: GlobalRoomActorId;
      label?: string;
      role: "admin" | "member" | "readonly";
      focused?: boolean;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalCreate.mutate({
      kind: "room",
      ...input,
    });
    this.reconcileGlobalRoomEntry(output.channel);
    this.emit();
    return output.channel;
  }

  async focusGlobalRooms(input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }): Promise<{ ok: boolean; message: string; focusedChatIds: string[] }> {
    const channels = input.channels.map((channel) => ({
      ...channel,
      accessToken: normalizeOptionalAccessToken(channel.accessToken),
    }));
    const output = await this.client.trpc.message.globalFocus.mutate({
      ...input,
      channels,
    });
    for (const channel of channels) {
      if (!this.shouldRefreshGlobalRoomSnapshot(channel.chatId)) {
        continue;
      }
      this.runBackgroundTask(
        this.hydrateGlobalRoomSnapshot({
          chatId: channel.chatId,
          force: true,
        }),
      );
    }
    return output;
  }

  async snapshotGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
  }): Promise<GlobalRoomSnapshotOutput> {
    const snapshot = await this.refreshGlobalRoomSnapshotInternal(input.chatId, {
      ...input,
      force: true,
    });
    if (!snapshot) {
      const state = this.ensureGlobalRoomSnapshotState(input.chatId);
      if (state.error === AUTH_REQUIRED_MESSAGE) {
        throw new Error(AUTH_REQUIRED_MESSAGE);
      }
      throw new Error(`global room snapshot missing: ${input.chatId}`);
    }
    return snapshot;
  }

  async markGlobalRoomRead(input: {
    chatId: string;
    accessToken?: string;
    messageId?: number;
  }): Promise<GlobalRoomEntry> {
    const accessToken = normalizeOptionalAccessToken(input.accessToken);
    const key = buildGlobalRoomReadInflightKey({
      chatId: input.chatId,
      accessToken,
      messageId: input.messageId,
    });
    const inflight = this.globalRoomReadMutations.get(key);
    if (inflight) {
      return await inflight;
    }
    const promise = (async () => {
      const output = await this.client.trpc.message.globalMarkRead.mutate({
        ...input,
        accessToken,
      });
      const shouldRefreshSnapshot = this.shouldRefreshGlobalRoomSnapshot(input.chatId);
      this.reconcileGlobalRoomEntry(output.channel);
      if (shouldRefreshSnapshot) {
        await this.refreshGlobalRoomSnapshotInternal(input.chatId, {
          accessToken,
          force: true,
        });
      } else {
        this.setGlobalRoomSnapshotState(input.chatId, (resource) => {
          if (!resource.loaded || !resource.data) {
            return resource;
          }
          return {
            ...resource,
            data: {
              ...resource.data,
              channel: output.channel,
            },
            error: null,
            refreshedAt: Date.now(),
          };
        });
      }
      this.emit();
      return output.channel;
    })().finally(() => {
      this.globalRoomReadMutations.delete(key);
    });
    this.globalRoomReadMutations.set(key, promise);
    return await promise;
  }

  async pageGlobalRoomMessages(input: {
    chatId: string;
    accessToken?: string;
    before?: HistoryPageCursor | null;
    limit?: number;
  }): Promise<{
    items: GlobalRoomMessage[];
    hasMore: boolean;
    nextBefore: HistoryPageCursor | null;
    roomRevision: string;
    transcriptRevision: string;
    headVersion: string;
  }> {
    const output = await this.client.trpc.message.globalPage.query({
      chatId: input.chatId,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
      before: input.before ?? undefined,
      limit: input.limit,
    });
    return {
      items: output.items,
      hasMore: output.hasMoreBefore,
      nextBefore: output.nextBefore,
      roomRevision: output.roomRevision,
      transcriptRevision: output.transcriptRevision,
      headVersion: output.headVersion,
    };
  }

  async sendGlobalRoomMessage(input: {
    chatId: string;
    accessToken?: string;
    sendAsActorId?: GlobalRoomActorId;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const clientMessageId = input.clientMessageId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.appendOptimisticGlobalRoomMessage({
      chatId: input.chatId,
      text: input.text,
      clientMessageId,
    });
    this.emit();
    return await this.client.trpc.message.globalSend.mutate({
      ...input,
      clientMessageId,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
    });
  }

  async editGlobalRoomMessage(input: {
    chatId: string;
    accessToken?: string;
    messageId: number;
    text: string;
  }): Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number }> {
    return await this.client.trpc.message.globalEdit.mutate({
      ...input,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
    });
  }

  async recallGlobalRoomMessage(input: {
    chatId: string;
    accessToken?: string;
    messageId: number;
  }): Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number; recalledAt?: number }> {
    return await this.client.trpc.message.globalRecall.mutate({
      ...input,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
    });
  }

  async updateGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string }>;
      metadata?: Record<string, unknown>;
      adminGroupCandidateIds?: GlobalRoomActorId[];
    };
  }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalUpdate.mutate({
      ...input,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
    });
    this.reconcileGlobalRoomEntry(output.channel);
    this.emit();
    return output.channel;
  }

  async archiveGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
    archivedBy?: string;
  }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalArchive.mutate({
      ...input,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
    });
    this.reconcileGlobalRoomEntry(output.channel);
    this.setGlobalRoomSnapshotState(output.channel.chatId, (resource) => ({
      ...resource,
      data: resource.data
        ? {
            ...resource.data,
            channel: output.channel,
          }
        : resource.data,
      loaded: resource.loaded,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    return output.channel;
  }

  async deleteGlobalRoom(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalDelete.mutate({
      ...input,
      accessToken: normalizeOptionalAccessToken(input.accessToken),
    });
    this.removeGlobalRoomEntry(output.channel.chatId);
    this.setGlobalRoomSnapshotState(output.channel.chatId, (resource) => ({
      ...resource,
      data: null,
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.setGlobalRoomGrantsState(output.channel.chatId, (resource) => ({
      ...resource,
      data: [],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.setGlobalRoomAssetsState(output.channel.chatId, (resource) => ({
      ...resource,
      data: [],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.globalRoomAssetQueryById.delete(output.channel.chatId);
    this.globalRoomAssetRefreshTasks.delete(output.channel.chatId);
    this.emit();
    return output.channel;
  }

  getGlobalRoomGrantsState(chatId: string): CachedResourceState<GlobalRoomGrantEntry[]> {
    return this.ensureGlobalRoomGrantsState(chatId);
  }

  retainGlobalRoomGrants(chatId: string): () => void {
    this.globalRoomGrantWatchCountById.set(chatId, (this.globalRoomGrantWatchCountById.get(chatId) ?? 0) + 1);
    this.state.globalRoomGrantsById[chatId] =
      this.state.globalRoomGrantsById[chatId] ?? createCachedResourceState<GlobalRoomGrantEntry[]>([]);
    return () => {
      const current = this.globalRoomGrantWatchCountById.get(chatId) ?? 0;
      if (current <= 1) {
        this.globalRoomGrantWatchCountById.delete(chatId);
        return;
      }
      this.globalRoomGrantWatchCountById.set(chatId, current - 1);
    };
  }

  async hydrateGlobalRoomGrants(input: {
    chatId: string;
    accessToken?: string;
    force?: boolean;
  }): Promise<GlobalRoomGrantEntry[]> {
    return await this.refreshGlobalRoomGrantsInternal(input.chatId, input);
  }

  async listGlobalRoomGrants(input: { chatId: string; accessToken?: string }): Promise<GlobalRoomGrantEntry[]> {
    return await this.refreshGlobalRoomGrantsInternal(input.chatId, {
      accessToken: normalizeOptionalAccessToken(input.accessToken),
      force: true,
    });
  }

  async issueGlobalRoomGrant(input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    participantId: GlobalRoomActorId;
    label?: string;
    accessTokenHint?: string;
  }): Promise<GlobalRoomGrantIssueOutput["grant"]> {
    const accessToken = normalizeOptionalAccessToken(input.accessToken);
    const output = await this.client.trpc.message.globalIssueGrant.mutate({
      ...input,
      accessToken,
    });
    this.setGlobalRoomGrantsState(input.chatId, (resource) => ({
      ...resource,
      data: resource.data.filter((grant) => grant.grantId !== output.grant.grantId).concat(output.grant),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    this.runBackgroundTask(
      this.hydrateGlobalRoomSnapshot({
        chatId: input.chatId,
        accessToken,
        force: true,
      }),
    );
    return output.grant;
  }

  async revokeGlobalRoomGrant(input: {
    chatId: string;
    accessToken?: string;
    grantId: string;
  }): Promise<{ ok: boolean }> {
    const accessToken = normalizeOptionalAccessToken(input.accessToken);
    const output = await this.client.trpc.message.globalRevokeGrant.mutate({
      ...input,
      accessToken,
    });
    this.setGlobalRoomGrantsState(input.chatId, (resource) => ({
      ...resource,
      data: resource.data.filter((grant) => grant.grantId !== input.grantId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    this.runBackgroundTask(
      this.hydrateGlobalRoomSnapshot({
        chatId: input.chatId,
        accessToken,
        force: true,
      }),
    );
    return output;
  }

  async listTerminals(sessionId: string): Promise<
    Array<{
      terminalId: string;
      processKind: string;
      command: string[];
      launchCwd: string;
      workspace: string | null;
      status: "IDLE" | "BUSY";
      processPhase: "not_started" | "running" | "killed";
      seq: number;
      focused: boolean;
      icon?: string;
      configuredTitle?: string;
      currentTitle?: string;
      currentPath?: string;
      shortcuts?: Record<string, string>;
      transportUrl?: string;
    }>
  > {
    const output = await this.client.trpc.terminal.list.query({ sessionId });
    return output.items;
  }

  async createTerminal(input: {
    sessionId: string;
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: unknown }> {
    const output = await this.client.trpc.terminal.create.mutate(input);
    await this.hydrateRuntime(input.sessionId);
    this.emit();
    return output.result;
  }

  async focusTerminals(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    const output = await this.client.trpc.terminal.focus.mutate(input);
    await this.hydrateRuntime(input.sessionId);
    this.emit();
    return output;
  }

  async deleteTerminal(input: { sessionId: string; terminalId: string }): Promise<{ ok: boolean; message: string }> {
    const output = await this.client.trpc.terminal.delete.mutate(input);
    await this.hydrateRuntime(input.sessionId);
    this.emit();
    return output;
  }

  getGlobalTerminalsState(): CachedResourceState<GlobalTerminalEntry[]> {
    return this.ensureGlobalTerminalsState();
  }

  retainGlobalTerminals(): () => void {
    this.globalTerminalsWatchCount += 1;
    return () => {
      this.globalTerminalsWatchCount = Math.max(0, this.globalTerminalsWatchCount - 1);
    };
  }

  retainGlobalTerminalHistory(): () => void {
    this.globalTerminalHistoryWatchCount += 1;
    return () => {
      this.globalTerminalHistoryWatchCount = Math.max(0, this.globalTerminalHistoryWatchCount - 1);
    };
  }

  retainGlobalTerminalIndex(): () => void {
    this.globalTerminalIndexWatchCount += 1;
    return () => {
      this.globalTerminalIndexWatchCount = Math.max(0, this.globalTerminalIndexWatchCount - 1);
    };
  }

  retainGlobalTerminalArchive(): () => void {
    this.globalTerminalArchiveWatchCount += 1;
    return () => {
      this.globalTerminalArchiveWatchCount = Math.max(0, this.globalTerminalArchiveWatchCount - 1);
    };
  }

  async hydrateGlobalTerminals(input: { force?: boolean } = {}): Promise<GlobalTerminalEntry[]> {
    return await this.refreshGlobalTerminalsInternal(input);
  }

  async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
    return await this.hydrateGlobalTerminals({ force: true });
  }

  async hydrateGlobalTerminalHistory(input: { force?: boolean } = {}): Promise<GlobalTerminalEntry[]> {
    const current = this.ensureGlobalTerminalHistoryState();
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }

    this.setGlobalTerminalHistoryState((resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.terminal.globalHistory.query();
      const historyItems = output.items.filter(isHistoryProjectionTerminal);
      this.setGlobalTerminalHistoryState((resource) => ({
        ...resource,
        data: sortGlobalTerminalIndexEntries(
          historyItems.map((entry) =>
            mergeGlobalTerminalEntry(
              resource.data.find((candidate) => candidate.terminalId === entry.terminalId),
              entry,
            ),
          ),
        ).filter(isHistoryProjectionTerminal),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
      return historyItems;
    } catch (error) {
      const unauthorizedMessage = unauthorizedErrorMessage(error);
      if (unauthorizedMessage) {
        this.setGlobalTerminalHistoryState((resource) => ({
          ...resource,
          data: [],
          loaded: true,
          loading: false,
          refreshing: false,
          error: unauthorizedMessage,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return [];
      }
      const message = error instanceof Error ? error.message : String(error);
      this.setGlobalTerminalHistoryState((resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: message,
      }));
      this.emit();
      throw error;
    }
  }

  async listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]> {
    return await this.hydrateGlobalTerminalHistory({ force: true });
  }

  async hydrateGlobalTerminalIndex(input: { force?: boolean } = {}): Promise<GlobalTerminalEntry[]> {
    const current = this.ensureGlobalTerminalIndexState();
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }

    this.setGlobalTerminalIndexState((resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.terminal.globalIndex.query();
      const indexItems = output.items.filter(
        (entry) => isLiveProjectionTerminal(entry) || isHistoryProjectionTerminal(entry),
      );
      this.setGlobalTerminalIndexState((resource) => ({
        ...resource,
        data: sortGlobalTerminalIndexEntries(
          indexItems.map((entry) =>
            mergeGlobalTerminalEntry(
              resource.data.find((candidate) => candidate.terminalId === entry.terminalId),
              entry,
            ),
          ),
        ),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
      return indexItems;
    } catch (error) {
      const unauthorizedMessage = unauthorizedErrorMessage(error);
      if (unauthorizedMessage) {
        this.setGlobalTerminalIndexState((resource) => ({
          ...resource,
          data: [],
          loaded: true,
          loading: false,
          refreshing: false,
          error: unauthorizedMessage,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return [];
      }
      const message = error instanceof Error ? error.message : String(error);
      this.setGlobalTerminalIndexState((resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: message,
      }));
      this.emit();
      throw error;
    }
  }

  async listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]> {
    return await this.hydrateGlobalTerminalIndex({ force: true });
  }

  async hydrateGlobalTerminalArchive(input: { force?: boolean } = {}): Promise<GlobalTerminalEntry[]> {
    const current = this.ensureGlobalTerminalArchiveState();
    if (!input.force && current.loaded && !current.refreshing && !current.loading) {
      return current.data;
    }

    this.setGlobalTerminalArchiveState((resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.terminal.globalArchiveList.query();
      const archiveItems = output.items.filter(isArchivedProjectionTerminal);
      this.setGlobalTerminalArchiveState((resource) => ({
        ...resource,
        data: archiveItems.map((entry) =>
          mergeGlobalTerminalEntry(
            resource.data.find((candidate) => candidate.terminalId === entry.terminalId),
            entry,
          ),
        ),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
      return archiveItems;
    } catch (error) {
      const unauthorizedMessage = unauthorizedErrorMessage(error);
      if (unauthorizedMessage) {
        this.setGlobalTerminalArchiveState((resource) => ({
          ...resource,
          data: [],
          loaded: true,
          loading: false,
          refreshing: false,
          error: unauthorizedMessage,
          refreshedAt: Date.now(),
        }));
        this.emit();
        return [];
      }
      const message = error instanceof Error ? error.message : String(error);
      this.setGlobalTerminalArchiveState((resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: message,
      }));
      this.emit();
      throw error;
    }
  }

  async listGlobalTerminalArchive(): Promise<GlobalTerminalEntry[]> {
    return await this.hydrateGlobalTerminalArchive({ force: true });
  }

  async createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    metadata?: Record<string, unknown>;
    start?: boolean;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const output = await this.client.trpc.terminal.globalCreate.mutate(input);
    if (output.result.terminal) {
      this.reconcileGlobalTerminalEntry(output.result.terminal);
      this.emit();
    }
    return output.result;
  }

  async bootstrapGlobalTerminal(input: {
    terminalId: string;
    recoveryIntent?: "killed-history";
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const output = await this.client.trpc.terminal.globalBootstrap.mutate(input);
    if (output.result.terminal) {
      this.reconcileGlobalTerminalEntry(output.result.terminal);
      this.emit();
    }
    return output.result;
  }

  async stopGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }> {
    const output = await this.client.trpc.terminal.globalStop.mutate(input);
    if (output.result.ok) {
      this.invalidateGlobalTerminalSurface({
        catalog: true,
        history: true,
        index: true,
        force: true,
      });
    }
    return output.result;
  }

  async archiveGlobalTerminal(input: { terminalId: string }): Promise<GlobalTerminalEntry> {
    const output = await this.client.trpc.terminal.globalArchive.mutate(input);
    this.removeGlobalTerminalEntry(input.terminalId);
    this.removeGlobalTerminalHistoryEntry(input.terminalId);
    this.removeGlobalTerminalIndexEntry(input.terminalId);
    this.reconcileGlobalTerminalArchiveEntry(output.terminal);
    this.emit();
    return output.terminal;
  }

  async focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    const output = await this.client.trpc.terminal.globalFocus.mutate(input);
    this.invalidateGlobalTerminalSurface({
      catalog: true,
      index: true,
      force: true,
    });
    return output;
  }

  async deleteGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }> {
    const output = await this.client.trpc.terminal.globalDelete.mutate(input);
    if (output.ok) {
      this.removeGlobalTerminalEntry(input.terminalId);
      this.removeGlobalTerminalHistoryEntry(input.terminalId);
      this.removeGlobalTerminalIndexEntry(input.terminalId);
      this.removeGlobalTerminalArchiveEntry(input.terminalId);
      this.setGlobalTerminalGrantsState(input.terminalId, (resource) => ({
        ...resource,
        data: [],
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.setGlobalTerminalApprovalsState(input.terminalId, (resource) => ({
        ...resource,
        data: [],
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.setGlobalTerminalActivityState(input.terminalId, (resource) => ({
        ...resource,
        data: [],
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
    }
    return output;
  }

  async readGlobalTerminal(input: {
    terminalId: string;
    accessToken?: string;
    mode?: "auto" | "diff" | "snapshot";
    remark?: boolean;
    recordActivity?: boolean;
  }) {
    const output = await this.client.trpc.terminal.read.query(input);
    const readSummary = projectTerminalReadActivitySummary(output);
    const readFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) && typeof output.eventId === "number"
        ? ({
            id: output.eventId,
            terminalId: output.terminalId,
            createdAt: Date.now(),
            kind: "terminal_read",
            cycleId: null,
            actorId: output.readCursor?.readerActorId,
            title: "Terminal read",
            content: readSummary?.content ?? "Terminal read",
            detail: readSummary?.detail ?? { representation: output.representation },
          } satisfies TerminalActivityItem)
        : null;
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      activity: true,
      force: true,
    });
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    return output;
  }

  async writeGlobalTerminal(input: {
    terminalId: string;
    accessToken?: string;
    text: string;
    createApprovalRequest?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
    readRecordActivity?: boolean;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  }) {
    const output = await this.client.trpc.terminal.write.mutate(input);
    const readSummary = projectTerminalReadActivitySummary(output.read);
    const writeFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) && typeof output.eventId === "number"
        ? ({
            id: output.eventId,
            terminalId: input.terminalId,
            createdAt: Date.now(),
            kind: "terminal_write",
            cycleId: null,
            actorId: undefined,
            title: "Terminal write",
            content: input.text,
            detail: {
              mode: "raw",
            },
          } satisfies TerminalActivityItem)
        : null;
    const readFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) &&
      output.read &&
      typeof output.read === "object" &&
      typeof output.read.eventId === "number"
        ? ({
            id: output.read.eventId,
            terminalId: output.read.terminalId,
            createdAt: Date.now(),
            kind: "terminal_read",
            cycleId: null,
            actorId: output.read.readCursor?.readerActorId,
            title: "Terminal read",
            content: readSummary?.content ?? "Terminal read",
            detail: readSummary?.detail ?? { representation: output.read.representation },
          } satisfies TerminalActivityItem)
        : null;
    if (writeFact) {
      this.projectTerminalActivityFact(writeFact);
    }
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      activity: true,
      approvals: true,
      catalog: true,
      force: true,
    });
    if (writeFact) {
      this.projectTerminalActivityFact(writeFact);
    }
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    return output;
  }

  async setGlobalTerminalConfig(input: {
    terminalId: string;
    processKind?: string;
    backend?: "xterm" | "ghostty-native";
    command?: string[];
    launchCwd?: string;
    env?: Record<string, string>;
    gitLog?: false | "none" | "normal" | "verbose";
    logStyle?: "plain" | "rich";
    title?: string;
    icon?: string;
    shortcuts?: Record<string, string>;
    cols?: number;
    rows?: number;
    rendererPreference?: "auto" | "ghostty-web" | "wterm" | "xterm";
    theme?: "default-dark" | "default-light" | "monokai";
    cursor?: "block" | "bar" | "underline";
    font?: {
      family: string;
      sizePx: number;
      lineHeight: number;
      letterSpacing: number;
      weight: string;
      weightBold: string;
      ligatures: boolean;
    };
    metadata?: Record<string, unknown>;
  }) {
    const output = await this.client.trpc.terminal.globalSetConfig.mutate(input);
    const current = this.resolveGlobalTerminalEntry(input.terminalId);
    this.reconcileGlobalTerminalEntry(projectGlobalTerminalFromConfigMutation(current, output.result));
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      activity: true,
      catalog: true,
      force: true,
    });
    return output.result;
  }

  async publishGlobalTerminalComposedSurface(input: {
    terminalId: string;
    surface: import("./app-runtime").AppTerminalComposedSurfaceState;
  }) {
    const output = await this.client.trpc.terminal.globalPublishComposedSurface.mutate(input);
    const current = this.resolveGlobalTerminalEntry(input.terminalId);
    if (current && output.result && typeof output.result === "object" && "terminalId" in output.result) {
      this.reconcileGlobalTerminalEntry(output.result as typeof current);
    }
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      activity: false,
      catalog: true,
      force: true,
    });
    return output.result;
  }

  async inputGlobalTerminal(input: {
    terminalId: string;
    accessToken?: string;
    text: string;
    createApprovalRequest?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
    readRecordActivity?: boolean;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  }) {
    const output = await this.client.trpc.terminal.input.mutate(input);
    const readSummary = projectTerminalReadActivitySummary(output.read);
    const inputFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) && typeof output.eventId === "number"
        ? ({
            id: output.eventId,
            terminalId: input.terminalId,
            createdAt: Date.now(),
            kind: "terminal_write",
            cycleId: null,
            actorId: undefined,
            title: "Terminal input",
            content: input.text,
            detail: {
              mode: "mixed",
            },
          } satisfies TerminalActivityItem)
        : null;
    const readFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) &&
      output.read &&
      typeof output.read === "object" &&
      typeof output.read.eventId === "number"
        ? ({
            id: output.read.eventId,
            terminalId: output.read.terminalId,
            createdAt: Date.now(),
            kind: "terminal_read",
            cycleId: null,
            actorId: output.read.readCursor?.readerActorId,
            title: "Terminal read",
            content: readSummary?.content ?? "Terminal read",
            detail: readSummary?.detail ?? { representation: output.read.representation },
          } satisfies TerminalActivityItem)
        : null;
    if (inputFact) {
      this.projectTerminalActivityFact(inputFact);
    }
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      activity: true,
      approvals: true,
      catalog: true,
      force: true,
    });
    if (inputFact) {
      this.projectTerminalActivityFact(inputFact);
    }
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    return output;
  }

  async listGlobalTerminalGrants(terminalId: string): Promise<GlobalTerminalGrantEntry[]> {
    return await this.refreshGlobalTerminalGrantsInternal(terminalId, { force: true });
  }

  getGlobalTerminalGrantsState(terminalId: string): CachedResourceState<GlobalTerminalGrantEntry[]> {
    return this.ensureGlobalTerminalGrantsState(terminalId);
  }

  retainGlobalTerminalGrants(terminalId: string): () => void {
    this.globalTerminalGrantWatchCountById.set(
      terminalId,
      (this.globalTerminalGrantWatchCountById.get(terminalId) ?? 0) + 1,
    );
    this.state.globalTerminalGrantsById[terminalId] =
      this.state.globalTerminalGrantsById[terminalId] ?? createCachedResourceState<GlobalTerminalGrantEntry[]>([]);
    return () => {
      const current = this.globalTerminalGrantWatchCountById.get(terminalId) ?? 0;
      if (current <= 1) {
        this.globalTerminalGrantWatchCountById.delete(terminalId);
        return;
      }
      this.globalTerminalGrantWatchCountById.set(terminalId, current - 1);
    };
  }

  async hydrateGlobalTerminalGrants(input: {
    terminalId: string;
    force?: boolean;
  }): Promise<GlobalTerminalGrantEntry[]> {
    return await this.refreshGlobalTerminalGrantsInternal(input.terminalId, input);
  }

  async issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "guard" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<GlobalTerminalGrantIssueOutput["grant"]> {
    const output = await this.client.trpc.terminal.issueGrant.mutate(input);
    this.setGlobalTerminalGrantsState(input.terminalId, (resource) => ({
      ...resource,
      data: resource.data.filter((grant) => grant.grantId !== output.grant.grantId).concat(output.grant),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      grants: true,
      catalog: true,
      force: true,
    });
    return output.grant;
  }

  async revokeGlobalTerminalGrant(input: { terminalId: string; grantId: string }): Promise<{ ok: boolean }> {
    const output = await this.client.trpc.terminal.revokeGrant.mutate(input);
    this.setGlobalTerminalGrantsState(input.terminalId, (resource) => ({
      ...resource,
      data: resource.data.filter((grant) => grant.grantId !== input.grantId),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      grants: true,
      catalog: true,
      force: true,
    });
    return output;
  }

  async listGlobalTerminalApprovalRequests(input: {
    terminalId: string;
    assignedAdminId?: GlobalTerminalActorId;
    participantId?: GlobalTerminalActorId;
    statuses?: GlobalTerminalApprovalRequest["status"][];
  }): Promise<GlobalTerminalApprovalRequest[]> {
    const output = await this.client.trpc.terminal.listApprovalRequests.query(input);
    return output.items;
  }

  getGlobalTerminalApprovalsState(terminalId: string): CachedResourceState<GlobalTerminalApprovalRequest[]> {
    return this.ensureGlobalTerminalApprovalsState(terminalId);
  }

  retainGlobalTerminalApprovals(terminalId: string): () => void {
    this.globalTerminalApprovalWatchCountById.set(
      terminalId,
      (this.globalTerminalApprovalWatchCountById.get(terminalId) ?? 0) + 1,
    );
    this.state.globalTerminalApprovalsById[terminalId] =
      this.state.globalTerminalApprovalsById[terminalId] ??
      createCachedResourceState<GlobalTerminalApprovalRequest[]>([]);
    return () => {
      const current = this.globalTerminalApprovalWatchCountById.get(terminalId) ?? 0;
      if (current <= 1) {
        this.globalTerminalApprovalWatchCountById.delete(terminalId);
        return;
      }
      this.globalTerminalApprovalWatchCountById.set(terminalId, current - 1);
    };
  }

  retainTerminalPermissionRequests(input: { terminalId?: string } = {}): () => void {
    const key = RuntimeStore.resolveTerminalPermissionRequestStreamKey(input);
    const existing = this.terminalPermissionRequestStreams.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.sub && this.state.connected) {
        existing.sub = this.subscribeTerminalPermissionRequests(input);
      }
      return () => this.releaseTerminalPermissionRequestStream(key);
    }
    const stream: TerminalPermissionRequestStreamHandle = {
      count: 1,
      sub: this.state.connected ? this.subscribeTerminalPermissionRequests(input) : null,
    };
    this.terminalPermissionRequestStreams.set(key, stream);
    return () => this.releaseTerminalPermissionRequestStream(key);
  }

  private releaseTerminalPermissionRequestStream(key: string): void {
    const current = this.terminalPermissionRequestStreams.get(key);
    if (!current) {
      return;
    }
    current.count -= 1;
    if (current.count > 0) {
      return;
    }
    current.sub?.unsubscribe();
    this.terminalPermissionRequestStreams.delete(key);
  }

  async hydrateGlobalTerminalApprovals(input: {
    terminalId: string;
    force?: boolean;
  }): Promise<GlobalTerminalApprovalRequest[]> {
    return await this.refreshGlobalTerminalApprovalsInternal(input.terminalId, input);
  }

  async approveGlobalTerminalRequest(input: { terminalId: string; requestId: string; durationMs: number }) {
    const output = await this.client.trpc.terminal.approveRequest.mutate(input);
    this.projectGlobalTerminalLeaseFact({
      terminalId: input.terminalId,
      requestId: input.requestId,
      lease: {
        leaseId: output.leaseId,
        participantId: output.participantId,
        expiresAt: output.expiresAt,
      },
    });
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      approvals: true,
      catalog: true,
      force: true,
    });
    this.projectGlobalTerminalLeaseFact({
      terminalId: input.terminalId,
      requestId: input.requestId,
      lease: {
        leaseId: output.leaseId,
        participantId: output.participantId,
        expiresAt: output.expiresAt,
      },
    });
    return output;
  }

  async denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }) {
    const output = await this.client.trpc.terminal.denyRequest.mutate(input);
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      approvals: true,
      catalog: true,
      force: true,
    });
    return output;
  }

  async grantGlobalTerminalWriteLease(input: {
    terminalId: string;
    participantId: GlobalTerminalActorId;
    durationMs: number;
  }) {
    const output = await this.client.trpc.terminal.grantWriteLease.mutate(input);
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      approvals: true,
      catalog: true,
      force: true,
    });
    return output;
  }

  async revokeGlobalTerminalWriteLease(input: {
    terminalId: string;
    leaseId?: string;
    participantId?: GlobalTerminalActorId;
  }) {
    const output = await this.client.trpc.terminal.revokeWriteLease.mutate(input);
    await this.refreshGlobalTerminalSurface({
      terminalIds: [input.terminalId],
      approvals: true,
      catalog: true,
      force: true,
    });
    return output;
  }

  async loadGlobalTerminalActivity(
    terminalId: string,
    before?: HistoryPageCursor | null,
    limit = DEFAULT_GLOBAL_TERMINAL_ACTIVITY_LIMIT,
  ): Promise<{
    items: TerminalActivityItem[];
    hasMore: boolean;
    nextBefore: HistoryPageCursor | null;
  }> {
    const output = await this.client.trpc.terminal.activityPage.query({
      terminalId,
      before: before ?? undefined,
      limit,
    });
    return {
      items: output.items,
      hasMore: output.hasMoreBefore,
      nextBefore: output.nextBefore,
    };
  }

  getGlobalTerminalActivityState(terminalId: string): CachedResourceState<TerminalActivityItem[]> {
    return this.ensureGlobalTerminalActivityState(terminalId);
  }

  retainGlobalTerminalActivity(terminalId: string): () => void {
    this.globalTerminalActivityWatchCountById.set(
      terminalId,
      (this.globalTerminalActivityWatchCountById.get(terminalId) ?? 0) + 1,
    );
    this.state.globalTerminalActivityById[terminalId] =
      this.state.globalTerminalActivityById[terminalId] ?? createCachedResourceState<TerminalActivityItem[]>([]);
    return () => {
      const current = this.globalTerminalActivityWatchCountById.get(terminalId) ?? 0;
      if (current <= 1) {
        this.globalTerminalActivityWatchCountById.delete(terminalId);
        return;
      }
      this.globalTerminalActivityWatchCountById.set(terminalId, current - 1);
    };
  }

  async hydrateGlobalTerminalActivity(input: {
    terminalId: string;
    limit?: number;
    force?: boolean;
  }): Promise<TerminalActivityItem[]> {
    return await this.refreshGlobalTerminalActivityInternal(input.terminalId, input);
  }

  async readSettings(sessionId: string, kind: "settings" | "agenter") {
    return await this.client.trpc.settings.read.query({ sessionId, kind });
  }

  async saveSettings(input: { sessionId: string; kind: "settings" | "agenter"; content: string; baseMtimeMs: number }) {
    return await this.client.trpc.settings.save.mutate(input);
  }

  async ensureAvatarPromptSeed(input: { avatarPrincipalId: string; kind: "agenter"; seedContent: string }) {
    return await this.client.trpc.appRuntime.ensureAvatarPromptSeed.mutate(input);
  }

  async listSettingsLayers(workspacePath: string) {
    return await this.client.trpc.settings.layers.list.query({ workspacePath });
  }

  async listScopedSettings(input: { scope: "workspace" | "global"; workspacePath?: string; avatar?: string }) {
    return await this.client.trpc.settings.scope.list.query(input);
  }

  private resolveRuntimeSettingsScope(sessionId: string): {
    scope: "workspace" | "global";
    workspacePath?: string;
    avatar?: string;
  } {
    const session = this.state.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    return session.workspacePath === "~/"
      ? {
          scope: "global",
          avatar: session.avatar,
        }
      : {
          scope: "workspace",
          workspacePath: session.workspacePath,
          avatar: session.avatar,
        };
  }

  async listRuntimeSettingsScope(sessionId: string) {
    return await this.listScopedSettings(this.resolveRuntimeSettingsScope(sessionId));
  }

  async readGlobalSettings() {
    return await this.client.trpc.settings.global.read.query();
  }

  async saveGlobalSettings(input: { content: string; baseMtimeMs: number }) {
    return await this.client.trpc.settings.global.save.mutate(input);
  }

  async listProfiles() {
    return await this.client.trpc.profile.list.query();
  }

  async getProfile(reference: string) {
    return await this.client.trpc.profile.get.query({ reference });
  }

  async updateProfile(input: {
    reference: string;
    patch: {
      nickname?: string;
      displayName?: string;
      phone?: string;
      address?: string;
      extra?: Record<string, unknown>;
    };
  }) {
    return await this.client.trpc.profile.update.mutate(input);
  }

  async startProfileEmailChallenge(email: string) {
    return await this.client.trpc.profile.auth.emailStart.mutate({ email });
  }

  async verifyProfileEmailChallenge(input: { email: string; code: string; token?: string }) {
    return await this.client.trpc.profile.auth.emailVerify.mutate({
      ...input,
      token: input.token ?? this.client.getAuthToken() ?? undefined,
    });
  }

  webauthnRegistrationUrl(ticketId: string): string | null {
    return this.buildProfileServiceUrl(`/auth/webauthn/register?ticket=${encodeURIComponent(ticketId)}`);
  }

  webauthnAuthenticationUrl(reference: string): string | null {
    return this.buildProfileServiceUrl(`/auth/webauthn/authenticate?reference=${encodeURIComponent(reference)}`);
  }

  async readSettingsLayer(workspacePath: string, layerId: string) {
    return await this.client.trpc.settings.layers.read.query({ workspacePath, layerId });
  }

  async readScopedSettingsLayer(input: {
    scope: "workspace" | "global";
    workspacePath?: string;
    layerId: string;
    avatar?: string;
  }) {
    return await this.client.trpc.settings.scope.read.query(input);
  }

  async readRuntimeSettingsLayer(sessionId: string, layerId: string) {
    return await this.readScopedSettingsLayer({
      ...this.resolveRuntimeSettingsScope(sessionId),
      layerId,
    });
  }

  async saveSettingsLayer(input: { workspacePath: string; layerId: string; content: string; baseMtimeMs: number }) {
    return await this.client.trpc.settings.layers.save.mutate(input);
  }

  async saveScopedSettingsLayer(input: {
    scope: "workspace" | "global";
    workspacePath?: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
    avatar?: string;
  }) {
    return await this.client.trpc.settings.scope.save.mutate(input);
  }

  async saveRuntimeSettingsLayer(input: { sessionId: string; layerId: string; content: string; baseMtimeMs: number }) {
    return await this.saveScopedSettingsLayer({
      ...this.resolveRuntimeSettingsScope(input.sessionId),
      layerId: input.layerId,
      content: input.content,
      baseMtimeMs: input.baseMtimeMs,
    });
  }

  async setChatVisibility(input: { sessionId: string; chatId: string; visible: boolean; focused: boolean }) {
    const snapshot = await this.client.trpc.notification.setChatVisibility.mutate(input);
    this.applyNotificationSnapshot(snapshot);
    this.emit();
    return snapshot;
  }

  async setTerminalVisibility(input: { sessionId: string; terminalId?: string; visible: boolean; focused: boolean }) {
    const snapshot = await this.client.trpc.notification.setTerminalVisibility.mutate(input);
    this.applyNotificationSnapshot(snapshot);
    this.emit();
    return snapshot;
  }

  async consumeNotifications(input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToSrc?: string | null;
  }) {
    const snapshot = await this.client.trpc.notification.consume.mutate({
      sessionId: input.sessionId,
      chatId: input.chatId,
      terminalId: input.terminalId,
      upToSrc: input.upToSrc ?? undefined,
    });
    this.applyNotificationSnapshot(snapshot);
    this.emit();
    return snapshot;
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
    const output = await this.client.trpc.runtime.messagesPage.query({ sessionId, limit });
    const mapped = output.items.map((item) => this.toRuntimeChatMessage(item));
    this.state.chatsBySession[sessionId] = this.mergeChatMessages(this.state.chatsBySession[sessionId] ?? [], mapped);
    this.updateBeforeCursor(this.chatBeforeCursorBySession, sessionId, output.nextBefore);
    this.emit();
  }

  async loadChatCycles(sessionId: string, limit = 120): Promise<void> {
    const output = await this.client.trpc.runtime.cyclesPage.query({ sessionId, limit });
    const mapped = output.items.map((item) => this.toRuntimeChatCycle(item));
    this.state.chatCyclesBySession[sessionId] = this.mergeChatCycles(
      this.state.chatCyclesBySession[sessionId] ?? [],
      mapped,
    );
    this.updateBeforeCursor(this.chatCyclesBeforeCursorBySession, sessionId, output.nextBefore);
    this.emit();
  }

  async hydrateSessionHistory(
    sessionId: string,
    input?: { messageLimit?: number; cycleLimit?: number },
  ): Promise<{ messagesHasMore: boolean; cyclesHasMore: boolean }> {
    const inFlight = this.chatHydrationTasksBySession.get(sessionId);
    if (inFlight) {
      return await inFlight;
    }

    const task = (async () => {
      const [chatOutput, cyclesOutput] = await Promise.all([
        this.client.trpc.runtime.messagesPage.query({ sessionId, limit: input?.messageLimit ?? 200 }),
        this.client.trpc.runtime.cyclesPage.query({ sessionId, limit: input?.cycleLimit ?? 120 }),
      ]);

      const mappedMessages = chatOutput.items.map((item) => this.toRuntimeChatMessage(item));
      const mappedCycles = cyclesOutput.items.map((item) => this.toRuntimeChatCycle(item));

      this.state.chatsBySession[sessionId] = this.mergeChatMessages(
        this.state.chatsBySession[sessionId] ?? [],
        mappedMessages,
      );
      this.state.chatCyclesBySession[sessionId] = this.mergeChatCycles(
        this.state.chatCyclesBySession[sessionId] ?? [],
        mappedCycles,
      );

      this.updateBeforeCursor(this.chatBeforeCursorBySession, sessionId, chatOutput.nextBefore);
      this.updateBeforeCursor(this.chatCyclesBeforeCursorBySession, sessionId, cyclesOutput.nextBefore);

      this.emit();
      return {
        messagesHasMore: chatOutput.hasMoreBefore,
        cyclesHasMore: cyclesOutput.hasMoreBefore,
      };
    })().finally(() => {
      this.chatHydrationTasksBySession.delete(sessionId);
    });

    this.chatHydrationTasksBySession.set(sessionId, task);
    return await task;
  }

  async hydrateSessionArtifacts(
    sessionId: string,
    input?: { includeChatHistory?: boolean; observabilityMode?: "full" | "heartbeat" },
  ): Promise<void> {
    if (this.connectTask) {
      await this.connectTask;
    }

    let session = this.state.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      await this.hydrateRuntime(sessionId, input?.observabilityMode);
      session = this.state.sessions.find((entry) => entry.id === sessionId);
    } else if (session.status === "stopped" || session.status === "paused") {
      const [persistedAttention, persistedAttentionDelivery] = await Promise.all([
        this.inspectAttentionState(sessionId),
        this.inspectAttentionDeliveryState(sessionId),
      ]);
      this.clearRuntimeState(sessionId, session.status, persistedAttention, persistedAttentionDelivery);
      this.emit();
      await this.hydrateObservabilityArtifacts(sessionId, input?.observabilityMode);
    } else if (this.state.runtimes[sessionId]) {
      await this.hydrateObservabilityArtifacts(sessionId, input?.observabilityMode);
    } else {
      await this.hydrateRuntime(sessionId, input?.observabilityMode);
      session = this.state.sessions.find((entry) => entry.id === sessionId);
    }

    if (!session) {
      return;
    }
    const tasks: Promise<unknown>[] = [this.ensureMessageChannels(sessionId), this.refreshNotifications()];
    if (input?.includeChatHistory !== false) {
      tasks.unshift(this.hydrateSessionHistory(sessionId));
    }
    await Promise.all(tasks);
  }

  async loadMoreChatMessagesBefore(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.chatsBySession[sessionId] ?? [];
    const before = this.resolveBeforeCursor(this.chatBeforeCursorBySession, sessionId, current, (message) =>
      this.toChatHistoryCursor(message),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.runtime.messagesPage.query({ sessionId, before: before ?? undefined, limit });
    if (output.items.length === 0) {
      this.updateBeforeCursor(this.chatBeforeCursorBySession, sessionId, null);
      return { items: 0, hasMore: false };
    }
    this.updateBeforeCursor(this.chatBeforeCursorBySession, sessionId, output.nextBefore);
    const mapped = output.items.map((item) => this.toRuntimeChatMessage(item));
    const merged = this.mergeChatMessages(current, mapped);
    this.state.chatsBySession[sessionId] = merged;
    this.emit();
    return {
      items: Math.max(0, merged.length - current.length),
      hasMore: output.hasMoreBefore,
    };
  }

  async loadMoreChatCyclesBefore(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.chatCyclesBySession[sessionId] ?? [];
    const before = this.resolveBeforeCursor(this.chatCyclesBeforeCursorBySession, sessionId, current, (cycle) =>
      this.toCycleHistoryCursor(cycle),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.runtime.cyclesPage.query({ sessionId, before: before ?? undefined, limit });
    if (output.items.length === 0) {
      this.updateBeforeCursor(this.chatCyclesBeforeCursorBySession, sessionId, null);
      return { items: 0, hasMore: false };
    }
    this.updateBeforeCursor(this.chatCyclesBeforeCursorBySession, sessionId, output.nextBefore);
    const mapped = output.items.map((item) => this.toRuntimeChatCycle(item));
    const next = this.mergeChatCycles(current, mapped);
    this.state.chatCyclesBySession[sessionId] = next;
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.hasMoreBefore,
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

  async loadMoreObservabilityTimeline(
    sessionId: string,
    limit = 120,
  ): Promise<{ logs: number; traces: number; hasMore: boolean }> {
    const currentLogs = this.state.schedulerLogsBySession[sessionId] ?? [];
    const currentTraces = this.state.observabilityTracesBySession[sessionId] ?? [];
    const beforeLog = this.resolveBeforeCursor(
      this.schedulerLogsBeforeCursorBySession,
      sessionId,
      currentLogs,
      (record) => this.toTimestampHistoryCursor(record),
    );
    const beforeTrace = this.resolveBeforeCursor(
      this.observabilityTracesBeforeCursorBySession,
      sessionId,
      currentTraces,
      (record) => this.toStartedAtHistoryCursor(record),
    );
    if (beforeLog === null && beforeTrace === null) {
      return { logs: 0, traces: 0, hasMore: false };
    }

    const [logs, traces] = await Promise.all([
      this.client.trpc.runtime.schedulerLogs.query({
        sessionId,
        before: beforeLog ?? undefined,
        limit,
      }),
      this.client.trpc.runtime.observabilityTraces.query({
        sessionId,
        before: beforeTrace ?? undefined,
        limit,
      }),
    ]);

    this.updateBeforeCursor(this.schedulerLogsBeforeCursorBySession, sessionId, logs.nextBefore);
    this.updateBeforeCursor(this.observabilityTracesBeforeCursorBySession, sessionId, traces.nextBefore);

    const nextLogs = this.applyLruEntries(
      this.schedulerLogsAccessBySession,
      sessionId,
      currentLogs,
      logs.items,
      LOOPBUS_LRU_LIMIT,
    );
    const nextTraces = this.applyLruEntries(
      this.observabilityTracesAccessBySession,
      sessionId,
      currentTraces,
      traces.items,
      LOOPBUS_LRU_LIMIT,
    );
    this.state.schedulerLogsBySession[sessionId] = nextLogs;
    this.state.observabilityTracesBySession[sessionId] = nextTraces;
    this.emit();

    const addedLogs = nextLogs.length - currentLogs.length;
    const addedTraces = nextTraces.length - currentTraces.length;
    return {
      logs: Math.max(0, addedLogs),
      traces: Math.max(0, addedTraces),
      hasMore: logs.hasMoreBefore || traces.hasMoreBefore,
    };
  }

  async loadMoreModelCalls(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.modelCallsBySession[sessionId] ?? [];
    const before = this.resolveBeforeCursor(this.modelCallsBeforeCursorBySession, sessionId, current, (record) =>
      this.toRecordHistoryCursor(record),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.runtime.modelCallsPage.query({
      sessionId,
      before: before ?? undefined,
      limit,
    });
    this.updateBeforeCursor(this.modelCallsBeforeCursorBySession, sessionId, output.nextBefore);
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
      hasMore: output.hasMoreBefore,
    };
  }

  async loadHeartbeatGroups(sessionId: string, limit = HEARTBEAT_GROUP_PAGE_LIMIT): Promise<void> {
    this.setHeartbeatGroupsState(sessionId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.runtime.heartbeatGroupsPage.query({ sessionId, limit });
      this.updateBeforeCursor(this.heartbeatGroupsBeforeCursorBySession, sessionId, output.nextBefore);
      this.setHeartbeatGroupsState(sessionId, (resource) => ({
        ...resource,
        data: this.mergeHeartbeatGroups(resource.data, output.items, HEARTBEAT_GROUP_LRU_LIMIT),
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
    } catch (error) {
      this.setHeartbeatGroupsState(sessionId, (resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: toErrorMessage(error),
      }));
      this.emit();
      throw error;
    }
  }

  async loadHeartbeatRecords(
    sessionId: string,
    input?: { pageSize?: number; anchor?: HeartbeatRecordPageAnchorInput | null },
  ): Promise<void> {
    const current = this.ensureHeartbeatRecordsState(sessionId);
    const pageSize = input?.pageSize ?? current.data?.pageSize ?? HEARTBEAT_RECORD_PAGE_LIMIT;
    const anchor = input?.anchor ?? current.data?.anchor ?? { kind: "latest" as const };
    this.setHeartbeatRecordsState(sessionId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.runtime.heartbeatRecordPage.query({ sessionId, pageSize, anchor });
      this.setHeartbeatRecordsState(sessionId, (resource) => ({
        ...resource,
        data: output,
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
    } catch (error) {
      this.setHeartbeatRecordsState(sessionId, (resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: toErrorMessage(error),
      }));
      this.emit();
      throw error;
    }
  }

  async loadHeartbeatRecordDetail(sessionId: string, recordId: number): Promise<void> {
    this.setHeartbeatRecordDetailState(sessionId, recordId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.runtime.heartbeatRecordDetail.query({ sessionId, recordId });
      this.setHeartbeatRecordDetailState(sessionId, recordId, (resource) => ({
        ...resource,
        data: output,
        loaded: true,
        loading: false,
        refreshing: false,
        error: null,
        refreshedAt: Date.now(),
      }));
      this.emit();
    } catch (error) {
      this.setHeartbeatRecordDetailState(sessionId, recordId, (resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: toErrorMessage(error),
      }));
      this.emit();
      throw error;
    }
  }

  async loadMoreHeartbeatGroups(
    sessionId: string,
    limit = HEARTBEAT_GROUP_PAGE_LIMIT,
  ): Promise<{ items: number; hasMore: boolean }> {
    const current = this.ensureHeartbeatGroupsState(sessionId);
    const before = this.resolveBeforeCursor(
      this.heartbeatGroupsBeforeCursorBySession,
      sessionId,
      current.data,
      (record) => this.toRecordHistoryCursor(record),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }

    this.setHeartbeatGroupsState(sessionId, (resource) => ({
      ...resource,
      loading: !resource.loaded,
      refreshing: resource.loaded,
      error: null,
    }));
    this.emit();

    try {
      const output = await this.client.trpc.runtime.heartbeatGroupsPage.query({
        sessionId,
        before: before ?? undefined,
        limit,
      });
      this.updateBeforeCursor(this.heartbeatGroupsBeforeCursorBySession, sessionId, output.nextBefore);
      let itemsAdded = 0;
      this.setHeartbeatGroupsState(sessionId, (resource) => {
        const nextData = this.mergeHeartbeatGroups(resource.data, output.items, HEARTBEAT_GROUP_LRU_LIMIT);
        itemsAdded = Math.max(0, nextData.length - resource.data.length);
        return {
          ...resource,
          data: nextData,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        };
      });
      this.emit();
      return {
        items: itemsAdded,
        hasMore: output.hasMoreBefore,
      };
    } catch (error) {
      this.setHeartbeatGroupsState(sessionId, (resource) => ({
        ...resource,
        loading: false,
        refreshing: false,
        error: toErrorMessage(error),
      }));
      this.emit();
      throw error;
    }
  }

  async loadRequestAux(sessionId: string, limit = 120): Promise<void> {
    const output = await this.client.trpc.runtime.requestAuxPage.query({ sessionId, limit });
    const current = this.state.requestAuxBySession[sessionId] ?? [];
    const next = this.mergeAscendingByCursor(
      current,
      output.items,
      (item) => item.id,
      (item) => this.toRecordHistoryCursor(item),
    );
    this.state.requestAuxBySession[sessionId] = next;
    this.updateBeforeCursor(this.requestAuxBeforeCursorBySession, sessionId, output.nextBefore);
    this.emit();
  }

  async loadMoreRequestAux(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.requestAuxBySession[sessionId] ?? [];
    const before = this.resolveBeforeCursor(this.requestAuxBeforeCursorBySession, sessionId, current, (item) =>
      this.toRecordHistoryCursor(item),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.runtime.requestAuxPage.query({
      sessionId,
      before: before ?? undefined,
      limit,
    });
    if (output.items.length === 0) {
      this.updateBeforeCursor(this.requestAuxBeforeCursorBySession, sessionId, null);
      return { items: 0, hasMore: false };
    }
    const next = this.mergeAscendingByCursor(
      current,
      output.items,
      (item) => item.id,
      (item) => this.toRecordHistoryCursor(item),
    );
    this.state.requestAuxBySession[sessionId] = next;
    this.updateBeforeCursor(this.requestAuxBeforeCursorBySession, sessionId, output.nextBefore);
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.hasMoreBefore,
    };
  }

  async loadMoreHeartbeatInspection(
    sessionId: string,
    limit = HEARTBEAT_GROUP_PAGE_LIMIT,
  ): Promise<{ items: number; hasMore: boolean }> {
    return await this.loadMoreHeartbeatGroups(sessionId, limit);
  }

  private scheduleHeartbeatGroupRefresh(sessionId: string, limit = HEARTBEAT_GROUP_PAGE_LIMIT): void {
    const pendingLimit = Math.max(this.heartbeatGroupRefreshPendingLimitBySession.get(sessionId) ?? 0, limit);
    this.heartbeatGroupRefreshPendingLimitBySession.set(sessionId, pendingLimit);
    if (
      !this.heartbeatGroupRefreshInFlightBySession.has(sessionId) &&
      !this.heartbeatGroupRefreshTimerBySession.has(sessionId)
    ) {
      void this.flushHeartbeatGroupRefresh(sessionId);
      return;
    }
    const existing = this.heartbeatGroupRefreshTimerBySession.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.heartbeatGroupRefreshTimerBySession.delete(sessionId);
      void this.flushHeartbeatGroupRefresh(sessionId);
    }, 80);
    this.heartbeatGroupRefreshTimerBySession.set(sessionId, timer);
  }

  private async flushHeartbeatGroupRefresh(sessionId: string): Promise<void> {
    if (this.heartbeatGroupRefreshInFlightBySession.has(sessionId)) {
      return;
    }
    const existing = this.heartbeatGroupRefreshTimerBySession.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.heartbeatGroupRefreshTimerBySession.delete(sessionId);
    }
    const limit = this.heartbeatGroupRefreshPendingLimitBySession.get(sessionId) ?? HEARTBEAT_GROUP_PAGE_LIMIT;
    this.heartbeatGroupRefreshPendingLimitBySession.delete(sessionId);
    this.heartbeatGroupRefreshInFlightBySession.add(sessionId);
    try {
      await this.loadHeartbeatGroups(sessionId, limit);
    } catch {
      // loadHeartbeatGroups persists refresh failure on the cached resource state.
    } finally {
      this.heartbeatGroupRefreshInFlightBySession.delete(sessionId);
      if (this.heartbeatGroupRefreshPendingLimitBySession.has(sessionId)) {
        this.scheduleHeartbeatGroupRefresh(
          sessionId,
          this.heartbeatGroupRefreshPendingLimitBySession.get(sessionId) ?? HEARTBEAT_GROUP_PAGE_LIMIT,
        );
      }
    }
  }

  private scheduleHeartbeatRecordRefresh(sessionId: string): void {
    if (
      !this.heartbeatRecordRefreshInFlightBySession.has(sessionId) &&
      !this.heartbeatRecordRefreshTimerBySession.has(sessionId)
    ) {
      void this.flushHeartbeatRecordRefresh(sessionId);
      return;
    }
    const existing = this.heartbeatRecordRefreshTimerBySession.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.heartbeatRecordRefreshTimerBySession.delete(sessionId);
      void this.flushHeartbeatRecordRefresh(sessionId);
    }, 80);
    this.heartbeatRecordRefreshTimerBySession.set(sessionId, timer);
  }

  private async flushHeartbeatRecordRefresh(sessionId: string): Promise<void> {
    if (this.heartbeatRecordRefreshInFlightBySession.has(sessionId)) {
      return;
    }
    const existing = this.heartbeatRecordRefreshTimerBySession.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.heartbeatRecordRefreshTimerBySession.delete(sessionId);
    }
    this.heartbeatRecordRefreshInFlightBySession.add(sessionId);
    try {
      const current = this.ensureHeartbeatRecordsState(sessionId);
      await this.loadHeartbeatRecords(sessionId, {
        pageSize: current.data?.pageSize ?? HEARTBEAT_RECORD_PAGE_LIMIT,
        anchor: current.data?.anchor ?? { kind: "latest" },
      });
      await Promise.all(
        Object.entries(this.state.heartbeatRecordDetailsBySession[sessionId] ?? {})
          .filter(([, resource]) => resource.loaded)
          .map(([recordId]) => this.loadHeartbeatRecordDetail(sessionId, Number(recordId))),
      );
    } catch {
      // loadHeartbeatRecords/loadHeartbeatRecordDetail persist resource-level refresh failures.
    } finally {
      this.heartbeatRecordRefreshInFlightBySession.delete(sessionId);
    }
  }

  async loadMoreApiCalls(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.apiCallsBySession[sessionId] ?? [];
    const before = this.resolveBeforeCursor(this.apiCallsBeforeCursorBySession, sessionId, current, (record) =>
      this.toRecordHistoryCursor(record),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.runtime.apiCallsPage.query({
      sessionId,
      before: before ?? undefined,
      limit,
    });
    this.updateBeforeCursor(this.apiCallsBeforeCursorBySession, sessionId, output.nextBefore);
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
      hasMore: output.hasMoreBefore,
    };
  }

  async loadTerminalActivity(
    sessionId: string,
    terminalId: string,
    limit = 120,
  ): Promise<{ items: number; hasMore: boolean }> {
    const output = await this.client.trpc.runtime.terminalActivityPage.query({ sessionId, terminalId, limit });
    const key = this.terminalActivityKey(sessionId, terminalId);
    const current = this.state.terminalActivityBySession[sessionId]?.[terminalId] ?? [];
    const next = this.mergeAscendingByCursor(
      current,
      output.items,
      (item) => item.id,
      (item) => this.toRecordHistoryCursor(item),
    );
    this.state.terminalActivityBySession[sessionId] = {
      ...(this.state.terminalActivityBySession[sessionId] ?? {}),
      [terminalId]: next,
    };
    this.updateBeforeCursor(this.terminalActivityBeforeCursorByKey, key, output.nextBefore);
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.hasMoreBefore,
    };
  }

  async loadMoreTerminalActivity(
    sessionId: string,
    terminalId: string,
    limit = 120,
  ): Promise<{ items: number; hasMore: boolean }> {
    const key = this.terminalActivityKey(sessionId, terminalId);
    const current = this.state.terminalActivityBySession[sessionId]?.[terminalId] ?? [];
    const before = this.resolveBeforeCursor(this.terminalActivityBeforeCursorByKey, key, current, (item) =>
      this.toRecordHistoryCursor(item),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.runtime.terminalActivityPage.query({
      sessionId,
      terminalId,
      before: before ?? undefined,
      limit,
    });
    if (output.items.length === 0) {
      this.updateBeforeCursor(this.terminalActivityBeforeCursorByKey, key, null);
      return { items: 0, hasMore: false };
    }
    const next = this.mergeAscendingByCursor(
      current,
      output.items,
      (item) => item.id,
      (item) => this.toRecordHistoryCursor(item),
    );
    this.state.terminalActivityBySession[sessionId] = {
      ...(this.state.terminalActivityBySession[sessionId] ?? {}),
      [terminalId]: next,
    };
    this.updateBeforeCursor(this.terminalActivityBeforeCursorByKey, key, output.nextBefore);
    this.emit();
    return {
      items: Math.max(0, next.length - current.length),
      hasMore: output.hasMoreBefore,
    };
  }

  private subscribeRuntimeEvents(afterEventId: number): SubscriptionHandle {
    return this.client.trpc.runtime.events.subscribe(
      { afterEventId },
      {
        onData: (event) => {
          this.applyEvent(event);
          if (this.state.connectionStatus !== "connected") {
            this.setConnectionStatus("connected");
          }
          this.emit();
        },
        onError: () => {
          this.handleTransportLoss("error");
        },
      },
    );
  }

  private subscribeApiCallStream(sessionId: string, stream: ApiCallStreamHandle): SubscriptionHandle {
    const afterId = Math.max(stream.cursor, this.state.apiCallsBySession[sessionId]?.at(-1)?.id ?? 0);
    stream.cursor = afterId;
    return this.client.trpc.runtime.apiCalls.subscribe(
      { sessionId, afterId },
      {
        onData: (payload) => {
          if (payload.type === "recording") {
            this.state.apiCallRecordingBySession[sessionId] = payload.payload;
            this.emit();
            return;
          }
          stream.cursor = Math.max(stream.cursor, payload.payload.id);
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
          // Stream recovery follows the shared transport reconnect path.
        },
      },
    );
  }

  private pauseRetainedApiCallStreams(): void {
    for (const stream of this.apiCallStreams.values()) {
      stream.sub?.unsubscribe();
      stream.sub = null;
    }
  }

  private restoreRetainedApiCallStreams(): void {
    for (const [sessionId, stream] of this.apiCallStreams.entries()) {
      if (stream.count <= 0 || stream.sub) {
        continue;
      }
      stream.sub = this.subscribeApiCallStream(sessionId, stream);
    }
  }

  private static resolveTerminalPermissionRequestStreamKey(
    input: {
      terminalId?: string;
    } = {},
  ): string {
    return input.terminalId ? `terminal:${input.terminalId}` : "all";
  }

  private applyTerminalPermissionRequest(request: GlobalTerminalApprovalRequest): void {
    this.setGlobalTerminalApprovalsState(request.terminalId, (resource) => {
      const withoutCurrent = resource.data.filter((candidate) => candidate.requestId !== request.requestId);
      const data =
        request.status === "pending"
          ? [...withoutCurrent, request].sort((left, right) => {
              if (left.createdAt !== right.createdAt) {
                return left.createdAt - right.createdAt;
              }
              return left.requestId.localeCompare(right.requestId);
            })
          : withoutCurrent;
      return {
        ...resource,
        data,
        loaded: true,
        loading: false,
        refreshing: resource.loading || resource.refreshing,
        error: null,
        refreshedAt: Date.now(),
      };
    });
    this.emit();
  }

  private applyTerminalPermissionRequestEvent(event: GlobalTerminalPermissionRequestEvent): void {
    if (event.type === "snapshot") {
      const byTerminalId = new Map<string, GlobalTerminalApprovalRequest[]>();
      for (const request of event.items) {
        const requests = byTerminalId.get(request.terminalId) ?? [];
        requests.push(request);
        byTerminalId.set(request.terminalId, requests);
      }
      for (const [terminalId, requests] of byTerminalId.entries()) {
        this.setGlobalTerminalApprovalsState(terminalId, (resource) => ({
          ...resource,
          data: requests,
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        }));
      }
      this.emit();
      return;
    }
    this.applyTerminalPermissionRequest(event.request);
  }

  private subscribeTerminalPermissionRequests(input: GlobalTerminalPermissionRequestsInput = {}): SubscriptionHandle {
    return this.client.trpc.terminal.permissionRequests.subscribe(input, {
      onData: (event) => {
        this.applyTerminalPermissionRequestEvent(event);
      },
      onError: () => {
        // Stream recovery follows the shared transport reconnect path.
      },
    });
  }

  private pauseRetainedTerminalPermissionRequestStreams(): void {
    for (const stream of this.terminalPermissionRequestStreams.values()) {
      stream.sub?.unsubscribe();
      stream.sub = null;
    }
  }

  private restoreRetainedTerminalPermissionRequestStreams(): void {
    for (const [key, stream] of this.terminalPermissionRequestStreams.entries()) {
      if (stream.count <= 0 || stream.sub) {
        continue;
      }
      stream.sub = this.subscribeTerminalPermissionRequests(
        key === "all" ? {} : { terminalId: key.slice("terminal:".length) },
      );
    }
  }

  retainApiCallStream(sessionId: string): () => void {
    const existing = this.apiCallStreams.get(sessionId);
    if (existing) {
      existing.count += 1;
      if (!existing.sub && this.state.connected) {
        existing.sub = this.subscribeApiCallStream(sessionId, existing);
      }
      return () => this.releaseApiCallStream(sessionId);
    }

    const cursor = this.state.apiCallsBySession[sessionId]?.at(-1)?.id ?? 0;
    const stream: ApiCallStreamHandle = {
      count: 1,
      cursor,
      sub: null,
    };
    if (this.state.connected) {
      stream.sub = this.subscribeApiCallStream(sessionId, stream);
    }
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
      if (payload.session.status === "stopped" || payload.session.status === "paused") {
        this.clearRuntimeState(payload.session.id, payload.session.status);
      }
      void this.listAllWorkspaces();
      return;
    }

    if (event.type === "session.deleted") {
      const payload = event.payload as { sessionId: string };
      this.state.sessions = this.state.sessions.filter((item) => item.id !== payload.sessionId);
      delete this.state.runtimes[payload.sessionId];
      delete this.state.activityBySession[payload.sessionId];
      delete this.state.terminalSnapshotsBySession[payload.sessionId];
      delete this.state.terminalReadsBySession[payload.sessionId];
      delete this.state.chatsBySession[payload.sessionId];
      delete this.state.messageChannelsBySession[payload.sessionId];
      delete this.state.chatCyclesBySession[payload.sessionId];
      delete this.state.tasksBySession[payload.sessionId];
      delete this.state.schedulerLogsBySession[payload.sessionId];
      delete this.state.observabilityTracesBySession[payload.sessionId];
      delete this.state.apiCallsBySession[payload.sessionId];
      delete this.state.heartbeatGroupsBySession[payload.sessionId];
      delete this.state.heartbeatRecordsBySession[payload.sessionId];
      delete this.state.heartbeatRecordDetailsBySession[payload.sessionId];
      delete this.state.modelCallsBySession[payload.sessionId];
      delete this.state.requestAuxBySession[payload.sessionId];
      delete this.state.modelCallDeltasBySession?.[payload.sessionId];
      delete this.state.terminalActivityBySession[payload.sessionId];
      delete this.state.apiCallRecordingBySession[payload.sessionId];
      this.heartbeatGroupsBeforeCursorBySession.delete(payload.sessionId);
      const heartbeatGroupRefreshTimer = this.heartbeatGroupRefreshTimerBySession.get(payload.sessionId);
      if (heartbeatGroupRefreshTimer) {
        clearTimeout(heartbeatGroupRefreshTimer);
        this.heartbeatGroupRefreshTimerBySession.delete(payload.sessionId);
      }
      this.heartbeatGroupRefreshInFlightBySession.delete(payload.sessionId);
      this.heartbeatGroupRefreshPendingLimitBySession.delete(payload.sessionId);
      this.clearHeartbeatRecordRefresh(payload.sessionId);
      this.modelCallDeltasAccessBySession.delete(payload.sessionId);
      this.requestAuxAccessBySession.delete(payload.sessionId);
      this.requestAuxBeforeCursorBySession.delete(payload.sessionId);
      this.releaseSessionResourceHandle(payload.sessionId);
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
      this.state.chatsBySession[sessionId] = this.mergeChatMessages(this.state.chatsBySession[sessionId] ?? [], [
        message,
      ]).slice(-200);
      return;
    }

    if (event.type === "notification.updated") {
      const payload = event.payload as {
        snapshot: NotificationSnapshotOutput;
      };
      this.applyNotificationSnapshot(payload.snapshot);
      return;
    }

    if (event.type === "terminal.surface.updated") {
      const payload = event.payload as {
        catalogChanged?: boolean;
        grantTerminalIds?: string[];
        approvalTerminalIds?: string[];
        activityTerminalIds?: string[];
      };
      this.invalidateGlobalTerminalSurface({
        catalog: payload.catalogChanged ?? false,
        history: payload.catalogChanged ?? false,
        index: payload.catalogChanged ?? false,
        archive: payload.catalogChanged ?? false,
        force: true,
      });
      this.invalidateGlobalTerminalSurface({
        terminalIds: payload.grantTerminalIds,
        grants: true,
        force: true,
      });
      this.invalidateGlobalTerminalSurface({
        terminalIds: payload.approvalTerminalIds,
        approvals: true,
        force: true,
      });
      this.invalidateGlobalTerminalSurface({
        terminalIds: payload.activityTerminalIds,
        activity: true,
        force: true,
      });
      return;
    }

    if (event.type === "message.room.updated") {
      const payload = event.payload as {
        catalogChanged?: boolean;
        changes: GlobalRoomUpdateEvent[];
      };
      const changes = payload.changes;
      const shouldRefreshCatalog = payload.catalogChanged || changes.some((change) => change.refreshCatalog === true);
      if (shouldRefreshCatalog && (this.state.globalRooms.loaded || this.globalRoomsWatchCount > 0)) {
        this.runBackgroundTask(this.hydrateGlobalRooms({ force: true }));
      }
      for (const change of changes) {
        if (change.refreshSnapshot && this.shouldRefreshGlobalRoomSnapshot(change.chatId)) {
          this.runBackgroundTask(this.hydrateGlobalRoomSnapshot({ chatId: change.chatId, force: true }));
        }
        if (change.refreshGrants && this.shouldRefreshGlobalRoomGrants(change.chatId)) {
          this.runBackgroundTask(this.hydrateGlobalRoomGrants({ chatId: change.chatId, force: true }));
        }
        if (change.refreshAssets && this.shouldRefreshGlobalRoomAssets(change.chatId)) {
          this.runBackgroundTask(this.hydrateGlobalRoomAssets({ chatId: change.chatId, force: true }));
        }
      }
      return;
    }

    if (event.type === "workspace.avatarCatalog.updated") {
      const payload = event.payload as { workspacePaths?: string[] };
      for (const workspacePath of payload.workspacePaths ?? []) {
        if (
          workspacePath === "~/" &&
          (this.globalAvatarCatalogWatchCount > 0 || this.state.globalAvatarCatalog.loaded)
        ) {
          this.runBackgroundTask(this.hydrateGlobalAvatarCatalog({ force: true }));
        }
        const resource = this.state.workspaceAvatarCatalogByPath[workspacePath];
        if (!resource && !this.workspaceAvatarCatalogWatchCountByPath.has(workspacePath)) {
          continue;
        }
        this.runBackgroundTask(this.hydrateWorkspaceAvatarCatalog(workspacePath, { force: true }));
      }
      return;
    }

    if (
      event.type === "runtime.phase" ||
      event.type === "runtime.stage" ||
      event.type === "runtime.stats" ||
      event.type === "runtime.focusedTerminal" ||
      event.type === "terminal.read" ||
      event.type === "terminal.snapshot" ||
      event.type === "terminal.status" ||
      event.type === "runtime.error" ||
      event.type === "task.updated" ||
      event.type === "task.deleted" ||
      event.type === "task.triggered" ||
      event.type === "task.source.changed" ||
      event.type === "runtime.scheduler.snapshot" ||
      event.type === "runtime.scheduler.log" ||
      event.type === "runtime.observability.trace" ||
      event.type === "runtime.scheduler.signal" ||
      event.type === "runtime.heartbeatPart" ||
      event.type === "runtime.modelCall" ||
      event.type === "runtime.modelCall.delta" ||
      event.type === "runtime.apiCall" ||
      event.type === "runtime.apiRecording" ||
      event.type === "runtime.attention" ||
      event.type === "runtime.attentionDelivery" ||
      event.type === "runtime.attentionDispatch" ||
      event.type === "runtime.attentionReceipt" ||
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
      runtime = {
        ...runtime,
      };
      this.state.runtimes[sessionId] = runtime;
      if (event.type === "runtime.phase") {
        runtime.schedulerPhase = (event.payload as { phase: typeof runtime.schedulerPhase }).phase;
        this.state.activityBySession[sessionId] =
          runtime.schedulerPhase === "waiting_commits" && runtime.stage === "idle" ? "idle" : "active";
      } else if (event.type === "runtime.stage") {
        runtime.stage = (event.payload as { stage: typeof runtime.stage }).stage;
        this.state.activityBySession[sessionId] =
          runtime.schedulerPhase === "waiting_commits" && runtime.stage === "idle" ? "idle" : "active";
      } else if (event.type === "runtime.focusedTerminal") {
        const payload = event.payload as { terminalId?: string | null; terminalIds?: string[] };
        const focused = normalizeFocusedTerminalState({
          focusedTerminalId: payload.terminalId,
          focusedTerminalIds: payload.terminalIds,
        });
        runtime.focusedTerminalIds = focused.focusedTerminalIds;
        runtime.focusedTerminalId = focused.focusedTerminalId;
      } else if (event.type === "terminal.status") {
        const payload = event.payload as {
          terminalId: string;
          processPhase: "running" | "killed";
          status: "IDLE" | "BUSY";
        };
        runtime.terminals = runtime.terminals.map((item) =>
          item.terminalId === payload.terminalId
            ? {
                ...item,
                processPhase: payload.processPhase,
                status: payload.status,
              }
            : item,
        );
        const current = this.resolveGlobalTerminalEntry(payload.terminalId);
        if (current) {
          this.reconcileGlobalTerminalEntry({
            ...current,
            processPhase: payload.processPhase,
            status: payload.status,
          });
        }
      } else if (event.type === "terminal.snapshot") {
        const payload = event.payload as {
          terminalId: string;
          snapshot: {
            seq: number;
            timestamp: number;
            cols: number;
            rows: number;
            lines: string[];
            cursor: { x: number; y: number; visible?: boolean };
            scrollback: {
              viewportOffset: number;
              totalLines: number;
              screenLines: number;
            };
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
        const current = this.resolveGlobalTerminalEntry(payload.terminalId);
        if (current) {
          this.reconcileGlobalTerminalEntry({
            ...current,
            seq: payload.snapshot.seq,
            snapshot: payload.snapshot,
          });
        }
      } else if (event.type === "terminal.read") {
        const payload = event.payload as {
          terminalId: string;
          result: NonNullable<typeof runtime.terminalReads>[string];
        };
        runtime.terminalReads = {
          ...(runtime.terminalReads ?? {}),
          [payload.terminalId]: payload.result,
        };
        this.state.terminalReadsBySession[sessionId] = {
          ...(this.state.terminalReadsBySession[sessionId] ?? {}),
          [payload.terminalId]: payload.result,
        };
        if (
          payload.result.representation === "snapshot" &&
          payload.result.snapshot &&
          typeof payload.result.snapshot === "object"
        ) {
          const current = this.resolveGlobalTerminalEntry(payload.terminalId);
          if (current) {
            this.reconcileGlobalTerminalEntry({
              ...current,
              seq: typeof payload.result.seq === "number" ? payload.result.seq : current.seq,
              snapshot: {
                ...current.snapshot,
                ...payload.result.snapshot,
              },
            });
          }
        }
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
      } else if (event.type === "runtime.error") {
        const payload = event.payload as { message: string };
        runtime.schedulerState = runtime.schedulerState
          ? {
              ...runtime.schedulerState,
              lastError: payload.message,
            }
          : runtime.schedulerState;
      } else if (event.type === "runtime.scheduler.snapshot") {
        const payload = event.payload as {
          snapshot: {
            state: typeof runtime.schedulerState;
          };
        };
        runtime.schedulerState = payload.snapshot.state;
      } else if (event.type === "runtime.scheduler.signal") {
        const payload = event.payload as {
          kind: "user" | "terminal" | "task" | "attention";
          version: number;
          timestamp: number;
        };
        runtime.schedulerSignals = {
          ...runtime.schedulerSignals,
          [payload.kind]: {
            version: payload.version,
            timestamp: payload.timestamp,
          },
        };
      } else if (event.type === "runtime.scheduler.log") {
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
        const current = this.state.schedulerLogsBySession[sessionId] ?? [];
        this.state.schedulerLogsBySession[sessionId] = this.applyLruEntries(
          this.schedulerLogsAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
      } else if (event.type === "runtime.observability.trace") {
        const payload = event.payload as {
          entry: {
            id: number;
            cycleId: number;
            seq: number;
            traceId: string;
            spanId: string;
            parentSpanId?: string | null;
            kind: string;
            name: string;
            status: "running" | "done" | "error" | "cancelled";
            startedAt: number;
            endedAt: number;
            refs: Array<{ kind: string; ref: string; label?: string; attributes?: Record<string, unknown> }>;
            links: Array<{
              kind: string;
              traceId?: string;
              spanId?: string;
              ref?: { kind: string; ref: string; label?: string; attributes?: Record<string, unknown> };
              attributes?: Record<string, unknown>;
            }>;
            events: Array<{
              id: string;
              name: string;
              timestamp: number;
              status?: "info" | "ok" | "error";
              refs?: Array<{ kind: string; ref: string; label?: string; attributes?: Record<string, unknown> }>;
              attributes?: Record<string, unknown>;
            }>;
            attributes: Record<string, unknown>;
            outcome?: {
              code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
              message?: string;
              retryable?: boolean;
              error?: unknown;
              reason?: string;
            };
          };
        };
        const current = this.state.observabilityTracesBySession[sessionId] ?? [];
        this.state.observabilityTracesBySession[sessionId] = this.applyLruEntries(
          this.observabilityTracesAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
      } else if (event.type === "runtime.heartbeatPart") {
        const payload = event.payload as { entry: HeartbeatPartItem };
        this.applyLiveHeartbeatPart(sessionId, payload.entry);
        this.scheduleHeartbeatGroupRefresh(sessionId);
        this.scheduleHeartbeatRecordRefresh(sessionId);
      } else if (event.type === "runtime.modelCall") {
        const payload = event.payload as { entry: ModelCallItem };
        const current = this.state.modelCallsBySession[sessionId] ?? [];
        this.state.modelCallsBySession[sessionId] = this.applyLruEntries(
          this.modelCallsAccessBySession,
          sessionId,
          current,
          [payload.entry],
          LOOPBUS_LRU_LIMIT,
        );
        this.scheduleHeartbeatGroupRefresh(sessionId);
        this.scheduleHeartbeatRecordRefresh(sessionId);
        void this.loadRequestAux(sessionId, 40).catch(() => undefined);
      } else if (event.type === "runtime.modelCall.delta") {
        const payload = event.payload as {
          entry: {
            id: number;
            seq: number;
            modelCallId: number;
            cycleId: number;
            timestamp: number;
            kind: "assistant_draft" | "tool_call" | "tool_result" | "run_finished";
            data: unknown;
          };
        };
        this.state.modelCallDeltasBySession ??= {};
        const current = this.state.modelCallDeltasBySession[sessionId] ?? [];
        this.state.modelCallDeltasBySession[sessionId] = this.applyLruEntries(
          this.modelCallDeltasAccessBySession,
          sessionId,
          current,
          [payload.entry],
          MODEL_CALL_DELTA_LRU_LIMIT,
        );
        if (payload.entry.kind === "tool_call" || payload.entry.kind === "tool_result") {
          this.scheduleHeartbeatGroupRefresh(sessionId);
          this.scheduleHeartbeatRecordRefresh(sessionId);
        }
      } else if (event.type === "runtime.apiCall") {
        const payload = event.payload as { entry: ApiCallItem };
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
      } else if (event.type === "runtime.attention") {
        const payload = cloneRuntimeAttentionState(event.payload as RuntimeAttentionState);
        runtime.attention = payload;
        this.state.attentionBySession ??= {};
        this.state.attentionBySession[sessionId] = payload;
      } else if (event.type === "runtime.attentionDelivery") {
        const payload = replaceRuntimeAttentionDeliveryState(event.payload as RuntimeAttentionDeliveryState);
        runtime.attentionDelivery = payload;
        this.state.attentionDeliveryBySession[sessionId] = payload;
      } else if (event.type === "runtime.attentionDispatch") {
        const payload = event.payload as {
          dispatch: RuntimeAttentionDeliveryState["dispatches"][number];
          projection: RuntimeAttentionDeliveryState["projections"][number] | null;
        };
        const nextDelivery = patchRuntimeAttentionDeliveryState(
          this.state.attentionDeliveryBySession[sessionId] ??
            runtime.attentionDelivery ??
            createEmptyAttentionDeliveryState(),
          {
            dispatch: payload.dispatch,
            projection: payload.projection,
          },
        );
        runtime.attentionDelivery = nextDelivery;
        this.state.attentionDeliveryBySession[sessionId] = nextDelivery;
      } else if (event.type === "runtime.attentionReceipt") {
        const payload = event.payload as {
          dispatch: RuntimeAttentionDeliveryState["dispatches"][number];
          receipt: RuntimeAttentionDeliveryState["receipts"][number];
          projection: RuntimeAttentionDeliveryState["projections"][number] | null;
        };
        const nextDelivery = patchRuntimeAttentionDeliveryState(
          this.state.attentionDeliveryBySession[sessionId] ??
            runtime.attentionDelivery ??
            createEmptyAttentionDeliveryState(),
          {
            dispatch: payload.dispatch,
            receipt: payload.receipt,
            projection: payload.projection,
          },
        );
        runtime.attentionDelivery = nextDelivery;
        this.state.attentionDeliveryBySession[sessionId] = nextDelivery;
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

  private flushListeners(): void {
    this.pendingEmitFrame = null;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private cancelPendingEmit(): void {
    if (this.pendingEmitFrame === null) {
      return;
    }
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(this.pendingEmitFrame);
    }
    this.pendingEmitFrame = null;
  }

  private emit(): void {
    if (!hasBrowserFrameLoop()) {
      this.flushListeners();
      return;
    }
    if (this.pendingEmitFrame !== null) {
      return;
    }
    this.pendingEmitFrame = window.requestAnimationFrame(() => {
      this.flushListeners();
    });
  }

  private ensureRuntimeScaffold(
    sessionId: string,
    status?: "stopped" | "paused" | "starting" | "running" | "error",
  ): void {
    this.state.attentionBySession ??= {};
    if (!this.state.runtimes[sessionId]) {
      this.state.runtimes[sessionId] = {
        sessionId,
        started: status === "running" || status === "starting" || status === "paused",
        activityState: "idle",
        schedulerPhase: "waiting_commits",
        stage: "idle",
        focusedTerminalId: "",
        focusedTerminalIds: [],
        chatMessages: [],
        terminalSnapshots: {},
        terminalReads: {},
        tasks: [],
        terminals: [],
        schedulerState: null,
        attention: {
          ...createEmptyAttentionState(),
        },
        attentionDelivery: createEmptyAttentionDeliveryState(),
        schedulerSignals: {
          user: { version: 0, timestamp: null },
          terminal: { version: 0, timestamp: null },
          task: { version: 0, timestamp: null },
          attention: { version: 0, timestamp: null },
        },
        apiCallRecording: {
          enabled: false,
          refCount: 0,
        },
        attentionApi: null,
        modelCapabilities: DEFAULT_MODEL_CAPABILITIES,
        activeCycle: null,
      };
    }
    this.state.activityBySession[sessionId] = this.state.activityBySession[sessionId] ?? "idle";
    this.state.terminalSnapshotsBySession[sessionId] = this.state.terminalSnapshotsBySession[sessionId] ?? {};
    this.state.terminalReadsBySession[sessionId] = this.state.terminalReadsBySession[sessionId] ?? {};
    this.state.chatsBySession[sessionId] = this.state.chatsBySession[sessionId] ?? [];
    this.state.messageChannelsBySession[sessionId] =
      this.state.messageChannelsBySession[sessionId] ?? createCachedResourceState<MessageChannelEntry[]>([]);
    this.state.chatCyclesBySession[sessionId] = this.state.chatCyclesBySession[sessionId] ?? [];
    this.state.attentionBySession[sessionId] =
      this.state.attentionBySession[sessionId] ??
      this.state.runtimes[sessionId]?.attention ??
      createEmptyAttentionState();
    this.state.attentionDeliveryBySession[sessionId] =
      this.state.attentionDeliveryBySession[sessionId] ??
      this.state.runtimes[sessionId]?.attentionDelivery ??
      createEmptyAttentionDeliveryState();
    this.state.tasksBySession[sessionId] = this.state.tasksBySession[sessionId] ?? [];
    this.state.schedulerLogsBySession[sessionId] = this.state.schedulerLogsBySession[sessionId] ?? [];
    this.state.observabilityTracesBySession[sessionId] = this.state.observabilityTracesBySession[sessionId] ?? [];
    this.state.apiCallsBySession[sessionId] = this.state.apiCallsBySession[sessionId] ?? [];
    this.state.heartbeatGroupsBySession[sessionId] =
      this.state.heartbeatGroupsBySession[sessionId] ?? createCachedResourceState<HeartbeatGroupItem[]>([]);
    this.state.heartbeatRecordsBySession[sessionId] =
      this.state.heartbeatRecordsBySession[sessionId] ??
      createCachedResourceState<HeartbeatRecordsPageOutput | null>(null);
    this.state.heartbeatRecordDetailsBySession[sessionId] = this.state.heartbeatRecordDetailsBySession[sessionId] ?? {};
    this.state.modelCallsBySession[sessionId] = this.state.modelCallsBySession[sessionId] ?? [];
    this.state.requestAuxBySession[sessionId] = this.state.requestAuxBySession[sessionId] ?? [];
    this.state.modelCallDeltasBySession ??= {};
    this.state.modelCallDeltasBySession[sessionId] = this.state.modelCallDeltasBySession[sessionId] ?? [];
    this.state.terminalActivityBySession[sessionId] = this.state.terminalActivityBySession[sessionId] ?? {};
    this.state.apiCallRecordingBySession[sessionId] = this.state.apiCallRecordingBySession[sessionId] ?? {
      enabled: false,
      refCount: 0,
    };
  }

  private clearRuntimeState(
    sessionId: string,
    status?: "stopped" | "paused" | "starting" | "running" | "error",
    attention?: RuntimeAttentionState,
    attentionDelivery?: RuntimeAttentionDeliveryState,
  ): void {
    this.state.attentionBySession ??= {};
    const previousRuntime = this.state.runtimes[sessionId];
    const nextAttention =
      attention ??
      this.state.attentionBySession[sessionId] ??
      previousRuntime?.attention ??
      createEmptyAttentionState();
    const nextAttentionDelivery =
      attentionDelivery ??
      this.state.attentionDeliveryBySession[sessionId] ??
      previousRuntime?.attentionDelivery ??
      createEmptyAttentionDeliveryState();
    const retainedTerminalSnapshots =
      this.state.terminalSnapshotsBySession[sessionId] ?? previousRuntime?.terminalSnapshots ?? {};
    const retainedTerminalReads = this.state.terminalReadsBySession[sessionId] ?? previousRuntime?.terminalReads ?? {};
    const retainedTasks = this.state.tasksBySession[sessionId] ?? previousRuntime?.tasks ?? [];
    delete this.state.runtimes[sessionId];
    this.state.activityBySession[sessionId] = "idle";
    this.state.terminalSnapshotsBySession[sessionId] = retainedTerminalSnapshots;
    this.state.terminalReadsBySession[sessionId] = retainedTerminalReads;
    this.state.messageChannelsBySession[sessionId] =
      this.state.messageChannelsBySession[sessionId] ?? createCachedResourceState<MessageChannelEntry[]>([]);
    this.state.attentionBySession[sessionId] = nextAttention;
    this.state.attentionDeliveryBySession[sessionId] = nextAttentionDelivery;
    this.state.tasksBySession[sessionId] = retainedTasks;
    this.state.apiCallRecordingBySession[sessionId] = {
      enabled: false,
      refCount: 0,
    };
    if (status) {
      this.ensureRuntimeScaffold(sessionId, status);
      const detachedRuntime = this.state.runtimes[sessionId]!;
      detachedRuntime.started = status === "paused";
      detachedRuntime.activityState = "idle";
      detachedRuntime.schedulerPhase = "waiting_commits";
      detachedRuntime.stage = "idle";
      detachedRuntime.activeCycle = null;
      detachedRuntime.attention = this.state.attentionBySession[sessionId];
      detachedRuntime.attentionDelivery = this.state.attentionDeliveryBySession[sessionId];
      detachedRuntime.terminals = previousRuntime?.terminals ?? detachedRuntime.terminals;
      detachedRuntime.terminalReads = retainedTerminalReads;
      detachedRuntime.terminalSnapshots = retainedTerminalSnapshots;
      detachedRuntime.tasks = retainedTasks;
      detachedRuntime.chatMessages =
        this.state.chatsBySession[sessionId] ?? previousRuntime?.chatMessages ?? detachedRuntime.chatMessages;
      detachedRuntime.focusedTerminalId = previousRuntime?.focusedTerminalId ?? detachedRuntime.focusedTerminalId;
      detachedRuntime.focusedTerminalIds = previousRuntime?.focusedTerminalIds ?? detachedRuntime.focusedTerminalIds;
      detachedRuntime.schedulerState = this.toDetachedSchedulerState(previousRuntime?.schedulerState ?? null, status);
      detachedRuntime.schedulerSignals = previousRuntime?.schedulerSignals ?? detachedRuntime.schedulerSignals;
      detachedRuntime.apiCallRecording = {
        enabled: false,
        refCount: 0,
      };
      detachedRuntime.attentionApi = previousRuntime?.attentionApi ?? detachedRuntime.attentionApi;
      detachedRuntime.modelCapabilities = previousRuntime?.modelCapabilities ?? detachedRuntime.modelCapabilities;
    }
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
    stream.sub = null;
    this.apiCallStreams.delete(sessionId);
  }

  private async hydrateRuntime(sessionId: string, observabilityMode: "full" | "heartbeat" = "full"): Promise<void> {
    const snapshot = await this.client.trpc.runtime.snapshot.query();
    const sessionsById = new Map(this.state.sessions.map((session) => [session.id, session]));
    for (const session of snapshot.sessions) {
      sessionsById.set(session.id, session);
    }
    this.state.sessions = sortSessions([...sessionsById.values()]);
    this.state.attentionBySession ??= {};
    for (const session of snapshot.sessions) {
      this.ensureRuntimeScaffold(session.id, session.status);
    }
    const runtime = snapshot.runtimes[sessionId];
    if (!runtime) {
      const session = this.state.sessions.find((item) => item.id === sessionId);
      const persistedAttention = session ? await this.inspectAttentionState(sessionId) : createEmptyAttentionState();
      this.clearRuntimeState(sessionId, session?.status, persistedAttention);
      this.state.lastEventId = Math.max(this.state.lastEventId, snapshot.lastEventId);
      this.emit();
      await this.hydrateObservabilityArtifacts(sessionId, observabilityMode);
      return;
    }
    const normalizedRuntime = this.normalizeRuntimeEntry(runtime);
    this.state.runtimes[sessionId] = normalizedRuntime;
    this.state.activityBySession[sessionId] = normalizedRuntime.activityState ?? "idle";
    this.state.terminalSnapshotsBySession[sessionId] = normalizedRuntime.terminalSnapshots ?? {};
    this.state.terminalReadsBySession[sessionId] = normalizedRuntime.terminalReads ?? {};
    this.state.chatsBySession[sessionId] = this.mergeChatMessages(
      this.state.chatsBySession[sessionId] ?? [],
      normalizedRuntime.chatMessages ?? [],
    );
    this.state.messageChannelsBySession[sessionId] = normalizedRuntime.messageChannels
      ? createHydratedCachedResourceState(normalizedRuntime.messageChannels)
      : (this.state.messageChannelsBySession[sessionId] ?? createCachedResourceState<MessageChannelEntry[]>([]));
    this.state.chatCyclesBySession[sessionId] = normalizedRuntime.activeCycle
      ? this.mergeChatCycles(this.state.chatCyclesBySession[sessionId] ?? [], [normalizedRuntime.activeCycle])
      : (this.state.chatCyclesBySession[sessionId] ?? []);
    this.state.attentionBySession[sessionId] = normalizedRuntime.attention ?? createEmptyAttentionState();
    this.state.attentionDeliveryBySession[sessionId] =
      normalizedRuntime.attentionDelivery ?? createEmptyAttentionDeliveryState();
    this.state.tasksBySession[sessionId] = normalizedRuntime.tasks ?? [];
    this.state.schedulerLogsBySession[sessionId] = this.state.schedulerLogsBySession[sessionId] ?? [];
    this.state.observabilityTracesBySession[sessionId] = this.state.observabilityTracesBySession[sessionId] ?? [];
    this.state.apiCallsBySession[sessionId] = this.state.apiCallsBySession[sessionId] ?? [];
    this.state.heartbeatGroupsBySession[sessionId] =
      this.state.heartbeatGroupsBySession[sessionId] ?? createCachedResourceState<HeartbeatGroupItem[]>([]);
    this.state.heartbeatRecordsBySession[sessionId] =
      this.state.heartbeatRecordsBySession[sessionId] ??
      createCachedResourceState<HeartbeatRecordsPageOutput | null>(null);
    this.state.heartbeatRecordDetailsBySession[sessionId] = this.state.heartbeatRecordDetailsBySession[sessionId] ?? {};
    this.state.modelCallsBySession[sessionId] = this.state.modelCallsBySession[sessionId] ?? [];
    this.state.requestAuxBySession[sessionId] = this.state.requestAuxBySession[sessionId] ?? [];
    this.state.apiCallRecordingBySession[sessionId] = runtime.apiCallRecording;
    this.state.lastEventId = Math.max(this.state.lastEventId, snapshot.lastEventId);
    this.emit();
    await this.hydrateObservabilityArtifacts(sessionId, observabilityMode);
  }

  private async hydrateObservabilityArtifacts(sessionId: string, mode: "full" | "heartbeat" = "full"): Promise<void> {
    const heartbeatOnly = mode === "heartbeat";
    const [logs, traces, , , modelCalls, requestAux, apiCalls] = await Promise.allSettled([
      heartbeatOnly ? Promise.resolve(null) : this.client.trpc.runtime.schedulerLogs.query({ sessionId, limit: 200 }),
      heartbeatOnly
        ? Promise.resolve(null)
        : this.client.trpc.runtime.observabilityTraces.query({ sessionId, limit: 200 }),
      this.loadHeartbeatGroups(sessionId, HEARTBEAT_GROUP_PAGE_LIMIT),
      this.loadHeartbeatRecords(sessionId, {
        pageSize: HEARTBEAT_RECORD_PAGE_LIMIT,
        anchor: { kind: "latest" },
      }),
      this.client.trpc.runtime.modelCallsPage.query({ sessionId, limit: heartbeatOnly ? 12 : 200 }),
      heartbeatOnly ? Promise.resolve(null) : this.client.trpc.runtime.requestAuxPage.query({ sessionId, limit: 200 }),
      heartbeatOnly ? Promise.resolve(null) : this.client.trpc.runtime.apiCallsPage.query({ sessionId, limit: 200 }),
    ]);

    let shouldEmit = false;
    if (!heartbeatOnly && logs.status === "fulfilled" && logs.value) {
      this.state.schedulerLogsBySession[sessionId] = this.applyLruEntries(
        this.schedulerLogsAccessBySession,
        sessionId,
        this.state.schedulerLogsBySession[sessionId] ?? [],
        logs.value.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.updateBeforeCursor(this.schedulerLogsBeforeCursorBySession, sessionId, logs.value.nextBefore);
      shouldEmit = true;
    }
    if (!heartbeatOnly && traces.status === "fulfilled" && traces.value) {
      this.state.observabilityTracesBySession[sessionId] = this.applyLruEntries(
        this.observabilityTracesAccessBySession,
        sessionId,
        this.state.observabilityTracesBySession[sessionId] ?? [],
        traces.value.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.updateBeforeCursor(this.observabilityTracesBeforeCursorBySession, sessionId, traces.value.nextBefore);
      shouldEmit = true;
    }
    if (modelCalls.status === "fulfilled") {
      this.state.modelCallsBySession[sessionId] = this.applyLruEntries(
        this.modelCallsAccessBySession,
        sessionId,
        this.state.modelCallsBySession[sessionId] ?? [],
        modelCalls.value.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.updateBeforeCursor(this.modelCallsBeforeCursorBySession, sessionId, modelCalls.value.nextBefore);
      shouldEmit = true;
    }
    if (!heartbeatOnly && requestAux.status === "fulfilled" && requestAux.value) {
      this.state.requestAuxBySession[sessionId] = this.applyLruEntries(
        this.requestAuxAccessBySession,
        sessionId,
        this.state.requestAuxBySession[sessionId] ?? [],
        requestAux.value.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.updateBeforeCursor(this.requestAuxBeforeCursorBySession, sessionId, requestAux.value.nextBefore);
      shouldEmit = true;
    }
    if (!heartbeatOnly && apiCalls.status === "fulfilled" && apiCalls.value) {
      this.state.apiCallsBySession[sessionId] = this.applyLruEntries(
        this.apiCallsAccessBySession,
        sessionId,
        this.state.apiCallsBySession[sessionId] ?? [],
        apiCalls.value.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.updateBeforeCursor(this.apiCallsBeforeCursorBySession, sessionId, apiCalls.value.nextBefore);
      shouldEmit = true;
    }
    if (shouldEmit) {
      this.emit();
    }
  }

  private upsertSession(session: SessionEntry): void {
    const next = this.state.sessions.filter((item) => item.id !== session.id);
    next.push(session);
    this.state.sessions = sortSessions(next);
    if (session.status === "stopped" || session.status === "paused") {
      this.clearRuntimeState(session.id, session.status, this.state.attentionBySession?.[session.id]);
    } else {
      this.ensureRuntimeScaffold(session.id, session.status);
    }
    this.emit();
  }
}

export const createRuntimeStore = (client: AgenterClient): RuntimeStore => new RuntimeStore(client);
