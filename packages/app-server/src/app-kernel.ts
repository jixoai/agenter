import { randomUUID } from "node:crypto";
import {
  accessSync,
  existsSync,
  constants as fsConstants,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { defaultAvatarNickname, normalizeAvatarNickname } from "@agenter/avatar";
import { isPrincipalId } from "@agenter/principal-crypto";
import {
  AttentionStore,
  AttentionSystem,
  type AttentionCommitMatch,
  type AttentionCycleFrame,
  type AttentionHookRecord,
} from "@agenter/attention-system";
import {
  MessageControlPlane,
  type MessageActorId,
  type MessageChannelAccessRole,
  type MessageChannelGrantRecord,
  type MessageChannelKind,
  type MessageChannelPatchInput,
  type MessageControlPlaneEntry,
  type MessageFocusOp,
  type MessageIssueGrantInput,
  type MessageIssuedGrant,
  type MessageRecord,
  type MessageSnapshot,
} from "@agenter/message-system";
import {
  TerminalControlPlane,
  type TerminalActorId,
  type TerminalApprovalRequestRecord,
  type TerminalControlPlaneEntry,
  type TerminalGrantRecord,
  type TerminalGrantRole,
  type TerminalIssueGrantInput,
  type TerminalProcessProfile,
  type TerminalReadMode,
  type TerminalReadResult,
  type TerminalWriteResult,
} from "@agenter/terminal-system";
import {
  SessionDb,
  type ApiCallRecord,
  type LoopbusStateLogRecord,
  type ReversePage,
  type ReverseTimeCursor,
  type SessionBlockRecord,
  type SessionCollectedInput,
  type SessionCycleRecord,
  type SessionModelCallRecord,
  type TerminalActivityRecord,
} from "@agenter/session-system";
import { collectClientMessageIds, toChatCycleId, type ChatCycle, type ChatCycleCompactTrigger } from "./chat-cycles";
import { AttentionSearchEngine, type AttentionSearchRequest } from "./attention-search";
import {
  copyAvatarIntoWorkspace,
  listWorkspaceAvatarCatalog,
  forkAvatarIntoWorkspace,
  resolveWorkspaceAvatarRoot,
  type WorkspaceAvatarCatalogEntry,
} from "./avatar-catalog";
import {
  ensureAvatarSeatPrincipal,
  readAvatarSeatDocument,
  saveAvatarMessageSeatCredential,
  saveAvatarTerminalSeatCredential,
  type AvatarSeatState,
} from "./avatar-seat-store";
import { readGlobalSettingsFile, saveGlobalSettingsFile } from "./global-settings";
import { resolveModelCapabilities } from "./model-capabilities";
import { repairRoomParticipantsIfNeeded } from "./message-room-participant-repair";
import { AuthServiceBridge, type AuthServiceBridgeOptions } from "./auth-service-bridge";
import { projectAuthActors } from "./auth-actor-catalog";
import {
  settingsKindSchema,
  type AnyRuntimeEvent,
  type RuntimeEventEnvelope,
  type RuntimeEventType,
  type RuntimeSnapshotPayload,
} from "./realtime-types";
import { SessionCatalog, type SessionMeta } from "./session-catalog";
import { resolveWorkspaceAvatarSessionId } from "./session-identity";
import { SessionNotificationRegistry, type SessionNotificationSnapshot } from "./session-notifications";
import {
  resolveCollectedInputsChatId,
  resolveSessionBlockChatId,
  resolveSessionRoomActorId,
} from "./session-chat-projection";
import { resolveSessionConfig } from "./session-config";
import { projectPersistedBlockToChatMessage, readPersistedBlockChatId } from "./session-room-read-model";
import { RoomAssetStore, type RoomAssetRecord, toChatRoomAsset } from "./room-assets";
import { buildSessionAssetUrl } from "./session-assets";
import { SessionRuntime, type RuntimeEvent } from "./session-runtime";
import {
  listScopedSettingsGraph,
  readScopedSettingsLayer,
  saveScopedSettingsLayer,
  type SettingsScope,
} from "./settings-scope";
import type { ChatMessage, ChatSessionAsset, ModelCapabilities, RoomMediaAsset } from "./types";
import { WorkspacePathSearchIndex } from "./workspace-path-search";
import {
  listWorkspaceSettingsLayers,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
} from "./workspace-settings";
import { GLOBAL_WORKSPACE_PATH, isGlobalWorkspacePath, toWorkspaceCwd, toWorkspacePath } from "./workspace-target";
import { WorkspacesStore, type WorkspaceEntry } from "./workspaces-store";
import type { ProfileMetadata, ProfileProjection } from "@agenter/profile-service";

const now = (): number => Date.now();
const DEFAULT_MESSAGE_CHAT_TITLE = "Room";
const AVATAR_CATALOG_INVALIDATION_DEBOUNCE_MS = 120;
const MESSAGE_ROOM_INVALIDATION_DEBOUNCE_MS = 80;
const TERMINAL_SURFACE_INVALIDATION_DEBOUNCE_MS = 80;
const INTERNAL_FAILURE_PREFIXES = ["agenter-ai call failed:", "agenter-ai 调用失败:", "agenter-ai 调用失败："];

const hashNumericLabel = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 100;
  }
  return String(hash).padStart(2, "0");
};

const buildSessionIconLabel = (sessionId: string): string => sessionId.replaceAll(/[^0-9]/g, "").slice(-2) || hashNumericLabel(sessionId);

const parseGitOwnerFromUrl = (raw: string): string | null => {
  const value = raw.trim().replace(/\.git$/, "");
  const scpMatch = value.match(/^[^@]+@[^:]+:([^/]+)\/.+$/);
  if (scpMatch?.[1]) {
    return scpMatch[1];
  }
  const sshMatch = value.match(/^ssh:\/\/[^/]+\/([^/]+)\/.+$/);
  if (sshMatch?.[1]) {
    return sshMatch[1];
  }
  const httpsMatch = value.match(/^https?:\/\/[^/]+\/([^/]+)\/.+$/);
  if (httpsMatch?.[1]) {
    return httpsMatch[1];
  }
  return null;
};

const isInternalFailurePreviewText = (content: string): boolean =>
  INTERNAL_FAILURE_PREFIXES.some((prefix) => content.trim().startsWith(prefix));

const isBuiltInMessageRoomMetadata = (metadata: Record<string, unknown> | undefined): boolean => metadata?.builtIn === true;

const isStandaloneMessageRoomEntry = (channel: { metadata?: Record<string, unknown> } | undefined): boolean =>
  !isBuiltInMessageRoomMetadata(channel?.metadata);

const sanitizeGlobalRoomMetadata = (metadata?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!metadata) {
    return undefined;
  }
  const nextMetadata = { ...metadata };
  delete nextMetadata.builtIn;
  delete nextMetadata.primaryRoom;
  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
};

const isTerminalEventRefDetail = (
  value: unknown,
): value is { source: "terminal-event-ref"; eventId: number; terminalId: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.source === "terminal-event-ref" &&
    typeof record.eventId === "number" &&
    Number.isInteger(record.eventId) &&
    typeof record.terminalId === "string"
  );
};

const projectTerminalEventToActivityRecord = (event: {
  eventId: number;
  terminalId: string;
  createdAt: number;
  kind: "terminal_read" | "terminal_write";
  payload: {
    title: string;
    content: string;
    actorId?: string;
    detail?: unknown;
  };
}): TerminalActivityRecord => ({
  id: event.eventId,
  terminalId: event.terminalId,
  createdAt: event.createdAt,
  kind: event.kind,
  cycleId: null,
  actorId: event.payload.actorId,
  title: event.payload.title,
  content: event.payload.content,
  detail: event.payload.detail,
});

const resolveWorkspaceGroup = (workspacePath: string): string => {
  const gitConfigPath = join(workspacePath, ".git", "config");
  if (!existsSync(gitConfigPath)) {
    return "Other";
  }

  try {
    const lines = readFileSync(gitConfigPath, "utf8").split(/\r?\n/);
    let inOriginRemote = false;
    let userName: string | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        inOriginRemote = trimmed === '[remote "origin"]';
        continue;
      }
      if (inOriginRemote && trimmed.startsWith("url =")) {
        const owner = parseGitOwnerFromUrl(trimmed.slice("url =".length));
        if (owner) {
          return owner;
        }
      }
      if (userName === null && trimmed.startsWith("name =")) {
        userName = trimmed.slice("name =".length).trim();
      }
    }
    if (userName && userName.length > 0) {
      return userName;
    }
  } catch {
    return "Other";
  }

  return "Other";
};

const isRunningSession = (status: SessionMeta["status"]): boolean => status === "running" || status === "starting";

const CHAT_CYCLE_COMPACT_TRIGGERS = new Set<ChatCycleCompactTrigger>(["manual", "threshold", "error", "attention_retry"]);

const readChatCycleCompactTrigger = (result: Record<string, unknown>): ChatCycleCompactTrigger | null => {
  const trigger = result.compactTrigger;
  if (typeof trigger !== "string") {
    return null;
  }
  return CHAT_CYCLE_COMPACT_TRIGGERS.has(trigger as ChatCycleCompactTrigger) ? (trigger as ChatCycleCompactTrigger) : null;
};

type PersistedChatMessage = ChatMessage & {
  sessionId: string;
  messageId: string;
};

const toChatCycle = (input: {
  sessionId: string;
  cycle: SessionCycleRecord;
  inputs: SessionCollectedInput[];
  outputs: ChatMessage[];
  modelCallId: number | null;
}): ChatCycle => {
  const cycleResult =
    input.cycle.result && typeof input.cycle.result === "object" ? (input.cycle.result as Record<string, unknown>) : {};
  const kind = input.cycle.result.kind === "compact" ? "compact" : "model";
  return {
    id: toChatCycleId({ cycleId: input.cycle.id }),
    cycleId: input.cycle.id,
    seq: input.cycle.seq,
    createdAt: input.cycle.createdAt,
    wakeSource:
      typeof input.cycle.wake?.source === "string" && input.cycle.wake.source.length > 0 ? input.cycle.wake.source : null,
    kind,
    status: "done",
    clientMessageIds: collectClientMessageIds(input.inputs),
    inputs: structuredClone(input.inputs),
    outputs: structuredClone(input.outputs),
    liveMessages: [],
    streaming: null,
    modelCallId: input.modelCallId,
    compactTrigger: kind === "compact" ? readChatCycleCompactTrigger(cycleResult) : null,
  };
};

const hasCollectedUserMessage = (inputs: SessionCollectedInput[]): boolean =>
  inputs.some((input) => input.source === "message" && input.role === "user");

const blockToCollectedInput = (sessionId: string, block: SessionBlockRecord): SessionCollectedInput => ({
  source: "message",
  role: "user",
  name: "User",
  parts: [
    ...(block.content.trim().length > 0 ? ([{ type: "text", text: block.content }] as const) : []),
    ...block.attachments.map((attachment) => ({
      type: attachment.kind,
      assetId: attachment.id,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      name: attachment.name,
      sizeBytes: attachment.sizeBytes,
      url: buildSessionAssetUrl(sessionId, attachment.id),
    })),
  ],
});

const mergeLegacyCycleInputs = (
  sessionId: string,
  cycles: SessionCycleRecord[],
  orphanUserInputs: SessionBlockRecord[],
): Array<{ cycle: SessionCycleRecord; inputs: SessionCollectedInput[] }> => {
  if (cycles.length === 0 || orphanUserInputs.length === 0) {
    return cycles.map((cycle) => ({ cycle, inputs: cycle.collectedInputs }));
  }

  let orphanIndex = 0;
  return cycles.map((cycle) => {
    if (hasCollectedUserMessage(cycle.collectedInputs)) {
      while (orphanIndex < orphanUserInputs.length && orphanUserInputs[orphanIndex]!.createdAt <= cycle.createdAt) {
        orphanIndex += 1;
      }
      return { cycle, inputs: cycle.collectedInputs };
    }

    const legacyInputs: SessionCollectedInput[] = [];
    while (orphanIndex < orphanUserInputs.length && orphanUserInputs[orphanIndex]!.createdAt <= cycle.createdAt) {
      legacyInputs.push(blockToCollectedInput(sessionId, orphanUserInputs[orphanIndex]!));
      orphanIndex += 1;
    }

    return {
      cycle,
      inputs: legacyInputs.length > 0 ? [...legacyInputs, ...cycle.collectedInputs] : cycle.collectedInputs,
    };
  });
};

const createWorkspaceSessionCounts = (): WorkspaceSessionCounts => ({
  all: 0,
  running: 0,
  stopped: 0,
  archive: 0,
});

const countWorkspaceSessions = (sessions: SessionMeta[]): WorkspaceSessionCounts => {
  const counts = createWorkspaceSessionCounts();
  for (const session of sessions) {
    if (session.storageState === "archived") {
      counts.archive += 1;
      continue;
    }
    counts.all += 1;
    if (isRunningSession(session.status)) {
      counts.running += 1;
    } else {
      counts.stopped += 1;
    }
  }
  return counts;
};

const sessionSortAt = (session: SessionMeta): string => {
  if (session.storageState === "archived") {
    return session.archivedAt ?? session.updatedAt;
  }
  return session.updatedAt;
};

const compareWorkspaceSessions =
  (favoriteIds: Set<string>) =>
  (left: SessionMeta, right: SessionMeta): number => {
    const leftFavorite = favoriteIds.has(left.id);
    const rightFavorite = favoriteIds.has(right.id);
    if (leftFavorite !== rightFavorite) {
      return leftFavorite ? -1 : 1;
    }
    const sortAtCompare = sessionSortAt(right).localeCompare(sessionSortAt(left));
    if (sortAtCompare !== 0) {
      return sortAtCompare;
    }
    return right.id.localeCompare(left.id);
  };

const matchesWorkspaceTab = (session: SessionMeta, tab: WorkspaceSessionTab): boolean => {
  if (tab === "archive") {
    return session.storageState === "archived";
  }
  if (session.storageState === "archived") {
    return false;
  }
  if (tab === "running") {
    return isRunningSession(session.status);
  }
  if (tab === "stopped") {
    return !isRunningSession(session.status);
  }
  return true;
};

type KernelListener = (event: AnyRuntimeEvent) => void;

export interface AppKernelOptions {
  globalSessionRoot?: string;
  archiveSessionRoot?: string;
  workspacesPath?: string;
  initialWorkspace?: string;
  profileService?: AuthServiceBridgeOptions;
  logger?: {
    log: (line: {
      channel: "agent" | "error";
      level: "debug" | "info" | "warn" | "error";
      message: string;
      meta?: Record<string, string | number | boolean | null>;
    }) => void;
  };
}

export type WorkspaceSessionTab = "all" | "running" | "stopped" | "archive";

export interface WorkspaceSessionPreview {
  firstUserMessage: string | null;
  latestMessages: string[];
}

export interface WorkspaceSessionEntry {
  sessionId: string;
  name: string;
  status: SessionMeta["status"];
  storageState: SessionMeta["storageState"];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  preview: WorkspaceSessionPreview;
}

export interface WorkspaceSessionCounts {
  all: number;
  running: number;
  stopped: number;
  archive: number;
}

export interface WorkspaceSessionPage {
  items: WorkspaceSessionEntry[];
  nextCursor: number | null;
  counts: WorkspaceSessionCounts;
}

export interface WorkspaceListItem extends WorkspaceEntry {
  objectivePath: string;
  group: string;
  missing: boolean;
  counts: WorkspaceSessionCounts;
  lastSessionActivityAt?: string;
}

export type WorkspaceWelcomeAccessState = "joined" | "available" | "credential-invalid";

export interface WorkspaceWelcomeRoomItem {
  channel: MessageControlPlaneEntry;
  accessState: WorkspaceWelcomeAccessState;
  seatStored: boolean;
  seatState: AvatarSeatState | null;
  seatRole: MessageChannelAccessRole | null;
  canAuthorize: boolean;
}

export interface WorkspaceWelcomeTerminalItem {
  terminal: TerminalControlPlaneEntry;
  accessState: WorkspaceWelcomeAccessState;
  seatStored: boolean;
  seatState: AvatarSeatState | null;
  seatRole: TerminalGrantRole | null;
  canAuthorize: boolean;
}

export interface WorkspaceWelcomeSnapshot {
  workspacePath: string;
  avatar: string;
  sessionId: string;
  avatars: WorkspaceAvatarCatalogEntry[];
  rooms: WorkspaceWelcomeRoomItem[];
  terminals: WorkspaceWelcomeTerminalItem[];
}

const resolveWelcomeAccessState = <TAccessRole extends string>(
  joined: boolean,
  seat: { accessRole: TAccessRole; state: AvatarSeatState } | undefined,
): {
  accessState: WorkspaceWelcomeAccessState;
  seatStored: boolean;
  seatState: AvatarSeatState | null;
  seatRole: TAccessRole | null;
} => {
  if (joined) {
    return {
      accessState: "joined",
      seatStored: Boolean(seat),
      seatState: seat?.state ?? null,
      seatRole: seat?.accessRole ?? null,
    };
  }
  if (seat) {
    return {
      accessState: "credential-invalid",
      seatStored: true,
      seatState: "credential-invalid",
      seatRole: seat.accessRole,
    };
  }
  return {
    accessState: "available",
    seatStored: false,
    seatState: null,
    seatRole: null,
  };
};

export class AppKernel {
  private readonly sessions: SessionCatalog;
  private readonly workspaces: WorkspacesStore;
  private readonly messageControlPlane: MessageControlPlane;
  private readonly terminalControlPlane: TerminalControlPlane;
  private readonly roomAssets: RoomAssetStore;
  private readonly runtimes = new Map<string, SessionRuntime>();
  private readonly runtimeStopListeners = new Map<string, () => void>();
  private readonly listeners = new Set<KernelListener>();
  private readonly eventLog: AnyRuntimeEvent[] = [];
  private readonly notifications = new SessionNotificationRegistry();
  private readonly terminalStatusByKey = new Map<string, { running: boolean; status: "IDLE" | "BUSY" }>();
  private readonly workspacePathSearch = new WorkspacePathSearchIndex();
  private readonly authService: AuthServiceBridge;
  private readonly avatarCatalogWatchers = new Map<string, FSWatcher>();
  private readonly avatarCatalogWatchPaths = new Map<string, string>();
  private readonly pendingAvatarCatalogInvalidations = new Set<string>();
  private readonly messageControlPlaneSubscriptions: Array<() => void> = [];
  private readonly terminalControlPlaneSubscriptions: Array<() => void> = [];
  private readonly pendingMessageRoomSnapshotInvalidations = new Set<string>();
  private readonly pendingMessageRoomGrantInvalidations = new Set<string>();
  private readonly pendingMessageRoomAssetInvalidations = new Set<string>();
  private readonly pendingTerminalGrantInvalidations = new Set<string>();
  private readonly pendingTerminalApprovalInvalidations = new Set<string>();
  private readonly pendingTerminalActivityInvalidations = new Set<string>();
  private pendingMessageRoomCatalogInvalidation = false;
  private pendingTerminalCatalogInvalidation = false;
  private avatarCatalogInvalidationTimer: ReturnType<typeof setTimeout> | null = null;
  private messageRoomInvalidationTimer: ReturnType<typeof setTimeout> | null = null;
  private terminalSurfaceInvalidationTimer: ReturnType<typeof setTimeout> | null = null;
  private eventSeq = 0;
  private sessionsCatalogLoaded = false;
  private started = false;

  constructor(private readonly options: AppKernelOptions = {}) {
    this.sessions = new SessionCatalog({
      globalRoot: options.globalSessionRoot,
      archiveRoot: options.archiveSessionRoot,
    });
    this.workspaces = new WorkspacesStore({ filePath: options.workspacesPath });
    this.messageControlPlane = new MessageControlPlane({
      dbPath: join(this.sessions.getGlobalRoot(), "..", ".message", "message.db"),
    });
    this.roomAssets = new RoomAssetStore(join(this.sessions.getGlobalRoot(), "..", ".message"));
    this.terminalControlPlane = new TerminalControlPlane({
      dbPath: join(this.sessions.getGlobalRoot(), "..", ".terminal", "terminal.db"),
      outputRoot: join(this.sessions.getGlobalRoot(), "..", ".terminal", "output"),
    });
    this.authService = new AuthServiceBridge({
      ...options.profileService,
      dataDir: options.profileService?.dataDir ?? join(this.sessions.getGlobalRoot(), "..", "profile-service"),
    });
  }

  private rememberWorkspace(workspacePath: string): void {
    this.workspaces.add(workspacePath);
    if (this.started) {
      this.syncAvatarCatalogWatchers();
    }
  }

  private resolveAvatarCatalogWatchPath(workspacePath: string): string | null {
    const homeDir = homedir();
    const normalizedWorkspacePath = isGlobalWorkspacePath(workspacePath, homeDir) ? GLOBAL_WORKSPACE_PATH : workspacePath;
    const workspaceCwd = toWorkspaceCwd(normalizedWorkspacePath, homeDir);
    if (!existsSync(workspaceCwd)) {
      return null;
    }
    const agenterRoot = join(workspaceCwd, ".agenter");
    const avatarRoot = resolveWorkspaceAvatarRoot(normalizedWorkspacePath, homeDir);
    if (existsSync(avatarRoot)) {
      return avatarRoot;
    }
    if (existsSync(agenterRoot)) {
      return agenterRoot;
    }
    return workspaceCwd;
  }

  private closeAvatarCatalogWatcher(workspacePath: string): void {
    const watcher = this.avatarCatalogWatchers.get(workspacePath);
    if (watcher) {
      try {
        watcher.close();
      } catch {
        // Ignore watcher shutdown races during rapid reloads.
      }
    }
    this.avatarCatalogWatchers.delete(workspacePath);
    this.avatarCatalogWatchPaths.delete(workspacePath);
  }

  private syncAvatarCatalogWatchers(): void {
    const desired = new Map<string, string>();
    for (const workspacePath of this.workspaces.list()) {
      const watchPath = this.resolveAvatarCatalogWatchPath(workspacePath);
      if (watchPath) {
        desired.set(workspacePath, watchPath);
      }
    }

    for (const workspacePath of [...this.avatarCatalogWatchers.keys()]) {
      if (!desired.has(workspacePath) || desired.get(workspacePath) !== this.avatarCatalogWatchPaths.get(workspacePath)) {
        this.closeAvatarCatalogWatcher(workspacePath);
      }
    }

    for (const [workspacePath, watchPath] of desired.entries()) {
      if (this.avatarCatalogWatchers.has(workspacePath)) {
        continue;
      }
      try {
        const watcher = watch(watchPath, { persistent: false }, () => {
          if (!this.started) {
            return;
          }
          const nextWatchPath = this.resolveAvatarCatalogWatchPath(workspacePath);
          if (nextWatchPath && nextWatchPath !== this.avatarCatalogWatchPaths.get(workspacePath)) {
            this.syncAvatarCatalogWatchers();
          }
          this.queueAvatarCatalogInvalidation(
            workspacePath === GLOBAL_WORKSPACE_PATH ? this.workspaces.list() : [workspacePath],
          );
        });
        this.avatarCatalogWatchers.set(workspacePath, watcher);
        this.avatarCatalogWatchPaths.set(workspacePath, watchPath);
      } catch {
        // Missing or unsupported watch roots should not block the runtime.
      }
    }
  }

  private queueAvatarCatalogInvalidation(workspacePaths: string[]): void {
    for (const workspacePath of workspacePaths) {
      this.pendingAvatarCatalogInvalidations.add(toWorkspacePath(workspacePath));
    }
    if (this.avatarCatalogInvalidationTimer) {
      clearTimeout(this.avatarCatalogInvalidationTimer);
    }
    this.avatarCatalogInvalidationTimer = setTimeout(() => {
      const invalidatedWorkspacePaths = [...this.pendingAvatarCatalogInvalidations];
      this.pendingAvatarCatalogInvalidations.clear();
      this.avatarCatalogInvalidationTimer = null;
      if (invalidatedWorkspacePaths.length === 0) {
        return;
      }
      this.emit("workspace.avatarCatalog.updated", {
        workspacePaths: invalidatedWorkspacePaths,
      });
    }, AVATAR_CATALOG_INVALIDATION_DEBOUNCE_MS);
  }

  private isStandaloneMessageRoomChange(input: { chatId: string; builtIn?: boolean }): boolean {
    if (typeof input.builtIn === "boolean") {
      return !input.builtIn;
    }
    return isStandaloneMessageRoomEntry(this.messageControlPlane.getChannel(input.chatId, { includeArchived: true }));
  }

  private queueMessageRoomInvalidation(input: {
    catalogChanged?: boolean;
    snapshotRoomIds?: string[];
    grantRoomIds?: string[];
    assetRoomIds?: string[];
  }): void {
    if (input.catalogChanged) {
      this.pendingMessageRoomCatalogInvalidation = true;
    }
    for (const chatId of input.snapshotRoomIds ?? []) {
      this.pendingMessageRoomSnapshotInvalidations.add(chatId);
    }
    for (const chatId of input.grantRoomIds ?? []) {
      this.pendingMessageRoomGrantInvalidations.add(chatId);
    }
    for (const chatId of input.assetRoomIds ?? []) {
      this.pendingMessageRoomAssetInvalidations.add(chatId);
    }
    if (this.messageRoomInvalidationTimer) {
      clearTimeout(this.messageRoomInvalidationTimer);
    }
    this.messageRoomInvalidationTimer = setTimeout(() => {
      const catalogChanged = this.pendingMessageRoomCatalogInvalidation;
      const snapshotRoomIds = [...this.pendingMessageRoomSnapshotInvalidations];
      const grantRoomIds = [...this.pendingMessageRoomGrantInvalidations];
      const assetRoomIds = [...this.pendingMessageRoomAssetInvalidations];
      this.pendingMessageRoomCatalogInvalidation = false;
      this.pendingMessageRoomSnapshotInvalidations.clear();
      this.pendingMessageRoomGrantInvalidations.clear();
      this.pendingMessageRoomAssetInvalidations.clear();
      this.messageRoomInvalidationTimer = null;
      if (!catalogChanged && snapshotRoomIds.length === 0 && grantRoomIds.length === 0 && assetRoomIds.length === 0) {
        return;
      }
      this.emit("message.room.updated", {
        catalogChanged,
        snapshotRoomIds,
        grantRoomIds,
        assetRoomIds,
      });
    }, MESSAGE_ROOM_INVALIDATION_DEBOUNCE_MS);
  }

  private bindMessageControlPlaneEvents(): void {
    if (this.messageControlPlaneSubscriptions.length > 0) {
      return;
    }
    this.messageControlPlaneSubscriptions.push(
      this.messageControlPlane.onChannelChanged((payload) => {
        if (!this.started || !this.isStandaloneMessageRoomChange(payload)) {
          return;
        }
        switch (payload.reason) {
          case "created":
            this.queueMessageRoomInvalidation({ catalogChanged: true });
            return;
          case "updated":
          case "message":
          case "read":
            this.queueMessageRoomInvalidation({
              catalogChanged: true,
              snapshotRoomIds: [payload.chatId],
            });
            return;
          case "grant-issued":
          case "grant-revoked":
            this.queueMessageRoomInvalidation({
              catalogChanged: true,
              snapshotRoomIds: [payload.chatId],
              grantRoomIds: [payload.chatId],
            });
            return;
          case "archived":
          case "deleted":
            this.queueMessageRoomInvalidation({ catalogChanged: true });
            return;
          case "focus":
          case "presence":
            this.queueMessageRoomInvalidation({ snapshotRoomIds: [payload.chatId] });
            return;
        }
      }),
    );
  }

  private queueTerminalSurfaceInvalidation(input: {
    catalogChanged?: boolean;
    grantTerminalIds?: string[];
    approvalTerminalIds?: string[];
    activityTerminalIds?: string[];
  }): void {
    if (input.catalogChanged) {
      this.pendingTerminalCatalogInvalidation = true;
    }
    for (const terminalId of input.grantTerminalIds ?? []) {
      this.pendingTerminalGrantInvalidations.add(terminalId);
    }
    for (const terminalId of input.approvalTerminalIds ?? []) {
      this.pendingTerminalApprovalInvalidations.add(terminalId);
    }
    for (const terminalId of input.activityTerminalIds ?? []) {
      this.pendingTerminalActivityInvalidations.add(terminalId);
    }
    if (this.terminalSurfaceInvalidationTimer) {
      clearTimeout(this.terminalSurfaceInvalidationTimer);
    }
    this.terminalSurfaceInvalidationTimer = setTimeout(() => {
      const catalogChanged = this.pendingTerminalCatalogInvalidation;
      const grantTerminalIds = [...this.pendingTerminalGrantInvalidations];
      const approvalTerminalIds = [...this.pendingTerminalApprovalInvalidations];
      const activityTerminalIds = [...this.pendingTerminalActivityInvalidations];
      this.pendingTerminalCatalogInvalidation = false;
      this.pendingTerminalGrantInvalidations.clear();
      this.pendingTerminalApprovalInvalidations.clear();
      this.pendingTerminalActivityInvalidations.clear();
      this.terminalSurfaceInvalidationTimer = null;
      if (
        !catalogChanged &&
        grantTerminalIds.length === 0 &&
        approvalTerminalIds.length === 0 &&
        activityTerminalIds.length === 0
      ) {
        return;
      }
      this.emit("terminal.surface.updated", {
        catalogChanged,
        grantTerminalIds,
        approvalTerminalIds,
        activityTerminalIds,
      });
    }, TERMINAL_SURFACE_INVALIDATION_DEBOUNCE_MS);
  }

  private bindTerminalControlPlaneEvents(): void {
    if (this.terminalControlPlaneSubscriptions.length > 0) {
      return;
    }
    this.terminalControlPlaneSubscriptions.push(
      this.terminalControlPlane.onChanged((payload) => {
        if (!this.started) {
          return;
        }
        switch (payload.reason) {
          case "created":
          case "updated":
          case "deleted":
          case "focus":
          case "presence":
          case "snapshot":
          case "status":
            this.queueTerminalSurfaceInvalidation({ catalogChanged: true });
            return;
          case "activity":
            this.queueTerminalSurfaceInvalidation({
              activityTerminalIds: [payload.terminalId],
            });
            return;
          case "grant-issued":
          case "grant-revoked":
            this.queueTerminalSurfaceInvalidation({
              catalogChanged: true,
              grantTerminalIds: [payload.terminalId],
              approvalTerminalIds: [payload.terminalId],
            });
            return;
          case "approval":
            this.queueTerminalSurfaceInvalidation({
              catalogChanged: true,
              approvalTerminalIds: [payload.terminalId],
            });
            return;
        }
      }),
    );
  }

  async start(): Promise<void> {
    this.started = true;
    this.bindMessageControlPlaneEvents();
    this.bindTerminalControlPlaneEvents();
    if (this.options.initialWorkspace) {
      this.rememberWorkspace(this.options.initialWorkspace);
    }
    this.ensureSessionCatalogLoaded();
    const boundSessions = await Promise.all(
      this.sessions.list().map(async (session) => this.bindSessionPrimaryRoomId(this.bindSessionAvatarPrincipal(session))),
    );
    this.syncAvatarCatalogWatchers();
    await Promise.all([
      this.messageControlPlane.startTransport({ port: 0 }),
      this.terminalControlPlane.startTransport({ port: 0 }),
      ...boundSessions.map((session) => this.syncSessionIconSeed(session)),
    ]);
  }

  async stop(): Promise<void> {
    this.started = false;
    for (const runtime of this.runtimes.values()) {
      await runtime.abort();
    }
    this.runtimes.clear();
    this.runtimeStopListeners.clear();
    this.terminalStatusByKey.clear();
    if (this.avatarCatalogInvalidationTimer) {
      clearTimeout(this.avatarCatalogInvalidationTimer);
      this.avatarCatalogInvalidationTimer = null;
    }
    if (this.messageRoomInvalidationTimer) {
      clearTimeout(this.messageRoomInvalidationTimer);
      this.messageRoomInvalidationTimer = null;
    }
    if (this.terminalSurfaceInvalidationTimer) {
      clearTimeout(this.terminalSurfaceInvalidationTimer);
      this.terminalSurfaceInvalidationTimer = null;
    }
    this.pendingAvatarCatalogInvalidations.clear();
    this.pendingMessageRoomCatalogInvalidation = false;
    this.pendingMessageRoomSnapshotInvalidations.clear();
    this.pendingMessageRoomGrantInvalidations.clear();
    this.pendingMessageRoomAssetInvalidations.clear();
    this.pendingTerminalCatalogInvalidation = false;
    this.pendingTerminalGrantInvalidations.clear();
    this.pendingTerminalApprovalInvalidations.clear();
    this.pendingTerminalActivityInvalidations.clear();
    for (const workspacePath of [...this.avatarCatalogWatchers.keys()]) {
      this.closeAvatarCatalogWatcher(workspacePath);
    }
    while (this.messageControlPlaneSubscriptions.length > 0) {
      this.messageControlPlaneSubscriptions.pop()?.();
    }
    while (this.terminalControlPlaneSubscriptions.length > 0) {
      this.terminalControlPlaneSubscriptions.pop()?.();
    }
    this.messageControlPlane.close();
    await this.terminalControlPlane.dispose();
    await this.authService.stop();
  }

  private ensureSessionCatalogLoaded(): void {
    if (this.sessionsCatalogLoaded) {
      return;
    }
    this.sessions.refresh(this.workspaces.list());
    this.sessionsCatalogLoaded = true;
  }

  private async syncSessionIconSeed(session: Pick<SessionMeta, "id" | "workspacePath">): Promise<void> {
    await this.authService.upsertSessionSeed({
      sessionId: session.id,
      workspacePath: session.workspacePath,
      label: buildSessionIconLabel(session.id),
    });
  }

  private bindSessionAvatarPrincipal(session: SessionMeta): SessionMeta {
    const principal = ensureAvatarSeatPrincipal({
      workspacePath: session.workspacePath,
      avatar: session.avatar,
    });
    if (session.avatarPrincipalId === principal.principalId) {
      return session;
    }
    return this.sessions.update(session.id, {
      avatarPrincipalId: principal.principalId,
    });
  }

  private async bindSessionPrimaryRoomId(session: SessionMeta): Promise<SessionMeta> {
    if (typeof session.primaryRoomId === "string" && isPrincipalId(session.primaryRoomId)) {
      return session;
    }
    return this.sessions.update(session.id, {
      primaryRoomId: await this.allocateGlobalRoomId(DEFAULT_MESSAGE_CHAT_TITLE),
    });
  }

  private resolvePersistedSessionPrimaryRoomId(sessionId: string): string {
    const primaryRoomId = this.sessions.get(sessionId)?.primaryRoomId;
    if (typeof primaryRoomId === "string" && isPrincipalId(primaryRoomId)) {
      return primaryRoomId;
    }
    throw new Error(`session primary room id unavailable: ${sessionId}`);
  }

  private resolveSessionMessageActorId(session: Pick<SessionMeta, "id" | "avatarPrincipalId">): MessageActorId {
    return (session.avatarPrincipalId ?? resolveSessionRoomActorId(session.id)) as MessageActorId;
  }

  private resolveSessionTerminalActorId(session: Pick<SessionMeta, "id" | "avatarPrincipalId">): TerminalActorId {
    return (session.avatarPrincipalId ?? resolveSessionRoomActorId(session.id)) as TerminalActorId;
  }

  private async allocateGlobalRoomId(title?: string): Promise<string> {
    const principal = await this.authService.createManagedPrincipal({
      kind: "room",
      metadata: title ? { title } : undefined,
    });
    if (!this.messageControlPlane.getChannel(principal.principalId, { includeArchived: true })) {
      return principal.principalId;
    }
    return (await this.authService.createManagedPrincipal({ kind: "room" })).principalId;
  }

  private resolveGlobalRoomProjection(input: {
    chatId: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
    includeArchived?: boolean;
  }): MessageControlPlaneEntry {
    if (input.actorId && !input.superadminActorId) {
      const room = this.messageControlPlane.getChannelForActor(input.chatId, input.actorId, {
        includeArchived: input.includeArchived,
        touchPresence: false,
      });
      if (!room) {
        throw new Error("message room credential-invalid");
      }
      return room;
    }
    const room = this.messageControlPlane.getChannel(input.chatId, {
      includeArchived: input.includeArchived,
    });
    if (!room) {
      throw new Error(`unknown message room: ${input.chatId}`);
    }
    return room;
  }

  private resolveGlobalRoomAccess(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
    includeArchived?: boolean;
  }): { room: MessageControlPlaneEntry; accessToken: string } {
    const room = this.resolveGlobalRoomProjection(input);
    return {
      room,
      accessToken: input.accessToken ?? room.accessToken,
    };
  }

  private resolveGlobalTerminalProjection(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalControlPlaneEntry {
    if (input.actorId && !input.superadminActorId) {
      const terminal = this.terminalControlPlane
        .listForActor(input.actorId, { touchPresence: false })
        .find((entry) => entry.terminalId === input.terminalId);
      if (!terminal) {
        throw new Error("terminal credential-invalid");
      }
      return terminal;
    }
    const terminal = this.terminalControlPlane.list().find((entry) => entry.terminalId === input.terminalId);
    if (!terminal) {
      throw new Error(`unknown terminal: ${input.terminalId}`);
    }
    return terminal;
  }

  private resolveGlobalTerminalAccess(input: {
    terminalId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): { terminal: TerminalControlPlaneEntry; accessToken: string | undefined } {
    const terminal = this.resolveGlobalTerminalProjection(input);
    return {
      terminal,
      accessToken: input.accessToken ?? terminal.access?.accessToken,
    };
  }

  private ensureSessionPrimaryRoom(
    session: Pick<SessionMeta, "id" | "avatar" | "avatarPrincipalId" | "primaryRoomId" | "createdAt" | "updatedAt">,
  ): MessageControlPlaneEntry {
    const actorId = this.resolveSessionMessageActorId(session);
    const roomId = this.resolvePersistedSessionPrimaryRoomId(session.id);
    const existing = this.messageControlPlane.getChannelForActor(roomId, actorId, { touchPresence: false });
    if (existing) {
      return repairRoomParticipantsIfNeeded(this.messageControlPlane, existing);
    }
    const bootstrap = this.messageControlPlane.getChannel(roomId, { includeArchived: true });
    if (bootstrap) {
      const repairedBootstrap = repairRoomParticipantsIfNeeded(this.messageControlPlane, bootstrap);
      this.messageControlPlane.issueChannelGrantAuthorized({
        chatId: roomId,
        accessToken: repairedBootstrap.accessToken,
        role: "admin",
        label: session.avatar,
        participantId: actorId,
      });
      return (
        this.messageControlPlane.getChannelForActor(roomId, actorId, { includeArchived: true, touchPresence: false }) ??
        repairedBootstrap
      );
    }
    return this.messageControlPlane.createChannel({
      chatId: roomId,
      kind: "room",
      title: DEFAULT_MESSAGE_CHAT_TITLE,
      owner: session.avatar,
      contextId: `ctx-${roomId}`,
      participants: [],
      metadata: {
        builtIn: true,
        primaryRoom: true,
        sessionId: session.id,
      },
      bootstrapActorId: actorId,
    });
  }

  getSnapshot(): RuntimeSnapshotPayload {
    const runtimes = Object.fromEntries(
      [...this.runtimes.entries()].map(([sessionId, runtime]) => [sessionId, runtime.snapshot()]),
    );

    return {
      version: 1,
      timestamp: now(),
      lastEventId: this.eventSeq,
      sessions: this.sessions.list(),
      runtimes,
    };
  }

  onEvent(listener: KernelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEventsAfter(afterEventId: number): AnyRuntimeEvent[] {
    if (afterEventId >= this.eventSeq || this.eventLog.length === 0) {
      return [];
    }
    return this.eventLog.filter((event) => event.eventId > afterEventId);
  }

  listSessions(): SessionMeta[] {
    this.ensureSessionCatalogLoaded();
    return this.sessions.list();
  }

  listRecentWorkspaces(limit = 8): string[] {
    return this.workspaces.listRecent(limit);
  }

  listAllWorkspaces(): WorkspaceListItem[] {
    this.ensureSessionCatalogLoaded();
    const byWorkspace = new Map<string, SessionMeta[]>();
    for (const session of this.sessions.list()) {
      const list = byWorkspace.get(session.workspacePath) ?? [];
      list.push(session);
      byWorkspace.set(session.workspacePath, list);
    }

    return this.workspaces.listEntries().map((entry) => {
      const sessions = byWorkspace.get(entry.path) ?? [];
      const counts = countWorkspaceSessions(sessions);
      const lastSessionActivityAt = sessions
        .map((session) => sessionSortAt(session))
        .sort((left, right) => right.localeCompare(left))[0];
      return {
        ...entry,
        objectivePath: entry.path === GLOBAL_WORKSPACE_PATH ? join(homedir(), ".agenter") : entry.path,
        group: entry.path === GLOBAL_WORKSPACE_PATH ? "Global" : resolveWorkspaceGroup(entry.path),
        missing: entry.path === GLOBAL_WORKSPACE_PATH ? false : !this.validateDirectory(entry.path).ok,
        counts,
        lastSessionActivityAt,
      };
    });
  }

  listWorkspaceAvatarCatalog(workspacePath: string): WorkspaceAvatarCatalogEntry[] {
    return listWorkspaceAvatarCatalog(toWorkspacePath(workspacePath));
  }

  forkWorkspaceAvatar(input: { workspacePath: string; avatar: string }): WorkspaceAvatarCatalogEntry {
    const workspacePath = toWorkspacePath(input.workspacePath);
    this.rememberWorkspace(workspacePath);
    const avatar = forkAvatarIntoWorkspace({
      workspacePath,
      nickname: input.avatar,
    });
    this.queueAvatarCatalogInvalidation([workspacePath]);
    return avatar;
  }

  copyWorkspaceAvatar(input: {
    workspacePath: string;
    sourceAvatar: string;
    targetAvatar: string;
  }): WorkspaceAvatarCatalogEntry {
    const workspacePath = toWorkspacePath(input.workspacePath);
    this.rememberWorkspace(workspacePath);
    const avatar = copyAvatarIntoWorkspace({
      workspacePath,
      sourceNickname: input.sourceAvatar,
      targetNickname: input.targetAvatar,
    });
    this.queueAvatarCatalogInvalidation([workspacePath]);
    return avatar;
  }

  inspectWorkspaceWelcome(input: {
    workspacePath: string;
    avatar?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
    terminalActorId?: TerminalActorId;
    superadminTerminalActorId?: TerminalActorId;
  }): WorkspaceWelcomeSnapshot {
    const workspacePath = toWorkspacePath(input.workspacePath);
    const avatar = normalizeAvatarNickname(input.avatar ?? defaultAvatarNickname());
    const sessionId = resolveWorkspaceAvatarSessionId(workspacePath, avatar);
    const avatarPrincipal = ensureAvatarSeatPrincipal({
      workspacePath,
      avatar,
    });
    const sessionRoomActorId = avatarPrincipal.principalId as MessageActorId;
    const sessionTerminalActorId = avatarPrincipal.principalId as TerminalActorId;
    const seatDoc = readAvatarSeatDocument(workspacePath, avatar);

    const accessibleRoomIds = new Set(
      this.messageControlPlane
        .listChannelsForActor(sessionRoomActorId, {
          includeArchived: true,
          touchPresence: false,
        })
        .map((channel) => channel.chatId),
    );
    const accessibleTerminalIds = new Set(
      this.terminalControlPlane.listForActor(sessionTerminalActorId, {
        touchPresence: false,
      }).map((terminal) => terminal.terminalId),
    );

    const rooms = this.listGlobalRooms({
      actorId: input.actorId,
      superadminActorId: input.superadminActorId,
      includeArchived: true,
    }).map((channel) => {
      const seat = seatDoc.messageSeats[channel.chatId];
      const access = resolveWelcomeAccessState(accessibleRoomIds.has(channel.chatId), seat);
      return {
        channel,
        ...access,
        canAuthorize: channel.accessRole === "admin",
      } satisfies WorkspaceWelcomeRoomItem;
    });

    const terminals = this.listGlobalTerminals({
      actorId: input.terminalActorId,
      superadminActorId: input.superadminTerminalActorId,
    }).map((terminal) => {
      const seat = seatDoc.terminalSeats[terminal.terminalId];
      const access = resolveWelcomeAccessState(accessibleTerminalIds.has(terminal.terminalId), seat);
      return {
        terminal,
        ...access,
        canAuthorize: terminal.access?.role === "admin",
      } satisfies WorkspaceWelcomeTerminalItem;
    });

    return {
      workspacePath,
      avatar,
      sessionId,
      avatars: this.listWorkspaceAvatarCatalog(workspacePath),
      rooms,
      terminals,
    };
  }

  saveWorkspaceAvatarRoomSeat(input: {
    workspacePath: string;
    avatar: string;
    chatId: string;
    accessToken: string;
    accessRole: MessageChannelAccessRole;
    state?: AvatarSeatState;
  }): { ok: true } {
    saveAvatarMessageSeatCredential(input);
    return { ok: true };
  }

  saveWorkspaceAvatarTerminalSeat(input: {
    workspacePath: string;
    avatar: string;
    terminalId: string;
    accessToken: string;
    accessRole: TerminalGrantRole;
    state?: AvatarSeatState;
  }): { ok: true } {
    saveAvatarTerminalSeatCredential(input);
    return { ok: true };
  }

  listWorkspaceSessions(input: {
    path: string;
    tab: WorkspaceSessionTab;
    cursor?: number;
    limit?: number;
  }): WorkspaceSessionPage {
    const workspacePath = toWorkspacePath(input.path);
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 50), 200));
    const cursor = Math.max(0, Math.floor(input.cursor ?? 0));
    this.ensureSessionCatalogLoaded();
    const favoriteIds = new Set(this.workspaces.favoriteSessionIds());
    const workspaceSessions = this.sessions.list().filter((session) => session.workspacePath === workspacePath);
    const counts = countWorkspaceSessions(workspaceSessions);
    const filtered = workspaceSessions
      .filter((session) => matchesWorkspaceTab(session, input.tab))
      .sort(compareWorkspaceSessions(favoriteIds));
    const items = filtered.slice(cursor, cursor + limit).map((session) => ({
      sessionId: session.id,
      name: session.name,
      status: session.status,
      storageState: session.storageState,
      favorite: favoriteIds.has(session.id),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      archivedAt: session.archivedAt,
      preview: this.readSessionPreview(session),
    }));

    return {
      items,
      nextCursor: cursor + items.length < filtered.length ? cursor + items.length : null,
      counts,
    };
  }

  toggleWorkspaceFavorite(workspacePath: string): WorkspaceEntry {
    return this.workspaces.toggleWorkspaceFavorite(workspacePath);
  }

  toggleSessionFavorite(sessionId: string): { sessionId: string; favorite: boolean } {
    return this.workspaces.toggleSessionFavorite(sessionId);
  }

  removeWorkspace(workspacePath: string): { removed: boolean } {
    return { removed: this.workspaces.remove(workspacePath) };
  }

  removeMissingWorkspaces(): { removed: string[] } {
    const removed: string[] = [];
    for (const workspacePath of this.workspaces.list()) {
      if (this.validateDirectory(workspacePath).ok) {
        continue;
      }
      if (this.workspaces.remove(workspacePath)) {
        removed.push(workspacePath);
      }
    }
    return { removed };
  }

  listChatMessages(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): PersistedChatMessage[] {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatMessagesFromDb(session.sessionRoot, sessionId, afterId, limit);
  }

  pageChatMessages(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<PersistedChatMessage> {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readChatMessagesPageFromDb(session.sessionRoot, sessionId, input);
  }

  listChatMessagesBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): PersistedChatMessage[] {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatMessagesBeforeFromDb(session.sessionRoot, sessionId, beforeId, limit);
  }

  listChatCycles(sessionId: string, limit = 120): ChatCycle[] {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatCyclesFromDb(session.sessionRoot, sessionId, limit);
  }

  pageChatCycles(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ChatCycle> {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readChatCyclesPageFromDb(session.sessionRoot, sessionId, input);
  }

  listChatCyclesBefore(sessionId: string, beforeCycleId: number, limit = 120): ChatCycle[] {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readChatCyclesBeforeFromDb(session.sessionRoot, sessionId, beforeCycleId, limit);
  }

  listDirectories(input: { path?: string; includeHidden?: boolean }): Array<{ name: string; path: string }> {
    const root = resolve(input.path ?? "/");
    const includeHidden = input.includeHidden ?? false;
    try {
      accessSync(root, fsConstants.R_OK);
      const entries = readdirSync(root, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => includeHidden || !entry.name.startsWith("."))
        .map((entry) => ({
          name: entry.name,
          path: join(root, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  private resolveWorkspaceTarget(path: string): { ok: boolean; cwd: string; workspacePath: string } {
    const workspacePath = toWorkspacePath(path);
    const cwd = toWorkspaceCwd(path);
    try {
      const stat = statSync(cwd);
      if (!stat.isDirectory()) {
        return { ok: false, cwd, workspacePath };
      }
      accessSync(cwd, fsConstants.R_OK);
      return { ok: true, cwd, workspacePath };
    } catch {
      return { ok: false, cwd, workspacePath };
    }
  }

  validateDirectory(path: string): { ok: boolean; path: string } {
    const target = this.resolveWorkspaceTarget(path);
    return { ok: target.ok, path: target.cwd };
  }

  async resolveDraft(input: { cwd: string; avatar?: string }): Promise<{
    cwd: string;
    avatar?: string;
    provider: {
      providerId: string;
      apiStandard: string;
      vendor?: string;
      profile?: string;
      model: string;
      baseUrl?: string;
    };
    modelCapabilities: ModelCapabilities;
  }> {
    const workspace = this.resolveWorkspaceTarget(input.cwd);
    const cwd = workspace.cwd;
    const config = await resolveSessionConfig(cwd, { avatar: input.avatar });
    this.rememberWorkspace(workspace.workspacePath);
    return {
      cwd,
      avatar: input.avatar,
      provider: {
        providerId: config.ai.providerId,
        apiStandard: config.ai.apiStandard,
        vendor: config.ai.vendor,
        profile: config.ai.profile,
        model: config.ai.model,
        baseUrl: config.ai.baseUrl,
      },
      modelCapabilities: resolveModelCapabilities(config.ai),
    };
  }

  searchWorkspacePaths(input: {
    cwd: string;
    query?: string;
    limit?: number;
  }): Array<{ label: string; path: string; isDirectory: boolean; ignored?: boolean }> {
    return this.workspacePathSearch.search(input);
  }

  getSession(sessionId: string): SessionMeta | undefined {
    return this.sessions.get(sessionId);
  }

  async createSession(input: {
    name?: string;
    cwd: string;
    avatar?: string;
    autoStart?: boolean;
  }): Promise<SessionMeta> {
    const workspace = this.resolveWorkspaceTarget(input.cwd);
    if (!workspace.ok) {
      throw new Error(`invalid workspace directory: ${workspace.cwd}`);
    }

    const resolved = await resolveSessionConfig(workspace.cwd, { avatar: input.avatar });
    const workspacePath = workspace.workspacePath;
    const avatarPrincipal = ensureAvatarSeatPrincipal({
      workspacePath,
      avatar: resolved.avatar.nickname,
    });
    this.rememberWorkspace(workspacePath);
    const existing = this.sessions.findByWorkspaceAvatar(workspacePath, resolved.avatar.nickname);
    if (existing) {
      const reusableBase = existing.storageState === "archived" ? this.sessions.restore(existing.id) : existing;
      const reusable =
        reusableBase.avatarPrincipalId === avatarPrincipal.principalId
          ? reusableBase
          : this.sessions.update(reusableBase.id, { avatarPrincipalId: avatarPrincipal.principalId });
      const renamed =
        input.name?.trim().length && input.name.trim() !== reusable.name
          ? this.sessions.update(reusable.id, { name: input.name.trim() })
          : reusable;
      const updated = await this.bindSessionPrimaryRoomId(renamed);
      await this.syncSessionIconSeed(updated);
      this.ensureSessionPrimaryRoom(updated);
      this.emit("session.updated", { session: updated }, updated.id);
      if (input.autoStart === false) {
        return updated;
      }
      if (updated.status === "running" || updated.status === "starting") {
        return updated;
      }
      return await this.startSession(updated.id);
    }

    const session = this.sessions.create({
      name: input.name,
      cwd: workspace.cwd,
      workspacePath,
      avatar: resolved.avatar.nickname,
      avatarPrincipalId: avatarPrincipal.principalId,
      storeTarget: "global",
    });
    const boundSession = await this.bindSessionPrimaryRoomId(session);
    await this.syncSessionIconSeed(boundSession);
    this.ensureSessionPrimaryRoom(boundSession);
    this.emit("session.updated", { session: boundSession }, boundSession.id);

    if (input.autoStart === false) {
      return boundSession;
    }

    return await this.startSession(boundSession.id);
  }

  updateSession(sessionId: string, patch: { name?: string }): SessionMeta {
    const session = this.sessions.update(sessionId, {
      name: patch.name,
    });
    this.emit("session.updated", { session }, session.id);
    return session;
  }

  async deleteSession(sessionId: string): Promise<{ removed: boolean }> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.abort();
      this.detachRuntime(sessionId);
    }
    this.workspaces.removeSessionFavorite(sessionId);
    const removed = this.sessions.remove(sessionId);
    if (removed) {
      this.emitNotificationSnapshot(this.notifications.removeSession(sessionId), sessionId);
      this.emit("session.deleted", { sessionId, removed }, sessionId);
    }
    return { removed };
  }

  async archiveSession(sessionId: string): Promise<SessionMeta> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.abort();
      this.detachRuntime(sessionId);
    }
    const archived = this.sessions.archive(sessionId);
    this.emitNotificationSnapshot(this.notifications.removeSession(sessionId), sessionId);
    this.emit("session.updated", { session: archived }, sessionId);
    return archived;
  }

  async restoreSession(sessionId: string): Promise<SessionMeta> {
    const restored = this.sessions.restore(sessionId);
    this.emit("session.updated", { session: restored }, sessionId);
    return restored;
  }

  async startSession(sessionId: string): Promise<SessionMeta> {
    const existingMeta = this.sessions.get(sessionId);
    if (!existingMeta) {
      throw new Error(`session not found: ${sessionId}`);
    }
    if (existingMeta.storageState === "archived") {
      throw new Error(`session is archived: ${sessionId}`);
    }
    const avatarBoundMeta = this.bindSessionAvatarPrincipal(existingMeta);
    const meta = await this.bindSessionPrimaryRoomId(avatarBoundMeta);

    this.rememberWorkspace(meta.workspacePath);

    const existing = this.runtimes.get(sessionId);
    if (existing?.isStarted()) {
      existing.resume();
      existing.setSessionStatus("running");
      const running = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      this.emit("session.updated", { session: running }, sessionId);
      return running;
    }

    this.sessions.update(sessionId, { status: "starting", lastError: undefined });
    this.ensureSessionPrimaryRoom(meta);
    const primaryRoomId = meta.primaryRoomId;
    if (!primaryRoomId) {
      throw new Error(`session primary room id missing: ${meta.id}`);
    }
    const runtime = new SessionRuntime({
      sessionId: meta.id,
      cwd: meta.cwd,
      avatar: meta.avatar,
      sessionRoot: meta.sessionRoot,
      sessionName: meta.name,
      storeTarget: meta.storeTarget,
      avatarPrincipalId: meta.avatarPrincipalId,
      messageSystem: this.messageControlPlane,
      messageActorId: this.resolveSessionMessageActorId(meta),
      terminalSystem: this.terminalControlPlane,
      terminalActorId: this.resolveSessionTerminalActorId(meta),
      primaryRoomId,
      allocateRoomId: async ({ kind, title }) => this.allocateGlobalRoomId(kind === "room" ? title : undefined),
      logger: this.options.logger,
    });
    runtime.setSessionStatus("starting");

    const unsubscribe = runtime.onEvent((event) => {
      this.forwardRuntimeEvent(meta.id, event);
    });

    this.runtimes.set(sessionId, runtime);
    this.runtimeStopListeners.set(sessionId, unsubscribe);

    try {
      await runtime.start();
      const updated = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      runtime.setSessionStatus("running");
      this.emit("session.updated", { session: updated }, sessionId);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtime.setSessionStatus("error", message);
      this.detachRuntime(sessionId);
      const failed = this.sessions.update(sessionId, { status: "error", lastError: message });
      this.emit("session.updated", { session: failed }, sessionId);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<SessionMeta> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.stop();
    }
    const stopped = this.sessions.update(sessionId, { status: "stopped", lastError: undefined });
    this.emit("session.updated", { session: stopped }, sessionId);
    return stopped;
  }

  async abortSession(sessionId: string): Promise<SessionMeta> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      await runtime.abort();
      this.detachRuntime(sessionId);
    }
    const stopped = this.sessions.update(sessionId, { status: "stopped", lastError: undefined });
    this.emit("session.updated", { session: stopped }, sessionId);
    return stopped;
  }

  focusTerminal(sessionId: string, terminalId: string): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    const ok = runtime.focusTerminal(terminalId);
    return { ok };
  }

  listMessageChannels(sessionId: string, input: { includeArchived?: boolean } = {}): MessageControlPlaneEntry[] {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.listMessageChannels({ includeArchived: input.includeArchived });
    }
    this.ensureSessionCatalogLoaded();
    const existingSession = this.sessions.get(sessionId);
    if (!existingSession) {
      return [];
    }
    const session = this.bindSessionAvatarPrincipal(existingSession);
    this.ensureSessionPrimaryRoom(session);
    return this.messageControlPlane.listChannelsForActor(this.resolveSessionMessageActorId(session), {
      includeArchived: input.includeArchived,
      touchPresence: false,
    });
  }

  async createMessageChannel(input: {
    sessionId: string;
    kind: MessageChannelKind;
    title?: string;
    participants?: Array<{
      id: string;
      label?: string;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }): Promise<MessageControlPlaneEntry> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return await runtime.createMessageChannel({
      kind: input.kind,
      title: input.title,
      participants: input.participants,
      metadata: input.metadata,
      adminToken: input.adminToken,
      focus: input.focus,
    });
  }

  focusMessageChannels(input: {
    sessionId: string;
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken: string }>;
  }): MessageControlPlaneEntry[] {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.focusMessageChannels({ op: input.op, channels: input.channels });
  }

  updateMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    patch: MessageChannelPatchInput;
  }): MessageControlPlaneEntry {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.updateMessageChannel({
      chatId: input.chatId,
      accessToken: input.accessToken,
      patch: input.patch,
    });
  }

  archiveMessageChannel(input: { sessionId: string; chatId: string; accessToken: string; archivedBy?: string }): MessageControlPlaneEntry {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.archiveMessageChannel({
      chatId: input.chatId,
      accessToken: input.accessToken,
      archivedBy: input.archivedBy,
    });
  }

  deleteMessageChannel(input: { sessionId: string; chatId: string; accessToken: string }): MessageControlPlaneEntry {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.deleteMessageChannel({
      chatId: input.chatId,
      accessToken: input.accessToken,
    });
  }

  listMessageChannelGrants(input: { sessionId: string; chatId: string; accessToken: string }): MessageChannelGrantRecord[] {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.listMessageChannelGrants({
      chatId: input.chatId,
      accessToken: input.accessToken,
    });
  }

  issueMessageChannelGrant(
    input: { sessionId: string; chatId: string; accessToken: string } & MessageIssueGrantInput,
  ): MessageIssuedGrant {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.issueMessageChannelGrant({
      chatId: input.chatId,
      accessToken: input.accessToken,
      role: input.role,
      label: input.label,
      participantId: input.participantId,
      accessTokenHint: input.accessTokenHint,
    });
  }

  revokeMessageChannelGrant(input: { sessionId: string; chatId: string; accessToken: string; grantId: string }): { ok: boolean } {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.revokeMessageChannelGrant({
      chatId: input.chatId,
      accessToken: input.accessToken,
      grantId: input.grantId,
    });
  }

  listGlobalRooms(input: {
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
    includeArchived?: boolean;
  } = {}): MessageControlPlaneEntry[] {
    if (input.actorId && !input.superadminActorId) {
      return this.messageControlPlane
        .listChannelsForActor(input.actorId, {
          includeArchived: input.includeArchived,
          touchPresence: false,
        })
        .filter(isStandaloneMessageRoomEntry);
    }
    return this.messageControlPlane.listChannels({
      includeArchived: input.includeArchived,
    }).filter(isStandaloneMessageRoomEntry);
  }

  async createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    participants?: Array<{
      id: string;
      label?: string;
    }>;
    initialUsers?: Array<{
      actorId: MessageActorId;
      label?: string;
      role: MessageChannelAccessRole;
      focused?: boolean;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): Promise<MessageControlPlaneEntry> {
    const room = this.messageControlPlane.createChannel({
      chatId: input.chatId ?? (await this.allocateGlobalRoomId(input.title)),
      kind: "room",
      title: input.title ?? DEFAULT_MESSAGE_CHAT_TITLE,
      participants: input.participants,
      initialUsers: input.initialUsers,
      metadata: sanitizeGlobalRoomMetadata(input.metadata),
      adminToken: input.adminToken,
      bootstrapActorId: input.actorId && !input.superadminActorId ? input.actorId : undefined,
    });
    const shouldFocus = input.focus ?? true;
    if (input.actorId && !input.superadminActorId) {
      if (!shouldFocus) {
        this.messageControlPlane.focusForActor(input.actorId, "remove", [room.chatId]);
      }
      return this.resolveGlobalRoomProjection({
        chatId: room.chatId,
        actorId: input.actorId,
        includeArchived: true,
      });
    }
    return this.resolveGlobalRoomProjection({
      chatId: room.chatId,
      superadminActorId: input.superadminActorId,
      includeArchived: true,
    });
  }

  focusGlobalRooms(input: {
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken?: string }>;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): { ok: boolean; message: string; focusedChatIds: string[] } {
    const focusedChatIds =
      input.channels.length > 0 && input.channels.every((channel) => typeof channel.accessToken === "string" && channel.accessToken.length > 0)
        ? this.messageControlPlane.focusAuthorized(
            input.op,
            input.channels.map((channel) => ({
              chatId: channel.chatId,
              accessToken: channel.accessToken!,
            })),
          )
        : input.actorId && !input.superadminActorId
          ? this.messageControlPlane.focusForActor(
              input.actorId,
              input.op,
              input.channels.map((channel) => channel.chatId),
            )
        : this.messageControlPlane.focus(
            input.op,
            input.channels.map((channel) => channel.chatId),
          );
    return {
      ok: true,
      message: `focus ${input.op}`,
      focusedChatIds,
    };
  }

  markGlobalRoomRead(input: {
    chatId: string;
    messageId?: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): MessageControlPlaneEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.markChannelReadAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      messageId: input.messageId,
    });
  }

  pageGlobalRoomMessages(input: {
    chatId: string;
    before?: ReverseTimeCursor | null;
    limit?: number;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): ReversePage<MessageRecord> {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.queryMessagesAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      before: input.before,
      limit: input.limit,
    });
  }

  snapshotGlobalRoom(input: {
    chatId: string;
    limit?: number;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): MessageSnapshot {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.snapshotAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      limit: input.limit,
    });
  }

  sendGlobalRoomMessage(input: {
    chatId: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
    accessToken?: string;
    sendAsActorId?: MessageActorId;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): { ok: boolean; reason?: string } {
    try {
      const access = this.resolveGlobalRoomAccess(input);
      const attachments = this.resolveGlobalRoomAttachments(input.chatId, input.assetIds ?? []);
      this.messageControlPlane.sendAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        kind: "text",
        content: input.text,
        messageId: input.clientMessageId ?? `msg-${randomUUID()}`,
        senderActorId: this.resolveGlobalRoomSenderActorId(input, access),
        attachments,
        metadata: input.clientMessageId ? { clientMessageId: input.clientMessageId } : undefined,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "message send failed",
      };
    }
  }

  updateGlobalRoom(input: {
    chatId: string;
    patch: MessageChannelPatchInput;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): MessageControlPlaneEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.updateChannelAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminActorId: input.superadminActorId,
      patch: {
        ...input.patch,
        metadata: sanitizeGlobalRoomMetadata(input.patch.metadata),
      },
    });
  }

  archiveGlobalRoom(input: {
    chatId: string;
    archivedBy?: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): MessageControlPlaneEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.archiveChannelAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminActorId: input.superadminActorId,
      archivedBy: input.archivedBy ?? access.room.owner,
    });
  }

  deleteGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): MessageControlPlaneEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.deleteChannelAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminActorId: input.superadminActorId,
    });
  }

  listGlobalRoomGrants(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): MessageChannelGrantRecord[] {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.listChannelGrantsAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminActorId: input.superadminActorId,
    });
  }

  issueGlobalRoomGrant(
    input: {
      chatId: string;
      accessToken?: string;
      actorId?: MessageActorId;
      superadminActorId?: MessageActorId;
    } & MessageIssueGrantInput,
  ): MessageIssuedGrant {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.issueChannelGrantAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminActorId: input.superadminActorId,
      role: input.role,
      label: input.label,
      participantId: input.participantId,
      accessTokenHint: input.accessTokenHint,
    });
  }

  revokeGlobalRoomGrant(input: {
    chatId: string;
    grantId: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): { ok: boolean } {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.revokeChannelGrantAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminActorId: input.superadminActorId,
      grantId: input.grantId,
    });
  }

  listGlobalTerminals(input: {
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  } = {}): TerminalControlPlaneEntry[] {
    if (input.superadminActorId || !input.actorId) {
      return this.terminalControlPlane.list();
    }
    return this.terminalControlPlane.listForActor(input.actorId, {
      touchPresence: false,
    });
  }

  async createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    focus?: boolean;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string; terminal?: TerminalControlPlaneEntry }> {
    const created =
      input.actorId && !input.superadminActorId
        ? await this.terminalControlPlane.createForActor(input.actorId, {
            terminalId: input.terminalId,
            processKind: input.processKind,
            command: input.command,
            cwd: input.cwd,
            profile: input.profile,
          })
        : await this.terminalControlPlane.create({
            terminalId: input.terminalId,
            processKind: input.processKind,
            command: input.command,
            cwd: input.cwd,
            profile: input.profile,
          });

    if (input.actorId && !input.superadminActorId) {
      if (input.focus ?? true) {
        this.terminalControlPlane.focusForActor(input.actorId, "replace", [created.terminalId]);
      }
      const terminal = this.terminalControlPlane
        .listForActor(input.actorId, { touchPresence: false })
        .find((entry) => entry.terminalId === created.terminalId);
      return {
        ok: true,
        message: terminal ? "terminal created" : "terminal created but unavailable to actor",
        terminal,
      };
    }
    const terminal = this.terminalControlPlane.list().find((entry) => entry.terminalId === created.terminalId);
    return {
      ok: true,
      message: terminal ? "terminal created" : "terminal created but unavailable in catalog",
      terminal,
    };
  }

  focusGlobalTerminals(input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): { ok: boolean; message: string; focusedTerminalIds: string[] } {
    const seatAccessToken = input.accessToken;
    const focusedTerminalIds = seatAccessToken
      ? this.terminalControlPlane.focusAuthorized(
          input.op,
          input.terminalIds.map((terminalId) => ({
            terminalId,
            accessToken: seatAccessToken,
          })),
        )
      : input.actorId && !input.superadminActorId
        ? this.terminalControlPlane.focusForActor(input.actorId, input.op, input.terminalIds)
        : this.terminalControlPlane.focus(input.op, input.terminalIds);
    return {
      ok: true,
      message: `focus ${input.op}`,
      focusedTerminalIds,
    };
  }

  async deleteGlobalTerminal(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string }> {
    return await this.terminalControlPlane.killAuthorized(input);
  }

  listGlobalTerminalGrants(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalGrantRecord[] {
    return this.terminalControlPlane.listGrantsAuthorized(input);
  }

  issueGlobalTerminalGrant(
    input: {
      terminalId: string;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } & TerminalIssueGrantInput,
  ) {
    return this.terminalControlPlane.issueGrantAuthorized(input);
  }

  revokeGlobalTerminalGrant(input: {
    terminalId: string;
    grantId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): { ok: boolean } {
    return this.terminalControlPlane.revokeGrantAuthorized(input);
  }

  listGlobalTerminalApprovalRequests(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
    participantId?: TerminalActorId;
    assignedAdminId?: TerminalActorId;
    statuses?: TerminalApprovalRequestRecord["status"][];
  }): TerminalApprovalRequestRecord[] {
    return this.terminalControlPlane.listApprovalRequestsAuthorized(input);
  }

  approveGlobalTerminalRequest(input: {
    terminalId: string;
    requestId: string;
    durationMs: number;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }) {
    return this.terminalControlPlane.approveRequestAuthorized(input);
  }

  denyGlobalTerminalRequest(input: {
    terminalId: string;
    requestId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }) {
    return this.terminalControlPlane.denyRequestAuthorized(input);
  }

  pageGlobalTerminalActivity(
    input: {
      terminalId: string;
      before?: ReverseTimeCursor;
      limit?: number;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    },
  ): ReversePage<TerminalActivityRecord> {
    const page = this.terminalControlPlane.pageEventsAuthorized(input);
    return {
      items: page.items.map(projectTerminalEventToActivityRecord),
      nextBefore: page.nextBefore,
      hasMoreBefore: page.hasMoreBefore,
    };
  }

  async readGlobalTerminal(input: {
    terminalId: string;
    mode?: TerminalReadMode;
    remark?: boolean;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<TerminalReadResult> {
    const access = this.resolveGlobalTerminalAccess(input);
    return await this.terminalControlPlane.readAuthorized({
      terminalId: input.terminalId,
      mode: input.mode,
      remark: input.remark,
      accessToken: access.accessToken,
      ...(access.accessToken
        ? {}
        : {
            actorId: input.actorId,
            superadminActorId: input.superadminActorId,
          }),
    });
  }

  async writeGlobalTerminal(input: {
    terminalId: string;
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
    submitGapMs?: number;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readMode?: TerminalReadMode;
    createApprovalRequest?: boolean;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<TerminalWriteResult> {
    const access = this.resolveGlobalTerminalAccess(input);
    return await this.terminalControlPlane.write({
      terminalId: input.terminalId,
      text: input.text,
      submit: input.submit,
      submitKey: input.submitKey,
      submitGapMs: input.submitGapMs,
      returnRead: input.returnRead,
      readMode: input.readMode,
      createApprovalRequest: input.createApprovalRequest,
      accessToken: access.accessToken,
      ...(access.accessToken
        ? {}
        : {
            actorId: input.actorId,
            superadminActorId: input.superadminActorId,
          }),
    });
  }

  listTerminals(sessionId: string): TerminalControlPlaneEntry[] {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listRuntimeTerminals();
  }

  async createTerminal(input: {
    sessionId: string;
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    focus?: boolean;
  }): Promise<{ ok: boolean; message: string; terminal?: TerminalControlPlaneEntry }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return await runtime.createRuntimeTerminal({
      terminalId: input.terminalId,
      processKind: input.processKind,
      command: input.command,
      cwd: input.cwd,
      profile: input.profile,
      focus: input.focus,
    });
  }

  focusTerminals(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }): { ok: boolean; message: string; focusedTerminalIds: string[] } {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return runtime.focusRuntimeTerminals({
      op: input.op,
      terminalIds: input.terminalIds,
    });
  }

  async deleteTerminal(input: { sessionId: string; terminalId: string }): Promise<{ ok: boolean; message: string }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return await runtime.deleteRuntimeTerminal(input.terminalId);
  }

  async sendMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      runtime.sendMessageChannel({
        chatId: input.chatId,
        accessToken: input.accessToken,
        text: input.text,
        assetIds: input.assetIds,
        clientMessageId: input.clientMessageId,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
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
    clientMessageId?: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      runtime.sendMessageChannelError({
        chatId: input.chatId,
        accessToken: input.accessToken,
        content: input.content,
        error: input.error,
        clientMessageId: input.clientMessageId,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
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
    clientMessageId?: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      runtime.sendMessageChannelInteractive({
        chatId: input.chatId,
        accessToken: input.accessToken,
        content: input.content,
        interactive: input.interactive,
        clientMessageId: input.clientMessageId,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sendChat(
    sessionId: string,
    text: string,
    assetIds: string[] = [],
    clientMessageId?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      const runtime = await this.ensureRuntime(sessionId);
      runtime.pushUserChat(text, assetIds, clientMessageId);
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, reason };
    }
  }

  async uploadSessionAssets(
    sessionId: string,
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>,
  ): Promise<ChatSessionAsset[]> {
    const runtime = await this.ensureRuntime(sessionId);
    return await runtime.uploadAssets(files);
  }

  private resolveGlobalRoomAttachments(chatId: string, assetIds: string[]): ChatSessionAsset[] {
    if (assetIds.length === 0) {
      return [];
    }
    const assets = this.roomAssets.listAssetsByIds(chatId, assetIds);
    if (assets.length !== assetIds.length) {
      throw new Error("room asset not found");
    }
    return assets.map((asset) => toChatRoomAsset(chatId, asset));
  }

  private projectGlobalRoomAsset(chatId: string, asset: RoomAssetRecord): RoomMediaAsset {
    return {
      ...toChatRoomAsset(chatId, asset),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      uploadedByActorId: asset.uploadedByActorId,
    };
  }

  private resolveGlobalRoomUploaderActorId(
    input: {
      chatId: string;
      accessToken?: string;
      actorId?: MessageActorId;
      superadminActorId?: MessageActorId;
    },
    access: { room: MessageControlPlaneEntry; accessToken: string },
  ): MessageActorId | undefined {
    if (input.superadminActorId) {
      return input.superadminActorId;
    }
    if (input.actorId) {
      return input.actorId;
    }
    const targetToken = input.accessToken ?? access.accessToken;
    if (targetToken === access.room.accessToken) {
      return access.room.participantId;
    }
    const grants = this.messageControlPlane.listChannelGrantsAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
    });
    return grants.find((grant) => grant.accessToken === targetToken)?.participantId ?? access.room.participantId;
  }

  private resolveGlobalRoomSenderActorId(
    input: {
      chatId: string;
      accessToken?: string;
      sendAsActorId?: MessageActorId;
      actorId?: MessageActorId;
      superadminActorId?: MessageActorId;
    },
    access: { room: MessageControlPlaneEntry; accessToken: string },
  ): MessageActorId | undefined {
    const targetToken = input.accessToken ?? access.accessToken;

    if (input.sendAsActorId) {
      if (
        input.superadminActorId &&
        input.sendAsActorId === input.superadminActorId &&
        (!input.accessToken || targetToken === access.room.accessToken)
      ) {
        return input.sendAsActorId;
      }
      const requestedProjection = this.messageControlPlane.getChannelForActor(input.chatId, input.sendAsActorId, {
        includeArchived: true,
        touchPresence: false,
      });
      if (!requestedProjection || requestedProjection.accessToken !== targetToken) {
        throw new Error("message room send-as actor invalid");
      }
      return input.sendAsActorId;
    }

    if (input.actorId && !input.superadminActorId) {
      const actorProjection = this.messageControlPlane.getChannelForActor(input.chatId, input.actorId, {
        includeArchived: true,
        touchPresence: false,
      });
      if (!actorProjection || actorProjection.accessToken !== targetToken) {
        throw new Error("message room credential-invalid");
      }
      return input.actorId;
    }

    if (input.superadminActorId && (!input.accessToken || targetToken === access.room.accessToken)) {
      return input.superadminActorId;
    }

    if (targetToken === access.room.accessToken && access.room.participantId) {
      return access.room.participantId;
    }

    const grants = this.messageControlPlane.listChannelGrantsAuthorized({
      chatId: input.chatId,
      accessToken: access.room.accessToken,
    });
    return grants.find((grant) => grant.accessToken === targetToken)?.participantId ?? input.superadminActorId ?? input.actorId;
  }

  async uploadGlobalRoomAssets(input: {
    chatId: string;
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): Promise<RoomMediaAsset[]> {
    const access = this.resolveGlobalRoomAccess(input);
    const uploadedByActorId = this.resolveGlobalRoomUploaderActorId(input, access);
    const items = this.roomAssets
      .uploadAssets(input.chatId, input.files, { uploadedByActorId })
      .map((asset) => this.projectGlobalRoomAsset(input.chatId, asset));
    if (items.length > 0) {
      this.queueMessageRoomInvalidation({ assetRoomIds: [input.chatId] });
    }
    return items;
  }

  listGlobalRoomAssets(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageActorId;
    superadminActorId?: MessageActorId;
  }): RoomMediaAsset[] {
    this.resolveGlobalRoomAccess(input);
    return this.roomAssets.listAssets(input.chatId).map((asset) => this.projectGlobalRoomAsset(input.chatId, asset));
  }

  getSessionAsset(
    sessionId: string,
    assetId: string,
  ): { filePath: string; mimeType: string; name: string; sizeBytes: number } | null {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      const resolved = runtime.getAsset(assetId);
      if (!resolved) {
        return null;
      }
      return {
        filePath: resolved.filePath,
        mimeType: resolved.asset.mimeType,
        name: resolved.asset.name,
        sizeBytes: resolved.asset.sizeBytes,
      };
    }

    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    const dbPath = join(session.sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return null;
    }
    const db = new SessionDb(dbPath);
    try {
      const asset = db.getAssetById(assetId);
      if (!asset) {
        return null;
      }
      return {
        filePath: join(session.sessionRoot, asset.relativePath),
        mimeType: asset.mimeType,
        name: asset.name,
        sizeBytes: asset.sizeBytes,
      };
    } finally {
      db.close();
    }
  }

  getGlobalRoomAsset(
    chatId: string,
    assetId: string,
  ): { filePath: string; mimeType: string; name: string; sizeBytes: number } | null {
    const asset = this.roomAssets.getAssetById(chatId, assetId);
    if (!asset) {
      return null;
    }
    return {
      filePath: this.roomAssets.resolveAbsolutePath(asset.relativePath),
      mimeType: asset.mimeType,
      name: asset.name,
      sizeBytes: asset.sizeBytes,
    };
  }

  async uploadSessionIcon(sessionId: string, file: { bytes: Uint8Array; name: string; mimeType: string }): Promise<{ ok: true; url: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    await this.syncSessionIconSeed(session);
    const result = await this.authService.uploadSessionIcon(sessionId, file);
    return {
      ok: true,
      url: result.iconUrl,
    };
  }

  async listProfiles(): Promise<ProfileProjection[]> {
    return await this.authService.listProfiles();
  }

  async getProfile(reference: string): Promise<ProfileProjection> {
    return await this.authService.getProfile(reference);
  }

  async listAuthActors() {
    return projectAuthActors(await this.authService.listProfiles());
  }

  async updateProfile(input: { reference: string; token: string; patch: ProfileMetadata }): Promise<ProfileProjection> {
    return await this.authService.updateProfile(input.reference, input.patch, input.token);
  }

  async uploadProfileIcon(input: {
    reference: string;
    token: string;
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<{ ok: true; url: string }> {
    const result = await this.authService.uploadProfileIcon(input.reference, input, input.token);
    return {
      ok: true,
      url: result.iconUrl,
    };
  }

  async startProfileEmailChallenge(email: string) {
    return await this.authService.startEmailChallenge(email);
  }

  async verifyProfileEmailChallenge(input: { email: string; code: string; token?: string }) {
    return await this.authService.verifyEmailChallenge(input.email, input.code, input.token);
  }

  async getAuthServiceDescriptor() {
    return await this.authService.describe();
  }

  async revealManagedRootAuthPrivateKey() {
    return await this.authService.revealRootAuthPrivateKey();
  }

  async startAuthChallenge(authId: string) {
    return await this.authService.startAuthChallenge(authId);
  }

  async verifyAuthChallenge(input: { challengeId: string; signature: string; token?: string }) {
    return await this.authService.verifyAuthChallenge(input);
  }

  async authenticateAuthToken(token: string | null | undefined) {
    if (!token) {
      return null;
    }
    return await this.authService.authenticateAuthToken(token);
  }

  async getProfileServiceDescriptor() {
    return await this.getAuthServiceDescriptor();
  }

  listCurrentBranchCycles(sessionId: string, limit = 200) {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.listCurrentBranchCycles(limit);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return this.readCurrentBranchCyclesPageFromDb(session.sessionRoot, { limit }).items;
  }

  pageCurrentBranchCycles(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionCycleRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readCurrentBranchCyclesPageFromDb(session.sessionRoot, input);
  }

  async rollbackSessionCycle(
    sessionId: string,
    cycleId: number,
  ): Promise<{ ok: boolean; cycleId?: number; reason?: string }> {
    const runtime = await this.ensureRuntime(sessionId);
    return runtime.rollbackToCycle(cycleId);
  }

  async retainApiCallSubscription(sessionId: string): Promise<{ enabled: boolean; refCount: number }> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { enabled: false, refCount: 0 };
    }
    return runtime.retainApiCallRecording();
  }

  releaseApiCallSubscription(sessionId: string): { enabled: boolean; refCount: number } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { enabled: false, refCount: 0 };
    }
    return runtime.releaseApiCallRecording();
  }

  listModelCalls(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listModelCalls"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listModelCalls(afterId, limit);
  }

  pageModelCalls(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionModelCallRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readModelCallsPageFromDb(session.sessionRoot, input);
  }

  listModelCallsBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listModelCallsBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listModelCallsBefore(beforeId, limit);
  }

  listApiCalls(sessionId: string, afterId = 0, limit = 200): Array<ReturnType<SessionRuntime["listApiCalls"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listApiCalls(afterId, limit);
  }

  pageApiCalls(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ApiCallRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readApiCallsPageFromDb(session.sessionRoot, input);
  }

  listApiCallsBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listApiCallsBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listApiCallsBefore(beforeId, limit);
  }

  listLoopbusStateLogs(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusStateLogs"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusStateLogs(afterId, limit);
  }

  pageSchedulerLogs(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<LoopbusStateLogRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readLoopbusStateLogsPageFromDb(session.sessionRoot, input);
  }

  listLoopbusStateLogsBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusStateLogsBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusStateLogsBefore(beforeId, limit);
  }

  listLoopbusTraces(
    sessionId: string,
    afterId = 0,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusTraces"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusTraces(afterId, limit);
  }

  pageObservabilityTraces(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ReturnType<SessionRuntime["listLoopbusTraces"]>[number]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readLoopbusTracesPageFromDb(session.sessionRoot, input);
  }

  listObservabilityTracesByRef(
    sessionId: string,
    ref: string,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusTraces"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.listLoopbusTracesByRef(ref, limit);
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    const dbPath = join(session.sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }
    const db = new SessionDb(dbPath);
    try {
      return db.listLoopTracesByRef(ref, limit);
    } finally {
      db.close();
    }
  }

  listLoopbusTracesBefore(
    sessionId: string,
    beforeId: number,
    limit = 200,
  ): Array<ReturnType<SessionRuntime["listLoopbusTracesBefore"]>[number]> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return [];
    }
    return runtime.listLoopbusTracesBefore(beforeId, limit);
  }

  pageTerminalActivity(
    sessionId: string,
    terminalId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<TerminalActivityRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    return this.readTerminalActivityPageFromDb(session.sessionRoot, terminalId, input);
  }

  async inspectAttentionState(sessionId: string): Promise<ReturnType<SessionRuntime["inspectAttentionState"]>> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.inspectAttentionState();
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    return await this.readPersistedAttentionState(session);
  }

  async queryAttention(
    sessionId: string,
    input: AttentionSearchRequest,
  ): Promise<AttentionCommitMatch[]> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return await runtime.queryAttention(input);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    const attention = await this.readPersistedAttentionState(session);
    const attentionSystem = AttentionSystem.fromSnapshot(attention.snapshot);
    const engine = new AttentionSearchEngine(join(session.sessionRoot, "attention-search.duckdb"));
    return await engine.query({
      attentionSystem,
      snapshot: attention.snapshot,
      request: input,
    });
  }

  async inspectModelDebug(sessionId: string): Promise<ReturnType<SessionRuntime["inspectModelDebug"]>> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.inspectModelDebug();
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    return await this.readPersistedModelDebug(session);
  }

  listTasks(sessionId: string): { ok: boolean; tasks: ReturnType<SessionRuntime["snapshot"]>["tasks"] } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false, tasks: [] };
    }
    return { ok: true, tasks: runtime.snapshot().tasks };
  }

  triggerTaskManual(sessionId: string, input: { source: string; id: string }): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.triggerTaskManual(input);
  }

  emitTaskEvent(
    sessionId: string,
    input: { topic: string; payload?: unknown; source?: "api" | "file" | "tool" },
  ): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.emitTaskEvent(input);
  }

  async readSettings(input: {
    sessionId: string;
    kind: unknown;
  }): Promise<{ path: string; content: string; mtimeMs: number }> {
    const runtime = await this.ensureRuntime(input.sessionId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.readEditable(kind);
  }

  async listSettingsLayers(workspacePath: string) {
    return await listWorkspaceSettingsLayers({ workspacePath });
  }

  async listSettingsScope(input: {
    scope: SettingsScope;
    workspacePath?: string;
    avatar?: string;
  }) {
    return await listScopedSettingsGraph(input);
  }

  async readGlobalSettings() {
    return await readGlobalSettingsFile();
  }

  async saveGlobalSettings(input: { content: string; baseMtimeMs: number }) {
    return await saveGlobalSettingsFile(input);
  }

  async readSettingsLayer(input: {
    workspacePath: string;
    layerId: string;
  }) {
    return await readWorkspaceSettingsLayer(input);
  }

  async readSettingsScopeLayer(input: {
    scope: SettingsScope;
    workspacePath?: string;
    layerId: string;
    avatar?: string;
  }) {
    return await readScopedSettingsLayer(input);
  }

  async saveSettingsLayer(input: {
    workspacePath: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }) {
    return await saveWorkspaceSettingsLayer(input);
  }

  async saveSettingsScopeLayer(input: {
    scope: SettingsScope;
    workspacePath?: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
    avatar?: string;
  }) {
    return await saveScopedSettingsLayer(input);
  }

  getNotificationSnapshot(): SessionNotificationSnapshot {
    return this.notifications.snapshot();
  }

  setChatVisibility(input: { sessionId: string; chatId?: string; visible: boolean; focused: boolean }): SessionNotificationSnapshot {
    const snapshot = this.notifications.setChatVisibility(input) ?? this.notifications.snapshot();
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  setTerminalVisibility(input: {
    sessionId: string;
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }): SessionNotificationSnapshot {
    const snapshot = this.notifications.setTerminalVisibility(input) ?? this.notifications.snapshot();
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  consumeNotifications(input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToMessageId?: string | null;
  }): SessionNotificationSnapshot {
    const snapshot = this.notifications.consume(input) ?? this.notifications.snapshot();
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  async saveSettings(input: {
    sessionId: string;
    kind: unknown;
    content: string;
    baseMtimeMs: number;
  }): Promise<
    | { ok: true; file: { path: string; content: string; mtimeMs: number } }
    | { ok: false; reason: "conflict"; latest: { path: string; content: string; mtimeMs: number } }
  > {
    const runtime = await this.ensureRuntime(input.sessionId);
    const kind = settingsKindSchema.parse(input.kind);
    return runtime.saveEditable(kind, input.content, input.baseMtimeMs);
  }

  private async ensureRuntime(sessionId: string): Promise<SessionRuntime> {
    if (this.runtimes.has(sessionId)) {
      return this.runtimes.get(sessionId)!;
    }
    await this.startSession(sessionId);
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      throw new Error(`runtime not found for session ${sessionId}`);
    }
    return runtime;
  }

  private readSessionPreview(session: SessionMeta): WorkspaceSessionPreview {
    try {
      const messages = this.readChatMessagesFromDb(session.sessionRoot, session.id, 0, 1_000);
      if (messages.length === 0) {
        return {
          firstUserMessage: null,
          latestMessages: [],
        };
      }

      const firstUser = messages.find((item) => item.role === "user");
      const latestMessages = messages
        .filter(
          (item) =>
            (item.role === "user" || item.channel === "to_user") && !isInternalFailurePreviewText(item.content),
        )
        .slice(-3)
        .map((item) => item.content.trim())
        .filter((item) => item.length > 0);

      return {
        firstUserMessage: firstUser?.content.trim() || null,
        latestMessages,
      };
    } catch {
      return {
        firstUserMessage: null,
        latestMessages: [],
      };
    }
  }

  private readChatMessagesFromDb(
    sessionRoot: string,
    sessionId: string,
    afterId: number,
    limit: number,
  ): PersistedChatMessage[] {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }

    const db = new SessionDb(dbPath);
    try {
      const defaultRoomId = this.resolvePersistedSessionPrimaryRoomId(sessionId);
      const cycleChatIds = new Map<number, string>();
      const resolveBlockChatId = (item: SessionBlockRecord): string => {
        const explicitChatId = readPersistedBlockChatId(item);
        if (explicitChatId) {
          return explicitChatId;
        }
        if (item.cycleId === null) {
          return defaultRoomId;
        }
        const cached = cycleChatIds.get(item.cycleId);
        if (cached) {
          return cached;
        }
        const chatId = resolveSessionBlockChatId({
          block: item,
          getCycleById: (cycleId) => db.getCycleById(cycleId),
          fallback: defaultRoomId,
        });
        cycleChatIds.set(item.cycleId, chatId);
        return chatId;
      };
      return db.listBlocksAfter(afterId, limit).map((item) => {
        const projected = this.projectPersistedChatMessage(sessionId, item, resolveBlockChatId(item));
        return {
          ...projected,
          sessionId,
          messageId: item.messageId ?? `${item.id}`,
        };
      });
    } finally {
      db.close();
    }
  }

  private readChatMessagesPageFromDb(
    sessionRoot: string,
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<PersistedChatMessage> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }

    const db = new SessionDb(dbPath);
    try {
      const defaultRoomId = this.resolvePersistedSessionPrimaryRoomId(sessionId);
      const page = db.listBlocksPage(input);
      const cycleChatIds = new Map<number, string>();
      const resolveBlockChatId = (item: SessionBlockRecord): string => {
        const explicitChatId = readPersistedBlockChatId(item);
        if (explicitChatId) {
          return explicitChatId;
        }
        if (item.cycleId === null) {
          return defaultRoomId;
        }
        const cached = cycleChatIds.get(item.cycleId);
        if (cached) {
          return cached;
        }
        const chatId = resolveSessionBlockChatId({
          block: item,
          getCycleById: (cycleId) => db.getCycleById(cycleId),
          fallback: defaultRoomId,
        });
        cycleChatIds.set(item.cycleId, chatId);
        return chatId;
      };
      return {
        items: page.items.map((item) => {
          const projected = this.projectPersistedChatMessage(sessionId, item, resolveBlockChatId(item));
          return {
            ...projected,
            sessionId,
            messageId: item.messageId ?? `${item.id}`,
          };
        }),
        nextBefore: page.nextBefore,
        hasMoreBefore: page.hasMoreBefore,
      };
    } finally {
      db.close();
    }
  }

  private readCurrentBranchCyclesPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionCycleRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      return db.listCurrentBranchCyclesPage(input);
    } finally {
      db.close();
    }
  }

  private async readPersistedAttentionState(
    session: SessionMeta,
  ): Promise<ReturnType<SessionRuntime["inspectAttentionState"]>> {
    const attentionStore = new AttentionStore(join(session.sessionRoot, "attention-system"));
    const snapshot = await attentionStore.load();
    const attentionSystem = AttentionSystem.fromSnapshot(snapshot);
    const cycleFrames: AttentionCycleFrame[] = [];
    const hooks: AttentionHookRecord[] = [];
    const dbPath = join(session.sessionRoot, "session.db");

    if (existsSync(dbPath)) {
      const db = new SessionDb(dbPath);
      try {
        for (const cycle of db.listCurrentBranchCycles(200)) {
          const frame = cycle.extendsRecord.attentionCycleFrame;
          if (frame && typeof frame === "object") {
            cycleFrames.push(frame as AttentionCycleFrame);
          }
          const records = cycle.extendsRecord.attentionHooks;
          if (!Array.isArray(records)) {
            continue;
          }
          for (const record of records) {
            if (record && typeof record === "object") {
              hooks.push(record as AttentionHookRecord);
            }
          }
        }
      } finally {
        db.close();
      }
    }

    return {
      snapshot,
      active: attentionSystem.listActiveContexts(),
      cycleFrames,
      hooks,
    };
  }

  private projectPersistedChatMessage(
    sessionId: string,
    block: SessionBlockRecord,
    chatId: string,
  ): ChatMessage {
    return projectPersistedBlockToChatMessage({
      sessionId,
      block,
      fallbackRoomId: chatId,
      lookupRoomMessage: (roomId, messageId) => this.messageControlPlane.getMessage(roomId, messageId),
    });
  }

  private async readPersistedModelDebug(session: SessionMeta): Promise<ReturnType<SessionRuntime["inspectModelDebug"]>> {
    const resolved = await resolveSessionConfig(session.cwd, { avatar: session.avatar });
    const dbPath = join(session.sessionRoot, "session.db");

    if (!existsSync(dbPath)) {
      return {
        config: {
          providerId: resolved.ai.providerId,
          apiStandard: resolved.ai.apiStandard,
          vendor: resolved.ai.vendor,
          profile: resolved.ai.profile,
          extensions: resolved.ai.extensions,
          model: resolved.ai.model,
          baseUrl: resolved.ai.baseUrl,
          apiKey: resolved.ai.apiKey,
          apiKeyEnv: resolved.ai.apiKeyEnv,
          headers: resolved.ai.headers,
          temperature: resolved.ai.temperature,
          maxRetries: resolved.ai.maxRetries,
          maxToken: resolved.ai.maxToken,
          compactThreshold: resolved.ai.compactThreshold,
          capabilities: resolveModelCapabilities(resolved.ai),
        },
        promptWindow: [],
        stats: null,
        latestModelCall: null,
        recentModelCalls: [],
        recentApiCalls: [],
      };
    }

    const db = new SessionDb(dbPath);
    try {
      return {
        config: {
          providerId: resolved.ai.providerId,
          apiStandard: resolved.ai.apiStandard,
          vendor: resolved.ai.vendor,
          profile: resolved.ai.profile,
          extensions: resolved.ai.extensions,
          model: resolved.ai.model,
          baseUrl: resolved.ai.baseUrl,
          apiKey: resolved.ai.apiKey,
          apiKeyEnv: resolved.ai.apiKeyEnv,
          headers: resolved.ai.headers,
          temperature: resolved.ai.temperature,
          maxRetries: resolved.ai.maxRetries,
          maxToken: resolved.ai.maxToken,
          compactThreshold: resolved.ai.compactThreshold,
          capabilities: resolveModelCapabilities(resolved.ai),
        },
        promptWindow: [],
        stats: null,
        latestModelCall: db.listModelCalls(1)[0] ?? null,
        recentModelCalls: db.listModelCalls(8),
        recentApiCalls: db.listApiCallsAfter(0, 12),
      };
    } finally {
      db.close();
    }
  }

  private readChatMessagesBeforeFromDb(
    sessionRoot: string,
    sessionId: string,
    beforeId: number,
    limit: number,
  ): PersistedChatMessage[] {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }

    const db = new SessionDb(dbPath);
    try {
      const defaultRoomId = this.resolvePersistedSessionPrimaryRoomId(sessionId);
      const cycleChatIds = new Map<number, string>();
      const resolveBlockChatId = (item: SessionBlockRecord): string => {
        const explicitChatId = readPersistedBlockChatId(item);
        if (explicitChatId) {
          return explicitChatId;
        }
        if (item.cycleId === null) {
          return defaultRoomId;
        }
        const cached = cycleChatIds.get(item.cycleId);
        if (cached) {
          return cached;
        }
        const chatId = resolveSessionBlockChatId({
          block: item,
          getCycleById: (cycleId) => db.getCycleById(cycleId),
          fallback: defaultRoomId,
        });
        cycleChatIds.set(item.cycleId, chatId);
        return chatId;
      };
      return db.listBlocksBefore(beforeId, limit).map((item) => {
        const projected = this.projectPersistedChatMessage(sessionId, item, resolveBlockChatId(item));
        return {
          ...projected,
          sessionId,
          messageId: item.messageId ?? `${item.id}`,
        };
      });
    } finally {
      db.close();
    }
  }

  private readChatCyclesFromDb(sessionRoot: string, sessionId: string, limit: number): ChatCycle[] {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }
    const db = new SessionDb(dbPath);
    try {
      const cycles = db.listCurrentBranchCycles(limit);
      const cycleInputs = mergeLegacyCycleInputs(sessionId, cycles, db.listOrphanUserInputBlocks(limit * 4));
      return cycleInputs.map(({ cycle, inputs }) =>
        toChatCycle({
          sessionId,
          cycle,
          inputs,
          outputs: this.projectPersistedCycleOutputs(db, sessionId, cycle.id, inputs),
          modelCallId: db.getModelCallByCycleId(cycle.id)?.id ?? null,
        }),
      );
    } finally {
      db.close();
    }
  }

  private readChatCyclesPageFromDb(
    sessionRoot: string,
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ChatCycle> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      const page = db.listCurrentBranchCyclesPage(input);
      const cycleInputs = mergeLegacyCycleInputs(sessionId, page.items, db.listOrphanUserInputBlocks((input?.limit ?? 120) * 4));
      return {
        items: cycleInputs.map(({ cycle, inputs }) =>
          toChatCycle({
            sessionId,
            cycle,
            inputs,
            outputs: this.projectPersistedCycleOutputs(db, sessionId, cycle.id, inputs),
            modelCallId: db.getModelCallByCycleId(cycle.id)?.id ?? null,
          }),
        ),
        nextBefore: page.nextBefore,
        hasMoreBefore: page.hasMoreBefore,
      };
    } finally {
      db.close();
    }
  }

  private readChatCyclesBeforeFromDb(
    sessionRoot: string,
    sessionId: string,
    beforeCycleId: number,
    limit: number,
  ): ChatCycle[] {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return [];
    }
    const db = new SessionDb(dbPath);
    try {
      const cycles = db.listCurrentBranchCyclesBefore(beforeCycleId, limit);
      const cycleInputs = mergeLegacyCycleInputs(sessionId, cycles, db.listOrphanUserInputBlocks(limit * 4));
      return cycleInputs.map(({ cycle, inputs }) =>
        toChatCycle({
          sessionId,
          cycle,
          inputs,
          outputs: this.projectPersistedCycleOutputs(db, sessionId, cycle.id, inputs),
          modelCallId: db.getModelCallByCycleId(cycle.id)?.id ?? null,
        }),
      );
    } finally {
      db.close();
    }
  }

  private projectPersistedCycleOutputs(
    db: SessionDb,
    sessionId: string,
    cycleId: number,
    inputs: SessionCollectedInput[],
  ): ChatMessage[] {
    const fallbackRoomId = resolveCollectedInputsChatId(inputs, this.resolvePersistedSessionPrimaryRoomId(sessionId));
    return db.listBlocksByCycleId(cycleId).map((block) =>
      this.projectPersistedChatMessage(sessionId, block, readPersistedBlockChatId(block) ?? fallbackRoomId),
    );
  }

  private readLoopbusStateLogsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<LoopbusStateLogRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      return db.listLoopStateLogsPage(input);
    } finally {
      db.close();
    }
  }

  private readLoopbusTracesPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ReturnType<SessionRuntime["listLoopbusTraces"]>[number]> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      return db.listLoopTracesPage(input);
    } finally {
      db.close();
    }
  }

  private readModelCallsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionModelCallRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      return db.listModelCallsPage(input);
    } finally {
      db.close();
    }
  }

  private readApiCallsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ApiCallRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      return db.listApiCallsPage(input);
    } finally {
      db.close();
    }
  }

  private readTerminalActivityPageFromDb(
    sessionRoot: string,
    terminalId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<TerminalActivityRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return { items: [], nextBefore: null, hasMoreBefore: false };
    }
    const db = new SessionDb(dbPath);
    try {
      const page = db.listTerminalActivityPage(terminalId, input);
      return {
        ...page,
        items: page.items.map((item) => this.hydrateTerminalActivityRecord(item)),
      };
    } finally {
      db.close();
    }
  }

  private hydrateTerminalActivityRecord(item: TerminalActivityRecord): TerminalActivityRecord {
    if (!isTerminalEventRefDetail(item.detail)) {
      return item;
    }
    const event = this.terminalControlPlane.getEvent(item.detail.eventId);
    if (!event || event.terminalId !== item.terminalId) {
      return item;
    }
    return {
      ...item,
      title: event.payload.title,
      content: event.payload.content,
      detail: event.payload.detail,
    };
  }

  private detachRuntime(sessionId: string): void {
    this.runtimes.delete(sessionId);
    for (const key of [...this.terminalStatusByKey.keys()]) {
      if (key.startsWith(`${sessionId}:`)) {
        this.terminalStatusByKey.delete(key);
      }
    }
    const unsubscribe = this.runtimeStopListeners.get(sessionId);
    if (unsubscribe) {
      unsubscribe();
      this.runtimeStopListeners.delete(sessionId);
    }
  }

  private forwardRuntimeEvent(sessionId: string, event: RuntimeEvent): void {
    switch (event.type) {
      case "chat":
        this.emit("chat.message", { message: event.payload as ChatMessage }, sessionId, event.timestamp);
        this.emitNotificationForMessage(sessionId, event.payload as ChatMessage);
        return;
      case "phase":
        this.emit("runtime.phase", { phase: event.payload.phase }, sessionId, event.timestamp);
        return;
      case "stage":
        this.emit("runtime.stage", { stage: event.payload.stage }, sessionId, event.timestamp);
        return;
      case "stats":
        this.emit("runtime.stats", event.payload, sessionId, event.timestamp);
        return;
      case "focusedTerminal":
        this.emit(
          "runtime.focusedTerminal",
          { terminalIds: event.payload.terminalIds, terminalId: event.payload.terminalId },
          sessionId,
          event.timestamp,
        );
        return;
      case "terminalRead":
        this.emit("terminal.read", event.payload, sessionId, event.timestamp);
        return;
      case "terminalSnapshot":
        this.emit("terminal.snapshot", event.payload, sessionId, event.timestamp);
        return;
      case "terminalStatus":
        this.emit("terminal.status", event.payload, sessionId, event.timestamp);
        this.emitNotificationForTerminalStatus(
          sessionId,
          event.payload as {
            terminalId: string;
            running: boolean;
            status: "IDLE" | "BUSY";
          },
          event.timestamp,
        );
        return;
      case "taskUpdated":
        this.emit("task.updated", event.payload, sessionId, event.timestamp);
        return;
      case "taskDeleted":
        this.emit("task.deleted", event.payload, sessionId, event.timestamp);
        return;
      case "taskTriggered":
        this.emit("task.triggered", event.payload, sessionId, event.timestamp);
        return;
      case "taskSourceChanged":
        this.emit("task.source.changed", event.payload, sessionId, event.timestamp);
        return;
      case "schedulerSnapshot":
        this.emit("runtime.scheduler.snapshot", event.payload, sessionId, event.timestamp);
        return;
      case "schedulerLog":
        this.emit("runtime.scheduler.log", event.payload, sessionId, event.timestamp);
        return;
      case "observabilityTrace":
        this.emit("runtime.observability.trace", event.payload, sessionId, event.timestamp);
        return;
      case "schedulerSignal":
        this.emit("runtime.scheduler.signal", event.payload, sessionId, event.timestamp);
        return;
      case "modelCall":
        this.emit("runtime.modelCall", event.payload, sessionId, event.timestamp);
        return;
      case "modelCallDelta":
        this.emit("runtime.modelCall.delta", event.payload, sessionId, event.timestamp);
        return;
      case "apiCall":
        this.emit("runtime.apiCall", event.payload, sessionId, event.timestamp);
        return;
      case "apiRecording":
        this.emit("runtime.apiRecording", event.payload, sessionId, event.timestamp);
        return;
      case "attentionUpdated":
        this.emit("runtime.attention", event.payload, sessionId, event.timestamp);
        return;
      case "cycleUpdated":
        this.emit("runtime.cycle.updated", event.payload, sessionId, event.timestamp);
        return;
      case "error":
        this.emit("runtime.error", event.payload, sessionId, event.timestamp);
        return;
    }
  }

  private emitNotificationSnapshot(snapshot: SessionNotificationSnapshot | null, sessionId?: string): void {
    if (!snapshot) {
      return;
    }
    this.emit("notification.updated", { snapshot }, sessionId);
  }

  private emitNotificationForMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    const snapshot = this.notifications.noteAssistantReply({
      sessionId,
      workspacePath: session.workspacePath,
      sessionName: session.name,
      message,
    });
    this.emitNotificationSnapshot(snapshot, sessionId);
  }

  private emitNotificationForTerminalStatus(
    sessionId: string,
    payload: {
      terminalId: string;
      running: boolean;
      status: "IDLE" | "BUSY";
    },
    timestamp: number,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    const statusKey = `${sessionId}:${payload.terminalId}`;
    const previous = this.terminalStatusByKey.get(statusKey);
    this.terminalStatusByKey.set(statusKey, {
      running: payload.running,
      status: payload.status,
    });
    if (!previous || previous.status !== "BUSY" || payload.status !== "IDLE" || !payload.running) {
      return;
    }
    const snapshot = this.notifications.noteTerminalNotification({
      sessionId,
      workspacePath: session.workspacePath,
      sessionName: session.name,
      terminalId: payload.terminalId,
      notificationId: `idle:${timestamp}`,
      content: `Terminal ${payload.terminalId} is ready for your input.`,
      timestamp,
    });
    this.emitNotificationSnapshot(snapshot, sessionId);
  }

  private emit<TType extends RuntimeEventType>(
    type: TType,
    payload: unknown,
    sessionId?: string,
    timestamp = now(),
  ): RuntimeEventEnvelope<TType, unknown> {
    const event: RuntimeEventEnvelope<TType, unknown> = {
      version: 1,
      eventId: ++this.eventSeq,
      timestamp,
      type,
      sessionId,
      payload,
    };
    this.eventLog.push(event);
    if (this.eventLog.length > 2048) {
      this.eventLog.splice(0, this.eventLog.length - 2048);
    }
    for (const listener of this.listeners) {
      listener(event);
    }
    return event;
  }
}
