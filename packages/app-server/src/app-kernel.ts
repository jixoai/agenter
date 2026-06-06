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
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

import type {
  AppAttentionCommitInput,
  AppAttentionSettleInput,
  AppAvatarPromptSeedInput,
  AppPrivateTextAssetEnsureInput,
} from "@agenter/app-runtime";
import {
  AttentionStore,
  AttentionSystem,
  type AttentionCommitMatch,
  type AttentionCycleFrame,
  type AttentionHookRecord,
} from "@agenter/attention-system";
import {
  buildAvatarIconUrl,
  canonicalizeAvatarPrincipalMetadata,
  formatAvatarDisplayName,
  normalizeAvatarPrincipalMetadata,
  readAvatarPrincipalMetadata,
  resolveAvatarOwnerKey,
  resolveBuiltInAvatarProfile,
  type AuthSessionProjection,
  type AvatarClassify,
  type AvatarPrincipalMetadata,
  type PrincipalProjection,
  type ProfileMetadata,
  type ProfileProjection,
} from "@agenter/auth-service";
import { defaultAvatarNickname, normalizeAvatarNickname, resolveGlobalAvatarCanonicalRoot } from "@agenter/avatar";
import { LoopBusKernel } from "@agenter/loopbus-kernel";
import {
  MessageControlPlane,
  resolveMessageControlDbPath,
  type MessageChannelAccessProjection,
  type MessageChannelAccessRole,
  type MessageChannelGrantRecord,
  type MessageChannelKind,
  type MessageChannelPatchInput,
  type MessageContactId,
  type MessageContactRecord,
  type MessageContactRequestRecord,
  type MessageControlPlaneEntry,
  type MessageFocusOp,
  type MessageInvitationRecord,
  type MessageIssuedGrant,
  type MessageIssueGrantInput,
  type MessageManagedSeatClass,
  type MessageQueryRequest,
  type MessageQueryResult,
  type MessageRecord,
  type MessageSeatStateProjection,
  type MessageSnapshot,
  type MessageSourceSubscriptionInput,
  type MessageSourceSubscriptionRecord,
  type MessageTranscriptPage,
} from "@agenter/message-system";
import {
  listNoteCatalog,
  listNoteTagCatalog,
  queryNoteCatalogSql,
  readNotePage,
  renameNoteCatalogPages,
  searchNoteCatalog,
  writeNoteCatalogPage,
  type NoteAvatarContext,
  type NoteCatalogOutput,
  type NotePageOutput,
  type NoteReferenceInput,
  type NoteRenameOutput,
  type NoteSearchOutput,
  type NoteSqlQueryOutput,
  type NoteTagQueryOutput,
} from "@agenter/note-system";
import { isPrincipalId, normalizePrincipalId } from "@agenter/principal-crypto";
import {
  SessionDb,
  type HeartbeatRecordDetail,
  type HeartbeatRecordPage,
  type HeartbeatRecordPageInput,
  type ReversePage,
  type ReverseTimeCursor,
  type SessionAiCallRecord,
  type SessionMessageRecord,
} from "@agenter/session-system";
import {
  TerminalControlPlane,
  type TerminalAccessProjection,
  type TerminalActorId,
  type TerminalApprovalRequestEvent,
  type TerminalApprovalRequestRecord,
  type TerminalBackendKind,
  type TerminalComposedProductSurfaceState,
  type TerminalControlPlaneEntry,
  type TerminalGrantRecord,
  type TerminalGrantRole,
  type TerminalGrantWriteLeaseInput,
  type TerminalInvitationRecord,
  type TerminalIssueGrantInput,
  type TerminalManagedSeatClass,
  type TerminalProcessProfile,
  type TerminalReadMode,
  type TerminalReadResult,
  type TerminalRevokeWriteLeaseInput,
  type TerminalSeatProjection,
  type TerminalWriteLeaseRecord,
  type TerminalWriteResult,
} from "@agenter/terminal-system";
import { privateKeyToAccount } from "viem/accounts";
import {
  AttentionSearchEngine,
  ATTENTION_SEARCH_LEGACY_DUCKDB_FILENAME,
  ATTENTION_SEARCH_SQLITE_FILENAME,
  type AttentionSearchRequest,
} from "./attention-search";
import { appAttentionSourceRegistry } from "./attention-src";
import { projectAuthActors } from "./auth-actor-catalog";
import { AuthDraftStore, resolveAuthDraftDbPath } from "./auth-draft-store";
import type {
  AuthDraftCreateResult,
  AuthDraftDeleteResult,
  AuthDraftEntry,
  AuthDraftEvent,
  AuthDraftFilter,
  AuthDraftKind,
  AuthDraftSaveResult,
  AuthDraftSnapshot,
  AuthDraftState,
  AuthDraftWriteInput,
} from "./auth-draft-types";
import { AuthKvStore, resolveAuthKvDbPath } from "./auth-kv-store";
import type {
  AuthKvDeleteResult,
  AuthKvEvent,
  AuthKvFilter,
  AuthKvSetResult,
  AuthKvSnapshot,
  JsonValue,
} from "./auth-kv-types";
import { AuthServiceBridge, type AuthServiceBridgeOptions } from "./auth-service-bridge";
import {
  buildWorkspaceAvatarCatalogEntry,
  copyAvatarIntoWorkspace,
  forkAvatarIntoWorkspace,
  listGlobalAvatarNicknamesFromStorage,
  listWorkspaceAvatarNicknamesFromStorage,
  resolveWorkspaceAvatarRoot,
  type WorkspaceAvatarCatalogEntry,
} from "./avatar-catalog";
import {
  ensureAvatarNicknameAlias,
  ensureAvatarSeatPrincipal,
  readAvatarSeatDocument,
  saveAvatarMessageSeatCredential,
  saveAvatarTerminalSeatCredential,
  type AvatarPrincipalRecord,
  type AvatarSeatState,
} from "./avatar-seat-store";
import { type ChatCycle } from "./chat-cycles";
import { buildWorkspaceCliCommandCatalog, type CliCommandExecutionSurface } from "./cli-command-catalog";
import { readGlobalSettingsFile, saveGlobalSettingsFile } from "./global-settings";
import type { RuntimeHeartbeatGroupRecord } from "./heartbeat-groups";
import { pageHeartbeatGroupsFromDb } from "./heartbeat-groups-page";
import { HEARTBEAT_INSPECTION_SCOPES, HEARTBEAT_MESSAGE_PART_SCOPE } from "./heartbeat-message-parts";
import { materializeBuiltinPromptDocs } from "./i18n";
import { readLocalEnvValue, resolveLocalEnvPath, writeLocalEnvValue } from "./local-env";
import type {
  McpAddInput,
  McpCallInput,
  McpDisableInput,
  McpListInput,
  McpProjectInput,
  McpQueryInput,
  McpRemoveInput,
} from "./mcp-system/types";
import { resolveModelCapabilities } from "./model-capabilities";
import {
  settingsKindSchema,
  type AnyRuntimeEvent,
  type RuntimeEventEnvelope,
  type RuntimeEventType,
  type RuntimeSnapshotPayload,
} from "./realtime-types";
import { createRemoteMessageSourceClient, type RemoteMessageSourceCatalogItem } from "./remote-message-source-client";
import { RoomAssetStore, toChatRoomAsset, type RoomAssetRecord } from "./room-assets";
import type {
  RuntimeCycleRecord,
  RuntimeLoopStateLogRecord,
  RuntimeTerminalActivityRecord,
} from "./runtime-history-records";
import { projectRuntimeTerminalConfigMutation, type RuntimeMessageSendResult } from "./runtime-tool-views";
import { SessionCatalog, type SessionMeta } from "./session-catalog";
import { resolveSessionRoomActorId } from "./session-chat-projection";
import { resolveSessionConfig } from "./session-config";
import { resolveAvatarSessionId } from "./session-identity";
import {
  isPersistedChatProjectionMessage,
  projectAiCallToChatCycle,
  projectAiCallToModelCall,
  projectHeartbeatMessageToChatMessage,
  type RuntimeModelCallRecord,
} from "./session-ledger-view";
import {
  mergeSessionNotificationSnapshots,
  projectSessionNotificationSnapshot,
  toAttentionFocusStateFromVisibility,
  type SessionNotificationSnapshot,
} from "./session-notifications";
import { SessionRuntime, type RuntimeEvent } from "./session-runtime";
import { SettingsEditor } from "./settings-editor";
import {
  listScopedSettingsGraph,
  readScopedSettingsLayer,
  saveScopedSettingsLayer,
  type SettingsScope,
} from "./settings-scope";
import {
  listSkillBrowserAvatarCatalog,
  listSkillBrowserAvatarTree,
  listSkillBrowserCatalog,
  listSkillBrowserCatalogTree,
  readSkillBrowserAvatarPreview,
  readSkillBrowserCatalogPreview,
  type SkillBrowserCatalogRootKind,
} from "./skill-browser";
import type { ChatMessage, ChatSessionAsset, ModelCapabilities, RoomMediaAsset } from "./types";
import { createEmptyUsageAnalyticsResult, UsageAnalyticsDb } from "./usage-analytics-db";
import { resolveUsageAnalyticsDbPathFromAvatarRoot } from "./usage-analytics-paths";
import type { UsageAnalyticsQuery, UsageAnalyticsQueryResult } from "./usage-analytics-types";
import { WorkspacePathSearchIndex } from "./workspace-path-search";
import {
  listWorkspaceSettingsLayers,
  readWorkspaceSettingsLayer,
  saveWorkspaceSettingsLayer,
} from "./workspace-settings";
import {
  AVATAR_HOME_ENV,
  deriveEnvSkillsHome,
  executeWorkspaceBash,
  hasWorkspaceGrantRootAccess,
  resolveWorkspaceAvatarAssetRoot,
  resolveWorkspaceGrantModeFromAbsolutePath,
  resolveWorkspacePublicAssetRoot,
  serializeEnvAvatarHome,
  WorkspaceSystemStore,
  type WorkspaceAssetRoots,
  type WorkspaceBashExecResult,
  type WorkspaceGrantInput,
  type WorkspaceGrantRecord,
  type WorkspaceMountRecord,
} from "./workspace-system";
import {
  GLOBAL_WORKSPACE_PATH,
  isGlobalWorkspacePath,
  resolveWorkspaceFsPath,
  toWorkspaceCwd,
  toWorkspacePath,
} from "./workspace-target";
import {
  createWorkspacePrivateAsset,
  ensureWorkspacePrivateTextAsset,
  listWorkspaceWorkbenchTree,
  readWorkspaceWorkbenchPreview,
  type WorkspaceWorkbenchMode,
} from "./workspace-workbench";
import { WorkspacesStore, type WorkspaceEntry } from "./workspaces-store";

const now = (): number => Date.now();
// File truth: the visible default avatar prompt is always the canonical
// AGENTER.mdx file under ~/.agenter/avatars/by-principal/<principal>/.
// Startup only rewrites that file to this builtin wrapper; it does not keep a
// separate in-memory default prompt authority.
const DEFAULT_AVATAR_PROMPT_WRAPPER = '<Slot src="global:builtin/$LANG/AGENTER.mdx" />\n';
const clonePromptWindowMessages = (
  messages: unknown[] | null | undefined,
): ReturnType<SessionRuntime["inspectModelDebug"]>["promptWindow"] =>
  structuredClone((messages ?? []) as ReturnType<SessionRuntime["inspectModelDebug"]>["promptWindow"]);

const DEFAULT_MESSAGE_CHAT_TITLE = "Room";
const AVATAR_CATALOG_INVALIDATION_DEBOUNCE_MS = 120;
const MESSAGE_ROOM_INVALIDATION_DEBOUNCE_MS = 80;
const TERMINAL_SURFACE_INVALIDATION_DEBOUNCE_MS = 80;
const INTERNAL_FAILURE_PREFIXES = ["agenter-ai call failed:", "agenter-ai 调用失败:", "agenter-ai 调用失败："];
const AUTO_LOGIN_PRIVATE_KEY_ENV_NAME = "AGENTER_ROOT_AUTH_PRIVATE_KEY";

const hashNumericLabel = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 100;
  }
  return String(hash).padStart(2, "0");
};

const buildSessionIconLabel = (sessionId: string): string =>
  sessionId.replaceAll(/[^0-9]/g, "").slice(-2) || hashNumericLabel(sessionId);

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

const toHexPrivateKey = (value: string): `0x${string}` => {
  const normalized = value.trim();
  if (!/^0x[0-9a-fA-F]+$/u.test(normalized)) {
    throw new Error("root auth private key must be a 0x-prefixed hex string");
  }
  return normalized as `0x${string}`;
};

const isBuiltInMessageRoomMetadata = (metadata: Record<string, unknown> | undefined): boolean =>
  metadata?.builtIn === true;

const isStandaloneMessageRoomEntry = (channel: { metadata?: Record<string, unknown> } | undefined): boolean =>
  !isBuiltInMessageRoomMetadata(channel?.metadata);

type MessageRoomChangeRecord = {
  chatId: string;
  roomRevision: string;
  transcriptRevision: string;
  refreshCatalog?: boolean;
  refreshSnapshot?: boolean;
  refreshGrants?: boolean;
  refreshAssets?: boolean;
};

const sanitizeGlobalRoomMetadata = (metadata?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!metadata) {
    return undefined;
  }
  const nextMetadata = { ...metadata };
  delete nextMetadata.builtIn;
  delete nextMetadata.primaryRoom;
  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
};

const normalizeRemoteEndpoint = (value: string): string => value.trim().replace(/\/+$/u, "");
const readRoomMode = (metadata: Record<string, unknown> | undefined): "direct" | "public" =>
  metadata?.roomMode === "direct" ? "direct" : "public";

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

const TERMINAL_ACTIVITY_PREVIEW_MAX_CHARS = 4_000;

const isTerminalReadResultLike = (value: unknown): value is TerminalReadResult => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Partial<TerminalReadResult>;
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

const summarizeTerminalReadActivity = (
  eventId: number,
  terminalId: string,
  payload: TerminalReadResult,
): Pick<RuntimeTerminalActivityRecord, "content" | "detail"> => {
  if (payload.representation === "diff") {
    const diffPreview = trimTerminalActivityPreview(payload.diff);
    const summaryLabel =
      diffPreview.preview ||
      [payload.title ?? "Terminal read", payload.bytes ? `${payload.bytes} bytes` : null].filter(Boolean).join(" · ");
    return {
      content: summaryLabel,
      detail: {
        source: "terminal-read-activity",
        eventId,
        terminalId,
        representation: payload.representation,
        status: payload.status,
        title: payload.title,
        running: payload.running ?? false,
        fromHash: payload.fromHash ?? null,
        toHash: payload.toHash ?? null,
        readCursor: payload.readCursor ?? null,
        bytes: payload.bytes ?? null,
        preview: summaryLabel,
        truncated: diffPreview.truncated,
      },
    };
  }

  const snapshot = payload.snapshot;
  const lineCount = snapshot?.lines.length ?? null;
  const cols = payload.cols ?? snapshot?.cols ?? null;
  const rows = payload.rows ?? snapshot?.rows ?? null;
  const tailPreview = trimTerminalActivityPreview(payload.tail ?? snapshot?.lines.slice(-20).join("\n"));
  const summaryLabel =
    tailPreview.preview ||
    [
      payload.title ?? "Terminal read",
      cols && rows ? `${cols}x${rows}` : null,
      lineCount !== null ? `${lineCount} lines` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return {
    content: summaryLabel,
    detail: {
      source: "terminal-read-activity",
      eventId,
      terminalId,
      representation: payload.representation,
      status: payload.status,
      title: payload.title,
      running: payload.running ?? false,
      seq: payload.seq ?? snapshot?.seq ?? null,
      cols,
      rows,
      cursor: payload.cursor ?? snapshot?.cursor ?? null,
      readCursor: payload.readCursor ?? null,
      lineCount,
      preview: summaryLabel,
      truncated: tailPreview.truncated,
    },
  };
};

const projectTerminalEventToActivityRecord = (event: {
  eventId: number;
  terminalId: string;
  createdAt: number;
  kind: "terminal_read" | "terminal_write" | "terminal_resize";
  payload: {
    title: string;
    content: string;
    actorId?: string;
    detail?: unknown;
  };
}): RuntimeTerminalActivityRecord => {
  const projectedRead =
    event.kind === "terminal_read" && isTerminalReadResultLike(event.payload.detail)
      ? summarizeTerminalReadActivity(event.eventId, event.terminalId, event.payload.detail)
      : null;
  return {
    id: event.eventId,
    terminalId: event.terminalId,
    createdAt: event.createdAt,
    kind: event.kind,
    cycleId: null,
    actorId: event.payload.actorId,
    title: event.payload.title,
    content: projectedRead?.content ?? event.payload.content,
    detail: projectedRead?.detail ?? event.payload.detail,
  };
};

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

type PersistedChatMessage = ChatMessage & {
  sessionId: string;
  messageId: string;
};

export type PublicRoomEntry = MessageControlPlaneEntry;

export type PublicRoomMessageRecord = MessageRecord;

export type PublicRoomSnapshot = MessageSnapshot;
export type PublicRoomPage = MessageTranscriptPage;

export type PublicRoomMessageQueryResult = MessageQueryResult;

export interface PublicRoomActorPresentation {
  actorId: MessageContactId;
  label: string;
  kind: "auth" | "participant" | "session" | "system";
  subtitle?: string;
  iconUrl?: string | null;
}

const emptyReversePage = <T>(): ReversePage<T> => ({
  items: [],
  nextBefore: null,
  hasMoreBefore: false,
});

const emptyHeartbeatRecordPage = (input: HeartbeatRecordPageInput): HeartbeatRecordPage => ({
  records: [],
  pageIndex: 0,
  pageSize: input.pageSize,
  totalRecords: 0,
  totalPages: 0,
  windowTotalRecords: 0,
  windowTotalPages: 0,
  latestRecordId: null,
  anchor: input.anchor,
  hasOlder: false,
  hasNewer: false,
  newRecordsAvailable: false,
});

const toPersistedChatMessage = (sessionId: string, message: SessionMessageRecord): PersistedChatMessage => ({
  ...projectHeartbeatMessageToChatMessage(message),
  sessionId,
  messageId: message.messageId,
});

const toPublicRoomMessageId = (messageId: number): number => messageId;

const projectPublicRoomEntry = (channel: MessageControlPlaneEntry): PublicRoomEntry => ({ ...channel });

const projectPublicRoomMessage = (message: MessageRecord): PublicRoomMessageRecord => ({
  ...message,
  messageId: toPublicRoomMessageId(message.messageId),
});

const projectPublicRoomPage = (page: PublicRoomPage): PublicRoomPage => ({
  ...page,
  items: page.items.map(projectPublicRoomMessage),
});

const projectPublicRoomSnapshot = (snapshot: MessageSnapshot): PublicRoomSnapshot => ({
  ...snapshot,
  channel: projectPublicRoomEntry(snapshot.channel),
  items: snapshot.items.map(projectPublicRoomMessage),
});

const readAllHeartbeatMessages = (db: SessionDb): SessionMessageRecord[] => {
  const pages: SessionMessageRecord[][] = [];
  let before: ReverseTimeCursor | undefined;
  while (true) {
    const page = db.pageMessagesByScope(HEARTBEAT_MESSAGE_PART_SCOPE, { before, limit: 1_000 });
    if (page.items.length === 0) {
      break;
    }
    pages.push(page.items);
    if (!page.hasMoreBefore || !page.nextBefore) {
      break;
    }
    before = page.nextBefore;
  }
  return pages.reverse().flat();
};

const readAllPersistedChatMessages = (db: SessionDb): SessionMessageRecord[] =>
  readAllHeartbeatMessages(db).filter(isPersistedChatProjectionMessage);

const pagePersistedMessages = <T extends { id: number }>(
  items: readonly T[],
  input: { before?: ReverseTimeCursor; limit?: number } | undefined,
  readTimestamp: (item: T) => number,
): ReversePage<T> => {
  const limit = Math.max(1, Math.min(input?.limit ?? 200, 1_000));
  const before = input?.before;
  const descending = [...items].sort((left, right) => {
    const leftTime = readTimestamp(left);
    const rightTime = readTimestamp(right);
    return leftTime === rightTime ? right.id - left.id : rightTime - leftTime;
  });
  const filtered = descending.filter((item) => {
    if (!before) {
      return true;
    }
    const timestamp = readTimestamp(item);
    return timestamp < before.beforeTimeMs || (timestamp === before.beforeTimeMs && item.id < before.beforeId);
  });
  const pageDescending = filtered.slice(0, limit);
  const pageItems = [...pageDescending].reverse();
  const oldest = pageItems[0] ?? null;
  return {
    items: pageItems,
    nextBefore:
      filtered.length > pageDescending.length && oldest
        ? {
            beforeTimeMs: readTimestamp(oldest),
            beforeId: oldest.id,
          }
        : null,
    hasMoreBefore: filtered.length > pageDescending.length,
  };
};

const readAllAiCalls = (db: SessionDb): SessionAiCallRecord[] => {
  const pages: SessionAiCallRecord[][] = [];
  let before: ReverseTimeCursor | undefined;
  while (true) {
    const page = db.pageAiCalls({ before, limit: 1_000 });
    if (page.items.length === 0) {
      break;
    }
    pages.push(page.items);
    if (!page.hasMoreBefore || !page.nextBefore) {
      break;
    }
    before = page.nextBefore;
  }
  return pages.reverse().flat();
};

const projectChatCyclesFromCalls = (db: SessionDb, calls: readonly SessionAiCallRecord[]): ChatCycle[] => {
  const responseMessageIds = [...new Set(calls.flatMap((call) => call.responseMessageIds))];
  const messageById = new Map(db.listMessagesByIds(responseMessageIds).map((message) => [message.messageId, message]));
  return calls.map((call) => projectAiCallToChatCycle({ call, messageById }));
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
  workspaceSystemStatePath?: string;
  homeDir?: string;
  initialWorkspace?: string;
  managedSeatAuthorityUrl?: string;
  authService?: AuthServiceBridgeOptions;
  /** @deprecated Use authService. */
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

export type RuntimeWorkspaceAssetRoots = WorkspaceAssetRoots;

export interface WorkspaceListItem extends WorkspaceEntry {
  objectivePath: string;
  group: string;
  missing: boolean;
  counts: WorkspaceSessionCounts;
  lastSessionActivityAt?: string;
}

export type WorkspaceWelcomeAccessState = "joined" | "available" | "credential-invalid";

export interface WorkspaceWelcomeRoomItem {
  channel: PublicRoomEntry;
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

const resolveDefaultAuthServiceDataDir = (stateRoot: string): string => {
  const canonical = join(stateRoot, "auth-service");
  const legacy = join(stateRoot, "profile-service");
  return !existsSync(canonical) && existsSync(legacy) ? legacy : canonical;
};

export class AppKernel {
  private readonly sessions: SessionCatalog;
  private readonly workspaces: WorkspacesStore;
  private readonly workspaceSystem: WorkspaceSystemStore;
  private readonly messageControlPlane: MessageControlPlane;
  private readonly terminalControlPlane: TerminalControlPlane;
  private readonly roomAssets: RoomAssetStore;
  private readonly runtimes = new Map<string, SessionRuntime>();
  private readonly runtimeStopListeners = new Map<string, () => void>();
  private readonly listeners = new Set<KernelListener>();
  private readonly eventLog: AnyRuntimeEvent[] = [];
  private readonly workspacePathSearch = new WorkspacePathSearchIndex();
  private readonly authService: AuthServiceBridge;
  private readonly authDraftStore: AuthDraftStore;
  private readonly authKvStore: AuthKvStore;
  private readonly avatarCatalogWatchers = new Map<string, FSWatcher>();
  private readonly avatarCatalogWatchPaths = new Map<string, string>();
  private readonly pendingAvatarCatalogInvalidations = new Set<string>();
  private readonly messageControlPlaneSubscriptions: Array<() => void> = [];
  private readonly terminalControlPlaneSubscriptions: Array<() => void> = [];
  private readonly pendingMessageRoomChanges = new Map<string, MessageRoomChangeRecord>();
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
  private managedSeatAuthorityUrl: string | null;

  constructor(private readonly options: AppKernelOptions = {}) {
    const homeDir = options.homeDir ?? homedir();
    this.sessions = new SessionCatalog({
      globalRoot: options.globalSessionRoot,
      archiveRoot: options.archiveSessionRoot,
    });
    this.workspaces = new WorkspacesStore({ filePath: options.workspacesPath });
    this.workspaceSystem = new WorkspaceSystemStore({
      filePath:
        options.workspaceSystemStatePath ?? join(this.sessions.getGlobalRoot(), "..", "workspace-system", "state.json"),
    });
    this.messageControlPlane = new MessageControlPlane({
      dbPath: resolveMessageControlDbPath(join(this.sessions.getGlobalRoot(), "..", ".message")),
    });
    this.roomAssets = new RoomAssetStore(join(this.sessions.getGlobalRoot(), "..", ".message"));
    this.terminalControlPlane = new TerminalControlPlane({
      dbPath: join(this.sessions.getGlobalRoot(), "..", ".terminal", "terminal.db"),
      outputRoot: join(this.sessions.getGlobalRoot(), "..", ".terminal", "output"),
      initialConfig: {
        defaults: {
          gitLog: "normal",
        },
      },
    });
    this.authDraftStore = new AuthDraftStore(resolveAuthDraftDbPath(homeDir));
    this.authKvStore = new AuthKvStore(resolveAuthKvDbPath(homeDir));
    const authServiceOptions = options.authService ?? options.profileService;
    const stateRoot = join(this.sessions.getGlobalRoot(), "..");
    this.authService = new AuthServiceBridge({
      ...authServiceOptions,
      dataDir: authServiceOptions?.dataDir ?? resolveDefaultAuthServiceDataDir(stateRoot),
    });
    this.managedSeatAuthorityUrl = options.managedSeatAuthorityUrl?.trim() || null;
  }

  setManagedSeatAuthorityUrl(authorityUrl: string): void {
    this.managedSeatAuthorityUrl = authorityUrl.trim();
  }

  getManagedSeatAuthorityUrl(): string | null {
    return this.managedSeatAuthorityUrl;
  }

  private getHomeDir(): string {
    return this.options.homeDir ?? homedir();
  }

  private isMissingFileError(error: unknown): boolean {
    return (
      typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT"
    );
  }

  private resolveAvatarPromptSeedPath(input: AppAvatarPromptSeedInput): string {
    const principalId = normalizePrincipalId(input.avatarPrincipalId);
    const root = resolveGlobalAvatarCanonicalRoot(principalId, this.getHomeDir());
    return join(root, "AGENTER.mdx");
  }

  private async overwriteDefaultAvatarPrompt(): Promise<void> {
    const record = await this.ensureGlobalAvatarPrincipal({
      nickname: defaultAvatarNickname(),
      displayName: formatAvatarDisplayName(defaultAvatarNickname()),
      classify: null,
      createMissing: true,
    });
    if (!record) {
      return;
    }
    const promptPath = join(resolveGlobalAvatarCanonicalRoot(record.principal.principalId, this.getHomeDir()), "AGENTER.mdx");
    await mkdir(resolve(promptPath, ".."), { recursive: true });
    // File truth: for the locked default avatar, the canonical AGENTER.mdx on
    // disk is the durable authority. Daemon startup reasserts that file's
    // wrapper instead of preserving ad-hoc edits or relying on bundled memory.
    await writeFile(promptPath, DEFAULT_AVATAR_PROMPT_WRAPPER, "utf8");
  }

  private rememberWorkspace(workspacePath: string): void {
    this.workspaces.add(workspacePath);
    if (this.started) {
      this.syncAvatarCatalogWatchers();
    }
  }

  private resolveAvatarCatalogWatchPath(workspacePath: string): string | null {
    const homeDir = this.getHomeDir();
    const normalizedWorkspacePath = isGlobalWorkspacePath(workspacePath, homeDir)
      ? GLOBAL_WORKSPACE_PATH
      : workspacePath;
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
      if (
        !desired.has(workspacePath) ||
        desired.get(workspacePath) !== this.avatarCatalogWatchPaths.get(workspacePath)
      ) {
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
            workspacePath === GLOBAL_WORKSPACE_PATH
              ? [GLOBAL_WORKSPACE_PATH, ...this.workspaces.list()]
              : [workspacePath],
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

  private queueMessageRoomInvalidation(input: { changes: MessageRoomChangeRecord[] }): void {
    for (const change of input.changes) {
      const current = this.pendingMessageRoomChanges.get(change.chatId);
      this.pendingMessageRoomChanges.set(change.chatId, {
        chatId: change.chatId,
        roomRevision: change.roomRevision,
        transcriptRevision: change.transcriptRevision,
        refreshCatalog: current?.refreshCatalog || change.refreshCatalog,
        refreshSnapshot: current?.refreshSnapshot || change.refreshSnapshot,
        refreshGrants: current?.refreshGrants || change.refreshGrants,
        refreshAssets: current?.refreshAssets || change.refreshAssets,
      });
      if (change.refreshCatalog) {
        this.pendingMessageRoomCatalogInvalidation = true;
      }
    }
    if (this.messageRoomInvalidationTimer) {
      clearTimeout(this.messageRoomInvalidationTimer);
    }
    this.messageRoomInvalidationTimer = setTimeout(() => {
      const catalogChanged = this.pendingMessageRoomCatalogInvalidation;
      const changes = [...this.pendingMessageRoomChanges.values()];
      this.pendingMessageRoomCatalogInvalidation = false;
      this.pendingMessageRoomChanges.clear();
      this.messageRoomInvalidationTimer = null;
      if (!catalogChanged && changes.length === 0) {
        return;
      }
      this.emit("message.room.updated", {
        catalogChanged,
        changes,
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
        const baseChange: MessageRoomChangeRecord = {
          chatId: payload.chatId,
          roomRevision: payload.roomRevision,
          transcriptRevision: payload.transcriptRevision,
        };
        switch (payload.reason) {
          case "created":
            this.queueMessageRoomInvalidation({
              changes: [{ ...baseChange, refreshCatalog: true, refreshSnapshot: true }],
            });
            return;
          case "updated":
          case "message":
          case "read":
            this.queueMessageRoomInvalidation({
              changes: [{ ...baseChange, refreshCatalog: true, refreshSnapshot: true }],
            });
            return;
          case "grant-issued":
          case "grant-revoked":
            this.queueMessageRoomInvalidation({
              changes: [{ ...baseChange, refreshCatalog: true, refreshSnapshot: true, refreshGrants: true }],
            });
            return;
          case "archived":
          case "deleted":
            this.queueMessageRoomInvalidation({
              changes: [{ ...baseChange, refreshCatalog: true }],
            });
            return;
          case "focus":
          case "presence":
            this.queueMessageRoomInvalidation({
              changes: [{ ...baseChange, refreshSnapshot: true }],
            });
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
          case "identity":
          case "lifecycle":
          case "transition":
          case "focus":
          case "presence":
            this.queueTerminalSurfaceInvalidation({ catalogChanged: true });
            return;
          case "snapshot":
          case "status":
            // Live transport output already projects terminal state. Treating
            // every render tick as a catalog mutation causes the browser to
            // refetch terminal.globalList on each snapshot/status change.
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
      this.terminalControlPlane.onApprovalRequest((payload) => {
        if (!this.started) {
          return;
        }
        this.emit("terminal.permissionRequest", payload);
      }),
    );
  }

  async start(): Promise<void> {
    await materializeBuiltinPromptDocs({ homeDir: this.getHomeDir() });
    await this.overwriteDefaultAvatarPrompt();
    this.started = true;
    this.bindMessageControlPlaneEvents();
    this.bindTerminalControlPlaneEvents();
    this.terminalControlPlane.replayRecoveredLifecycle();
    if (this.options.initialWorkspace) {
      this.rememberWorkspace(this.options.initialWorkspace);
    }
    this.ensureSessionCatalogLoaded();
    const boundSessions = await Promise.all(this.sessions.list().map(async (session) => await this.bindSessionAvatarPrincipal(session)));
    this.repairLegacySessionMessageActors(boundSessions);
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
    this.pendingMessageRoomChanges.clear();
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
    this.authDraftStore.close();
    this.authKvStore.close();
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

  private async ensureRuntimeAvatarPrincipal(avatar: string): Promise<AvatarPrincipalRecord> {
    const record = await this.ensureGlobalAvatarPrincipal({
      nickname: avatar,
      displayName:
        resolveBuiltInAvatarProfile(avatar)?.displayName ??
        (avatar === defaultAvatarNickname() ? formatAvatarDisplayName(avatar) : null),
      classify: resolveBuiltInAvatarProfile(avatar)?.classify ?? null,
      createMissing: true,
    });
    if (!record) {
      throw new Error(`failed to resolve global avatar principal: ${avatar}`);
    }
    const managed = await this.authService.revealManagedPrincipal(record.principal.principalId);
    if (!managed) {
      throw new Error(`global avatar private key unavailable: ${record.principal.principalId}`);
    }
    return {
      principalId: managed.principalId,
      algorithm: managed.algorithm,
      publicKey: managed.publicKey,
      privateKey: managed.privateKey,
    };
  }

  private async revealRuntimeAvatarPrincipal(principalId: string): Promise<AvatarPrincipalRecord> {
    const managed = await this.authService.revealManagedPrincipal(principalId);
    if (!managed) {
      throw new Error(`global avatar private key unavailable: ${principalId}`);
    }
    return {
      principalId: managed.principalId,
      algorithm: managed.algorithm,
      publicKey: managed.publicKey,
      privateKey: managed.privateKey,
    };
  }

  private async bindSessionAvatarPrincipal(session: SessionMeta): Promise<SessionMeta> {
    const principal = await this.ensureRuntimeAvatarPrincipal(session.avatar);
    if (session.avatarPrincipalId === principal.principalId) {
      return session;
    }
    return this.sessions.update(session.id, {
      avatarPrincipalId: principal.principalId,
    });
  }

  private collectLegacySessionMessageActorAliases(
    sessions: Array<Pick<SessionMeta, "id" | "avatarPrincipalId">>,
  ): Array<{ fromContactId: MessageContactId; toContactId: MessageContactId }> {
    return sessions.flatMap((session) => {
      if (!session.avatarPrincipalId) {
        return [];
      }
      const legacyActorId = resolveSessionRoomActorId(session.id);
      return legacyActorId === session.avatarPrincipalId
        ? []
        : [{ fromContactId: legacyActorId, toContactId: session.avatarPrincipalId as MessageContactId }];
    });
  }

  private repairLegacySessionMessageActors(sessions: Array<Pick<SessionMeta, "id" | "avatarPrincipalId">>): void {
    const aliases = this.collectLegacySessionMessageActorAliases(sessions);
    if (aliases.length === 0) {
      return;
    }
    for (const channel of this.messageControlPlane.listChannels({ includeArchived: true })) {
      this.messageControlPlane.repairChannelContactAliases({
        chatId: channel.chatId,
        aliases,
      });
    }
  }

  private resolveSessionMessageContactId(session: Pick<SessionMeta, "id" | "avatarPrincipalId">): MessageContactId {
    return (session.avatarPrincipalId ?? resolveSessionRoomActorId(session.id)) as MessageContactId;
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
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
    includeArchived?: boolean;
  }): MessageControlPlaneEntry {
    if (input.actorId && !input.superadminContactId) {
      const room = this.messageControlPlane.getChannelForContact(input.chatId, input.actorId, {
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
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
    includeArchived?: boolean;
  }): { room: MessageControlPlaneEntry; accessToken: string } {
    const room = this.resolveGlobalRoomProjection(input);
    return {
      room,
      accessToken: input.accessToken ?? room.accessToken,
    };
  }

  private resolvePublicRoomActorKind(actorId: MessageContactId): PublicRoomActorPresentation["kind"] {
    if (actorId.startsWith("auth:")) {
      return "auth";
    }
    if (actorId.startsWith("system:")) {
      return "system";
    }
    if (actorId.startsWith("session:")) {
      return "session";
    }
    return "participant";
  }

  private async buildPublicRoomActorDirectory(input: {
    snapshot: PublicRoomSnapshot;
    viewerActorId?: MessageContactId;
  }): Promise<Record<string, PublicRoomActorPresentation>> {
    // Room access provenance can look like a sender label; transcript identity must prefer Auth/contact facts.
    const directory: Record<string, PublicRoomActorPresentation> = {};
    const put = (entry: PublicRoomActorPresentation): void => {
      const current = directory[entry.actorId];
      directory[entry.actorId] = {
        ...current,
        ...entry,
        label: entry.label.trim() || current?.label || entry.actorId,
        subtitle: entry.subtitle ?? current?.subtitle,
        iconUrl: entry.iconUrl ?? current?.iconUrl ?? null,
      };
    };

    const authActorById = new Map((await this.listAuthActors()).map((actor) => [actor.actorId, actor]));
    const authBaseUrl = await this.authService.getBaseUrl();

    const pushActor = (actorId: string | null | undefined, label?: string | null): void => {
      if (!actorId) {
        return;
      }
      const typedActorId = actorId as MessageContactId;
      const current = directory[typedActorId];
      const authActor = authActorById.get(typedActorId as `auth:${string}`);
      const principalIconUrl = isPrincipalId(typedActorId) ? `${authBaseUrl}${buildAvatarIconUrl(typedActorId)}` : null;
      put({
        actorId: typedActorId,
        label: authActor?.label ?? current?.label ?? label?.trim() ?? (typedActorId.split(":").at(-1) || typedActorId),
        kind: authActor ? "auth" : (current?.kind ?? this.resolvePublicRoomActorKind(typedActorId)),
        subtitle: authActor?.subtitle ?? current?.subtitle ?? typedActorId,
        iconUrl: authActor?.iconUrl ?? current?.iconUrl ?? principalIconUrl,
      });
    };

    pushActor(input.viewerActorId);
    for (const participant of input.snapshot.channel.participants) {
      pushActor(participant.id, participant.label);
    }
    for (const seat of input.snapshot.channel.seatStates ?? []) {
      pushActor(seat.contactId, seat.label);
    }
    for (const item of input.snapshot.items) {
      pushActor(item.senderContactId, item.from);
      for (const contactId of item.readContactIds) {
        pushActor(contactId);
      }
      for (const contactId of item.unreadContactIds) {
        pushActor(contactId);
      }
    }

    return directory;
  }

  async projectPublicRoomActorDirectory(input: {
    snapshot: PublicRoomSnapshot;
    viewerActorId?: MessageContactId;
  }): Promise<Record<string, PublicRoomActorPresentation>> {
    return await this.buildPublicRoomActorDirectory(input);
  }

  private requireMessageSourceSubscription(
    actorId: MessageContactId,
    sourceId: string,
  ): MessageSourceSubscriptionRecord {
    const source = this.messageControlPlane.getSourceSubscription(actorId, sourceId);
    if (!source) {
      throw new Error(`unknown message source subscription: ${sourceId}`);
    }
    return source;
  }

  private requirePendingMessageContactRequest(
    actorId: MessageContactId,
    requestId: string,
  ): MessageContactRequestRecord {
    const request = this.messageControlPlane.getContactRequest(actorId, requestId);
    if (!request) {
      throw new Error(`unknown contact request: ${requestId}`);
    }
    if (request.state !== "pending") {
      throw new Error(`contact request is not pending: ${requestId}`);
    }
    return request;
  }

  private requireResponseSourceSubscription(
    actorId: MessageContactId,
    request: MessageContactRequestRecord,
  ): MessageSourceSubscriptionRecord {
    const bySourceId = this.messageControlPlane.getSourceSubscription(actorId, request.sourceId);
    if (bySourceId) {
      return bySourceId;
    }
    if (request.callbackEndpoint) {
      const callbackEndpoint = normalizeRemoteEndpoint(request.callbackEndpoint);
      const matched = this.messageControlPlane
        .listSourceSubscriptions(actorId)
        .find((source) => normalizeRemoteEndpoint(source.endpoint) === callbackEndpoint);
      if (matched) {
        return matched;
      }
    }
    throw new Error(`no response source subscription for contact request: ${request.requestId}`);
  }

  private async resolveMessageActorDirectoryProjection(actorId: MessageContactId): Promise<{
    actorId: MessageContactId;
    label: string;
    subtitle: string;
    iconUrl: string;
  }> {
    if (actorId.startsWith("auth:")) {
      const actors = await this.listAuthActors();
      const projected = actors.find((item) => item.actorId === actorId);
      if (projected) {
        return {
          actorId,
          label: projected.label,
          subtitle: projected.subtitle,
          iconUrl: projected.iconUrl,
        };
      }
    }
    return {
      actorId,
      label: actorId.split(":").at(-1) ?? actorId,
      subtitle: actorId,
      iconUrl: "",
    };
  }

  private async resolveRemoteMessageActorProjection(
    source: MessageSourceSubscriptionRecord,
    remoteContactId: MessageContactId,
  ): Promise<{ actorId: MessageContactId; label: string; subtitle: string; iconUrl: string }> {
    const client = createRemoteMessageSourceClient({
      endpoint: source.endpoint,
      authToken: source.authToken,
    });
    const items = await client.searchAuthCatalog({
      query: remoteContactId,
    });
    const projected = items.find((item) => item.actorId === remoteContactId);
    if (projected) {
      return {
        actorId: remoteContactId,
        label: projected.label,
        subtitle: projected.subtitle,
        iconUrl: projected.iconUrl,
      };
    }
    return {
      actorId: remoteContactId,
      label: remoteContactId.split(":").at(-1) ?? remoteContactId,
      subtitle: remoteContactId,
      iconUrl: "",
    };
  }

  private async createLocalDirectContactRoom(input: {
    actorId: MessageContactId;
    sourceId: string;
    remoteContactId: MessageContactId;
    remoteLabel?: string;
    remoteDirectChatId?: string;
  }): Promise<PublicRoomEntry> {
    return await this.createGlobalRoom({
      actorId: input.actorId,
      title: input.remoteLabel?.trim() || (input.remoteContactId.split(":").at(-1) ?? input.remoteContactId),
      participants: [
        { id: input.actorId },
        input.remoteLabel ? { id: input.remoteContactId, label: input.remoteLabel } : { id: input.remoteContactId },
      ],
      metadata: {
        roomMode: "direct",
        directSourceId: input.sourceId,
        directPeerActorId: input.remoteContactId,
        remoteDirectChatId: input.remoteDirectChatId,
      },
      focus: false,
    });
  }

  private patchDirectRoomPairing(input: {
    actorId: MessageContactId;
    chatId: string;
    remoteDirectChatId: string;
  }): PublicRoomEntry {
    const room = this.resolveGlobalRoomProjection({
      chatId: input.chatId,
      actorId: input.actorId,
      includeArchived: true,
    });
    return this.updateGlobalRoom({
      actorId: input.actorId,
      chatId: input.chatId,
      patch: {
        metadata: {
          ...(room.metadata ?? {}),
          remoteDirectChatId: input.remoteDirectChatId,
          roomMode: "direct",
        },
      },
    });
  }

  private appendDirectBootstrapMessage(chatId: string, senderContactId: MessageContactId, content: string): void {
    this.messageControlPlane.send({
      chatId,
      senderContactId,
      kind: "text",
      content,
    });
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
      const mountedPaths = this.workspaceSystem.listRuntimeMounts(session.id).map((mount) => mount.workspacePath);
      const paths = mountedPaths.length > 0 ? mountedPaths : [session.workspacePath];
      for (const workspacePath of paths) {
        const list = byWorkspace.get(workspacePath) ?? [];
        list.push(session);
        byWorkspace.set(workspacePath, list);
      }
    }

    return this.workspaces.listEntries().map((entry) => {
      const sessions = byWorkspace.get(entry.path) ?? [];
      const counts = countWorkspaceSessions(sessions);
      const lastSessionActivityAt = sessions
        .map((session) => sessionSortAt(session))
        .sort((left, right) => right.localeCompare(left))[0];
      return {
        ...entry,
        objectivePath: entry.path === GLOBAL_WORKSPACE_PATH ? join(this.getHomeDir(), ".agenter") : entry.path,
        group: entry.path === GLOBAL_WORKSPACE_PATH ? "Global" : resolveWorkspaceGroup(entry.path),
        missing: entry.path === GLOBAL_WORKSPACE_PATH ? false : !this.validateDirectory(entry.path).ok,
        counts,
        lastSessionActivityAt,
      };
    });
  }

  private readAvatarPrincipalRecord(
    principal: PrincipalProjection,
  ): { principal: PrincipalProjection; metadata: AvatarPrincipalMetadata } | null {
    const metadata =
      readAvatarPrincipalMetadata(principal.metadata) ??
      (principal.kind === "avatar" && principal.ownerKey
        ? normalizeAvatarPrincipalMetadata({
            nickname: principal.ownerKey,
            displayName: formatAvatarDisplayName(principal.ownerKey),
            classify: null,
          })
        : null);
    return metadata ? { principal, metadata } : null;
  }

  private compareAvatarCatalogRecords(
    left: { metadata: AvatarPrincipalMetadata },
    right: { metadata: AvatarPrincipalMetadata },
  ): number {
    if (left.metadata.nickname === defaultAvatarNickname()) {
      return -1;
    }
    if (right.metadata.nickname === defaultAvatarNickname()) {
      return 1;
    }
    return left.metadata.nickname.localeCompare(right.metadata.nickname);
  }

  private async ensureGlobalAvatarPrincipal(input: {
    nickname: string;
    displayName?: string | null;
    classify?: AvatarClassify | null;
    createMissing?: boolean;
  }): Promise<{ principal: PrincipalProjection; metadata: AvatarPrincipalMetadata } | null> {
    const nickname = resolveAvatarOwnerKey(input.nickname);
    const existing = await this.authService.listManagedPrincipals({
      kind: "avatar",
      ownerKey: nickname,
    });
    const existingRecord = existing
      .map((principal) => this.readAvatarPrincipalRecord(principal))
      .find(
        (
          record,
        ): record is {
          principal: PrincipalProjection;
          metadata: AvatarPrincipalMetadata;
        } => record !== null,
      );
    if (existingRecord) {
      ensureAvatarNicknameAlias({
        workspacePath: GLOBAL_WORKSPACE_PATH,
        avatar: existingRecord.metadata.nickname,
        principalId: existingRecord.principal.principalId,
        homeDir: this.getHomeDir(),
      });
      return existingRecord;
    }
    if (!input.createMissing) {
      return null;
    }
    const metadata = canonicalizeAvatarPrincipalMetadata({
      nickname,
      displayName: input.displayName,
      classify: input.classify,
    });
    const created = await this.authService.createManagedPrincipal({
      kind: "avatar",
      metadata: { ...metadata },
    });
    ensureAvatarNicknameAlias({
      workspacePath: GLOBAL_WORKSPACE_PATH,
      avatar: metadata.nickname,
      principalId: created.principalId,
      homeDir: this.getHomeDir(),
    });
    return {
      principal: created,
      metadata,
    };
  }

  private async ensureRegisteredGlobalAvatarPrincipals(): Promise<
    Array<{ principal: PrincipalProjection; metadata: AvatarPrincipalMetadata }>
  > {
    const nicknames = new Set(listGlobalAvatarNicknamesFromStorage(this.getHomeDir()));
    nicknames.add(defaultAvatarNickname());

    const records = new Map<string, { principal: PrincipalProjection; metadata: AvatarPrincipalMetadata }>();
    for (const principal of await this.authService.listManagedPrincipals({ kind: "avatar" })) {
      const record = this.readAvatarPrincipalRecord(principal);
      if (record && !records.has(record.metadata.nickname)) {
        records.set(record.metadata.nickname, record);
      }
    }

    for (const nickname of nicknames) {
      if (records.has(nickname)) {
        continue;
      }
      const imported = await this.ensureGlobalAvatarPrincipal({
        nickname,
        displayName:
          resolveBuiltInAvatarProfile(nickname)?.displayName ??
          (nickname === defaultAvatarNickname() ? formatAvatarDisplayName(nickname) : null),
        classify: resolveBuiltInAvatarProfile(nickname)?.classify ?? null,
        createMissing: true,
      });
      if (imported) {
        records.set(imported.metadata.nickname, imported);
      }
    }

    const ordered = [...records.values()].sort((left, right) => this.compareAvatarCatalogRecords(left, right));
    for (const record of ordered) {
      ensureAvatarNicknameAlias({
        workspacePath: GLOBAL_WORKSPACE_PATH,
        avatar: record.metadata.nickname,
        principalId: record.principal.principalId,
        homeDir: this.getHomeDir(),
      });
    }
    return ordered;
  }

  private buildAvatarCatalogEntry(input: {
    workspacePath: string;
    nickname: string;
    avatarPrincipalId?: string | null;
    displayName?: string | null;
    classify?: AvatarClassify | null;
    iconUrl?: string | null;
    globalAvailable?: boolean;
  }): WorkspaceAvatarCatalogEntry {
    return buildWorkspaceAvatarCatalogEntry({
      workspacePath: toWorkspacePath(input.workspacePath),
      nickname: input.nickname,
      homeDir: this.getHomeDir(),
      avatarPrincipalId: input.avatarPrincipalId,
      displayName: input.displayName,
      classify: input.classify,
      iconUrl: input.iconUrl,
      globalAvailable: input.globalAvailable,
    });
  }

  private buildSkillBrowserLookupInput(): { homeDir: string; skillHomeRoots: string[] } {
    const homeDir = this.getHomeDir();
    return {
      homeDir,
      skillHomeRoots: deriveEnvSkillsHome({
        pwd: homeDir,
        avatarHome: [],
      }),
    };
  }

  private async resolveNoteAvatarContext(input: { avatarNickname?: string | null } = {}): Promise<NoteAvatarContext> {
    const nickname = normalizeAvatarNickname(input.avatarNickname ?? defaultAvatarNickname());
    const avatar = (await this.listGlobalAvatarCatalog()).find((entry) => entry.nickname === nickname) ?? null;
    const principalId = avatar?.avatarPrincipalId ?? null;
    const avatarHome = principalId ? [resolveGlobalAvatarCanonicalRoot(principalId, this.getHomeDir())] : [];
    return {
      nickname,
      principalId,
      avatarHome,
    };
  }

  async listNoteCatalog(input: { avatarNickname?: string | null; limit?: number } = {}): Promise<
    NoteCatalogOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    return {
      avatar,
      ...listNoteCatalog({
        avatarHome: avatar.avatarHome,
        limit: input.limit,
      }),
    };
  }

  async readNotePage(input: {
    avatarNickname?: string | null;
    notebook: string;
    section: string;
    page: string;
  }): Promise<
    NotePageOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    return {
      avatar,
      ...readNotePage({
        avatarHome: avatar.avatarHome,
        notebook: input.notebook,
        section: input.section,
        page: input.page,
      }),
    };
  }

  async searchNoteCatalog(input: {
    avatarNickname?: string | null;
    query?: string;
    limit?: number;
    tags?: readonly string[];
  }): Promise<
    NoteSearchOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    return {
      avatar,
      ...searchNoteCatalog({
        avatarHome: avatar.avatarHome,
        query: input.query ?? "",
        limit: input.limit,
        tags: input.tags,
      }),
    };
  }

  async listNoteTagCatalog(
    input: { avatarNickname?: string | null; notebook?: string; section?: string } = {},
  ): Promise<
    NoteTagQueryOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    return {
      avatar,
      ...listNoteTagCatalog({
        avatarHome: avatar.avatarHome,
        notebook: input.notebook,
        section: input.section,
      }),
    };
  }

  async queryNoteCatalogSql(input: { avatarNickname?: string | null; sql: string; limit?: number }): Promise<
    NoteSqlQueryOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    return {
      avatar,
      ...queryNoteCatalogSql({
        avatarHome: avatar.avatarHome,
        sql: input.sql,
        limit: input.limit,
      }),
    };
  }

  async renameNoteCatalogPages(input: {
    avatarNickname?: string | null;
    notebook: string;
    section: string;
    page?: string;
    toNotebook?: string;
    toSection?: string;
    toPage?: string;
  }): Promise<
    NoteRenameOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    return {
      avatar,
      ...renameNoteCatalogPages({
        avatarHome: avatar.avatarHome,
        notebook: input.notebook,
        section: input.section,
        page: input.page,
        toNotebook: input.toNotebook,
        toSection: input.toSection,
        toPage: input.toPage,
      }),
    };
  }

  async writeNoteCatalogPage(input: {
    avatarNickname?: string | null;
    notebook: string;
    section: string;
    page: string;
    content?: string;
    contentFile?: string;
    mode?: "append" | "override";
    mime: string;
    tags?: readonly string[];
    references?: readonly NoteReferenceInput[];
  }): Promise<
    NotePageOutput & {
      avatar: NoteAvatarContext;
    }
  > {
    const avatar = await this.resolveNoteAvatarContext(input);
    const contentInput =
      input.contentFile !== undefined
        ? input.content !== undefined
          ? null
          : { contentFile: input.contentFile }
        : input.content !== undefined
          ? { content: input.content }
          : null;
    if (!contentInput) {
      throw new Error("note write requires exactly one content source: content or contentFile");
    }
    return {
      avatar,
      ...writeNoteCatalogPage({
        avatarHome: avatar.avatarHome,
        notebook: input.notebook,
        section: input.section,
        page: input.page,
        ...contentInput,
        mode: input.mode,
        mime: input.mime,
        tags: input.tags,
        references: input.references,
      }),
    };
  }

  async listWorkspaceAvatarCatalog(workspacePath: string): Promise<WorkspaceAvatarCatalogEntry[]> {
    const normalizedWorkspacePath = toWorkspacePath(workspacePath);
    const globalCatalog = await this.listGlobalAvatarCatalog();
    if (normalizedWorkspacePath === GLOBAL_WORKSPACE_PATH) {
      return globalCatalog;
    }
    const globalByNickname = new Map(globalCatalog.map((entry) => [entry.nickname, entry]));
    return listWorkspaceAvatarNicknamesFromStorage(normalizedWorkspacePath, this.getHomeDir()).map((nickname) => {
      const globalEntry = globalByNickname.get(nickname);
      return this.buildAvatarCatalogEntry({
        workspacePath: normalizedWorkspacePath,
        nickname,
        avatarPrincipalId: globalEntry?.avatarPrincipalId ?? null,
        displayName: globalEntry?.displayName ?? null,
        classify: globalEntry?.classify ?? null,
        iconUrl: globalEntry?.iconUrl ?? null,
        globalAvailable: globalEntry?.globalAvailable,
      });
    });
  }

  async listGlobalAvatarCatalog(): Promise<WorkspaceAvatarCatalogEntry[]> {
    const baseUrl = await this.authService.getBaseUrl();
    return (await this.ensureRegisteredGlobalAvatarPrincipals()).map((record) =>
      this.buildAvatarCatalogEntry({
        workspacePath: GLOBAL_WORKSPACE_PATH,
        nickname: record.metadata.nickname,
        avatarPrincipalId: record.principal.principalId,
        displayName: record.metadata.displayName,
        classify: record.metadata.classify,
        iconUrl: `${baseUrl}${buildAvatarIconUrl(record.principal.principalId)}`,
        globalAvailable: true,
      }),
    );
  }

  async createGlobalAvatar(input: {
    nickname: string;
    displayName?: string | null;
    classify?: AvatarClassify | null;
  }): Promise<WorkspaceAvatarCatalogEntry> {
    const nickname = resolveAvatarOwnerKey(input.nickname);
    const existing = await this.ensureGlobalAvatarPrincipal({
      nickname,
      createMissing: false,
    });
    if (existing) {
      throw new Error(`avatar nickname already exists: ${nickname}`);
    }
    const created = await this.ensureGlobalAvatarPrincipal({
      nickname,
      displayName: input.displayName,
      classify: input.classify,
      createMissing: true,
    });
    if (!created) {
      throw new Error(`failed to create avatar principal: ${nickname}`);
    }
    this.queueAvatarCatalogInvalidation([GLOBAL_WORKSPACE_PATH, ...this.workspaces.list()]);
    return this.buildAvatarCatalogEntry({
      workspacePath: GLOBAL_WORKSPACE_PATH,
      nickname: created.metadata.nickname,
      avatarPrincipalId: created.principal.principalId,
      displayName: created.metadata.displayName,
      classify: created.metadata.classify,
      iconUrl: `${await this.authService.getBaseUrl()}${buildAvatarIconUrl(created.principal.principalId)}`,
      globalAvailable: true,
    });
  }

  listRuntimeWorkspaceMounts(runtimeId: string): WorkspaceMountRecord[] {
    return this.workspaceSystem.listRuntimeMounts(runtimeId);
  }

  listRuntimeWorkspaceGrants(input: { runtimeId: string; workspacePath: string }): WorkspaceGrantRecord[] {
    return this.workspaceSystem.listRuntimeWorkspaceGrants(input);
  }

  grantRuntimeWorkspace(input: {
    runtimeId: string;
    workspacePath: string;
    grants: WorkspaceGrantInput[];
  }): WorkspaceGrantRecord[] {
    const workspacePath = toWorkspacePath(input.workspacePath);
    this.rememberWorkspace(workspacePath);
    const grants = this.workspaceSystem.setRuntimeWorkspaceGrants({
      runtimeId: input.runtimeId,
      workspacePath,
      grants: input.grants,
      env: this.buildInheritedWorkspaceInstanceEnv(input.runtimeId),
    });
    this.runtimes.get(input.runtimeId)?.recomputeWorkspaceCliProjections();
    return grants;
  }

  detachRuntimeWorkspace(input: { runtimeId: string; workspacePath: string }): { detached: boolean } {
    const detached =
      this.workspaceSystem.detachRuntimeWorkspace({
        runtimeId: input.runtimeId,
        workspacePath: toWorkspacePath(input.workspacePath),
      }) !== null;
    if (detached) {
      this.runtimes.get(input.runtimeId)?.recomputeWorkspaceCliProjections();
    }
    return { detached };
  }

  private listRuntimeWorkspaceAuthorities(runtimeId: string): Array<{
    mount: WorkspaceMountRecord;
    workspaceRoot: string;
    grants: WorkspaceGrantRecord[];
    defaultCwd: string;
  }> {
    return this.workspaceSystem
      .listRuntimeMounts(runtimeId)
      .map((mount) => ({
        mount,
        workspaceRoot: toWorkspaceCwd(mount.workspacePath, this.getHomeDir()),
        defaultCwd: resolveWorkspaceFsPath(
          this.workspaceSystem.getRuntimeWorkspaceExecProfile({
            runtimeId,
            workspacePath: mount.workspacePath,
          })?.cwd ?? mount.workspacePath,
          this.getHomeDir(),
        ),
        grants: this.workspaceSystem.listRuntimeWorkspaceGrants({
          runtimeId,
          workspacePath: mount.workspacePath,
        }),
      }))
      .filter((entry) => entry.grants.length > 0);
  }

  private setRuntimeWorkspaceAlias(input: {
    runtimeId: string;
    runtimeWorkspaceId: number;
    alias: string;
  }): WorkspaceMountRecord | null {
    return this.workspaceSystem.setRuntimeWorkspaceAlias(input);
  }

  private resolveRuntimeTerminalCwd(input: {
    runtimeId: string;
    cwd?: string;
  }): { ok: true; cwd: string } | { ok: false; message: string } {
    const authorities = this.listRuntimeWorkspaceAuthorities(input.runtimeId);
    if (typeof input.cwd === "string" && input.cwd.trim().length > 0) {
      const cwd = resolveWorkspaceFsPath(input.cwd, this.getHomeDir());
      const allowed = authorities.some(
        (entry) =>
          resolveWorkspaceGrantModeFromAbsolutePath({
            workspaceRoot: entry.workspaceRoot,
            absolutePath: cwd,
            grants: entry.grants,
            partial: true,
          }) !== "none",
      );
      if (!allowed) {
        return {
          ok: false,
          message: `terminal cwd is outside explicit workspace grants: ${cwd}`,
        };
      }
      return { ok: true, cwd };
    }

    const rootCandidates = [
      ...new Set(
        authorities.filter((entry) => hasWorkspaceGrantRootAccess(entry.grants)).map((entry) => entry.workspaceRoot),
      ),
    ];
    if (rootCandidates.length === 1) {
      return { ok: true, cwd: rootCandidates[0] };
    }
    if (rootCandidates.length === 0) {
      return {
        ok: false,
        message: "terminal cwd requires explicit `cwd` or exactly one mounted workspace with a root grant",
      };
    }
    return {
      ok: false,
      message: "terminal cwd is ambiguous; provide explicit `cwd` or narrow mounted workspace root grants",
    };
  }

  getRuntimeWorkspaceAssetRoots(input: { workspacePath: string; avatar: string }): RuntimeWorkspaceAssetRoots {
    const workspacePath = toWorkspacePath(input.workspacePath);
    const avatar = normalizeAvatarNickname(input.avatar);
    const homeDir = this.getHomeDir();
    const publicRoots = {
      skills: resolveWorkspacePublicAssetRoot(workspacePath, "skills", homeDir),
      memory: resolveWorkspacePublicAssetRoot(workspacePath, "memory", homeDir),
      tools: resolveWorkspacePublicAssetRoot(workspacePath, "tools", homeDir),
      archive: resolveWorkspacePublicAssetRoot(workspacePath, "archive", homeDir),
    };
    const privateRoots = {
      skills: resolveWorkspaceAvatarAssetRoot(workspacePath, avatar, "skills", homeDir),
      memory: resolveWorkspaceAvatarAssetRoot(workspacePath, avatar, "memory", homeDir),
      tools: resolveWorkspaceAvatarAssetRoot(workspacePath, avatar, "tools", homeDir),
      archive: resolveWorkspaceAvatarAssetRoot(workspacePath, avatar, "archive", homeDir),
    };
    for (const root of [...Object.values(publicRoots), ...Object.values(privateRoots)]) {
      mkdirSync(root, { recursive: true });
    }
    return {
      workspacePath,
      avatar,
      publicRoots,
      privateRoots,
    };
  }

  listSkillBrowserCatalog(input: { rootKind: SkillBrowserCatalogRootKind }) {
    return listSkillBrowserCatalog({
      lookup: this.buildSkillBrowserLookupInput(),
      rootKind: input.rootKind,
    });
  }

  async listSkillBrowserAvatarCatalog() {
    return listSkillBrowserAvatarCatalog({
      avatars: await this.listGlobalAvatarCatalog(),
      workspacePaths: this.workspaces.list(),
      homeDir: this.getHomeDir(),
    });
  }

  listSkillBrowserCatalogTree(input: {
    rootKind: SkillBrowserCatalogRootKind;
    name: string;
    path?: string;
    offset?: number;
    limit?: number;
  }) {
    return listSkillBrowserCatalogTree({
      lookup: this.buildSkillBrowserLookupInput(),
      rootKind: input.rootKind,
      name: input.name,
      path: input.path,
      offset: input.offset,
      limit: input.limit,
    });
  }

  readSkillBrowserCatalogPreview(input: {
    rootKind: SkillBrowserCatalogRootKind;
    name: string;
    path: string;
    maxBytes?: number;
  }) {
    return readSkillBrowserCatalogPreview({
      lookup: this.buildSkillBrowserLookupInput(),
      rootKind: input.rootKind,
      name: input.name,
      path: input.path,
      maxBytes: input.maxBytes,
    });
  }

  listSkillBrowserAvatarTree(input: {
    avatarNickname: string;
    workspacePath: string;
    name: string;
    path?: string;
    offset?: number;
    limit?: number;
  }) {
    return listSkillBrowserAvatarTree({
      avatarNickname: normalizeAvatarNickname(input.avatarNickname),
      workspacePath: toWorkspacePath(input.workspacePath),
      workspacePaths: this.workspaces.list(),
      homeDir: this.getHomeDir(),
      name: input.name,
      path: input.path,
      offset: input.offset,
      limit: input.limit,
    });
  }

  readSkillBrowserAvatarPreview(input: {
    avatarNickname: string;
    workspacePath: string;
    name: string;
    path: string;
    maxBytes?: number;
  }) {
    return readSkillBrowserAvatarPreview({
      avatarNickname: normalizeAvatarNickname(input.avatarNickname),
      workspacePath: toWorkspacePath(input.workspacePath),
      workspacePaths: this.workspaces.list(),
      homeDir: this.getHomeDir(),
      name: input.name,
      path: input.path,
      maxBytes: input.maxBytes,
    });
  }

  listWorkspaceWorkbenchTree(input: {
    workspacePath: string;
    avatar: string;
    mode: WorkspaceWorkbenchMode;
    path?: string;
    offset?: number;
    limit?: number;
  }) {
    const workspacePath = toWorkspacePath(input.workspacePath);
    const avatar = normalizeAvatarNickname(input.avatar);
    const runtimeId = resolveAvatarSessionId(avatar);
    const grants =
      input.mode === "explorer"
        ? this.workspaceSystem.listRuntimeWorkspaceGrants({
            runtimeId,
            workspacePath,
          })
        : [];
    return listWorkspaceWorkbenchTree({
      workspacePath,
      avatar,
      mode: input.mode,
      path: input.path,
      offset: input.offset,
      limit: input.limit,
      grants,
    });
  }

  readWorkspaceWorkbenchPreview(input: {
    workspacePath: string;
    avatar: string;
    mode: WorkspaceWorkbenchMode;
    path: string;
    maxBytes?: number;
  }) {
    const workspacePath = toWorkspacePath(input.workspacePath);
    const avatar = normalizeAvatarNickname(input.avatar);
    const runtimeId = resolveAvatarSessionId(avatar);
    const grants =
      input.mode === "explorer"
        ? this.workspaceSystem.listRuntimeWorkspaceGrants({
            runtimeId,
            workspacePath,
          })
        : [];
    return readWorkspaceWorkbenchPreview({
      workspacePath,
      avatar,
      mode: input.mode,
      path: input.path,
      maxBytes: input.maxBytes,
      grants,
    });
  }

  async readWorkspaceCliCatalog(input: { workspacePath: string; avatar: string }) {
    return await buildWorkspaceCliCommandCatalog({
      workspacePath: toWorkspacePath(input.workspacePath),
      avatar: normalizeAvatarNickname(input.avatar),
      perspective: "browser",
    });
  }

  createWorkspacePrivateAsset(input: {
    workspacePath: string;
    avatar: string;
    parentPath?: string;
    name: string;
    kind: "file" | "directory";
  }) {
    return createWorkspacePrivateAsset({
      workspacePath: toWorkspacePath(input.workspacePath),
      avatar: normalizeAvatarNickname(input.avatar),
      parentPath: input.parentPath,
      name: input.name,
      kind: input.kind,
    });
  }

  ensureWorkspacePrivateTextAsset(input: AppPrivateTextAssetEnsureInput) {
    return ensureWorkspacePrivateTextAsset({
      workspacePath: toWorkspacePath(input.workspacePath),
      avatar: normalizeAvatarNickname(input.avatarNickname),
      assetKind: input.assetKind,
      relativePath: input.relativePath,
      seedContent: input.seedContent,
    });
  }

  async ensureAvatarPromptSeed(input: AppAvatarPromptSeedInput): Promise<{
    seeded: boolean;
    file: { path: string; content: string; mtimeMs: number };
  }> {
    const promptPath = this.resolveAvatarPromptSeedPath(input);
    try {
      const [content, fileStat] = await Promise.all([readFile(promptPath, "utf8"), stat(promptPath)]);
      if (fileStat.isDirectory()) {
        throw new Error(`avatar prompt path is a directory: ${promptPath}`);
      }
      // File truth: non-default avatars become user-owned once their canonical
      // AGENTER.mdx exists. Later startup or package upgrades must treat that
      // file as the durable source of truth and must not overwrite it.
      return {
        seeded: false,
        file: {
          path: promptPath,
          content,
          mtimeMs: fileStat.mtimeMs,
        },
      };
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
    }

    await mkdir(resolve(promptPath, ".."), { recursive: true });
    await writeFile(promptPath, input.seedContent, "utf8");
    const [content, fileStat] = await Promise.all([readFile(promptPath, "utf8"), stat(promptPath)]);
    return {
      seeded: true,
      file: {
        path: promptPath,
        content,
        mtimeMs: fileStat.mtimeMs,
      },
    };
  }

  async execRuntimeWorkspace(input: {
    runtimeId: string;
    workspacePath: string;
    avatar: string;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
    surface?: CliCommandExecutionSurface;
  }) {
    const resolveExecFailure = (message: string, cwd: string): WorkspaceBashExecResult => ({
      stdout: "",
      stderr: `${message}\n`,
      exitCode: 1,
      cwd,
    });
    const explicitCwd =
      typeof input.cwd === "string" && input.cwd.trim().length > 0
        ? resolveWorkspaceFsPath(input.cwd, this.getHomeDir())
        : undefined;
    const fallbackCwd = explicitCwd ?? toWorkspaceCwd(input.workspacePath, this.getHomeDir());

    if (input.surface === "root-workspace") {
      const runtime = this.runtimes.get(input.runtimeId);
      if (!runtime) {
        return resolveExecFailure(`runtime not active for root-workspace exec: ${input.runtimeId}`, fallbackCwd);
      }
      return await runtime.execRootWorkspaceBash({
        command: input.command,
        cwd: explicitCwd,
        env: input.env,
        stdin: input.stdin,
      });
    }
    const workspacePath = toWorkspacePath(input.workspacePath);
    const workspaceRoot = toWorkspaceCwd(workspacePath, this.getHomeDir());
    const grants = this.workspaceSystem.listRuntimeWorkspaceGrants({
      runtimeId: input.runtimeId,
      workspacePath,
    });
    if (grants.length === 0) {
      return resolveExecFailure(
        `workspace grants missing for runtime ${input.runtimeId} on ${workspacePath}`,
        fallbackCwd,
      );
    }
    if (
      explicitCwd &&
      resolveWorkspaceGrantModeFromAbsolutePath({
        workspaceRoot,
        absolutePath: explicitCwd,
        grants,
        partial: true,
      }) === "none"
    ) {
      return resolveExecFailure(`workspace cwd is outside explicit grants: ${explicitCwd}`, explicitCwd);
    }
    return await executeWorkspaceBash({
      workspacePath,
      avatar: input.avatar,
      command: input.command,
      cwd: explicitCwd,
      env: input.env,
      stdin: input.stdin,
      grants,
    });
  }

  async forkWorkspaceAvatar(input: { workspacePath: string; avatar: string }): Promise<WorkspaceAvatarCatalogEntry> {
    const workspacePath = toWorkspacePath(input.workspacePath);
    this.rememberWorkspace(workspacePath);
    const projected = forkAvatarIntoWorkspace({
      workspacePath,
      nickname: input.avatar,
    });
    this.queueAvatarCatalogInvalidation([workspacePath]);
    return (
      (await this.listWorkspaceAvatarCatalog(workspacePath)).find((entry) => entry.nickname === projected.nickname) ??
      projected
    );
  }

  async copyWorkspaceAvatar(input: {
    workspacePath: string;
    sourceAvatar: string;
    targetAvatar: string;
  }): Promise<WorkspaceAvatarCatalogEntry> {
    const workspacePath = toWorkspacePath(input.workspacePath);
    this.rememberWorkspace(workspacePath);
    const projected = copyAvatarIntoWorkspace({
      workspacePath,
      sourceNickname: input.sourceAvatar,
      targetNickname: input.targetAvatar,
    });
    this.queueAvatarCatalogInvalidation([workspacePath]);
    return (
      (await this.listWorkspaceAvatarCatalog(workspacePath)).find((entry) => entry.nickname === projected.nickname) ??
      projected
    );
  }

  async inspectWorkspaceWelcome(input: {
    workspacePath: string;
    avatar?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
    terminalActorId?: TerminalActorId;
    superadminTerminalActorId?: TerminalActorId;
  }): Promise<WorkspaceWelcomeSnapshot> {
    const workspacePath = toWorkspacePath(input.workspacePath);
    const avatar = normalizeAvatarNickname(input.avatar ?? defaultAvatarNickname());
    const sessionId = resolveAvatarSessionId(avatar);
    const avatarPrincipal = ensureAvatarSeatPrincipal({
      workspacePath,
      avatar,
      homeDir: this.getHomeDir(),
    });
    const sessionRoomActorId = avatarPrincipal.principalId as MessageContactId;
    const sessionTerminalActorId = avatarPrincipal.principalId as TerminalActorId;
    const seatDoc = readAvatarSeatDocument(workspacePath, avatar, this.getHomeDir());

    const accessibleRoomIds = new Set(
      this.messageControlPlane
        .listChannelsForContact(sessionRoomActorId, {
          includeArchived: true,
          touchPresence: false,
        })
        .map((channel) => channel.chatId),
    );
    const accessibleTerminalIds = new Set(
      this.terminalControlPlane
        .listForActor(sessionTerminalActorId, {
          touchPresence: false,
        })
        .map((terminal) => terminal.terminalId),
    );

    const rooms = this.listGlobalRooms({
      actorId: input.actorId,
      superadminContactId: input.superadminContactId,
      includeArchived: true,
    }).map((channel) => {
      const seat = seatDoc.messageSeats[channel.chatId];
      const access = resolveWelcomeAccessState(accessibleRoomIds.has(channel.chatId) || Boolean(seat?.endpoint), seat);
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
      const access = resolveWelcomeAccessState(
        accessibleTerminalIds.has(terminal.terminalId) || Boolean(seat?.endpoint),
        seat,
      );
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
      avatars: await this.listWorkspaceAvatarCatalog(workspacePath),
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
    saveAvatarMessageSeatCredential({
      ...input,
      homeDir: this.getHomeDir(),
    });
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
    saveAvatarTerminalSeatCredential({
      ...input,
      homeDir: this.getHomeDir(),
    });
    return { ok: true };
  }

  private ensureRuntimeAvatarRootWorkspace(input: { runtimeId: string; avatarPrincipalId: string }): string {
    const rootWorkspacePath = resolveGlobalAvatarCanonicalRoot(input.avatarPrincipalId, this.getHomeDir());
    mkdirSync(rootWorkspacePath, { recursive: true });
    for (const directory of ["skills", "memories", "tools", "tmp"]) {
      mkdirSync(join(rootWorkspacePath, directory), { recursive: true });
    }
    this.workspaceSystem.attachRuntime({
      runtimeId: input.runtimeId,
      workspacePath: rootWorkspacePath,
      kind: "avatar-root",
      env: {
        [AVATAR_HOME_ENV]: serializeEnvAvatarHome([rootWorkspacePath]),
      },
    });
    const grants = this.workspaceSystem.listRuntimeWorkspaceGrants({
      runtimeId: input.runtimeId,
      workspacePath: rootWorkspacePath,
    });
    if (grants.length === 0) {
      this.workspaceSystem.setRuntimeWorkspaceGrants({
        runtimeId: input.runtimeId,
        workspacePath: rootWorkspacePath,
        kind: "avatar-root",
        grants: [{ pattern: "/", mode: "rw" }],
      });
    }
    return rootWorkspacePath;
  }

  private buildInheritedWorkspaceInstanceEnv(runtimeId: string): Record<string, string> {
    const avatarRootMount = this.workspaceSystem
      .listRuntimeMounts(runtimeId)
      .find((mount) => mount.kind === "avatar-root");
    if (!avatarRootMount) {
      return {};
    }
    const avatarHome = this.workspaceSystem.getRuntimeWorkspaceAvatarHome({
      runtimeId,
      runtimeWorkspaceId: avatarRootMount.runtimeWorkspaceId,
    });
    const inheritedAvatarHome = avatarHome.length > 0 ? avatarHome : [avatarRootMount.workspacePath];
    return {
      [AVATAR_HOME_ENV]: serializeEnvAvatarHome(inheritedAvatarHome),
    };
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
    const workspaceSessions = this.sessions.list().filter((session) => {
      const mountedPaths = this.workspaceSystem.listRuntimeMounts(session.id).map((mount) => mount.workspacePath);
      if (mountedPaths.length === 0) {
        return session.workspacePath === workspacePath;
      }
      return mountedPaths.includes(workspacePath);
    });
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

  listChatMessages(sessionId: string, afterId = 0, limit = 200): PersistedChatMessage[] {
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

  pageHeartbeatParts(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionMessageRecord> {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
    }
    return this.readHeartbeatPartsPageFromDb(session.sessionRoot, input);
  }

  pageHeartbeatGroups(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<RuntimeHeartbeatGroupRecord> {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
    }
    return this.readHeartbeatGroupsPageFromDb(session.sessionRoot, input);
  }

  pageHeartbeatRecords(sessionId: string, input: HeartbeatRecordPageInput): HeartbeatRecordPage {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyHeartbeatRecordPage(input);
    }
    return this.readHeartbeatRecordsPageFromDb(session.sessionRoot, input);
  }

  getHeartbeatRecordDetail(sessionId: string, recordId: number): HeartbeatRecordDetail | null {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return this.readHeartbeatRecordDetailFromDb(session.sessionRoot, recordId);
  }

  pageRequestAuxMessages(
    sessionId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionMessageRecord> {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
    }
    return this.readRequestAuxPageFromDb(session.sessionRoot, input);
  }

  listChatMessagesBefore(sessionId: string, beforeId: number, limit = 200): PersistedChatMessage[] {
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

  pageChatCycles(sessionId: string, input?: { before?: ReverseTimeCursor; limit?: number }): ReversePage<ChatCycle> {
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

  private ensureRuntimeWorkspaceAccess(runtimeId: string, workspacePath: string): void {
    this.workspaceSystem.attachRuntime({
      runtimeId,
      workspacePath,
    });
    const grants = this.workspaceSystem.listRuntimeWorkspaceGrants({
      runtimeId,
      workspacePath,
    });
    if (grants.length === 0) {
      this.workspaceSystem.setRuntimeWorkspaceGrants({
        runtimeId,
        workspacePath,
        grants: [{ pattern: "/", mode: "rw" }],
      });
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
    const config = await resolveSessionConfig(cwd, {
      avatar: input.avatar,
      homeDir: this.getHomeDir(),
    });
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

    const resolved = await resolveSessionConfig(workspace.cwd, {
      avatar: input.avatar,
      homeDir: this.getHomeDir(),
    });
    const workspacePath = workspace.workspacePath;
    const avatarPrincipal = await this.ensureRuntimeAvatarPrincipal(resolved.avatar.nickname);
    this.rememberWorkspace(workspacePath);
    const existing = this.sessions.findByAvatar(resolved.avatar.nickname);
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
      const updated = renamed;
      await this.syncSessionIconSeed(updated);
      this.repairLegacySessionMessageActors([updated]);
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
    await this.syncSessionIconSeed(session);
    this.repairLegacySessionMessageActors([session]);
    this.emit("session.updated", { session }, session.id);

    if (input.autoStart === false) {
      return session;
    }

    return await this.startSession(session.id);
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
      this.emit("notification.updated", { snapshot: await this.buildNotificationSnapshot() }, sessionId);
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
    this.emit("notification.updated", { snapshot: await this.buildNotificationSnapshot() }, sessionId);
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
    const meta = await this.bindSessionAvatarPrincipal(existingMeta);
    if (!meta.avatarPrincipalId) {
      throw new Error(`session avatar principal missing: ${meta.id}`);
    }
    const avatarPrincipal = await this.revealRuntimeAvatarPrincipal(meta.avatarPrincipalId);
    const rootWorkspacePath = this.ensureRuntimeAvatarRootWorkspace({
      runtimeId: meta.id,
      avatarPrincipalId: meta.avatarPrincipalId,
    });

    this.rememberWorkspace(meta.workspacePath);
    this.repairLegacySessionMessageActors([meta]);

    const existing = this.runtimes.get(sessionId);
    if (existing?.isStarted()) {
      existing.resume();
      existing.setSessionStatus("running");
      const running = this.sessions.update(sessionId, { status: "running", lastError: undefined });
      this.emit("session.updated", { session: running }, sessionId);
      return running;
    }

    this.sessions.update(sessionId, { status: "starting", lastError: undefined });
    // Session bootstrap anchors attention/workspace truth only.
    // Message and terminal routing rehydrate later from explicit external-system facts.
    const runtime = new SessionRuntime({
      sessionId: meta.id,
      cwd: meta.cwd,
      workspacePath: meta.workspacePath,
      avatar: meta.avatar,
      sessionRoot: meta.sessionRoot,
      sessionName: meta.name,
      storeTarget: meta.storeTarget,
      avatarPrincipalId: meta.avatarPrincipalId,
      avatarPrivateKey: avatarPrincipal.privateKey,
      homeDir: this.getHomeDir(),
      rootWorkspacePath,
      managedSeatAuthorityUrl: this.getManagedSeatAuthorityUrl() ?? undefined,
      usageAnalyticsRoot: resolveGlobalAvatarCanonicalRoot(meta.avatarPrincipalId, this.getHomeDir()),
      listRuntimeWorkspaceAuthorities: () => this.listRuntimeWorkspaceAuthorities(meta.id),
      setRuntimeWorkspaceAlias: (input) =>
        this.setRuntimeWorkspaceAlias({
          runtimeId: meta.id,
          runtimeWorkspaceId: input.runtimeWorkspaceId,
          alias: input.alias,
        }),
      messageSystem: this.messageControlPlane,
      messageContactId: this.resolveSessionMessageContactId(meta),
      terminalSystem: this.terminalControlPlane,
      terminalActorId: this.resolveSessionTerminalActorId(meta),
      resolveRuntimeTerminalCwd: async (input) =>
        this.resolveRuntimeTerminalCwd({
          runtimeId: meta.id,
          cwd: input.cwd,
        }),
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
      await runtime.abort();
      this.detachRuntime(sessionId);
    }
    const stopped = this.sessions.update(sessionId, { status: "stopped", lastError: undefined });
    this.emit("notification.updated", { snapshot: await this.buildNotificationSnapshot() }, sessionId);
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
    this.emit("notification.updated", { snapshot: await this.buildNotificationSnapshot() }, sessionId);
    this.emit("session.updated", { session: stopped }, sessionId);
    return stopped;
  }

  async focusTerminal(sessionId: string, terminalId: string): Promise<{ ok: boolean }> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    const ok = await runtime.focusTerminal(terminalId);
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
    const session = existingSession;
    return this.messageControlPlane.listChannelsForContact(this.resolveSessionMessageContactId(session), {
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

  async focusMessageChannels(input: {
    sessionId: string;
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken: string }>;
  }): Promise<MessageControlPlaneEntry[]> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return await runtime.focusMessageChannels({ op: input.op, channels: input.channels });
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

  async archiveMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    archivedBy?: string;
  }): Promise<MessageControlPlaneEntry> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return await runtime.archiveMessageChannel({
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

  listMessageChannelGrants(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }): MessageChannelGrantRecord[] {
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

  revokeMessageChannelGrant(input: { sessionId: string; chatId: string; accessToken: string; grantId: string }): {
    ok: boolean;
  } {
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

  listMessageSourceSubscriptions(input: { actorId: MessageContactId }): MessageSourceSubscriptionRecord[] {
    return this.messageControlPlane.listSourceSubscriptions(input.actorId);
  }

  saveMessageSourceSubscription(
    input: {
      actorId: MessageContactId;
    } & MessageSourceSubscriptionInput,
  ): MessageSourceSubscriptionRecord {
    return this.messageControlPlane.upsertSourceSubscription({
      ownerContactId: input.actorId,
      sourceId: input.sourceId,
      label: input.label,
      endpoint: normalizeRemoteEndpoint(input.endpoint),
      authToken: input.authToken,
      callbackSourceId: input.callbackSourceId,
      callbackEndpoint: input.callbackEndpoint ? normalizeRemoteEndpoint(input.callbackEndpoint) : undefined,
      metadata: input.metadata,
    });
  }

  deleteMessageSourceSubscription(input: { actorId: MessageContactId; sourceId: string }): { ok: boolean } {
    return this.messageControlPlane.deleteSourceSubscription({
      ownerContactId: input.actorId,
      sourceId: input.sourceId,
    });
  }

  listMessageContacts(input: { actorId: MessageContactId }): MessageContactRecord[] {
    return this.messageControlPlane.listContacts(input.actorId);
  }

  listMessageContactRequests(input: {
    actorId: MessageContactId;
    direction?: "inbound" | "outbound";
    state?: "pending" | "accepted" | "rejected" | "revoked" | "expired" | "superseded";
  }): MessageContactRequestRecord[] {
    return this.messageControlPlane.listContactRequests(input.actorId, {
      direction: input.direction,
      state: input.state,
    });
  }

  async searchMessageSourceActors(input: { actorId: MessageContactId; sourceId: string; query?: string }): Promise<
    Array<
      RemoteMessageSourceCatalogItem & {
        sourceId: string;
        sourceLabel: string;
        sourceEndpoint: string;
      }
    >
  > {
    const source = this.requireMessageSourceSubscription(input.actorId, input.sourceId);
    const client = createRemoteMessageSourceClient({
      endpoint: source.endpoint,
      authToken: source.authToken,
    });
    const items = await client.searchAuthCatalog({
      query: input.query?.trim() || undefined,
    });
    return items.map((item) => ({
      ...item,
      sourceId: source.sourceId,
      sourceLabel: source.label,
      sourceEndpoint: source.endpoint,
    }));
  }

  async sendMessageContactRequest(input: {
    actorId: MessageContactId;
    sourceId: string;
    remoteContactId: MessageContactId;
    message?: string;
    expiresAt?: number;
  }): Promise<MessageContactRequestRecord> {
    const source = this.requireMessageSourceSubscription(input.actorId, input.sourceId);
    const localActor = await this.resolveMessageActorDirectoryProjection(input.actorId);
    const remoteActor = await this.resolveRemoteMessageActorProjection(source, input.remoteContactId);
    const request = this.messageControlPlane.createContactRequest({
      ownerContactId: input.actorId,
      direction: "outbound",
      sourceId: source.sourceId,
      remoteContactId: input.remoteContactId,
      remoteLabel: remoteActor.label,
      remoteSubtitle: remoteActor.subtitle,
      remoteIconUrl: remoteActor.iconUrl,
      message: input.message,
      callbackSourceId: source.callbackSourceId,
      callbackEndpoint: source.callbackEndpoint,
      expiresAt: input.expiresAt,
    });
    const client = createRemoteMessageSourceClient({
      endpoint: source.endpoint,
      authToken: source.authToken,
    });
    await client.receiveContactRequest({
      requestId: request.requestId,
      sourceId: source.callbackSourceId ?? source.sourceId,
      remoteContactId: input.actorId,
      remoteLabel: localActor.label,
      remoteSubtitle: localActor.subtitle,
      remoteIconUrl: localActor.iconUrl,
      message: input.message,
      callbackEndpoint: source.callbackEndpoint,
      expiresAt: request.expiresAt,
    });
    return request;
  }

  receiveMessageContactRequest(input: {
    actorId: MessageContactId;
    requestId: string;
    sourceId: string;
    remoteContactId: MessageContactId;
    remoteLabel?: string;
    remoteSubtitle?: string;
    remoteIconUrl?: string;
    message?: string;
    callbackEndpoint?: string;
    expiresAt?: number;
  }): MessageContactRequestRecord {
    return this.messageControlPlane.createContactRequest({
      ownerContactId: input.actorId,
      requestId: input.requestId,
      direction: "inbound",
      sourceId: input.sourceId,
      remoteContactId: input.remoteContactId,
      remoteLabel: input.remoteLabel,
      remoteSubtitle: input.remoteSubtitle,
      remoteIconUrl: input.remoteIconUrl,
      message: input.message,
      callbackEndpoint: input.callbackEndpoint,
      expiresAt: input.expiresAt,
    });
  }

  async acceptMessageContactRequest(input: {
    actorId: MessageContactId;
    requestId: string;
    firstChat?: string;
  }): Promise<{
    request: MessageContactRequestRecord;
    contact: MessageContactRecord;
    localDirectChatId?: string;
    remoteDirectChatId?: string;
  }> {
    const pending = this.requirePendingMessageContactRequest(input.actorId, input.requestId);
    const responseSource = this.requireResponseSourceSubscription(input.actorId, pending);
    let localDirectRoom: PublicRoomEntry | null = null;
    if (input.firstChat?.trim()) {
      localDirectRoom = await this.createLocalDirectContactRoom({
        actorId: input.actorId,
        sourceId: pending.sourceId,
        remoteContactId: pending.remoteContactId,
        remoteLabel: pending.remoteLabel,
      });
    }
    const acceptedLocal = this.messageControlPlane.acceptContactRequest({
      ownerContactId: input.actorId,
      requestId: input.requestId,
      label: pending.remoteLabel,
      subtitle: pending.remoteSubtitle,
      iconUrl: pending.remoteIconUrl,
      localDirectChatId: localDirectRoom?.chatId,
    });
    const localActor = await this.resolveMessageActorDirectoryProjection(input.actorId);
    const client = createRemoteMessageSourceClient({
      endpoint: responseSource.endpoint,
      authToken: responseSource.authToken,
    });
    const remoteAccepted = await client.acceptContactRequestRemote({
      requestId: input.requestId,
      remoteContactId: input.actorId,
      remoteLabel: localActor.label,
      remoteSubtitle: localActor.subtitle,
      remoteIconUrl: localActor.iconUrl,
      firstChat: input.firstChat?.trim() || undefined,
      remoteDirectChatId: localDirectRoom?.chatId,
    });
    if (localDirectRoom && remoteAccepted.localDirectChatId && input.firstChat?.trim()) {
      localDirectRoom = this.patchDirectRoomPairing({
        actorId: input.actorId,
        chatId: localDirectRoom.chatId,
        remoteDirectChatId: remoteAccepted.localDirectChatId,
      });
      this.appendDirectBootstrapMessage(localDirectRoom.chatId, input.actorId, input.firstChat.trim());
      this.messageControlPlane.upsertContact({
        ownerContactId: input.actorId,
        sourceId: pending.sourceId,
        remoteContactId: pending.remoteContactId,
        label: acceptedLocal.contact.label,
        subtitle: acceptedLocal.contact.subtitle,
        iconUrl: acceptedLocal.contact.iconUrl,
        localDirectChatId: localDirectRoom.chatId,
        remoteDirectChatId: remoteAccepted.localDirectChatId,
      });
    }
    return {
      request: this.messageControlPlane.getContactRequest(input.actorId, input.requestId) ?? acceptedLocal.request,
      contact:
        this.messageControlPlane.getContact(input.actorId, pending.sourceId, pending.remoteContactId) ??
        acceptedLocal.contact,
      localDirectChatId: localDirectRoom?.chatId,
      remoteDirectChatId: remoteAccepted.localDirectChatId ?? undefined,
    };
  }

  async acceptContactRequestRemote(input: {
    actorId: MessageContactId;
    requestId: string;
    remoteContactId: MessageContactId;
    remoteLabel?: string;
    remoteSubtitle?: string;
    remoteIconUrl?: string;
    firstChat?: string;
    remoteDirectChatId?: string;
  }): Promise<{
    request: MessageContactRequestRecord;
    contact: MessageContactRecord;
    localDirectChatId?: string;
  }> {
    const pending = this.requirePendingMessageContactRequest(input.actorId, input.requestId);
    let localDirectRoom: PublicRoomEntry | null = null;
    if (input.firstChat?.trim()) {
      localDirectRoom = await this.createLocalDirectContactRoom({
        actorId: input.actorId,
        sourceId: pending.sourceId,
        remoteContactId: input.remoteContactId,
        remoteLabel: input.remoteLabel,
        remoteDirectChatId: input.remoteDirectChatId,
      });
    }
    const accepted = this.messageControlPlane.acceptContactRequest({
      ownerContactId: input.actorId,
      requestId: input.requestId,
      label: input.remoteLabel,
      subtitle: input.remoteSubtitle,
      iconUrl: input.remoteIconUrl,
      localDirectChatId: localDirectRoom?.chatId,
      remoteDirectChatId: input.remoteDirectChatId,
    });
    if (localDirectRoom && input.firstChat?.trim()) {
      this.appendDirectBootstrapMessage(localDirectRoom.chatId, input.remoteContactId, input.firstChat.trim());
    }
    return {
      request: accepted.request,
      contact:
        this.messageControlPlane.getContact(input.actorId, pending.sourceId, input.remoteContactId) ?? accepted.contact,
      localDirectChatId: localDirectRoom?.chatId,
    };
  }

  async inviteAdditionalParticipantFromGlobalRoom(input: {
    actorId: MessageContactId;
    chatId: string;
    invitedContactId: MessageContactId;
    invitedLabel?: string;
  }): Promise<PublicRoomEntry> {
    const room = this.resolveGlobalRoomProjection({
      chatId: input.chatId,
      actorId: input.actorId,
      includeArchived: false,
    });
    if (readRoomMode(room.metadata) === "direct") {
      return await this.createGlobalRoom({
        actorId: input.actorId,
        title: room.title,
        participants: [
          ...room.participants,
          input.invitedLabel
            ? { id: input.invitedContactId, label: input.invitedLabel }
            : { id: input.invitedContactId },
        ],
        metadata: {
          roomMode: "public",
          createdFromDirectRoomId: room.chatId,
        },
      });
    }
    return this.updateGlobalRoom({
      actorId: input.actorId,
      chatId: input.chatId,
      patch: {
        participants: [
          ...room.participants.filter((participant) => participant.id !== input.invitedContactId),
          input.invitedLabel
            ? { id: input.invitedContactId, label: input.invitedLabel }
            : { id: input.invitedContactId },
        ],
      },
    });
  }

  listGlobalRooms(
    input: {
      actorId?: MessageContactId;
      superadminContactId?: MessageContactId;
      includeArchived?: boolean;
    } = {},
  ): PublicRoomEntry[] {
    if (input.actorId && !input.superadminContactId) {
      return this.messageControlPlane
        .listChannelsForContact(input.actorId, {
          includeArchived: input.includeArchived,
          touchPresence: false,
        })
        .filter(isStandaloneMessageRoomEntry)
        .map(projectPublicRoomEntry);
    }
    return this.messageControlPlane
      .listChannels({
        includeArchived: input.includeArchived,
      })
      .filter(isStandaloneMessageRoomEntry)
      .map(projectPublicRoomEntry);
  }

  async createGlobalRoom(input: {
    chatId?: string;
    title?: string;
    participants?: Array<{
      id: string;
      label?: string;
    }>;
    initialUsers?: Array<{
      contactId: MessageContactId;
      label?: string;
      role: MessageChannelAccessRole;
      focused?: boolean;
    }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): Promise<PublicRoomEntry> {
    const shouldFocus = input.focus ?? true;
    const creatorContactId = input.actorId ?? input.superadminContactId;
    const initialUsers =
      creatorContactId || input.initialUsers?.length
        ? [
            ...(creatorContactId
              ? [
                  {
                    contactId: creatorContactId,
                    label: input.initialUsers?.find((user) => user.contactId === creatorContactId)?.label,
                    role: "admin" as const,
                    focused:
                      shouldFocus ||
                      input.initialUsers?.find((user) => user.contactId === creatorContactId)?.focused === true,
                  },
                ]
              : []),
            ...(input.initialUsers?.filter((user) => user.contactId !== creatorContactId) ?? []),
          ]
        : undefined;
    const room = this.messageControlPlane.createChannel({
      chatId: input.chatId ?? (await this.allocateGlobalRoomId(input.title)),
      kind: "room",
      title: input.title ?? DEFAULT_MESSAGE_CHAT_TITLE,
      participants: input.participants,
      initialUsers,
      metadata: sanitizeGlobalRoomMetadata(input.metadata),
      adminToken: input.adminToken,
      bootstrapContactId: input.actorId && !input.superadminContactId ? input.actorId : undefined,
    });
    if (input.actorId && !input.superadminContactId) {
      if (!shouldFocus) {
        this.messageControlPlane.focusForContact(input.actorId, "remove", [room.chatId]);
      }
      return projectPublicRoomEntry(
        this.resolveGlobalRoomProjection({
          chatId: room.chatId,
          actorId: input.actorId,
          includeArchived: true,
        }),
      );
    }
    return projectPublicRoomEntry(
      this.resolveGlobalRoomProjection({
        chatId: room.chatId,
        superadminContactId: input.superadminContactId,
        includeArchived: true,
      }),
    );
  }

  markGlobalRoomRead(input: {
    chatId: string;
    messageId?: number;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): PublicRoomEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return projectPublicRoomEntry(
      this.messageControlPlane.markChannelReadAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        messageId: input.messageId,
      }),
    );
  }

  focusGlobalRooms(input: {
    op: MessageFocusOp;
    channels: Array<{ chatId: string; accessToken?: string }>;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): { ok: boolean; message: string; focusedChatIds: string[] } {
    const focusedChatIds =
      input.channels.length > 0 &&
      input.channels.every((channel) => typeof channel.accessToken === "string" && channel.accessToken.length > 0)
        ? this.messageControlPlane.focusAuthorized(
            input.op,
            input.channels.map((channel) => ({
              chatId: channel.chatId,
              accessToken: channel.accessToken!,
            })),
          )
        : input.actorId && !input.superadminContactId
          ? this.messageControlPlane.focusForContact(
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

  pageGlobalRoomMessages(input: {
    chatId: string;
    before?: ReverseTimeCursor | null;
    limit?: number;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): PublicRoomPage {
    const access = this.resolveGlobalRoomAccess(input);
    return projectPublicRoomPage(
      this.messageControlPlane.queryMessagesAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        before: input.before,
        limit: input.limit,
      }),
    );
  }

  snapshotGlobalRoom(input: {
    chatId: string;
    limit?: number;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): PublicRoomSnapshot {
    const access = this.resolveGlobalRoomAccess(input);
    return projectPublicRoomSnapshot(
      this.messageControlPlane.snapshotAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        limit: input.limit,
      }),
    );
  }

  queryGlobalRoomMessages(input: {
    chatId: MessageQueryRequest["chatId"];
    mode: MessageQueryRequest["mode"];
    query: string;
    offset?: number;
    limit?: number;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): PublicRoomMessageQueryResult {
    return this.messageControlPlane.queryAuthorized({
      chatId: input.chatId,
      mode: input.mode,
      query: input.query,
      offset: input.offset,
      limit: input.limit,
      contactId: input.actorId,
      superadminContactId: input.superadminContactId,
    });
  }

  sendGlobalRoomMessage(input: {
    chatId: string;
    text: string;
    assetIds?: string[];
    attachments?: ChatSessionAsset[];
    clientMessageId?: string;
    metadata?: Record<string, unknown>;
    accessToken?: string;
    sendAsActorId?: MessageContactId;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): { ok: boolean; reason?: string } {
    try {
      const access = this.resolveGlobalRoomAccess(input);
      const attachments = input.attachments ?? this.resolveGlobalRoomAttachments(input.chatId, input.assetIds ?? []);
      this.messageControlPlane.sendAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        kind: "text",
        content: input.text,
        clientMessageId: input.clientMessageId,
        senderContactId: this.resolveGlobalRoomSenderActorId(input, access),
        attachments,
        metadata: {
          ...(input.metadata ?? {}),
          ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
        },
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "message send failed",
      };
    }
  }

  editGlobalRoomMessage(input: {
    chatId: string;
    messageId: number;
    text: string;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): { ok: boolean; reason?: string; messageId?: number; updatedAt?: number } {
    try {
      const access = this.resolveGlobalRoomAccess(input);
      const message = this.messageControlPlane.editAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        messageId: input.messageId,
        content: input.text,
      });
      return {
        ok: true,
        messageId: message.messageId,
        updatedAt: message.updatedAt,
      };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "message edit failed",
      };
    }
  }

  recallGlobalRoomMessage(input: {
    chatId: string;
    messageId: number;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): { ok: boolean; reason?: string; messageId?: number; updatedAt?: number; recalledAt?: number } {
    try {
      const access = this.resolveGlobalRoomAccess(input);
      const message = this.messageControlPlane.recallAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        messageId: input.messageId,
      });
      return {
        ok: true,
        messageId: message.messageId,
        updatedAt: message.updatedAt,
        recalledAt: message.recalledAt,
      };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "message recall failed",
      };
    }
  }

  updateGlobalRoom(input: {
    chatId: string;
    patch: MessageChannelPatchInput;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): PublicRoomEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return projectPublicRoomEntry(
      this.messageControlPlane.updateChannelAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        superadminContactId: input.superadminContactId,
        patch: {
          ...input.patch,
          metadata: sanitizeGlobalRoomMetadata(input.patch.metadata),
        },
      }),
    );
  }

  async archiveGlobalRoom(input: {
    chatId: string;
    archivedBy?: string;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): Promise<PublicRoomEntry> {
    const access = this.resolveGlobalRoomAccess(input);
    const archived = this.messageControlPlane.archiveChannelAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminContactId: input.superadminContactId,
      archivedBy: input.archivedBy ?? access.room.owner,
    });
    await this.notifyRuntimesOfArchivedRoom(archived.chatId);
    return projectPublicRoomEntry(archived);
  }

  private async notifyRuntimesOfArchivedRoom(chatId: string): Promise<void> {
    await Promise.all(
      [...this.runtimes.values()].map(async (runtime) => {
        await runtime.handleArchivedMessageChannelLifecycle({ chatId });
      }),
    );
  }

  deleteGlobalRoom(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): PublicRoomEntry {
    const access = this.resolveGlobalRoomAccess(input);
    return projectPublicRoomEntry(
      this.messageControlPlane.deleteChannelAuthorized({
        chatId: input.chatId,
        accessToken: access.accessToken,
        superadminContactId: input.superadminContactId,
      }),
    );
  }

  listGlobalRoomGrants(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): MessageChannelGrantRecord[] {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.listChannelGrantsAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminContactId: input.superadminContactId,
    });
  }

  issueGlobalRoomGrant(
    input: {
      chatId: string;
      accessToken?: string;
      actorId?: MessageContactId;
      superadminContactId?: MessageContactId;
    } & MessageIssueGrantInput,
  ): MessageIssuedGrant {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.issueChannelGrantAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminContactId: input.superadminContactId,
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
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): { ok: boolean } {
    const access = this.resolveGlobalRoomAccess(input);
    return this.messageControlPlane.revokeChannelGrantAuthorized({
      chatId: input.chatId,
      accessToken: access.accessToken,
      superadminContactId: input.superadminContactId,
      grantId: input.grantId,
    });
  }

  inviteGlobalRoomSeat(input: {
    chatId: string;
    participantId: string;
    seatClass: MessageManagedSeatClass;
    label?: string;
    expiresAt?: number;
    endpoint?: { authorityUrl: string; trpcPath?: string; acceptPath?: string };
    accessToken?: string;
    superadminContactId?: MessageContactId;
  }): MessageInvitationRecord {
    if (!isPrincipalId(input.participantId)) {
      throw new Error("room managed seat participantId must be a principal id");
    }
    return this.messageControlPlane.inviteSeatAuthorized({
      ...input,
      participantId: input.participantId,
    });
  }

  prepareGlobalRoomSeatAccept(input: { descriptor: string }): {
    invitation: MessageInvitationRecord;
    proofInput: {
      invitationId: string;
      resourceKind: MessageInvitationRecord["resourceKind"];
      resourceId: string;
      inviteePrincipalId: MessageInvitationRecord["inviteePrincipalId"];
      payloadDigest: string;
      expiresAt: number;
    };
  } {
    return this.messageControlPlane.prepareSeatAccept(input);
  }

  async acceptGlobalRoomSeat(input: {
    descriptor: string;
    proof: {
      inviteePrincipalId: `0x${string}`;
      payload: string;
      signature: `0x${string}`;
    };
  }): Promise<{
    invitation: MessageInvitationRecord;
    access: MessageChannelAccessProjection;
    seat: MessageSeatStateProjection | undefined;
  }> {
    return await this.messageControlPlane.acceptSeat(input);
  }

  configGlobalRoomSeat(input: {
    chatId: string;
    participantId: string;
    seatClass: MessageManagedSeatClass;
    label?: string;
    expiresAt?: number;
    endpoint?: { authorityUrl: string; trpcPath?: string; acceptPath?: string };
    accessToken?: string;
    superadminContactId?: MessageContactId;
  }): MessageInvitationRecord | MessageChannelAccessProjection {
    if (!isPrincipalId(input.participantId)) {
      throw new Error("room managed seat participantId must be a principal id");
    }
    return this.messageControlPlane.configSeatAuthorized({
      ...input,
      participantId: input.participantId,
    });
  }

  revokeGlobalRoomSeat(input: {
    chatId: string;
    participantId: string;
    accessToken?: string;
    superadminContactId?: MessageContactId;
  }): { ok: true } {
    if (!isPrincipalId(input.participantId)) {
      throw new Error("room managed seat participantId must be a principal id");
    }
    return this.messageControlPlane.revokeSeatAuthorized({
      ...input,
      participantId: input.participantId,
    });
  }

  listGlobalTerminals(
    input: {
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } = {},
  ): TerminalControlPlaneEntry[] {
    if (input.superadminActorId || !input.actorId) {
      return this.terminalControlPlane.listForTrustedBootstrap();
    }
    return this.terminalControlPlane.listForActor(input.actorId, {
      touchPresence: false,
    });
  }

  listGlobalTerminalHistory(
    input: {
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } = {},
  ): TerminalControlPlaneEntry[] {
    if (input.superadminActorId || !input.actorId) {
      return this.terminalControlPlane.listHistory();
    }
    return this.terminalControlPlane.listHistoryForActor(input.actorId, {
      touchPresence: false,
    });
  }

  listGlobalTerminalIndex(
    input: {
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } = {},
  ): TerminalControlPlaneEntry[] {
    if (input.superadminActorId || !input.actorId) {
      return this.terminalControlPlane.listIndex();
    }
    return this.terminalControlPlane.listIndexForActor(input.actorId, {
      touchPresence: false,
    });
  }

  listGlobalTerminalArchive(
    input: {
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    } = {},
  ): TerminalControlPlaneEntry[] {
    if (input.superadminActorId || !input.actorId) {
      return this.terminalControlPlane.listArchived();
    }
    return this.terminalControlPlane.listArchivedForActor(input.actorId, {
      touchPresence: false,
    });
  }

  async createGlobalTerminal(input: {
    terminalId?: string;
    processKind?: string;
    backend?: TerminalBackendKind;
    command?: string[];
    cwd?: string;
    profile?: TerminalProcessProfile;
    metadata?: Record<string, unknown>;
    start?: boolean;
    focus?: boolean;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string; terminal?: TerminalControlPlaneEntry }> {
    const created =
      input.actorId && !input.superadminActorId
        ? await this.terminalControlPlane.createForActor(input.actorId, {
            terminalId: input.terminalId,
            processKind: input.processKind,
            backend: input.backend,
            command: input.command,
            cwd: input.cwd,
            profile: input.profile,
            metadata: input.metadata,
            start: input.start,
          })
        : await this.terminalControlPlane.create({
            terminalId: input.terminalId,
            processKind: input.processKind,
            backend: input.backend,
            command: input.command,
            cwd: input.cwd,
            profile: input.profile,
            metadata: input.metadata,
            start: input.start,
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
    const terminal = this.terminalControlPlane
      .listForTrustedBootstrap()
      .find((entry) => entry.terminalId === created.terminalId);
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

  bootstrapGlobalTerminal(input: {
    terminalId: string;
    recoveryIntent?: "killed-history";
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): { ok: boolean; message: string; terminal?: TerminalControlPlaneEntry } {
    this.terminalControlPlane.bootstrapAuthorized(input);
    const terminal =
      input.actorId && !input.superadminActorId
        ? this.terminalControlPlane
            .listForActor(input.actorId, { touchPresence: false })
            .find((entry) => entry.terminalId === input.terminalId)
        : this.terminalControlPlane.listForTrustedBootstrap().find((entry) => entry.terminalId === input.terminalId);
    return {
      ok: true,
      message: "terminal PTY bootstrapped",
      terminal,
    };
  }

  async stopGlobalTerminal(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string }> {
    return await this.terminalControlPlane.stopAuthorized(input);
  }

  archiveGlobalTerminal(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalControlPlaneEntry {
    return this.terminalControlPlane.archiveAuthorized(input);
  }

  async deleteGlobalTerminal(input: {
    terminalId: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<{ ok: boolean; message: string }> {
    return await this.terminalControlPlane.deleteAuthorized(input);
  }

  setGlobalTerminalConfig(input: {
    terminalId: string;
    processKind?: string;
    backend?: TerminalBackendKind;
    command?: string[];
    launchCwd?: string;
    env?: Record<string, string>;
    gitLog?: TerminalProcessProfile["gitLog"];
    logStyle?: TerminalProcessProfile["logStyle"];
    title?: string;
    icon?: string;
    shortcuts?: TerminalProcessProfile["shortcuts"];
    cols?: number;
    rows?: number;
    rendererPreference?: TerminalProcessProfile["rendererPreference"];
    theme?: TerminalProcessProfile["theme"];
    cursor?: TerminalProcessProfile["cursor"];
    font?: TerminalProcessProfile["font"];
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }) {
    return projectRuntimeTerminalConfigMutation(this.terminalControlPlane.setTerminalConfigAuthorized(input));
  }

  publishGlobalTerminalComposedSurface(input: {
    terminalId: string;
    surface: TerminalComposedProductSurfaceState;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }) {
    return this.terminalControlPlane.publishComposedSurfaceAuthorized(input);
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

  inviteGlobalTerminalSeat(input: {
    terminalId: string;
    participantId: string;
    seatClass: TerminalManagedSeatClass;
    label?: string;
    expiresAt?: number;
    endpoint?: { authorityUrl: string; trpcPath?: string; acceptPath?: string };
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalInvitationRecord {
    if (!isPrincipalId(input.participantId)) {
      throw new Error("terminal managed seat participantId must be a principal id");
    }
    return this.terminalControlPlane.inviteSeatAuthorized({
      ...input,
      participantId: input.participantId,
    });
  }

  prepareGlobalTerminalSeatAccept(input: { descriptor: string }): {
    invitation: TerminalInvitationRecord;
    proofInput: {
      invitationId: string;
      resourceKind: TerminalInvitationRecord["resourceKind"];
      resourceId: string;
      inviteePrincipalId: TerminalInvitationRecord["inviteePrincipalId"];
      payloadDigest: string;
      expiresAt: number;
    };
  } {
    return this.terminalControlPlane.prepareSeatAccept(input);
  }

  async acceptGlobalTerminalSeat(input: {
    descriptor: string;
    proof: {
      inviteePrincipalId: `0x${string}`;
      payload: string;
      signature: `0x${string}`;
    };
  }): Promise<{
    invitation: TerminalInvitationRecord;
    access: TerminalAccessProjection;
    seat: TerminalSeatProjection | undefined;
  }> {
    return await this.terminalControlPlane.acceptSeat(input);
  }

  configGlobalTerminalSeat(input: {
    terminalId: string;
    participantId: string;
    seatClass: TerminalManagedSeatClass;
    label?: string;
    expiresAt?: number;
    endpoint?: { authorityUrl: string; trpcPath?: string; acceptPath?: string };
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): TerminalInvitationRecord | TerminalAccessProjection {
    if (!isPrincipalId(input.participantId)) {
      throw new Error("terminal managed seat participantId must be a principal id");
    }
    return this.terminalControlPlane.configSeatAuthorized({
      ...input,
      participantId: input.participantId,
    });
  }

  revokeGlobalTerminalSeat(input: {
    terminalId: string;
    participantId: string;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): { ok: true } {
    if (!isPrincipalId(input.participantId)) {
      throw new Error("terminal managed seat participantId must be a principal id");
    }
    return this.terminalControlPlane.revokeSeatAuthorized({
      ...input,
      participantId: input.participantId,
    });
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

  listObservableGlobalTerminalApprovalRequests(
    input: {
      terminalId?: string;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
      statuses?: TerminalApprovalRequestRecord["status"][];
    } = {},
  ): TerminalApprovalRequestRecord[] {
    return this.terminalControlPlane.listObservableApprovalRequests(input);
  }

  onObservableGlobalTerminalApprovalRequest(
    input: {
      terminalId?: string;
      actorId?: TerminalActorId;
      superadminActorId?: TerminalActorId;
    },
    listener: (payload: TerminalApprovalRequestEvent) => void,
  ): () => void {
    const canObserve = (terminalId: string): boolean => {
      try {
        this.terminalControlPlane.listObservableApprovalRequests({
          terminalId,
          actorId: input.actorId,
          superadminActorId: input.superadminActorId,
          statuses: ["pending"],
        });
        return true;
      } catch {
        return false;
      }
    };
    return this.terminalControlPlane.onApprovalRequest(
      (payload) => {
        if (!canObserve(payload.terminalId)) {
          return;
        }
        listener(payload);
      },
      {
        terminalId: input.terminalId,
      },
    );
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

  grantGlobalTerminalWriteLease(input: TerminalGrantWriteLeaseInput): TerminalWriteLeaseRecord {
    return this.terminalControlPlane.grantWriteLeaseAuthorized(input);
  }

  revokeGlobalTerminalWriteLease(input: TerminalRevokeWriteLeaseInput): { ok: true; revokedCount: number } {
    return this.terminalControlPlane.revokeWriteLeaseAuthorized(input);
  }

  pageGlobalTerminalActivity(input: {
    terminalId: string;
    before?: ReverseTimeCursor;
    limit?: number;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): ReversePage<RuntimeTerminalActivityRecord> {
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
    recordActivity?: boolean;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<TerminalReadResult> {
    const access = this.resolveGlobalTerminalAccess(input);
    return await this.terminalControlPlane.readAuthorized({
      terminalId: input.terminalId,
      mode: input.mode,
      remark: input.remark,
      recordActivity: input.recordActivity,
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
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readRecordActivity?: boolean;
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
      returnRead: input.returnRead,
      readRecordActivity: input.readRecordActivity,
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

  async inputGlobalTerminal(input: {
    terminalId: string;
    text: string;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    readRecordActivity?: boolean;
    readMode?: TerminalReadMode;
    createApprovalRequest?: boolean;
    accessToken?: string;
    actorId?: TerminalActorId;
    superadminActorId?: TerminalActorId;
  }): Promise<TerminalWriteResult> {
    const access = this.resolveGlobalTerminalAccess(input);
    return await this.terminalControlPlane.input({
      terminalId: input.terminalId,
      text: input.text,
      returnRead: input.returnRead,
      readRecordActivity: input.readRecordActivity,
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

  async focusTerminals(input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }): Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      throw new Error("session runtime is not active");
    }
    return await runtime.focusRuntimeTerminals({
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
  }): Promise<RuntimeMessageSendResult | { ok: false; reason?: string }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      return await runtime.sendMessageChannel({
        chatId: input.chatId,
        accessToken: input.accessToken,
        text: input.text,
        assetIds: input.assetIds,
        clientMessageId: input.clientMessageId,
      });
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async pushUserRoomMessage(input: {
    sessionId: string;
    chatId: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      runtime.pushUserRoomMessage({
        chatId: input.chatId,
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

  async editMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    messageId: number;
    text: string;
  }): Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      return runtime.editMessageChannel({
        chatId: input.chatId,
        accessToken: input.accessToken,
        messageId: input.messageId,
        text: input.text,
      });
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async recallMessageChannel(input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    messageId: number;
  }): Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number; recalledAt?: number }> {
    const runtime = this.runtimes.get(input.sessionId);
    if (!runtime) {
      return { ok: false, reason: "session runtime is not active" };
    }
    try {
      return runtime.recallMessageChannel({
        chatId: input.chatId,
        accessToken: input.accessToken,
        messageId: input.messageId,
      });
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
      actorId?: MessageContactId;
      superadminContactId?: MessageContactId;
    },
    access: { room: MessageControlPlaneEntry; accessToken: string },
  ): MessageContactId | undefined {
    if (input.superadminContactId) {
      return input.superadminContactId;
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
      sendAsActorId?: MessageContactId;
      actorId?: MessageContactId;
      superadminContactId?: MessageContactId;
    },
    access: { room: MessageControlPlaneEntry; accessToken: string },
  ): MessageContactId | undefined {
    const targetToken = input.accessToken ?? access.accessToken;

    if (input.sendAsActorId) {
      if (
        input.superadminContactId &&
        input.sendAsActorId === input.superadminContactId &&
        (!input.accessToken || targetToken === access.room.accessToken)
      ) {
        return input.sendAsActorId;
      }
      const requestedProjection = this.messageControlPlane.getChannelForContact(input.chatId, input.sendAsActorId, {
        includeArchived: true,
        touchPresence: false,
      });
      if (!requestedProjection || requestedProjection.accessToken !== targetToken) {
        throw new Error("message room send-as actor invalid");
      }
      return input.sendAsActorId;
    }

    if (input.actorId && !input.superadminContactId) {
      const actorProjection = this.messageControlPlane.getChannelForContact(input.chatId, input.actorId, {
        includeArchived: true,
        touchPresence: false,
      });
      if (!actorProjection || actorProjection.accessToken !== targetToken) {
        throw new Error("message room credential-invalid");
      }
      return input.actorId;
    }

    if (input.superadminContactId && (!input.accessToken || targetToken === access.room.accessToken)) {
      return input.superadminContactId;
    }

    if (targetToken === access.room.accessToken && access.room.participantId) {
      return access.room.participantId;
    }

    const grants = this.messageControlPlane.listChannelGrantsAuthorized({
      chatId: input.chatId,
      accessToken: access.room.accessToken,
    });
    return (
      grants.find((grant) => grant.accessToken === targetToken)?.participantId ??
      input.superadminContactId ??
      input.actorId
    );
  }

  async uploadGlobalRoomAssets(input: {
    chatId: string;
    files: Array<{ name: string; mimeType: string; bytes: Uint8Array }>;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
  }): Promise<RoomMediaAsset[]> {
    const access = this.resolveGlobalRoomAccess(input);
    const uploadedByActorId = this.resolveGlobalRoomUploaderActorId(input, access);
    const items = this.roomAssets
      .uploadAssets(input.chatId, input.files, { uploadedByActorId })
      .map((asset) => this.projectGlobalRoomAsset(input.chatId, asset));
    if (items.length > 0) {
      const channel = this.messageControlPlane.getChannel(input.chatId, { includeArchived: true });
      this.queueMessageRoomInvalidation({
        changes: [
          {
            chatId: input.chatId,
            roomRevision: channel?.roomRevision ?? "0",
            transcriptRevision: channel?.transcriptRevision ?? "0",
            refreshAssets: true,
          },
        ],
      });
    }
    return items;
  }

  listGlobalRoomAssets(input: {
    chatId: string;
    accessToken?: string;
    actorId?: MessageContactId;
    superadminContactId?: MessageContactId;
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

  async uploadSessionIcon(
    sessionId: string,
    file: { bytes: Uint8Array; name: string; mimeType: string },
  ): Promise<{ ok: true; url: string }> {
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
    const descriptor = await this.authService.describe();
    const homeDir = this.getHomeDir();
    return {
      ...descriptor,
      browserAutoLoginKeyPath: resolveLocalEnvPath(homeDir),
      browserAutoLoginConfigured: readLocalEnvValue(homeDir, AUTO_LOGIN_PRIVATE_KEY_ENV_NAME) !== null,
      browserAutoLoginBootstrapAvailable:
        descriptor.rootAuthBootstrapMode === "managed_local" && descriptor.canRevealRootAuthPrivateKey,
    };
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

  private async validateRootAuthPrivateKey(privateKey: string): Promise<{
    descriptor: Awaited<ReturnType<AuthServiceBridge["describe"]>>;
    authId: string;
    privateKey: `0x${string}`;
  }> {
    const descriptor = await this.authService.describe();
    const normalizedPrivateKey = toHexPrivateKey(privateKey);
    const authId = privateKeyToAccount(normalizedPrivateKey).address.toLowerCase();
    if (authId !== descriptor.rootAuthId.toLowerCase()) {
      throw new Error(`root auth private key does not match configured root auth id: ${descriptor.rootAuthId}`);
    }
    return {
      descriptor,
      authId,
      privateKey: normalizedPrivateKey,
    };
  }

  private async resolveBrowserAutoLoginPrivateKey(): Promise<{
    authId: string;
    privateKey: `0x${string}`;
    source: "local_env" | "managed_local";
  }> {
    const homeDir = this.getHomeDir();
    const storedPrivateKey = readLocalEnvValue(homeDir, AUTO_LOGIN_PRIVATE_KEY_ENV_NAME);
    if (storedPrivateKey) {
      try {
        const validated = await this.validateRootAuthPrivateKey(storedPrivateKey);
        return {
          authId: validated.authId,
          privateKey: validated.privateKey,
          source: "local_env",
        };
      } catch {
        // Fall through so managed-local bootstrap can repair stale or invalid local.env state.
      }
    }

    const descriptor = await this.authService.describe();
    if (descriptor.rootAuthBootstrapMode !== "managed_local" || !descriptor.canRevealRootAuthPrivateKey) {
      throw new Error("daemon auto login is not configured");
    }

    const revealed = await this.authService.revealRootAuthPrivateKey();
    const validated = await this.validateRootAuthPrivateKey(revealed.privateKey);
    writeLocalEnvValue(homeDir, AUTO_LOGIN_PRIVATE_KEY_ENV_NAME, validated.privateKey);
    return {
      authId: validated.authId,
      privateKey: validated.privateKey,
      source: "managed_local",
    };
  }

  async autoLoginBrowserAuth(): Promise<
    | { ok: true; session: AuthSessionProjection; source: "local_env" | "managed_local" }
    | { ok: false; reason: "unavailable" | "failed"; message: string }
  > {
    try {
      const resolved = await this.resolveBrowserAutoLoginPrivateKey();
      const challenge = await this.authService.startAuthChallenge(resolved.authId);
      const signature = await privateKeyToAccount(resolved.privateKey).signMessage({
        message: challenge.challengeText,
      });
      return {
        ok: true,
        session: await this.authService.verifyAuthChallenge({
          challengeId: challenge.challengeId,
          signature,
        }),
        source: resolved.source,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: message === "daemon auto login is not configured" ? "unavailable" : "failed",
        message,
      };
    }
  }

  async storeBrowserAutoLoginKey(input?: { privateKey?: string | null }): Promise<{
    ok: true;
    authId: string;
    source: "provided" | "managed_local";
    localEnvPath: string;
  }> {
    const providedPrivateKey = input?.privateKey?.trim();
    if (providedPrivateKey) {
      const validated = await this.validateRootAuthPrivateKey(providedPrivateKey);
      return {
        ok: true,
        authId: validated.authId,
        source: "provided",
        localEnvPath: writeLocalEnvValue(this.getHomeDir(), AUTO_LOGIN_PRIVATE_KEY_ENV_NAME, validated.privateKey),
      };
    }

    const resolved = await this.resolveBrowserAutoLoginPrivateKey();
    return {
      ok: true,
      authId: resolved.authId,
      source: "managed_local",
      localEnvPath: writeLocalEnvValue(this.getHomeDir(), AUTO_LOGIN_PRIVATE_KEY_ENV_NAME, resolved.privateKey),
    };
  }

  snapshotAuthKv(authId: string, filter?: AuthKvFilter): AuthKvSnapshot {
    return this.authKvStore.snapshot(authId, filter);
  }

  listAuthDrafts(authId: string, filter?: AuthDraftFilter): AuthDraftSnapshot {
    return this.authDraftStore.list(authId, filter);
  }

  getAuthDraft(authId: string, draftId: string): AuthDraftEntry | null {
    return this.authDraftStore.get(authId, draftId);
  }

  createAuthDraft(authId: string, input: AuthDraftWriteInput): AuthDraftCreateResult {
    return this.authDraftStore.create(authId, input);
  }

  saveAuthDraft(
    authId: string,
    input: {
      draftId: string;
      kind: AuthDraftKind;
      state: AuthDraftState;
      baseVersion?: number;
    },
  ): AuthDraftSaveResult {
    return this.authDraftStore.save(authId, input);
  }

  deleteAuthDraft(
    authId: string,
    input: {
      draftId: string;
      baseVersion?: number;
    },
  ): AuthDraftDeleteResult {
    return this.authDraftStore.delete(authId, input);
  }

  getAuthDraftEventsAfter(authId: string, afterEventId = 0, filter?: AuthDraftFilter): AuthDraftEvent[] {
    return this.authDraftStore.getEventsAfter(authId, afterEventId, filter);
  }

  onAuthDraftEvent(authId: string, listener: (event: AuthDraftEvent) => void): () => void {
    return this.authDraftStore.onEvent((event) => {
      if (event.authId !== authId) {
        return;
      }
      if (event.kind === "upsert") {
        listener({
          eventId: event.eventId,
          timestamp: event.timestamp,
          kind: "upsert",
          entry: event.entry,
        });
        return;
      }
      listener({
        eventId: event.eventId,
        timestamp: event.timestamp,
        kind: "delete",
        draftId: event.draftId,
        draftKind: event.draftKind,
        version: event.version,
      });
    });
  }

  setAuthKv(
    authId: string,
    input: {
      key: string;
      value: JsonValue;
      baseVersion?: number | null;
    },
  ): AuthKvSetResult {
    return this.authKvStore.set(authId, input);
  }

  deleteAuthKv(
    authId: string,
    input: {
      key: string;
      baseVersion?: number | null;
    },
  ): AuthKvDeleteResult {
    return this.authKvStore.delete(authId, input);
  }

  getAuthKvEventsAfter(authId: string, afterEventId = 0, filter?: AuthKvFilter): AuthKvEvent[] {
    return this.authKvStore.getEventsAfter(authId, afterEventId, filter);
  }

  onAuthKvEvent(authId: string, listener: (event: AuthKvEvent) => void): () => void {
    return this.authKvStore.onEvent((event) => {
      if (event.authId !== authId) {
        return;
      }
      if (event.kind === "set") {
        listener({
          eventId: event.eventId,
          timestamp: event.timestamp,
          kind: "set",
          entry: event.entry,
        });
        return;
      }
      listener({
        eventId: event.eventId,
        timestamp: event.timestamp,
        kind: "delete",
        key: event.key,
        version: event.version,
      });
    });
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
  ): ReversePage<RuntimeCycleRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
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
  ): ReversePage<RuntimeModelCallRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
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

  queryUsageAnalytics(sessionId: string, input: UsageAnalyticsQuery): UsageAnalyticsQueryResult {
    const session = this.sessions.get(sessionId);
    if (!session?.avatarPrincipalId) {
      return createEmptyUsageAnalyticsResult(input);
    }
    const dbPath = resolveUsageAnalyticsDbPathFromAvatarRoot(
      resolveGlobalAvatarCanonicalRoot(session.avatarPrincipalId, this.getHomeDir()),
    );
    if (!existsSync(dbPath)) {
      return createEmptyUsageAnalyticsResult(input);
    }
    const db = new UsageAnalyticsDb(dbPath);
    try {
      return db.query(session.avatarPrincipalId, input);
    } finally {
      db.close();
    }
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
  ): ReversePage<SessionAiCallRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
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
  ): ReversePage<RuntimeLoopStateLogRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
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
      return emptyReversePage();
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
    return [];
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
  ): ReversePage<RuntimeTerminalActivityRecord> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return emptyReversePage();
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

  async inspectAttentionDeliveryState(
    sessionId: string,
  ): Promise<ReturnType<SessionRuntime["inspectAttentionDeliveryState"]>> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.inspectAttentionDeliveryState();
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    return await this.readPersistedAttentionDeliveryState(session);
  }

  async queryAttentionDeliveryTimeline(
    sessionId: string,
    input: {
      contextId?: string;
      commitId?: string;
      cycleId?: number;
      sessionModelCallId?: number;
      limit?: number;
    },
  ): Promise<ReturnType<SessionRuntime["queryAttentionDeliveryTimeline"]>> {
    const runtime = this.runtimes.get(sessionId);
    if (runtime) {
      return runtime.queryAttentionDeliveryTimeline(input);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    return await this.readPersistedAttentionDeliveryState(session, input);
  }

  requestRuntimeCompact(sessionId: string): { ok: boolean } {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) {
      return { ok: false };
    }
    return runtime.requestCompact("manual");
  }

  async queryAttention(sessionId: string, input: AttentionSearchRequest): Promise<AttentionCommitMatch[]> {
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
    const engine = new AttentionSearchEngine(
      join(session.sessionRoot, ATTENTION_SEARCH_SQLITE_FILENAME),
      join(session.sessionRoot, ATTENTION_SEARCH_LEGACY_DUCKDB_FILENAME),
    );
    return await engine.query({
      attentionSystem,
      snapshot: attention.snapshot,
      request: input,
    });
  }

  async commitAttention(sessionId: string, input: AppAttentionCommitInput) {
    const runtime = await this.ensureRuntime(sessionId);
    const summary = input.summary ?? input.body ?? `Attention update for ${input.contextId}`;
    return await runtime.commitAttention({
      contextId: input.contextId,
      summary,
      change: input.body ? { type: "update", value: input.body, format: "text/plain" } : { type: "clean" },
      done: input.done,
      scores: input.scores,
      meta: input.meta,
    });
  }

  async settleAttention(sessionId: string, input: AppAttentionSettleInput) {
    const runtime = await this.ensureRuntime(sessionId);
    const summary =
      input.summary ?? `Settled attention for ${input.contextId}${input.reason ? ` (${input.reason})` : ""}`;
    const body = input.body ?? (input.reason ? `reason=${input.reason}` : undefined);
    return await runtime.settleAttention({
      contextId: input.contextId,
      summary,
      change: body ? { type: "update", value: body, format: "text/plain" } : { type: "clean" },
      scores: input.scores,
      reason: input.reason,
      meta: input.meta,
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
    const kind = settingsKindSchema.parse(input.kind);
    const runtime = this.runtimes.get(input.sessionId);
    if (runtime) {
      return runtime.readEditable(kind);
    }
    const editor = await this.createPersistedSettingsEditor(input.sessionId);
    return await editor.read(kind);
  }

  async listSettingsLayers(workspacePath: string) {
    return await listWorkspaceSettingsLayers({ workspacePath });
  }

  async listSettingsScope(input: { scope: SettingsScope; workspacePath?: string; avatar?: string }) {
    return await listScopedSettingsGraph(input);
  }

  async readGlobalSettings() {
    return await readGlobalSettingsFile();
  }

  async saveGlobalSettings(input: { content: string; baseMtimeMs: number }) {
    return await saveGlobalSettingsFile(input);
  }

  async readSettingsLayer(input: { workspacePath: string; layerId: string }) {
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

  async saveSettingsLayer(input: { workspacePath: string; layerId: string; content: string; baseMtimeMs: number }) {
    const result = await saveWorkspaceSettingsLayer(input);
    if (result.ok) {
      await this.refreshRuntimesForWorkspaceSettingsSave({ workspacePath: input.workspacePath });
    }
    return result;
  }

  async saveSettingsScopeLayer(input: {
    scope: SettingsScope;
    workspacePath?: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
    avatar?: string;
  }) {
    const result = await saveScopedSettingsLayer(input);
    if (result.ok) {
      await this.refreshRuntimesForScopedSettingsSave(input);
    }
    return result;
  }

  async getNotificationSnapshot(): Promise<SessionNotificationSnapshot> {
    return await this.buildNotificationSnapshot();
  }

  async setChatVisibility(input: {
    sessionId: string;
    chatId: string;
    visible: boolean;
    focused: boolean;
  }): Promise<SessionNotificationSnapshot> {
    const snapshot = await this.updateAttentionVisibility({
      sessionId: input.sessionId,
      target: "chat",
      targetId: input.chatId,
      focusState: toAttentionFocusStateFromVisibility(input),
    });
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  async setTerminalVisibility(input: {
    sessionId: string;
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }): Promise<SessionNotificationSnapshot> {
    const snapshot = await this.updateAttentionVisibility({
      sessionId: input.sessionId,
      target: "terminal",
      targetId: input.terminalId,
      focusState: toAttentionFocusStateFromVisibility(input),
    });
    this.emit("notification.updated", { snapshot }, input.sessionId);
    return snapshot;
  }

  async consumeNotifications(input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToSrc?: string | null;
  }): Promise<SessionNotificationSnapshot> {
    const snapshot = await this.consumeAttentionNotifications(input);
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
    const kind = settingsKindSchema.parse(input.kind);
    const runtime = this.runtimes.get(input.sessionId);
    if (runtime) {
      return runtime.saveEditable(kind, input.content, input.baseMtimeMs);
    }
    const editor = await this.createPersistedSettingsEditor(input.sessionId);
    return await editor.save(kind, input.content, input.baseMtimeMs);
  }

  mcpAdd(input: { sessionId: string } & McpAddInput): ReturnType<SessionRuntime["mcpAdd"]> {
    const { sessionId, ...mcpInput } = input;
    return this.getRunningRuntimeOrThrow(sessionId).mcpAdd(mcpInput);
  }

  async mcpRemove(
    input: { sessionId: string } & McpRemoveInput,
  ): Promise<Awaited<ReturnType<SessionRuntime["mcpRemove"]>>> {
    const { sessionId, ...mcpInput } = input;
    return await this.getRunningRuntimeOrThrow(sessionId).mcpRemove(mcpInput);
  }

  mcpEnable(input: { sessionId: string } & McpProjectInput): ReturnType<SessionRuntime["mcpEnable"]> {
    const { sessionId, ...mcpInput } = input;
    return this.getRunningRuntimeOrThrow(sessionId).mcpEnable(mcpInput);
  }

  async mcpDisable(
    input: { sessionId: string } & McpDisableInput,
  ): Promise<Awaited<ReturnType<SessionRuntime["mcpDisable"]>>> {
    const { sessionId, ...mcpInput } = input;
    return await this.getRunningRuntimeOrThrow(sessionId).mcpDisable(mcpInput);
  }

  mcpList(input: { sessionId: string } & McpListInput): ReturnType<SessionRuntime["mcpList"]> {
    const { sessionId, ...mcpInput } = input;
    return this.getRunningRuntimeOrThrow(sessionId).mcpList(mcpInput);
  }

  mcpQuery(input: { sessionId: string } & McpQueryInput): ReturnType<SessionRuntime["mcpQuery"]> {
    const { sessionId, ...mcpInput } = input;
    return this.getRunningRuntimeOrThrow(sessionId).mcpQuery(mcpInput);
  }

  async mcpStart(
    input: { sessionId: string } & McpProjectInput,
  ): Promise<Awaited<ReturnType<SessionRuntime["mcpStart"]>>> {
    const { sessionId, ...mcpInput } = input;
    return await this.getRunningRuntimeOrThrow(sessionId).mcpStart(mcpInput);
  }

  async mcpStop(
    input: { sessionId: string } & McpProjectInput,
  ): Promise<Awaited<ReturnType<SessionRuntime["mcpStop"]>>> {
    const { sessionId, ...mcpInput } = input;
    return await this.getRunningRuntimeOrThrow(sessionId).mcpStop(mcpInput);
  }

  async mcpRestart(
    input: { sessionId: string } & McpProjectInput,
  ): Promise<Awaited<ReturnType<SessionRuntime["mcpRestart"]>>> {
    const { sessionId, ...mcpInput } = input;
    return await this.getRunningRuntimeOrThrow(sessionId).mcpRestart(mcpInput);
  }

  async mcpCall(input: { sessionId: string } & McpCallInput): Promise<Awaited<ReturnType<SessionRuntime["mcpCall"]>>> {
    const { sessionId, ...mcpInput } = input;
    return await this.getRunningRuntimeOrThrow(sessionId).mcpCall(mcpInput);
  }

  private async refreshRuntimesForWorkspaceSettingsSave(input: {
    workspacePath: string;
    avatar?: string;
  }): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      if (!runtime.matchesWorkspaceSettingsTarget(input)) {
        continue;
      }
      await runtime.reloadSettingsFromDisk({ persistPendingConfigFact: true });
    }
  }

  private async refreshRuntimesForScopedSettingsSave(input: {
    scope: SettingsScope;
    workspacePath?: string;
    avatar?: string;
  }): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      if (!runtime.matchesScopedSettingsTarget(input)) {
        continue;
      }
      await runtime.reloadSettingsFromDisk({ persistPendingConfigFact: true });
    }
  }

  private getRunningRuntimeOrThrow(sessionId: string): SessionRuntime {
    this.getSessionMetaOrThrow(sessionId);
    const runtime = this.runtimes.get(sessionId);
    if (!runtime?.isStarted()) {
      throw new Error(`runtime is not running: ${sessionId}`);
    }
    return runtime;
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

  private getSessionMetaOrThrow(sessionId: string): SessionMeta {
    this.ensureSessionCatalogLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    return session;
  }

  private async createPersistedSettingsEditor(sessionId: string): Promise<SettingsEditor> {
    const session = this.getSessionMetaOrThrow(sessionId);
    const config = await resolveSessionConfig(session.cwd, {
      avatar: session.avatar,
      avatarPrincipalId: session.avatarPrincipalId,
      homeDir: this.getHomeDir(),
    });
    return new SettingsEditor(session.cwd, config.prompt);
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
          (item) => (item.role === "user" || item.channel === "to_user") && !isInternalFailurePreviewText(item.content),
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
      return readAllPersistedChatMessages(db)
        .filter((message) => message.id > afterId)
        .slice(-limit)
        .map((message) => toPersistedChatMessage(sessionId, message));
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
      return emptyReversePage();
    }

    const db = new SessionDb(dbPath);
    try {
      const page = pagePersistedMessages(readAllPersistedChatMessages(db), input, (message) => message.createdAt);
      return {
        items: page.items.map((message) => toPersistedChatMessage(sessionId, message)),
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
  ): ReversePage<RuntimeCycleRecord> {
    void sessionRoot;
    void input;
    return emptyReversePage();
  }

  private async readPersistedAttentionState(
    session: SessionMeta,
  ): Promise<ReturnType<SessionRuntime["inspectAttentionState"]>> {
    const attentionStore = new AttentionStore(join(session.sessionRoot, "attention-system"));
    const snapshot = await attentionStore.load();
    const attentionSystem = AttentionSystem.fromSnapshot(snapshot);
    return {
      snapshot,
      active: attentionSystem.listActiveContexts(),
      cycleFrames: [] satisfies AttentionCycleFrame[],
      hooks: [] satisfies AttentionHookRecord[],
    };
  }

  private async readPersistedAttentionDeliveryState(
    session: SessionMeta,
    input: {
      contextId?: string;
      commitId?: string;
      cycleId?: number;
      sessionModelCallId?: number;
      limit?: number;
    } = {},
  ): Promise<ReturnType<SessionRuntime["queryAttentionDeliveryTimeline"]>> {
    const attentionStore = new AttentionStore(join(session.sessionRoot, "attention-system"));
    const attentionSnapshot = await attentionStore.load();
    const kernel = new LoopBusKernel();
    const commitRefs = attentionSnapshot.contexts.flatMap((context) =>
      context.commits.map((commit) => ({
        contextId: context.contextId,
        commitId: commit.commitId,
        createdAt: Date.parse(commit.createdAt) || Date.now(),
      })),
    );

    const dbPath = join(session.sessionRoot, "session.db");
    const dispatches = existsSync(dbPath)
      ? (() => {
          const db = new SessionDb(dbPath);
          try {
            return db.listAttentionDispatches({
              contextId: input.contextId,
              commitId: input.commitId,
              cycleId: input.cycleId,
              sessionModelCallId: input.sessionModelCallId,
            });
          } finally {
            db.close();
          }
        })()
      : [];
    const receipts = existsSync(dbPath)
      ? (() => {
          const db = new SessionDb(dbPath);
          try {
            return db.listAttentionReceipts({
              contextId: input.contextId,
              commitId: input.commitId,
              cycleId: input.cycleId,
              sessionModelCallId: input.sessionModelCallId,
            });
          } finally {
            db.close();
          }
        })()
      : [];

    kernel.restoreTimeline({
      commitRefs,
      dispatches: dispatches.map((dispatch) => ({
        dispatchId: dispatch.dispatchId,
        contextId: dispatch.contextId,
        commitId: dispatch.commitId,
        cycleId: dispatch.cycleId,
        attemptIndex: dispatch.attemptIndex,
        agentCallId: dispatch.agentCallId,
        sessionModelCallId: dispatch.sessionModelCallId,
        createdAt: dispatch.createdAt,
      })),
      receipts: receipts.map((receipt) => ({
        receiptId: receipt.receiptId,
        dispatchId: receipt.dispatchId,
        contextId: receipt.contextId,
        commitId: receipt.commitId,
        cycleId: receipt.cycleId,
        attemptIndex: receipt.attemptIndex,
        agentCallId: receipt.agentCallId,
        sessionModelCallId: receipt.sessionModelCallId,
        status: receipt.status,
        providerEventKind: receipt.providerEventKind,
        timestamp: receipt.timestamp,
        finishReason: receipt.finishReason,
        usage: receipt.usage ? { ...receipt.usage } : undefined,
        errorCode: receipt.errorCode,
        errorMessage: receipt.errorMessage,
        meta: receipt.meta ? structuredClone(receipt.meta) : undefined,
      })),
    });

    const timeline = kernel.queryAttentionDeliveryTimeline(input);
    const projections =
      input.contextId && input.commitId
        ? [kernel.getDeliveryProjection({ contextId: input.contextId, commitId: input.commitId })]
        : kernel.listDeliveryProjections();

    return {
      projections: projections.filter((projection) => projection !== null),
      dispatches: timeline.dispatches,
      receipts: timeline.receipts,
      watches: [],
      effects: [],
    };
  }

  private async buildSessionNotificationSnapshot(session: SessionMeta): Promise<SessionNotificationSnapshot> {
    const runtime = this.runtimes.get(session.id);
    if (runtime) {
      return runtime.inspectNotificationState();
    }
    const attention = await this.readPersistedAttentionState(session);
    return projectSessionNotificationSnapshot({
      sessionId: session.id,
      workspacePath: session.workspacePath,
      sessionName: session.name,
      attention: attention.snapshot,
    });
  }

  private async buildNotificationSnapshot(): Promise<SessionNotificationSnapshot> {
    return mergeSessionNotificationSnapshots(
      await Promise.all(
        this.sessions.list().map(async (session) => await this.buildSessionNotificationSnapshot(session)),
      ),
    );
  }

  private resolveNotificationChatContextId(_session: SessionMeta, chatId: string): string {
    return `ctx-${chatId}`;
  }

  private resolveNotificationTerminalContextId(terminalId: string): string {
    return `ctx-terminal-${terminalId}`;
  }

  private async updatePersistedAttentionState<T>(
    session: SessionMeta,
    mutate: (attentionSystem: AttentionSystem) => T,
  ): Promise<T> {
    const attentionRoot = join(session.sessionRoot, "attention-system");
    const attentionStore = new AttentionStore(attentionRoot);
    const attentionSystem = AttentionSystem.fromSnapshot(await attentionStore.load());
    const result = mutate(attentionSystem);
    await attentionStore.save(attentionSystem.snapshot());
    return result;
  }

  private async updateAttentionVisibility(input: {
    sessionId: string;
    target: "chat" | "terminal";
    targetId?: string;
    focusState: "focused" | "background" | "muted";
  }): Promise<SessionNotificationSnapshot> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`session not found: ${input.sessionId}`);
    }
    const runtime = this.runtimes.get(input.sessionId);
    if (runtime) {
      if (input.target === "chat" && !input.targetId) {
        // File-truth law: visibility follows the explicit room context, never session identity.
        throw new Error("room must be specified");
      }
      return input.target === "chat"
        ? await runtime.setChatVisibility({
            chatId: input.targetId!,
            visible: input.focusState !== "muted",
            focused: input.focusState === "focused",
          })
        : await runtime.setTerminalVisibility({
            terminalId: input.targetId,
            visible: input.focusState !== "muted",
            focused: input.focusState === "focused",
          });
    }

    if (input.target === "chat" && !input.targetId) {
      // Stopped-session notification state still keys off explicit room context ids only.
      throw new Error("room must be specified");
    }

    await this.updatePersistedAttentionState(session, (attentionSystem) => {
      const contextId =
        input.target === "chat"
          ? this.resolveNotificationChatContextId(session, input.targetId!)
          : this.resolveNotificationTerminalContextId(input.targetId ?? "");
      if (!attentionSystem.getContext(contextId)) {
        attentionSystem.createContext({
          contextId,
          owner: session.avatar,
          focusState: input.focusState,
        });
        return;
      }
      attentionSystem.setContextFocusState(contextId, input.focusState);
    });
    return await this.buildSessionNotificationSnapshot(session);
  }

  private async consumeAttentionNotifications(input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToSrc?: string | null;
  }): Promise<SessionNotificationSnapshot> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`session not found: ${input.sessionId}`);
    }
    const runtime = this.runtimes.get(input.sessionId);
    if (runtime) {
      return await runtime.consumeNotifications(input);
    }

    await this.updatePersistedAttentionState(session, (attentionSystem) => {
      const contextIds = input.chatId
        ? [this.resolveNotificationChatContextId(session, input.chatId)]
        : input.terminalId
          ? [this.resolveNotificationTerminalContextId(input.terminalId)]
          : attentionSystem
              .snapshot()
              .contexts.filter((context) => attentionSystem.listPushCommits(context.contextId).length > 0)
              .map((context) => context.contextId);
      for (const contextId of contextIds) {
        const commits = attentionSystem.listPushCommits(contextId);
        const upToSrc = input.upToSrc;
        const selectedCommitIds =
          typeof upToSrc === "string"
            ? commits
                .filter((commit) => {
                  if (typeof commit.meta.src !== "string") {
                    return false;
                  }
                  const comparison = appAttentionSourceRegistry.compare(commit.meta.src, upToSrc);
                  return comparison === null ? commit.meta.src === upToSrc : comparison <= 0;
                })
                .map((commit) => commit.commitId)
            : commits.map((commit) => commit.commitId);
        if (selectedCommitIds.length > 0) {
          attentionSystem.consumePushes(contextId, selectedCommitIds);
        }
      }
    });
    return await this.buildSessionNotificationSnapshot(session);
  }

  private async readPersistedModelDebug(
    session: SessionMeta,
  ): Promise<ReturnType<SessionRuntime["inspectModelDebug"]>> {
    const resolved = await resolveSessionConfig(session.cwd, {
      avatar: session.avatar,
      homeDir: this.getHomeDir(),
    });
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
          transportMaxRetries: resolved.ai.transportMaxRetries,
          maxToken: resolved.ai.maxToken,
          maxContextTokens: resolved.ai.maxContextTokens,
          retryPolicy: resolved.loop.retryPolicy,
          compactPolicy: resolved.loop.compactPolicy,
          capabilities: resolveModelCapabilities(resolved.ai),
        },
        promptWindow: [],
        prompt: null,
        stats: null,
        latestModelCall: null,
        recentModelCalls: [],
        recentApiCalls: [],
      };
    }

    const db = new SessionDb(dbPath);
    try {
      const recentAiCalls = db.listAiCalls(12);
      const recentModelCalls = recentAiCalls.map(projectAiCallToModelCall);
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
          transportMaxRetries: resolved.ai.transportMaxRetries,
          maxToken: resolved.ai.maxToken,
          maxContextTokens: resolved.ai.maxContextTokens,
          retryPolicy: resolved.loop.retryPolicy,
          compactPolicy: resolved.loop.compactPolicy,
          capabilities: resolveModelCapabilities(resolved.ai),
        },
        promptWindow: clonePromptWindowMessages(db.getCurrentPromptWindow()?.messages),
        prompt: null,
        stats: null,
        latestModelCall: recentModelCalls.at(-1) ?? null,
        recentModelCalls: recentModelCalls.slice(-8),
        recentApiCalls: recentAiCalls,
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
      return readAllPersistedChatMessages(db)
        .filter((message) => message.id < beforeId)
        .slice(-limit)
        .map((message) => toPersistedChatMessage(sessionId, message));
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
      return projectChatCyclesFromCalls(db, db.listAiCalls(limit));
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
      return emptyReversePage();
    }
    const db = new SessionDb(dbPath);
    try {
      const page = db.pageAiCalls(input);
      return {
        items: projectChatCyclesFromCalls(db, page.items),
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
      const cycles: ChatCycle[] = [];
      const batchSize = Math.max(limit * 2, 50);
      let beforeAiCallId: number | null = null;
      while (cycles.length < limit) {
        const calls: SessionAiCallRecord[] =
          beforeAiCallId === null ? db.listAiCalls(batchSize) : db.listAiCallsBefore(beforeAiCallId, batchSize);
        if (calls.length === 0) {
          break;
        }
        const projected = projectChatCyclesFromCalls(db, calls).filter(
          (cycle) => cycle.cycleId !== null && cycle.cycleId < beforeCycleId,
        );
        cycles.unshift(...projected);
        const oldestAiCallId = calls[0]?.id ?? null;
        if (oldestAiCallId === null) {
          break;
        }
        beforeAiCallId = oldestAiCallId;
        if (calls.length < batchSize || oldestAiCallId <= 0) {
          break;
        }
      }
      return cycles.slice(-limit);
    } finally {
      db.close();
    }
  }

  private readLoopbusStateLogsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<RuntimeLoopStateLogRecord> {
    void sessionRoot;
    void input;
    return emptyReversePage();
  }

  private readLoopbusTracesPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<ReturnType<SessionRuntime["listLoopbusTraces"]>[number]> {
    void sessionRoot;
    void input;
    return emptyReversePage();
  }

  private readModelCallsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<RuntimeModelCallRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return emptyReversePage();
    }
    const db = new SessionDb(dbPath);
    try {
      const page = db.pageAiCalls(input);
      return {
        items: page.items.map(projectAiCallToModelCall),
        nextBefore: page.nextBefore,
        hasMoreBefore: page.hasMoreBefore,
      };
    } finally {
      db.close();
    }
  }

  private readRequestAuxPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionMessageRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return emptyReversePage();
    }
    const db = new SessionDb(dbPath);
    try {
      return db.pageMessagesByScope("request_aux", input);
    } finally {
      db.close();
    }
  }

  private readHeartbeatPartsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionMessageRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return emptyReversePage();
    }
    const db = new SessionDb(dbPath);
    try {
      return db.pageMessagesByScopes(HEARTBEAT_INSPECTION_SCOPES, input);
    } finally {
      db.close();
    }
  }

  private readHeartbeatGroupsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<RuntimeHeartbeatGroupRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return emptyReversePage();
    }
    const db = new SessionDb(dbPath);
    try {
      return pageHeartbeatGroupsFromDb(db, input);
    } finally {
      db.close();
    }
  }

  private readHeartbeatRecordsPageFromDb(sessionRoot: string, input: HeartbeatRecordPageInput): HeartbeatRecordPage {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return emptyHeartbeatRecordPage(input);
    }
    const db = new SessionDb(dbPath);
    try {
      db.rebuildHeartbeatRecords();
      return db.pageHeartbeatRecords(input);
    } finally {
      db.close();
    }
  }

  private readHeartbeatRecordDetailFromDb(sessionRoot: string, recordId: number): HeartbeatRecordDetail | null {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return null;
    }
    const db = new SessionDb(dbPath);
    try {
      db.rebuildHeartbeatRecords();
      return db.getHeartbeatRecordDetail(recordId);
    } finally {
      db.close();
    }
  }

  private readApiCallsPageFromDb(
    sessionRoot: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<SessionAiCallRecord> {
    const dbPath = join(sessionRoot, "session.db");
    if (!existsSync(dbPath)) {
      return emptyReversePage();
    }
    const db = new SessionDb(dbPath);
    try {
      return db.pageAiCalls(input);
    } finally {
      db.close();
    }
  }

  private readTerminalActivityPageFromDb(
    sessionRoot: string,
    terminalId: string,
    input?: { before?: ReverseTimeCursor; limit?: number },
  ): ReversePage<RuntimeTerminalActivityRecord> {
    void sessionRoot;
    void terminalId;
    void input;
    return emptyReversePage();
  }

  private detachRuntime(sessionId: string): void {
    this.runtimes.delete(sessionId);
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
      case "heartbeatPart":
        this.emit("runtime.heartbeatPart", event.payload, sessionId, event.timestamp);
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
        void this.getNotificationSnapshot().then((snapshot) => {
          this.emit("notification.updated", { snapshot }, sessionId, event.timestamp);
        });
        return;
      case "attentionDeliveryUpdated":
        this.emit("runtime.attentionDelivery", event.payload, sessionId, event.timestamp);
        return;
      case "attentionDispatch":
        this.emit("runtime.attentionDispatch", event.payload, sessionId, event.timestamp);
        return;
      case "attentionReceipt":
        this.emit("runtime.attentionReceipt", event.payload, sessionId, event.timestamp);
        return;
      case "cycleUpdated":
        this.emit("runtime.cycle.updated", event.payload, sessionId, event.timestamp);
        return;
      case "error":
        this.emit("runtime.error", event.payload, sessionId, event.timestamp);
        return;
    }
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
