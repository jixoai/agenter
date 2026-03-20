import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter, RuntimeEventEnvelope, RuntimeSnapshotPayload } from "@agenter/app-server";

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export type SessionListOutput = RouterOutputs["session"]["list"];
export type SessionEntry = SessionListOutput["sessions"][number];
export type WorkspaceListOutput = RouterOutputs["workspace"]["listAll"];
export type WorkspaceEntry = WorkspaceListOutput["items"][number];
export type WorkspaceSessionListOutput = RouterOutputs["workspace"]["listSessions"];
export type WorkspaceSessionEntry = WorkspaceSessionListOutput["items"][number];
export type WorkspaceSessionCounts = WorkspaceSessionListOutput["counts"];
export type WorkspaceSessionCursor = WorkspaceSessionListOutput["nextCursor"];
export type WorkspacePathSearchOutput = RouterOutputs["workspace"]["searchPaths"];
export type DraftResolutionOutput = RouterOutputs["draft"]["resolve"];
export type ChatListOutput = RouterOutputs["chat"]["list"];
export type ChatListItem = ChatListOutput["items"][number];
export type ChatCyclesOutput = RouterOutputs["chat"]["cycles"];
export type ChatCycleItem = ChatCyclesOutput["items"][number];
export type LoopbusStateLogOutput = RouterOutputs["runtime"]["loopbusStateLogs"];
export type LoopbusStateLogItem = LoopbusStateLogOutput["items"][number];
export type LoopbusTraceOutput = RouterOutputs["runtime"]["loopbusTraces"];
export type LoopbusTraceItem = LoopbusTraceOutput["items"][number];
export type ModelCallsPageOutput = RouterOutputs["runtime"]["modelCallsPage"];
export type ModelCallItem = ModelCallsPageOutput["items"][number];
export type ApiCallsPageOutput = RouterOutputs["runtime"]["apiCallsPage"];
export type ApiCallItem = ApiCallsPageOutput["items"][number];
export type NotificationSnapshotOutput = RouterOutputs["notification"]["snapshot"];
export type SessionNotificationItem = NotificationSnapshotOutput["items"][number];
export type RuntimeEvent = RuntimeEventEnvelope;
export type RuntimeSnapshot = RuntimeSnapshotPayload;
export type RuntimeSnapshotEntry = RuntimeSnapshot["runtimes"][string];
export type RuntimeChatMessage = RuntimeSnapshotEntry["chatMessages"][number];
export type RuntimeChatCycle = ChatCycleItem;
export type WorkspaceSessionTab = "all" | "running" | "stopped" | "archive";
export type ModelDebugOutput = RouterOutputs["runtime"]["modelDebug"];
export type RuntimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

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
  lastEventId: number;
  sessions: SessionEntry[];
  runtimes: RuntimeSnapshot["runtimes"];
  activityBySession: Record<string, "idle" | "active">;
  terminalSnapshotsBySession: Record<string, RuntimeSnapshotEntry["terminalSnapshots"]>;
  chatsBySession: Record<string, RuntimeSnapshotEntry["chatMessages"]>;
  chatCyclesBySession: Record<string, RuntimeChatCycle[]>;
  tasksBySession: Record<string, RuntimeSnapshotEntry["tasks"]>;
  recentWorkspaces: string[];
  workspaces: WorkspaceEntry[];
  loopbusStateLogsBySession: Record<string, LoopbusStateLogItem[]>;
  loopbusTracesBySession: Record<string, LoopbusTraceItem[]>;
  modelCallsBySession: Record<string, ModelCallItem[]>;
  apiCallsBySession: Record<string, ApiCallItem[]>;
  apiCallRecordingBySession: Record<string, { enabled: boolean; refCount: number }>;
  notifications: SessionNotificationItem[];
  unreadBySession: Record<string, number>;
}
