import type { AgenterClient, AgenterTransportEvent } from "./trpc-client";
import type {
  AuthServiceInfoOutput,
  AuthSessionOutput,
  AttentionQueryItem,
  CachedResourceState,
  ChatCycleItem,
  ChatListItem,
  DraftResolutionOutput,
  GlobalRoomActorId,
  GlobalRoomAssetEntry,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalRoomGrantIssueOutput,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  GlobalTerminalApprovalRequest,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  GlobalTerminalGrantIssueOutput,
  HistoryPageCursor,
  MessageChannelEntry,
  MessageChannelGrantEntry,
  NotificationSnapshotOutput,
  RuntimeAttentionState,
  TerminalActivityItem,
  RuntimeChatCycle,
  RuntimeChatMessage,
  RuntimeClientState,
  ProfileServiceInfoOutput,
  RuntimeEvent,
  RuntimeSchedulerContainmentState,
  RuntimeSnapshotEntry,
  SessionEntry,
  UploadedSessionAsset,
  WorkspacePathSearchOutput,
  WorkspaceAvatarCatalogEntry,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceSessionTab,
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
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
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
  globalTerminalGrantsById: {},
  globalTerminalApprovalsById: {},
  globalTerminalActivityById: {},
  schedulerLogsBySession: {},
  observabilityTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  modelCallDeltasBySession: {},
  terminalActivityBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession: {},
  unreadByChat: {},
  unreadByTerminal: {},
});

type Listener = (state: RuntimeClientState) => void;
type SubscriptionHandle = { unsubscribe: () => void };
type ApiCallStreamHandle = { count: number; sub: SubscriptionHandle | null; cursor: number };
type HistoryCursorValue = HistoryPageCursor | null;
type SessionResourceHandle = { sessionId: string };
type GlobalRoomSnapshotRefreshTask = {
  promise: Promise<GlobalRoomSnapshotOutput | null>;
  query: { accessToken?: string; limit?: number };
};
type GlobalRoomAssetsRefreshTask = {
  promise: Promise<GlobalRoomAssetEntry[]>;
  query: { accessToken?: string };
};
type GlobalTerminalActivityRefreshTask = {
  promise: Promise<TerminalActivityItem[]>;
  limit: number;
};

const sortSessions = (sessions: SessionEntry[]): SessionEntry[] => {
  return [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const LOOPBUS_LRU_LIMIT = 100;
const MODEL_CALL_DELTA_LRU_LIMIT = 400;
const DEFAULT_MESSAGE_CHAT_ID = "room-main";
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

const hasRenderableTerminalCwd = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0 && value.trim() !== ".";

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
  return incoming.seq >= current.seq ? incoming : current;
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
    cwd: hasRenderableTerminalCwd(incoming.cwd) ? incoming.cwd : current.cwd,
    snapshot: mergeTerminalSnapshot(current.snapshot, incoming.snapshot),
    rendererEngine: incoming.rendererEngine ?? current.rendererEngine,
    transportUrl: incoming.transportUrl ?? current.transportUrl,
    title: incoming.title ?? current.title,
    icon: incoming.icon ?? current.icon,
    shortcuts: incoming.shortcuts ?? current.shortcuts,
    currentAdminId: incoming.currentAdminId ?? current.currentAdminId,
    approvalTimeoutMs: incoming.approvalTimeoutMs ?? current.approvalTimeoutMs,
    pendingRequestCount: incoming.pendingRequestCount ?? current.pendingRequestCount,
    access: incoming.access ?? current.access,
    actors: incoming.actors ?? current.actors,
  };
};

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
    left.role === right.role &&
    (left.attentionState ?? null) === (right.attentionState ?? null) &&
    (left.attentionLoadedAt ?? null) === (right.attentionLoadedAt ?? null) &&
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
  private shouldReconnect = false;
  private readonly sessionResourceHandles = new Map<string, SessionResourceHandle>();
  private readonly messageChannelRefreshTasks = new WeakMap<SessionResourceHandle, Promise<MessageChannelEntry[]>>();
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
  private globalTerminalsRefreshTask: Promise<GlobalTerminalEntry[]> | null = null;
  private globalTerminalsWatchCount = 0;
  private readonly globalTerminalGrantRefreshTasks = new Map<string, Promise<GlobalTerminalGrantEntry[]>>();
  private readonly globalTerminalGrantWatchCountById = new Map<string, number>();
  private readonly globalTerminalApprovalRefreshTasks = new Map<string, Promise<GlobalTerminalApprovalRequest[]>>();
  private readonly globalTerminalApprovalWatchCountById = new Map<string, number>();
  private readonly globalTerminalActivityRefreshTasks = new Map<string, GlobalTerminalActivityRefreshTask>();
  private readonly globalTerminalActivityWatchCountById = new Map<string, number>();
  private readonly apiCallStreams = new Map<string, ApiCallStreamHandle>();
  private readonly schedulerLogsAccessBySession = new Map<string, Map<number, number>>();
  private readonly observabilityTracesAccessBySession = new Map<string, Map<number, number>>();
  private readonly apiCallsAccessBySession = new Map<string, Map<number, number>>();
  private readonly modelCallsAccessBySession = new Map<string, Map<number, number>>();
  private readonly modelCallDeltasAccessBySession = new Map<string, Map<number, number>>();
  private readonly schedulerLogsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly observabilityTracesBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly apiCallsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
  private readonly modelCallsBeforeCursorBySession = new Map<string, HistoryCursorValue>();
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

  private resolveHttpUrl(pathname: string): string {
    return `${withTrailingSlashTrimmed(this.client.httpUrl)}${pathname}`;
  }

  private resolveMediaUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return url.startsWith("/") ? this.resolveHttpUrl(url) : url;
  }

  private buildProfileServiceUrl(pathname: string): string | null {
    const endpoint = this.state.profileService?.endpoint;
    return endpoint ? `${withTrailingSlashTrimmed(endpoint)}${pathname}` : null;
  }

  private async ensureProfileServiceInfo(): Promise<AuthServiceInfoOutput> {
    if (this.state.profileService) {
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

  async getAuthServiceDescriptor(): Promise<AuthServiceInfoOutput> {
    return await this.ensureProfileServiceInfo();
  }

  async listAuthActors() {
    const output = await this.client.trpc.auth.actors.query();
    return output.items;
  }

  async startAuthChallenge(authId: string) {
    return await this.client.trpc.auth.challengeStart.mutate({ authId });
  }

  async revealManagedRootAuthPrivateKey() {
    return await this.client.trpc.auth.bootstrapManagedKey.mutate();
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

  async getSuperadminStatus() {
    return await this.client.trpc.auth.superadminStatus.query();
  }

  private normalizeRuntimeChatMessage(message: RuntimeChatMessage): RuntimeChatMessage {
    return {
      ...message,
      cycleId: message.cycleId ?? null,
      updatedAt: message.updatedAt ?? message.timestamp,
      visibleAt: message.visibleAt,
      attentionState: message.attentionState,
      attentionLoadedAt: message.attentionLoadedAt,
      editable: message.editable ?? message.attentionState === "queued",
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
      chatId: item.chatId ?? DEFAULT_MESSAGE_CHAT_ID,
      role: item.role,
      content: item.content,
      timestamp: item.timestamp,
      updatedAt: item.updatedAt ?? item.timestamp,
      visibleAt: item.visibleAt,
      attentionState: item.attentionState,
      attentionLoadedAt: item.attentionLoadedAt,
      editable: item.attentionState === "queued",
      cycleId: item.cycleId ?? null,
      channel: normalizeChatChannel(item.channel as RuntimeChatMessage["channel"] | "user_input" | null | undefined),
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

  private ensureWorkspaceAvatarCatalogState(workspacePath: string): CachedResourceState<WorkspaceAvatarCatalogEntry[]> {
    return this.state.workspaceAvatarCatalogByPath[workspacePath] ?? createCachedResourceState<WorkspaceAvatarCatalogEntry[]>([]);
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
    const optimisticEntry: WorkspaceAvatarCatalogEntry = {
      nickname: optimisticNickname,
      defaultAvatar: optimisticNickname === "default",
      sourceScope: "workspace",
      globalAvailable: false,
      workspaceAvailable: true,
      globalPath: sourceEntry?.globalPath ?? "",
      workspacePath: sourceEntry?.workspacePath ?? "",
      effectivePath: sourceEntry?.workspacePath ?? "",
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
    return this.state.globalRoomSnapshotsById[chatId] ?? createCachedResourceState<GlobalRoomSnapshotOutput | null>(null);
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
      accessToken: input.accessToken ?? previous.accessToken ?? fromCatalog?.accessToken,
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

  private resolveGlobalRoomGrantQuery(
    chatId: string,
    input: { accessToken?: string } = {},
  ): { accessToken?: string } {
    const previous = this.globalRoomGrantQueryById.get(chatId) ?? {};
    const fromCatalog = this.resolveGlobalRoomEntry(chatId);
    const next = {
      accessToken: input.accessToken ?? previous.accessToken ?? fromCatalog?.accessToken,
    };
    this.globalRoomGrantQueryById.set(chatId, next);
    return next;
  }

  private resolveGlobalRoomAssetQuery(
    chatId: string,
    input: { accessToken?: string } = {},
  ): { accessToken?: string } {
    const previous = this.globalRoomAssetQueryById.get(chatId) ?? {};
    const fromCatalog = this.resolveGlobalRoomEntry(chatId);
    const next = {
      accessToken: input.accessToken ?? previous.accessToken ?? fromCatalog?.accessToken,
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
      .query({})
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
    if (inflight && this.sameGlobalRoomSnapshotQuery(inflight.query, query)) {
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
        this.reconcileGlobalRoomEntry(snapshot.channel);
        this.setGlobalRoomSnapshotState(chatId, (resource) => ({
          ...resource,
          data: snapshot,
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

  private ensureGlobalTerminalApprovalsState(
    terminalId: string,
  ): CachedResourceState<GlobalTerminalApprovalRequest[]> {
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
    updater: (
      current: CachedResourceState<TerminalActivityItem[]>,
    ) => CachedResourceState<TerminalActivityItem[]>,
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
    this.emit();
  }

  private resolveGlobalTerminalEntry(terminalId: string): GlobalTerminalEntry | null {
    return this.state.globalTerminals.data.find((terminal) => terminal.terminalId === terminalId) ?? null;
  }

  private reconcileGlobalTerminalEntry(entry: GlobalTerminalEntry): void {
    this.setGlobalTerminalsState((resource) => {
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
        this.setGlobalTerminalsState((resource) => ({
          ...resource,
          data: output.items.map((entry) =>
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
        return output.items;
      })
      .catch((error) => {
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
    const limit = input.limit ?? 120;
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
      .query({ sessionId })
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
      modelCapabilities: runtime.modelCapabilities ?? DEFAULT_MODEL_CAPABILITIES,
    };
  }

  private applyNotificationSnapshot(snapshot: NotificationSnapshotOutput): void {
    this.state.notifications = snapshot.items;
    this.state.unreadBySession = snapshot.unreadBySession;
    this.state.unreadByChat = snapshot.unreadByChat;
    this.state.unreadByTerminal = snapshot.unreadByTerminal;
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
    if (this.browserListenersAttached || typeof window === "undefined") {
      return;
    }
    window.addEventListener("online", this.handleBrowserOnline);
    window.addEventListener("offline", this.handleBrowserOffline);
    this.browserListenersAttached = true;
  }

  private detachBrowserListeners(): void {
    if (!this.browserListenersAttached || typeof window === "undefined") {
      return;
    }
    window.removeEventListener("online", this.handleBrowserOnline);
    window.removeEventListener("offline", this.handleBrowserOffline);
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
    this.schedulerLogsAccessBySession.clear();
    this.observabilityTracesAccessBySession.clear();
    this.apiCallsAccessBySession.clear();
    this.modelCallsAccessBySession.clear();
    this.modelCallDeltasAccessBySession.clear();
    this.schedulerLogsBeforeCursorBySession.clear();
    this.observabilityTracesBeforeCursorBySession.clear();
    this.apiCallsBeforeCursorBySession.clear();
    this.modelCallsBeforeCursorBySession.clear();
    this.chatBeforeCursorBySession.clear();
    this.chatCyclesBeforeCursorBySession.clear();
    this.terminalActivityBeforeCursorByKey.clear();
    this.sessionResourceHandles.clear();
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
    if (this.connecting) {
      return;
    }
    if (this.getBrowserOnlineState() === false) {
      this.setConnectionStatus("offline");
      this.emit();
      return;
    }
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
      this.state = {
        ...previousState,
        sessions: sortSessions(snapshot.sessions),
        runtimes,
        profileService: profileService ?? previousState.profileService ?? null,
        lastEventId: snapshot.lastEventId,
        recentWorkspaces: recentWorkspaces.items,
        activityBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.activityState ?? "idle"]),
        ),
        terminalSnapshotsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.terminalSnapshots ?? {}]),
        ),
        terminalReadsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.terminalReads ?? {}]),
        ),
        chatsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.chatMessages ?? []]),
        ),
        messageChannelsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [
            sessionId,
            runtime.messageChannels
              ? createHydratedCachedResourceState(runtime.messageChannels)
              : (previousState.messageChannelsBySession[sessionId] ??
                createCachedResourceState<MessageChannelEntry[]>([])),
          ]),
        ),
        chatCyclesBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [
            sessionId,
            runtime.activeCycle ? [runtime.activeCycle] : [],
          ]),
        ),
        attentionBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [
            sessionId,
            runtime.attention ?? createEmptyAttentionState(),
          ]),
        ),
        tasksBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.tasks ?? []]),
        ),
        schedulerLogsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId]) => [
            sessionId,
            previousState.schedulerLogsBySession[sessionId] ?? [],
          ]),
        ),
        observabilityTracesBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId]) => [
            sessionId,
            previousState.observabilityTracesBySession[sessionId] ?? [],
          ]),
        ),
        apiCallsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId]) => [sessionId, previousState.apiCallsBySession[sessionId] ?? []]),
        ),
        modelCallsBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId]) => [
            sessionId,
            previousState.modelCallsBySession[sessionId] ?? [],
          ]),
        ),
        modelCallDeltasBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId]) => [
            sessionId,
            previousState.modelCallDeltasBySession?.[sessionId] ?? [],
          ]),
        ),
        apiCallRecordingBySession: Object.fromEntries(
          Object.entries(runtimes).map(([sessionId, runtime]) => [sessionId, runtime.apiCallRecording]),
        ),
        workspaces: previousState.workspaces,
        workspaceAvatarCatalogByPath: previousState.workspaceAvatarCatalogByPath,
        globalRooms: previousState.globalRooms,
        globalRoomSnapshotsById: previousState.globalRoomSnapshotsById,
        globalRoomGrantsById: previousState.globalRoomGrantsById,
        globalTerminals: previousState.globalTerminals,
        globalTerminalGrantsById: previousState.globalTerminalGrantsById,
        globalTerminalApprovalsById: previousState.globalTerminalApprovalsById,
        globalTerminalActivityById: previousState.globalTerminalActivityById,
        notifications: previousState.notifications,
        unreadBySession: previousState.unreadBySession,
        unreadByChat: previousState.unreadByChat,
        unreadByTerminal: previousState.unreadByTerminal,
      };
      this.setConnectionStatus("connected");
      for (const session of this.state.sessions) {
        this.ensureRuntimeScaffold(session.id, session.status);
      }

      this.reconnectAttempt = 0;
      this.clearReconnectTimer();

      this.eventSub?.unsubscribe();
      this.eventSub = this.subscribeRuntimeEvents(snapshot.lastEventId);
      this.restoreRetainedApiCallStreams();
      this.emit();
      for (const [workspacePath, resource] of Object.entries(previousState.workspaceAvatarCatalogByPath)) {
        if (!resource.loaded && !this.workspaceAvatarCatalogWatchCountByPath.has(workspacePath)) {
          continue;
        }
        void this.hydrateWorkspaceAvatarCatalog(workspacePath, { force: true });
      }
      if (previousState.globalRooms.loaded || this.globalRoomsWatchCount > 0) {
        void this.hydrateGlobalRooms({ force: true });
      }
      for (const [chatId, resource] of Object.entries(previousState.globalRoomSnapshotsById)) {
        if (!resource.loaded && !this.globalRoomSnapshotWatchCountById.has(chatId)) {
          continue;
        }
        void this.hydrateGlobalRoomSnapshot({ chatId, force: true });
      }
      for (const [chatId, resource] of Object.entries(previousState.globalRoomGrantsById)) {
        if (!resource.loaded && !this.globalRoomGrantWatchCountById.has(chatId)) {
          continue;
        }
        void this.hydrateGlobalRoomGrants({ chatId, force: true });
      }
      if (previousState.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
        void this.hydrateGlobalTerminals({ force: true });
      }
      for (const [terminalId, resource] of Object.entries(previousState.globalTerminalGrantsById)) {
        if (!resource.loaded && !this.globalTerminalGrantWatchCountById.has(terminalId)) {
          continue;
        }
        void this.hydrateGlobalTerminalGrants({ terminalId, force: true });
      }
      for (const [terminalId, resource] of Object.entries(previousState.globalTerminalApprovalsById)) {
        if (!resource.loaded && !this.globalTerminalApprovalWatchCountById.has(terminalId)) {
          continue;
        }
        void this.hydrateGlobalTerminalApprovals({ terminalId, force: true });
      }
      for (const [terminalId, resource] of Object.entries(previousState.globalTerminalActivityById)) {
        if (!resource.loaded && !this.globalTerminalActivityWatchCountById.has(terminalId)) {
          continue;
        }
        void this.hydrateGlobalTerminalActivity({ terminalId, force: true });
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
        void this.client.trpc.notification.snapshot
          .query()
          .then((notifications) => {
            if (connectSequence !== this.connectSequence || this.state.connectionStatus !== "connected") {
              return;
            }
            this.applyNotificationSnapshot(notifications);
            this.emit();
          })
          .catch(() => {
            // Keep the last known notification snapshot until the next refresh succeeds.
          });
      });
    } catch {
      this.handleTransportLoss("error");
    } finally {
      this.connecting = false;
    }
  }

  private handleTransportLoss(_reason: "close" | "error" | "offline"): void {
    const nextStatus = this.resolveDisconnectedStatus();
    this.eventSub?.unsubscribe();
    this.eventSub = null;
    this.pauseRetainedApiCallStreams();
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
    delete this.state.tasksBySession[sessionId];
    delete this.state.schedulerLogsBySession[sessionId];
    delete this.state.observabilityTracesBySession[sessionId];
    delete this.state.apiCallsBySession[sessionId];
    delete this.state.modelCallsBySession[sessionId];
    delete this.state.modelCallDeltasBySession?.[sessionId];
    delete this.state.terminalActivityBySession[sessionId];
    delete this.state.apiCallRecordingBySession[sessionId];
    this.schedulerLogsAccessBySession.delete(sessionId);
    this.observabilityTracesAccessBySession.delete(sessionId);
    this.apiCallsAccessBySession.delete(sessionId);
    this.modelCallsAccessBySession.delete(sessionId);
    this.modelCallDeltasAccessBySession.delete(sessionId);
    this.schedulerLogsBeforeCursorBySession.delete(sessionId);
    this.observabilityTracesBeforeCursorBySession.delete(sessionId);
    this.apiCallsBeforeCursorBySession.delete(sessionId);
    this.modelCallsBeforeCursorBySession.delete(sessionId);
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

  getWorkspaceAvatarCatalogState(workspacePath: string): CachedResourceState<WorkspaceAvatarCatalogEntry[]> {
    return this.ensureWorkspaceAvatarCatalogState(workspacePath);
  }

  retainWorkspaceAvatarCatalog(workspacePath: string): () => void {
    this.workspaceAvatarCatalogWatchCountByPath.set(
      workspacePath,
      (this.workspaceAvatarCatalogWatchCountByPath.get(workspacePath) ?? 0) + 1,
    );
    this.state.workspaceAvatarCatalogByPath[workspacePath] =
      this.state.workspaceAvatarCatalogByPath[workspacePath] ?? createCachedResourceState<WorkspaceAvatarCatalogEntry[]>([]);
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
    void this.hydrateWorkspaceAvatarCatalog(input.workspacePath, { force: true });
    return output.avatar;
  }

  async copyWorkspaceAvatar(input: {
    workspacePath: string;
    sourceAvatar: string;
    targetAvatar: string;
  }) {
    const optimistic = this.insertOptimisticWorkspaceAvatarCopy(input);
    try {
      const output = await this.client.trpc.workspace.copyAvatar.mutate(input);
      this.reconcileWorkspaceAvatarCatalogEntry(input.workspacePath, output.avatar, optimistic.optimisticNickname);
      this.emit();
      void this.hydrateWorkspaceAvatarCatalog(input.workspacePath, { force: true });
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
    accessRole: "admin" | "writer" | "requester" | "readonly";
    state?: "active" | "credential-invalid";
  }) {
    return await this.client.trpc.workspace.saveAvatarTerminalSeat.mutate(input);
  }

  async inspectAttentionState(sessionId: string): Promise<RuntimeAttentionState> {
    return await this.client.trpc.runtime.attentionState.query({ sessionId });
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
    const response = await fetch(this.resolveHttpUrl(`/api/sessions/${encodeURIComponent(sessionId)}/assets`), {
      method: "POST",
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

  async uploadRoomAssets(
    chatId: string,
    accessToken: string,
    files: File[],
  ): Promise<GlobalRoomAssetEntry[]> {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file, file.name);
    }
    const response = await fetch(this.resolveHttpUrl(`/api/rooms/${encodeURIComponent(chatId)}/assets`), {
      method: "POST",
      headers: {
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

  roomIconUrl(roomId: string): string | null {
    return this.buildProfileServiceUrl(`/media/rooms/${encodeURIComponent(roomId)}/icon`);
  }

  async uploadSessionIcon(sessionId: string, file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
    const response = await fetch(await this.resolveProfileServiceUrl(`/sessions/${encodeURIComponent(sessionId)}/icon`), {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });
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
    const response = await fetch(await this.resolveProfileServiceUrl(`/profiles/${encodeURIComponent(reference)}/icon`), {
      method: "POST",
      headers: {
        authorization: `Bearer ${authorizationToken}`,
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });
    const payload = (await response.json()) as { ok: boolean; url?: string; iconUrl?: string; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `profile icon upload failed (${response.status})`);
    }
    return {
      ok: true,
      url: payload.url ?? payload.iconUrl,
    };
  }

  async sendChat(
    sessionId: string,
    text: string,
    assetIds: string[] = [],
    attachments: UploadedSessionAsset[] = [],
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
  ): Promise<void> {
    const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    void attachments;
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

  async listGlobalRoomAssets(input: {
    chatId: string;
    accessToken?: string;
  }): Promise<GlobalRoomAssetEntry[]> {
    return await this.refreshGlobalRoomAssetsInternal(input.chatId, {
      accessToken: input.accessToken,
      force: true,
    });
  }

  async createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    participants?: Array<{ id: string; label?: string }>;
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
    const output = await this.client.trpc.message.globalFocus.mutate(input);
    for (const channel of input.channels) {
      if (!this.shouldRefreshGlobalRoomSnapshot(channel.chatId)) {
        continue;
      }
      void this.hydrateGlobalRoomSnapshot({
        chatId: channel.chatId,
        accessToken: channel.accessToken,
        force: true,
      });
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
      throw new Error(`global room snapshot missing: ${input.chatId}`);
    }
    return snapshot;
  }

  async markGlobalRoomRead(input: {
    chatId: string;
    accessToken?: string;
    messageId?: string;
    readAt?: number;
  }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalMarkRead.mutate(input);
    this.reconcileGlobalRoomEntry(output.channel);
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
    this.emit();
    return output.channel;
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
  }> {
    const output = await this.client.trpc.message.globalPage.query({
      chatId: input.chatId,
      accessToken: input.accessToken,
      before: input.before ?? undefined,
      limit: input.limit,
    });
    return {
      items: output.items,
      hasMore: output.hasMoreBefore,
      nextBefore: output.nextBefore,
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
    return await this.client.trpc.message.globalSend.mutate(input);
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
    const output = await this.client.trpc.message.globalUpdate.mutate(input);
    this.reconcileGlobalRoomEntry(output.channel);
    this.emit();
    return output.channel;
  }

  async archiveGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
    archivedBy?: string;
  }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalArchive.mutate(input);
    this.removeGlobalRoomEntry(output.channel.chatId);
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

  async deleteGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
  }): Promise<GlobalRoomEntry> {
    const output = await this.client.trpc.message.globalDelete.mutate(input);
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

  async listGlobalRoomGrants(input: {
    chatId: string;
    accessToken?: string;
  }): Promise<GlobalRoomGrantEntry[]> {
    return await this.refreshGlobalRoomGrantsInternal(input.chatId, {
      accessToken: input.accessToken,
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
    const output = await this.client.trpc.message.globalIssueGrant.mutate(input);
    this.setGlobalRoomGrantsState(input.chatId, (resource) => ({
      ...resource,
      data: resource.data
        .filter((grant) => grant.grantId !== output.grant.grantId)
        .concat(output.grant),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: Date.now(),
    }));
    this.emit();
    void this.hydrateGlobalRoomSnapshot({
      chatId: input.chatId,
      accessToken: input.accessToken,
      force: true,
    }).catch(() => undefined);
    return output.grant;
  }

  async revokeGlobalRoomGrant(input: {
    chatId: string;
    accessToken?: string;
    grantId: string;
  }): Promise<{ ok: boolean }> {
    const output = await this.client.trpc.message.globalRevokeGrant.mutate(input);
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
    void this.hydrateGlobalRoomSnapshot({
      chatId: input.chatId,
      accessToken: input.accessToken,
      force: true,
    }).catch(() => undefined);
    return output;
  }

  async listTerminals(sessionId: string): Promise<
    Array<{
      terminalId: string;
      processKind: string;
      command: string[];
      cwd: string;
      workspace: string | null;
      running: boolean;
      status: "IDLE" | "BUSY";
      seq: number;
      focused: boolean;
      icon?: string;
      title?: string;
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

  async hydrateGlobalTerminals(input: { force?: boolean } = {}): Promise<GlobalTerminalEntry[]> {
    return await this.refreshGlobalTerminalsInternal(input);
  }

  async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
    return await this.hydrateGlobalTerminals({ force: true });
  }

  async createGlobalTerminal(input: {
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
  }): Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }> {
    const output = await this.client.trpc.terminal.globalCreate.mutate(input);
    if (output.result.terminal) {
      this.reconcileGlobalTerminalEntry(output.result.terminal);
      this.emit();
    }
    return output.result;
  }

  async focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    const output = await this.client.trpc.terminal.globalFocus.mutate(input);
    if (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
      void this.hydrateGlobalTerminals({ force: true }).catch(() => undefined);
    }
    return output;
  }

  async deleteGlobalTerminal(input: { terminalId: string }): Promise<{ ok: boolean; message: string }> {
    const output = await this.client.trpc.terminal.globalDelete.mutate(input);
    if (output.ok) {
      this.removeGlobalTerminalEntry(input.terminalId);
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
  }) {
    const output = await this.client.trpc.terminal.read.query(input);
    const readFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) && typeof output.eventId === "number"
        ? ({
        id: output.eventId,
        terminalId: output.terminalId,
        createdAt: Date.now(),
        kind: "terminal_read",
        cycleId: null,
        actorId: undefined,
        title: "Terminal read",
        content: JSON.stringify(output),
        detail: output,
      } satisfies TerminalActivityItem)
        : null;
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    const refreshes: Array<Promise<unknown>> = [];
    if (this.shouldRefreshGlobalTerminalActivity(input.terminalId)) {
      refreshes.push(
        this.hydrateGlobalTerminalActivity({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (refreshes.length > 0) {
      await Promise.allSettled(refreshes);
    }
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    return output;
  }

  async writeGlobalTerminal(input: {
    terminalId: string;
    accessToken?: string;
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
    submitGapMs?: number;
    createApprovalRequest?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  }) {
    const output = await this.client.trpc.terminal.write.mutate(input);
    const writeFact =
      this.shouldRefreshGlobalTerminalActivity(input.terminalId) && typeof output.eventId === "number"
        ? ({
        id: output.eventId,
        terminalId: input.terminalId,
        createdAt: Date.now(),
        kind: "terminal_write",
        cycleId: null,
        actorId: undefined,
        title: input.submit || input.submitKey ? "Terminal write + submit" : "Terminal write",
        content: input.text,
        detail: {
          submit: input.submit,
          submitKey: input.submitKey ?? null,
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
        actorId: undefined,
        title: "Terminal read",
        content: JSON.stringify(output.read),
        detail: output.read,
      } satisfies TerminalActivityItem)
        : null;
    if (writeFact) {
      this.projectTerminalActivityFact(writeFact);
    }
    if (readFact) {
      this.projectTerminalActivityFact(readFact);
    }
    const refreshes: Array<Promise<unknown>> = [];
    if (this.shouldRefreshGlobalTerminalActivity(input.terminalId)) {
      refreshes.push(
        this.hydrateGlobalTerminalActivity({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (this.shouldRefreshGlobalTerminalApprovals(input.terminalId)) {
      refreshes.push(
        this.hydrateGlobalTerminalApprovals({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
      refreshes.push(this.hydrateGlobalTerminals({ force: true }));
    }
    if (refreshes.length > 0) {
      await Promise.allSettled(refreshes);
    }
    if (writeFact) {
      this.projectTerminalActivityFact(writeFact);
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
      this.state.globalTerminalGrantsById[terminalId] ??
      createCachedResourceState<GlobalTerminalGrantEntry[]>([]);
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
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }): Promise<GlobalTerminalGrantIssueOutput["grant"]> {
    const output = await this.client.trpc.terminal.issueGrant.mutate(input);
    this.setGlobalTerminalGrantsState(input.terminalId, (resource) => ({
      ...resource,
      data: resource.data
        .filter((grant) => grant.grantId !== output.grant.grantId)
        .concat(output.grant),
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
        refreshedAt: Date.now(),
    }));
    this.emit();
    const refreshes: Array<Promise<unknown>> = [];
    if (
      this.ensureGlobalTerminalGrantsState(input.terminalId).loaded ||
      this.globalTerminalGrantWatchCountById.has(input.terminalId)
    ) {
      refreshes.push(
        this.hydrateGlobalTerminalGrants({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
      refreshes.push(this.hydrateGlobalTerminals({ force: true }));
    }
    if (refreshes.length > 0) {
      await Promise.allSettled(refreshes);
    }
    return output.grant;
  }

  async revokeGlobalTerminalGrant(input: {
    terminalId: string;
    grantId: string;
  }): Promise<{ ok: boolean }> {
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
    const refreshes: Array<Promise<unknown>> = [];
    if (
      this.ensureGlobalTerminalGrantsState(input.terminalId).loaded ||
      this.globalTerminalGrantWatchCountById.has(input.terminalId)
    ) {
      refreshes.push(
        this.hydrateGlobalTerminalGrants({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
      refreshes.push(this.hydrateGlobalTerminals({ force: true }));
    }
    if (refreshes.length > 0) {
      await Promise.allSettled(refreshes);
    }
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

  async hydrateGlobalTerminalApprovals(input: {
    terminalId: string;
    force?: boolean;
  }): Promise<GlobalTerminalApprovalRequest[]> {
    return await this.refreshGlobalTerminalApprovalsInternal(input.terminalId, input);
  }

  async approveGlobalTerminalRequest(input: {
    terminalId: string;
    requestId: string;
    durationMs: number;
  }) {
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
    const refreshes: Array<Promise<unknown>> = [];
    if (this.shouldRefreshGlobalTerminalApprovals(input.terminalId)) {
      refreshes.push(
        this.hydrateGlobalTerminalApprovals({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
      refreshes.push(this.hydrateGlobalTerminals({ force: true }));
    }
    if (refreshes.length > 0) {
      await Promise.allSettled(refreshes);
    }
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
    const refreshes: Array<Promise<unknown>> = [];
    if (this.shouldRefreshGlobalTerminalApprovals(input.terminalId)) {
      refreshes.push(
        this.hydrateGlobalTerminalApprovals({
          terminalId: input.terminalId,
          force: true,
        }),
      );
    }
    if (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0) {
      refreshes.push(this.hydrateGlobalTerminals({ force: true }));
    }
    if (refreshes.length > 0) {
      await Promise.allSettled(refreshes);
    }
    return output;
  }

  async loadGlobalTerminalActivity(
    terminalId: string,
    before?: HistoryPageCursor | null,
    limit = 120,
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
      this.state.globalTerminalActivityById[terminalId] ??
      createCachedResourceState<TerminalActivityItem[]>([]);
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

  async listSettingsLayers(workspacePath: string) {
    return await this.client.trpc.settings.layers.list.query({ workspacePath });
  }

  async listScopedSettings(input: { scope: "workspace" | "global"; workspacePath?: string; avatar?: string }) {
    return await this.client.trpc.settings.scope.list.query(input);
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

  async setChatVisibility(input: { sessionId: string; chatId?: string; visible: boolean; focused: boolean }) {
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
    upToMessageId?: string | null;
  }) {
    const snapshot = await this.client.trpc.notification.consume.mutate({
      sessionId: input.sessionId,
      chatId: input.chatId,
      terminalId: input.terminalId,
      upToMessageId: input.upToMessageId ?? undefined,
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
    const output = await this.client.trpc.chat.list.query({ sessionId, limit });
    const mapped = output.items.map((item) => this.toRuntimeChatMessage(item));
    this.state.chatsBySession[sessionId] = this.mergeChatMessages(this.state.chatsBySession[sessionId] ?? [], mapped);
    this.updateBeforeCursor(this.chatBeforeCursorBySession, sessionId, output.nextBefore);
    this.emit();
  }

  async loadChatCycles(sessionId: string, limit = 120): Promise<void> {
    const output = await this.client.trpc.chat.cycles.query({ sessionId, limit });
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
        this.client.trpc.chat.list.query({ sessionId, limit: input?.messageLimit ?? 200 }),
        this.client.trpc.chat.cycles.query({ sessionId, limit: input?.cycleLimit ?? 120 }),
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

  async hydrateSessionArtifacts(sessionId: string): Promise<void> {
    await this.hydrateRuntime(sessionId);
  }

  async loadMoreChatMessagesBefore(sessionId: string, limit = 120): Promise<{ items: number; hasMore: boolean }> {
    const current = this.state.chatsBySession[sessionId] ?? [];
    const before = this.resolveBeforeCursor(this.chatBeforeCursorBySession, sessionId, current, (message) =>
      this.toChatHistoryCursor(message),
    );
    if (before === null) {
      return { items: 0, hasMore: false };
    }
    const output = await this.client.trpc.chat.list.query({ sessionId, before: before ?? undefined, limit });
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
    const output = await this.client.trpc.chat.cycles.query({ sessionId, before: before ?? undefined, limit });
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
      delete this.state.modelCallsBySession[payload.sessionId];
      delete this.state.modelCallDeltasBySession?.[payload.sessionId];
      delete this.state.terminalActivityBySession[payload.sessionId];
      delete this.state.apiCallRecordingBySession[payload.sessionId];
      this.modelCallDeltasAccessBySession.delete(payload.sessionId);
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
      if (payload.catalogChanged && (this.state.globalTerminals.loaded || this.globalTerminalsWatchCount > 0)) {
        void this.hydrateGlobalTerminals({ force: true });
      }
      for (const terminalId of payload.grantTerminalIds ?? []) {
        if (!this.shouldRefreshGlobalTerminalGrants(terminalId)) {
          continue;
        }
        void this.hydrateGlobalTerminalGrants({ terminalId, force: true }).catch(() => undefined);
      }
      for (const terminalId of payload.approvalTerminalIds ?? []) {
        if (!this.shouldRefreshGlobalTerminalApprovals(terminalId)) {
          continue;
        }
        void this.hydrateGlobalTerminalApprovals({ terminalId, force: true }).catch(() => undefined);
      }
      for (const terminalId of payload.activityTerminalIds ?? []) {
        if (!this.shouldRefreshGlobalTerminalActivity(terminalId)) {
          continue;
        }
        void this.hydrateGlobalTerminalActivity({ terminalId, force: true }).catch(() => undefined);
      }
      return;
    }

    if (event.type === "message.room.updated") {
      const payload = event.payload as {
        catalogChanged?: boolean;
        snapshotRoomIds?: string[];
        grantRoomIds?: string[];
        assetRoomIds?: string[];
      };
      if (payload.catalogChanged && (this.state.globalRooms.loaded || this.globalRoomsWatchCount > 0)) {
        void this.hydrateGlobalRooms({ force: true });
      }
      for (const chatId of payload.snapshotRoomIds ?? []) {
        if (!this.shouldRefreshGlobalRoomSnapshot(chatId)) {
          continue;
        }
        void this.hydrateGlobalRoomSnapshot({ chatId, force: true }).catch(() => undefined);
      }
      for (const chatId of payload.grantRoomIds ?? []) {
        if (!this.shouldRefreshGlobalRoomGrants(chatId)) {
          continue;
        }
        void this.hydrateGlobalRoomGrants({ chatId, force: true }).catch(() => undefined);
      }
      for (const chatId of payload.assetRoomIds ?? []) {
        if (!this.shouldRefreshGlobalRoomAssets(chatId)) {
          continue;
        }
        void this.hydrateGlobalRoomAssets({ chatId, force: true }).catch(() => undefined);
      }
      return;
    }

    if (event.type === "workspace.avatarCatalog.updated") {
      const payload = event.payload as { workspacePaths?: string[] };
      for (const workspacePath of payload.workspacePaths ?? []) {
        const resource = this.state.workspaceAvatarCatalogByPath[workspacePath];
        if (!resource && !this.workspaceAvatarCatalogWatchCountByPath.has(workspacePath)) {
          continue;
        }
        void this.hydrateWorkspaceAvatarCatalog(workspacePath, { force: true });
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
      event.type === "runtime.modelCall" ||
      event.type === "runtime.modelCall.delta" ||
      event.type === "runtime.apiCall" ||
      event.type === "runtime.apiRecording" ||
      event.type === "runtime.attention" ||
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
      } else if (event.type === "runtime.modelCall") {
        const payload = event.payload as {
          entry: {
            id: number;
            cycleId: number;
            createdAt: number;
            status: "running" | "done" | "error" | "cancelled";
            completedAt?: number;
            provider: string;
            model: string;
            request: unknown;
            response?: unknown;
            error?: unknown;
            trace?: {
              traceId: string;
              spanId: string;
              parentSpanId?: string | null;
            };
            outcome?: {
              code: "done" | "error" | "timeout" | "stopped" | "aborted" | "cancelled";
              message?: string;
              retryable?: boolean;
              error?: unknown;
              reason?: string;
            };
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
      } else if (event.type === "runtime.attention") {
        const payload = cloneRuntimeAttentionState(event.payload as RuntimeAttentionState);
        runtime.attention = payload;
        this.state.attentionBySession ??= {};
        this.state.attentionBySession[sessionId] = payload;
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
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
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
    this.state.tasksBySession[sessionId] = this.state.tasksBySession[sessionId] ?? [];
    this.state.schedulerLogsBySession[sessionId] = this.state.schedulerLogsBySession[sessionId] ?? [];
    this.state.observabilityTracesBySession[sessionId] = this.state.observabilityTracesBySession[sessionId] ?? [];
    this.state.apiCallsBySession[sessionId] = this.state.apiCallsBySession[sessionId] ?? [];
    this.state.modelCallsBySession[sessionId] = this.state.modelCallsBySession[sessionId] ?? [];
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
  ): void {
    this.state.attentionBySession ??= {};
    delete this.state.runtimes[sessionId];
    this.state.activityBySession[sessionId] = "idle";
    this.state.terminalSnapshotsBySession[sessionId] = {};
    this.state.terminalReadsBySession[sessionId] = {};
    this.state.messageChannelsBySession[sessionId] =
      this.state.messageChannelsBySession[sessionId] ?? createCachedResourceState<MessageChannelEntry[]>([]);
    this.state.attentionBySession[sessionId] =
      attention ?? this.state.attentionBySession[sessionId] ?? createEmptyAttentionState();
    this.state.tasksBySession[sessionId] = [];
    this.state.apiCallRecordingBySession[sessionId] = {
      enabled: false,
      refCount: 0,
    };
    if (status) {
      this.ensureRuntimeScaffold(sessionId, status);
      this.state.runtimes[sessionId]!.started = status === "paused";
      this.state.runtimes[sessionId]!.activityState = "idle";
      this.state.runtimes[sessionId]!.activeCycle = null;
      this.state.runtimes[sessionId]!.attention = this.state.attentionBySession[sessionId];
      this.state.runtimes[sessionId]!.terminals = [];
      this.state.runtimes[sessionId]!.terminalReads = {};
      this.state.runtimes[sessionId]!.terminalSnapshots = {};
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

  private async hydrateRuntime(sessionId: string): Promise<void> {
    const snapshot = await this.client.trpc.runtime.snapshot.query();
    this.state.attentionBySession ??= {};
    const runtime = snapshot.runtimes[sessionId];
    if (!runtime) {
      const session = this.state.sessions.find((item) => item.id === sessionId);
      const persistedAttention = session ? await this.inspectAttentionState(sessionId) : createEmptyAttentionState();
      this.clearRuntimeState(sessionId, session?.status, persistedAttention);
      this.state.lastEventId = Math.max(this.state.lastEventId, snapshot.lastEventId);
      this.emit();
      await this.hydrateObservabilityArtifacts(sessionId);
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
    this.state.tasksBySession[sessionId] = normalizedRuntime.tasks ?? [];
    this.state.schedulerLogsBySession[sessionId] = this.state.schedulerLogsBySession[sessionId] ?? [];
    this.state.observabilityTracesBySession[sessionId] = this.state.observabilityTracesBySession[sessionId] ?? [];
    this.state.apiCallsBySession[sessionId] = this.state.apiCallsBySession[sessionId] ?? [];
    this.state.modelCallsBySession[sessionId] = this.state.modelCallsBySession[sessionId] ?? [];
    this.state.apiCallRecordingBySession[sessionId] = runtime.apiCallRecording;
    this.state.lastEventId = Math.max(this.state.lastEventId, snapshot.lastEventId);
    this.emit();
    await this.hydrateObservabilityArtifacts(sessionId);
  }

  private async hydrateObservabilityArtifacts(sessionId: string): Promise<void> {
    try {
      const [logs, traces, modelCalls, apiCalls] = await Promise.all([
        this.client.trpc.runtime.schedulerLogs.query({ sessionId, limit: 200 }),
        this.client.trpc.runtime.observabilityTraces.query({ sessionId, limit: 200 }),
        this.client.trpc.runtime.modelCallsPage.query({ sessionId, limit: 200 }),
        this.client.trpc.runtime.apiCallsPage.query({ sessionId, limit: 200 }),
      ]);
      this.state.schedulerLogsBySession[sessionId] = this.applyLruEntries(
        this.schedulerLogsAccessBySession,
        sessionId,
        [],
        logs.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.state.observabilityTracesBySession[sessionId] = this.applyLruEntries(
        this.observabilityTracesAccessBySession,
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
      this.state.apiCallsBySession[sessionId] = this.applyLruEntries(
        this.apiCallsAccessBySession,
        sessionId,
        [],
        apiCalls.items,
        LOOPBUS_LRU_LIMIT,
      );
      this.updateBeforeCursor(this.schedulerLogsBeforeCursorBySession, sessionId, logs.nextBefore);
      this.updateBeforeCursor(this.observabilityTracesBeforeCursorBySession, sessionId, traces.nextBefore);
      this.updateBeforeCursor(this.modelCallsBeforeCursorBySession, sessionId, modelCalls.nextBefore);
      this.updateBeforeCursor(this.apiCallsBeforeCursorBySession, sessionId, apiCalls.nextBefore);
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
