import { describe, expect, test } from "bun:test";

import { RuntimeStore } from "../src/runtime-store";
import type { AgenterClient, AgenterTransportEvent } from "../src/trpc-client";
import type {
  GlobalAvatarCatalogEntry,
  GlobalRoomMessage,
  GlobalTerminalApprovalRequest,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  HeartbeatGroupItem,
  HeartbeatPartItem,
  ModelCallItem,
  RuntimeAttentionDeliveryState,
  RuntimeAttentionState,
  RuntimeSnapshot,
  SessionEntry,
  WorkspaceAvatarCatalogEntry,
} from "../src/types";

type ReversePageResult<T> = {
  items: T[];
  nextBefore?: { beforeTimeMs: number; beforeId: number } | null;
  hasMoreBefore?: boolean;
};

type AttentionContextItem = RuntimeAttentionState["snapshot"]["contexts"][number];
type AttentionCommitItem = AttentionContextItem["commits"][number];
type SubscriptionHandlers = { onData?: (event: unknown) => void; onError?: () => void };
type TerminalPermissionSubscriptionInput = {
  terminalId?: string;
  statuses?: Array<"pending" | "approved" | "denied" | "expired">;
};

const createUnauthorizedTrpcError = (): Error & { data: { code: string } } => {
  const error = new Error("auth token required") as Error & { data: { code: string } };
  error.data = { code: "UNAUTHORIZED" };
  return error;
};

const createTraceEntry = (input: {
  id: number;
  cycleId: number;
  seq?: number;
  kind?: string;
  name?: string;
  status?: "running" | "done" | "error" | "cancelled";
  startedAt?: number;
  endedAt?: number;
  attributes?: Record<string, unknown>;
}) => ({
  id: input.id,
  cycleId: input.cycleId,
  seq: input.seq ?? 1,
  traceId: `trace-${input.cycleId}`,
  spanId: `span-${input.id}`,
  parentSpanId: null,
  kind: input.kind ?? "source.collect",
  name: input.name ?? "collect_inputs",
  status: input.status ?? "done",
  startedAt: input.startedAt ?? Date.now(),
  endedAt: input.endedAt ?? input.startedAt ?? Date.now(),
  refs: [],
  links: [],
  events: [],
  attributes: input.attributes ?? {},
  outcome: input.status === "running" ? undefined : { code: (input.status ?? "done") === "error" ? "error" : "done" },
});

const createHeartbeatEntry = (input: {
  id: number;
  messageId: string;
  scope?: HeartbeatPartItem["scope"];
  role?: HeartbeatPartItem["role"];
  aiCallId?: number | null;
  roundIndex?: number;
  createdAt: number;
  updatedAt?: number;
  isComplete?: boolean;
  partType?: string;
  payload: unknown;
  text?: string;
}): HeartbeatPartItem => ({
  id: input.id,
  messageId: input.messageId,
  windowId: null,
  aiCallId: input.aiCallId ?? null,
  roundIndex: input.roundIndex ?? 1,
  scope: input.scope ?? "heartbeat_part",
  role: input.role ?? "assistant",
  createdAt: input.createdAt,
  updatedAt: input.updatedAt ?? input.createdAt,
  isComplete: input.isComplete ?? true,
  text: input.text ?? (typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload)),
  parts: [
    {
      partId: input.id,
      partIndex: 0,
      messageId: input.messageId,
      windowId: null,
      aiCallId: input.aiCallId ?? null,
      roundIndex: input.roundIndex ?? 1,
      scope: input.scope ?? "heartbeat_part",
      role: input.role ?? "assistant",
      partType: input.partType ?? "text",
      mimeType: null,
      payload: input.payload,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt ?? input.createdAt,
      isComplete: input.isComplete ?? true,
    },
  ],
});

const createHeartbeatGroup = (input: {
  id: number;
  groupId: string;
  kind?: HeartbeatGroupItem["kind"];
  aiCallId?: number | null;
  createdAt: number;
  updatedAt?: number;
  isComplete?: boolean;
  items: HeartbeatPartItem[];
}): HeartbeatGroupItem => ({
  id: input.id,
  groupId: input.groupId,
  kind: input.kind ?? "call",
  aiCallId: input.aiCallId ?? null,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt ?? input.createdAt,
  isComplete: input.isComplete ?? true,
  items: input.items,
});

const createSnapshot = (
  eventId: number,
  input: {
    messageChannels?: RuntimeSnapshot["runtimes"][string]["messageChannels"];
    attention?: RuntimeSnapshot["runtimes"][string]["attention"];
    attentionDelivery?: RuntimeAttentionDeliveryState;
    schedulerState?: RuntimeSnapshot["runtimes"][string]["schedulerState"];
  } = {},
): RuntimeSnapshot => ({
  version: 1,
  timestamp: Date.now(),
  lastEventId: eventId,
  sessions: [
    {
      id: "i-1",
      name: "workspace",
      cwd: process.cwd(),
      workspacePath: process.cwd(),
      avatar: "tester-bot",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "running",
      storageState: "active",
      sessionRoot: "/tmp/sessions/i-1",
      storeTarget: "global",
    },
  ],
  runtimes: {
    "i-1": {
      sessionId: "i-1",
      started: true,
      activityState: "idle",
      schedulerPhase: "waiting_commits",
      stage: "idle",
      focusedTerminalId: "main",
      focusedTerminalIds: ["main"],
      chatMessages: [],
      messageChannels: input.messageChannels,
      terminalSnapshots: {
        main: {
          seq: 0,
          timestamp: Date.now(),
          cols: 80,
          rows: 24,
          lines: Array.from({ length: 24 }, () => ""),
          cursor: { x: 0, y: 0 },
        },
      },
      terminalReads: {},
      tasks: [],
      schedulerState: input.schedulerState ?? null,
      attention: input.attention,
      attentionDelivery: input.attentionDelivery ?? {
        projections: [],
        dispatches: [],
        receipts: [],
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
      attentionApi: null,
      terminals: [
        {
          terminalId: "main",
          status: "IDLE",
          processPhase: "running",
          seq: 0,
          launchCwd: process.cwd(),
        },
      ],
      modelCapabilities: {
        streaming: true,
        tools: true,
        imageInput: false,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      },
      activeCycle: null,
    },
  },
});

const createAttentionCommit = (input: {
  commitId: string;
  contextId: string;
  author: string;
  source: string;
  summary: string;
  value: string;
  scores: Record<string, number>;
  createdAt?: string;
  format?: string;
}): AttentionCommitItem => ({
  commitId: input.commitId,
  contextId: input.contextId,
  ingressType: "commit",
  parentCommitIds: [],
  meta: {
    author: input.author,
    source: input.source,
    createdAt: input.createdAt ?? new Date().toISOString(),
  },
  scores: input.scores,
  summary: input.summary,
  change: {
    type: "update",
    value: input.value,
    format: input.format ?? "text/plain",
  },
  createdAt: input.createdAt ?? new Date().toISOString(),
});

const createAttentionContext = (input: {
  contextId: string;
  owner: string;
  content: string;
  scoreMap: Record<string, number>;
  commit: AttentionCommitItem;
  contentFormat?: string;
  focusState?: AttentionContextItem["focusState"];
  createdAt?: string;
  updatedAt?: string;
}): AttentionContextItem => ({
  contextId: input.contextId,
  owner: input.owner,
  focusState: input.focusState ?? "focused",
  content: input.content,
  contentFormat: input.contentFormat,
  scoreMap: input.scoreMap,
  consumedPushCommitIds: [],
  headCommitId: input.commit.commitId,
  createdAt: input.createdAt ?? new Date().toISOString(),
  updatedAt: input.updatedAt ?? new Date().toISOString(),
  commitCount: 1,
  commitsTruncated: false,
  commits: [input.commit],
});

const createModelCallItem = (input: {
  id: number;
  cycleId: number | null;
  roundIndex?: number;
  kind?: string;
  status: ModelCallItem["status"];
  provider: string;
  model: string;
  createdAt: number;
  updatedAt?: number;
  completedAt?: number | null;
  providerSnapshot?: ModelCallItem["providerSnapshot"];
  requestUrl?: string;
  request?: unknown;
  response?: unknown;
  error?: unknown;
  outcome?: unknown;
  isComplete?: boolean;
}): ModelCallItem => ({
  id: input.id,
  cycleId: input.cycleId,
  roundIndex: input.roundIndex ?? 1,
  kind: input.kind ?? "chat",
  status: input.status,
  provider: input.provider,
  model: input.model,
  providerSnapshot: input.providerSnapshot ?? null,
  requestUrl: input.requestUrl ?? "",
  request: input.request ?? {},
  response: input.response ?? null,
  error: input.error ?? null,
  outcome: input.outcome ?? null,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt ?? input.createdAt,
  completedAt: input.completedAt ?? null,
  isComplete: input.isComplete ?? input.status !== "running",
});

const createAttentionDeliveryState = (
  overrides: Partial<RuntimeAttentionDeliveryState> = {},
): RuntimeAttentionDeliveryState => ({
  projections: overrides.projections ? structuredClone(overrides.projections) : [],
  dispatches: overrides.dispatches ? structuredClone(overrides.dispatches) : [],
  receipts: overrides.receipts ? structuredClone(overrides.receipts) : [],
  watches: overrides.watches ? structuredClone(overrides.watches) : [],
  effects: overrides.effects ? structuredClone(overrides.effects) : [],
});

const emitSubscriptionEvent = (handlers: SubscriptionHandlers | null, event: unknown) => {
  handlers?.onData?.(event);
};

const emptyNotificationSnapshot = () => ({
  items: [],
  unreadBySession: {},
  unreadByBucket: {},
});

const createAvatarCatalogEntry = (
  nickname: string,
  overrides: Partial<WorkspaceAvatarCatalogEntry> = {},
): WorkspaceAvatarCatalogEntry => {
  const normalized = nickname.trim().toLowerCase() || "default";
  const workspacePrivatePath =
    overrides.workspacePrivatePath ?? `/workspace/.agenter/avatars/by-principal/${normalized}`;
  const workspacePrivateSlotReady = overrides.workspacePrivateSlotReady ?? false;
  return {
    avatarPrincipalId: overrides.avatarPrincipalId ?? `avatar-${normalized}`,
    runtimeId: overrides.runtimeId ?? `runtime-${normalized}`,
    nickname: normalized,
    displayName: overrides.displayName ?? null,
    classify: overrides.classify ?? null,
    iconUrl: overrides.iconUrl ?? null,
    defaultAvatar: overrides.defaultAvatar ?? normalized === "default",
    sourceScope: overrides.sourceScope ?? "global",
    globalAvailable: overrides.globalAvailable ?? true,
    workspacePrivateSlotReady,
    globalPath: overrides.globalPath ?? `/global/${normalized}`,
    workspacePrivatePath,
    effectivePath:
      overrides.effectivePath ?? (workspacePrivateSlotReady ? workspacePrivatePath : `/global/${normalized}`),
  };
};

const createMockClient = (input: {
  snapshotQuery: () => Promise<RuntimeSnapshot>;
  onSubscribe?: (handlers: { onData?: (event: unknown) => void; onError?: () => void }) => void;
  onTransportSubscribe?: (listener: (event: AgenterTransportEvent) => void) => void;
  onClose?: () => void;
  apiCallsSubscribe?: (
    payload: { sessionId: string; afterId: number },
    handlers: { onData?: (payload: unknown) => void; onError?: () => void },
  ) => { unsubscribe: () => void };
  terminalPermissionRequestsSubscribe?: (
    payload: TerminalPermissionSubscriptionInput | undefined,
    handlers: SubscriptionHandlers,
  ) => { unsubscribe: () => void };
  createSessionResult?: RuntimeSnapshot["sessions"][number];
  workspaceRecentQuery?: () => Promise<{ items: string[] }>;
  profileServiceQuery?: () => Promise<{
    endpoint: string;
    authMode: "wallet_challenge_jwt";
    rootAuthId: string;
    rootIdentifier: {
      kind: string;
      value: string;
    };
    rootAuthKeyPath: string;
    jwtTtlSeconds: number;
    rootAuthBootstrapMode: "managed_local" | "external";
    canRevealRootAuthPrivateKey: boolean;
    hasManagedRootAuthPrivateKey: boolean;
    browserAutoLoginKeyPath: string;
    browserAutoLoginConfigured: boolean;
    browserAutoLoginBootstrapAvailable: boolean;
  }>;
  authAutoLoginMutate?: () => Promise<
    | {
        ok: true;
        session: {
          token: string;
          issuedAt: string;
          expiresAt: string;
          claims: {
            authId: string;
            profileId: string;
            admin: boolean;
            superadmin: boolean;
          };
          profile: {
            profileId: string;
            identifiers: Array<{ kind: string; value: string }>;
            metadata: Record<string, unknown>;
            iconUrl: string;
            isVirtual: boolean;
          };
        };
        source: "local_env" | "managed_local";
      }
    | {
        ok: false;
        reason: "unavailable" | "failed";
        message: string;
      }
  >;
  authStoreAutoLoginKeyMutate?: (input?: { privateKey?: string }) => Promise<{
    ok: true;
    authId: string;
    source: "provided" | "managed_local";
    localEnvPath: string;
  }>;
  workspaceListAllQuery?: () => Promise<{
    items: Array<{
      path: string;
      favorite: boolean;
      group: string;
      missing: boolean;
      counts: { all: number; running: number; stopped: number; archive: number };
      lastSessionActivityAt?: string;
    }>;
  }>;
  workspaceAvatarCatalogQuery?: (input: { workspacePath: string }) => Promise<{ items: WorkspaceAvatarCatalogEntry[] }>;
  workspaceCliCatalogQuery?: (input: { workspacePath: string; avatar: string }) => Promise<{
    groups: Array<{
      id: string;
      title: string;
      description: string;
      entries: Array<{
        id: string;
        groupId: string;
        source: string;
        commandLabel: string;
        displayName: string;
        description: string;
        suggestedCommand: string;
        detailHint?: string;
        preferredExecutionSurface?: "root-workspace" | "public-workspace";
      }>;
    }>;
  }>;
  workspaceExecMutate?: (input: {
    runtimeId: string;
    workspacePath: string;
    avatar: string;
    surface?: "root-workspace" | "public-workspace";
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    cwd: string;
  }>;
  globalAvatarCatalogQuery?: () => Promise<{ items: GlobalAvatarCatalogEntry[] }>;
  globalAvatarCreateMutate?: (input: {
    nickname: string;
    displayName?: string | null;
    classify?: GlobalAvatarCatalogEntry["classify"];
  }) => Promise<{ avatar: GlobalAvatarCatalogEntry }>;
  workspaceForkAvatarMutate?: (input: {
    workspacePath: string;
    avatar: string;
  }) => Promise<{ avatar: WorkspaceAvatarCatalogEntry }>;
  workspaceCopyAvatarMutate?: (input: {
    workspacePath: string;
    sourceAvatar: string;
    targetAvatar: string;
  }) => Promise<{ avatar: WorkspaceAvatarCatalogEntry }>;
  workspaceCleanMissingMutate?: () => Promise<{ removed: string[] }>;
  skillCatalogQuery?: (input: { rootKind: "builtin" | "shared" | "global" }) => Promise<{ items: unknown[] }>;
  skillAvatarCatalogQuery?: () => Promise<{ items: unknown[] }>;
  skillCatalogTreeQuery?: (input: {
    rootKind: "builtin" | "shared" | "global";
    name: string;
    path?: string;
    offset?: number;
    limit?: number;
  }) => Promise<unknown>;
  skillCatalogPreviewQuery?: (input: {
    rootKind: "builtin" | "shared" | "global";
    name: string;
    path: string;
    maxBytes?: number;
  }) => Promise<unknown>;
  skillAvatarTreeQuery?: (input: {
    avatarNickname: string;
    workspacePath: string;
    name: string;
    path?: string;
    offset?: number;
    limit?: number;
  }) => Promise<unknown>;
  skillAvatarPreviewQuery?: (input: {
    avatarNickname: string;
    workspacePath: string;
    name: string;
    path: string;
    maxBytes?: number;
  }) => Promise<unknown>;
  authActorsQuery?: () => Promise<{
    items: Array<{
      actorId: string;
      actorKind: "auth";
      authId: string;
      profileId: string;
      label: string;
      subtitle: string;
      iconUrl: string;
      identifier: {
        kind: string;
        value: string;
      };
    }>;
  }>;
  notificationSnapshotQuery?: () => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      src: string;
      sourceNamespace: string;
      sourceId: string;
      bucketKey: string;
      attentionContextId: string;
      attentionCommitId: string;
      workspacePath: string;
      sessionName: string;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByBucket: Record<string, Record<string, number>>;
  }>;
  messageGlobalMarkReadMutate?: (input: { chatId: string; accessToken?: string; messageId?: number }) => Promise<{
    channel: {
      chatId: string;
      kind: "room";
      title: string;
      owner: string;
      participants: Array<{ id: string; label?: string }>;
      createdAt: number;
      updatedAt: number;
      focused: boolean;
      accessRole: "admin" | "member" | "readonly";
      accessToken: string;
      participantId?: string;
      transportUrl?: string;
      seatStates?: Array<{
        actorId: string;
        role: "admin" | "member" | "readonly";
        label?: string;
        currentAdmin: boolean;
        online: boolean;
        focused: boolean;
        invalidCredential: boolean;
      }>;
    };
  }>;
  setChatVisibilityMutate?: (input: {
    sessionId: string;
    chatId?: string;
    visible: boolean;
    focused: boolean;
  }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      src: string;
      sourceNamespace: string;
      sourceId: string;
      bucketKey: string;
      attentionContextId: string;
      attentionCommitId: string;
      workspacePath: string;
      sessionName: string;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByBucket: Record<string, Record<string, number>>;
  }>;
  setTerminalVisibilityMutate?: (input: {
    sessionId: string;
    terminalId?: string;
    visible: boolean;
    focused: boolean;
  }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      src: string;
      sourceNamespace: string;
      sourceId: string;
      bucketKey: string;
      attentionContextId: string;
      attentionCommitId: string;
      workspacePath: string;
      sessionName: string;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByBucket: Record<string, Record<string, number>>;
  }>;
  consumeNotificationsMutate?: (input: {
    sessionId: string;
    chatId?: string;
    terminalId?: string;
    upToSrc?: string;
  }) => Promise<{
    items: Array<{
      id: string;
      sessionId: string;
      src: string;
      sourceNamespace: string;
      sourceId: string;
      bucketKey: string;
      attentionContextId: string;
      attentionCommitId: string;
      workspacePath: string;
      sessionName: string;
      content: string;
      timestamp: number;
    }>;
    unreadBySession: Record<string, number>;
    unreadByBucket: Record<string, Record<string, number>>;
  }>;
  listSettingsLayersQuery?: (input: { workspacePath: string }) => Promise<{
    effective: { content: string };
    layers: Array<{
      layerId: string;
      sourceId: string;
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    }>;
  }>;
  readSettingsLayerQuery?: (input: { workspacePath: string; layerId: string }) => Promise<{
    layer: {
      layerId: string;
      sourceId: string;
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    };
    path: string;
    content: string;
    mtimeMs: number;
  }>;
  saveSettingsLayerMutate?: (input: {
    workspacePath: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
  }) => Promise<
    | {
        ok: true;
        file: { path: string; content: string; mtimeMs: number };
        effective: { content: string };
      }
    | {
        ok: false;
        reason: "conflict";
        latest: { path: string; content: string; mtimeMs: number };
      }
    | { ok: false; reason: "readonly"; message: string }
  >;
  listScopedSettingsQuery?: (input: {
    scope: "workspace" | "global";
    workspacePath?: string;
    avatar?: string;
  }) => Promise<{
    scope: "workspace" | "global";
    effective: {
      content: string;
      value?: Record<string, unknown>;
      schema?: Record<string, unknown>;
      provenance?: Record<string, unknown>;
    };
    layers: Array<{
      layerId: string;
      sourceId: string;
      kind: "file" | "avatar";
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    }>;
  }>;
  readScopedSettingsLayerQuery?: (input: {
    scope: "workspace" | "global";
    workspacePath?: string;
    layerId: string;
    avatar?: string;
  }) => Promise<{
    layer: {
      layerId: string;
      sourceId: string;
      kind: "file" | "avatar";
      path: string;
      exists: boolean;
      editable: boolean;
      readonlyReason?: string;
    };
    path: string;
    content: string;
    mtimeMs: number;
  }>;
  saveScopedSettingsLayerMutate?: (input: {
    scope: "workspace" | "global";
    workspacePath?: string;
    layerId: string;
    content: string;
    baseMtimeMs: number;
    avatar?: string;
  }) => Promise<
    | {
        ok: true;
        file: { path: string; content: string; mtimeMs: number };
        effective: { content: string };
      }
    | {
        ok: false;
        reason: "conflict";
        latest: { path: string; content: string; mtimeMs: number };
      }
    | { ok: false; reason: "readonly"; message: string }
  >;
  chatSendMutate?: (input: {
    sessionId: string;
    text: string;
    assetIds: string[];
    clientMessageId: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  chatListQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  chatCyclesQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  messageListChannelsQuery?: (input: { sessionId: string; includeArchived?: boolean }) => Promise<{ items: unknown[] }>;
  messageCreateChannelMutate?: (input: {
    sessionId: string;
    kind: "room";
    title?: string;
    focus?: boolean;
  }) => Promise<{ channel: unknown }>;
  messageFocusMutate?: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken: string }>;
  }) => Promise<{ items: unknown[] }>;
  messageSendMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    text: string;
    assetIds?: string[];
    clientMessageId: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  messageEditMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    messageId: number;
    text: string;
  }) => Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number }>;
  messageRecallMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    messageId: number;
  }) => Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number; recalledAt?: number }>;
  messageUpdateChannelMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string }>;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<{ channel: unknown }>;
  messageListChannelGrantsQuery?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }) => Promise<{ items: unknown[] }>;
  messageIssueChannelGrantMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
  }) => Promise<{ grant: unknown }>;
  messageRevokeChannelGrantMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    grantId: string;
  }) => Promise<{ ok: boolean }>;
  messageArchiveChannelMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    archivedBy?: string;
  }) => Promise<{ channel: unknown }>;
  messageDeleteChannelMutate?: (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
  }) => Promise<{ channel: unknown }>;
  messageGlobalListQuery?: (input: { includeArchived?: boolean }) => Promise<{ items: unknown[] }>;
  messageGlobalCreateMutate?: (input: {
    chatId?: string;
    kind: "room";
    title?: string;
    participants?: Array<{ id: string; label?: string }>;
    metadata?: Record<string, unknown>;
    adminToken?: string;
    focus?: boolean;
  }) => Promise<{ channel: unknown }>;
  messageGlobalFocusMutate?: (input: {
    op: "add" | "remove" | "replace" | "clear";
    channels: Array<{ chatId: string; accessToken?: string }>;
  }) => Promise<{ ok: boolean; message: string; focusedChatIds: string[] }>;
  messageGlobalSnapshotQuery?: (input: { chatId: string; accessToken?: string; limit?: number }) => Promise<{
    channel: unknown;
    items: unknown[];
    nextBefore: { beforeTimeMs: number; beforeId: number } | null;
    hasMoreBefore: boolean;
    headVersion: string;
  }>;
  messageGlobalPageQuery?: (input: {
    chatId: string;
    accessToken?: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  messageGlobalSendMutate?: (input: {
    chatId: string;
    accessToken?: string;
    text: string;
    assetIds?: string[];
    clientMessageId?: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  messageGlobalEditMutate?: (input: {
    chatId: string;
    accessToken?: string;
    messageId: number;
    text: string;
  }) => Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number }>;
  messageGlobalRecallMutate?: (input: {
    chatId: string;
    accessToken?: string;
    messageId: number;
  }) => Promise<{ ok: boolean; reason?: string; messageId?: number; updatedAt?: number; recalledAt?: number }>;
  messageGlobalUpdateMutate?: (input: {
    chatId: string;
    accessToken?: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string }>;
      metadata?: Record<string, unknown>;
      adminGroupCandidateIds?: string[];
    };
  }) => Promise<{ channel: unknown }>;
  messageGlobalListGrantsQuery?: (input: { chatId: string; accessToken?: string }) => Promise<{ items: unknown[] }>;
  messageGlobalListAssetsQuery?: (input: { chatId: string; accessToken?: string }) => Promise<{ items: unknown[] }>;
  messageGlobalIssueGrantMutate?: (input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    participantId: string;
    label?: string;
    accessTokenHint?: string;
  }) => Promise<{ grant: unknown }>;
  messageGlobalRevokeGrantMutate?: (input: {
    chatId: string;
    accessToken?: string;
    grantId: string;
  }) => Promise<{ ok: boolean }>;
  messageGlobalArchiveMutate?: (input: {
    chatId: string;
    accessToken?: string;
    archivedBy?: string;
  }) => Promise<{ channel: unknown }>;
  messageGlobalDeleteMutate?: (input: { chatId: string; accessToken?: string }) => Promise<{ channel: unknown }>;
  terminalListQuery?: (input: { sessionId: string }) => Promise<{ items: unknown[] }>;
  terminalCreateMutate?: (input: {
    sessionId: string;
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: unknown;
    focus?: boolean;
  }) => Promise<{ result: unknown }>;
  terminalFocusMutate?: (input: {
    sessionId: string;
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  terminalDeleteMutate?: (input: {
    sessionId: string;
    terminalId: string;
  }) => Promise<{ ok: boolean; message: string }>;
  terminalGlobalListQuery?: (input?: { includeArchived?: boolean }) => Promise<{ items: unknown[] }>;
  terminalGlobalCreateMutate?: (input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: unknown;
    focus?: boolean;
  }) => Promise<{ result: unknown }>;
  terminalGlobalFocusMutate?: (input: {
    op: "add" | "remove" | "replace" | "clear";
    terminalIds: string[];
    accessToken?: string;
  }) => Promise<{ ok: boolean; message: string; focusedTerminalIds: string[] }>;
  terminalGlobalDeleteMutate?: (input: { terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  terminalGlobalSetConfigMutation?: (input: { terminalId: string; cols?: number; rows?: number }) => Promise<{
    result: {
      config: {
        terminalId: string;
        processKind: string;
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
        };
        processPhase: "running" | "stopped" | "not_started";
      };
      appliedLiveFields: string[];
      nextBootstrapFields: string[];
    };
  }>;
  terminalGlobalReadQuery?: (input: {
    terminalId: string;
    accessToken?: string;
    mode?: "auto" | "diff" | "snapshot";
    remark?: boolean;
    recordActivity?: boolean;
  }) => Promise<unknown>;
  terminalGlobalWriteMutate?: (input: {
    terminalId: string;
    accessToken?: string;
    text: string;
    createApprovalRequest?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
    readRecordActivity?: boolean;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  }) => Promise<unknown>;
  terminalGlobalInputMutate?: (input: {
    terminalId: string;
    accessToken?: string;
    text: string;
    createApprovalRequest?: boolean;
    readMode?: "auto" | "diff" | "snapshot";
    readRecordActivity?: boolean;
    returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
  }) => Promise<unknown>;
  terminalListGrantsQuery?: (input: { terminalId: string }) => Promise<{ items: unknown[] }>;
  terminalIssueGrantMutate?: (input: {
    terminalId: string;
    role: "admin" | "writer" | "guard" | "readonly";
    participantId: string;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }) => Promise<{ grant: unknown }>;
  terminalRevokeGrantMutate?: (input: { terminalId: string; grantId: string }) => Promise<{ ok: boolean }>;
  terminalListApprovalRequestsQuery?: (input: {
    terminalId: string;
    assignedAdminId?: string;
    participantId?: string;
    statuses?: Array<"pending" | "approved" | "denied" | "expired">;
  }) => Promise<{ items: unknown[] }>;
  terminalApproveRequestMutate?: (input: {
    terminalId: string;
    requestId: string;
    durationMs: number;
  }) => Promise<unknown>;
  terminalDenyRequestMutate?: (input: { terminalId: string; requestId: string }) => Promise<unknown>;
  terminalActivityPageQuery?: (input: {
    sessionId: string;
    terminalId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  attentionStateQuery?: (input: { sessionId: string }) => Promise<unknown>;
  attentionDeliveryStateQuery?: (input: { sessionId: string }) => Promise<unknown>;
  attentionDeliveryTimelineQuery?: (input: {
    sessionId: string;
    contextId?: string;
    commitId?: string;
    cycleId?: number;
    sessionModelCallId?: number;
    limit?: number;
  }) => Promise<unknown>;
  attentionQueryQuery?: (input: {
    sessionId: string;
    query?: string;
    offset?: number;
    limit?: number;
  }) => Promise<{ items: unknown[] }>;
  usageAnalyticsQuery?: (input: {
    sessionId: string;
    sinceMs: number;
    untilMs: number;
    granularity?: "auto" | "raw" | "day" | "month" | "year";
    filters?: {
      sessionId?: string;
      kind?: string;
      providerId?: string;
      model?: string;
    };
  }) => Promise<unknown>;
  schedulerLogsQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  observabilityTracesQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  modelCallsPageQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  requestAuxPageQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  heartbeatGroupsPageQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  requestCompactMutate?: (input: { sessionId: string }) => Promise<{ ok: boolean }>;
  heartbeatPartsPageQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
  apiCallsPageQuery?: (input: {
    sessionId: string;
    before?: { beforeTimeMs: number; beforeId: number };
    limit?: number;
  }) => Promise<ReversePageResult<unknown>>;
}): AgenterClient => {
  let authToken: string | null = null;

  return {
    trpc: {
      auth: {
        service: {
          query: async () =>
            input.profileServiceQuery
              ? await input.profileServiceQuery()
              : {
                  endpoint: "http://127.0.0.1:4591",
                  authMode: "wallet_challenge_jwt",
                  rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
                  rootIdentifier: {
                    kind: "wallet_evm",
                    value: "0x0000000000000000000000000000000000000001",
                  },
                  rootAuthKeyPath: "~/.agenter/profile-service/root-auth.key",
                  jwtTtlSeconds: 3600,
                  rootAuthBootstrapMode: "managed_local",
                  canRevealRootAuthPrivateKey: true,
                  hasManagedRootAuthPrivateKey: true,
                  browserAutoLoginKeyPath: "~/.agenter/local.env",
                  browserAutoLoginConfigured: false,
                  browserAutoLoginBootstrapAvailable: true,
                },
        },
        actors: {
          query: async () => (input.authActorsQuery ? await input.authActorsQuery() : { items: [] }),
        },
        challengeStart: {
          mutate: async (payload: { authId: string }) => ({
            challengeId: crypto.randomUUID(),
            challengeText: `challenge:${payload.authId}`,
            authId: payload.authId,
            expiresAt: new Date().toISOString(),
          }),
        },
        autoLogin: {
          mutate: async () =>
            input.authAutoLoginMutate
              ? await input.authAutoLoginMutate()
              : {
                  ok: false,
                  reason: "unavailable",
                  message: "daemon auto login is not configured",
                },
        },
        storeAutoLoginKey: {
          mutate: async (payload?: { privateKey?: string }) =>
            input.authStoreAutoLoginKeyMutate
              ? await input.authStoreAutoLoginKeyMutate(payload)
              : {
                  ok: true,
                  authId: "wallet_evm:0x0000000000000000000000000000000000000001",
                  source: payload?.privateKey ? "provided" : "managed_local",
                  localEnvPath: "~/.agenter/local.env",
                },
        },
        challengeVerify: {
          mutate: async (payload: { challengeId: string; signature: string }) => ({
            token: `token:${payload.challengeId}:${payload.signature}`,
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            claims: {
              authId: "wallet_evm:0x0000000000000000000000000000000000000001",
              profileId: "profile-1",
              admin: true,
              superadmin: false,
            },
            profile: {
              profileId: "profile-1",
              identifiers: [{ kind: "wallet_evm", value: "0x0000000000000000000000000000000000000001" }],
              metadata: {},
              iconUrl: "http://127.0.0.1:4591/media/profiles/profile-1/icon",
              isVirtual: false,
            },
          }),
        },
        session: {
          query: async () => {
            if (!authToken) {
              const error = new Error("UNAUTHORIZED") as Error & { data?: { code: string } };
              error.data = { code: "UNAUTHORIZED" };
              throw error;
            }
            return {
              token: authToken,
              issuedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              claims: {
                authId: "wallet_evm:0x0000000000000000000000000000000000000001",
                profileId: "profile-1",
                admin: true,
                superadmin: false,
              },
              profile: {
                profileId: "profile-1",
                identifiers: [{ kind: "wallet_evm", value: "0x0000000000000000000000000000000000000001" }],
                metadata: {},
                iconUrl: "http://127.0.0.1:4591/media/profiles/profile-1/icon",
                isVirtual: false,
              },
            };
          },
        },
        superadminStatus: {
          query: async () => ({
            ok: true,
            claims: {
              authId: "wallet_evm:0x0000000000000000000000000000000000000001",
              profileId: "profile-1",
              admin: true,
              superadmin: true,
            },
          }),
        },
      },
      runtime: {
        snapshot: {
          query: input.snapshotQuery,
        },
        attentionState: {
          query: async (payload: { sessionId: string }) =>
            input.attentionStateQuery
              ? await input.attentionStateQuery(payload)
              : { snapshot: { contexts: [] }, active: [], cycleFrames: [], egress: [] },
        },
        attentionDeliveryState: {
          query: async (payload: { sessionId: string }) =>
            input.attentionDeliveryStateQuery
              ? await input.attentionDeliveryStateQuery(payload)
              : { projections: [], dispatches: [], receipts: [], watches: [], effects: [] },
        },
        attentionDeliveryTimeline: {
          query: async (payload: {
            sessionId: string;
            contextId?: string;
            commitId?: string;
            cycleId?: number;
            sessionModelCallId?: number;
            limit?: number;
          }) =>
            input.attentionDeliveryTimelineQuery
              ? await input.attentionDeliveryTimelineQuery(payload)
              : { projections: [], dispatches: [], receipts: [], watches: [], effects: [] },
        },
        attentionQuery: {
          query: async (payload: { sessionId: string; query?: string; offset?: number; limit?: number }) =>
            input.attentionQueryQuery ? await input.attentionQueryQuery(payload) : { items: [] },
        },
        usageAnalytics: {
          query: async (payload: {
            sessionId: string;
            sinceMs: number;
            untilMs: number;
            granularity?: "auto" | "raw" | "day" | "month" | "year";
            filters?: {
              sessionId?: string;
              kind?: string;
              providerId?: string;
              model?: string;
            };
          }) =>
            input.usageAnalyticsQuery
              ? await input.usageAnalyticsQuery(payload)
              : {
                  granularity: payload.granularity ?? "auto",
                  sinceMs: payload.sinceMs,
                  untilMs: payload.untilMs,
                  filters: payload.filters ?? {},
                  totals: {
                    callCount: 0,
                    inputTokens: 0,
                    outputTokens: 0,
                    totalTokens: 0,
                    cachedInputTokens: { value: 0, knownCallCount: 0 },
                    reasoningTokens: { value: 0, knownCallCount: 0 },
                    uncachedInputTokens: { value: 0, knownCallCount: 0 },
                  },
                  items: [],
                },
        },
        events: {
          subscribe: (_payload: unknown, handlers: { onData?: (event: unknown) => void; onError?: () => void }) => {
            input.onSubscribe?.({
              onData: handlers.onData,
              onError: handlers.onError,
            });
            return {
              unsubscribe: () => {},
            };
          },
        },
        schedulerLogs: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.schedulerLogsQuery
              ? await input.schedulerLogsQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        observabilityTraces: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.observabilityTracesQuery
              ? await input.observabilityTracesQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        modelCallsPage: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.modelCallsPageQuery
              ? await input.modelCallsPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        heartbeatGroupsPage: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.heartbeatGroupsPageQuery
              ? await input.heartbeatGroupsPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        heartbeatPartsPage: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.heartbeatPartsPageQuery
              ? await input.heartbeatPartsPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        requestAuxPage: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.requestAuxPageQuery
              ? await input.requestAuxPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        apiCallsPage: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.apiCallsPageQuery
              ? await input.apiCallsPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        terminalActivityPage: {
          query: async (payload: {
            sessionId: string;
            terminalId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.terminalActivityPageQuery
              ? await input.terminalActivityPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        apiCalls: {
          subscribe: (
            payload: { sessionId: string; afterId: number },
            handlers: { onData?: (payload: unknown) => void; onError?: () => void },
          ) =>
            input.apiCallsSubscribe
              ? input.apiCallsSubscribe(payload, handlers)
              : {
                  unsubscribe: () => {},
                },
        },
        requestCompact: {
          mutate: async (payload: { sessionId: string }) =>
            input.requestCompactMutate ? await input.requestCompactMutate(payload) : { ok: true },
        },
      },
      session: {
        create: {
          mutate: async () => ({
            session: input.createSessionResult ?? createSnapshot(0).sessions[0],
          }),
        },
        start: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        stop: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        abort: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        archive: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        restore: { mutate: async () => ({ session: createSnapshot(0).sessions[0] }) },
        delete: { mutate: async () => ({}) },
      },
      chat: {
        send: {
          mutate: async (payload: { sessionId: string; text: string; assetIds: string[]; clientMessageId: string }) =>
            input.chatSendMutate ? await input.chatSendMutate(payload) : { ok: true },
        },
        list: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.chatListQuery
              ? await input.chatListQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        cycles: {
          query: async (payload: {
            sessionId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.chatCyclesQuery
              ? await input.chatCyclesQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
      },
      message: {
        listChannels: {
          query: async (payload: { sessionId: string; includeArchived?: boolean }) =>
            input.messageListChannelsQuery ? await input.messageListChannelsQuery(payload) : { items: [] },
        },
        createChannel: {
          mutate: async (payload: { sessionId: string; kind: "room"; title?: string; focus?: boolean }) =>
            input.messageCreateChannelMutate ? await input.messageCreateChannelMutate(payload) : { channel: null },
        },
        focus: {
          mutate: async (payload: {
            sessionId: string;
            op: "add" | "remove" | "replace" | "clear";
            channels: Array<{ chatId: string; accessToken: string }>;
          }) => (input.messageFocusMutate ? await input.messageFocusMutate(payload) : { items: [] }),
        },
        send: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            text: string;
            assetIds?: string[];
            clientMessageId: string;
          }) => (input.messageSendMutate ? await input.messageSendMutate(payload) : { ok: true }),
        },
        edit: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            messageId: number;
            text: string;
          }) =>
            input.messageEditMutate
              ? await input.messageEditMutate(payload)
              : { ok: true, messageId: payload.messageId, updatedAt: Date.now() },
        },
        recall: {
          mutate: async (payload: { sessionId: string; chatId: string; accessToken: string; messageId: number }) =>
            input.messageRecallMutate
              ? await input.messageRecallMutate(payload)
              : { ok: true, messageId: payload.messageId, updatedAt: Date.now(), recalledAt: Date.now() },
        },
        updateChannel: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            patch: {
              title?: string;
              participants?: Array<{ id: string; label?: string }>;
              metadata?: Record<string, unknown>;
            };
          }) =>
            input.messageUpdateChannelMutate ? await input.messageUpdateChannelMutate(payload) : { channel: null },
        },
        listChannelGrants: {
          query: async (payload: { sessionId: string; chatId: string; accessToken: string }) =>
            input.messageListChannelGrantsQuery ? await input.messageListChannelGrantsQuery(payload) : { items: [] },
        },
        issueChannelGrant: {
          mutate: async (payload: {
            sessionId: string;
            chatId: string;
            accessToken: string;
            role: "admin" | "member" | "readonly";
            label?: string;
            participantId?: string;
          }) =>
            input.messageIssueChannelGrantMutate
              ? await input.messageIssueChannelGrantMutate(payload)
              : { grant: null },
        },
        revokeChannelGrant: {
          mutate: async (payload: { sessionId: string; chatId: string; accessToken: string; grantId: string }) =>
            input.messageRevokeChannelGrantMutate ? await input.messageRevokeChannelGrantMutate(payload) : { ok: true },
        },
        archiveChannel: {
          mutate: async (payload: { sessionId: string; chatId: string; accessToken: string; archivedBy?: string }) =>
            input.messageArchiveChannelMutate ? await input.messageArchiveChannelMutate(payload) : { channel: null },
        },
        deleteChannel: {
          mutate: async (payload: { sessionId: string; chatId: string; accessToken: string }) =>
            input.messageDeleteChannelMutate ? await input.messageDeleteChannelMutate(payload) : { channel: null },
        },
        globalList: {
          query: async (payload: { includeArchived?: boolean }) =>
            input.messageGlobalListQuery ? await input.messageGlobalListQuery(payload) : { items: [] },
        },
        globalCreate: {
          mutate: async (payload: {
            chatId?: string;
            kind: "room";
            title?: string;
            participants?: Array<{ id: string; label?: string }>;
            metadata?: Record<string, unknown>;
            adminToken?: string;
            focus?: boolean;
          }) => (input.messageGlobalCreateMutate ? await input.messageGlobalCreateMutate(payload) : { channel: null }),
        },
        globalFocus: {
          mutate: async (payload: {
            op: "add" | "remove" | "replace" | "clear";
            channels: Array<{ chatId: string; accessToken?: string }>;
          }) =>
            input.messageGlobalFocusMutate
              ? await input.messageGlobalFocusMutate(payload)
              : { ok: true, message: "ok", focusedChatIds: payload.channels.map((channel) => channel.chatId) },
        },
        globalSnapshot: {
          query: async (payload: { chatId: string; accessToken?: string; limit?: number }) =>
            input.messageGlobalSnapshotQuery
              ? await input.messageGlobalSnapshotQuery(payload)
              : {
                  channel: null,
                  items: [],
                  nextBefore: null,
                  hasMoreBefore: false,
                  headVersion: "0",
                },
        },
        globalMarkRead: {
          mutate: async (payload: { chatId: string; accessToken?: string; messageId?: number }) =>
            input.messageGlobalMarkReadMutate ? await input.messageGlobalMarkReadMutate(payload) : { channel: null },
        },
        globalPage: {
          query: async (payload: {
            chatId: string;
            accessToken?: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.messageGlobalPageQuery
              ? await input.messageGlobalPageQuery(payload)
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        globalSend: {
          mutate: async (payload: {
            chatId: string;
            accessToken?: string;
            text: string;
            assetIds?: string[];
            clientMessageId?: string;
          }) => (input.messageGlobalSendMutate ? await input.messageGlobalSendMutate(payload) : { ok: true }),
        },
        globalEdit: {
          mutate: async (payload: { chatId: string; accessToken?: string; messageId: number; text: string }) =>
            input.messageGlobalEditMutate
              ? await input.messageGlobalEditMutate(payload)
              : { ok: true, messageId: payload.messageId, updatedAt: Date.now() },
        },
        globalRecall: {
          mutate: async (payload: { chatId: string; accessToken?: string; messageId: number }) =>
            input.messageGlobalRecallMutate
              ? await input.messageGlobalRecallMutate(payload)
              : { ok: true, messageId: payload.messageId, updatedAt: Date.now(), recalledAt: Date.now() },
        },
        globalUpdate: {
          mutate: async (payload: {
            chatId: string;
            accessToken?: string;
            patch: {
              title?: string;
              participants?: Array<{ id: string; label?: string }>;
              metadata?: Record<string, unknown>;
              adminGroupCandidateIds?: string[];
            };
          }) => (input.messageGlobalUpdateMutate ? await input.messageGlobalUpdateMutate(payload) : { channel: null }),
        },
        globalListGrants: {
          query: async (payload: { chatId: string; accessToken?: string }) =>
            input.messageGlobalListGrantsQuery ? await input.messageGlobalListGrantsQuery(payload) : { items: [] },
        },
        globalListAssets: {
          query: async (payload: { chatId: string; accessToken?: string }) =>
            input.messageGlobalListAssetsQuery ? await input.messageGlobalListAssetsQuery(payload) : { items: [] },
        },
        globalIssueGrant: {
          mutate: async (payload: {
            chatId: string;
            accessToken?: string;
            role: "admin" | "member" | "readonly";
            participantId: string;
            label?: string;
            accessTokenHint?: string;
          }) =>
            input.messageGlobalIssueGrantMutate ? await input.messageGlobalIssueGrantMutate(payload) : { grant: null },
        },
        globalRevokeGrant: {
          mutate: async (payload: { chatId: string; accessToken?: string; grantId: string }) =>
            input.messageGlobalRevokeGrantMutate ? await input.messageGlobalRevokeGrantMutate(payload) : { ok: true },
        },
        globalArchive: {
          mutate: async (payload: { chatId: string; accessToken?: string; archivedBy?: string }) =>
            input.messageGlobalArchiveMutate ? await input.messageGlobalArchiveMutate(payload) : { channel: null },
        },
        globalDelete: {
          mutate: async (payload: { chatId: string; accessToken?: string }) =>
            input.messageGlobalDeleteMutate ? await input.messageGlobalDeleteMutate(payload) : { channel: null },
        },
      },
      terminal: {
        list: {
          query: async (payload: { sessionId: string }) =>
            input.terminalListQuery ? await input.terminalListQuery(payload) : { items: [] },
        },
        create: {
          mutate: async (payload: {
            sessionId: string;
            terminalId?: string;
            processKind?: string;
            command?: string[];
            cwd?: string;
            profile?: unknown;
            focus?: boolean;
          }) =>
            input.terminalCreateMutate
              ? await input.terminalCreateMutate(payload)
              : { result: { ok: true, message: "ok" } },
        },
        focus: {
          mutate: async (payload: {
            sessionId: string;
            op: "add" | "remove" | "replace" | "clear";
            terminalIds: string[];
          }) =>
            input.terminalFocusMutate
              ? await input.terminalFocusMutate(payload)
              : { ok: true, message: "ok", focusedTerminalIds: payload.terminalIds },
        },
        delete: {
          mutate: async (payload: { sessionId: string; terminalId: string }) =>
            input.terminalDeleteMutate ? await input.terminalDeleteMutate(payload) : { ok: true, message: "ok" },
        },
        globalList: {
          query: async (payload: { includeArchived?: boolean } = {}) =>
            input.terminalGlobalListQuery ? await input.terminalGlobalListQuery(payload) : { items: [] },
        },
        globalCreate: {
          mutate: async (payload: {
            terminalId?: string;
            processKind?: string;
            command?: string[];
            cwd?: string;
            profile?: unknown;
            focus?: boolean;
          }) =>
            input.terminalGlobalCreateMutate
              ? await input.terminalGlobalCreateMutate(payload)
              : { result: { ok: true, message: "ok", terminal: null } },
        },
        globalFocus: {
          mutate: async (payload: {
            op: "add" | "remove" | "replace" | "clear";
            terminalIds: string[];
            accessToken?: string;
          }) =>
            input.terminalGlobalFocusMutate
              ? await input.terminalGlobalFocusMutate(payload)
              : { ok: true, message: "ok", focusedTerminalIds: payload.terminalIds },
        },
        globalDelete: {
          mutate: async (payload: { terminalId: string }) =>
            input.terminalGlobalDeleteMutate
              ? await input.terminalGlobalDeleteMutate(payload)
              : { ok: true, message: "ok" },
        },
        globalSetConfig: {
          mutate: async (payload: { terminalId: string; cols?: number; rows?: number }) =>
            input.terminalGlobalSetConfigMutation
              ? await input.terminalGlobalSetConfigMutation(payload)
              : {
                  result: {
                    config: {
                      terminalId: payload.terminalId,
                      processKind: "shell",
                      command: ["/bin/bash"],
                      launchCwd: process.cwd(),
                      profile: {
                        cols: payload.cols,
                        rows: payload.rows,
                        rendererPreference: "auto" as const,
                        theme: "default-dark" as const,
                        cursor: "block" as const,
                      },
                      processPhase: "running" as const,
                    },
                    appliedLiveFields: [
                      payload.cols !== undefined ? "cols" : null,
                      payload.rows !== undefined ? "rows" : null,
                    ].filter((value): value is string => value !== null),
                    nextBootstrapFields: [],
                  },
                },
        },
        activityPage: {
          query: async (payload: {
            terminalId: string;
            before?: { beforeTimeMs: number; beforeId: number };
            limit?: number;
          }) =>
            input.terminalActivityPageQuery
              ? await input.terminalActivityPageQuery({ sessionId: "", ...payload })
              : { items: [], nextBefore: null, hasMoreBefore: false },
        },
        read: {
          query: async (payload: {
            terminalId: string;
            accessToken?: string;
            mode?: "auto" | "diff" | "snapshot";
            remark?: boolean;
            recordActivity?: boolean;
          }) =>
            input.terminalGlobalReadQuery
              ? await input.terminalGlobalReadQuery(payload)
              : {
                  kind: "terminal-snapshot",
                  representation: "snapshot",
                  terminalId: payload.terminalId,
                  seq: 0,
                  cols: 80,
                  rows: 24,
                  cursor: { x: 0, y: 0 },
                  tail: "",
                  snapshot: {
                    seq: 0,
                    timestamp: 0,
                    cols: 80,
                    rows: 24,
                    lines: Array.from({ length: 24 }, () => ""),
                    cursor: { x: 0, y: 0 },
                  },
                  status: "IDLE",
                  title: payload.terminalId,
                  running: true,
                },
        },
        write: {
          mutate: async (payload: {
            terminalId: string;
            accessToken?: string;
            text: string;
            createApprovalRequest?: boolean;
            readMode?: "auto" | "diff" | "snapshot";
            readRecordActivity?: boolean;
            returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
          }) =>
            input.terminalGlobalWriteMutate
              ? await input.terminalGlobalWriteMutate(payload)
              : { ok: true, message: "written" },
        },
        input: {
          mutate: async (payload: {
            terminalId: string;
            accessToken?: string;
            text: string;
            createApprovalRequest?: boolean;
            readMode?: "auto" | "diff" | "snapshot";
            readRecordActivity?: boolean;
            returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
          }) =>
            input.terminalGlobalInputMutate
              ? await input.terminalGlobalInputMutate(payload)
              : { ok: true, message: "written" },
        },
        listGrants: {
          query: async (payload: { terminalId: string }) =>
            input.terminalListGrantsQuery ? await input.terminalListGrantsQuery(payload) : { items: [] },
        },
        issueGrant: {
          mutate: async (payload: {
            terminalId: string;
            role: "admin" | "writer" | "guard" | "readonly";
            participantId: string;
            label?: string;
            accessTokenHint?: string;
            adminCandidateRank?: number | null;
          }) => (input.terminalIssueGrantMutate ? await input.terminalIssueGrantMutate(payload) : { grant: null }),
        },
        revokeGrant: {
          mutate: async (payload: { terminalId: string; grantId: string }) =>
            input.terminalRevokeGrantMutate ? await input.terminalRevokeGrantMutate(payload) : { ok: true },
        },
        listApprovalRequests: {
          query: async (payload: {
            terminalId: string;
            assignedAdminId?: string;
            participantId?: string;
            statuses?: Array<"pending" | "approved" | "denied" | "expired">;
          }) =>
            input.terminalListApprovalRequestsQuery
              ? await input.terminalListApprovalRequestsQuery(payload)
              : { items: [] },
        },
        permissionRequests: {
          subscribe: (
            payload: TerminalPermissionSubscriptionInput | undefined,
            handlers: SubscriptionHandlers,
          ) =>
            input.terminalPermissionRequestsSubscribe
              ? input.terminalPermissionRequestsSubscribe(payload, handlers)
              : { unsubscribe: () => {} },
        },
        approveRequest: {
          mutate: async (payload: { terminalId: string; requestId: string; durationMs: number }) =>
            input.terminalApproveRequestMutate
              ? await input.terminalApproveRequestMutate(payload)
              : { ok: true, message: "approved" },
        },
        denyRequest: {
          mutate: async (payload: { terminalId: string; requestId: string }) =>
            input.terminalDenyRequestMutate
              ? await input.terminalDenyRequestMutate(payload)
              : { ok: true, message: "denied" },
        },
      },
      draft: {
        resolve: {
          query: async () => ({
            cwd: process.cwd(),
            provider: { providerId: "default", apiStandard: "openai-responses", vendor: "openai", model: "test" },
            modelCapabilities: {
              streaming: true,
              tools: true,
              imageInput: false,
              nativeCompact: true,
              summarizeFallback: true,
              fileUpload: false,
              mcpCatalog: false,
            },
          }),
        },
      },
      settings: {
        read: {
          query: async () => ({
            path: "settings.json",
            content: "{}",
            mtimeMs: Date.now(),
          }),
        },
        save: {
          mutate: async () => ({
            ok: true as const,
            file: {
              path: "settings.json",
              content: "{}",
              mtimeMs: Date.now(),
            },
          }),
        },
        layers: {
          list: {
            query: async (payload: { workspacePath: string }) =>
              input.listSettingsLayersQuery
                ? await input.listSettingsLayersQuery(payload)
                : {
                    effective: { content: "{}" },
                    layers: [],
                  },
          },
          read: {
            query: async (payload: { workspacePath: string; layerId: string }) =>
              input.readSettingsLayerQuery
                ? await input.readSettingsLayerQuery(payload)
                : {
                    layer: {
                      layerId: payload.layerId,
                      sourceId: "project",
                      path: `${payload.workspacePath}/.agenter/settings.json`,
                      exists: true,
                      editable: true,
                    },
                    path: `${payload.workspacePath}/.agenter/settings.json`,
                    content: "{}",
                    mtimeMs: Date.now(),
                  },
          },
          save: {
            mutate: async (payload: {
              workspacePath: string;
              layerId: string;
              content: string;
              baseMtimeMs: number;
            }) =>
              input.saveSettingsLayerMutate
                ? await input.saveSettingsLayerMutate(payload)
                : {
                    ok: true as const,
                    file: {
                      path: `${payload.workspacePath}/.agenter/settings.json`,
                      content: payload.content,
                      mtimeMs: payload.baseMtimeMs + 1,
                    },
                    effective: {
                      content: payload.content,
                    },
                  },
          },
        },
        scope: {
          list: {
            query: async (payload: { scope: "workspace" | "global"; workspacePath?: string; avatar?: string }) =>
              input.listScopedSettingsQuery
                ? await input.listScopedSettingsQuery(payload)
                : {
                    scope: payload.scope,
                    effective: {
                      content: "{}",
                      value: {},
                      schema: { type: "object" },
                      provenance: {},
                    },
                    layers: [],
                  },
          },
          read: {
            query: async (payload: {
              scope: "workspace" | "global";
              workspacePath?: string;
              layerId: string;
              avatar?: string;
            }) =>
              input.readScopedSettingsLayerQuery
                ? await input.readScopedSettingsLayerQuery(payload)
                : {
                    layer: {
                      layerId: payload.layerId,
                      sourceId: "project",
                      kind: "file" as const,
                      path: payload.workspacePath
                        ? `${payload.workspacePath}/.agenter/settings.json`
                        : "~/.agenter/settings.json",
                      exists: true,
                      editable: true,
                    },
                    path: payload.workspacePath
                      ? `${payload.workspacePath}/.agenter/settings.json`
                      : "~/.agenter/settings.json",
                    content: "{}",
                    mtimeMs: Date.now(),
                  },
          },
          save: {
            mutate: async (payload: {
              scope: "workspace" | "global";
              workspacePath?: string;
              layerId: string;
              content: string;
              baseMtimeMs: number;
              avatar?: string;
            }) =>
              input.saveScopedSettingsLayerMutate
                ? await input.saveScopedSettingsLayerMutate(payload)
                : {
                    ok: true as const,
                    file: {
                      path: payload.workspacePath
                        ? `${payload.workspacePath}/.agenter/settings.json`
                        : "~/.agenter/settings.json",
                      content: payload.content,
                      mtimeMs: payload.baseMtimeMs + 1,
                    },
                    effective: {
                      content: payload.content,
                    },
                  },
          },
        },
      },
      profile: {
        service: {
          query: async () =>
            input.profileServiceQuery
              ? await input.profileServiceQuery()
              : {
                  endpoint: "http://127.0.0.1:4591",
                  authMode: "wallet_challenge_jwt",
                  rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
                  rootIdentifier: {
                    kind: "wallet_evm",
                    value: "0x0000000000000000000000000000000000000001",
                  },
                  rootAuthKeyPath: "~/.agenter/profile-service/root-auth.key",
                  jwtTtlSeconds: 3600,
                  rootAuthBootstrapMode: "managed_local",
                  canRevealRootAuthPrivateKey: true,
                  hasManagedRootAuthPrivateKey: true,
                  browserAutoLoginKeyPath: "~/.agenter/local.env",
                  browserAutoLoginConfigured: false,
                  browserAutoLoginBootstrapAvailable: true,
                },
        },
        list: {
          query: async () => ({ items: [] }),
        },
        get: {
          query: async () => ({
            profileId: null,
            identifiers: [],
            metadata: {},
            iconUrl: "http://127.0.0.1:4591/media/profiles/temp%3Ademo/icon",
            isVirtual: true,
          }),
        },
        update: {
          mutate: async (payload: { reference: string; patch: Record<string, unknown> }) => ({
            profileId: payload.reference,
            identifiers: [],
            metadata: payload.patch,
            iconUrl: `http://127.0.0.1:4591/media/profiles/${encodeURIComponent(payload.reference)}/icon`,
            isVirtual: false,
          }),
        },
        auth: {
          emailStart: {
            mutate: async (payload: { email: string }) => ({
              challengeId: `challenge:${payload.email}`,
              delivery: "console",
              expiresAt: new Date().toISOString(),
            }),
          },
          emailVerify: {
            mutate: async (payload: { email: string; code: string; token?: string }) => ({
              profile: {
                profileId: payload.email,
                identifiers: [{ kind: "email", value: payload.email }],
                metadata: {},
                iconUrl: `http://127.0.0.1:4591/media/profiles/${encodeURIComponent(payload.email)}/icon`,
                isVirtual: false,
              },
              registrationTicket: `ticket:${payload.code}`,
              expiresAt: new Date().toISOString(),
              registrationUrl: `http://127.0.0.1:4591/auth/webauthn/register?ticket=${encodeURIComponent(`ticket:${payload.code}`)}`,
            }),
          },
        },
      },
      avatar: {
        catalog: {
          query: async () => (input.globalAvatarCatalogQuery ? await input.globalAvatarCatalogQuery() : { items: [] }),
        },
        create: {
          mutate: async (payload: {
            nickname: string;
            displayName?: string | null;
            classify?: GlobalAvatarCatalogEntry["classify"];
          }) =>
            input.globalAvatarCreateMutate
              ? await input.globalAvatarCreateMutate(payload)
              : {
                  avatar: createAvatarCatalogEntry(payload.nickname, {
                    displayName: payload.displayName ?? null,
                    classify: payload.classify ?? null,
                    iconUrl: `http://127.0.0.1:4591/media/avatars/${encodeURIComponent(payload.nickname)}/icon`,
                  }),
                },
        },
      },
      skill: {
        catalog: {
          query: async (payload: { rootKind: "builtin" | "shared" | "global" }) =>
            input.skillCatalogQuery ? await input.skillCatalogQuery(payload) : { items: [] },
        },
        avatarCatalog: {
          query: async () => (input.skillAvatarCatalogQuery ? await input.skillAvatarCatalogQuery() : { items: [] }),
        },
        catalogTree: {
          query: async (payload: {
            rootKind: "builtin" | "shared" | "global";
            name: string;
            path?: string;
            offset?: number;
            limit?: number;
          }) =>
            input.skillCatalogTreeQuery
              ? await input.skillCatalogTreeQuery(payload)
              : { rootPath: "/", items: [], total: 0, nextOffset: null },
        },
        catalogPreview: {
          query: async (payload: {
            rootKind: "builtin" | "shared" | "global";
            name: string;
            path: string;
            maxBytes?: number;
          }) =>
            input.skillCatalogPreviewQuery
              ? await input.skillCatalogPreviewQuery(payload)
              : {
                  path: payload.path,
                  name: payload.path.split("/").at(-1) ?? "",
                  kind: "file",
                  sizeBytes: 0,
                  modifiedAtMs: 0,
                  previewKind: "text",
                  mimeType: "text/plain",
                  textContent: "",
                  mediaDataUrl: null,
                  truncated: false,
                  note: null,
                },
        },
        avatarTree: {
          query: async (payload: {
            avatarNickname: string;
            workspacePath: string;
            name: string;
            path?: string;
            offset?: number;
            limit?: number;
          }) =>
            input.skillAvatarTreeQuery
              ? await input.skillAvatarTreeQuery(payload)
              : { rootPath: "/", items: [], total: 0, nextOffset: null },
        },
        avatarPreview: {
          query: async (payload: {
            avatarNickname: string;
            workspacePath: string;
            name: string;
            path: string;
            maxBytes?: number;
          }) =>
            input.skillAvatarPreviewQuery
              ? await input.skillAvatarPreviewQuery(payload)
              : {
                  path: payload.path,
                  name: payload.path.split("/").at(-1) ?? "",
                  kind: "file",
                  sizeBytes: 0,
                  modifiedAtMs: 0,
                  previewKind: "text",
                  mimeType: "text/plain",
                  textContent: "",
                  mediaDataUrl: null,
                  truncated: false,
                  note: null,
                },
        },
      },
      notification: {
        snapshot: {
          query: async () =>
            input.notificationSnapshotQuery ? await input.notificationSnapshotQuery() : emptyNotificationSnapshot(),
        },
        setChatVisibility: {
          mutate: async (payload: { sessionId: string; visible: boolean; focused: boolean }) =>
            input.setChatVisibilityMutate ? await input.setChatVisibilityMutate(payload) : emptyNotificationSnapshot(),
        },
        setTerminalVisibility: {
          mutate: async (payload: { sessionId: string; terminalId?: string; visible: boolean; focused: boolean }) =>
            input.setTerminalVisibilityMutate
              ? await input.setTerminalVisibilityMutate(payload)
              : emptyNotificationSnapshot(),
        },
        consume: {
          mutate: async (payload: { sessionId: string; chatId?: string; terminalId?: string; upToSrc?: string }) =>
            input.consumeNotificationsMutate
              ? await input.consumeNotificationsMutate(payload)
              : emptyNotificationSnapshot(),
        },
      },
      task: {
        list: { query: async () => ({ ok: true, tasks: [] }) },
        triggerManual: { mutate: async () => ({ ok: true }) },
        emitEvent: { mutate: async () => ({ ok: true }) },
      },
      workspace: {
        recent: {
          query: async () => (input.workspaceRecentQuery ? input.workspaceRecentQuery() : { items: [process.cwd()] }),
        },
        listAll: { query: async () => (input.workspaceListAllQuery ? input.workspaceListAllQuery() : { items: [] }) },
        listSessions: {
          query: async () => ({ items: [], nextCursor: null, counts: { all: 0, running: 0, stopped: 0, archive: 0 } }),
        },
        avatarCatalog: {
          query: async (payload: { workspacePath: string }) =>
            input.workspaceAvatarCatalogQuery ? await input.workspaceAvatarCatalogQuery(payload) : { items: [] },
        },
        cliCatalog: {
          query: async (payload: { workspacePath: string; avatar: string }) =>
            input.workspaceCliCatalogQuery ? await input.workspaceCliCatalogQuery(payload) : { groups: [] },
        },
        exec: {
          mutate: async (payload: {
            runtimeId: string;
            workspacePath: string;
            avatar: string;
            surface?: "root-workspace" | "public-workspace";
            command: string;
            cwd?: string;
            env?: Record<string, string>;
            stdin?: string;
          }) =>
            input.workspaceExecMutate
              ? await input.workspaceExecMutate(payload)
              : { stdout: "", stderr: "", exitCode: 0, cwd: payload.cwd ?? payload.workspacePath },
        },
        forkAvatar: {
          mutate: async (payload: { workspacePath: string; avatar: string }) =>
            input.workspaceForkAvatarMutate
              ? await input.workspaceForkAvatarMutate(payload)
              : {
                  avatar: createAvatarCatalogEntry(payload.avatar, {
                    workspacePrivateSlotReady: true,
                  }),
                },
        },
        copyAvatar: {
          mutate: async (payload: { workspacePath: string; sourceAvatar: string; targetAvatar: string }) =>
            input.workspaceCopyAvatarMutate
              ? await input.workspaceCopyAvatarMutate(payload)
              : {
                  avatar: createAvatarCatalogEntry(payload.targetAvatar, {
                    globalAvailable: false,
                    workspacePrivateSlotReady: true,
                  }),
                },
        },
        searchPaths: {
          query: async () => ({ items: [] }),
        },
        toggleFavorite: { mutate: async () => ({ item: null }) },
        toggleSessionFavorite: { mutate: async () => ({ sessionId: "i-1", favorite: true }) },
        delete: { mutate: async () => ({ removed: true }) },
        cleanMissing: {
          mutate: async () =>
            input.workspaceCleanMissingMutate ? input.workspaceCleanMissingMutate() : { removed: [] },
        },
      },
      fs: {
        listDirectories: { query: async () => ({ items: [] }) },
        validateDirectory: { query: async () => ({ ok: true, path: process.cwd() }) },
      },
    } as unknown as AgenterClient["trpc"],
    wsUrl: "ws://127.0.0.1:3000/trpc",
    httpUrl: "http://127.0.0.1:3000",
    setAuthToken: (token) => {
      const normalized = token?.trim() ?? "";
      authToken = normalized.length > 0 ? normalized : null;
    },
    getAuthToken: () => authToken,
    subscribeTransport: (listener: (event: AgenterTransportEvent) => void) => {
      input.onTransportSubscribe?.(listener);
      return () => {};
    },
    close: () => {
      input.onClose?.();
    },
  };
};

const waitFor = async (predicate: () => boolean, timeoutMs = 4_000): Promise<void> => {
  const startAt = Date.now();
  while (Date.now() - startAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timeout waiting for condition");
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const withBrowserOnlineState = async (
  initialOnline: boolean,
  callback: (controls: { setOnline: (online: boolean) => void }) => Promise<void>,
): Promise<void> => {
  const eventTarget = new EventTarget();
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const navigatorValue = { onLine: initialOnline };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue,
  });

  try {
    await callback({
      setOnline: (online: boolean) => {
        navigatorValue.onLine = online;
        eventTarget.dispatchEvent(new Event(online ? "online" : "offline"));
      },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
};

const withAnimationFrameWindow = async (
  callback: (controls: { flushFrame: (time?: number) => void }) => Promise<void>,
): Promise<void> => {
  const eventTarget = new EventTarget();
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const handle = nextHandle++;
        frameCallbacks.set(handle, callback);
        return handle;
      },
      cancelAnimationFrame: (handle: number) => {
        frameCallbacks.delete(handle);
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });

  try {
    await callback({
      flushFrame: (time = 0) => {
        const callbacks = [...frameCallbacks.values()];
        frameCallbacks.clear();
        for (const callback of callbacks) {
          callback(time);
        }
      },
    });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
};

describe("Feature: runtime store synchronization", () => {
  test("Scenario: Given browser-frame batching When hot runtime events burst before the next frame Then listeners observe one coalesced publication", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });

    await withAnimationFrameWindow(async ({ flushFrame }) => {
      const store = new RuntimeStore(client);
      let publishCount = 0;
      store.subscribe(() => {
        publishCount += 1;
      });

      await store.connect();
      expect(publishCount).toBe(0);

      flushFrame();
      expect(publishCount).toBe(1);

      onData?.({
        version: 1,
        eventId: 11,
        timestamp: Date.now(),
        type: "runtime.phase",
        sessionId: "i-1",
        payload: { phase: "collecting_inputs" },
      });
      onData?.({
        version: 1,
        eventId: 12,
        timestamp: Date.now(),
        type: "runtime.observability.trace",
        sessionId: "i-1",
        payload: {
          entry: createTraceEntry({
            id: 12,
            cycleId: 1,
            attributes: { inputs: 2 },
          }),
        },
      });

      expect(publishCount).toBe(1);

      flushFrame();
      expect(publishCount).toBe(2);
      expect(store.getState().runtimes["i-1"]?.schedulerPhase).toBe("collecting_inputs");
      expect(store.getState().observabilityTracesBySession["i-1"]?.length).toBe(1);

      store.disconnect();
    });
  });

  test("Scenario: Given subscription events When applying updates Then state stays ordered and deduped", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let onError: (() => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
        onError = handlers.onError;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().connected).toBe(true);
    expect(store.getState().lastEventId).toBe(10);
    expect(store.getState().recentWorkspaces).toHaveLength(1);
    expect(store.getState().activityBySession["i-1"]).toBe("idle");
    expect(store.getState().terminalSnapshotsBySession["i-1"]?.main?.seq).toBe(0);

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "m-1",
          role: "assistant",
          content: "hello",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsBySession["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 9,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "ignored",
          role: "assistant",
          content: "ignored",
          timestamp: Date.now(),
        },
      },
    });
    expect(store.getState().chatsBySession["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 12,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "calling_model" },
    });
    expect(store.getState().runtimes["i-1"]?.schedulerPhase).toBe("calling_model");
    expect(store.getState().activityBySession["i-1"]).toBe("active");

    onData?.({
      version: 1,
      eventId: 13,
      timestamp: Date.now(),
      type: "terminal.snapshot",
      sessionId: "i-1",
      payload: {
        terminalId: "main",
        snapshot: {
          seq: 2,
          timestamp: Date.now(),
          cols: 80,
          rows: 24,
          lines: ["hello"],
          cursor: { x: 5, y: 0 },
        },
      },
    });
    expect(store.getState().terminalSnapshotsBySession["i-1"]?.main?.lines[0]).toBe("hello");

    onData?.({
      version: 1,
      eventId: 14,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "waiting_commits" },
    });
    expect(store.getState().activityBySession["i-1"]).toBe("idle");

    onError?.();
    expect(store.getState().connected).toBe(false);
    expect(store.getState().connectionStatus).toBe("reconnecting");
    store.disconnect();
  });

  test("Scenario: Given unchanged attention data When non-attention runtime events arrive Then the attention reference stays stable", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const attention = {
      snapshot: {
        contexts: [
          createAttentionContext({
            contextId: "ctx-chat-main",
            owner: "tester-bot",
            content: "current notebook",
            scoreMap: { abcd12: 100 },
            commit: createAttentionCommit({
              commitId: "commit-1",
              contextId: "ctx-chat-main",
              author: "tester-bot",
              source: "message",
              summary: "User asked for a reply",
              value: "current notebook",
              scores: { abcd12: 100 },
            }),
          }),
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    } satisfies NonNullable<RuntimeSnapshot["runtimes"][string]["attention"]>;

    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(10, { attention }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const initialAttention = store.getState().attentionBySession?.["i-1"];
    expect(initialAttention).toBeDefined();

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "collecting_inputs" },
    });

    expect(store.getState().attentionBySession?.["i-1"]).toBe(initialAttention);

    store.disconnect();
  });

  test("Scenario: Given snapshot and focused-terminal events When multiple focused terminals are published Then the ordered focus set stays primary", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const snapshot = createSnapshot(40);
    snapshot.runtimes["i-1"] = {
      ...snapshot.runtimes["i-1"],
      focusedTerminalId: "legacy-main",
      focusedTerminalIds: ["aux", "main", "aux"],
    };

    const client = createMockClient({
      snapshotQuery: async () => snapshot,
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().runtimes["i-1"]?.focusedTerminalIds).toEqual(["aux", "main"]);
    expect(store.getState().runtimes["i-1"]?.focusedTerminalId).toBe("aux");

    onData?.({
      version: 1,
      eventId: 41,
      timestamp: Date.now(),
      type: "runtime.focusedTerminal",
      sessionId: "i-1",
      payload: {
        terminalId: "stale-single",
        terminalIds: ["main", "aux", "main"],
      },
    });

    expect(store.getState().runtimes["i-1"]?.focusedTerminalIds).toEqual(["main", "aux"]);
    expect(store.getState().runtimes["i-1"]?.focusedTerminalId).toBe("main");
    store.disconnect();
  });

  test("Scenario: Given terminal read events When representation metadata is published Then the runtime store preserves it without inference", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(60),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    onData?.({
      version: 1,
      eventId: 61,
      timestamp: Date.now(),
      type: "terminal.read",
      sessionId: "i-1",
      payload: {
        terminalId: "main",
        result: {
          kind: "terminal-diff",
          representation: "diff",
          terminalId: "main",
          fromHash: "10",
          toHash: "11",
          diff: "echo ready",
          bytes: 10,
          status: "IDLE",
        },
      },
    });

    expect(store.getState().terminalReadsBySession["i-1"]?.main?.representation).toBe("diff");
    expect(store.getState().runtimes["i-1"]?.terminalReads.main?.kind).toBe("terminal-diff");
    store.disconnect();
  });

  test("Scenario: Given first snapshot request fails When reconnecting Then store recovers automatically", async () => {
    let callCount = 0;
    const client = createMockClient({
      snapshotQuery: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("network-error");
        }
        return createSnapshot(20);
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => store.getState().connected);
    expect(store.getState().lastEventId).toBe(20);
    expect(store.getState().connectionStatus).toBe("connected");
    store.disconnect();
  });

  test("Scenario: Given secondary chrome queries are slow When connect succeeds Then runtime state hydrates before workspace and notification chrome", async () => {
    const workspacesDeferred = createDeferred<{
      items: Array<{
        path: string;
        favorite: boolean;
        group: string;
        missing: boolean;
        counts: { all: number; running: number; stopped: number; archive: number };
        lastSessionActivityAt?: string;
      }>;
    }>();
    const notificationsDeferred = createDeferred<{
      items: Array<{
        id: string;
        sessionId: string;
        src: string;
        sourceNamespace: string;
        sourceId: string;
        bucketKey: string;
        attentionContextId: string;
        attentionCommitId: string;
        workspacePath: string;
        sessionName: string;
        content: string;
        timestamp: number;
      }>;
      unreadBySession: Record<string, number>;
      unreadByBucket: Record<string, Record<string, number>>;
    }>();
    const client = createMockClient({
      snapshotQuery: async () =>
        createSnapshot(26, {
          messageChannels: [
            {
              chatId: "room-main",
              kind: "room",
              title: "Main room",
              owner: "tester-bot",
              participants: [
                { id: "session:tester-bot", label: "tester-bot" },
                { id: "auth:user", label: "User" },
              ],
              createdAt: 1,
              updatedAt: 2,
              focused: true,
              accessRole: "admin",
              accessToken: "msgtok_roommain",
              transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_roommain",
            },
          ],
        }),
      workspaceListAllQuery: async () => await workspacesDeferred.promise,
      notificationSnapshotQuery: async () => await notificationsDeferred.promise,
    });
    const store = new RuntimeStore(client);

    await store.connect();

    expect(store.getState().connectionStatus).toBe("connected");
    expect(store.getState().messageChannelsBySession["i-1"]?.data).toHaveLength(1);
    expect(store.getState().workspaces).toEqual([]);
    expect(store.getState().notifications).toEqual([]);

    workspacesDeferred.resolve({
      items: [
        {
          path: process.cwd(),
          favorite: true,
          group: "default",
          missing: false,
          counts: { all: 1, running: 1, stopped: 0, archive: 0 },
        },
      ],
    });
    notificationsDeferred.resolve({
      items: [
        {
          id: "notif-1",
          sessionId: "i-1",
          src: "msg:chat-main/1",
          sourceNamespace: "msg",
          sourceId: "chat-main",
          bucketKey: "msg:chat-main",
          attentionContextId: "ctx-chat-main",
          attentionCommitId: "commit-1",
          workspacePath: process.cwd(),
          sessionName: "workspace",
          content: "reply pending",
          timestamp: Date.now(),
        },
      ],
      unreadBySession: { "i-1": 1 },
      unreadByBucket: { "i-1": { "msg:chat-main": 1 } },
    });

    await waitFor(() => store.getState().workspaces.length === 1 && store.getState().notifications.length === 1);

    expect(store.getState().unreadBySession["i-1"]).toBe(1);
    store.disconnect();
  });

  test("Scenario: Given browser goes offline When runtime store is connected Then connectionStatus becomes offline immediately", async () => {
    await withBrowserOnlineState(true, async ({ setOnline }) => {
      const client = createMockClient({
        snapshotQuery: async () => createSnapshot(25),
      });
      const store = new RuntimeStore(client);

      await store.connect();
      expect(store.getState().connectionStatus).toBe("connected");

      setOnline(false);

      expect(store.getState().connected).toBe(false);
      expect(store.getState().connectionStatus).toBe("offline");
      store.disconnect();
    });
  });

  test("Scenario: Given a non-browser window shim When runtime store connects in Bun Then browser listener wiring is skipped without breaking connectivity", async () => {
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(27),
    });
    const store = new RuntimeStore(client);
    const originalWindow = globalThis.window;
    const originalNavigator = globalThis.navigator;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { onLine: true },
    });

    try {
      await store.connect();
      expect(store.getState().connected).toBe(true);
      expect(store.getState().connectionStatus).toBe("connected");
      expect(store.getState().lastEventId).toBe(27);
      store.disconnect();
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  });

  test("Scenario: Given retained API-call streams When reconnect succeeds Then the runtime restores them from the saved cursor without duplicates", async () => {
    let transportListener: ((event: AgenterTransportEvent) => void) | undefined;
    const apiCallSubscriptions: Array<{ sessionId: string; afterId: number }> = [];
    const apiCallHandlers: Array<{ onData?: (payload: unknown) => void; onError?: () => void }> = [];
    let snapshotCallCount = 0;

    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCallCount += 1;
        return createSnapshot(snapshotCallCount === 1 ? 30 : 31);
      },
      onTransportSubscribe: (listener) => {
        transportListener = listener;
      },
      apiCallsSubscribe: (
        payload: { sessionId: string; afterId: number },
        handlers: { onData?: (payload: unknown) => void; onError?: () => void },
      ) => {
        apiCallSubscriptions.push(payload);
        apiCallHandlers.push(handlers);
        return {
          unsubscribe: () => {},
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const release = store.retainApiCallStream("i-1");
    expect(apiCallSubscriptions).toEqual([{ sessionId: "i-1", afterId: 0 }]);

    apiCallHandlers[0]?.onData?.({
      type: "apiCall",
      payload: {
        id: 5,
        modelCallId: 1,
        createdAt: Date.now(),
        request: { prompt: "hello" },
        response: { output: "world" },
      },
    });
    expect(store.getState().apiCallsBySession["i-1"]?.map((entry) => entry.id)).toEqual([5]);

    transportListener?.({ type: "close" });
    expect(store.getState().connectionStatus).toBe("reconnecting");

    transportListener?.({ type: "open" });

    await waitFor(() => apiCallSubscriptions.length === 2);
    expect(apiCallSubscriptions[1]).toEqual({ sessionId: "i-1", afterId: 5 });
    await waitFor(() => store.getState().connectionStatus === "connected");

    apiCallHandlers[1]?.onData?.({
      type: "apiCall",
      payload: {
        id: 5,
        modelCallId: 1,
        createdAt: Date.now(),
        request: { prompt: "hello" },
        response: { output: "world" },
      },
    });
    apiCallHandlers[1]?.onData?.({
      type: "apiCall",
      payload: {
        id: 6,
        modelCallId: 2,
        createdAt: Date.now(),
        request: { prompt: "next" },
        response: { output: "reply" },
      },
    });

    expect(store.getState().apiCallsBySession["i-1"]?.map((entry) => entry.id)).toEqual([5, 6]);
    release();
    store.disconnect();
  });

  test("Scenario: Given createSession call succeeds When events have not arrived yet Then local state is updated optimistically", async () => {
    const nowIso = new Date().toISOString();
    const newSession: SessionEntry = {
      id: "i-2",
      name: "workspace-2",
      cwd: process.cwd(),
      workspacePath: process.cwd(),
      avatar: "tester-bot",
      createdAt: nowIso,
      updatedAt: nowIso,
      status: "running" as const,
      storageState: "active" as const,
      sessionRoot: "/tmp/sessions/i-2",
      storeTarget: "global" as const,
    };
    const client = createMockClient({
      snapshotQuery: async () => ({
        ...createSnapshot(30),
        sessions: [],
        runtimes: {},
      }),
      createSessionResult: newSession,
    });
    const store = new RuntimeStore(client);

    await store.connect();
    expect(store.getState().sessions).toHaveLength(0);

    const created = await store.createSession({ cwd: process.cwd(), autoStart: true });
    expect(created.id).toBe("i-2");
    expect(store.getState().sessions.some((session) => session.id === "i-2")).toBe(true);
    expect(store.getState().runtimes["i-2"]).toBeDefined();
    expect(store.getState().chatsBySession["i-2"]).toEqual([]);

    store.disconnect();
  });

  test("Scenario: Given runtime usage analytics query is available When the store requests it Then the typed token totals are returned without local recomputation", async () => {
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(30),
      usageAnalyticsQuery: async (input) => ({
        granularity: input.granularity ?? "raw",
        sinceMs: input.sinceMs,
        untilMs: input.untilMs,
        filters: input.filters ?? {},
        totals: {
          callCount: 2,
          inputTokens: 640,
          outputTokens: 160,
          totalTokens: 800,
          cachedInputTokens: { value: 64, knownCallCount: 1 },
          reasoningTokens: { value: 24, knownCallCount: 1 },
          uncachedInputTokens: { value: 576, knownCallCount: 1 },
        },
        items: [],
      }),
    });
    const store = new RuntimeStore(client);

    const result = await store.queryUsageAnalytics({
      sessionId: "i-1",
      sinceMs: 1_000,
      untilMs: 2_000,
      granularity: "raw",
      filters: {
        kind: "model",
      },
    });

    expect(result).toEqual({
      granularity: "raw",
      sinceMs: 1_000,
      untilMs: 2_000,
      filters: {
        kind: "model",
      },
      totals: {
        callCount: 2,
        inputTokens: 640,
        outputTokens: 160,
        totalTokens: 800,
        cachedInputTokens: { value: 64, knownCallCount: 1 },
        reasoningTokens: { value: 24, knownCallCount: 1 },
        uncachedInputTokens: { value: 576, knownCallCount: 1 },
      },
      items: [],
    });
  });

  test("Scenario: Given high-volume loopbus traces When streaming updates Then memory keeps only LRU 100 items", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(40),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    for (let index = 0; index < 160; index += 1) {
      const eventId = 41 + index;
      onData?.({
        version: 1,
        eventId,
        timestamp: Date.now(),
        type: "runtime.observability.trace",
        sessionId: "i-1",
        payload: {
          entry: createTraceEntry({
            id: eventId,
            cycleId: index + 1,
            kind: "model.call",
            name: "call_model",
            attributes: { inputs: 1 },
          }),
        },
      });
    }

    const traces = store.getState().observabilityTracesBySession["i-1"] ?? [];
    expect(traces.length).toBe(100);
    expect(traces[0]?.id).toBe(101);
    expect(traces.at(-1)?.id).toBe(200);
    store.disconnect();
  });

  test("Scenario: Given one model call id emits running then done When runtime events arrive Then the store merges lifecycle updates into one record", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(300),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 301,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 11,
          cycleId: 4,
          createdAt: 100,
          status: "running",
          provider: "deepseek/openai-chat",
          model: "deepseek-chat",
          request: { messages: [{ role: "user", content: "hello" }] },
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 302,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 11,
          cycleId: 4,
          createdAt: 100,
          status: "done",
          completedAt: 150,
          provider: "deepseek/openai-chat",
          model: "deepseek-chat",
          request: { messages: [{ role: "user", content: "hello" }] },
          response: { assistant: { text: "hi" } },
        },
      },
    });

    expect(store.getState().modelCallsBySession["i-1"]).toHaveLength(1);
    expect(store.getState().modelCallsBySession["i-1"]?.[0]).toMatchObject({
      id: 11,
      cycleId: 4,
      status: "done",
      completedAt: 150,
      provider: "deepseek/openai-chat",
      model: "deepseek-chat",
      request: { messages: [{ role: "user", content: "hello" }] },
      response: { assistant: { text: "hi" } },
    });

    store.disconnect();
  });

  test("Scenario: Given runtime snapshot already contains attention delivery facts When the store connects Then delivery state hydrates separately from attention truth", async () => {
    const delivery = createAttentionDeliveryState({
      projections: [
        {
          contextId: "ctx-room-main",
          commitId: "commit-1",
          state: "dispatching",
          attemptCount: 1,
          latestDispatchId: "dispatch-1",
          latestReceiptId: null,
          agentCallId: "agent-call-1",
          sessionModelCallId: null,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      ],
      dispatches: [
        {
          dispatchId: "dispatch-1",
          contextId: "ctx-room-main",
          commitId: "commit-1",
          cycleId: 7,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: null,
          createdAt: 1700000000000,
        },
      ],
    });
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(320, { attentionDelivery: delivery }),
      }),
    );

    await store.connect();

    expect(store.getState().runtimes["i-1"]?.attentionDelivery).toEqual(delivery);
    expect(store.getState().attentionDeliveryBySession["i-1"]).toEqual(delivery);
    expect(store.getState().attentionBySession["i-1"]?.snapshot.contexts).toEqual([]);
    store.disconnect();
  });

  test("Scenario: Given a dispatch is visible before the ai_call row binds When running modelCall events arrive Then delivery stays dispatching instead of becoming accepted", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(330),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    onData?.({
      version: 1,
      eventId: 331,
      timestamp: Date.now(),
      type: "runtime.attentionDispatch",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-1",
          contextId: "ctx-room-main",
          commitId: "commit-1",
          cycleId: 7,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: null,
          createdAt: 1700000000000,
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-1",
          state: "dispatching",
          attemptCount: 1,
          latestDispatchId: "dispatch-1",
          latestReceiptId: null,
          agentCallId: "agent-call-1",
          sessionModelCallId: null,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 332,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: createModelCallItem({
          id: 77,
          cycleId: 7,
          status: "running",
          provider: "openai",
          model: "gpt-5.4",
          createdAt: 1700000000010,
        }),
      },
    });

    onData?.({
      version: 1,
      eventId: 333,
      timestamp: Date.now(),
      type: "runtime.attentionDispatch",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-1",
          contextId: "ctx-room-main",
          commitId: "commit-1",
          cycleId: 7,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: 77,
          createdAt: 1700000000000,
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-1",
          state: "dispatching",
          attemptCount: 1,
          latestDispatchId: "dispatch-1",
          latestReceiptId: null,
          agentCallId: "agent-call-1",
          sessionModelCallId: 77,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      },
    });

    const delivery = store.getState().attentionDeliveryBySession["i-1"];
    expect(delivery?.projections).toEqual([
      expect.objectContaining({
        state: "dispatching",
        sessionModelCallId: 77,
        firstAcceptedAt: null,
      }),
    ]);
    expect(delivery?.dispatches).toEqual([
      expect.objectContaining({
        dispatchId: "dispatch-1",
        sessionModelCallId: 77,
      }),
    ]);
    expect(delivery?.receipts).toEqual([]);
    store.disconnect();
  });

  test("Scenario: Given the first delivery receipt is a provider error When runtime receipt events arrive Then the store keeps errored truth without synthesizing accepted", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(340),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    onData?.({
      version: 1,
      eventId: 341,
      timestamp: Date.now(),
      type: "runtime.attentionDispatch",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-err-1",
          contextId: "ctx-room-main",
          commitId: "commit-err-1",
          cycleId: 8,
          attemptIndex: 1,
          agentCallId: "agent-call-err-1",
          sessionModelCallId: 88,
          createdAt: 1700000001000,
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-err-1",
          state: "dispatching",
          attemptCount: 1,
          latestDispatchId: "dispatch-err-1",
          latestReceiptId: null,
          agentCallId: "agent-call-err-1",
          sessionModelCallId: 88,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 342,
      timestamp: Date.now(),
      type: "runtime.attentionReceipt",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-err-1",
          contextId: "ctx-room-main",
          commitId: "commit-err-1",
          cycleId: 8,
          attemptIndex: 1,
          agentCallId: "agent-call-err-1",
          sessionModelCallId: 88,
          createdAt: 1700000001000,
        },
        receipt: {
          receiptId: "receipt-err-1",
          dispatchId: "dispatch-err-1",
          contextId: "ctx-room-main",
          commitId: "commit-err-1",
          cycleId: 8,
          attemptIndex: 1,
          agentCallId: "agent-call-err-1",
          sessionModelCallId: 88,
          status: "errored",
          providerEventKind: "run_error",
          timestamp: 1700000001010,
          errorCode: "provider.unavailable",
          errorMessage: "upstream rejected the first frame",
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-err-1",
          state: "errored",
          attemptCount: 1,
          latestDispatchId: "dispatch-err-1",
          latestReceiptId: "receipt-err-1",
          agentCallId: "agent-call-err-1",
          sessionModelCallId: 88,
          firstAcceptedAt: null,
          latestReceiptAt: 1700000001010,
          latestError: {
            code: "provider.unavailable",
            message: "upstream rejected the first frame",
          },
        },
      },
    });

    const delivery = store.getState().attentionDeliveryBySession["i-1"];
    expect(delivery?.projections).toEqual([
      expect.objectContaining({
        state: "errored",
        latestReceiptId: "receipt-err-1",
        firstAcceptedAt: null,
      }),
    ]);
    expect(delivery?.receipts.map((receipt) => receipt.status)).toEqual(["errored"]);
    expect(delivery?.receipts.some((receipt) => receipt.status === "accepted")).toBe(false);
    store.disconnect();
  });

  test("Scenario: Given accepted and completed delivery receipts stream in order When the store applies them Then attempt history stays separate from the model lifecycle row", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(350),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    onData?.({
      version: 1,
      eventId: 351,
      timestamp: Date.now(),
      type: "runtime.attentionDispatch",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-ok-1",
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          cycleId: 9,
          attemptIndex: 2,
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          createdAt: 1700000002000,
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          state: "dispatching",
          attemptCount: 2,
          latestDispatchId: "dispatch-ok-1",
          latestReceiptId: null,
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 352,
      timestamp: Date.now(),
      type: "runtime.attentionReceipt",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-ok-1",
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          cycleId: 9,
          attemptIndex: 2,
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          createdAt: 1700000002000,
        },
        receipt: {
          receiptId: "receipt-ok-1",
          dispatchId: "dispatch-ok-1",
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          cycleId: 9,
          attemptIndex: 2,
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          status: "accepted",
          providerEventKind: "text_delta",
          timestamp: 1700000002010,
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          state: "accepted",
          attemptCount: 2,
          latestDispatchId: "dispatch-ok-1",
          latestReceiptId: "receipt-ok-1",
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          firstAcceptedAt: 1700000002010,
          latestReceiptAt: 1700000002010,
          latestError: null,
        },
      },
    });

    onData?.({
      version: 1,
      eventId: 353,
      timestamp: Date.now(),
      type: "runtime.attentionReceipt",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-ok-1",
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          cycleId: 9,
          attemptIndex: 2,
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          createdAt: 1700000002000,
        },
        receipt: {
          receiptId: "receipt-ok-2",
          dispatchId: "dispatch-ok-1",
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          cycleId: 9,
          attemptIndex: 2,
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          status: "completed",
          providerEventKind: "run_finished",
          timestamp: 1700000002020,
          finishReason: "stop",
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-ok-1",
          state: "completed",
          attemptCount: 2,
          latestDispatchId: "dispatch-ok-1",
          latestReceiptId: "receipt-ok-2",
          agentCallId: "agent-call-ok-2",
          sessionModelCallId: 99,
          firstAcceptedAt: 1700000002010,
          latestReceiptAt: 1700000002020,
          latestError: null,
        },
      },
    });

    const delivery = store.getState().attentionDeliveryBySession["i-1"];
    expect(delivery?.projections).toEqual([
      expect.objectContaining({
        state: "completed",
        attemptCount: 2,
        firstAcceptedAt: 1700000002010,
      }),
    ]);
    expect(delivery?.receipts.map((receipt) => receipt.status)).toEqual(["accepted", "completed"]);
    expect(store.getState().modelCallsBySession["i-1"]).toEqual([]);
    store.disconnect();
  });

  test("Scenario: Given delivery inspection APIs exist When the runtime store queries them Then the request goes through dedicated delivery endpoints", async () => {
    const delivery = createAttentionDeliveryState({
      projections: [
        {
          contextId: "ctx-room-main",
          commitId: "commit-1",
          state: "dispatching",
          attemptCount: 1,
          latestDispatchId: "dispatch-1",
          latestReceiptId: null,
          agentCallId: "agent-call-1",
          sessionModelCallId: null,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      ],
    });
    const deliveryStateCalls: Array<{ sessionId: string }> = [];
    const deliveryTimelineCalls: Array<{
      sessionId: string;
      contextId?: string;
      commitId?: string;
      cycleId?: number;
      sessionModelCallId?: number;
      limit?: number;
    }> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(360),
        attentionDeliveryStateQuery: async (input) => {
          deliveryStateCalls.push(input);
          return delivery;
        },
        attentionDeliveryTimelineQuery: async (input) => {
          deliveryTimelineCalls.push(input);
          return delivery;
        },
      }),
    );

    await store.connect();

    await expect(store.inspectAttentionDeliveryState("i-1")).resolves.toEqual(delivery);
    await expect(
      store.queryAttentionDeliveryTimeline({
        sessionId: "i-1",
        contextId: "ctx-room-main",
        commitId: "commit-1",
        limit: 10,
      }),
    ).resolves.toEqual(delivery);

    expect(deliveryStateCalls).toEqual([{ sessionId: "i-1" }]);
    expect(deliveryTimelineCalls).toEqual([
      {
        sessionId: "i-1",
        contextId: "ctx-room-main",
        commitId: "commit-1",
        limit: 10,
      },
    ]);
    store.disconnect();
  });

  test("Scenario: Given runtime snapshot includes explicit delivery effects When the store hydrates Then dispatch history and effect ledger stay distinguishable in consumed state", async () => {
    const delivery = createAttentionDeliveryState({
      projections: [
        {
          contextId: "ctx-room-main",
          commitId: "commit-1",
          state: "completed",
          attemptCount: 1,
          latestDispatchId: "dispatch-1",
          latestReceiptId: "receipt-1",
          agentCallId: "agent-call-1",
          sessionModelCallId: 55,
          firstAcceptedAt: 1700000000001,
          latestReceiptAt: 1700000000002,
          latestError: null,
        },
      ],
      dispatches: [
        {
          dispatchId: "dispatch-1",
          contextId: "ctx-room-main",
          commitId: "commit-1",
          cycleId: 12,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: 55,
          createdAt: 1700000000000,
        },
      ],
      receipts: [
        {
          receiptId: "receipt-1",
          dispatchId: "dispatch-1",
          contextId: "ctx-room-main",
          commitId: "commit-1",
          cycleId: 12,
          attemptIndex: 1,
          agentCallId: "agent-call-1",
          sessionModelCallId: 55,
          status: "completed",
          providerEventKind: "run_finished",
          timestamp: 1700000000002,
          finishReason: "stop",
        },
      ],
      effects: [
        {
          id: 1,
          effectId: "effect-1",
          contextId: "ctx-room-main",
          commitId: "commit-1",
          actionId: "action-message-send-1",
          actionKind: "message_send",
          actorId: "assistant",
          cycleId: 12,
          sessionModelCallId: 55,
          target: "room:room-main",
          effectKind: "message_row_created",
          effectRecordId: "room-main/17",
          timestamp: 1700000000003,
          meta: { chatId: "room-main", messageId: 17 },
        },
      ],
    });
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(365, { attentionDelivery: delivery }),
      }),
    );

    await store.connect();

    expect(store.getState().attentionDeliveryBySession["i-1"]).toEqual(
      expect.objectContaining({
        dispatches: [
          expect.objectContaining({
            dispatchId: "dispatch-1",
            sessionModelCallId: 55,
          }),
        ],
        receipts: [
          expect.objectContaining({
            receiptId: "receipt-1",
            status: "completed",
          }),
        ],
        effects: [
          expect.objectContaining({
            effectId: "effect-1",
            actionKind: "message_send",
            target: "room:room-main",
            effectKind: "message_row_created",
          }),
        ],
      }),
    );
    expect(store.getState().attentionDeliveryBySession["i-1"]?.dispatches[0]?.dispatchId).toBe("dispatch-1");
    expect(store.getState().attentionDeliveryBySession["i-1"]?.effects[0]?.effectId).toBe("effect-1");
    store.disconnect();
  });

  test("Scenario: Given model-call delta events When duplicate ids and incremental deltas arrive Then the store merges by id while preserving ordered timeline", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(320),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 321,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 1,
          seq: 1,
          modelCallId: 11,
          cycleId: 4,
          timestamp: 100,
          kind: "assistant_draft",
          data: { content: "draft v1" },
        },
      },
    });
    onData?.({
      version: 1,
      eventId: 322,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 1,
          seq: 1,
          modelCallId: 11,
          cycleId: 4,
          timestamp: 101,
          kind: "assistant_draft",
          data: { content: "draft v2" },
        },
      },
    });
    onData?.({
      version: 1,
      eventId: 323,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 2,
          seq: 2,
          modelCallId: 11,
          cycleId: 4,
          timestamp: 102,
          kind: "tool_call",
          data: { toolName: "terminal_read", toolCallId: "call-1" },
        },
      },
    });

    expect(store.getState().modelCallDeltasBySession?.["i-1"]).toEqual([
      {
        id: 1,
        seq: 1,
        modelCallId: 11,
        cycleId: 4,
        timestamp: 101,
        kind: "assistant_draft",
        data: { content: "draft v2" },
      },
      {
        id: 2,
        seq: 2,
        modelCallId: 11,
        cycleId: 4,
        timestamp: 102,
        kind: "tool_call",
        data: { toolName: "terminal_read", toolCallId: "call-1" },
      },
    ]);

    store.disconnect();
  });

  test("Scenario: Given high-volume model-call deltas When runtime streams beyond limit Then the store keeps only LRU 400 items", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(340),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    for (let index = 0; index < 450; index += 1) {
      const id = index + 1;
      onData?.({
        version: 1,
        eventId: 341 + index,
        timestamp: Date.now(),
        type: "runtime.modelCall.delta",
        sessionId: "i-1",
        payload: {
          entry: {
            id,
            seq: id,
            modelCallId: 77,
            cycleId: 31,
            timestamp: 10_000 + id,
            kind: "assistant_draft",
            data: { content: `draft-${id}` },
          },
        },
      });
    }

    const deltas = store.getState().modelCallDeltasBySession?.["i-1"] ?? [];
    expect(deltas).toHaveLength(400);
    expect(deltas[0]?.id).toBe(51);
    expect(deltas.at(-1)?.id).toBe(450);

    store.disconnect();
  });

  test("Scenario: Given model-call deltas in memory When session is deleted by API or event Then delta cache is cleared", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(360),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    onData?.({
      version: 1,
      eventId: 361,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 1,
          seq: 1,
          modelCallId: 9,
          cycleId: 3,
          timestamp: 100,
          kind: "assistant_draft",
          data: { content: "draft" },
        },
      },
    });
    expect(store.getState().modelCallDeltasBySession?.["i-1"]?.length).toBe(1);

    await store.deleteSession("i-1");
    expect(store.getState().modelCallDeltasBySession?.["i-1"]).toBeUndefined();

    await store.connect();
    onData?.({
      version: 1,
      eventId: 362,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 2,
          seq: 2,
          modelCallId: 10,
          cycleId: 4,
          timestamp: 101,
          kind: "assistant_draft",
          data: { content: "draft-again" },
        },
      },
    });
    expect(store.getState().modelCallDeltasBySession?.["i-1"]?.length).toBe(1);

    onData?.({
      version: 1,
      eventId: 363,
      timestamp: Date.now(),
      type: "session.deleted",
      payload: { sessionId: "i-1" },
    });
    expect(store.getState().modelCallDeltasBySession?.["i-1"]).toBeUndefined();

    store.disconnect();
  });

  test("Scenario: Given missing workspaces When cleaning them Then store refreshes workspace state", async () => {
    let recentCalls = 0;
    let listAllCalls = 0;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(500),
      workspaceRecentQuery: async () => {
        recentCalls += 1;
        return { items: ["/repo/kept"] };
      },
      workspaceListAllQuery: async () => {
        listAllCalls += 1;
        return {
          items: [
            {
              path: "/repo/kept",
              favorite: false,
              group: "Other",
              missing: false,
              counts: { all: 0, running: 0, stopped: 0, archive: 0 },
            },
          ],
        };
      },
      workspaceCleanMissingMutate: async () => ({ removed: ["/repo/missing"] }),
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => listAllCalls === 1 && store.getState().workspaces[0]?.path === "/repo/kept");
    const removed = await store.cleanMissingWorkspaces();

    expect(removed).toEqual(["/repo/missing"]);
    expect(store.getState().recentWorkspaces).toEqual(["/repo/kept"]);
    expect(store.getState().workspaces[0]?.path).toBe("/repo/kept");
    expect(recentCalls).toBeGreaterThanOrEqual(2);
    expect(listAllCalls).toBeGreaterThanOrEqual(2);
    store.disconnect();
  });

  test("Scenario: Given workspace-scoped settings When loading and saving layers Then store uses workspacePath instead of session state", async () => {
    const listCalls: Array<{ workspacePath: string }> = [];
    const readCalls: Array<{ workspacePath: string; layerId: string }> = [];
    const saveCalls: Array<{ workspacePath: string; layerId: string; content: string; baseMtimeMs: number }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(700),
      listSettingsLayersQuery: async (input) => {
        listCalls.push(input);
        return {
          effective: { content: '{"lang":"en"}' },
          layers: [
            {
              layerId: "1:project",
              sourceId: "project",
              path: `${input.workspacePath}/.agenter/settings.json`,
              exists: true,
              editable: true,
            },
          ],
        };
      },
      readSettingsLayerQuery: async (input) => {
        readCalls.push(input);
        return {
          layer: {
            layerId: input.layerId,
            sourceId: "project",
            path: `${input.workspacePath}/.agenter/settings.json`,
            exists: true,
            editable: true,
          },
          path: `${input.workspacePath}/.agenter/settings.json`,
          content: '{"lang":"en"}',
          mtimeMs: 7,
        };
      },
      saveSettingsLayerMutate: async (input) => {
        saveCalls.push(input);
        return {
          ok: true,
          file: {
            path: `${input.workspacePath}/.agenter/settings.json`,
            content: input.content,
            mtimeMs: input.baseMtimeMs + 1,
          },
          effective: {
            content: input.content,
          },
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const layers = await store.listSettingsLayers("/repo/demo");
    const file = await store.readSettingsLayer("/repo/demo", "1:project");
    const saved = await store.saveSettingsLayer({
      workspacePath: "/repo/demo",
      layerId: "1:project",
      content: '{"lang":"ja"}',
      baseMtimeMs: 7,
    });

    expect(layers.layers[0]?.layerId).toBe("1:project");
    expect(file.path).toBe("/repo/demo/.agenter/settings.json");
    expect(saved.ok).toBe(true);
    expect(listCalls).toEqual([{ workspacePath: "/repo/demo" }]);
    expect(readCalls).toEqual([{ workspacePath: "/repo/demo", layerId: "1:project" }]);
    expect(saveCalls).toEqual([
      {
        workspacePath: "/repo/demo",
        layerId: "1:project",
        content: '{"lang":"ja"}',
        baseMtimeMs: 7,
      },
    ]);
    store.disconnect();
  });

  test("Scenario: Given a runtime session When loading scoped settings through the runtime helpers Then the store resolves workspace/global scope from the session instead of a caller-provided path", async () => {
    const scopedListCalls: Array<{ scope: "workspace" | "global"; workspacePath?: string; avatar?: string }> = [];
    const scopedReadCalls: Array<{
      scope: "workspace" | "global";
      workspacePath?: string;
      layerId: string;
      avatar?: string;
    }> = [];
    const scopedSaveCalls: Array<{
      scope: "workspace" | "global";
      workspacePath?: string;
      layerId: string;
      content: string;
      baseMtimeMs: number;
      avatar?: string;
    }> = [];
    const workspaceSnapshot = createSnapshot(710);
    workspaceSnapshot.sessions = [
      {
        ...workspaceSnapshot.sessions[0]!,
        workspacePath: "/repo/runtime",
        avatar: "runtime-planner",
      },
    ];
    const client = createMockClient({
      snapshotQuery: async () => workspaceSnapshot,
      listScopedSettingsQuery: async (input) => {
        scopedListCalls.push(input);
        return {
          scope: input.scope,
          effective: {
            content: '{"mode":"workspace"}',
            value: { mode: "workspace" },
            schema: { type: "object" },
            provenance: {},
          },
          layers: [
            {
              layerId: "workspace-layer",
              sourceId: "workspace",
              kind: "file",
              path: `${input.workspacePath}/.agenter/settings.json`,
              exists: true,
              editable: true,
            },
          ],
        };
      },
      readScopedSettingsLayerQuery: async (input) => {
        scopedReadCalls.push(input);
        return {
          layer: {
            layerId: input.layerId,
            sourceId: "workspace",
            kind: "file",
            path: `${input.workspacePath}/.agenter/settings.json`,
            exists: true,
            editable: true,
          },
          path: `${input.workspacePath}/.agenter/settings.json`,
          content: '{"mode":"workspace"}',
          mtimeMs: 11,
        };
      },
      saveScopedSettingsLayerMutate: async (input) => {
        scopedSaveCalls.push(input);
        return {
          ok: true,
          file: {
            path: `${input.workspacePath}/.agenter/settings.json`,
            content: input.content,
            mtimeMs: input.baseMtimeMs + 1,
          },
          effective: {
            content: input.content,
          },
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    const workspaceScope = await store.listRuntimeSettingsScope("i-1");
    const workspaceLayer = await store.readRuntimeSettingsLayer("i-1", "workspace-layer");
    const workspaceSave = await store.saveRuntimeSettingsLayer({
      sessionId: "i-1",
      layerId: "workspace-layer",
      content: '{"mode":"workspace-next"}',
      baseMtimeMs: 11,
    });

    expect(workspaceScope.layers[0]?.layerId).toBe("workspace-layer");
    expect(workspaceLayer.path).toBe("/repo/runtime/.agenter/settings.json");
    expect(workspaceSave.ok).toBe(true);
    expect(scopedListCalls).toEqual([
      {
        scope: "workspace",
        workspacePath: "/repo/runtime",
        avatar: "runtime-planner",
      },
    ]);
    expect(scopedReadCalls).toEqual([
      {
        scope: "workspace",
        workspacePath: "/repo/runtime",
        layerId: "workspace-layer",
        avatar: "runtime-planner",
      },
    ]);
    expect(scopedSaveCalls).toEqual([
      {
        scope: "workspace",
        workspacePath: "/repo/runtime",
        layerId: "workspace-layer",
        content: '{"mode":"workspace-next"}',
        baseMtimeMs: 11,
        avatar: "runtime-planner",
      },
    ]);

    const globalSnapshot = createSnapshot(711);
    globalSnapshot.sessions = [
      {
        ...globalSnapshot.sessions[0]!,
        workspacePath: "~/",
        avatar: "global-planner",
      },
    ];
    const globalCalls: Array<{ scope: "workspace" | "global"; workspacePath?: string; avatar?: string }> = [];
    const globalStore = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => globalSnapshot,
        listScopedSettingsQuery: async (input) => {
          globalCalls.push(input);
          return {
            scope: input.scope,
            effective: {
              content: '{"mode":"global"}',
              value: { mode: "global" },
              schema: { type: "object" },
              provenance: {},
            },
            layers: [],
          };
        },
      }),
    );

    await globalStore.connect();
    await globalStore.listRuntimeSettingsScope("i-1");

    expect(globalCalls).toEqual([
      {
        scope: "global",
        avatar: "global-planner",
      },
    ]);
    globalStore.disconnect();
    store.disconnect();
  });

  test("Scenario: Given request-aux pages and live model-call refreshes When the store hydrates and loads older inspection facts Then durable rows merge without dropping older or newer entries", async () => {
    let latestMode: "initial" | "refreshed" = "initial";
    let onData: ((event: unknown) => void) | undefined;
    const requestAuxCalls: Array<{ before?: { beforeTimeMs: number; beforeId: number }; limit?: number }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(720),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
      requestAuxPageQuery: async (input) => {
        requestAuxCalls.push({ before: input.before, limit: input.limit });
        if (input.before) {
          return {
            items: [
              {
                id: 1,
                messageId: "aux-system",
                windowId: null,
                aiCallId: 4,
                roundIndex: 1,
                scope: "request_aux",
                role: "system",
                createdAt: 100,
                updatedAt: 100,
                isComplete: true,
                text: "system prompt",
                parts: [
                  {
                    partId: 1,
                    partIndex: 0,
                    messageId: "aux-system",
                    windowId: null,
                    aiCallId: 4,
                    roundIndex: 1,
                    scope: "request_aux",
                    role: "system",
                    partType: "systemPrompt",
                    mimeType: null,
                    payload: "You are a Linux expert.",
                    createdAt: 100,
                    updatedAt: 100,
                    isComplete: true,
                  },
                ],
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        }
        return {
          items:
            latestMode === "initial"
              ? [
                  {
                    id: 2,
                    messageId: "aux-tools",
                    windowId: null,
                    aiCallId: 4,
                    roundIndex: 1,
                    scope: "request_aux",
                    role: "config",
                    createdAt: 120,
                    updatedAt: 120,
                    isComplete: true,
                    text: '[{"name":"workspace.bash"}]',
                    parts: [
                      {
                        partId: 2,
                        partIndex: 0,
                        messageId: "aux-tools",
                        windowId: null,
                        aiCallId: 4,
                        roundIndex: 1,
                        scope: "request_aux",
                        role: "config",
                        partType: "tools",
                        mimeType: null,
                        payload: [{ name: "workspace.bash" }],
                        createdAt: 120,
                        updatedAt: 120,
                        isComplete: true,
                      },
                    ],
                  },
                  {
                    id: 3,
                    messageId: "aux-config",
                    windowId: null,
                    aiCallId: 4,
                    roundIndex: 1,
                    scope: "request_aux",
                    role: "config",
                    createdAt: 140,
                    updatedAt: 140,
                    isComplete: true,
                    text: '{"temperature":0.2}',
                    parts: [
                      {
                        partId: 3,
                        partIndex: 0,
                        messageId: "aux-config",
                        windowId: null,
                        aiCallId: 4,
                        roundIndex: 1,
                        scope: "request_aux",
                        role: "config",
                        partType: "config",
                        mimeType: null,
                        payload: { temperature: 0.2 },
                        createdAt: 140,
                        updatedAt: 140,
                        isComplete: true,
                      },
                    ],
                  },
                ]
              : [
                  {
                    id: 2,
                    messageId: "aux-tools",
                    windowId: null,
                    aiCallId: 4,
                    roundIndex: 1,
                    scope: "request_aux",
                    role: "config",
                    createdAt: 120,
                    updatedAt: 120,
                    isComplete: true,
                    text: '[{"name":"workspace.bash"}]',
                    parts: [
                      {
                        partId: 2,
                        partIndex: 0,
                        messageId: "aux-tools",
                        windowId: null,
                        aiCallId: 4,
                        roundIndex: 1,
                        scope: "request_aux",
                        role: "config",
                        partType: "tools",
                        mimeType: null,
                        payload: [{ name: "workspace.bash" }],
                        createdAt: 120,
                        updatedAt: 120,
                        isComplete: true,
                      },
                    ],
                  },
                  {
                    id: 3,
                    messageId: "aux-config",
                    windowId: null,
                    aiCallId: 4,
                    roundIndex: 1,
                    scope: "request_aux",
                    role: "config",
                    createdAt: 140,
                    updatedAt: 140,
                    isComplete: true,
                    text: '{"temperature":0.2}',
                    parts: [
                      {
                        partId: 3,
                        partIndex: 0,
                        messageId: "aux-config",
                        windowId: null,
                        aiCallId: 4,
                        roundIndex: 1,
                        scope: "request_aux",
                        role: "config",
                        partType: "config",
                        mimeType: null,
                        payload: { temperature: 0.2 },
                        createdAt: 140,
                        updatedAt: 140,
                        isComplete: true,
                      },
                    ],
                  },
                  {
                    id: 4,
                    messageId: "aux-system-next",
                    windowId: null,
                    aiCallId: 5,
                    roundIndex: 2,
                    scope: "request_aux",
                    role: "system",
                    createdAt: 160,
                    updatedAt: 160,
                    isComplete: true,
                    text: "system prompt refreshed",
                    parts: [
                      {
                        partId: 4,
                        partIndex: 0,
                        messageId: "aux-system-next",
                        windowId: null,
                        aiCallId: 5,
                        roundIndex: 2,
                        scope: "request_aux",
                        role: "system",
                        partType: "systemPrompt",
                        mimeType: null,
                        payload: "Use bash and skills first.",
                        createdAt: 160,
                        updatedAt: 160,
                        isComplete: true,
                      },
                    ],
                  },
                ],
          nextBefore: {
            beforeTimeMs: 120,
            beforeId: 2,
          },
          hasMoreBefore: true,
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");

    expect(store.getState().requestAuxBySession["i-1"]?.map((item) => item.id)).toEqual([2, 3]);

    const older = await store.loadMoreRequestAux("i-1", 50);
    expect(older.hasMore).toBe(false);
    expect(store.getState().requestAuxBySession["i-1"]?.map((item) => item.id)).toEqual([1, 2, 3]);

    latestMode = "refreshed";
    onData?.({
      version: 1,
      eventId: 721,
      timestamp: Date.now(),
      type: "runtime.modelCall",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 5,
          cycleId: 5,
          roundIndex: 2,
          kind: "attention",
          status: "running",
          provider: "openai-compatible",
          model: "test-model",
          requestUrl: "https://example.test/v1/chat/completions",
          request: {},
          response: null,
          error: null,
          outcome: null,
          createdAt: 160,
          updatedAt: 160,
          completedAt: null,
          isComplete: false,
        },
      },
    });

    await waitFor(() => store.getState().requestAuxBySession["i-1"]?.some((item) => item.id === 4) === true);
    expect(store.getState().requestAuxBySession["i-1"]?.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(requestAuxCalls.length).toBeGreaterThanOrEqual(3);
    store.disconnect();
  });

  test("Scenario: Given bootstrap connect is still hydrating When runtime shell hydrates one session Then runtime snapshot is single-flight instead of being queried twice", async () => {
    let snapshotCalls = 0;
    const snapshotDeferred = createDeferred<ReturnType<typeof createSnapshot>>();
    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCalls += 1;
        return await snapshotDeferred.promise;
      },
    });
    const store = new RuntimeStore(client);

    const connectPromise = store.connect();
    await Promise.resolve();

    const hydratePromise = store.hydrateSessionArtifacts("i-1");
    await Promise.resolve();

    expect(snapshotCalls).toBe(1);

    snapshotDeferred.resolve(createSnapshot(755));
    await connectPromise;
    await hydratePromise;

    expect(store.getState().sessions.some((session) => session.id === "i-1")).toBe(true);
    store.disconnect();
  });

  test("Scenario: Given Heartbeat shell hydration When the runtime shell only needs runtime facts Then chat history is not fetched during hydrateSessionArtifacts", async () => {
    let chatListCalls = 0;
    let chatCyclesCalls = 0;
    let channelCalls = 0;
    let notificationCalls = 0;
    let schedulerLogCalls = 0;
    let traceCalls = 0;
    let requestAuxCalls = 0;
    let apiCallsCalls = 0;
    const modelCallLimits: number[] = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(756),
      chatListQuery: async () => {
        chatListCalls += 1;
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
      chatCyclesQuery: async () => {
        chatCyclesCalls += 1;
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
      messageListChannelsQuery: async () => {
        channelCalls += 1;
        return { items: [] };
      },
      notificationSnapshotQuery: async () => {
        notificationCalls += 1;
        return {
          items: [],
          unreadBySession: {},
          unreadByBucket: {},
        };
      },
      schedulerLogsQuery: async () => {
        schedulerLogCalls += 1;
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
      observabilityTracesQuery: async () => {
        traceCalls += 1;
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
      requestAuxPageQuery: async () => {
        requestAuxCalls += 1;
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
      apiCallsPageQuery: async () => {
        apiCallsCalls += 1;
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
      modelCallsPageQuery: async (input) => {
        modelCallLimits.push(input.limit ?? 0);
        return { items: [], nextBefore: null, hasMoreBefore: false };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1", {
      includeChatHistory: false,
      observabilityMode: "heartbeat",
    });

    expect(chatListCalls).toBe(0);
    expect(chatCyclesCalls).toBe(0);
    expect(channelCalls).toBe(1);
    expect(notificationCalls).toBe(1);
    expect(schedulerLogCalls).toBe(0);
    expect(traceCalls).toBe(0);
    expect(requestAuxCalls).toBe(0);
    expect(apiCallsCalls).toBe(0);
    expect(modelCallLimits).toEqual([12]);
    expect(store.getState().sessions.some((session) => session.id === "i-1")).toBe(true);
    store.disconnect();
  });

  test("Scenario: Given grouped Heartbeat pages and live invalidation events When the store hydrates and reloads Then the Heartbeat groups stay ordered and refresh through the query path", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const heartbeatCalls: Array<{ before?: { beforeTimeMs: number; beforeId: number }; limit?: number }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(760),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
      heartbeatGroupsPageQuery: async (input) => {
        heartbeatCalls.push({ before: input.before, limit: input.limit });
        if (input.before) {
          return {
            items: [
              createHeartbeatGroup({
                id: 400,
                groupId: "heartbeat-group:before-call:40",
                kind: "before-call",
                aiCallId: 40,
                createdAt: 100,
                items: [
                  createHeartbeatEntry({
                    id: 1,
                    messageId: "heartbeat-part:older",
                    role: "system",
                    scope: "request_aux",
                    partType: "systemPrompt",
                    aiCallId: 40,
                    createdAt: 100,
                    payload: "You are a Linux expert.",
                    text: "You are a Linux expert.",
                  }),
                ],
              }),
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        }
        const headQueryCount = heartbeatCalls.filter((call) => !call.before).length;
        if (headQueryCount === 1) {
          return {
            items: [
              createHeartbeatGroup({
                id: 410,
                groupId: "heartbeat-group:before-call:41",
                kind: "before-call",
                aiCallId: 41,
                createdAt: 120,
                items: [
                  createHeartbeatEntry({
                    id: 2,
                    messageId: "heartbeat-part:user",
                    role: "user",
                    aiCallId: 41,
                    createdAt: 120,
                    payload: { type: "text", content: 'scoreMap={"room":1}' },
                    text: 'scoreMap={"room":1}',
                  }),
                ],
              }),
              createHeartbeatGroup({
                id: 411,
                groupId: "heartbeat-group:call:41",
                kind: "call",
                aiCallId: 41,
                createdAt: 140,
                updatedAt: 145,
                isComplete: false,
                items: [
                  createHeartbeatEntry({
                    id: 3,
                    messageId: "heartbeat-part:assistant",
                    role: "assistant",
                    aiCallId: 41,
                    createdAt: 140,
                    updatedAt: 145,
                    isComplete: false,
                    payload: { type: "text", content: "draft reply" },
                    text: "draft reply",
                  }),
                ],
              }),
            ],
            nextBefore: {
              beforeTimeMs: 120,
              beforeId: 410,
            },
            hasMoreBefore: true,
          };
        }
        return {
          items: [
            createHeartbeatGroup({
              id: 410,
              groupId: "heartbeat-group:before-call:41",
              kind: "before-call",
              aiCallId: 41,
              createdAt: 120,
              updatedAt: 180,
              items: [
                createHeartbeatEntry({
                  id: 2,
                  messageId: "heartbeat-part:user",
                  role: "user",
                  aiCallId: 41,
                  createdAt: 120,
                  payload: { type: "text", content: 'scoreMap={"room":1}' },
                  text: 'scoreMap={"room":1}',
                }),
                createHeartbeatEntry({
                  id: 4,
                  messageId: "room-ingress",
                  role: "user",
                  aiCallId: 41,
                  createdAt: 130,
                  payload: { type: "text", content: 'scoreMap={"room":1}' },
                  text: 'scoreMap={"room":1}',
                }),
              ],
            }),
            createHeartbeatGroup({
              id: 411,
              groupId: "heartbeat-group:call:41",
              kind: "call",
              aiCallId: 41,
              createdAt: 140,
              updatedAt: 180,
              items: [
                createHeartbeatEntry({
                  id: 44,
                  messageId: "heartbeat-part:assistant",
                  role: "assistant",
                  aiCallId: 41,
                  createdAt: 140,
                  updatedAt: 180,
                  isComplete: true,
                  payload: { type: "text", content: "final reply" },
                  text: "final reply",
                }),
              ],
            }),
            createHeartbeatGroup({
              id: 420,
              groupId: "heartbeat-group:compact:42",
              kind: "compact",
              aiCallId: 42,
              createdAt: 190,
              items: [
                createHeartbeatEntry({
                  id: 5,
                  messageId: "heartbeat-part:compact",
                  role: "system",
                  aiCallId: 42,
                  partType: "compact",
                  createdAt: 190,
                  payload: {
                    type: "compact",
                    text: "Prompt window compacted.",
                  },
                  text: "Prompt window compacted.",
                }),
              ],
            }),
          ],
          nextBefore: {
            beforeTimeMs: 120,
            beforeId: 410,
          },
          hasMoreBefore: true,
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");

    expect(store.getState().heartbeatGroupsBySession["i-1"]?.data.map((item) => item.groupId)).toEqual([
      "heartbeat-group:before-call:41",
      "heartbeat-group:call:41",
    ]);
    expect(store.getState().heartbeatGroupsBySession["i-1"]?.loaded).toBe(true);

    const older = await store.loadMoreHeartbeatInspection("i-1", 50);
    expect(older.hasMore).toBe(false);
    expect(store.getState().heartbeatGroupsBySession["i-1"]?.data.map((item) => item.groupId)).toEqual([
      "heartbeat-group:before-call:40",
      "heartbeat-group:before-call:41",
      "heartbeat-group:call:41",
    ]);

    expect(typeof onData).toBe("function");
    onData?.({
      version: 1,
      eventId: 761,
      timestamp: Date.now(),
      type: "runtime.heartbeatPart",
      sessionId: "i-1",
      payload: {
        entry: createHeartbeatEntry({
          id: 3,
          messageId: "heartbeat-part:assistant",
          role: "assistant",
          createdAt: 140,
          updatedAt: 180,
          isComplete: true,
          payload: { type: "text", content: "final reply" },
          text: "final reply",
        }),
      },
    });
    onData?.({
      version: 1,
      eventId: 762,
      timestamp: Date.now(),
      type: "runtime.heartbeatPart",
      sessionId: "i-1",
      payload: {
        entry: createHeartbeatEntry({
          id: 4,
          messageId: "room-ingress",
          role: "user",
          createdAt: 130,
          payload: {
            type: "text",
            content: 'scoreMap={"room":1}',
          },
          text: 'scoreMap={"room":1}',
        }),
      },
    });
    onData?.({
      version: 1,
      eventId: 763,
      timestamp: Date.now(),
      type: "runtime.heartbeatPart",
      sessionId: "i-1",
      payload: {
        entry: createHeartbeatEntry({
          id: 5,
          messageId: "heartbeat-part:compact",
          role: "system",
          partType: "compact",
          createdAt: 190,
          payload: {
            type: "compact",
            text: "Prompt window compacted.",
          },
          text: "Prompt window compacted.",
        }),
      },
    });

    await waitFor(
      () =>
        JSON.stringify(store.getState().heartbeatGroupsBySession["i-1"]?.data.map((item) => item.groupId)) ===
        JSON.stringify([
          "heartbeat-group:before-call:40",
          "heartbeat-group:before-call:41",
          "heartbeat-group:call:41",
          "heartbeat-group:compact:42",
        ]),
    );
    expect(
      store.getState().heartbeatGroupsBySession["i-1"]?.data.find((item) => item.groupId === "heartbeat-group:call:41")
        ?.items[0]?.text,
    ).toBe("final reply");
    expect(
      store
        .getState()
        .heartbeatGroupsBySession["i-1"]?.data.find((item) => item.groupId === "heartbeat-group:before-call:41")
        ?.items.some((item) => item.messageId === "room-ingress"),
    ).toBeTrue();
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(3);
    store.disconnect();
  });

  test("Scenario: Given the same Heartbeat group is refreshed with newer rows When invalidation reloads the page Then groupId remains the durable identity", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let heartbeatPageMode: "draft" | "final" = "draft";
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(900),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
      heartbeatGroupsPageQuery: async () => {
        if (heartbeatPageMode === "final") {
          return {
            items: [
              createHeartbeatGroup({
                id: 510,
                groupId: "heartbeat-group:call:51",
                kind: "call",
                aiCallId: 51,
                createdAt: 200,
                updatedAt: 260,
                items: [
                  createHeartbeatEntry({
                    id: 44,
                    messageId: "heartbeat-part:assistant:stable",
                    role: "assistant",
                    aiCallId: 51,
                    createdAt: 200,
                    updatedAt: 260,
                    isComplete: true,
                    payload: { type: "text", content: "final" },
                    text: "final",
                  }),
                ],
              }),
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        }
        return {
          items: [
            createHeartbeatGroup({
              id: 510,
              groupId: "heartbeat-group:call:51",
              kind: "call",
              aiCallId: 51,
              createdAt: 200,
              updatedAt: 210,
              isComplete: false,
              items: [
                createHeartbeatEntry({
                  id: 30,
                  messageId: "heartbeat-part:assistant:stable",
                  role: "assistant",
                  aiCallId: 51,
                  createdAt: 200,
                  updatedAt: 210,
                  isComplete: false,
                  payload: { type: "text", content: "draft" },
                  text: "draft",
                }),
              ],
            }),
          ],
          nextBefore: null,
          hasMoreBefore: false,
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");
    heartbeatPageMode = "final";

    onData?.({
      version: 1,
      eventId: 901,
      timestamp: Date.now(),
      type: "runtime.heartbeatPart",
      sessionId: "i-1",
      payload: {
        entry: createHeartbeatEntry({
          id: 44,
          messageId: "heartbeat-part:assistant:stable",
          role: "assistant",
          createdAt: 200,
          updatedAt: 260,
          isComplete: true,
          payload: { type: "text", content: "final" },
          text: "final",
        }),
      },
    });

    await waitFor(
      () =>
        store.getState().heartbeatGroupsBySession["i-1"]?.data[0]?.items[0]?.id === 44 &&
        store.getState().heartbeatGroupsBySession["i-1"]?.data[0]?.items[0]?.text === "final",
    );
    expect(store.getState().heartbeatGroupsBySession["i-1"]?.data).toEqual([
      expect.objectContaining({
        groupId: "heartbeat-group:call:51",
        items: [
          expect.objectContaining({
            id: 44,
            messageId: "heartbeat-part:assistant:stable",
            text: "final",
            isComplete: true,
          }),
        ],
      }),
    ]);
    store.disconnect();
  });

  test("Scenario: Given a running invocation first lands without args When a tool_call delta later hydrates parameters Then the same Heartbeat group reloads through the grouped query path before completion", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let heartbeatPageMode: "pending" | "hydrated" = "pending";
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(920),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
      heartbeatGroupsPageQuery: async () => {
        if (heartbeatPageMode === "hydrated") {
          return {
            items: [
              createHeartbeatGroup({
                id: 520,
                groupId: "heartbeat-group:call:52",
                kind: "call",
                aiCallId: 52,
                createdAt: 220,
                updatedAt: 260,
                isComplete: false,
                items: [
                  createHeartbeatEntry({
                    id: 52,
                    messageId: "heartbeat-part:assistant:tool-hydrated",
                    role: "assistant",
                    aiCallId: 52,
                    createdAt: 220,
                    updatedAt: 260,
                    isComplete: false,
                    partType: "tool_call",
                    payload: {
                      invocationId: "call-attention-commit",
                      tool: "root_bash",
                      input: {
                        command: 'attention commit \'{"contextId":"ctx-room"}\'',
                      },
                    },
                    text: '{"command":"attention commit"}',
                  }),
                ],
              }),
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        }
        return {
          items: [
            createHeartbeatGroup({
              id: 520,
              groupId: "heartbeat-group:call:52",
              kind: "call",
              aiCallId: 52,
              createdAt: 220,
              updatedAt: 230,
              isComplete: false,
              items: [
                createHeartbeatEntry({
                  id: 51,
                  messageId: "heartbeat-part:assistant:tool-hydrated",
                  role: "assistant",
                  aiCallId: 52,
                  createdAt: 220,
                  updatedAt: 230,
                  isComplete: false,
                  partType: "tool_call",
                  payload: {
                    invocationId: "call-attention-commit",
                    tool: "root_bash",
                    input: "",
                  },
                  text: "",
                }),
              ],
            }),
          ],
          nextBefore: null,
          hasMoreBefore: false,
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");

    expect(store.getState().heartbeatGroupsBySession["i-1"]?.data).toEqual([
      expect.objectContaining({
        groupId: "heartbeat-group:call:52",
        items: [
          expect.objectContaining({
            id: 51,
            parts: [
              expect.objectContaining({
                partType: "tool_call",
                payload: expect.objectContaining({
                  input: "",
                }),
              }),
            ],
          }),
        ],
      }),
    ]);

    heartbeatPageMode = "hydrated";
    onData?.({
      version: 1,
      eventId: 921,
      timestamp: Date.now(),
      type: "runtime.modelCall.delta",
      sessionId: "i-1",
      payload: {
        entry: {
          id: 92,
          seq: 2,
          modelCallId: 52,
          cycleId: 18,
          timestamp: 260,
          kind: "tool_call",
          data: {
            toolCallId: "call-attention-commit",
            toolName: "root_bash",
            input: {
              command: 'attention commit \'{"contextId":"ctx-room"}\'',
            },
          },
        },
      },
    });

    await waitFor(() => {
      const payload = store
        .getState()
        .heartbeatGroupsBySession["i-1"]?.data.find((item) => item.groupId === "heartbeat-group:call:52")?.items[0]
        ?.parts[0]?.payload;
      return payload !== undefined && JSON.stringify(payload).includes("attention commit");
    });

    expect(store.getState().heartbeatGroupsBySession["i-1"]?.data).toEqual([
      expect.objectContaining({
        groupId: "heartbeat-group:call:52",
        items: [
          expect.objectContaining({
            id: 52,
            messageId: "heartbeat-part:assistant:tool-hydrated",
            parts: [
              expect.objectContaining({
                partType: "tool_call",
                payload: expect.objectContaining({
                  input: {
                    command: 'attention commit \'{"contextId":"ctx-room"}\'',
                  },
                }),
                isComplete: false,
              }),
            ],
          }),
        ],
      }),
    ]);

    store.disconnect();
  });

  test("Scenario: Given a running Heartbeat tool row arrives before grouped refresh resolves When the store receives the objective heartbeatPart event Then the running command is visible immediately", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let heartbeatPageQueryCount = 0;
    let resolveRefresh: ((value: ReversePageResult<HeartbeatGroupItem>) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(930),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
      heartbeatGroupsPageQuery: async () => {
        heartbeatPageQueryCount += 1;
        if (heartbeatPageQueryCount === 1) {
          return {
            items: [
              createHeartbeatGroup({
                id: 530,
                groupId: "heartbeat-group:call:53",
                kind: "call",
                aiCallId: 53,
                createdAt: 220,
                updatedAt: 230,
                isComplete: false,
                items: [
                  createHeartbeatEntry({
                    id: 530,
                    messageId: "heartbeat-part:ai-call:53:response:assistant:0",
                    role: "assistant",
                    aiCallId: 53,
                    createdAt: 220,
                    updatedAt: 230,
                    isComplete: false,
                    payload: { type: "text", content: "Working on it…" },
                    text: "Working on it…",
                  }),
                ],
              }),
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        }
        return await new Promise<ReversePageResult<HeartbeatGroupItem>>((resolve) => {
          resolveRefresh = resolve;
        });
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");

    onData?.({
      version: 1,
      eventId: 931,
      timestamp: Date.now(),
      type: "runtime.heartbeatPart",
      sessionId: "i-1",
      payload: {
        entry: createHeartbeatEntry({
          id: 531,
          messageId: "heartbeat-part:ai-call:53:tool:call-attention-commit",
          role: "assistant",
          aiCallId: 53,
          createdAt: 240,
          updatedAt: 240,
          isComplete: false,
          partType: "tool_call",
          payload: {
            invocationId: "call-attention-commit",
            tool: "root_bash",
            input: {
              command: 'attention commit --compact \'["ctx-1",[],"Settled."]\'',
            },
          },
          text: '{"command":"attention commit --compact"}',
        }),
      },
    });

    await waitFor(() => {
      const group = store
        .getState()
        .heartbeatGroupsBySession["i-1"]?.data.find((item) => item.groupId === "heartbeat-group:call:53");
      const toolEntry = group?.items.find(
        (item) => item.messageId === "heartbeat-part:ai-call:53:tool:call-attention-commit",
      );
      const toolPayload = toolEntry?.parts[0]?.payload as { input?: { command?: string } } | undefined;
      return toolPayload?.input?.command === 'attention commit --compact \'["ctx-1",[],"Settled."]\'';
    });

    expect(
      store
        .getState()
        .heartbeatGroupsBySession["i-1"]?.data.find((item) => item.groupId === "heartbeat-group:call:53")
        ?.items.map((item) => item.messageId),
    ).toEqual([
      "heartbeat-part:ai-call:53:response:assistant:0",
      "heartbeat-part:ai-call:53:tool:call-attention-commit",
    ]);

    resolveRefresh?.({
      items: [
        createHeartbeatGroup({
          id: 530,
          groupId: "heartbeat-group:call:53",
          kind: "call",
          aiCallId: 53,
          createdAt: 220,
          updatedAt: 260,
          isComplete: true,
          items: [
            createHeartbeatEntry({
              id: 530,
              messageId: "heartbeat-part:ai-call:53:response:assistant:0",
              role: "assistant",
              aiCallId: 53,
              createdAt: 220,
              updatedAt: 230,
              isComplete: true,
              payload: { type: "text", content: "Working on it…" },
              text: "Working on it…",
            }),
            {
              id: 531,
              messageId: "heartbeat-part:ai-call:53:tool:call-attention-commit",
              windowId: null,
              aiCallId: 53,
              roundIndex: 1,
              scope: "heartbeat_part",
              role: "assistant",
              createdAt: 240,
              updatedAt: 260,
              isComplete: true,
              text: '{"command":"attention commit --compact"}',
              parts: [
                {
                  partId: 531,
                  partIndex: 0,
                  messageId: "heartbeat-part:ai-call:53:tool:call-attention-commit",
                  windowId: null,
                  aiCallId: 53,
                  roundIndex: 1,
                  scope: "heartbeat_part",
                  role: "assistant",
                  partType: "tool_call",
                  mimeType: null,
                  payload: {
                    invocationId: "call-attention-commit",
                    tool: "root_bash",
                    input: {
                      command: 'attention commit --compact \'["ctx-1",[],"Settled."]\'',
                    },
                  },
                  createdAt: 240,
                  updatedAt: 260,
                  isComplete: true,
                },
                {
                  partId: 532,
                  partIndex: 1,
                  messageId: "heartbeat-part:ai-call:53:tool:call-attention-commit",
                  windowId: null,
                  aiCallId: 53,
                  roundIndex: 1,
                  scope: "heartbeat_part",
                  role: "assistant",
                  partType: "tool_result",
                  mimeType: null,
                  payload: {
                    invocationId: "call-attention-commit",
                    tool: "root_bash",
                    output: { ok: true },
                    error: null,
                  },
                  createdAt: 260,
                  updatedAt: 260,
                  isComplete: true,
                },
              ],
            },
          ],
        }),
      ],
      nextBefore: null,
      hasMoreBefore: false,
    });

    await waitFor(() => {
      const group = store
        .getState()
        .heartbeatGroupsBySession["i-1"]?.data.find((item) => item.groupId === "heartbeat-group:call:53");
      return (
        group?.items.find((item) => item.messageId === "heartbeat-part:ai-call:53:tool:call-attention-commit")?.parts
          .length === 2
      );
    });

    store.disconnect();
  });

  test("Scenario: Given sustained Heartbeat part events When refresh invalidations keep arriving Then the store still refreshes during the active burst", async () => {
    let onData: ((event: unknown) => void) | undefined;
    let heartbeatQueryCount = 0;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(950),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
      heartbeatGroupsPageQuery: async () => {
        heartbeatQueryCount += 1;
        return {
          items: [
            createHeartbeatGroup({
              id: 600,
              groupId: "heartbeat-group:call:60",
              kind: "call",
              aiCallId: 60,
              createdAt: 300,
              updatedAt: 300 + heartbeatQueryCount,
              isComplete: heartbeatQueryCount > 1,
              items: [
                createHeartbeatEntry({
                  id: 60 + heartbeatQueryCount,
                  messageId: "heartbeat-part:assistant:burst",
                  role: "assistant",
                  aiCallId: 60,
                  createdAt: 300,
                  updatedAt: 300 + heartbeatQueryCount,
                  isComplete: heartbeatQueryCount > 1,
                  payload: { type: "text", content: `refresh-${heartbeatQueryCount}` },
                  text: `refresh-${heartbeatQueryCount}`,
                }),
              ],
            }),
          ],
          nextBefore: null,
          hasMoreBefore: false,
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");
    expect(heartbeatQueryCount).toBe(1);

    let eventId = 951;
    const interval = setInterval(() => {
      onData?.({
        version: 1,
        eventId: eventId++,
        timestamp: Date.now(),
        type: "runtime.heartbeatPart",
        sessionId: "i-1",
        payload: {
          entry: createHeartbeatEntry({
            id: eventId,
            messageId: `heartbeat-part:assistant:burst:${eventId}`,
            role: "assistant",
            aiCallId: 60,
            createdAt: 320,
            updatedAt: 320,
            isComplete: false,
            payload: { type: "text", content: "streaming" },
            text: "streaming",
          }),
        },
      });
    }, 20);

    try {
      await waitFor(() => heartbeatQueryCount >= 2, 160);
      expect(
        store
          .getState()
          .heartbeatGroupsBySession[
            "i-1"
          ]?.data[0]?.items.some((item) => item.messageId === "heartbeat-part:assistant:burst" && item.text === "refresh-2"),
      ).toBe(true);
    } finally {
      clearInterval(interval);
    }

    store.disconnect();
  });

  test("Scenario: Given grouped Heartbeat hydration fails When session artifacts are hydrated Then the resource settles to an explicit error instead of staying forever loading", async () => {
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(981),
      heartbeatGroupsPageQuery: async () => {
        throw new Error("heartbeat groups exploded");
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await store.hydrateSessionArtifacts("i-1");

    expect(store.getState().heartbeatGroupsBySession["i-1"]).toMatchObject({
      loaded: false,
      loading: false,
      refreshing: false,
      error: "heartbeat groups exploded",
    });
    store.disconnect();
  });

  test("Scenario: Given unread notifications When visibility and consume updates arrive Then store keeps unread state in sync", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const visibilityInputs: Array<{ sessionId: string; chatId?: string; visible: boolean; focused: boolean }> = [];
    const consumeInputs: Array<{ sessionId: string; chatId?: string; terminalId?: string; upToSrc?: string }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(800),
      notificationSnapshotQuery: async () => ({
        items: [
          {
            id: "i-1:9",
            sessionId: "i-1",
            src: "msg:chat-main/9",
            sourceNamespace: "msg",
            sourceId: "chat-main",
            bucketKey: "msg:chat-main",
            attentionContextId: "ctx-chat-main",
            attentionCommitId: "commit-9",
            workspacePath: "/repo/demo",
            sessionName: "workspace",
            content: "hello",
            timestamp: Date.now(),
          },
        ],
        unreadBySession: { "i-1": 1 },
        unreadByBucket: { "i-1": { "msg:chat-main": 1 } },
      }),
      setChatVisibilityMutate: async (input) => {
        visibilityInputs.push(input);
        return {
          items: [
            {
              id: "i-1:9",
              sessionId: "i-1",
              src: "msg:chat-main/9",
              sourceNamespace: "msg",
              sourceId: "chat-main",
              bucketKey: "msg:chat-main",
              attentionContextId: "ctx-chat-main",
              attentionCommitId: "commit-9",
              workspacePath: "/repo/demo",
              sessionName: "workspace",
              content: "hello",
              timestamp: Date.now(),
            },
          ],
          unreadBySession: { "i-1": 1 },
          unreadByBucket: { "i-1": { "msg:chat-main": 1 } },
        };
      },
      consumeNotificationsMutate: async (input) => {
        consumeInputs.push(input);
        return emptyNotificationSnapshot();
      },
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await waitFor(() => store.getState().unreadBySession["i-1"] === 1);
    expect(store.getState().unreadBySession["i-1"]).toBe(1);
    expect(store.getState().notifications[0]?.src).toBe("msg:chat-main/9");

    await store.setChatVisibility({ sessionId: "i-1", chatId: "chat-main", visible: true, focused: true });
    expect(visibilityInputs).toEqual([{ sessionId: "i-1", chatId: "chat-main", visible: true, focused: true }]);
    expect(store.getState().unreadBySession["i-1"]).toBe(1);

    onData?.({
      version: 1,
      eventId: 801,
      timestamp: Date.now(),
      type: "notification.updated",
      sessionId: "i-1",
      payload: {
        snapshot: {
          items: [
            {
              id: "i-1:10",
              sessionId: "i-1",
              src: "msg:chat-main/10",
              sourceNamespace: "msg",
              sourceId: "chat-main",
              bucketKey: "msg:chat-main",
              attentionContextId: "ctx-chat-main",
              attentionCommitId: "commit-10",
              workspacePath: "/repo/demo",
              sessionName: "workspace",
              content: "new reply",
              timestamp: Date.now(),
            },
          ],
          unreadBySession: { "i-1": 1 },
          unreadByBucket: { "i-1": { "msg:chat-main": 1 } },
        },
      },
    });
    expect(store.getState().notifications[0]?.src).toBe("msg:chat-main/10");

    await store.consumeNotifications({ sessionId: "i-1", chatId: "chat-main", upToSrc: "msg:chat-main/10" });
    expect(consumeInputs).toEqual([{ sessionId: "i-1", chatId: "chat-main", upToSrc: "msg:chat-main/10" }]);
    expect(store.getState().notifications).toEqual([]);
    expect(store.getState().unreadBySession["i-1"]).toBeUndefined();
    store.disconnect();
  });

  test("Scenario: Given long-history hydration and a later live reply When hydrating session history Then persisted rows merge with live rows without dropping unread continuity", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(900),
      chatListQuery: async () => ({
        items: [
          {
            id: 10,
            sessionId: "i-1",
            messageId: "assistant-1",
            role: "assistant",
            channel: "to_user",
            content: "persisted reply",
            timestamp: 10,
            cycleId: 1,
            format: "markdown",
            tool: null,
            attachments: [],
          },
          {
            id: 11,
            sessionId: "i-1",
            messageId: "user-2",
            role: "user",
            channel: "user_input",
            content: "persisted follow-up",
            timestamp: 20,
            cycleId: 2,
            format: "markdown",
            tool: null,
            attachments: [],
          },
        ],
      }),
      chatCyclesQuery: async () => ({
        items: [],
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    onData?.({
      version: 1,
      eventId: 901,
      timestamp: Date.now(),
      type: "chat.message",
      sessionId: "i-1",
      payload: {
        message: {
          id: "assistant-live",
          role: "assistant",
          channel: "to_user",
          content: "live reply",
          timestamp: 30,
          cycleId: 3,
        },
      },
    });

    await store.hydrateSessionHistory("i-1", { messageLimit: 200, cycleLimit: 120 });

    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual([
      "assistant-1",
      "user-2",
      "assistant-live",
    ]);
    store.disconnect();
  });

  test("Scenario: Given runtime snapshot already contains in-memory chat rows When persisted history hydrates Then semantic duplicates collapse to the persisted records", async () => {
    const snapshot = createSnapshot(905);
    snapshot.runtimes["i-1"]!.chatMessages = [
      {
        id: "live-user-1",
        chatId: "chat-main",
        role: "user",
        content: "persisted user",
        timestamp: 10,
        cycleId: 1,
        attachments: [],
      },
      {
        id: "live-assistant-1",
        chatId: "chat-main",
        role: "assistant",
        channel: "to_user",
        content: "persisted assistant",
        timestamp: 20,
        cycleId: 1,
        attachments: [],
      },
    ];

    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => snapshot,
        chatListQuery: async () => ({
          items: [
            {
              id: 100,
              sessionId: "i-1",
              messageId: "100",
              chatId: "chat-main",
              role: "user",
              channel: "user_input",
              content: "persisted user",
              timestamp: 10,
              cycleId: 1,
              format: "markdown",
              tool: null,
              attachments: [],
            },
            {
              id: 101,
              sessionId: "i-1",
              messageId: "101",
              chatId: "chat-main",
              role: "assistant",
              channel: "to_user",
              content: "persisted assistant",
              timestamp: 20,
              cycleId: 1,
              format: "markdown",
              tool: null,
              attachments: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
        }),
        chatCyclesQuery: async () => ({
          items: [],
          nextBefore: null,
          hasMoreBefore: false,
        }),
      }),
    );

    await store.connect();
    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual(["live-user-1", "live-assistant-1"]);

    await store.hydrateSessionHistory("i-1", { messageLimit: 200, cycleLimit: 120 });

    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual(["100", "101"]);
    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.chatId)).toEqual(["chat-main", "chat-main"]);
    store.disconnect();
  });

  test("Scenario: Given snapshot has session without runtime When runtime events arrive Then scaffold is created and loopbus state updates", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const snapshot = createSnapshot(300);
    const client = createMockClient({
      snapshotQuery: async () => ({
        ...snapshot,
        runtimes: {},
      }),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    onData?.({
      version: 1,
      eventId: 301,
      timestamp: Date.now(),
      type: "runtime.phase",
      sessionId: "i-1",
      payload: { phase: "collecting_inputs" },
    });
    onData?.({
      version: 1,
      eventId: 302,
      timestamp: Date.now(),
      type: "runtime.observability.trace",
      sessionId: "i-1",
      payload: {
        entry: createTraceEntry({
          id: 302,
          cycleId: 1,
          attributes: { inputs: 1 },
        }),
      },
    });

    const runtime = store.getState().runtimes["i-1"];
    expect(runtime).toBeDefined();
    expect(runtime?.schedulerPhase).toBe("collecting_inputs");
    expect(store.getState().observabilityTracesBySession["i-1"]?.length).toBe(1);
    store.disconnect();
  });

  test("Scenario: Given optimistic chat send When a cycle update arrives Then the pending cycle is replaced by the persisted cycle", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(600),
      onSubscribe: (handlers) => {
        onData = handlers.onData;
      },
    });
    const store = new RuntimeStore(client);
    await store.connect();

    await store.sendChat("i-1", "hello cycle");
    const pending = store.getState().chatCyclesBySession["i-1"] ?? [];
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe("pending");

    const clientMessageId = pending[0]?.clientMessageIds[0];
    if (!clientMessageId) {
      throw new Error("expected optimistic client message id");
    }

    onData?.({
      version: 1,
      eventId: 601,
      timestamp: Date.now(),
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      payload: {
        cycle: {
          id: "cycle:9",
          cycleId: 9,
          seq: 9,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: [clientMessageId],
          inputs: [
            {
              source: "message",
              role: "user",
              name: "User",
              parts: [{ type: "text", text: "hello cycle" }],
              meta: { clientMessageId },
            },
          ],
          outputs: [
            {
              id: "reply-1",
              role: "assistant",
              content: "done",
              timestamp: Date.now(),
              channel: "to_user",
            },
          ],
          liveMessages: [],
          streaming: null,
          modelCallId: 12,
        },
      },
    });

    const cycles = store.getState().chatCyclesBySession["i-1"] ?? [];
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.id).toBe("cycle:9");
    expect(cycles[0]?.outputs[0]?.content).toBe("done");
    store.disconnect();
  });

  test("Scenario: Given uploaded session assets When sending chat Then resolved asset urls and optimistic attachment parts stay aligned", async () => {
    const originalFetch = globalThis.fetch;
    const sentPayloads: Array<{ sessionId: string; text: string; assetIds: string[]; clientMessageId: string }> = [];
    globalThis.fetch = (async (input, init) => {
      expect(input).toBe("http://127.0.0.1:3000/api/sessions/i-1/assets");
      expect(init?.headers).toEqual({
        authorization: "Bearer browser-auth-token",
      });
      return new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              assetId: "asset-1",
              kind: "file",
              mimeType: "text/plain",
              name: "notes.txt",
              sizeBytes: 5,
              url: "/media/sessions/i-1/assets/asset-1",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(700),
      chatSendMutate: async (payload) => {
        sentPayloads.push(payload);
        return { ok: true };
      },
    });
    const store = new RuntimeStore(client);

    try {
      await store.connect();
      client.setAuthToken("browser-auth-token");
      const uploaded = await store.uploadSessionAssets("i-1", [
        new File(["hello"], "notes.txt", { type: "text/plain" }),
      ]);

      expect(uploaded).toEqual([
        {
          assetId: "asset-1",
          kind: "file",
          mimeType: "text/plain",
          name: "notes.txt",
          sizeBytes: 5,
          url: "http://127.0.0.1:3000/media/sessions/i-1/assets/asset-1?authToken=browser-auth-token",
        },
      ]);

      await store.sendChat(
        "i-1",
        "review attachment",
        uploaded.map((item) => item.assetId),
        uploaded,
      );

      expect(sentPayloads).toHaveLength(1);
      expect(sentPayloads[0]?.sessionId).toBe("i-1");
      expect(sentPayloads[0]?.text).toBe("review attachment");
      expect(sentPayloads[0]?.assetIds).toEqual(["asset-1"]);

      const pendingCycles = store.getState().chatCyclesBySession["i-1"] ?? [];
      expect(pendingCycles).toHaveLength(1);
      expect(pendingCycles[0]?.inputs[0]?.parts).toEqual([
        { type: "text", text: "review attachment" },
        {
          type: "file",
          assetId: "asset-1",
          kind: "file",
          mimeType: "text/plain",
          name: "notes.txt",
          sizeBytes: 5,
          url: "http://127.0.0.1:3000/media/sessions/i-1/assets/asset-1?authToken=browser-auth-token",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      store.disconnect();
    }
  });

  test("Scenario: Given daemon-managed browser auth helpers When the runtime store proxies the bootstrap contract Then auto-login and local-env key storage pass through without legacy key-reveal behavior", async () => {
    const storedKeyPayloads: Array<{ privateKey?: string } | undefined> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(703),
      authAutoLoginMutate: async () => ({
        ok: true,
        source: "managed_local",
        session: {
          token: "auto-login-token",
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          claims: {
            authId: "wallet_evm:0x0000000000000000000000000000000000000001",
            profileId: "profile-1",
            admin: true,
            superadmin: true,
          },
          profile: {
            profileId: "profile-1",
            identifiers: [{ kind: "wallet_evm", value: "0x0000000000000000000000000000000000000001" }],
            metadata: { displayName: "Owner" },
            iconUrl: "http://127.0.0.1:4591/media/profiles/profile-1/icon",
            isVirtual: false,
          },
        },
      }),
      authStoreAutoLoginKeyMutate: async (payload) => {
        storedKeyPayloads.push(payload);
        return {
          ok: true,
          authId: "wallet_evm:0x0000000000000000000000000000000000000001",
          source: payload?.privateKey ? "provided" : "managed_local",
          localEnvPath: "~/.agenter/local.env",
        };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();

    await expect(store.autoLogin()).resolves.toMatchObject({
      ok: true,
      source: "managed_local",
      session: {
        token: "auto-login-token",
        claims: {
          superadmin: true,
        },
      },
    });
    await expect(store.storeAutoLoginKey({ privateKey: " 0xabc123 " })).resolves.toEqual({
      ok: true,
      authId: "wallet_evm:0x0000000000000000000000000000000000000001",
      source: "provided",
      localEnvPath: "~/.agenter/local.env",
    });
    await expect(store.storeAutoLoginKey()).resolves.toEqual({
      ok: true,
      authId: "wallet_evm:0x0000000000000000000000000000000000000001",
      source: "managed_local",
      localEnvPath: "~/.agenter/local.env",
    });
    expect(storedKeyPayloads).toEqual([{ privateKey: "0xabc123" }, undefined]);

    store.disconnect();
  });

  test("Scenario: Given profile-service endpoint discovery When building icon and WebAuthn URLs Then runtime store targets the independent service", async () => {
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(701),
      profileServiceQuery: async () => ({
        endpoint: "http://127.0.0.1:4591",
        authMode: "wallet_challenge_jwt",
        rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
        rootIdentifier: {
          kind: "wallet_evm",
          value: "0x0000000000000000000000000000000000000001",
        },
        rootAuthKeyPath: "~/.agenter/profile-service/root-auth.key",
        jwtTtlSeconds: 3600,
        rootAuthBootstrapMode: "managed_local",
        canRevealRootAuthPrivateKey: true,
        hasManagedRootAuthPrivateKey: true,
        browserAutoLoginKeyPath: "~/.agenter/local.env",
        browserAutoLoginConfigured: false,
        browserAutoLoginBootstrapAvailable: true,
      }),
    });
    const store = new RuntimeStore(client);

    await store.connect();

    expect(store.sessionIconUrl("i-1")).toBe("http://127.0.0.1:4591/media/sessions/i-1/icon");
    expect(store.profileIconUrl("gaubee")).toBe("http://127.0.0.1:4591/media/profiles/gaubee/icon");
    expect(store.webauthnRegistrationUrl("ticket-1")).toBe(
      "http://127.0.0.1:4591/auth/webauthn/register?ticket=ticket-1",
    );
    expect(store.webauthnAuthenticationUrl("profile-1")).toBe(
      "http://127.0.0.1:4591/auth/webauthn/authenticate?reference=profile-1",
    );

    store.disconnect();
  });

  test("Scenario: Given auth actor projections are available When the runtime store lists auth actors Then the catalog is returned without conflating session actors", async () => {
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(702),
      authActorsQuery: async () => ({
        items: [
          {
            actorId: "auth:wallet_evm:0xowner",
            actorKind: "auth",
            authId: "wallet_evm:0xowner",
            profileId: "profile-owner",
            label: "Owner",
            subtitle: "wallet_evm:0xowner",
            iconUrl: "http://127.0.0.1:4591/media/profiles/profile-owner/icon",
            identifier: {
              kind: "wallet_evm",
              value: "0xowner",
            },
          },
        ],
      }),
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await expect(store.listAuthActors()).resolves.toEqual([
      {
        actorId: "auth:wallet_evm:0xowner",
        actorKind: "auth",
        authId: "wallet_evm:0xowner",
        profileId: "profile-owner",
        label: "Owner",
        subtitle: "wallet_evm:0xowner",
        iconUrl: "http://127.0.0.1:4591/media/profiles/profile-owner/icon",
        identifier: {
          kind: "wallet_evm",
          value: "0xowner",
        },
      },
    ]);

    store.disconnect();
  });

  test("Scenario: Given hydrateRuntime no longer sees a runtime When stopSession completes Then paused runtime scaffolding is kept while persisted cycles remain visible", async () => {
    let snapshotCalls = 0;
    const pausedSession = {
      ...createSnapshot(0).sessions[0],
      status: "paused" as const,
    };
    const persistedAttention: RuntimeAttentionState = {
      snapshot: {
        contexts: [
          createAttentionContext({
            contextId: "ctx-chat-kzf",
            owner: "avatar:jane",
            content: "ask gaubee lunch",
            contentFormat: "markdown",
            scoreMap: { a1b2c3: 100 },
            commit: createAttentionCommit({
              commitId: "commit-1",
              contextId: "ctx-chat-kzf",
              author: "user:kzf",
              source: "message",
              summary: "Need lunch reply",
              value: "ask gaubee lunch",
              scores: { a1b2c3: 100 },
              format: "markdown",
            }),
          }),
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    };
    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          return createSnapshot(800);
        }
        return {
          ...createSnapshot(801),
          sessions: [pausedSession],
          runtimes: {},
        };
      },
      attentionStateQuery: async () => persistedAttention,
    });
    client.trpc.session.stop.mutate = async () => ({ session: pausedSession });

    const store = new RuntimeStore(client);
    const internal = store as unknown as { applyEvent: (event: unknown) => void };
    await store.connect();
    expect(store.getState().runtimes["i-1"]?.started).toBe(true);
    internal.applyEvent({
      version: 1,
      eventId: 801,
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      timestamp: Date.now(),
      payload: {
        cycle: {
          id: "cycle:11",
          cycleId: 11,
          seq: 11,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: ["client-11"],
          inputs: [
            {
              source: "message",
              role: "user",
              name: "User",
              parts: [{ type: "text", text: "hello cycle" }],
              meta: { clientMessageId: "client-11" },
            },
          ],
          outputs: [],
          liveMessages: [],
          streaming: null,
          modelCallId: 12,
        },
      },
    });

    await store.stopSession("i-1");

    expect(store.getState().runtimes["i-1"]?.started).toBe(true);
    expect(store.getState().runtimes["i-1"]?.terminals).toMatchObject([
      {
        terminalId: "main",
        status: "IDLE",
      },
    ]);
    expect(store.getState().terminalSnapshotsBySession["i-1"]).toHaveProperty("main");
    expect(store.getState().chatCyclesBySession["i-1"]?.map((cycle) => cycle.id)).toEqual(["cycle:11"]);
    const storedAttention = store.getState().attentionBySession?.["i-1"];
    const runtimeAttention = store.getState().runtimes["i-1"]?.attention;
    expect(storedAttention).toBeDefined();
    expect(runtimeAttention).toBeDefined();
    expect(storedAttention?.snapshot.contexts[0]?.contextId).toBe("ctx-chat-kzf");
    expect(runtimeAttention?.snapshot.contexts[0]?.contextId).toBe("ctx-chat-kzf");
    store.disconnect();
  });

  test("Scenario: Given Heartbeat inspection facts are already mounted When stopSession soft-refreshes a detached runtime Then the cached inspection lists stay visible until refresh settles", async () => {
    let snapshotCalls = 0;
    const pausedSession = {
      ...createSnapshot(0).sessions[0],
      status: "paused" as const,
    };
    const persistedAttention: RuntimeAttentionState = {
      snapshot: {
        contexts: [
          createAttentionContext({
            contextId: "ctx-runtime-proof",
            owner: "avatar:jane",
            content: "keep inspection truth visible",
            contentFormat: "markdown",
            scoreMap: { d4e5f6: 40 },
            commit: createAttentionCommit({
              commitId: "commit-keep-proof",
              contextId: "ctx-runtime-proof",
              author: "user:kzf",
              source: "message",
              summary: "Preserve runtime inspection truth",
              value: "keep inspection truth visible",
              scores: { d4e5f6: 40 },
              format: "markdown",
            }),
          }),
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    };
    const logsDeferred = createDeferred<ReversePageResult<unknown>>();
    const tracesDeferred = createDeferred<ReversePageResult<unknown>>();
    const heartbeatDeferred = createDeferred<ReversePageResult<unknown>>();
    const modelCallsDeferred = createDeferred<ReversePageResult<unknown>>();
    const requestAuxDeferred = createDeferred<ReversePageResult<unknown>>();
    const apiCallsDeferred = createDeferred<ReversePageResult<unknown>>();
    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          return createSnapshot(820);
        }
        return {
          ...createSnapshot(821),
          sessions: [pausedSession],
          runtimes: {},
        };
      },
      attentionStateQuery: async () => persistedAttention,
      schedulerLogsQuery: async () => await logsDeferred.promise,
      observabilityTracesQuery: async () => await tracesDeferred.promise,
      heartbeatGroupsPageQuery: async () => await heartbeatDeferred.promise,
      modelCallsPageQuery: async () => await modelCallsDeferred.promise,
      requestAuxPageQuery: async () => await requestAuxDeferred.promise,
      apiCallsPageQuery: async () => await apiCallsDeferred.promise,
    });
    client.trpc.session.stop.mutate = async () => ({ session: pausedSession });

    const store = new RuntimeStore(client);
    await store.connect();

    const retainedHeartbeat = createHeartbeatGroup({
      id: 11,
      groupId: "heartbeat-group:call:11",
      aiCallId: 11,
      createdAt: 1700000000100,
      updatedAt: 1700000000200,
      items: [
        createHeartbeatEntry({
          id: 101,
          messageId: "hb-101",
          aiCallId: 11,
          createdAt: 1700000000100,
          updatedAt: 1700000000200,
          payload: "running call",
        }),
      ],
    });
    const retainedModelCall = createModelCallItem({
      id: 31,
      cycleId: 9,
      status: "done",
      provider: "openai",
      model: "gpt-5",
      createdAt: 1700000000300,
      updatedAt: 1700000000400,
      response: { usage: { outputTokens: 12 } },
    });
    const retainedTrace = createTraceEntry({
      id: 41,
      cycleId: 9,
      startedAt: 1700000000500,
      endedAt: 1700000000600,
    });
    const retainedSchedulerLog = {
      id: 51,
      timestamp: 1700000000700,
      stateVersion: 4,
      event: "runtime.waiting",
      prevHash: null,
      stateHash: "state-hash-51",
      patch: [],
    };

    const state = store.getState();
    state.heartbeatGroupsBySession["i-1"] = {
      data: [retainedHeartbeat],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: 1700000000800,
    };
    state.modelCallsBySession["i-1"] = [retainedModelCall];
    state.requestAuxBySession["i-1"] = [{ id: 61, kind: "systemPrompt" }];
    state.apiCallsBySession["i-1"] = [{ id: 71, label: "runtime.snapshot" }];
    state.schedulerLogsBySession["i-1"] = [retainedSchedulerLog];
    state.observabilityTracesBySession["i-1"] = [retainedTrace];
    state.terminalReadsBySession["i-1"] = {
      main: {
        seq: 1,
        mode: "snapshot",
        text: "ready",
      },
    };
    state.runtimes["i-1"]!.terminalReads = state.terminalReadsBySession["i-1"];
    state.runtimes["i-1"]!.attention = persistedAttention;

    const stopPromise = store.stopSession("i-1");
    await Promise.resolve();

    expect(store.getState().heartbeatGroupsBySession["i-1"].loaded).toBe(true);
    expect(store.getState().heartbeatGroupsBySession["i-1"].data).toEqual([retainedHeartbeat]);
    expect(store.getState().schedulerLogsBySession["i-1"]).toEqual([retainedSchedulerLog]);
    expect(store.getState().observabilityTracesBySession["i-1"]).toEqual([retainedTrace]);
    expect(store.getState().modelCallsBySession["i-1"].map((item) => item.id)).toEqual([31]);
    expect(store.getState().requestAuxBySession["i-1"]).toEqual([{ id: 61, kind: "systemPrompt" }]);
    expect(store.getState().apiCallsBySession["i-1"]).toEqual([{ id: 71, label: "runtime.snapshot" }]);
    expect(store.getState().terminalReadsBySession["i-1"]).toEqual({
      main: {
        seq: 1,
        mode: "snapshot",
        text: "ready",
      },
    });

    logsDeferred.resolve({
      items: [
        retainedSchedulerLog,
        {
          id: 52,
          timestamp: 1700000000900,
          stateVersion: 5,
          event: "runtime.paused",
          prevHash: "state-hash-51",
          stateHash: "state-hash-52",
          patch: [],
        },
      ],
      nextBefore: null,
      hasMoreBefore: false,
    });
    tracesDeferred.resolve({
      items: [retainedTrace],
      nextBefore: null,
      hasMoreBefore: false,
    });
    heartbeatDeferred.resolve({
      items: [retainedHeartbeat],
      nextBefore: null,
      hasMoreBefore: false,
    });
    modelCallsDeferred.resolve({
      items: [
        retainedModelCall,
        createModelCallItem({
          id: 32,
          cycleId: 9,
          status: "done",
          provider: "openai",
          model: "gpt-5",
          createdAt: 1700000001000,
          updatedAt: 1700000001100,
          response: { usage: { outputTokens: 7 } },
        }),
      ],
      nextBefore: null,
      hasMoreBefore: false,
    });
    requestAuxDeferred.resolve({
      items: [{ id: 61, kind: "systemPrompt" }],
      nextBefore: null,
      hasMoreBefore: false,
    });
    apiCallsDeferred.resolve({
      items: [{ id: 71, label: "runtime.snapshot" }],
      nextBefore: null,
      hasMoreBefore: false,
    });

    await stopPromise;

    expect(store.getState().runtimes["i-1"]?.started).toBe(true);
    expect(store.getState().heartbeatGroupsBySession["i-1"]).toMatchObject({
      loaded: true,
      refreshing: false,
      data: [retainedHeartbeat],
    });
    expect(store.getState().schedulerLogsBySession["i-1"].map((entry) => entry.id)).toEqual([51, 52]);
    expect(store.getState().observabilityTracesBySession["i-1"].map((entry) => entry.id)).toEqual([41]);
    expect(store.getState().modelCallsBySession["i-1"].map((entry) => entry.id)).toEqual([31, 32]);
    expect(store.getState().requestAuxBySession["i-1"]).toEqual([{ id: 61, kind: "systemPrompt" }]);
    expect(store.getState().apiCallsBySession["i-1"]).toEqual([{ id: 71, label: "runtime.snapshot" }]);
    store.disconnect();
  });

  test("Scenario: Given a stopped session already has inspection facts When connectOnce rebuilds from a snapshot without a live runtime Then the cached lists remain projected", async () => {
    let snapshotCalls = 0;
    const stoppedSession = {
      ...createSnapshot(0).sessions[0],
      status: "stopped" as const,
    };
    const persistedAttention: RuntimeAttentionState = {
      snapshot: {
        contexts: [
          createAttentionContext({
            contextId: "ctx-reconnect-proof",
            owner: "avatar:jane",
            content: "reconnect must preserve inspection facts",
            contentFormat: "markdown",
            scoreMap: { z9y8x7: 12 },
            commit: createAttentionCommit({
              commitId: "commit-reconnect-proof",
              contextId: "ctx-reconnect-proof",
              author: "user:kzf",
              source: "message",
              summary: "Reconnect projection proof",
              value: "reconnect must preserve inspection facts",
              scores: { z9y8x7: 12 },
              format: "markdown",
            }),
          }),
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    };
    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          return createSnapshot(830);
        }
        return {
          ...createSnapshot(831),
          sessions: [stoppedSession],
          runtimes: {},
        };
      },
      attentionStateQuery: async () => persistedAttention,
    });

    const store = new RuntimeStore(client);
    const internal = store as unknown as { connectOnce: () => Promise<void> };
    await store.connect();

    const retainedHeartbeat = createHeartbeatGroup({
      id: 21,
      groupId: "heartbeat-group:call:21",
      aiCallId: 21,
      createdAt: 1700000002100,
      updatedAt: 1700000002200,
      items: [
        createHeartbeatEntry({
          id: 201,
          messageId: "hb-201",
          aiCallId: 21,
          createdAt: 1700000002100,
          updatedAt: 1700000002200,
          payload: "retained after reconnect",
        }),
      ],
    });
    const retainedModelCall = createModelCallItem({
      id: 81,
      cycleId: 17,
      status: "done",
      provider: "openai",
      model: "gpt-5",
      createdAt: 1700000002300,
      updatedAt: 1700000002400,
      response: { usage: { outputTokens: 4 } },
    });
    const retainedTrace = createTraceEntry({
      id: 91,
      cycleId: 17,
      startedAt: 1700000002500,
      endedAt: 1700000002600,
    });
    const retainedSchedulerLog = {
      id: 101,
      timestamp: 1700000002700,
      stateVersion: 7,
      event: "runtime.idle",
      prevHash: null,
      stateHash: "state-hash-101",
      patch: [],
    };

    const state = store.getState();
    state.heartbeatGroupsBySession["i-1"] = {
      data: [retainedHeartbeat],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: 1700000002800,
    };
    state.modelCallsBySession["i-1"] = [retainedModelCall];
    state.schedulerLogsBySession["i-1"] = [retainedSchedulerLog];
    state.observabilityTracesBySession["i-1"] = [retainedTrace];
    state.terminalReadsBySession["i-1"] = {
      main: {
        seq: 7,
        mode: "snapshot",
        text: "still here",
      },
    };
    state.attentionBySession = {
      ...(state.attentionBySession ?? {}),
      "i-1": persistedAttention,
    };
    state.runtimes["i-1"]!.terminalReads = state.terminalReadsBySession["i-1"];

    await internal.connectOnce();

    expect(store.getState().sessions[0]?.status).toBe("stopped");
    expect(store.getState().heartbeatGroupsBySession["i-1"]).toMatchObject({
      loaded: true,
      data: [retainedHeartbeat],
    });
    expect(store.getState().modelCallsBySession["i-1"].map((entry) => entry.id)).toEqual([81]);
    expect(store.getState().schedulerLogsBySession["i-1"].map((entry) => entry.id)).toEqual([101]);
    expect(store.getState().observabilityTracesBySession["i-1"].map((entry) => entry.id)).toEqual([91]);
    expect(store.getState().terminalReadsBySession["i-1"]).toEqual({
      main: {
        seq: 7,
        mode: "snapshot",
        text: "still here",
      },
    });
    expect(store.getState().runtimes["i-1"]?.started).toBe(false);
    expect(store.getState().runtimes["i-1"]?.terminalReads).toEqual({
      main: {
        seq: 7,
        mode: "snapshot",
        text: "still here",
      },
    });
    expect(store.getState().attentionBySession?.["i-1"]?.snapshot.contexts[0]?.contextId).toBe("ctx-reconnect-proof");
    store.disconnect();
  });

  test("Scenario: Given the Heartbeat footer requests a manual compact When the runtime store forwards it Then the formal runtime control mutation is used", async () => {
    const compactInputs: Array<{ sessionId: string }> = [];
    const client = createMockClient({
      snapshotQuery: async () => createSnapshot(900),
      requestCompactMutate: async (input) => {
        compactInputs.push(input);
        return { ok: true };
      },
    });
    const store = new RuntimeStore(client);

    await store.connect();
    await expect(store.requestRuntimeCompact("i-1")).resolves.toEqual({ ok: true });
    expect(compactInputs).toEqual([{ sessionId: "i-1" }]);
    store.disconnect();
  });

  test("Scenario: Given scheduler containment facts in runtime state When selectors read the cached runtime Then blocked/backoff diagnostics stay available without re-querying", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const schedulerState = {
      schemaVersion: 2 as const,
      stateVersion: 4,
      running: true,
      paused: false,
      runtimeStatus: "backoff" as const,
      phase: "waiting_commits" as const,
      gate: "waiting_input" as const,
      queueSize: 0,
      cycle: 7,
      sentBatches: 2,
      updatedAt: 1700000000000,
      lastMessageAt: 1700000000000,
      lastResponseAt: 1700000000100,
      lastWakeAt: 1700000000200,
      lastWakeSource: "attention",
      lastWakeCause: "attention_backoff",
      activeContextCount: 1,
      activeItemCount: 1,
      unresolvedScoreCount: 1,
      waitingReason: "attention_backoff",
      nextAutoWakeAt: 1700000000800,
      backoffMs: 600,
      retryCount: 1,
      blockedReason: null,
      lastProgressAt: 1699999999000,
      lastError: null,
    } satisfies NonNullable<RuntimeSnapshot["runtimes"][string]["schedulerState"]>;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(950, { schedulerState }),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    expect(store.getSchedulerState("i-1")).toMatchObject({
      runtimeStatus: "backoff",
      retryCount: 1,
      nextAutoWakeAt: 1700000000800,
    });
    expect(store.getSchedulerContainment("i-1")).toEqual({
      runtimeStatus: "backoff",
      waitingReason: "attention_backoff",
      nextAutoWakeAt: 1700000000800,
      backoffMs: 600,
      retryCount: 1,
      blockedReason: null,
      lastProgressAt: 1699999999000,
      lastError: null,
    });

    onData?.({
      version: 1,
      eventId: 951,
      timestamp: Date.now(),
      type: "runtime.scheduler.snapshot",
      sessionId: "i-1",
      payload: {
        snapshot: {
          state: {
            ...schedulerState,
            runtimeStatus: "blocked",
            waitingReason: "blocked",
            nextAutoWakeAt: null,
            backoffMs: null,
            retryCount: 2,
            blockedReason: "provider.unavailable",
          },
        },
      },
    });

    expect(store.getSchedulerContainment("i-1")).toEqual({
      runtimeStatus: "blocked",
      waitingReason: "blocked",
      nextAutoWakeAt: null,
      backoffMs: null,
      retryCount: 2,
      blockedReason: "provider.unavailable",
      lastProgressAt: 1699999999000,
      lastError: null,
    });
    store.disconnect();
  });

  test("Scenario: Given scheduler signals attention contexts and explicit effects When live runtime events arrive Then the store keeps scheduler metadata separate from attention facts and delivery effects", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(960),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    onData?.({
      version: 1,
      eventId: 961,
      timestamp: 1700000001000,
      type: "runtime.scheduler.signal",
      sessionId: "i-1",
      payload: {
        kind: "attention",
        version: 7,
        timestamp: 1700000001000,
      },
    });
    onData?.({
      version: 1,
      eventId: 962,
      timestamp: 1700000001001,
      type: "runtime.attention",
      sessionId: "i-1",
      payload: {
        snapshot: {
          contexts: [
            createAttentionContext({
              contextId: "ctx-room-main",
              owner: "message",
              content: "Need a direct answer from the room",
              scoreMap: { room: 5 },
              commit: createAttentionCommit({
                contextId: "ctx-room-main",
                commitId: "commit-room-main",
                summary: "Room asks a direct question",
                body: "Need a direct answer from the room",
              }),
            }),
          ],
        },
        active: [],
        cycleFrames: [],
        hooks: [],
      },
    });
    onData?.({
      version: 1,
      eventId: 963,
      timestamp: 1700000001002,
      type: "runtime.attentionDispatch",
      sessionId: "i-1",
      payload: {
        dispatch: {
          dispatchId: "dispatch-room-main",
          contextId: "ctx-room-main",
          commitId: "commit-room-main",
          cycleId: 14,
          attemptIndex: 1,
          agentCallId: "agent-call-room-main",
          sessionModelCallId: 101,
          createdAt: 1700000001002,
        },
        projection: {
          contextId: "ctx-room-main",
          commitId: "commit-room-main",
          state: "dispatching",
          attemptCount: 1,
          latestDispatchId: "dispatch-room-main",
          latestReceiptId: null,
          agentCallId: "agent-call-room-main",
          sessionModelCallId: 101,
          firstAcceptedAt: null,
          latestReceiptAt: null,
          latestError: null,
        },
      },
    });

    const runtime = store.getState().runtimes["i-1"];
    expect(runtime?.schedulerSignals.attention).toEqual({
      version: 7,
      timestamp: 1700000001000,
    });
    expect(store.getState().attentionBySession?.["i-1"]?.snapshot.contexts[0]).toEqual(
      expect.objectContaining({
        contextId: "ctx-room-main",
        owner: "message",
        scoreMap: { room: 5 },
      }),
    );
    expect(store.getState().attentionDeliveryBySession["i-1"]).toEqual(
      expect.objectContaining({
        projections: [
          expect.objectContaining({
            contextId: "ctx-room-main",
            state: "dispatching",
          }),
        ],
        dispatches: [
          expect.objectContaining({
            dispatchId: "dispatch-room-main",
          }),
        ],
        effects: [],
      }),
    );
    expect(store.getState().attentionDeliveryBySession["i-1"]?.effects).toEqual([]);
    store.disconnect();
  });

  test("Scenario: Given runtime attention delivery updates include watches and effects When the live event arrives Then the store replaces the explicit delivery ledger without mixing it into scheduler or attention channels", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(970),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();

    onData?.({
      version: 1,
      eventId: 971,
      timestamp: 1700000002000,
      type: "runtime.attentionDelivery",
      sessionId: "i-1",
      payload: {
        projections: [
          {
            contextId: "ctx-room-main",
            commitId: "commit-room-main",
            state: "completed",
            attemptCount: 1,
            latestDispatchId: "dispatch-room-main",
            latestReceiptId: "receipt-room-main",
            agentCallId: "agent-call-room-main",
            sessionModelCallId: 140,
            firstAcceptedAt: 1700000001800,
            latestReceiptAt: 1700000001900,
            latestError: null,
          },
        ],
        dispatches: [],
        receipts: [],
        watches: [
          {
            id: 1,
            watchId: "watch-room-main",
            ownerActionId: "action-watch-room-main",
            ownerActionKind: "message_follow_up",
            ownerActorId: "assistant",
            ownerCycleId: 12,
            ownerSessionModelCallId: 139,
            target: "room:room-main",
            predicate: {
              kind: "message_latest_visible",
              chatId: "room-main",
              anchorMessageId: 10,
            },
            dueAt: 1700000001500,
            status: "expired",
            createdAt: 1700000001200,
            updatedAt: 1700000001600,
            resolvedAt: 1700000001600,
            reminderContextId: "ctx-room-main",
            reminderCommitId: "commit-room-main",
            meta: {
              compatibilityAlias: "followUpAfterMs",
            },
          },
        ],
        effects: [
          {
            id: 1,
            effectId: "effect-room-main",
            contextId: "ctx-room-main",
            commitId: "commit-room-main",
            actionId: "action-message-send-room-main",
            actionKind: "message_send",
            actorId: "assistant",
            cycleId: 12,
            sessionModelCallId: 140,
            target: "room:room-main",
            effectKind: "message_row_created",
            effectRecordId: "room-main/10",
            timestamp: 1700000001900,
            meta: {
              chatId: "room-main",
              messageId: 10,
            },
          },
        ],
      },
    });

    expect(store.getState().attentionDeliveryBySession["i-1"]).toEqual(
      expect.objectContaining({
        projections: [
          expect.objectContaining({
            contextId: "ctx-room-main",
            state: "completed",
          }),
        ],
        watches: [
          expect.objectContaining({
            watchId: "watch-room-main",
            status: "expired",
          }),
        ],
        effects: [
          expect.objectContaining({
            effectId: "effect-room-main",
            effectKind: "message_row_created",
          }),
        ],
      }),
    );
    expect(store.getState().runtimes["i-1"]?.schedulerSignals.attention).toEqual({
      version: 0,
      timestamp: null,
    });
    expect(store.getState().attentionBySession?.["i-1"]).toEqual({
      snapshot: { contexts: [] },
      active: [],
      cycleFrames: [],
      hooks: [],
    });
    store.disconnect();
  });

  test("Scenario: Given abort clears runtime ownership When the stopped event is applied Then volatile runtime state resets while persisted cycles remain inspectable", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const stoppedSession = {
      ...createSnapshot(0).sessions[0],
      status: "stopped" as const,
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(900),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
      }),
    );

    await store.connect();
    const internal = store as unknown as { applyEvent: (event: unknown) => void };
    internal.applyEvent({
      version: 1,
      eventId: 901,
      type: "runtime.cycle.updated",
      sessionId: "i-1",
      timestamp: Date.now(),
      payload: {
        cycle: {
          id: "cycle:12",
          cycleId: 12,
          seq: 12,
          createdAt: Date.now(),
          wakeSource: "user",
          kind: "model",
          status: "done",
          clientMessageIds: ["client-12"],
          inputs: [],
          outputs: [],
          liveMessages: [],
          streaming: null,
          modelCallId: 13,
        },
      },
    });
    onData?.({
      eventId: 902,
      type: "session.updated",
      sessionId: "i-1",
      timestamp: Date.now(),
      payload: { session: stoppedSession },
    });

    expect(store.getState().runtimes["i-1"]?.started).toBe(false);
    expect(store.getState().runtimes["i-1"]?.activeCycle).toBeNull();
    expect(store.getState().terminalReadsBySession["i-1"]).toEqual({});
    expect(store.getState().chatCyclesBySession["i-1"]?.map((cycle) => cycle.id)).toEqual(["cycle:12"]);
    store.disconnect();
  });

  test("Scenario: Given a deep-linked stopped session When hydrateSessionArtifacts runs Then persisted Heartbeat Attention channels and notifications hydrate on first load", async () => {
    let snapshotCalls = 0;
    const stoppedSession = {
      ...createSnapshot(0).sessions[0],
      id: "i-2",
      name: "persisted-shell",
      status: "stopped" as const,
      sessionRoot: "/tmp/sessions/i-2",
    };
    const persistedAttention: RuntimeAttentionState = {
      snapshot: {
        contexts: [
          createAttentionContext({
            contextId: "ctx-room-main",
            owner: "avatar:persisted-shell",
            content: "deliver URL update",
            contentFormat: "markdown",
            scoreMap: { delivery: 100 },
            commit: createAttentionCommit({
              commitId: "commit-1",
              contextId: "ctx-room-main",
              author: "user:kzf",
              source: "message",
              summary: "Deliver the ready URL back to the room",
              value: "pending room delivery",
              scores: { delivery: 100 },
              format: "markdown",
            }),
          }),
        ],
      },
      active: [],
      cycleFrames: [],
      hooks: [],
    };
    const channel = {
      chatId: "room-main",
      kind: "room" as const,
      title: "Main room",
      owner: "persisted-shell",
      participants: [{ id: "auth:kzf", label: "kzf" }],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_admin",
    };
    const client = createMockClient({
      snapshotQuery: async () => {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          return {
            ...createSnapshot(900),
            sessions: [],
            runtimes: {},
          };
        }
        return {
          ...createSnapshot(901),
          sessions: [stoppedSession],
          runtimes: {},
        };
      },
      attentionStateQuery: async () => persistedAttention,
      chatListQuery: async () => ({
        items: [
          {
            id: 21,
            sessionId: "i-2",
            messageId: "msg-21",
            role: "assistant",
            channel: "to_user",
            content: "persisted ready url",
            timestamp: 21,
            cycleId: 2,
            format: "markdown",
            tool: null,
            attachments: [],
          },
        ],
        nextBefore: null,
        hasMoreBefore: false,
      }),
      chatCyclesQuery: async () => ({
        items: [],
        nextBefore: null,
        hasMoreBefore: false,
      }),
      messageListChannelsQuery: async () => ({ items: [channel] }),
      notificationSnapshotQuery: async () => ({
        items: [
          {
            id: "push-1",
            sessionId: "i-2",
            src: "msg:room-main/21",
            sourceNamespace: "msg" as const,
            sourceId: "room-main",
            bucketKey: "msg:room-main",
            attentionContextId: "ctx-room-main",
            attentionCommitId: "commit-21",
            workspacePath: stoppedSession.cwd,
            sessionName: stoppedSession.name,
            content: "persisted unread room message",
            timestamp: 21,
          },
        ],
        unreadBySession: { "i-2": 1 },
        unreadByBucket: { "i-2": { "msg:room-main": 1 } },
      }),
    });

    const store = new RuntimeStore(client);
    await store.connect();

    expect(store.getState().sessions).toEqual([]);

    await store.hydrateSessionArtifacts("i-2");

    expect(store.getState().sessions.map((session) => session.id)).toEqual(["i-2"]);
    expect(store.getState().runtimes["i-2"]?.started).toBe(false);
    expect(store.getState().attentionBySession?.["i-2"]).toEqual(persistedAttention);
    expect(store.getState().chatsBySession["i-2"]?.map((message) => message.content)).toEqual(["persisted ready url"]);
    expect(store.getState().messageChannelsBySession["i-2"]).toEqual({
      data: [channel],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: expect.any(Number),
    });
    expect(store.getState().notifications.map((item) => item.id)).toEqual(["push-1"]);
    expect(store.getState().unreadBySession["i-2"]).toBe(1);

    store.disconnect();
  });

  test("Scenario: Given reverse-time chat pages When loading older history Then the store uses explicit cursors and prepends without duplicates", async () => {
    const chatRequests: Array<{ before?: { beforeTimeMs: number; beforeId: number } }> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(950),
        chatListQuery: async (input) => {
          chatRequests.push({ before: input.before });
          if (!input.before) {
            return {
              items: [
                {
                  id: 11,
                  sessionId: "i-1",
                  messageId: "11",
                  role: "user",
                  channel: "user_input",
                  content: "newer user",
                  timestamp: 2_000,
                  cycleId: 11,
                  format: "markdown",
                  tool: null,
                  attachments: [],
                },
                {
                  id: 12,
                  sessionId: "i-1",
                  messageId: "12",
                  role: "assistant",
                  channel: "to_user",
                  content: "newer assistant",
                  timestamp: 3_000,
                  cycleId: 12,
                  format: "markdown",
                  tool: null,
                  attachments: [],
                },
              ],
              nextBefore: { beforeTimeMs: 2_000, beforeId: 11 },
              hasMoreBefore: true,
            };
          }
          return {
            items: [
              {
                id: 9,
                sessionId: "i-1",
                messageId: "9",
                role: "user",
                channel: "user_input",
                content: "older user",
                timestamp: 1_000,
                cycleId: 9,
                format: "markdown",
                tool: null,
                attachments: [],
              },
              {
                id: 10,
                sessionId: "i-1",
                messageId: "10",
                role: "assistant",
                channel: "to_user",
                content: "older assistant",
                timestamp: 2_000,
                cycleId: 10,
                format: "markdown",
                tool: null,
                attachments: [],
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    await store.connect();
    await store.loadChatMessages("i-1", 2);
    const output = await store.loadMoreChatMessagesBefore("i-1", 2);

    expect(chatRequests).toEqual([{ before: undefined }, { before: { beforeTimeMs: 2_000, beforeId: 11 } }]);
    expect(store.getState().chatsBySession["i-1"]?.map((item) => item.id)).toEqual(["9", "10", "11", "12"]);
    expect(output).toEqual({ items: 2, hasMore: false });
    store.disconnect();
  });

  test("Scenario: Given terminal activity reverse pages When loading older rows Then the store keeps one scoped timeline per terminal", async () => {
    const activityRequests: Array<{ before?: { beforeTimeMs: number; beforeId: number } }> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(980),
        terminalActivityPageQuery: async (input) => {
          activityRequests.push({ before: input.before });
          if (!input.before) {
            return {
              items: [
                {
                  id: 21,
                  terminalId: "main",
                  createdAt: 2_000,
                  kind: "terminal_read",
                  cycleId: 21,
                  title: "read-21",
                  content: "stdout",
                },
                {
                  id: 22,
                  terminalId: "main",
                  createdAt: 3_000,
                  kind: "message",
                  cycleId: 22,
                  title: "message-22",
                  content: "assistant mentions main",
                },
              ],
              nextBefore: { beforeTimeMs: 2_000, beforeId: 21 },
              hasMoreBefore: true,
            };
          }
          return {
            items: [
              {
                id: 19,
                terminalId: "main",
                createdAt: 1_000,
                kind: "terminal_write",
                cycleId: 19,
                title: "write-19",
                content: "echo hi",
              },
              {
                id: 20,
                terminalId: "main",
                createdAt: 2_000,
                kind: "terminal_read",
                cycleId: 20,
                title: "read-20",
                content: "older stdout",
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    await store.connect();
    await store.loadTerminalActivity("i-1", "main", 2);
    const output = await store.loadMoreTerminalActivity("i-1", "main", 2);

    expect(activityRequests).toEqual([{ before: undefined }, { before: { beforeTimeMs: 2_000, beforeId: 21 } }]);
    expect(store.getState().terminalActivityBySession["i-1"]?.main?.map((item) => item.id)).toEqual([19, 20, 21, 22]);
    expect(output).toEqual({ items: 2, hasMore: false });
    store.disconnect();
  });

  test("Scenario: Given global terminal activity hydrates without an explicit limit When the shared actions rail is queried Then the store uses the compact 20-row default", async () => {
    const requests: Array<number | undefined> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(980),
        terminalActivityPageQuery: async (input) => {
          requests.push(input.limit);
          return {
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    await store.hydrateGlobalTerminalActivity({ terminalId: "term-default-limit" });

    expect(requests).toEqual([20]);
    store.disconnect();
  });

  test("Scenario: Given runtime snapshot already contains focused chat-channel descriptors When the store hydrates a started session Then chat bootstrap does not need a second list call", async () => {
    let listChannelsCalls = 0;
    const channel = {
      chatId: "room-main",
      kind: "room" as const,
      title: "Main room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:kzf", label: "kzf" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0, { messageChannels: [channel] }),
        messageListChannelsQuery: async () => {
          listChannelsCalls += 1;
          return { items: [channel] };
        },
      }),
    );

    await store.connect();

    expect(store.getState().messageChannelsBySession["i-1"]).toEqual({
      data: [channel],
      loaded: true,
      loading: false,
      refreshing: false,
      error: null,
      refreshedAt: expect.any(Number),
    });

    await expect(store.ensureMessageChannels("i-1")).resolves.toEqual([channel]);
    expect(listChannelsCalls).toBe(0);

    store.disconnect();
  });

  test("Scenario: Given tokenized chat-channel admin APIs When runtime store proxies message-system calls Then access tokens stay threaded without hidden session trust", async () => {
    const requests: {
      focus?: { sessionId: string; op: string; channels: Array<{ chatId: string; accessToken: string }> };
      send?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        text: string;
        assetIds?: string[];
        clientMessageId: string;
      };
      edit?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        messageId: number;
        text: string;
      };
      recall?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        messageId: number;
      };
      update?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        patch: {
          title?: string;
          participants?: Array<{ id: string; label?: string }>;
        };
      };
      listGrants?: { sessionId: string; chatId: string; accessToken: string };
      issue?: {
        sessionId: string;
        chatId: string;
        accessToken: string;
        role: "admin" | "member" | "readonly";
        label?: string;
        participantId?: string;
      };
      revoke?: { sessionId: string; chatId: string; accessToken: string; grantId: string };
    } = {};
    const channel = {
      chatId: "room-main",
      kind: "room" as const,
      title: "Main room",
      owner: "jane",
      participants: [
        { id: "session:jane", label: "jane" },
        { id: "auth:kzf", label: "kzf" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-main?token=msgtok_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageListChannelsQuery: async () => ({ items: [channel] }),
        messageFocusMutate: async (input) => {
          requests.focus = input;
          return { items: [channel] };
        },
        messageSendMutate: async (input) => {
          requests.send = input;
          return {
            ok: true,
            messageId: 8,
            recentMessages: [
              {
                messageId: 7,
                from: "teammate",
                contentPreview: "previous room state",
                sendTime: "20260418010101003",
              },
              {
                messageId: 8,
                from: "User",
                contentPreview: input.text,
                sendTime: "20260418010101004",
              },
            ],
          };
        },
        messageEditMutate: async (input) => {
          requests.edit = input;
          return { ok: true, messageId: input.messageId, updatedAt: 5 };
        },
        messageRecallMutate: async (input) => {
          requests.recall = input;
          return { ok: true, messageId: input.messageId, updatedAt: 6, recalledAt: 6 };
        },
        messageUpdateChannelMutate: async (input) => {
          requests.update = input;
          return {
            channel: {
              ...channel,
              title: input.patch.title ?? channel.title,
            },
          };
        },
        messageListChannelGrantsQuery: async (input) => {
          requests.listGrants = input;
          return {
            items: [
              {
                grantId: "grant-readonly",
                chatId: "chat-main",
                role: "readonly" as const,
                label: "Viewer",
                participantId: "user:gaubee",
                createdAt: 2,
              },
            ],
          };
        },
        messageIssueChannelGrantMutate: async (input) => {
          requests.issue = input;
          return {
            grant: {
              grantId: "grant-member",
              chatId: "chat-main",
              role: input.role,
              label: input.label,
              participantId: input.participantId,
              createdAt: 3,
              accessRole: input.role,
              accessToken: "msgtok_member",
              transportUrl: "ws://127.0.0.1:7777/room/chat-main?token=msgtok_member",
            },
          };
        },
        messageRevokeChannelGrantMutate: async (input) => {
          requests.revoke = input;
          return { ok: true };
        },
      }),
    );

    expect(await store.listMessageChannels("i-1")).toEqual([channel]);
    await store.focusMessageChannels({
      sessionId: "i-1",
      op: "replace",
      channels: [{ chatId: "chat-main", accessToken: "msgtok_admin" }],
    });
    const sent = await store.sendMessageChannel({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      text: "hello",
      assetIds: ["asset-1"],
    });
    const edited = await store.editMessageChannel({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      messageId: 1,
      text: "hello again",
    });
    const recalled = await store.recallMessageChannel({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      messageId: 2,
    });
    const updated = await store.updateMessageChannel({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      patch: { title: "Updated chat" },
    });
    const grants = await store.listMessageChannelGrants({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
    });
    const issued = await store.issueMessageChannelGrant({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      role: "member",
      label: "Relay",
      participantId: "user:gaubee",
    });
    const revoked = await store.revokeMessageChannelGrant({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      grantId: "grant-member",
    });

    expect(requests.focus).toEqual({
      sessionId: "i-1",
      op: "replace",
      channels: [{ chatId: "chat-main", accessToken: "msgtok_admin" }],
    });
    expect(requests.send?.accessToken).toBe("msgtok_admin");
    expect(requests.send?.assetIds).toEqual(["asset-1"]);
    expect(sent.recentMessages.at(-1)?.contentPreview).toBe("hello");
    expect(sent.recentMessages.at(-1)?.sendTime).toBe("20260418010101004");
    expect(requests.edit).toEqual({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      messageId: 1,
      text: "hello again",
    });
    expect(edited).toMatchObject({ ok: true, messageId: 1, updatedAt: 5 });
    expect(requests.recall).toEqual({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      messageId: 2,
    });
    expect(recalled).toMatchObject({ ok: true, messageId: 2, updatedAt: 6, recalledAt: 6 });
    expect(requests.update?.patch.title).toBe("Updated chat");
    expect(requests.listGrants?.accessToken).toBe("msgtok_admin");
    expect(requests.issue?.participantId).toBe("user:gaubee");
    expect(requests.revoke).toEqual({
      sessionId: "i-1",
      chatId: "chat-main",
      accessToken: "msgtok_admin",
      grantId: "grant-member",
    });
    expect(updated.title).toBe("Updated chat");
    expect(grants[0]?.role).toBe("readonly");
    expect(issued.accessToken).toBe("msgtok_member");
    expect(revoked).toEqual({ ok: true });
  });

  test("Scenario: Given global room authority APIs When runtime store proxies room-first calls Then room refs stay independent from session routes", async () => {
    const requests: {
      list?: { includeArchived?: boolean };
      create?: {
        chatId?: string;
        kind: "room";
        title?: string;
        participants?: Array<{ id: string; label?: string }>;
        metadata?: Record<string, unknown>;
        adminToken?: string;
        focus?: boolean;
      };
      focus?: { op: string; channels: Array<{ chatId: string; accessToken?: string }> };
      snapshot?: { chatId: string; accessToken?: string; limit?: number };
      page?: {
        chatId: string;
        accessToken?: string;
        before?: { beforeTimeMs: number; beforeId: number };
        limit?: number;
      };
      send?: {
        chatId: string;
        accessToken?: string;
        text: string;
        assetIds?: string[];
        clientMessageId?: string;
      };
      recall?: {
        chatId: string;
        accessToken?: string;
        messageId: number;
      };
      update?: {
        chatId: string;
        accessToken?: string;
        patch: {
          title?: string;
          participants?: Array<{ id: string; label?: string }>;
          metadata?: Record<string, unknown>;
          adminGroupCandidateIds?: string[];
        };
      };
      listGrants?: { chatId: string; accessToken?: string };
      issue?: {
        chatId: string;
        accessToken?: string;
        role: "admin" | "member" | "readonly";
        participantId: string;
        label?: string;
        accessTokenHint?: string;
      };
      revoke?: { chatId: string; accessToken?: string; grantId: string };
      archive?: { chatId: string; accessToken?: string; archivedBy?: string };
      delete?: { chatId: string; accessToken?: string };
    } = {};
    const room = {
      chatId: "room-ops",
      kind: "room" as const,
      title: "Ops room",
      owner: "ops-bot",
      participants: [
        { id: "session:ops-bot", label: "ops-bot" },
        { id: "auth:kzf", label: "kzf" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_ops_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-ops?token=msgtok_ops_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageGlobalListQuery: async (input) => {
          requests.list = input;
          return { items: [room] };
        },
        messageGlobalCreateMutate: async (input) => {
          requests.create = input;
          return { channel: room };
        },
        messageGlobalFocusMutate: async (input) => {
          requests.focus = input;
          return { ok: true, message: "focused", focusedChatIds: input.channels.map((channel) => channel.chatId) };
        },
        messageGlobalSnapshotQuery: async (input) => {
          requests.snapshot = input;
          return {
            channel: room,
            items: [
              {
                rowId: 11,
                messageId: 11,
                chatId: room.chatId,
                from: "ops-bot",
                kind: "text" as const,
                content: "snapshot",
                createdAt: 2,
                updatedAt: 2,
                readActorIds: [],
                unreadActorIds: [],
              } satisfies GlobalRoomMessage,
            ],
            nextBefore: { beforeTimeMs: 2, beforeId: 11 },
            hasMoreBefore: true,
            headVersion: "7",
          };
        },
        messageGlobalPageQuery: async (input) => {
          requests.page = input;
          return {
            items: [
              {
                rowId: 10,
                messageId: 10,
                chatId: room.chatId,
                from: "ops-bot",
                kind: "text" as const,
                content: "older",
                createdAt: 1,
                updatedAt: 1,
                readActorIds: [],
                unreadActorIds: [],
              } satisfies GlobalRoomMessage,
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
        messageGlobalSendMutate: async (input) => {
          requests.send = input;
          return { ok: true };
        },
        messageGlobalRecallMutate: async (input) => {
          requests.recall = input;
          return { ok: true, messageId: input.messageId, updatedAt: 8, recalledAt: 8 };
        },
        messageGlobalUpdateMutate: async (input) => {
          requests.update = input;
          return {
            channel: {
              ...room,
              title: input.patch.title ?? room.title,
            },
          };
        },
        messageGlobalListGrantsQuery: async (input) => {
          requests.listGrants = input;
          return {
            items: [
              {
                grantId: "grant-ops",
                chatId: room.chatId,
                role: "member" as const,
                label: "Observer",
                participantId: "auth:observer",
                createdAt: 3,
              },
            ],
          };
        },
        messageGlobalIssueGrantMutate: async (input) => {
          requests.issue = input;
          return {
            grant: {
              grantId: "grant-member",
              chatId: input.chatId,
              role: input.role,
              label: input.label,
              participantId: input.participantId,
              createdAt: 4,
              accessRole: input.role,
              accessToken: "msgtok_member",
              transportUrl: "ws://127.0.0.1:7777/room/room-ops?token=msgtok_member",
            },
          };
        },
        messageGlobalRevokeGrantMutate: async (input) => {
          requests.revoke = input;
          return { ok: true };
        },
        messageGlobalArchiveMutate: async (input) => {
          requests.archive = input;
          return { channel: { ...room, archivedAt: 9, archivedBy: input.archivedBy ?? "ops-bot" } };
        },
        messageGlobalDeleteMutate: async (input) => {
          requests.delete = input;
          return { channel: room };
        },
      }),
    );

    expect(await store.listGlobalRooms()).toEqual([room]);
    expect(
      await store.createGlobalRoom({
        title: "Ops room",
        initialUsers: [
          {
            actorId: "auth:observer",
            label: "Observer",
            role: "member",
            focused: true,
          },
        ],
      }),
    ).toEqual(room);
    expect(
      await store.focusGlobalRooms({
        op: "replace",
        channels: [{ chatId: room.chatId, accessToken: room.accessToken }],
      }),
    ).toEqual({
      ok: true,
      message: "focused",
      focusedChatIds: [room.chatId],
    });
    expect(await store.snapshotGlobalRoom({ chatId: room.chatId, accessToken: room.accessToken, limit: 20 })).toEqual({
      channel: room,
      items: [
        {
          rowId: 11,
          messageId: 11,
          chatId: room.chatId,
          from: "ops-bot",
          kind: "text",
          content: "snapshot",
          createdAt: 2,
          updatedAt: 2,
          readActorIds: [],
          unreadActorIds: [],
        },
      ],
      nextBefore: { beforeTimeMs: 2, beforeId: 11 },
      hasMoreBefore: true,
      headVersion: "7",
    });
    expect(
      await store.pageGlobalRoomMessages({
        chatId: room.chatId,
        accessToken: room.accessToken,
        before: { beforeTimeMs: 2, beforeId: 11 },
        limit: 20,
      }),
    ).toEqual({
      items: [
        {
          rowId: 10,
          messageId: 10,
          chatId: room.chatId,
          from: "ops-bot",
          kind: "text",
          content: "older",
          createdAt: 1,
          updatedAt: 1,
          readActorIds: [],
          unreadActorIds: [],
        },
      ],
      hasMore: false,
      nextBefore: null,
    });
    expect(
      await store.sendGlobalRoomMessage({
        chatId: room.chatId,
        accessToken: room.accessToken,
        text: "hello ops",
        assetIds: ["asset-1"],
        clientMessageId: "client-room-1",
      }),
    ).toEqual({ ok: true });
    expect(
      await store.recallGlobalRoomMessage({
        chatId: room.chatId,
        accessToken: room.accessToken,
        messageId: 11,
      }),
    ).toEqual({ ok: true, messageId: 11, updatedAt: 8, recalledAt: 8 });
    const updated = await store.updateGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      patch: { title: "Ops renamed", adminGroupCandidateIds: ["auth:admin-a"] },
    });
    const grants = await store.listGlobalRoomGrants({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    const issued = await store.issueGlobalRoomGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      role: "member",
      participantId: "auth:observer",
      label: "Observer",
    });
    const revoked = await store.revokeGlobalRoomGrant({
      chatId: room.chatId,
      accessToken: room.accessToken,
      grantId: "grant-member",
    });
    const archived = await store.archiveGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
      archivedBy: "ops-bot",
    });
    const deleted = await store.deleteGlobalRoom({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });

    expect(requests.list).toEqual({});
    expect(requests.create).toMatchObject({
      title: "Ops room",
      initialUsers: [
        {
          actorId: "auth:observer",
          label: "Observer",
          role: "member",
          focused: true,
        },
      ],
    });
    expect(requests.focus).toEqual({
      op: "replace",
      channels: [{ chatId: room.chatId, accessToken: room.accessToken }],
    });
    expect(requests.snapshot).toEqual({ chatId: room.chatId, accessToken: room.accessToken, limit: 20 });
    expect(requests.page).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      before: { beforeTimeMs: 2, beforeId: 11 },
      limit: 20,
    });
    expect(requests.send?.text).toBe("hello ops");
    expect(requests.send?.assetIds).toEqual(["asset-1"]);
    expect(requests.send?.clientMessageId).toBe("client-room-1");
    expect(requests.recall).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: 11,
    });
    expect(requests.update?.patch.adminGroupCandidateIds).toEqual(["auth:admin-a"]);
    expect(requests.listGrants?.accessToken).toBe(room.accessToken);
    expect(requests.issue?.participantId).toBe("auth:observer");
    expect(requests.revoke).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      grantId: "grant-member",
    });
    expect(requests.archive).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      archivedBy: "ops-bot",
    });
    expect(requests.delete).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
    });
    expect(updated.title).toBe("Ops renamed");
    expect(grants[0]?.participantId).toBe("auth:observer");
    expect(issued.accessToken).toBe("msgtok_member");
    expect(revoked).toEqual({ ok: true });
    expect(archived.archivedBy).toBe("ops-bot");
    expect(deleted.chatId).toBe(room.chatId);
  });

  test("Scenario: Given a focused room snapshot watcher When a seat-focus mutation uses a member credential Then snapshot refresh keeps the catalog control token", async () => {
    const snapshotRequests: Array<{ chatId: string; accessToken?: string; limit?: number }> = [];
    const room = {
      chatId: "room-focus-refresh",
      kind: "room" as const,
      title: "Focus refresh room",
      owner: "ops-bot",
      participants: [
        { id: "session:ops-bot", label: "ops-bot" },
        { id: "auth:kzf", label: "kzf" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "msgtok_ops_admin",
      transportUrl: "ws://127.0.0.1:7777/room/room-focus-refresh?token=msgtok_ops_admin",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageGlobalListQuery: async () => ({ items: [room] }),
        messageGlobalFocusMutate: async (input) => ({
          ok: true,
          message: "focused",
          focusedChatIds: input.channels.map((channel) => channel.chatId),
        }),
        messageGlobalSnapshotQuery: async (input) => {
          snapshotRequests.push(input);
          return {
            channel: room,
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: "1",
          };
        },
      }),
    );

    await store.listGlobalRooms();
    const releaseSnapshot = store.retainGlobalRoomSnapshot(room.chatId);
    try {
      await store.focusGlobalRooms({
        op: "replace",
        channels: [{ chatId: room.chatId, accessToken: "msgtok_member" }],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      releaseSnapshot();
    }

    expect(snapshotRequests).toEqual([
      {
        chatId: room.chatId,
        accessToken: room.accessToken,
        limit: 120,
      },
    ]);
  });

  test("Scenario: Given optional room access tokens When runtime store receives an empty token placeholder Then room-first requests omit the token instead of forwarding an invalid empty string", async () => {
    const requests: {
      snapshot?: { chatId: string; accessToken?: string; limit?: number };
      update?: {
        chatId: string;
        accessToken?: string;
        patch: {
          title?: string;
          participants?: Array<{ id: string; label?: string }>;
          metadata?: Record<string, unknown>;
          adminGroupCandidateIds?: string[];
        };
      };
      listGrants?: { chatId: string; accessToken?: string };
    } = {};
    const room = {
      chatId: "room-empty-token",
      kind: "room" as const,
      title: "Empty token room",
      owner: "ops-bot",
      participants: [{ id: "auth:kzf", label: "kzf" }],
      createdAt: 1,
      updatedAt: 1,
      focused: false,
      accessRole: "admin" as const,
      accessToken: "",
      transportUrl: "ws://127.0.0.1:7777/room/room-empty-token",
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageGlobalListQuery: async () => ({ items: [room] }),
        messageGlobalSnapshotQuery: async (input) => {
          requests.snapshot = input;
          return {
            channel: room,
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: "1",
          };
        },
        messageGlobalUpdateMutate: async (input) => {
          requests.update = input;
          return { channel: { ...room, title: input.patch.title ?? room.title } };
        },
        messageGlobalListGrantsQuery: async (input) => {
          requests.listGrants = input;
          return { items: [] };
        },
      }),
    );

    await store.listGlobalRooms();
    await store.hydrateGlobalRoomSnapshot({ chatId: room.chatId, force: true });
    await store.updateGlobalRoom({
      chatId: room.chatId,
      accessToken: "",
      patch: { title: "Empty token room renamed" },
    });
    await store.listGlobalRoomGrants({
      chatId: room.chatId,
      accessToken: "",
    });

    expect(requests.snapshot).toEqual({
      chatId: room.chatId,
      accessToken: undefined,
      limit: 120,
    });
    expect(requests.update).toEqual({
      chatId: room.chatId,
      accessToken: undefined,
      patch: { title: "Empty token room renamed" },
    });
    expect(requests.listGrants).toEqual({
      chatId: room.chatId,
      accessToken: undefined,
    });
  });

  test("Scenario: Given retained room slices When a live room invalidation arrives Then runtime store refreshes only the retained room resources", async () => {
    const roomA = {
      chatId: "room-alpha",
      kind: "room" as const,
      title: "Alpha",
      owner: "ops-bot",
      participants: [{ id: "auth:kzf", label: "kzf" }],
      createdAt: 1,
      updatedAt: 1,
      focused: false,
      accessRole: "admin" as const,
      accessToken: "msgtok_alpha",
      transportUrl: "ws://127.0.0.1:7777/room/room-alpha?token=msgtok_alpha",
    };
    const roomB = {
      ...roomA,
      chatId: "room-beta",
      title: "Beta",
      accessToken: "msgtok_beta",
      transportUrl: "ws://127.0.0.1:7777/room/room-beta?token=msgtok_beta",
    };
    const snapshotCounts: Record<string, number> = {
      [roomA.chatId]: 0,
      [roomB.chatId]: 0,
    };
    const grantCounts: Record<string, number> = {
      [roomA.chatId]: 0,
      [roomB.chatId]: 0,
    };
    const assetCounts: Record<string, number> = {
      [roomA.chatId]: 0,
      [roomB.chatId]: 0,
    };
    let eventHandlers: SubscriptionHandlers | null = null;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        onSubscribe: (handlers) => {
          eventHandlers = handlers;
        },
        messageGlobalListQuery: async () => ({
          items: [roomA, roomB],
        }),
        messageGlobalSnapshotQuery: async (input) => {
          snapshotCounts[input.chatId] += 1;
          return {
            channel: input.chatId === roomA.chatId ? roomA : roomB,
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: `${snapshotCounts[input.chatId]}`,
          };
        },
        messageGlobalListGrantsQuery: async (input) => {
          grantCounts[input.chatId] += 1;
          return {
            items: [
              {
                grantId: `grant-${input.chatId}`,
                chatId: input.chatId,
                role: "member" as const,
                participantId: "auth:observer",
                label: "Observer",
                createdAt: grantCounts[input.chatId],
              },
            ],
          };
        },
        messageGlobalListAssetsQuery: async (input) => {
          assetCounts[input.chatId] += 1;
          return {
            items: [
              {
                assetId: `asset-${input.chatId}-${assetCounts[input.chatId]}`,
                kind: "file" as const,
                name: `brief-${assetCounts[input.chatId]}.txt`,
                mimeType: "text/plain",
                sizeBytes: 16,
                url: `/media/rooms/${encodeURIComponent(input.chatId)}/assets/${assetCounts[input.chatId]}`,
                createdAt: assetCounts[input.chatId],
                updatedAt: assetCounts[input.chatId],
                uploadedByActorId: "auth:observer",
              },
            ],
          };
        },
      }),
    );

    await store.connect();
    await store.hydrateGlobalRooms();
    const releaseSnapshot = store.retainGlobalRoomSnapshot(roomA.chatId);
    const releaseGrants = store.retainGlobalRoomGrants(roomA.chatId);
    const releaseAssets = store.retainGlobalRoomAssets(roomA.chatId);
    await store.hydrateGlobalRoomSnapshot({
      chatId: roomA.chatId,
      accessToken: roomA.accessToken,
      limit: 20,
    });
    await store.hydrateGlobalRoomGrants({
      chatId: roomA.chatId,
      accessToken: roomA.accessToken,
    });
    await store.hydrateGlobalRoomAssets({
      chatId: roomA.chatId,
      accessToken: roomA.accessToken,
    });

    expect(snapshotCounts[roomA.chatId]).toBe(1);
    expect(snapshotCounts[roomB.chatId]).toBe(0);
    expect(grantCounts[roomA.chatId]).toBe(1);
    expect(grantCounts[roomB.chatId]).toBe(0);
    expect(assetCounts[roomA.chatId]).toBe(1);
    expect(assetCounts[roomB.chatId]).toBe(0);

    emitSubscriptionEvent(eventHandlers, {
      version: 1,
      eventId: 1,
      timestamp: Date.now(),
      type: "message.room.updated",
      payload: {
        snapshotRoomIds: [roomA.chatId, roomB.chatId],
        grantRoomIds: [roomA.chatId, roomB.chatId],
        assetRoomIds: [roomA.chatId, roomB.chatId],
      },
    });

    await waitFor(
      () => snapshotCounts[roomA.chatId] === 2 && grantCounts[roomA.chatId] === 2 && assetCounts[roomA.chatId] === 2,
    );
    expect(snapshotCounts[roomB.chatId]).toBe(0);
    expect(grantCounts[roomB.chatId]).toBe(0);
    expect(assetCounts[roomB.chatId]).toBe(0);

    releaseSnapshot();
    releaseGrants();
    releaseAssets();
    store.disconnect();
  });

  test("Scenario: Given unauthenticated browser global room hydration When room catalog and room slices are requested Then runtime store resolves explicit auth-required states instead of throwing", async () => {
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageGlobalListQuery: async () => {
          throw createUnauthorizedTrpcError();
        },
        messageGlobalSnapshotQuery: async () => {
          throw createUnauthorizedTrpcError();
        },
        messageGlobalListGrantsQuery: async () => {
          throw createUnauthorizedTrpcError();
        },
        messageGlobalListAssetsQuery: async () => {
          throw createUnauthorizedTrpcError();
        },
      }),
    );

    await store.connect();

    await expect(store.hydrateGlobalRooms()).resolves.toEqual([]);
    expect(store.getState().globalRooms).toMatchObject({
      data: [],
      loaded: true,
      loading: false,
      refreshing: false,
      error: "auth token required",
    });

    const releaseSnapshot = store.retainGlobalRoomSnapshot("room-auth");
    const releaseGrants = store.retainGlobalRoomGrants("room-auth");
    const releaseAssets = store.retainGlobalRoomAssets("room-auth");

    await expect(
      store.hydrateGlobalRoomSnapshot({
        chatId: "room-auth",
        accessToken: "msgtok_auth",
        limit: 20,
      }),
    ).resolves.toBeNull();
    expect(store.getState().globalRoomSnapshotsById["room-auth"]).toMatchObject({
      data: null,
      loaded: true,
      loading: false,
      refreshing: false,
      error: "auth token required",
    });

    await expect(
      store.hydrateGlobalRoomGrants({
        chatId: "room-auth",
        accessToken: "msgtok_auth",
      }),
    ).resolves.toEqual([]);
    expect(store.getState().globalRoomGrantsById["room-auth"]).toMatchObject({
      data: [],
      loaded: true,
      loading: false,
      refreshing: false,
      error: "auth token required",
    });

    await expect(
      store.hydrateGlobalRoomAssets({
        chatId: "room-auth",
        accessToken: "msgtok_auth",
      }),
    ).resolves.toEqual([]);
    expect(store.getState().globalRoomAssetsById["room-auth"]).toMatchObject({
      data: [],
      loaded: true,
      loading: false,
      refreshing: false,
      error: "auth token required",
    });

    releaseAssets();
    releaseGrants();
    releaseSnapshot();
    store.disconnect();
  });

  test("Scenario: Given retained terminal slices When a live terminal invalidation arrives Then runtime store refreshes only the retained terminal resources", async () => {
    const createTerminalEntry = (
      terminalId: string,
      title: string,
      cwd: string,
      accessToken: string,
    ): GlobalTerminalEntry => ({
      terminalId,
      processKind: "shell",
      command: ["/bin/bash"],
      launchCwd: cwd,
      workspace: null,
      status: "IDLE" as const,
      processPhase: "running" as const,
      seq: 1,
      snapshot: {
        seq: 1,
        timestamp: 1,
        cols: 80,
        rows: 24,
        lines: Array.from({ length: 24 }, () => ""),
        cursor: { x: 0, y: 0 },
      },
      focused: false,
      icon: undefined,
      configuredTitle: title,
      currentTitle: undefined,
      currentPath: undefined,
      shortcuts: undefined,
      rendererPreference: "auto" as const,
      theme: "default-dark" as const,
      cursor: "block" as const,
      transportUrl: `ws://127.0.0.1:7777/pty/${terminalId}?token=${accessToken}`,
      currentAdminId: "system:trusted-terminal-bootstrap",
      approvalTimeoutMs: 90_000,
      pendingRequestCount: 0,
      access: {
        role: "admin" as const,
        accessToken,
        participantId: "system:trusted-terminal-bootstrap",
        currentAdmin: true,
      },
      actors: [
        {
          actorId: "auth:observer",
          role: "readonly" as const,
          label: "Observer",
          currentAdmin: false,
          online: false,
          focused: false,
          invalidCredential: false,
        },
      ],
    });

    const terminalA = createTerminalEntry("term-alpha", "Alpha terminal", "/repo/alpha", "tok-alpha");
    const terminalB = createTerminalEntry("term-beta", "Beta terminal", "/repo/beta", "tok-beta");
    let catalogCalls = 0;
    const grantCounts: Record<string, number> = {
      [terminalA.terminalId]: 0,
      [terminalB.terminalId]: 0,
    };
    const approvalCounts: Record<string, number> = {
      [terminalA.terminalId]: 0,
      [terminalB.terminalId]: 0,
    };
    const activityCounts: Record<string, number> = {
      [terminalA.terminalId]: 0,
      [terminalB.terminalId]: 0,
    };
    let eventHandlers: SubscriptionHandlers | null = null;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        onSubscribe: (handlers) => {
          eventHandlers = handlers;
        },
        terminalGlobalListQuery: async () => {
          catalogCalls += 1;
          return { items: [terminalA, terminalB] };
        },
        terminalListGrantsQuery: async (input) => {
          grantCounts[input.terminalId] += 1;
          return {
            items: [
              {
                grantId: `grant:${input.terminalId}`,
                terminalId: input.terminalId,
                role: "writer" as const,
                participantId: "session:reviewer",
                label: "Reviewer",
                accessToken: `grant:${input.terminalId}:writer`,
                currentAdmin: false,
                createdAt: grantCounts[input.terminalId],
              },
            ],
          };
        },
        terminalListApprovalRequestsQuery: async (input) => {
          approvalCounts[input.terminalId] += 1;
          return {
            items: [
              {
                requestId: `approval:${input.terminalId}`,
                terminalId: input.terminalId,
                participantId: "auth:guard",
                assignedAdminId: "system:trusted-terminal-bootstrap",
                status: "pending" as const,
                requestedInput: {
                  mode: "raw" as const,
                  text: `echo approval-${approvalCounts[input.terminalId]}`,
                },
                createdAt: approvalCounts[input.terminalId],
                expiresAt: approvalCounts[input.terminalId] + 90_000,
              },
            ],
          };
        },
        terminalActivityPageQuery: async (input) => {
          activityCounts[input.terminalId] += 1;
          return {
            items: [
              {
                id: activityCounts[input.terminalId],
                terminalId: input.terminalId,
                createdAt: activityCounts[input.terminalId],
                kind: "terminal_write" as const,
                cycleId: null,
                actorId: "system:trusted-terminal-bootstrap",
                title: "Terminal write",
                content: `echo ${input.terminalId}-${activityCounts[input.terminalId]}`,
                detail: { mode: "raw" },
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    await store.connect();
    const releaseCatalog = store.retainGlobalTerminals();
    await store.hydrateGlobalTerminals();
    const releaseGrants = store.retainGlobalTerminalGrants(terminalA.terminalId);
    const releaseApprovals = store.retainGlobalTerminalApprovals(terminalA.terminalId);
    const releaseActivity = store.retainGlobalTerminalActivity(terminalA.terminalId);
    await store.hydrateGlobalTerminalGrants({ terminalId: terminalA.terminalId });
    await store.hydrateGlobalTerminalApprovals({ terminalId: terminalA.terminalId });
    await store.hydrateGlobalTerminalActivity({ terminalId: terminalA.terminalId });

    expect(catalogCalls).toBe(1);
    expect(grantCounts[terminalA.terminalId]).toBe(1);
    expect(grantCounts[terminalB.terminalId]).toBe(0);
    expect(approvalCounts[terminalA.terminalId]).toBe(1);
    expect(approvalCounts[terminalB.terminalId]).toBe(0);
    expect(activityCounts[terminalA.terminalId]).toBe(1);
    expect(activityCounts[terminalB.terminalId]).toBe(0);

    emitSubscriptionEvent(eventHandlers, {
      version: 1,
      eventId: 1,
      timestamp: Date.now(),
      type: "terminal.surface.updated",
      payload: {
        catalogChanged: true,
        grantTerminalIds: [terminalA.terminalId, terminalB.terminalId],
        approvalTerminalIds: [terminalA.terminalId, terminalB.terminalId],
        activityTerminalIds: [terminalA.terminalId, terminalB.terminalId],
      },
    });

    await waitFor(
      () =>
        catalogCalls === 2 &&
        grantCounts[terminalA.terminalId] === 2 &&
        approvalCounts[terminalA.terminalId] === 2 &&
        activityCounts[terminalA.terminalId] === 2,
    );
    expect(grantCounts[terminalB.terminalId]).toBe(0);
    expect(approvalCounts[terminalB.terminalId]).toBe(0);
    expect(activityCounts[terminalB.terminalId]).toBe(0);

    releaseActivity();
    releaseApprovals();
    releaseGrants();
    releaseCatalog();
    store.disconnect();
  });

  test("Scenario: Given terminal permission subscriptions When global and scoped streams deliver requests Then runtime store updates only observable approval rows without duplicates", async () => {
    const terminalA = "term-permission-a";
    const terminalB = "term-permission-b";
    const pendingA: GlobalTerminalApprovalRequest = {
      requestId: "approval-a",
      terminalId: terminalA,
      participantId: "auth:guard-a",
      assignedAdminId: "auth:admin",
      status: "pending",
      requestedInput: { mode: "raw", text: "echo a" },
      createdAt: 1,
      expiresAt: 91_000,
    };
    const pendingB: GlobalTerminalApprovalRequest = {
      requestId: "approval-b",
      terminalId: terminalB,
      participantId: "auth:guard-b",
      assignedAdminId: "auth:admin",
      status: "pending",
      requestedInput: { mode: "mixed", text: "<raw>echo b</raw><key data=\"enter\"/>" },
      createdAt: 2,
      expiresAt: 92_000,
    };
    const subscriptions: Array<{
      payload: TerminalPermissionSubscriptionInput | undefined;
      handlers: SubscriptionHandlers;
      closed: boolean;
    }> = [];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalPermissionRequestsSubscribe: (payload, handlers) => {
          const subscription = { payload, handlers, closed: false };
          subscriptions.push(subscription);
          if (payload?.terminalId === terminalA) {
            handlers.onData?.({ type: "snapshot", items: [pendingA] });
          } else if (payload?.terminalId === terminalB) {
            handlers.onData?.({ type: "snapshot", items: [pendingB] });
          } else {
            handlers.onData?.({ type: "snapshot", items: [pendingA, pendingB] });
          }
          return {
            unsubscribe: () => {
              subscription.closed = true;
            },
          };
        },
      }),
    );

    await store.connect();
    const releaseGlobal = store.retainTerminalPermissionRequests();
    const releaseTerminalA = store.retainTerminalPermissionRequests({ terminalId: terminalA });

    await waitFor(() => subscriptions.length === 2);
    expect(subscriptions.map((subscription) => subscription.payload ?? {}).sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )).toEqual([{ terminalId: terminalA }, {}]);
    expect(store.getState().globalTerminalApprovalsById[terminalA]?.data).toEqual([pendingA]);
    expect(store.getState().globalTerminalApprovalsById[terminalB]?.data).toEqual([pendingB]);

    subscriptions
      .find((subscription) => subscription.payload?.terminalId === terminalA)
      ?.handlers.onData?.({
        type: "request",
        request: {
          ...pendingA,
          expiresAt: 95_000,
        },
      });
    expect(store.getState().globalTerminalApprovalsById[terminalA]?.data).toEqual([
      {
        ...pendingA,
        expiresAt: 95_000,
      },
    ]);

    subscriptions
      .find((subscription) => subscription.payload?.terminalId === terminalA)
      ?.handlers.onData?.({
        type: "request",
        request: {
          ...pendingA,
          status: "denied",
          decidedAt: 3,
          decidedBy: "auth:admin",
        },
      });
    expect(store.getState().globalTerminalApprovalsById[terminalA]?.data).toEqual([]);
    expect(store.getState().globalTerminalApprovalsById[terminalB]?.data).toEqual([pendingB]);

    releaseTerminalA();
    releaseGlobal();
    expect(subscriptions.every((subscription) => subscription.closed)).toBe(true);
    store.disconnect();
  });

  test("Scenario: Given unauthenticated browser global terminal hydration When the terminal catalog is requested Then runtime store resolves an explicit auth-required state instead of throwing", async () => {
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalListQuery: async () => {
          throw createUnauthorizedTrpcError();
        },
      }),
    );

    await store.connect();

    await expect(store.hydrateGlobalTerminals()).resolves.toEqual([]);
    expect(store.getState().globalTerminals).toMatchObject({
      data: [],
      loaded: true,
      loading: false,
      refreshing: false,
      error: "auth token required",
    });

    store.disconnect();
  });

  test("Scenario: Given global terminal authority APIs When runtime store proxies terminal-first calls Then tokens, grants, approvals, and activity stay on the global terminal slices", async () => {
    const requests: {
      list?: { includeArchived?: boolean };
      create?: {
        terminalId?: string;
        processKind?: string;
        cwd?: string;
      };
      focus?: { op: string; terminalIds: string[]; accessToken?: string };
      read?: {
        terminalId: string;
        accessToken?: string;
        mode?: "auto" | "diff" | "snapshot";
        remark?: boolean;
        recordActivity?: boolean;
      };
      write?: {
        terminalId: string;
        accessToken?: string;
        text: string;
        submit?: boolean;
        createApprovalRequest?: boolean;
        readRecordActivity?: boolean;
        returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
      };
      listGrants?: { terminalId: string };
      issue?: {
        terminalId: string;
        role: "admin" | "writer" | "guard" | "readonly";
        participantId: string;
        label?: string;
        adminCandidateRank?: number | null;
      };
      revoke?: { terminalId: string; grantId: string };
      listApprovals?: { terminalId: string; statuses?: Array<"pending" | "approved" | "denied" | "expired"> };
      approve?: { terminalId: string; requestId: string; durationMs: number };
      deny?: { terminalId: string; requestId: string };
      delete?: { terminalId: string };
      activity?: { terminalId: string; limit?: number };
    } = {};
    const terminal: GlobalTerminalEntry = {
      terminalId: "term-ops",
      processKind: "shell",
      command: ["/bin/bash"],
      launchCwd: "/repo/ops",
      workspace: null,
      status: "IDLE" as const,
      processPhase: "running" as const,
      seq: 1,
      snapshot: {
        seq: 1,
        timestamp: 1,
        cols: 80,
        rows: 24,
        lines: Array.from({ length: 24 }, () => ""),
        cursor: { x: 0, y: 0 },
      },
      focused: true,
      icon: undefined,
      configuredTitle: "Ops terminal",
      currentTitle: undefined,
      currentPath: undefined,
      shortcuts: undefined,
      rendererPreference: "auto" as const,
      theme: "default-dark" as const,
      cursor: "block" as const,
      transportUrl: "ws://127.0.0.1:7777/pty/term-ops?token=termtok_admin",
      currentAdminId: "system:trusted-terminal-bootstrap",
      approvalTimeoutMs: 90_000,
      pendingRequestCount: 2,
      access: {
        role: "admin" as const,
        accessToken: "termtok_admin",
        participantId: "system:trusted-terminal-bootstrap",
        currentAdmin: true,
      },
      actors: [
        {
          actorId: "auth:reviewer",
          role: "writer" as const,
          label: "Reviewer",
          currentAdmin: false,
          adminCandidateRank: 1,
          online: true,
          focused: false,
          invalidCredential: false,
        },
      ],
    };
    const initialGrant: GlobalTerminalGrantEntry = {
      grantId: "grant-reviewer",
      terminalId: terminal.terminalId,
      role: "writer" as const,
      label: "Reviewer",
      participantId: "auth:reviewer",
      accessToken: "termtok_writer",
      createdAt: 2,
    };
    const pendingApproval: GlobalTerminalApprovalRequest = {
      requestId: "approval-1",
      terminalId: terminal.terminalId,
      participantId: "auth:guard",
      assignedAdminId: "system:trusted-terminal-bootstrap",
      status: "pending" as const,
      requestedInput: {
        mode: "raw" as const,
        text: "echo pending",
      },
      createdAt: 3,
      expiresAt: 93_000,
    };
    const deniedApproval: GlobalTerminalApprovalRequest = {
      requestId: "approval-2",
      terminalId: terminal.terminalId,
      participantId: "auth:guest",
      assignedAdminId: "system:trusted-terminal-bootstrap",
      status: "pending" as const,
      requestedInput: {
        mode: "mixed" as const,
        text: "echo deny",
      },
      createdAt: 4,
      expiresAt: 94_000,
    };
    const approvedLease = {
      leaseId: "lease-1",
      terminalId: terminal.terminalId,
      participantId: pendingApproval.participantId,
      grantedBy: "system:trusted-terminal-bootstrap",
      requestId: pendingApproval.requestId,
      createdAt: 5,
      expiresAt: 65_000,
    };
    let pendingApprovals = [pendingApproval, deniedApproval];
    let guardGrantIssued = false;
    let guardLeaseActive = false;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalListQuery: async (input) => {
          requests.list = input;
          return {
            items: [
              {
                ...terminal,
                pendingRequestCount: pendingApprovals.length,
                actors: guardGrantIssued
                  ? [
                      ...(terminal.actors ?? []),
                      {
                        actorId: pendingApproval.participantId,
                        role: "guard" as const,
                        label: "Guard",
                        currentAdmin: false,
                        online: true,
                        focused: false,
                        invalidCredential: false,
                        leaseId: guardLeaseActive ? approvedLease.leaseId : undefined,
                        leaseExpiresAt: guardLeaseActive ? approvedLease.expiresAt : undefined,
                      },
                    ]
                  : terminal.actors,
              },
            ],
          };
        },
        terminalGlobalCreateMutate: async (input) => {
          requests.create = {
            terminalId: input.terminalId,
            processKind: input.processKind,
            cwd: input.cwd,
          };
          return { result: { ok: true, message: "created", terminal } };
        },
        terminalGlobalFocusMutate: async (input) => {
          requests.focus = input;
          return { ok: true, message: "focused", focusedTerminalIds: input.terminalIds };
        },
        terminalGlobalReadQuery: async (input) => {
          requests.read = input;
          return {
            kind: "terminal-snapshot",
            representation: "snapshot",
            terminalId: input.terminalId,
            eventId: 8,
            seq: 2,
            cols: 80,
            rows: 24,
            cursor: { x: 0, y: 0 },
            tail: "read result",
            status: "IDLE",
            title: terminal.title,
            running: true,
          };
        },
        terminalGlobalWriteMutate: async (input) => {
          requests.write = {
            terminalId: input.terminalId,
            accessToken: input.accessToken,
            text: input.text,
            createApprovalRequest: input.createApprovalRequest,
            returnRead: input.returnRead,
          };
          return { ok: true, message: "written", eventId: 9 };
        },
        terminalListGrantsQuery: async (input) => {
          requests.listGrants = input;
          return {
            items: guardGrantIssued
              ? [
                  initialGrant,
                  {
                    grantId: "grant-guard",
                    terminalId: input.terminalId,
                    role: "guard" as const,
                    label: "Guard",
                    participantId: pendingApproval.participantId,
                    accessToken: "termtok_guard",
                    currentAdmin: false,
                    adminCandidateRank: 2,
                    createdAt: 5,
                  },
                ]
              : [initialGrant],
          };
        },
        terminalIssueGrantMutate: async (input) => {
          requests.issue = input;
          guardGrantIssued = true;
          return {
            grant: {
              grantId: "grant-guard",
              terminalId: input.terminalId,
              role: input.role,
              label: input.label,
              participantId: input.participantId,
              accessToken: "termtok_guard",
              currentAdmin: false,
              adminCandidateRank: input.adminCandidateRank ?? undefined,
              createdAt: 5,
            },
          };
        },
        terminalRevokeGrantMutate: async (input) => {
          requests.revoke = input;
          guardGrantIssued = false;
          return { ok: true };
        },
        terminalListApprovalRequestsQuery: async (input) => {
          requests.listApprovals = { terminalId: input.terminalId, statuses: input.statuses };
          return { items: pendingApprovals };
        },
        terminalApproveRequestMutate: async (input) => {
          requests.approve = input;
          pendingApprovals = pendingApprovals.filter((request) => request.requestId !== input.requestId);
          guardLeaseActive = true;
          return approvedLease;
        },
        terminalDenyRequestMutate: async (input) => {
          requests.deny = input;
          pendingApprovals = pendingApprovals.filter((request) => request.requestId !== input.requestId);
          return {
            ...deniedApproval,
            status: "denied" as const,
            decidedAt: 6,
            decidedBy: "system:trusted-terminal-bootstrap",
          };
        },
        terminalGlobalDeleteMutate: async (input) => {
          requests.delete = input;
          return { ok: true, message: "deleted" };
        },
        terminalActivityPageQuery: async (input) => {
          requests.activity = { terminalId: input.terminalId, limit: input.limit };
          return {
            items: [
              {
                id: 12,
                terminalId: input.terminalId,
                createdAt: 12,
                kind: "terminal_write" as const,
                cycleId: null,
                actorId: "system:trusted-terminal-bootstrap",
                title: "Terminal write",
                content: "echo live",
                detail: { mode: "raw" },
              },
              {
                id: 11,
                terminalId: input.terminalId,
                createdAt: 11,
                kind: "terminal_read" as const,
                cycleId: null,
                actorId: "auth:reviewer",
                title: "Terminal read",
                content: '{"kind":"terminal-snapshot"}',
                detail: { representation: "snapshot" },
              },
            ],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    expect(await store.listGlobalTerminals()).toEqual([terminal]);
    expect(
      await store.createGlobalTerminal({
        terminalId: terminal.terminalId,
        processKind: terminal.processKind,
        cwd: terminal.cwd,
      }),
    ).toEqual({
      ok: true,
      message: "created",
      terminal,
    });
    expect(store.getState().globalTerminals.data[0]?.terminalId).toBe(terminal.terminalId);
    const terminalAccessToken = terminal.access?.accessToken;
    if (!terminalAccessToken) {
      throw new Error("expected terminal access token");
    }

    expect(
      await store.focusGlobalTerminals({
        op: "replace",
        terminalIds: [terminal.terminalId],
        accessToken: terminalAccessToken,
      }),
    ).toEqual({
      ok: true,
      message: "focused",
      focusedTerminalIds: [terminal.terminalId],
    });
    expect(
      await store.readGlobalTerminal({
        terminalId: terminal.terminalId,
        accessToken: terminalAccessToken,
        mode: "snapshot",
      }),
    ).toMatchObject({
      kind: "terminal-snapshot",
      terminalId: terminal.terminalId,
      title: terminal.title,
    });
    expect(
      await store.writeGlobalTerminal({
        terminalId: terminal.terminalId,
        accessToken: "termtok_guard",
        text: "echo guard",
        createApprovalRequest: true,
        returnRead: false,
      }),
    ).toEqual({ ok: true, message: "written", eventId: 9 });

    const releaseGrants = store.retainGlobalTerminalGrants(terminal.terminalId);
    await store.hydrateGlobalTerminalGrants({ terminalId: terminal.terminalId });
    expect(store.getState().globalTerminalGrantsById[terminal.terminalId]?.data).toEqual([initialGrant]);

    const issued = await store.issueGlobalTerminalGrant({
      terminalId: terminal.terminalId,
      role: "guard",
      participantId: "auth:guard",
      label: "Guard",
      adminCandidateRank: 2,
    });
    expect(issued).toMatchObject({
      grantId: "grant-guard",
      accessToken: "termtok_guard",
    });
    expect(
      store
        .getState()
        .globalTerminalGrantsById[terminal.terminalId]?.data.map((grant) => grant.grantId)
        .sort(),
    ).toEqual(["grant-guard", "grant-reviewer"]);

    const releaseApprovals = store.retainGlobalTerminalApprovals(terminal.terminalId);
    await store.hydrateGlobalTerminalApprovals({ terminalId: terminal.terminalId });
    expect(store.getState().globalTerminalApprovalsById[terminal.terminalId]?.data).toEqual([
      pendingApproval,
      deniedApproval,
    ]);
    await store.approveGlobalTerminalRequest({
      terminalId: terminal.terminalId,
      requestId: pendingApproval.requestId,
      durationMs: 60_000,
    });
    await waitFor(() => store.getState().globalTerminalApprovalsById[terminal.terminalId]?.data.length === 1);
    expect(store.getState().globalTerminalApprovalsById[terminal.terminalId]?.data).toEqual([deniedApproval]);
    expect(
      store
        .getState()
        .globalTerminals.data[0]?.actors?.find((actor) => actor.actorId === pendingApproval.participantId),
    ).toMatchObject({
      actorId: pendingApproval.participantId,
      leaseId: approvedLease.leaseId,
      leaseExpiresAt: approvedLease.expiresAt,
    });
    await store.denyGlobalTerminalRequest({
      terminalId: terminal.terminalId,
      requestId: deniedApproval.requestId,
    });
    await waitFor(() => store.getState().globalTerminalApprovalsById[terminal.terminalId]?.data.length === 0);

    const revoked = await store.revokeGlobalTerminalGrant({
      terminalId: terminal.terminalId,
      grantId: "grant-guard",
    });
    expect(revoked).toEqual({ ok: true });
    expect(store.getState().globalTerminalGrantsById[terminal.terminalId]?.data.map((grant) => grant.grantId)).toEqual([
      "grant-reviewer",
    ]);

    const releaseActivity = store.retainGlobalTerminalActivity(terminal.terminalId);
    await store.hydrateGlobalTerminalActivity({ terminalId: terminal.terminalId, limit: 20 });
    expect(store.getState().globalTerminalActivityById[terminal.terminalId]?.data.map((item) => item.id)).toEqual([
      11, 12,
    ]);

    const deleted = await store.deleteGlobalTerminal({ terminalId: terminal.terminalId });
    expect(deleted).toEqual({ ok: true, message: "deleted" });
    expect(store.getState().globalTerminals.data).toEqual([]);
    expect(store.getState().globalTerminalGrantsById[terminal.terminalId]?.data).toEqual([]);
    expect(store.getState().globalTerminalApprovalsById[terminal.terminalId]?.data).toEqual([]);
    expect(store.getState().globalTerminalActivityById[terminal.terminalId]?.data).toEqual([]);

    expect(requests.list).toEqual({});
    expect(requests.create).toEqual({
      terminalId: terminal.terminalId,
      processKind: terminal.processKind,
      cwd: terminal.cwd,
    });
    expect(requests.focus).toEqual({
      op: "replace",
      terminalIds: [terminal.terminalId],
      accessToken: terminalAccessToken,
    });
    expect(requests.read).toEqual({
      terminalId: terminal.terminalId,
      accessToken: terminalAccessToken,
      mode: "snapshot",
    });
    expect(requests.write).toEqual({
      terminalId: terminal.terminalId,
      accessToken: "termtok_guard",
      text: "echo guard",
      createApprovalRequest: true,
      returnRead: false,
    });
    expect(requests.listGrants).toEqual({ terminalId: terminal.terminalId });
    expect(requests.issue).toEqual({
      terminalId: terminal.terminalId,
      role: "guard",
      participantId: "auth:guard",
      label: "Guard",
      adminCandidateRank: 2,
    });
    expect(requests.revoke).toEqual({
      terminalId: terminal.terminalId,
      grantId: "grant-guard",
    });
    expect(requests.listApprovals).toEqual({
      terminalId: terminal.terminalId,
      statuses: ["pending"],
    });
    expect(requests.approve).toEqual({
      terminalId: terminal.terminalId,
      requestId: pendingApproval.requestId,
      durationMs: 60_000,
    });
    expect(requests.deny).toEqual({
      terminalId: terminal.terminalId,
      requestId: deniedApproval.requestId,
    });
    expect(requests.activity).toEqual({
      terminalId: terminal.terminalId,
      limit: 20,
    });
    expect(requests.delete).toEqual({
      terminalId: terminal.terminalId,
    });

    releaseActivity();
    releaseApprovals();
    releaseGrants();
    store.disconnect();
  });

  test("Scenario: Given a retained global terminal activity slice When mixed terminal input succeeds Then runtime store projects a mixed-mode terminal fact", async () => {
    const terminalId = "term-mixed-input";
    let captured: {
      terminalId: string;
      accessToken?: string;
      text: string;
      createApprovalRequest?: boolean;
      returnRead?: boolean | { throttleMs?: number; debounceMs?: number };
    } | null = null;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalInputMutate: async (input) => {
          captured = {
            terminalId: input.terminalId,
            accessToken: input.accessToken,
            text: input.text,
            createApprovalRequest: input.createApprovalRequest,
            returnRead: input.returnRead,
          };
          return { ok: true, message: "input accepted", eventId: 41 };
        },
      }),
    );

    const releaseActivity = store.retainGlobalTerminalActivity(terminalId);
    await store.hydrateGlobalTerminalActivity({ terminalId });

    const output = await store.inputGlobalTerminal({
      terminalId,
      accessToken: "token-guard",
      text: '<raw>echo mixed</raw><key data="enter"/>',
      createApprovalRequest: true,
      returnRead: false,
    });

    expect(output).toEqual({ ok: true, message: "input accepted", eventId: 41 });
    expect(captured).toEqual({
      terminalId,
      accessToken: "token-guard",
      text: '<raw>echo mixed</raw><key data="enter"/>',
      createApprovalRequest: true,
      returnRead: false,
    });
    expect(store.getState().globalTerminalActivityById[terminalId]?.data[0]).toMatchObject({
      id: 41,
      terminalId,
      kind: "terminal_write",
      title: "Terminal input",
      detail: { mode: "mixed" },
    });

    releaseActivity();
    store.disconnect();
  });

  test("Scenario: Given watched global terminal slices When direct terminal tool calls resolve Then runtime store eagerly rehydrates the affected terminal resources", async () => {
    const terminalId = "term-live-refresh";
    let terminalListCalls = 0;
    let approvalListCalls = 0;
    let activityListCalls = 0;
    const pendingApproval: GlobalTerminalApprovalRequest = {
      requestId: "approval-refresh",
      terminalId,
      participantId: "auth:guard",
      assignedAdminId: "system:trusted-terminal-bootstrap",
      status: "pending" as const,
      requestedInput: {
        mode: "raw" as const,
        text: "echo pending refresh",
      },
      createdAt: 10,
      expiresAt: 90_010,
    };
    const readActivity = {
      id: 20,
      terminalId,
      createdAt: 20,
      kind: "terminal_read" as const,
      cycleId: null,
      actorId: "system:trusted-terminal-bootstrap",
      title: "Terminal read",
      content: '{"kind":"terminal-snapshot"}',
      detail: { representation: "snapshot" },
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalListQuery: async () => {
          terminalListCalls += 1;
          return {
            items: [
              {
                terminalId,
                processKind: "shell",
                command: ["/bin/bash"],
                launchCwd: "/repo/live",
                workspace: null,
                status: "IDLE" as const,
                processPhase: "running" as const,
                seq: 1,
                snapshot: {
                  seq: 1,
                  timestamp: 1,
                  cols: 80,
                  rows: 24,
                  lines: Array.from({ length: 24 }, () => ""),
                  cursor: { x: 0, y: 0 },
                },
                focused: false,
                icon: undefined,
                configuredTitle: "Live refresh terminal",
                currentTitle: undefined,
                currentPath: undefined,
                shortcuts: undefined,
                rendererPreference: "auto" as const,
                theme: "default-dark" as const,
                cursor: "block" as const,
                transportUrl: "ws://127.0.0.1:7777/pty/term-live-refresh?token=token-admin",
                currentAdminId: "system:trusted-terminal-bootstrap",
                approvalTimeoutMs: 90_000,
                pendingRequestCount: approvalListCalls > 1 ? 1 : 0,
                access: {
                  role: "admin" as const,
                  accessToken: "token-admin",
                  participantId: "system:trusted-terminal-bootstrap",
                  currentAdmin: true,
                },
                actors: [],
              },
            ],
          };
        },
        terminalGlobalReadQuery: async (input) => ({
          kind: "terminal-snapshot",
          representation: "snapshot",
          terminalId: input.terminalId,
          eventId: 20,
          seq: 2,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 0 },
          tail: "read refresh",
          status: "IDLE",
          title: "Live refresh terminal",
          running: true,
        }),
        terminalGlobalWriteMutate: async () => ({
          ok: false,
          message: "approval queued",
          approvalRequest: pendingApproval,
        }),
        terminalListApprovalRequestsQuery: async () => {
          approvalListCalls += 1;
          return { items: approvalListCalls > 1 ? [pendingApproval] : [] };
        },
        terminalActivityPageQuery: async () => {
          activityListCalls += 1;
          return {
            items: activityListCalls > 1 ? [readActivity] : [],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    const releaseCatalog = store.retainGlobalTerminals();
    await store.hydrateGlobalTerminals();
    const releaseApprovals = store.retainGlobalTerminalApprovals(terminalId);
    await store.hydrateGlobalTerminalApprovals({ terminalId });
    const releaseActivity = store.retainGlobalTerminalActivity(terminalId);
    await store.hydrateGlobalTerminalActivity({ terminalId });

    expect(terminalListCalls).toBe(1);
    expect(approvalListCalls).toBe(1);
    expect(activityListCalls).toBe(1);

    await store.readGlobalTerminal({
      terminalId,
      accessToken: "token-admin",
      mode: "snapshot",
    });
    expect(activityListCalls).toBe(2);
    expect(store.getState().globalTerminalActivityById[terminalId]?.data).toEqual([readActivity]);

    await store.writeGlobalTerminal({
      terminalId,
      accessToken: "token-guard",
      text: "echo pending refresh",
      createApprovalRequest: true,
      returnRead: false,
    });
    expect(approvalListCalls).toBe(2);
    expect(terminalListCalls).toBe(2);
    expect(store.getState().globalTerminalApprovalsById[terminalId]?.data).toEqual([pendingApproval]);
    expect(store.getState().globalTerminals.data[0]?.pendingRequestCount).toBe(1);

    releaseActivity();
    releaseApprovals();
    releaseCatalog();
    store.disconnect();
  });

  test("Scenario: Given a watched global terminal activity slice When read refresh returns a stale page Then runtime store preserves the durable read fact from the tool response", async () => {
    const terminalId = "term-read-stale-page";
    let activityCalls = 0;
    const readActivity = {
      id: 31,
      terminalId,
      createdAt: 31,
      kind: "terminal_read" as const,
      cycleId: null,
      actorId: "system:trusted-terminal-bootstrap",
      title: "Terminal read",
      content: '{"kind":"terminal-snapshot"}',
      detail: { representation: "snapshot" },
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalReadQuery: async (input) => ({
          kind: "terminal-snapshot",
          representation: "snapshot",
          terminalId: input.terminalId,
          eventId: readActivity.id,
          seq: 2,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 0 },
          tail: "stale page read",
          status: "IDLE",
          title: "Stale page terminal",
          running: true,
          readCursor: {
            readerActorId: "auth:reader",
            fromHash: "before-read",
            toHash: "after-read",
            consumed: true,
          },
        }),
        terminalActivityPageQuery: async () => {
          activityCalls += 1;
          return {
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    const releaseActivity = store.retainGlobalTerminalActivity(terminalId);
    await store.hydrateGlobalTerminalActivity({ terminalId });
    expect(store.getState().globalTerminalActivityById[terminalId]?.data).toEqual([]);

    await store.readGlobalTerminal({
      terminalId,
      accessToken: "token-admin",
      mode: "snapshot",
    });

    expect(activityCalls).toBe(2);
    expect(store.getState().globalTerminalActivityById[terminalId]?.data).toHaveLength(1);
    expect(store.getState().globalTerminalActivityById[terminalId]?.data[0]).toMatchObject({
      id: readActivity.id,
      terminalId,
      kind: "terminal_read",
      title: "Terminal read",
      actorId: "auth:reader",
      detail: {
        eventId: readActivity.id,
        terminalId,
        representation: "snapshot",
        readCursor: {
          readerActorId: "auth:reader",
          fromHash: "before-read",
          toHash: "after-read",
          consumed: true,
        },
      },
    });
    expect(
      store.getState().globalTerminalActivityById[terminalId]?.data[0]?.detail &&
        typeof store.getState().globalTerminalActivityById[terminalId]?.data[0]?.detail === "object" &&
        !Array.isArray(store.getState().globalTerminalActivityById[terminalId]?.data[0]?.detail)
        ? "snapshot" in store.getState().globalTerminalActivityById[terminalId]!.data[0]!.detail
        : false,
    ).toBeFalse();

    releaseActivity();
    store.disconnect();
  });

  test("Scenario: Given a watched global terminal activity slice When a pure read returns a full snapshot without an event id Then runtime store preserves the snapshot but does not synthesize activity", async () => {
    const terminalId = "term-pure-read";
    let activityCalls = 0;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalReadQuery: async (input) => ({
          kind: "terminal-snapshot",
          representation: "snapshot",
          terminalId: input.terminalId,
          recordedActivity: false,
          seq: 2,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 1 },
          tail: "line 2",
          snapshot: {
            seq: 2,
            timestamp: 2,
            cols: 80,
            rows: 24,
            lines: ["hello snapshot", "line 2"],
            cursor: { x: 0, y: 1 },
          },
          status: "IDLE",
          title: "Pure read terminal",
          running: true,
        }),
        terminalActivityPageQuery: async () => {
          activityCalls += 1;
          return {
            items: [],
            nextBefore: null,
            hasMoreBefore: false,
          };
        },
      }),
    );

    const releaseActivity = store.retainGlobalTerminalActivity(terminalId);
    await store.hydrateGlobalTerminalActivity({ terminalId });

    const output = await store.readGlobalTerminal({
      terminalId,
      accessToken: "token-admin",
      mode: "snapshot",
    });

    expect(output.snapshot?.lines.join("\n")).toContain("hello snapshot");
    expect(output.recordedActivity).toBeFalse();
    expect(activityCalls).toBe(2);
    expect(store.getState().globalTerminalActivityById[terminalId]?.data).toEqual([]);

    releaseActivity();
    store.disconnect();
  });

  test("Scenario: Given a stale inflight terminal activity refresh When a forced read lands newer facts Then runtime store bypasses the stale query and keeps the newest activity", async () => {
    const terminalId = "term-force-refresh";
    let activityCalls = 0;
    const activityResolvers: Array<
      (value: {
        items: Array<{
          id: number;
          terminalId: string;
          createdAt: number;
          kind: "terminal_read" | "terminal_write";
          cycleId: null;
          actorId?: string;
          title: string;
          content: string;
          detail?: unknown;
        }>;
        nextBefore: null;
        hasMoreBefore: false;
      }) => void
    > = [];
    const staleWrite = {
      id: 1,
      terminalId,
      createdAt: 1,
      kind: "terminal_write" as const,
      cycleId: null,
      actorId: "system:trusted-terminal-bootstrap",
      title: "Terminal write",
      content: "echo stale",
      detail: { mode: "raw" },
    };
    const freshRead = {
      id: 2,
      terminalId,
      createdAt: 2,
      kind: "terminal_read" as const,
      cycleId: null,
      actorId: "system:trusted-terminal-bootstrap",
      title: "Terminal read",
      content: '{"kind":"terminal-snapshot"}',
      detail: { representation: "snapshot" },
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalReadQuery: async (input) => ({
          kind: "terminal-snapshot",
          representation: "snapshot",
          terminalId: input.terminalId,
          eventId: freshRead.id,
          seq: 2,
          cols: 80,
          rows: 24,
          cursor: { x: 0, y: 0 },
          tail: "fresh read",
          status: "IDLE",
          title: "Force refresh terminal",
          running: true,
        }),
        terminalActivityPageQuery: async () => {
          activityCalls += 1;
          return await new Promise((resolve) => {
            activityResolvers.push(resolve);
          });
        },
      }),
    );

    const releaseActivity = store.retainGlobalTerminalActivity(terminalId);
    const staleRefresh = store.hydrateGlobalTerminalActivity({ terminalId, force: true });
    await waitFor(() => activityCalls === 1);

    const readTask = store.readGlobalTerminal({
      terminalId,
      accessToken: "token-admin",
      mode: "snapshot",
    });
    await waitFor(() => activityCalls === 2);
    expect(store.getState().globalTerminalActivityById[terminalId]?.data.at(-1)).toMatchObject({
      id: freshRead.id,
      title: "Terminal read",
    });

    activityResolvers[0]?.({
      items: [staleWrite],
      nextBefore: null,
      hasMoreBefore: false,
    });
    await staleRefresh;

    activityResolvers[1]?.({
      items: [staleWrite, freshRead],
      nextBefore: null,
      hasMoreBefore: false,
    });
    await readTask;

    expect(store.getState().globalTerminalActivityById[terminalId]?.data).toEqual([staleWrite, freshRead]);

    releaseActivity();
    store.disconnect();
  });

  test("Scenario: Given a renderable global terminal entry When a later catalog refresh omits render facts Then runtime store preserves the last renderable terminal truth", async () => {
    const terminalId = "term-renderable-refresh";
    let listCalls = 0;
    const durableSnapshot = {
      seq: 4,
      timestamp: 4,
      cols: 80,
      rows: 24,
      lines: ["prompt$", "echo keep-rendered", "keep-rendered", "prompt$"],
      cursor: { x: 7, y: 3 },
    };
    const reviewerSeat = {
      actorId: "session:reviewer",
      role: "writer" as const,
      label: "Reviewer Session",
      currentAdmin: false,
      online: true,
      focused: true,
      invalidCredential: false,
      adminCandidateRank: 1,
      leaseId: "lease-reviewer",
      leaseExpiresAt: 123_000,
    };
    const fullEntry = {
      terminalId,
      processKind: "shell",
      command: ["/bin/bash"],
      launchCwd: "/repo/renderable",
      workspace: null,
      status: "IDLE" as const,
      processPhase: "running" as const,
      seq: durableSnapshot.seq,
      snapshot: durableSnapshot,
      focused: false,
      icon: undefined,
      configuredTitle: "Renderable terminal",
      currentTitle: undefined,
      currentPath: undefined,
      shortcuts: undefined,
      rendererPreference: "auto" as const,
      theme: "default-dark" as const,
      cursor: "block" as const,
      transportUrl: "ws://127.0.0.1:7777/pty/term-renderable-refresh?token=token-admin",
      currentAdminId: "system:trusted-terminal-bootstrap",
      approvalTimeoutMs: 90_000,
      pendingRequestCount: 0,
      access: {
        role: "admin" as const,
        accessToken: "token-admin",
        participantId: "system:trusted-terminal-bootstrap",
        currentAdmin: true,
      },
      actors: [reviewerSeat],
    };
    const degradedEntry = {
      ...fullEntry,
      launchCwd: "/repo/renderable",
      processPhase: "stopped" as const,
      snapshot: undefined,
      rendererPreference: undefined,
      transportUrl: undefined,
      access: undefined,
      actors: undefined,
    };
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalListQuery: async () => {
          listCalls += 1;
          return {
            items: [listCalls === 1 ? fullEntry : degradedEntry],
          };
        },
      }),
    );

    const releaseCatalog = store.retainGlobalTerminals();
    await store.hydrateGlobalTerminals();
    expect(store.getState().globalTerminals.data[0]).toMatchObject({
      terminalId,
      launchCwd: "/repo/renderable",
      processPhase: "running",
      transportUrl: fullEntry.transportUrl,
      rendererPreference: "auto",
      theme: "default-dark",
      cursor: "block",
      access: {
        accessToken: "token-admin",
      },
    });
    expect(store.getState().globalTerminals.data[0]?.snapshot).toEqual(durableSnapshot);
    expect(store.getState().globalTerminals.data[0]?.actors).toEqual([reviewerSeat]);

    await store.hydrateGlobalTerminals({ force: true });

    expect(store.getState().globalTerminals.data[0]).toMatchObject({
      terminalId,
      launchCwd: "/repo/renderable",
      processPhase: "stopped",
      transportUrl: undefined,
      rendererPreference: "auto",
      theme: "default-dark",
      cursor: "block",
      access: {
        accessToken: "token-admin",
      },
    });
    expect(store.getState().globalTerminals.data[0]?.snapshot).toEqual(durableSnapshot);
    expect(store.getState().globalTerminals.data[0]?.actors).toEqual([reviewerSeat]);

    releaseCatalog();
    store.disconnect();
  });

  test("Scenario: Given a renderable global terminal When durable resize updates terminal config Then runtime store updates local snapshot geometry immediately", async () => {
    const terminalId = "term-config-resize";
    const requests: {
      setConfig?: { terminalId: string; cols?: number; rows?: number };
    } = {};
    const entry: GlobalTerminalEntry = {
      terminalId,
      processKind: "shell",
      command: ["/bin/bash"],
      launchCwd: "/repo/resize",
      workspace: null,
      status: "IDLE" as const,
      processPhase: "running" as const,
      seq: 3,
      snapshot: {
        seq: 3,
        timestamp: 3,
        cols: 80,
        rows: 24,
        lines: Array.from({ length: 24 }, () => ""),
        cursor: { x: 0, y: 0 },
      },
      focused: false,
      icon: undefined,
      configuredTitle: "Resize terminal",
      currentTitle: undefined,
      currentPath: undefined,
      shortcuts: undefined,
      rendererPreference: "auto" as const,
      theme: "default-dark" as const,
      cursor: "block" as const,
      transportUrl: "ws://127.0.0.1:7777/pty/term-config-resize?token=token-admin",
      currentAdminId: "system:trusted-terminal-bootstrap",
      approvalTimeoutMs: 90_000,
      pendingRequestCount: 0,
      access: {
        role: "admin" as const,
        accessToken: "token-admin",
        participantId: "system:trusted-terminal-bootstrap",
        currentAdmin: true,
      },
      actors: [],
    };

    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        terminalGlobalListQuery: async () => ({
          items: [entry],
        }),
        terminalGlobalSetConfigMutation: async (input) => {
          requests.setConfig = input;
          return {
            result: {
              config: {
                terminalId,
                processKind: "shell",
                command: ["/bin/bash"],
                launchCwd: "/repo/resize",
                profile: {
                  cols: 96,
                  rows: 28,
                  rendererPreference: "auto" as const,
                  theme: "default-dark" as const,
                  cursor: "block" as const,
                },
                processPhase: "running" as const,
              },
              appliedLiveFields: ["cols", "rows"],
              nextBootstrapFields: [],
            },
          };
        },
      }),
    );

    const releaseCatalog = store.retainGlobalTerminals();
    await store.hydrateGlobalTerminals();

    const result = await store.setGlobalTerminalConfig({
      terminalId,
      cols: 96,
      rows: 28,
    });

    expect(requests.setConfig).toEqual({
      terminalId,
      cols: 96,
      rows: 28,
    });
    expect(result.config.profile.cols).toBe(96);
    expect(result.config.profile.rows).toBe(28);
    expect(store.getState().globalTerminals.data[0]?.snapshot?.cols).toBe(96);
    expect(store.getState().globalTerminals.data[0]?.snapshot?.rows).toBe(28);

    releaseCatalog();
    store.disconnect();
  });

  test("Scenario: Given live terminal snapshot and status events When runtime store updates one session Then global terminal truth stays synchronized for product consumers", async () => {
    let onData: ((event: unknown) => void) | undefined;
    const terminalId = "term-product-truth";
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        onSubscribe: (handlers) => {
          onData = handlers.onData;
        },
        terminalGlobalListQuery: async () => ({
          items: [
            {
              terminalId,
              processKind: "shell",
              command: ["/bin/bash"],
              launchCwd: "/repo/product-truth",
              workspace: null,
              status: "IDLE" as const,
              processPhase: "running" as const,
              seq: 1,
              snapshot: {
                seq: 1,
                timestamp: 1,
                cols: 80,
                rows: 24,
                lines: ["prompt$"],
                cursor: { x: 7, y: 0 },
              },
              focused: false,
              icon: undefined,
              configuredTitle: "Product truth",
              currentTitle: undefined,
              currentPath: undefined,
              shortcuts: undefined,
              rendererPreference: "auto" as const,
              theme: "default-dark" as const,
              cursor: "block" as const,
              transportUrl: undefined,
              currentAdminId: null,
              approvalTimeoutMs: 90_000,
              pendingRequestCount: 0,
              access: undefined,
              actors: [],
            },
          ],
        }),
      }),
    );

    await store.connect();
    await store.hydrateGlobalTerminals({ force: true });

    onData?.({
      version: 1,
      eventId: 11,
      timestamp: Date.now(),
      type: "terminal.snapshot",
      sessionId: "i-1",
      payload: {
        terminalId,
        snapshot: {
          seq: 2,
          timestamp: 2,
          cols: 100,
          rows: 30,
          lines: ["prompt$", "echo synced", "synced"],
          cursor: { x: 6, y: 2 },
        },
      },
    });
    onData?.({
      version: 1,
      eventId: 12,
      timestamp: Date.now(),
      type: "terminal.status",
      sessionId: "i-1",
      payload: {
        terminalId,
        processPhase: "running",
        status: "BUSY",
      },
    });
    onData?.({
      version: 1,
      eventId: 13,
      timestamp: Date.now(),
      type: "terminal.read",
      sessionId: "i-1",
      payload: {
        terminalId,
        result: {
          representation: "snapshot",
          terminalId,
          seq: 3,
          cols: 100,
          rows: 30,
          cursor: { x: 7, y: 2 },
          snapshot: {
            seq: 3,
            timestamp: 3,
            cols: 100,
            rows: 30,
            lines: ["prompt$", "echo synced", "synced!"],
            cursor: { x: 7, y: 2 },
          },
          status: "IDLE",
          title: "Product truth terminal",
          running: true,
        },
      },
    });

    const entry = store.getState().globalTerminals.data.find((item) => item.terminalId === terminalId);
    expect(entry).toMatchObject({
      terminalId,
      processPhase: "running",
      status: "BUSY",
      seq: 3,
      snapshot: {
        seq: 3,
        cols: 100,
        rows: 30,
      },
    });
    expect(entry?.snapshot?.lines).toEqual(["prompt$", "echo synced", "synced!"]);

    store.disconnect();
  });

  test("Scenario: Given room-local read state and session unread notifications When runtime store marks a global room read Then room snapshots keep message-level truth separate from unread badges", async () => {
    const requests: {
      markRead?: { chatId: string; accessToken?: string; messageId?: number };
    } = {};
    const room = {
      chatId: "room-ops",
      kind: "room" as const,
      title: "Ops room",
      owner: "ops-bot",
      participants: [
        { id: "session:ops-bot", label: "ops-bot" },
        { id: "auth:kzf", label: "kzf" },
      ],
      createdAt: 1,
      updatedAt: 1,
      focused: false,
      accessRole: "member" as const,
      accessToken: "msgtok_member",
      participantId: "session:relay",
      transportUrl: "ws://127.0.0.1:7777/room/room-ops?token=msgtok_member",
      seatStates: [
        {
          actorId: "session:relay",
          role: "member" as const,
          label: "Relay",
          currentAdmin: false,
          online: true,
          focused: true,
          invalidCredential: false,
        },
        {
          actorId: "auth:viewer",
          role: "readonly" as const,
          label: "Viewer",
          currentAdmin: false,
          online: true,
          focused: false,
          invalidCredential: false,
        },
      ],
    };
    const staleLatestVisibleMessage = {
      rowId: 12,
      messageId: 12,
      chatId: room.chatId,
      senderActorId: "session:ops-bot",
      from: "ops-bot",
      kind: "text" as const,
      content: "hello ops",
      createdAt: 12,
      updatedAt: 12,
      visibleAt: 12,
      readActorIds: [],
      unreadActorIds: ["session:relay", "auth:viewer"],
    };
    let latestVisibleMessage = staleLatestVisibleMessage;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        notificationSnapshotQuery: async () => ({
          items: [
            {
              id: "i-1:9",
              sessionId: "i-1",
              src: "msg:chat-main/9",
              sourceNamespace: "msg",
              sourceId: "chat-main",
              bucketKey: "msg:chat-main",
              attentionContextId: "ctx-chat-main",
              attentionCommitId: "commit-9",
              workspacePath: "/repo/demo",
              sessionName: "workspace",
              content: "assistant unread",
              timestamp: Date.now(),
            },
          ],
          unreadBySession: { "i-1": 1 },
          unreadByBucket: { "i-1": { "msg:chat-main": 1 } },
        }),
        messageGlobalSnapshotQuery: async () => ({
          channel: room,
          items: [latestVisibleMessage],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "1",
        }),
        messageGlobalMarkReadMutate: async (input) => {
          requests.markRead = input;
          latestVisibleMessage = {
            ...staleLatestVisibleMessage,
            readActorIds: ["session:relay"],
            unreadActorIds: ["auth:viewer"],
          };
          return { channel: room };
        },
      }),
    );

    await store.connect();
    await waitFor(() => store.getState().unreadBySession["i-1"] === 1);
    await store.hydrateGlobalRoomSnapshot({
      chatId: room.chatId,
      accessToken: room.accessToken,
      force: true,
    });

    const readChannel = await store.markGlobalRoomRead({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: 12,
    });

    expect(requests.markRead).toEqual({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: 12,
    });
    expect(Object.prototype.hasOwnProperty.call(readChannel, "readProgress")).toBeFalse();
    expect(readChannel.seatStates?.find((state) => state.actorId === "session:relay")).toMatchObject({
      actorId: "session:relay",
      role: "member",
    });
    expect(store.getState().globalRoomSnapshotsById[room.chatId]?.data?.items[0]).toMatchObject({
      messageId: 12,
      readActorIds: ["session:relay"],
      unreadActorIds: ["auth:viewer"],
    });
    expect(store.getState().unreadBySession["i-1"]).toBe(1);
    expect(store.getState().notifications[0]?.src).toBe("msg:chat-main/9");
    store.disconnect();
  });

  test("Scenario: Given the same room read mutation is already in flight When markGlobalRoomRead is called again for the same target Then runtime-store reuses the first request instead of issuing a duplicate", async () => {
    const room = {
      chatId: "room-2",
      kind: "room" as const,
      title: "Relay room",
      owner: "jane",
      participants: [
        { id: "auth:user", label: "User" },
        { id: "session:relay", label: "relay" },
      ],
      createdAt: 1,
      updatedAt: 2,
      focused: true,
      accessRole: "admin" as const,
      accessToken: "token-room-2",
    };
    const deferred = createDeferred<{ channel: typeof room }>();
    let requestCount = 0;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        messageGlobalMarkReadMutate: async () => {
          requestCount += 1;
          return await deferred.promise;
        },
      }),
    );

    const first = store.markGlobalRoomRead({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: 12,
    });
    const second = store.markGlobalRoomRead({
      chatId: room.chatId,
      accessToken: room.accessToken,
      messageId: 12,
    });

    expect(requestCount).toBe(1);
    deferred.resolve({ channel: room });

    await expect(Promise.all([first, second])).resolves.toEqual([room, room]);
    expect(requestCount).toBe(1);
  });

  test("Scenario: Given a loaded global avatar catalog When create succeeds Then runtime-store reconciles the principal-backed entry by durable identity", async () => {
    const defaultAvatar: GlobalAvatarCatalogEntry = createAvatarCatalogEntry("default", {
      avatarPrincipalId: "avatar-default",
      iconUrl: "http://127.0.0.1:4591/media/avatars/avatar-default/icon",
    });
    const createdAvatar: GlobalAvatarCatalogEntry = createAvatarCatalogEntry("backend", {
      avatarPrincipalId: "avatar-backend",
      displayName: "Backend",
      classify: "backend",
      iconUrl: "http://127.0.0.1:4591/media/avatars/avatar-backend/icon",
    });
    let catalog: GlobalAvatarCatalogEntry[] = [defaultAvatar];
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        globalAvatarCatalogQuery: async () => ({ items: catalog }),
        globalAvatarCreateMutate: async () => {
          catalog = [defaultAvatar, createdAvatar];
          return { avatar: createdAvatar };
        },
      }),
    );

    await store.connect();
    const releaseCatalog = store.retainGlobalAvatarCatalog();
    await store.hydrateGlobalAvatarCatalog();

    const created = await store.createGlobalAvatar({
      nickname: "backend",
      displayName: "Backend",
      classify: "backend",
    });

    expect(created).toMatchObject({
      avatarPrincipalId: "avatar-backend",
      nickname: "backend",
      displayName: "Backend",
      classify: "backend",
    });
    await waitFor(() =>
      store.getState().globalAvatarCatalog.data.some((entry) => entry.avatarPrincipalId === "avatar-backend"),
    );
    expect(store.getState().globalAvatarCatalog.data).toEqual([defaultAvatar, createdAvatar]);

    releaseCatalog();
    store.disconnect();
  });

  test("Scenario: Given a loaded workspace avatar catalog When copy starts Then the optimistic workspace-local avatar appears before server reconciliation", async () => {
    const workspacePath = "/repo/demo";
    const helperAvatar = createAvatarCatalogEntry("helper", {
      avatarPrincipalId: "avatar-helper",
      runtimeId: "runtime-helper",
      globalPath: "/global/helper",
      workspacePrivatePath: "/repo/demo/.agenter/avatars/by-principal/helper",
      effectivePath: "/global/helper",
    });
    const copiedAvatar = createAvatarCatalogEntry("helper-copy", {
      avatarPrincipalId: null,
      runtimeId: "runtime-helper-copy",
      globalAvailable: false,
      workspacePrivateSlotReady: true,
      globalPath: "/global/helper-copy",
      workspacePrivatePath: "/repo/demo/.agenter/avatars/by-principal/helper-copy",
      effectivePath: "/repo/demo/.agenter/avatars/by-principal/helper-copy",
    });
    let catalog = [helperAvatar];
    const copyDeferred = createDeferred<{ avatar: WorkspaceAvatarCatalogEntry }>();
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        workspaceAvatarCatalogQuery: async () => ({ items: catalog }),
        workspaceCopyAvatarMutate: async () => await copyDeferred.promise,
      }),
    );

    await store.connect();
    const releaseCatalog = store.retainWorkspaceAvatarCatalog(workspacePath);
    await store.hydrateWorkspaceAvatarCatalog(workspacePath);

    const copyPromise = store.copyWorkspaceAvatar({
      workspacePath,
      sourceAvatar: "helper",
      targetAvatar: "helper-copy",
    });

    await waitFor(() =>
      store
        .getState()
        .workspaceAvatarCatalogByPath[workspacePath]?.data.some((entry) => entry.nickname === "helper-copy"),
    );
    expect(
      store
        .getState()
        .workspaceAvatarCatalogByPath[workspacePath]?.data.find((entry) => entry.nickname === "helper-copy"),
    ).toMatchObject({
      nickname: "helper-copy",
      avatarPrincipalId: null,
      sourceScope: "global",
      globalAvailable: false,
      workspacePrivateSlotReady: true,
      effectivePath: "",
    });

    catalog = [helperAvatar, copiedAvatar];
    copyDeferred.resolve({ avatar: copiedAvatar });
    await expect(copyPromise).resolves.toEqual(copiedAvatar);
    await waitFor(() =>
      store
        .getState()
        .workspaceAvatarCatalogByPath[
          workspacePath
        ]?.data.some((entry) => entry.nickname === "helper-copy" && entry.effectivePath === copiedAvatar.effectivePath),
    );
    expect(store.getState().workspaceAvatarCatalogByPath[workspacePath]?.data).toEqual([helperAvatar, copiedAvatar]);

    releaseCatalog();
    store.disconnect();
  });

  test("Scenario: Given one invalidated workspace avatar catalog When a live invalidation event arrives Then only the affected catalog is refreshed", async () => {
    const workspaceA = "/repo/a";
    const workspaceB = "/repo/b";
    const queryCounts: Record<string, number> = {
      [workspaceA]: 0,
      [workspaceB]: 0,
    };
    const catalogByWorkspace: Record<string, WorkspaceAvatarCatalogEntry[]> = {
      [workspaceA]: [
        createAvatarCatalogEntry("alpha", { workspacePrivatePath: "/repo/a/.agenter/avatars/by-principal/alpha" }),
      ],
      [workspaceB]: [
        createAvatarCatalogEntry("beta", { workspacePrivatePath: "/repo/b/.agenter/avatars/by-principal/beta" }),
      ],
    };
    let eventHandlers: SubscriptionHandlers | null = null;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        onSubscribe: (handlers) => {
          eventHandlers = handlers;
        },
        workspaceAvatarCatalogQuery: async ({ workspacePath }) => {
          queryCounts[workspacePath] += 1;
          return { items: catalogByWorkspace[workspacePath] ?? [] };
        },
      }),
    );

    await store.connect();
    const releaseA = store.retainWorkspaceAvatarCatalog(workspaceA);
    const releaseB = store.retainWorkspaceAvatarCatalog(workspaceB);
    await store.hydrateWorkspaceAvatarCatalog(workspaceA);
    await store.hydrateWorkspaceAvatarCatalog(workspaceB);

    catalogByWorkspace[workspaceA] = [
      ...catalogByWorkspace[workspaceA]!,
      createAvatarCatalogEntry("alpha-copy", {
        avatarPrincipalId: null,
        globalAvailable: false,
        workspacePrivateSlotReady: true,
        globalPath: "/global/alpha-copy",
        workspacePrivatePath: "/repo/a/.agenter/avatars/by-principal/alpha-copy",
        effectivePath: "/repo/a/.agenter/avatars/by-principal/alpha-copy",
      }),
    ];

    emitSubscriptionEvent(eventHandlers, {
      version: 1,
      eventId: 1,
      timestamp: Date.now(),
      type: "workspace.avatarCatalog.updated",
      payload: {
        workspacePaths: [workspaceA],
      },
    });

    await waitFor(
      () =>
        store
          .getState()
          .workspaceAvatarCatalogByPath[workspaceA]?.data.some((entry) => entry.nickname === "alpha-copy") ?? false,
    );
    expect(queryCounts[workspaceB]).toBe(1);
    expect(store.getState().workspaceAvatarCatalogByPath[workspaceA]?.data.map((entry) => entry.nickname)).toEqual([
      "alpha",
      "alpha-copy",
    ]);
    expect(store.getState().workspaceAvatarCatalogByPath[workspaceB]?.data.map((entry) => entry.nickname)).toEqual([
      "beta",
    ]);

    releaseA();
    releaseB();
    store.disconnect();
  });

  test("Scenario: Given skill browser payloads When runtime store reads catalogs trees and previews Then the thin facades preserve the objective contracts", async () => {
    const skillCatalog = {
      items: [
        {
          name: "shared-handbook",
          summary: "Shared handbook.",
          rootKind: "shared" as const,
          skillPath: "/home/.agents/skills/shared-handbook/SKILL.md",
          skillDir: "/home/.agents/skills/shared-handbook",
          configPath: "/home/.agents/skills/shared-handbook/ccski.config.json",
          configExists: false,
        },
      ],
    };
    const avatarCatalog = {
      items: [
        {
          nickname: "architect",
          displayName: "Architect",
          iconUrl: null,
          runtimeId: "runtime-architect",
          defaultAvatar: false,
          groups: [
            {
              workspacePath: "~/",
              workspaceLabel: "Root workspace",
              workspaceDescription: "/home",
              skillsRootPath: "/home/.agenter/avatars/by-principal/architect/skills",
              skills: [
                {
                  name: "root-skill",
                  summary: "Root skill.",
                  rootKind: "avatar" as const,
                  skillPath: "/home/.agenter/avatars/by-principal/architect/skills/root-skill/SKILL.md",
                  skillDir: "/home/.agenter/avatars/by-principal/architect/skills/root-skill",
                  configPath: "/home/.agenter/avatars/by-principal/architect/skills/root-skill/ccski.config.json",
                  configExists: false,
                },
              ],
            },
          ],
        },
      ],
    };
    const skillTree = {
      rootPath: "/",
      items: [
        {
          path: "/SKILL.md",
          name: "SKILL.md",
          kind: "file" as const,
          sizeBytes: 128,
          modifiedAtMs: 12,
          previewKind: "text" as const,
        },
        {
          path: "/manual.pdf",
          name: "manual.pdf",
          kind: "file" as const,
          sizeBytes: 256,
          modifiedAtMs: 13,
          previewKind: "pdf" as const,
        },
      ],
      total: 2,
      nextOffset: null,
    };
    const skillPreview = {
      path: "/manual.pdf",
      name: "manual.pdf",
      kind: "file" as const,
      sizeBytes: 256,
      modifiedAtMs: 13,
      previewKind: "pdf" as const,
      mimeType: "application/pdf",
      textContent: null,
      mediaDataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
      truncated: false,
      note: null,
    };

    let catalogInput: { rootKind: "builtin" | "shared" | "global" } | null = null;
    let avatarTreeInput: {
      avatarNickname: string;
      workspacePath: string;
      name: string;
      path?: string;
      offset?: number;
      limit?: number;
    } | null = null;

    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(700),
        skillCatalogQuery: async (input) => {
          catalogInput = input;
          return skillCatalog;
        },
        skillAvatarCatalogQuery: async () => avatarCatalog,
        skillCatalogTreeQuery: async () => skillTree,
        skillCatalogPreviewQuery: async () => skillPreview,
        skillAvatarTreeQuery: async (input) => {
          avatarTreeInput = input;
          return skillTree;
        },
        skillAvatarPreviewQuery: async () => skillPreview,
      }),
    );

    expect(await store.listSkillCatalog({ rootKind: "shared" })).toEqual(skillCatalog);
    if (!catalogInput) {
      throw new Error("expected skill catalog query input");
    }
    expect(catalogInput).toEqual({ rootKind: "shared" });

    expect(await store.listSkillAvatarCatalog()).toEqual(avatarCatalog);
    expect(
      await store.listSkillCatalogTree({
        rootKind: "shared",
        name: "shared-handbook",
        path: "/",
      }),
    ).toEqual(skillTree);
    expect(
      await store.readSkillCatalogPreview({
        rootKind: "shared",
        name: "shared-handbook",
        path: "/manual.pdf",
      }),
    ).toEqual(skillPreview);
    expect(
      await store.listSkillAvatarTree({
        avatarNickname: "architect",
        workspacePath: "~/",
        name: "root-skill",
        path: "/",
      }),
    ).toEqual(skillTree);
    if (!avatarTreeInput) {
      throw new Error("expected avatar tree query input");
    }
    expect(avatarTreeInput).toEqual({
      avatarNickname: "architect",
      workspacePath: "~/",
      name: "root-skill",
      path: "/",
    });
    expect(
      await store.readSkillAvatarPreview({
        avatarNickname: "architect",
        workspacePath: "~/",
        name: "root-skill",
        path: "/manual.pdf",
      }),
    ).toEqual(skillPreview);
  });

  test("Scenario: Given the workspace CLI catalog query When the runtime store reads one workspace lens Then the grouped command surface is returned without route-local transport code", async () => {
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        workspaceCliCatalogQuery: async ({ workspacePath, avatar }) => ({
          groups: [
            {
              id: "root-runtime-cli",
              title: "root runtime CLI",
              description: `${workspacePath}:${avatar}`,
              entries: [
                {
                  id: "root-runtime-cli:message send",
                  groupId: "root-runtime-cli",
                  source: "runtime-cli",
                  commandLabel: "message send",
                  displayName: "send",
                  description: "Send a durable room message.",
                  suggestedCommand: "message send --help",
                  detailHint: "message send --help",
                  preferredExecutionSurface: "root-workspace",
                },
              ],
            },
          ],
        }),
      }),
    );

    const output = await store.readWorkspaceCliCatalog({
      workspacePath: "/repo/agenter",
      avatar: "reviewer",
    });

    expect(output.groups).toEqual([
      expect.objectContaining({
        id: "root-runtime-cli",
        description: "/repo/agenter:reviewer",
        entries: [
          expect.objectContaining({
            commandLabel: "message send",
            suggestedCommand: "message send --help",
            detailHint: "message send --help",
            preferredExecutionSurface: "root-workspace",
          }),
        ],
      }),
    ]);
  });

  test("Scenario: Given the workspace runner overlay reruns one command When the runtime store executes workspace bash Then the typed exec surface is forwarded intact", async () => {
    let execInput: {
      runtimeId: string;
      workspacePath: string;
      avatar: string;
      surface?: "root-workspace" | "public-workspace";
      command: string;
      cwd?: string;
      env?: Record<string, string>;
      stdin?: string;
    } | null = null;
    const store = new RuntimeStore(
      createMockClient({
        snapshotQuery: async () => createSnapshot(0),
        workspaceExecMutate: async (input) => {
          execInput = input;
          return {
            stdout: "ok\n",
            stderr: "",
            exitCode: 0,
            cwd: input.cwd ?? input.workspacePath,
          };
        },
      }),
    );

    const output = await store.execRuntimeWorkspace({
      runtimeId: "runtime-1",
      workspacePath: "/repo/agenter",
      avatar: "reviewer",
      surface: "root-workspace",
      command: "workspace list --help",
      cwd: "/repo/agenter",
      stdin: '{"mode":"check"}',
    });

    if (!execInput) {
      throw new Error("expected workspace exec input");
    }
    expect(execInput).toEqual({
      runtimeId: "runtime-1",
      workspacePath: "/repo/agenter",
      avatar: "reviewer",
      surface: "root-workspace",
      command: "workspace list --help",
      cwd: "/repo/agenter",
      stdin: '{"mode":"check"}',
    });
    expect(output).toEqual({
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
      cwd: "/repo/agenter",
    });
  });
});
