import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type {
  AppRouter,
  AuthDraftEntry as AuthDraftEntryContract,
  AuthDraftEvent as AuthDraftEventContract,
  AuthDraftKind as AuthDraftKindContract,
  AuthKvEvent as AuthKvEventContract,
  AvatarCreateDraftState as AvatarCreateDraftStateContract,
  JsonValue as JsonValueContract,
  RuntimeEventEnvelope,
  RuntimeSnapshotPayload,
  SessionRuntimeModelDebug,
} from "@agenter/app-server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;

export type SessionListOutput = RouterOutputs["session"]["list"];
export type SessionEntry = SessionListOutput["sessions"][number];
export type GlobalAvatarCatalogOutput = RouterOutputs["avatar"]["catalog"];
export type GlobalAvatarCatalogEntry = GlobalAvatarCatalogOutput["items"][number];
export type GlobalAvatarCreateOutput = RouterOutputs["avatar"]["create"];
export type WorkspaceListOutput = RouterOutputs["workspace"]["listAll"];
export type WorkspaceEntry = WorkspaceListOutput["items"][number];
export type WorkspaceSessionListOutput = RouterOutputs["workspace"]["listSessions"];
export type WorkspaceSessionEntry = WorkspaceSessionListOutput["items"][number];
export type WorkspaceSessionCounts = WorkspaceSessionListOutput["counts"];
export type WorkspaceSessionCursor = WorkspaceSessionListOutput["nextCursor"];
export type WorkspaceAvatarCatalogOutput = RouterOutputs["workspace"]["avatarCatalog"];
export type WorkspaceAvatarCatalogEntry = WorkspaceAvatarCatalogOutput["items"][number];
export type WorkspaceAvatarForkOutput = RouterOutputs["workspace"]["forkAvatar"];
export type WorkspaceAvatarCopyOutput = RouterOutputs["workspace"]["copyAvatar"];
export type WorkspaceWelcomeSnapshotOutput = RouterOutputs["workspace"]["welcomeSnapshot"];
export type WorkspaceWelcomeRoomItem = WorkspaceWelcomeSnapshotOutput["rooms"][number];
export type WorkspaceWelcomeTerminalItem = WorkspaceWelcomeSnapshotOutput["terminals"][number];
export type WorkspacePathSearchOutput = RouterOutputs["workspace"]["searchPaths"];
export type RuntimeWorkspaceMountsOutput = RouterOutputs["workspace"]["runtimeMounts"];
export type RuntimeWorkspaceMountEntry = RuntimeWorkspaceMountsOutput["items"][number];
export type RuntimeWorkspaceGrantsOutput = RouterOutputs["workspace"]["runtimeGrants"];
export type RuntimeWorkspaceGrantEntry = RuntimeWorkspaceGrantsOutput["items"][number];
export type RuntimeWorkspaceGrantMutationOutput = RouterOutputs["workspace"]["grantRuntime"];
export type RuntimeWorkspaceAssetRootsOutput = RouterOutputs["workspace"]["assetRoots"];
export type WorkspaceWorkbenchTreeOutput = RouterOutputs["workspace"]["workbenchTree"];
export type WorkspaceWorkbenchTreeEntry = WorkspaceWorkbenchTreeOutput["items"][number];
export type WorkspaceWorkbenchPreviewOutput = RouterOutputs["workspace"]["workbenchPreview"];
export type RuntimeWorkspaceExecOutput = RouterOutputs["workspace"]["exec"];
export type DraftResolutionOutput = RouterOutputs["draft"]["resolve"];
export type AuthDraftSnapshotOutput = RouterOutputs["drafts"]["list"];
export type AuthDraftCreateOutput = RouterOutputs["drafts"]["create"];
export type AuthDraftSaveOutput = RouterOutputs["drafts"]["save"];
export type AuthDraftDeleteOutput = RouterOutputs["drafts"]["delete"];
export type AuthDraftEntry<K extends AuthDraftKind = AuthDraftKind> = AuthDraftEntryContract<K>;
export type AuthDraftEvent = AuthDraftEventContract;
export type AuthDraftKind = AuthDraftKindContract;
export type AvatarCreateDraftState = AvatarCreateDraftStateContract;
export type JsonValue = JsonValueContract;
export type GlobalSettingsFileOutput = RouterOutputs["settings"]["global"]["read"];
export type AuthKvSnapshotOutput = RouterOutputs["kv"]["snapshot"];
export type AuthKvEntry = AuthKvSnapshotOutput["items"][number];
export type AuthKvSetOutput = RouterOutputs["kv"]["set"];
export type AuthKvDeleteOutput = RouterOutputs["kv"]["delete"];
export type AuthKvEvent = AuthKvEventContract;
export type ChatListOutput = RouterOutputs["chat"]["list"];
export type ChatListItem = ChatListOutput["items"][number];
export type HistoryPageCursor = NonNullable<ChatListOutput["nextBefore"]>;
export type ChatCyclesOutput = RouterOutputs["chat"]["cycles"];
export type ChatCycleItem = ChatCyclesOutput["items"][number];
export type MessageChannelListOutput = RouterOutputs["message"]["listChannels"];
export type MessageChannelEntry = MessageChannelListOutput["items"][number];
export type MessageQueryOutput = RouterOutputs["message"]["query"];
export type MessageSendOutput = RouterOutputs["message"]["send"];
export type MessageSendSuccessOutput = Extract<MessageSendOutput, { ok: true }>;
export type MessageChannelGrantsOutput = RouterOutputs["message"]["listChannelGrants"];
export type MessageChannelGrantEntry = MessageChannelGrantsOutput["items"][number];
export type MessageChannelGrantIssueOutput = RouterOutputs["message"]["issueChannelGrant"];
export type GlobalRoomListOutput = RouterOutputs["message"]["globalList"];
export type GlobalRoomEntry = GlobalRoomListOutput["items"][number];
export type GlobalRoomSnapshotOutput = RouterOutputs["message"]["globalSnapshot"];
export type GlobalRoomMessage = GlobalRoomSnapshotOutput["items"][number];
export type GlobalRoomPageOutput = RouterOutputs["message"]["globalPage"];
export type GlobalRoomGrantsOutput = RouterOutputs["message"]["globalListGrants"];
export type GlobalRoomGrantEntry = GlobalRoomGrantsOutput["items"][number];
export type GlobalRoomAssetsOutput = RouterOutputs["message"]["globalListAssets"];
export type GlobalRoomAssetEntry = GlobalRoomAssetsOutput["items"][number];
export type GlobalRoomActorId = RouterInputs["message"]["globalIssueGrant"]["participantId"];
export type GlobalRoomGrantIssueOutput = RouterOutputs["message"]["globalIssueGrant"];
export type ProfileListOutput = RouterOutputs["profile"]["list"];
export type ProfileProjectionOutput = RouterOutputs["profile"]["get"];
export type AuthServiceInfoOutput = RouterOutputs["auth"]["service"];
export type AuthActorCatalogOutput = RouterOutputs["auth"]["actors"];
export type AuthActorCatalogEntry = AuthActorCatalogOutput["items"][number];
export type ProfileServiceInfoOutput = AuthServiceInfoOutput;
export type ProfileListItem = ProfileListOutput["items"][number];
export type AuthChallengeStartOutput = RouterOutputs["auth"]["challengeStart"];
export type AuthAutoLoginOutput = RouterOutputs["auth"]["autoLogin"];
export type AuthStoreAutoLoginKeyOutput = RouterOutputs["auth"]["storeAutoLoginKey"];
export type AuthChallengeVerifyOutput = RouterOutputs["auth"]["challengeVerify"];
export type AuthSessionOutput = RouterOutputs["auth"]["session"];
export type AuthSuperadminStatusOutput = RouterOutputs["auth"]["superadminStatus"];
export type ProfileEmailChallengeStartOutput = RouterOutputs["profile"]["auth"]["emailStart"];
export type ProfileEmailChallengeVerifyOutput = RouterOutputs["profile"]["auth"]["emailVerify"];
export type SettingsLayersOutput = RouterOutputs["settings"]["layers"]["list"];
export type SettingsLayerEntry = SettingsLayersOutput["layers"][number];
export type ScopedSettingsOutput = RouterOutputs["settings"]["scope"]["list"];
export type ScopedSettingsLayerEntry = ScopedSettingsOutput["layers"][number];
export type SchedulerLogOutput = RouterOutputs["runtime"]["schedulerLogs"];
export type SchedulerLogItem = SchedulerLogOutput["items"][number];
export type AttentionStateOutput = RouterOutputs["runtime"]["attentionState"];
export type AttentionQueryOutput = RouterOutputs["runtime"]["attentionQuery"];
export type AttentionQueryItem = AttentionQueryOutput["items"][number];
export type ObservabilityTraceOutput = RouterOutputs["runtime"]["observabilityTraces"];
export type ObservabilityTraceItem = ObservabilityTraceOutput["items"][number];
export type HeartbeatGroupsPageOutput = RouterOutputs["runtime"]["heartbeatGroupsPage"];
export type HeartbeatGroupItem = HeartbeatGroupsPageOutput["items"][number];
export type HeartbeatGroupMessageItem = HeartbeatGroupItem["items"][number];
export type HeartbeatPartsPageOutput = RouterOutputs["runtime"]["heartbeatPartsPage"];
export type HeartbeatPartItem = HeartbeatPartsPageOutput["items"][number];
export type ModelCallsPageOutput = RouterOutputs["runtime"]["modelCallsPage"];
export type ModelCallItem = ModelCallsPageOutput["items"][number];
export type RuntimeUsageAnalyticsInput = RouterInputs["runtime"]["usageAnalytics"];
export type RuntimeUsageAnalyticsOutput = RouterOutputs["runtime"]["usageAnalytics"];
export type RuntimeUsageAnalyticsItem = RuntimeUsageAnalyticsOutput["items"][number];
export type RequestAuxPageOutput = RouterOutputs["runtime"]["requestAuxPage"];
export type RequestAuxItem = RequestAuxPageOutput["items"][number];
export type ModelCallDeltaKind = "assistant_draft" | "tool_call" | "tool_result" | "run_finished";
export interface ModelCallDeltaItem {
  id: number;
  seq: number;
  modelCallId: number;
  cycleId: number;
  timestamp: number;
  kind: ModelCallDeltaKind;
  data: unknown;
}
export type ApiCallsPageOutput = RouterOutputs["runtime"]["apiCallsPage"];
export type ApiCallItem = ApiCallsPageOutput["items"][number];
export type TerminalActivityOutput = RouterOutputs["runtime"]["terminalActivityPage"];
export type TerminalActivityItem = TerminalActivityOutput["items"][number];
export type GlobalTerminalListOutput = RouterOutputs["terminal"]["globalList"];
export type GlobalTerminalEntry = GlobalTerminalListOutput["items"][number];
export type GlobalTerminalActivityOutput = RouterOutputs["terminal"]["activityPage"];
export type GlobalTerminalGrantListOutput = RouterOutputs["terminal"]["listGrants"];
export type GlobalTerminalGrantEntry = GlobalTerminalGrantListOutput["items"][number];
export type GlobalTerminalActorId = RouterInputs["terminal"]["issueGrant"]["participantId"];
export type GlobalTerminalGrantIssueOutput = RouterOutputs["terminal"]["issueGrant"];
export type GlobalTerminalApprovalRequestsOutput = RouterOutputs["terminal"]["listApprovalRequests"];
export type GlobalTerminalApprovalRequest = GlobalTerminalApprovalRequestsOutput["items"][number];
export type NotificationSnapshotOutput = RouterOutputs["notification"]["snapshot"];
export type SessionNotificationItem = NotificationSnapshotOutput["items"][number];
export type RuntimeEvent = RuntimeEventEnvelope;
export type RuntimeSnapshot = RuntimeSnapshotPayload;
export type RuntimeSnapshotEntry = RuntimeSnapshot["runtimes"][string];
export type RuntimeAttentionState = NonNullable<RuntimeSnapshotEntry["attention"]>;
export type RuntimeSchedulerState = NonNullable<RuntimeSnapshotEntry["schedulerState"]>;
export type RuntimeChatMessage = RuntimeSnapshotEntry["chatMessages"][number];
export type RuntimeChatCycle = ChatCycleItem;
export type WorkspaceSessionTab = "all" | "running" | "stopped" | "archive";
export type ModelDebugOutput = SessionRuntimeModelDebug;
export type RuntimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

export interface RuntimeSchedulerContainmentState {
  runtimeStatus: RuntimeSchedulerState["runtimeStatus"];
  waitingReason: RuntimeSchedulerState["waitingReason"];
  nextAutoWakeAt: RuntimeSchedulerState["nextAutoWakeAt"];
  backoffMs: RuntimeSchedulerState["backoffMs"];
  retryCount: RuntimeSchedulerState["retryCount"];
  blockedReason: RuntimeSchedulerState["blockedReason"];
  lastProgressAt: RuntimeSchedulerState["lastProgressAt"];
  lastError: RuntimeSchedulerState["lastError"];
}

export interface CachedResourceState<T> {
  data: T;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshedAt: number | null;
}

export type UploadedSessionAssetKind = "image" | "video" | "file";

export interface UploadedSessionAsset {
  assetId: string;
  kind: UploadedSessionAssetKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface RuntimeClientState {
  connected: boolean;
  connectionStatus: RuntimeConnectionStatus;
  profileService: ProfileServiceInfoOutput | null;
  lastEventId: number;
  sessions: SessionEntry[];
  runtimes: RuntimeSnapshot["runtimes"];
  activityBySession: Record<string, "idle" | "active">;
  terminalSnapshotsBySession: Record<string, RuntimeSnapshotEntry["terminalSnapshots"]>;
  terminalReadsBySession: Record<string, RuntimeSnapshotEntry["terminalReads"]>;
  chatsBySession: Record<string, RuntimeSnapshotEntry["chatMessages"]>;
  messageChannelsBySession: Record<string, CachedResourceState<MessageChannelEntry[]>>;
  chatCyclesBySession: Record<string, RuntimeChatCycle[]>;
  attentionBySession?: Record<string, RuntimeAttentionState>;
  tasksBySession: Record<string, RuntimeSnapshotEntry["tasks"]>;
  recentWorkspaces: string[];
  workspaces: WorkspaceEntry[];
  globalAvatarCatalog: CachedResourceState<GlobalAvatarCatalogEntry[]>;
  workspaceAvatarCatalogByPath: Record<string, CachedResourceState<WorkspaceAvatarCatalogEntry[]>>;
  globalRooms: CachedResourceState<GlobalRoomEntry[]>;
  globalRoomSnapshotsById: Record<string, CachedResourceState<GlobalRoomSnapshotOutput | null>>;
  globalRoomGrantsById: Record<string, CachedResourceState<GlobalRoomGrantEntry[]>>;
  globalRoomAssetsById: Record<string, CachedResourceState<GlobalRoomAssetEntry[]>>;
  globalTerminals: CachedResourceState<GlobalTerminalEntry[]>;
  globalTerminalGrantsById: Record<string, CachedResourceState<GlobalTerminalGrantEntry[]>>;
  globalTerminalApprovalsById: Record<string, CachedResourceState<GlobalTerminalApprovalRequest[]>>;
  globalTerminalActivityById: Record<string, CachedResourceState<TerminalActivityItem[]>>;
  schedulerLogsBySession: Record<string, SchedulerLogItem[]>;
  observabilityTracesBySession: Record<string, ObservabilityTraceItem[]>;
  heartbeatGroupsBySession: Record<string, CachedResourceState<HeartbeatGroupItem[]>>;
  modelCallsBySession: Record<string, ModelCallItem[]>;
  requestAuxBySession: Record<string, RequestAuxItem[]>;
  modelCallDeltasBySession?: Record<string, ModelCallDeltaItem[]>;
  apiCallsBySession: Record<string, ApiCallItem[]>;
  terminalActivityBySession: Record<string, Record<string, TerminalActivityItem[]>>;
  apiCallRecordingBySession: Record<string, { enabled: boolean; refCount: number }>;
  notifications: SessionNotificationItem[];
  unreadBySession: Record<string, number>;
  unreadByBucket: Record<string, Record<string, number>>;
}
