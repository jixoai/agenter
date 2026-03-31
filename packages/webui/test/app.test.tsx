import type {
  GlobalRoomEntry,
  MessageChannelEntry,
  RuntimeClientState,
  RuntimeSnapshotEntry,
  WorkspaceAvatarCatalogEntry,
  WorkspaceEntry,
  WorkspaceSessionCounts,
  WorkspaceSessionEntry,
  WorkspaceWelcomeSnapshotOutput,
} from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../src/App";

const originalMatchMedia = globalThis.window?.matchMedia;
const originalInnerWidth = globalThis.window?.innerWidth;
const originalInnerHeight = globalThis.window?.innerHeight;
const originalWebSocket = globalThis.WebSocket;

const createState = (): RuntimeClientState => ({
  connected: true,
  connectionStatus: "connected",
  profileService: {
    endpoint: "http://127.0.0.1:4591",
    authMode: "wallet_challenge_jwt",
    rootAuthId: "wallet_evm:0x0000000000000000000000000000000000000001",
    rootIdentifier: {
      kind: "wallet_evm",
      value: "0x0000000000000000000000000000000000000001",
    },
    jwtTtlSeconds: 3600,
  },
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  terminalReadsBySession: {},
  chatsBySession: {},
  messageChannelsBySession: {},
  chatCyclesBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  schedulerLogsBySession: {},
  observabilityTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  terminalActivityBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession: {},
  unreadByChat: {},
  unreadByTerminal: {},
});

const setViewport = (input: { width: number; height: number }) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: input.width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: input.height });
  window.dispatchEvent(new Event("resize"));
};

const stubMatchMedia = (matches: boolean) => {
  setViewport(matches ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    media: "(max-width: 1279px)",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
};

const EMPTY_COUNTS: WorkspaceSessionCounts = {
  all: 0,
  running: 0,
  stopped: 0,
  archive: 0,
};

const createWorkspaceSession = (input: {
  sessionId: string;
  name?: string;
  preview?: WorkspaceSessionEntry["preview"];
  status?: WorkspaceSessionEntry["status"];
}): WorkspaceSessionEntry => ({
  sessionId: input.sessionId,
  name: input.name ?? "agenter",
  status: input.status ?? "running",
  storageState: "active",
  favorite: false,
  createdAt: "2026-03-06T08:00:00.000Z",
  updatedAt: "2026-03-06T08:01:00.000Z",
  preview: input.preview ?? { firstUserMessage: null, latestMessages: [] },
});

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const createMessageChannel = (input: {
  chatId: string;
  kind?: "room";
  title?: string;
  owner?: string;
  focused?: boolean;
  transportUrl?: string;
}): MessageChannelEntry => ({
  chatId: input.chatId,
  kind: input.kind ?? "room",
  title: input.title ?? "Room",
  owner: input.owner ?? "jon",
  participants: [
    { id: "avatar:jon", label: "jon", role: "avatar" },
    { id: "user:test", label: "User", role: "user" },
  ],
  createdAt: 1,
  updatedAt: 1,
  focused: input.focused ?? true,
  accessRole: "admin",
  accessToken: `msgtok_${input.chatId.replace(/[^a-z0-9]/gi, "")}`,
  transportUrl:
    input.transportUrl ??
    `ws://localhost:7777/room/${input.chatId}?token=msgtok_${input.chatId.replace(/[^a-z0-9]/gi, "")}`,
});

const createGlobalRoom = (input: {
  chatId: string;
  title?: string;
  owner?: string;
  focused?: boolean;
  accessRole?: "admin" | "member" | "readonly";
}): GlobalRoomEntry => ({
  ...createMessageChannel({
    chatId: input.chatId,
    title: input.title,
    owner: input.owner,
    focused: input.focused,
  }),
  accessRole: input.accessRole ?? "admin",
  metadata: {},
});

const createWorkspaceAvatarCatalogEntry = (input: {
  workspacePath: string;
  nickname?: string;
  defaultAvatar?: boolean;
  sourceScope: "workspace" | "global";
  workspaceAvailable: boolean;
  globalAvailable?: boolean;
}): WorkspaceAvatarCatalogEntry => ({
  nickname: input.nickname ?? "default",
  defaultAvatar: input.defaultAvatar ?? (input.nickname !== undefined ? input.nickname === "default" : true),
  sourceScope: input.sourceScope,
  globalAvailable: input.globalAvailable ?? true,
  workspaceAvailable: input.workspaceAvailable,
  globalPath: `~/.agenter/avatar/${input.nickname ?? "default"}`,
  workspacePath: `${input.workspacePath}/.agenter/avatar/${input.nickname ?? "default"}`,
  effectivePath:
    input.sourceScope === "workspace"
      ? `${input.workspacePath}/.agenter/avatar/${input.nickname ?? "default"}`
      : `~/.agenter/avatar/${input.nickname ?? "default"}`,
});

const createWorkspace = (input: {
  path: string;
  favorite?: boolean;
  missing?: boolean;
  counts?: WorkspaceSessionCounts;
  lastSessionActivityAt?: string;
}): WorkspaceEntry => ({
  path: input.path,
  favorite: input.favorite ?? false,
  group: input.path === "~/" ? "Global" : "Workspace",
  missing: input.missing ?? false,
  counts: input.counts ?? EMPTY_COUNTS,
  lastSessionActivityAt: input.lastSessionActivityAt,
});

const createGlobalTerminal = (input: {
  terminalId: string;
  title?: string;
  cwd?: string;
  accessRole?: "admin" | "writer" | "requester" | "readonly";
} = { terminalId: "term-main" }) => ({
  terminalId: input.terminalId,
  processKind: "shell",
  command: ["bash"],
  cwd: input.cwd ?? "/repo/demo",
  workspace: null,
  running: true,
  status: "IDLE" as const,
  seq: 1,
  focused: false,
  title: input.title ?? input.terminalId,
  access: {
    role: input.accessRole ?? "admin",
    accessToken: `termtok_${input.terminalId.replace(/[^a-z0-9]/gi, "")}`,
    currentAdmin: true,
  },
  actors: [],
});

const createRuntimeEntry = (sessionId = "session-demo"): RuntimeSnapshotEntry => ({
  sessionId,
  started: true,
  activityState: "idle" as const,
  schedulerPhase: "waiting_commits" as const,
  stage: "plan" as const,
  focusedTerminalId: "",
  focusedTerminalIds: [],
  chatMessages: [],
  terminalSnapshots: {},
  terminalReads: {},
  terminals: [],
  tasks: [],
  schedulerState: null,
  schedulerSignals: {
    user: { version: 0, timestamp: null },
    terminal: { version: 0, timestamp: null },
    task: { version: 0, timestamp: null },
    attention: { version: 0, timestamp: null },
  },
  apiCallRecording: { enabled: false, refCount: 0 },
  modelCapabilities: {
    streaming: false,
    tools: false,
    imageInput: false,
    nativeCompact: false,
    summarizeFallback: false,
    fileUpload: false,
    mcpCatalog: false,
  },
  activeCycle: null,
});

const createSessionRecord = (input: {
  id: string;
  workspacePath: string;
  avatar?: string;
  name?: string;
  status?: "running" | "starting" | "paused" | "stopped" | "error";
}) => ({
  id: input.id,
  name: input.name ?? input.id,
  cwd: input.workspacePath,
  workspacePath: input.workspacePath,
  avatar: input.avatar ?? "default",
  createdAt: "2026-03-31T10:00:00.000Z",
  updatedAt: "2026-03-31T10:00:10.000Z",
  status: input.status ?? "running",
  storageState: "active" as const,
  sessionRoot: `/tmp/${input.id}`,
  storeTarget: "global" as const,
});

const createAttentionState = (input: { systemId: "message" | "terminal"; subjectId: string }) => ({
  snapshot: {
    contexts: [
      {
        contextId: `ctx-${input.subjectId}`,
        owner: "avatar:default",
        content: "Attention body",
        contentFormat: "text/markdown",
        scoreMap: {
          src: 100,
        },
        headCommitId: "commit-1",
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:00:00.000Z",
        commits: [
          {
            commitId: "commit-1",
            contextId: `ctx-${input.subjectId}`,
            parentCommitIds: [],
            meta: {
              author: "system:attention",
              source: input.systemId,
              systemId: input.systemId,
              subjectId: input.subjectId,
              createdAt: "2026-03-31T10:00:00.000Z",
            },
            scores: { src: 100 },
            summary: `Attention for ${input.subjectId}`,
            change: {
              type: "update" as const,
              value: "Attention body",
              format: "text/plain",
            },
            createdAt: "2026-03-31T10:00:00.000Z",
          },
        ],
      },
    ],
  },
  active: [],
  cycleFrames: [],
  hooks: [],
});

class WebSocketMock {
  static readonly OPEN = 1;
  static instances: WebSocketMock[] = [];

  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Array<(event: Event | MessageEvent) => void>>();

  constructor(readonly url: string) {
    WebSocketMock.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
    const queue = this.listeners.get(type) ?? [];
    queue.push(listener);
    this.listeners.set(type, queue);
  }

  removeEventListener(type: string, listener: (event: Event | MessageEvent) => void): void {
    const queue = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      queue.filter((entry) => entry !== listener),
    );
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.emit("close", new Event("close"));
  }

  open(): void {
    this.readyState = WebSocketMock.OPEN;
    this.emit("open", new Event("open"));
  }

  message(data: unknown): void {
    this.emit(
      "message",
      new MessageEvent("message", {
        data: typeof data === "string" ? data : JSON.stringify(data),
      }),
    );
  }

  private emit(type: string, event: Event | MessageEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

let mockState: RuntimeClientState = createState();
let stateListeners: Array<(state: RuntimeClientState) => void> = [];
let mockAuthToken = "";
const ensureMessageChannelsMock = vi.fn<(sessionId: string) => Promise<void>>();
const listWorkspaceSessionsMock = vi.fn<
  (input: { path: string; tab: string; cursor?: number; limit?: number }) => Promise<{
    items: WorkspaceSessionEntry[];
    nextCursor: number | null;
    counts: WorkspaceSessionCounts;
  }>
>();
const cleanMissingWorkspacesMock = vi.fn<() => Promise<string[]>>();
const createSessionMock = vi.fn<
  (input: { cwd: string; avatar?: string; autoStart?: boolean }) => Promise<{ id: string }>
>(async () => ({ id: "session-new" }));
const sendChatMock = vi.fn(async () => {});
const startSessionMock = vi.fn(async () => {});
const stopSessionMock = vi.fn(async () => {});
const abortSessionMock = vi.fn(async () => {});
const listMessageChannelsMock = vi.fn<(sessionId: string) => Promise<MessageChannelEntry[]>>();
const createMessageChannelMock =
  vi.fn<
    (input: {
      sessionId: string;
      kind: "room";
      title?: string;
      focus?: boolean;
    }) => Promise<MessageChannelEntry>
  >();
const focusMessageChannelsMock =
  vi.fn<
    (input: {
      sessionId: string;
      op: "add" | "remove" | "replace" | "clear";
      channels: Array<{ chatId: string; accessToken: string }>;
    }) => Promise<MessageChannelEntry[]>
  >();
const listGlobalRoomsMock = vi.fn(async () => [] as GlobalRoomEntry[]);
const listGlobalTerminalsMock = vi.fn(async () => [] as Array<ReturnType<typeof createGlobalTerminal>>);
const createGlobalRoomMock = vi.fn(async (input: { chatId?: string; title?: string }) =>
  createGlobalRoom({ chatId: input.chatId ?? "room-new", title: input.title ?? "New Room", focused: true }),
);
const focusGlobalRoomsMock = vi.fn(
  async (input: { op: "add" | "remove" | "replace" | "clear"; channels: Array<{ chatId: string; accessToken?: string }> }) => ({
    ok: true as const,
    message: `focus ${input.op}`,
    focusedChatIds: input.channels.map((channel) => channel.chatId),
  }),
);
const snapshotGlobalRoomMock = vi.fn(async (input: { chatId: string }) => ({
  channel: createGlobalRoom({ chatId: input.chatId, title: input.chatId }),
  items: [],
  nextBefore: null,
  hasMoreBefore: false,
  headVersion: "0",
}));
const pageGlobalRoomMessagesMock = vi.fn(async () => ({
  items: [],
  hasMore: false,
  nextBefore: null,
}));
const sendGlobalRoomMessageMock = vi.fn(async () => ({ ok: true as const }));
const updateGlobalRoomMock = vi.fn(async (input: { chatId: string; patch: { title?: string } }) =>
  createGlobalRoom({ chatId: input.chatId, title: input.patch.title ?? input.chatId }),
);
const listGlobalRoomGrantsMock = vi.fn(async () => []);
const revokeGlobalRoomGrantMock = vi.fn(async () => ({ ok: true }));
const archiveGlobalRoomMock = vi.fn(async (input: { chatId: string }) =>
  createGlobalRoom({ chatId: input.chatId, title: input.chatId }),
);
const issueGlobalRoomGrantMock = vi.fn<
  (input: {
    chatId: string;
    accessToken?: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId: `auth:${string}` | `session:${string}` | `system:${string}`;
  }) => Promise<{
    grantId: string;
    chatId: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
    createdAt: number;
    accessRole: "admin" | "member" | "readonly";
    accessToken: string;
    transportUrl?: string;
  }>
>();
const issueGlobalTerminalGrantMock = vi.fn<
  (input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: `auth:${string}` | `session:${string}` | `system:${string}`;
  }) => Promise<{
    grantId: string;
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    createdAt: number;
    accessToken: string;
    currentAdmin: boolean;
  }>
>();
const focusTerminalsMock = vi.fn<
  (input: { sessionId: string; op: "add" | "remove" | "replace" | "clear"; terminalIds: string[] }) => Promise<{
    ok: boolean;
    message: string;
    focusedTerminalIds: string[];
  }>
>();
const listWorkspaceAvatarCatalogMock = vi.fn(async (workspacePath: string) => [
  createWorkspaceAvatarCatalogEntry({
    workspacePath,
    sourceScope: workspacePath === "~/" ? "workspace" : "global",
    workspaceAvailable: workspacePath === "~/",
  }),
]);
const forkWorkspaceAvatarMock = vi.fn(async (input: { workspacePath: string; avatar: string }) => ({
  ...createWorkspaceAvatarCatalogEntry({
    workspacePath: input.workspacePath,
    nickname: input.avatar,
    sourceScope: "workspace",
    workspaceAvailable: true,
  }),
}));
const inspectWorkspaceWelcomeMock = vi.fn<
  (input: { workspacePath: string; avatar?: string }) => Promise<WorkspaceWelcomeSnapshotOutput>
>(async (input) => ({
  workspacePath: input.workspacePath,
  avatar: input.avatar ?? "default",
  sessionId: `session:${input.workspacePath}:${input.avatar ?? "default"}`,
  avatars: await listWorkspaceAvatarCatalogMock(input.workspacePath),
  rooms: [],
  terminals: [],
}));
const saveWorkspaceAvatarRoomSeatMock = vi.fn(async () => ({ ok: true as const }));
const saveWorkspaceAvatarTerminalSeatMock = vi.fn(async () => ({ ok: true as const }));
const listScopedSettingsMock = vi.fn(async () => ({
  effective: { content: "{}\n", value: {}, schema: { type: "object" }, provenance: {} },
  layers: [],
}));
const readScopedSettingsLayerMock = vi.fn(async () => ({ path: "settings.json", content: "{}\n", mtimeMs: 0 }));
const saveScopedSettingsLayerMock = vi.fn(async () => ({
  ok: true as const,
  file: { path: "settings.json", content: "{}\n", mtimeMs: 1 },
  effective: { content: "{}\n", value: {}, schema: { type: "object" }, provenance: {} },
}));
const queryAttentionMock = vi.fn(async () => []);
const sendMessageChannelMock = vi.fn<
  (
    input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      text: string;
      assetIds?: string[];
    },
    attachments?: Array<{
      assetId: string;
      kind: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }>,
  ) => Promise<void>
>();
const updateMessageChannelMock = vi.fn<
  (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<MessageChannelEntry>
>();
const listMessageChannelGrantsMock = vi.fn<
  (input: { sessionId: string; chatId: string; accessToken: string }) => Promise<
    Array<{
      grantId: string;
      chatId: string;
      role: "admin" | "member" | "readonly";
      label?: string;
      participantId?: string;
      createdAt: number;
    }>
  >
>();
const issueMessageChannelGrantMock = vi.fn<
  (input: {
    sessionId: string;
    chatId: string;
    accessToken: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
  }) => Promise<{
    grantId: string;
    chatId: string;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
    createdAt: number;
    accessRole: "admin" | "member" | "readonly";
    accessToken: string;
    transportUrl?: string;
  }>
>();
const revokeMessageChannelGrantMock =
  vi.fn<
    (input: { sessionId: string; chatId: string; accessToken: string; grantId: string }) => Promise<{ ok: boolean }>
  >();
const resolveDraftMock = vi.fn(async (input: { cwd: string }) => ({
  cwd: input.cwd,
  provider: { providerId: "default", apiStandard: "openai-chat", vendor: "deepseek", model: "test" },
  modelCapabilities: {
    streaming: true,
    tools: true,
    imageInput: false,
    nativeCompact: false,
    summarizeFallback: true,
    fileUpload: false,
    mcpCatalog: false,
  },
}));
const listDirectoriesMock = vi.fn(async () => [] as Array<{ name: string; path: string }>);
const validateDirectoryMock = vi.fn(async (path: string) => ({ ok: true, path }));
const listSettingsLayersMock = vi.fn(async () => ({ effective: { content: "{}" }, layers: [] }));
const readSettingsLayerMock = vi.fn(async () => ({ path: "settings.json", content: "{}", mtimeMs: 0 }));
const saveSettingsLayerMock = vi.fn(async () => ({
  ok: true,
  file: { path: "settings.json", content: "{}", mtimeMs: 1 },
  effective: { content: "{}" },
}));
const emptyNotificationSnapshot = () => ({ items: [], unreadBySession: {}, unreadByChat: {}, unreadByTerminal: {} });
const setChatVisibilityMock = vi.fn(async () => emptyNotificationSnapshot());
const setTerminalVisibilityMock = vi.fn(async () => emptyNotificationSnapshot());
const consumeNotificationsMock = vi.fn(async () => emptyNotificationSnapshot());
const hydrateSessionHistoryMock = vi.fn(async () => ({ messagesHasMore: false, cyclesHasMore: false }));
const hydrateSessionArtifactsMock = vi.fn(async () => {});
const loadChatMessagesMock = vi.fn(async () => {});
const loadChatCyclesMock = vi.fn(async () => {});
const sessionIconUrlMock = vi.fn((sessionId: string) => `http://127.0.0.1:4591/media/sessions/${sessionId}/icon`);
const profileIconUrlMock = vi.fn((reference: string) => `http://127.0.0.1:4591/media/profiles/${reference}/icon`);
const uploadSessionIconMock = vi.fn(async () => ({ ok: true }));
const listProfilesMock = vi.fn(
  async () =>
    ({
      items: [] as Array<{
        profileId: string;
        identifiers: Array<{ kind: string; value: string }>;
        metadata: Record<string, unknown>;
        iconUrl: string;
        isVirtual: boolean;
      }>,
    }) as const,
);
const getProfileMock = vi.fn(async (reference: string) => ({
  profileId: reference,
  identifiers: [],
  metadata: {},
  iconUrl: `http://127.0.0.1:4591/media/profiles/${reference}/icon`,
  isVirtual: false,
}));
const updateProfileMock = vi.fn(async (input: { reference: string; patch: Record<string, unknown> }) => ({
  profileId: input.reference,
  identifiers: [],
  metadata: input.patch,
  iconUrl: `http://127.0.0.1:4591/media/profiles/${input.reference}/icon`,
  isVirtual: false,
}));
const createAuthSessionMock = (profileId = "profile-1") => ({
  token: "jwt-auth-1",
  issuedAt: new Date(0).toISOString(),
  expiresAt: new Date(60_000).toISOString(),
  claims: {
    authId: "wallet_evm:0x00000000000000000000000000000000000000aa",
    profileId,
    admin: true,
    superadmin: false,
  },
  profile: {
    profileId,
    identifiers: [{ kind: "wallet_evm", value: "0x00000000000000000000000000000000000000aa" }],
    metadata: { displayName: "Nova Ops", nickname: "nova" },
    iconUrl: `http://127.0.0.1:4591/media/profiles/${profileId}/icon`,
    isVirtual: false,
  },
});
const startAuthChallengeMock = vi.fn(async (authId: string) => ({
  challengeId: "challenge-auth-1",
  challengeText: `challenge:${authId}`,
  authId,
  expiresAt: new Date(0).toISOString(),
}));
const verifyAuthChallengeMock = vi.fn(async () => createAuthSessionMock());
const getAuthSessionMock = vi.fn(async () => (mockAuthToken ? createAuthSessionMock() : null));
const setAuthTokenMock = vi.fn((token: string | null | undefined) => {
  mockAuthToken = token?.trim() ?? "";
});
const startProfileEmailChallengeMock = vi.fn(async () => ({
  challengeId: "challenge-1",
  delivery: "console",
  expiresAt: new Date(0).toISOString(),
}));
const verifyProfileEmailChallengeMock = vi.fn(async () => ({
  profile: {
    profileId: "profile-1",
    identifiers: [],
    metadata: {},
    iconUrl: "http://127.0.0.1:4591/media/profiles/profile-1/icon",
    isVirtual: false,
  },
  registrationTicket: "ticket-1",
  expiresAt: new Date(0).toISOString(),
  registrationUrl: "http://127.0.0.1:4591/auth/webauthn/register?ticket=ticket-1",
}));
const uploadProfileIconMock = vi.fn(async () => ({ ok: true }));
const webauthnRegistrationUrlMock = vi.fn((ticketId: string) => `http://127.0.0.1:4591/auth/webauthn/register?ticket=${ticketId}`);
const webauthnAuthenticationUrlMock = vi.fn(
  (reference: string) => `http://127.0.0.1:4591/auth/webauthn/authenticate?reference=${reference}`,
);
const readGlobalSettingsMock = vi.fn(async () => ({ path: "settings.json", content: "{}\n", mtimeMs: 0 }));
const saveGlobalSettingsMock = vi.fn(async () => ({
  ok: true,
  file: { path: "settings.json", content: "{}\n", mtimeMs: 1 },
  latest: { path: "settings.json", content: "{}\n", mtimeMs: 1 },
}));

const emitState = (next: RuntimeClientState) => {
  mockState = next;
  for (const listener of stateListeners) {
    listener(mockState);
  }
};

const setMessageChannelsResource = (
  sessionId: string,
  next: RuntimeClientState["messageChannelsBySession"][string],
): void => {
  emitState({
    ...mockState,
    messageChannelsBySession: {
      ...mockState.messageChannelsBySession,
      [sessionId]: next,
    },
  });
};

const writeMessageChannels = (sessionId: string, channels: MessageChannelEntry[]): void => {
  setMessageChannelsResource(sessionId, {
    data: channels,
    loaded: true,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: Date.now(),
  });
};

vi.mock("@agenter/client-sdk", () => ({
  createAgenterClient: () => ({
    close: () => {},
    setAuthToken: setAuthTokenMock,
    getAuthToken: () => mockAuthToken || null,
  }),
  createRuntimeStore: () => ({
    getState: () => mockState,
    subscribe: (listener: (state: RuntimeClientState) => void) => {
      stateListeners.push(listener);
      listener(mockState);
      return () => {
        stateListeners = stateListeners.filter((item) => item !== listener);
      };
    },
    connect: async () => {},
    disconnect: () => {},
    createSession: createSessionMock,
    startSession: startSessionMock,
    stopSession: stopSessionMock,
    abortSession: abortSessionMock,
    ensureMessageChannels: ensureMessageChannelsMock,
    listMessageChannels: async (sessionId: string) => {
      const channels = await listMessageChannelsMock(sessionId);
      writeMessageChannels(sessionId, channels);
      return channels;
    },
    createMessageChannel: async (input: {
      sessionId: string;
      kind: "room";
      title?: string;
      focus?: boolean;
    }) => {
      const created = await createMessageChannelMock(input);
      const previous = mockState.messageChannelsBySession[input.sessionId]?.data ?? [];
      writeMessageChannels(
        input.sessionId,
        [...previous.filter((channel) => channel.chatId !== created.chatId), created].sort((left, right) =>
          left.chatId.localeCompare(right.chatId),
        ),
      );
      return created;
    },
    focusMessageChannels: async (input: {
      sessionId: string;
      op: "add" | "remove" | "replace" | "clear";
      channels: Array<{ chatId: string; accessToken: string }>;
    }) => {
      const channels = await focusMessageChannelsMock(input);
      writeMessageChannels(input.sessionId, channels);
      return channels;
    },
    sendMessageChannel: sendMessageChannelMock,
    updateMessageChannel: async (input: {
      sessionId: string;
      chatId: string;
      accessToken: string;
      patch: { title?: string };
    }) => {
      const updated = await updateMessageChannelMock(input);
      const previous = mockState.messageChannelsBySession[input.sessionId]?.data ?? [];
      writeMessageChannels(
        input.sessionId,
        previous.some((channel) => channel.chatId === updated.chatId)
          ? previous.map((channel) => (channel.chatId === updated.chatId ? updated : channel))
          : [...previous, updated],
      );
      return updated;
    },
    listMessageChannelGrants: listMessageChannelGrantsMock,
    issueMessageChannelGrant: issueMessageChannelGrantMock,
    revokeMessageChannelGrant: revokeMessageChannelGrantMock,
    listGlobalRooms: listGlobalRoomsMock,
    createGlobalRoom: createGlobalRoomMock,
    focusGlobalRooms: focusGlobalRoomsMock,
    snapshotGlobalRoom: snapshotGlobalRoomMock,
    pageGlobalRoomMessages: pageGlobalRoomMessagesMock,
    sendGlobalRoomMessage: sendGlobalRoomMessageMock,
    updateGlobalRoom: updateGlobalRoomMock,
    listGlobalRoomGrants: listGlobalRoomGrantsMock,
    listGlobalTerminals: listGlobalTerminalsMock,
    issueGlobalRoomGrant: issueGlobalRoomGrantMock,
    revokeGlobalRoomGrant: revokeGlobalRoomGrantMock,
    archiveGlobalRoom: archiveGlobalRoomMock,
    issueGlobalTerminalGrant: issueGlobalTerminalGrantMock,
    focusTerminals: focusTerminalsMock,
    listWorkspaceAvatarCatalog: listWorkspaceAvatarCatalogMock,
    forkWorkspaceAvatar: forkWorkspaceAvatarMock,
    inspectWorkspaceWelcome: inspectWorkspaceWelcomeMock,
    saveWorkspaceAvatarRoomSeat: saveWorkspaceAvatarRoomSeatMock,
    saveWorkspaceAvatarTerminalSeat: saveWorkspaceAvatarTerminalSeatMock,
    listScopedSettings: listScopedSettingsMock,
    readScopedSettingsLayer: readScopedSettingsLayerMock,
    saveScopedSettingsLayer: saveScopedSettingsLayerMock,
    queryAttention: queryAttentionMock,
    archiveSession: async () => {},
    restoreSession: async () => {},
    deleteSession: async () => {},
    toggleSessionFavorite: async () => ({ sessionId: "", favorite: false }),
    listWorkspaceSessions: listWorkspaceSessionsMock,
    sendChat: sendChatMock,
    resolveDraft: resolveDraftMock,
    searchWorkspacePaths: async () => [],
    uploadSessionAssets: async () => [],
    sessionIconUrl: sessionIconUrlMock,
    profileIconUrl: profileIconUrlMock,
    uploadSessionIcon: uploadSessionIconMock,
    listProfiles: listProfilesMock,
    getProfile: getProfileMock,
    updateProfile: updateProfileMock,
    setAuthToken: setAuthTokenMock,
    clearAuthToken: () => setAuthTokenMock(null),
    getAuthToken: () => mockAuthToken || null,
    startAuthChallenge: startAuthChallengeMock,
    verifyAuthChallenge: verifyAuthChallengeMock,
    getAuthSession: getAuthSessionMock,
    getAuthServiceDescriptor: async () => mockState.profileService,
    startProfileEmailChallenge: startProfileEmailChallengeMock,
    verifyProfileEmailChallenge: verifyProfileEmailChallengeMock,
    uploadProfileIcon: uploadProfileIconMock,
    webauthnRegistrationUrl: webauthnRegistrationUrlMock,
    webauthnAuthenticationUrl: webauthnAuthenticationUrlMock,
    hydrateSessionHistory: hydrateSessionHistoryMock,
    hydrateSessionArtifacts: hydrateSessionArtifactsMock,
    loadChatMessages: loadChatMessagesMock,
    loadChatCycles: loadChatCyclesMock,
    loadMoreChatMessagesBefore: async () => ({ items: 0, hasMore: false }),
    loadMoreChatCyclesBefore: async () => ({ items: 0, hasMore: false }),
    readSettings: async () => ({ path: "settings.json", content: "{}", mtimeMs: 0 }),
    saveSettings: async () => ({ ok: true, file: { path: "settings.json", content: "{}", mtimeMs: 1 } }),
    readGlobalSettings: readGlobalSettingsMock,
    saveGlobalSettings: saveGlobalSettingsMock,
    listSettingsLayers: listSettingsLayersMock,
    readSettingsLayer: readSettingsLayerMock,
    saveSettingsLayer: saveSettingsLayerMock,
    setChatVisibility: setChatVisibilityMock,
    setTerminalVisibility: setTerminalVisibilityMock,
    consumeNotifications: consumeNotificationsMock,
    listRecentWorkspaces: async () => [],
    listAllWorkspaces: async () => [],
    toggleWorkspaceFavorite: async () => {},
    removeWorkspace: async () => {},
    cleanMissingWorkspaces: cleanMissingWorkspacesMock,
    listDirectories: listDirectoriesMock,
    validateDirectory: validateDirectoryMock,
    loadMoreObservabilityTimeline: async () => ({ logs: 0, traces: 0, hasMore: false }),
    loadMoreModelCalls: async () => ({ items: 0, hasMore: false }),
    loadMoreApiCalls: async () => ({ items: 0, hasMore: false }),
    loadTerminalActivity: async () => ({ items: 0, hasMore: false }),
    loadMoreTerminalActivity: async () => ({ items: 0, hasMore: false }),
  }),
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  stubMatchMedia(false);
  window.localStorage.clear();
  mockState = createState();
  stateListeners = [];
  mockAuthToken = "";
  listWorkspaceSessionsMock.mockReset();
  cleanMissingWorkspacesMock.mockReset();
  createSessionMock.mockClear();
  sendChatMock.mockClear();
  startSessionMock.mockClear();
  stopSessionMock.mockClear();
  abortSessionMock.mockClear();
  ensureMessageChannelsMock.mockReset();
  listMessageChannelsMock.mockReset();
  createMessageChannelMock.mockReset();
  focusMessageChannelsMock.mockReset();
  sendMessageChannelMock.mockReset();
  updateMessageChannelMock.mockReset();
  listMessageChannelGrantsMock.mockReset();
  issueMessageChannelGrantMock.mockReset();
  revokeMessageChannelGrantMock.mockReset();
  listGlobalRoomsMock.mockReset();
  createGlobalRoomMock.mockReset();
  focusGlobalRoomsMock.mockReset();
  snapshotGlobalRoomMock.mockReset();
  pageGlobalRoomMessagesMock.mockReset();
  sendGlobalRoomMessageMock.mockReset();
  updateGlobalRoomMock.mockReset();
  listGlobalRoomGrantsMock.mockReset();
  revokeGlobalRoomGrantMock.mockReset();
  archiveGlobalRoomMock.mockReset();
  listGlobalTerminalsMock.mockReset();
  issueGlobalRoomGrantMock.mockReset();
  issueGlobalTerminalGrantMock.mockReset();
  focusTerminalsMock.mockReset();
  listWorkspaceAvatarCatalogMock.mockReset();
  forkWorkspaceAvatarMock.mockReset();
  inspectWorkspaceWelcomeMock.mockReset();
  saveWorkspaceAvatarRoomSeatMock.mockReset();
  saveWorkspaceAvatarTerminalSeatMock.mockReset();
  listScopedSettingsMock.mockReset();
  readScopedSettingsLayerMock.mockReset();
  saveScopedSettingsLayerMock.mockReset();
  queryAttentionMock.mockReset();
  resolveDraftMock.mockClear();
  listDirectoriesMock.mockClear();
  validateDirectoryMock.mockClear();
  listSettingsLayersMock.mockClear();
  readSettingsLayerMock.mockClear();
  saveSettingsLayerMock.mockClear();
  setChatVisibilityMock.mockClear();
  setTerminalVisibilityMock.mockClear();
  consumeNotificationsMock.mockClear();
  hydrateSessionHistoryMock.mockClear();
  hydrateSessionArtifactsMock.mockClear();
  loadChatMessagesMock.mockClear();
  loadChatCyclesMock.mockClear();
  sessionIconUrlMock.mockClear();
  profileIconUrlMock.mockClear();
  uploadSessionIconMock.mockClear();
  listProfilesMock.mockClear();
  getProfileMock.mockClear();
  updateProfileMock.mockClear();
  startAuthChallengeMock.mockReset();
  verifyAuthChallengeMock.mockReset();
  getAuthSessionMock.mockReset();
  setAuthTokenMock.mockClear();
  startProfileEmailChallengeMock.mockClear();
  verifyProfileEmailChallengeMock.mockClear();
  uploadProfileIconMock.mockClear();
  webauthnRegistrationUrlMock.mockClear();
  webauthnAuthenticationUrlMock.mockClear();
  readGlobalSettingsMock.mockClear();
  saveGlobalSettingsMock.mockClear();
  listProfilesMock.mockResolvedValue({ items: [] });
  startAuthChallengeMock.mockResolvedValue({
    challengeId: "challenge-auth-1",
    challengeText: "challenge:wallet_evm:0x00000000000000000000000000000000000000aa",
    authId: "wallet_evm:0x00000000000000000000000000000000000000aa",
    expiresAt: new Date(0).toISOString(),
  });
  verifyAuthChallengeMock.mockResolvedValue(createAuthSessionMock());
  getAuthSessionMock.mockImplementation(async () => (mockAuthToken ? createAuthSessionMock() : null));
  listWorkspaceSessionsMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    counts: EMPTY_COUNTS,
  });
  cleanMissingWorkspacesMock.mockResolvedValue([]);
  listMessageChannelsMock.mockResolvedValue([]);
  ensureMessageChannelsMock.mockImplementation(async (sessionId) => {
    const current = mockState.messageChannelsBySession[sessionId];
    if (current?.loaded) {
      return;
    }
    setMessageChannelsResource(sessionId, {
      data: current?.data ?? [],
      loaded: false,
      loading: true,
      refreshing: false,
      error: null,
      refreshedAt: current?.refreshedAt ?? null,
    });
    try {
      const channels = await listMessageChannelsMock(sessionId);
      writeMessageChannels(sessionId, channels);
    } catch (error) {
      setMessageChannelsResource(sessionId, {
        data: current?.data ?? [],
        loaded: false,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : String(error),
        refreshedAt: current?.refreshedAt ?? null,
      });
    }
  });
  createMessageChannelMock.mockImplementation(async (input) =>
    createMessageChannel({
      chatId: "room-new",
      kind: input.kind,
      title: input.title,
      focused: input.focus ?? true,
    }),
  );
  focusMessageChannelsMock.mockImplementation(async (input) =>
    input.channels.map(({ chatId }) =>
      createMessageChannel({ chatId, focused: input.op !== "remove" && input.op !== "clear" }),
    ),
  );
  sendMessageChannelMock.mockResolvedValue(undefined);
  updateMessageChannelMock.mockImplementation(async (input) =>
    createMessageChannel({
      chatId: input.chatId,
      title: input.patch.title ?? "Room",
    }),
  );
  listMessageChannelGrantsMock.mockResolvedValue([]);
  issueMessageChannelGrantMock.mockImplementation(async (input) => ({
    grantId: "grant-1",
    chatId: input.chatId,
    role: input.role,
    label: input.label,
    participantId: input.participantId,
    createdAt: 1,
    accessRole: input.role,
    accessToken: "msgtok_grant",
    transportUrl: `ws://localhost:7777/room/${input.chatId}?token=msgtok_grant`,
  }));
  revokeMessageChannelGrantMock.mockResolvedValue({ ok: true });
  listGlobalRoomsMock.mockResolvedValue([]);
  createGlobalRoomMock.mockImplementation(async (input) =>
    createGlobalRoom({ chatId: input.chatId ?? "room-new", title: input.title ?? "New Room", focused: true }),
  );
  focusGlobalRoomsMock.mockImplementation(async (input) => ({
    ok: true,
    message: `focus ${input.op}`,
    focusedChatIds: input.channels.map((channel) => channel.chatId),
  }));
  snapshotGlobalRoomMock.mockImplementation(async (input) => ({
    channel: createGlobalRoom({ chatId: input.chatId, title: input.chatId }),
    items: [],
    nextBefore: null,
    hasMoreBefore: false,
    headVersion: "0",
  }));
  pageGlobalRoomMessagesMock.mockResolvedValue({
    items: [],
    hasMore: false,
    nextBefore: null,
  });
  sendGlobalRoomMessageMock.mockResolvedValue({ ok: true });
  updateGlobalRoomMock.mockImplementation(async (input) =>
    createGlobalRoom({ chatId: input.chatId, title: input.patch.title ?? input.chatId }),
  );
  listGlobalRoomGrantsMock.mockResolvedValue([]);
  revokeGlobalRoomGrantMock.mockResolvedValue({ ok: true });
  archiveGlobalRoomMock.mockImplementation(async (input) =>
    createGlobalRoom({ chatId: input.chatId, title: input.chatId }),
  );
  listGlobalTerminalsMock.mockResolvedValue([]);
  issueGlobalRoomGrantMock.mockImplementation(async (input) => ({
    grantId: "global-room-grant-1",
    chatId: input.chatId,
    role: input.role,
    label: input.label,
    participantId: input.participantId,
    createdAt: 1,
    accessRole: input.role,
    accessToken: "msgtok_global_grant",
    transportUrl: `ws://localhost:7777/room/${input.chatId}?token=msgtok_global_grant`,
  }));
  issueGlobalTerminalGrantMock.mockImplementation(async (input) => ({
    grantId: "global-terminal-grant-1",
    terminalId: input.terminalId,
    role: input.role,
    createdAt: 1,
    accessToken: "termtok_global_grant",
    currentAdmin: true,
  }));
  focusTerminalsMock.mockImplementation(async (input) => ({
    ok: true,
    message: `focus ${input.op}`,
    focusedTerminalIds: input.terminalIds,
  }));
  listWorkspaceAvatarCatalogMock.mockImplementation(async (workspacePath: string) => [
    createWorkspaceAvatarCatalogEntry({
      workspacePath,
      sourceScope: workspacePath === "~/" ? "workspace" : "global",
      workspaceAvailable: workspacePath === "~/",
    }),
  ]);
  forkWorkspaceAvatarMock.mockImplementation(async (input) => ({
    ...createWorkspaceAvatarCatalogEntry({
      workspacePath: input.workspacePath,
      nickname: input.avatar,
      sourceScope: "workspace",
      workspaceAvailable: true,
    }),
  }));
  inspectWorkspaceWelcomeMock.mockImplementation(async (input) => ({
    workspacePath: input.workspacePath,
    avatar: input.avatar ?? "default",
    sessionId: `session:${input.workspacePath}:${input.avatar ?? "default"}`,
    avatars: await listWorkspaceAvatarCatalogMock(input.workspacePath),
    rooms: [],
    terminals: [],
  }));
  saveWorkspaceAvatarRoomSeatMock.mockResolvedValue({ ok: true });
  saveWorkspaceAvatarTerminalSeatMock.mockResolvedValue({ ok: true });
  listScopedSettingsMock.mockResolvedValue({
    effective: { content: "{}\n", value: {}, schema: { type: "object" }, provenance: {} },
    layers: [],
  });
  readScopedSettingsLayerMock.mockResolvedValue({ path: "settings.json", content: "{}\n", mtimeMs: 0 });
  saveScopedSettingsLayerMock.mockResolvedValue({
    ok: true,
    file: { path: "settings.json", content: "{}\n", mtimeMs: 1 },
    effective: { content: "{}\n", value: {}, schema: { type: "object" }, provenance: {} },
  });
  queryAttentionMock.mockResolvedValue([]);
  WebSocketMock.instances.length = 0;
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: WebSocketMock,
  });
});

afterEach(() => {
  cleanup();
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  } else {
    stubMatchMedia(false);
  }
  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  }
  if (originalInnerHeight) {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
  }
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: originalWebSocket,
  });
});

describe.skip("Feature: legacy web ui app shell", () => {
  test("Scenario: Given app mounted When rendering Then show quick start shell", async () => {
    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(await screen.findByRole("heading", { name: /agenter/i })).toBeInTheDocument();
    expect(await screen.findAllByText("Quick Start")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workspaces" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tasks" })).not.toBeInTheDocument();
  });

  test("Scenario: Given shell navigation When opening global settings Then the left rail owns the entry and the page header stays local", async () => {
    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Global Settings" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/settings");
    });
    expect(await screen.findByRole("heading", { name: "Global Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open global settings" })).not.toBeInTheDocument();
  });

  test("Scenario: Given private-key auth When the operator signs in and reopens settings Then the JWT-backed auth session is restored without browser-side private-key persistence", async () => {
    const authSession = createAuthSessionMock();
    listProfilesMock.mockResolvedValue({
      items: [authSession.profile],
    });
    verifyAuthChallengeMock.mockResolvedValue(authSession);
    getAuthSessionMock.mockImplementation(async () => (mockAuthToken ? authSession : null));

    const firstRender = render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Global Settings" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Profile" }));
    fireEvent.change(screen.getByPlaceholderText("0x-prefixed private key"), {
      target: {
        value: "0x59c6995e998f97a5a0044966f094538c5f1b6f6db1d4c4a2a2d5f6b7c8d9e0f1",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign challenge" }));

    await waitFor(() => {
      expect(startAuthChallengeMock).toHaveBeenCalledTimes(1);
      expect(verifyAuthChallengeMock).toHaveBeenCalledTimes(1);
      expect(mockAuthToken).toBe(authSession.token);
      expect(window.localStorage.getItem("agenter:webui:auth-session")).toContain(authSession.token);
    });

    firstRender.unmount();
    stateListeners = [];
    setAuthTokenMock.mockClear();
    getAuthSessionMock.mockClear();
    getAuthSessionMock.mockImplementation(async () => (mockAuthToken ? authSession : null));

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Global Settings" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Profile" }));

    await waitFor(() => {
      expect(setAuthTokenMock).toHaveBeenCalledWith(authSession.token);
      expect(getAuthSessionMock).toHaveBeenCalled();
    });
    expect(screen.getByText(`Auth profile: ${authSession.profile.profileId}`)).toBeInTheDocument();
    expect(screen.getByText("Claims: admin")).toBeInTheDocument();
  });

  test("Scenario: Given quick start workspace picker When selecting a folder Then the chosen workspace becomes visible before session creation", async () => {
    const workspacePath = "/repo/picked";
    mockState = {
      ...createState(),
      recentWorkspaces: [workspacePath],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
    };
    listDirectoriesMock.mockResolvedValue([{ name: "picked", path: workspacePath }]);
    validateDirectoryMock.mockResolvedValue({ ok: true, path: workspacePath });

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByText("Change"));
    fireEvent.click(screen.getByRole("button", { name: workspacePath }));
    fireEvent.click(screen.getByRole("button", { name: "Use this folder" }));

    await waitFor(() => {
      expect(screen.getAllByText(workspacePath).length).toBeGreaterThan(0);
    });
  });

  test("Scenario: Given quick start workspace When Enter is pressed Then the app creates a session and navigates into session chats", async () => {
    const workspacePath = "/repo/quickstart";
    mockState = {
      ...createState(),
      recentWorkspaces: [workspacePath],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
    };
    createSessionMock.mockResolvedValueOnce({ id: "session-enter" });

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Enter" }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith({ cwd: workspacePath, autoStart: true });
      expect(window.location.pathname).toBe("/session/session-enter/chats");
    });
  });

  test("Scenario: Given quick start draft resolution is still loading When the workspace becomes ready Then route-level entry stays disabled until the draft arrives and only then becomes enabled", async () => {
    const workspacePath = "/repo/quickstart-loading";
    const draftDeferred = createDeferred<Awaited<ReturnType<typeof resolveDraftMock>>>();

    mockState = {
      ...createState(),
      recentWorkspaces: [workspacePath],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
    };
    resolveDraftMock.mockImplementationOnce(() => draftDeferred.promise);
    listWorkspaceSessionsMock.mockResolvedValue({
      items: [],
      nextCursor: null,
      counts: EMPTY_COUNTS,
    });

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    const enterButton = await screen.findByRole("button", { name: "Enter" });
    await waitFor(() => {
      expect(resolveDraftMock).toHaveBeenCalledWith({ cwd: workspacePath });
    });
    expect(enterButton).toBeDisabled();
    expect(screen.getByText("Resolving provider...")).toBeInTheDocument();

    draftDeferred.resolve({
      cwd: workspacePath,
      provider: { providerId: "default", apiStandard: "openai-chat", vendor: "deepseek", model: "test" },
      modelCapabilities: {
        streaming: true,
        tools: true,
        imageInput: false,
        nativeCompact: false,
        summarizeFallback: true,
        fileUpload: false,
        mcpCatalog: false,
      },
    });

    await waitFor(() => {
      expect(enterButton).toBeEnabled();
    });
    expect(screen.getByText("deepseek · openai-chat · test")).toBeInTheDocument();
  });

  test("Scenario: Given selected workspace session When chat events arrive Then preview refreshes without reopening the page", async () => {
    const workspacePath = "/repo/demo";
    const sessionId = "session-1";
    const counts: WorkspaceSessionCounts = { all: 1, running: 1, stopped: 0, archive: 0 };

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "agenter",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-1",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          counts,
          missing: false,
          lastSessionActivityAt: "2026-03-06T08:01:00.000Z",
        },
      ],
      recentWorkspaces: [workspacePath],
    };

    listWorkspaceSessionsMock.mockResolvedValue({
      items: [createWorkspaceSession({ sessionId })],
      nextCursor: null,
      counts,
    });

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Workspaces" }));
    const workspacePanel = (await screen.findByPlaceholderText("Search workspace or group")).closest("section");
    if (!workspacePanel) {
      throw new Error("workspace panel not found");
    }
    fireEvent.click(within(workspacePanel).getAllByTitle(workspacePath)[0]!);

    await waitFor(() => {
      expect(screen.getByText("No chat yet.")).toBeInTheDocument();
    });
    const callsAfterSelection = listWorkspaceSessionsMock.mock.calls.length;

    emitState({
      ...mockState,
      lastEventId: 1,
      chatsBySession: {
        [sessionId]: [
          { id: "m1", role: "user", content: "hi", timestamp: 1 },
          { id: "m2", role: "assistant", content: "hello", timestamp: 2, channel: "to_user" },
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("hi | hello")).toBeInTheDocument();
    });
    expect(listWorkspaceSessionsMock).toHaveBeenCalledTimes(callsAfterSelection);
  });

  test("Scenario: Given a compact viewport When selecting a workspace Then the sessions detail sheet opens without double-click activation", async () => {
    const workspacePath = "/repo/mobile";
    stubMatchMedia(true);
    mockState = {
      ...createState(),
      recentWorkspaces: [workspacePath],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Open navigation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Workspaces" }));
    const workspacePanel = (await screen.findByPlaceholderText("Search workspace or group")).closest("section");
    if (!workspacePanel) {
      throw new Error("workspace panel not found");
    }

    fireEvent.click(within(workspacePanel).getAllByTitle(workspacePath)[0]!);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Sessions" })).toBeInTheDocument();
    });
    expect(listWorkspaceSessionsMock).toHaveBeenCalledWith({
      path: workspacePath,
      tab: "all",
      cursor: 0,
      limit: 50,
    });
  });

  test("Scenario: Given a cold-open Devtools deep link When transport reconnects Then session hydration waits until the runtime store is connected", async () => {
    const workspacePath = "/repo/devtools";
    const sessionId = "session-devtools";

    window.history.replaceState(null, "", `/session/${encodeURIComponent(sessionId)}/devtools`);

    mockState = {
      ...createState(),
      connected: false,
      connectionStatus: "reconnecting",
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(loadChatMessagesMock).not.toHaveBeenCalled();
    expect(loadChatCyclesMock).not.toHaveBeenCalled();
    expect(hydrateSessionHistoryMock).not.toHaveBeenCalled();

    emitState({
      ...createState(),
      connected: true,
      connectionStatus: "connected",
      sessions: [
        {
          id: sessionId,
          name: "Devtools shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:06:00.000Z",
          updatedAt: "2026-03-19T07:06:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-devtools",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
    });

    await waitFor(() => {
      expect(hydrateSessionHistoryMock).toHaveBeenCalledWith(sessionId, { messageLimit: 200, cycleLimit: 120 });
    });
  });

  test("Scenario: Given a long-history chat route When the route becomes visible Then hydration runs without consuming unread replies before the viewport reports a visible boundary", async () => {
    const workspacePath = "/repo/real-history";
    const sessionId = "session-real-history";
    const chatId = "room-main";
    const channel = createMessageChannel({
      chatId,
      title: "Main room",
      transportUrl: `ws://localhost:7777/room/${chatId}`,
    });

    window.history.replaceState(
      null,
      "",
      `/session/${encodeURIComponent(sessionId)}/chats?chatId=${encodeURIComponent(chatId)}`,
    );

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Real history",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:06:00.000Z",
          updatedAt: "2026-03-19T07:06:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-real-history",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
      unreadBySession: {
        [sessionId]: 3,
      },
    };
    listMessageChannelsMock.mockResolvedValue([channel]);
    focusMessageChannelsMock.mockResolvedValue([channel]);

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    await waitFor(() => {
      expect(hydrateSessionHistoryMock).toHaveBeenCalledWith(sessionId, { messageLimit: 200, cycleLimit: 120 });
      expect(setChatVisibilityMock).toHaveBeenCalledWith({ sessionId, chatId, visible: true, focused: true });
      expect(listMessageChannelsMock).toHaveBeenCalledWith(sessionId);
    });

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const socket = WebSocketMock.instances[0]!;
    socket.open();
    socket.message({
      type: "snapshot",
      chatId,
      snapshot: {
        channel,
        items: [
          {
            rowId: 14,
            messageId: "14",
            chatId,
            from: "jon",
            content: "Assistant reply 14: completed the visible conversation turn 14.",
            createdAt: 14,
            metadata: {},
            attachments: [],
          },
        ],
        nextBefore: null,
        hasMoreBefore: false,
        headVersion: "14",
      },
    });

    expect(consumeNotificationsMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Assistant reply 14: completed the visible conversation turn 14."),
    ).toBeInTheDocument();
  });

  test("Scenario: Given a room route with hydrated room history When the shell opens Then persisted messages render immediately without waiting for transport history", async () => {
    const workspacePath = "/repo/room-bootstrap";
    const sessionId = "session-room-bootstrap";
    const chatId = "room-main";
    const channel = createMessageChannel({
      chatId,
      title: "Main room",
      transportUrl: `ws://localhost:7777/room/${chatId}`,
    });

    window.history.replaceState(
      null,
      "",
      `/session/${encodeURIComponent(sessionId)}/chats?chatId=${encodeURIComponent(chatId)}`,
    );

    mockState = {
      ...createState(),
      connected: true,
      connectionStatus: "connected",
      sessions: [
        {
          id: sessionId,
          name: "Room bootstrap",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:06:00.000Z",
          updatedAt: "2026-03-19T07:06:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-room-bootstrap",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
      chatsBySession: {
        [sessionId]: [
          {
            id: "msg-1",
            chatId,
            role: "user",
            content: "Bootstrap hello",
            timestamp: 10,
            cycleId: 1,
            attachments: [],
          },
          {
            id: "msg-2",
            chatId,
            role: "assistant",
            channel: "to_user",
            content: "Bootstrap reply",
            timestamp: 20,
            cycleId: 1,
            format: "markdown",
            tool: undefined,
            attachments: [],
          },
        ],
      },
      messageChannelsBySession: {
        [sessionId]: {
          data: [channel],
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: Date.now(),
        },
      },
    };
    focusMessageChannelsMock.mockResolvedValue([channel]);

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(await screen.findByText("Bootstrap hello")).toBeInTheDocument();
    expect(screen.getByText("Bootstrap reply")).toBeInTheDocument();
    expect(profileIconUrlMock).toHaveBeenCalledWith("jon");
    expect(screen.queryByText("Loading rooms...")).not.toBeInTheDocument();
    expect(ensureMessageChannelsMock).not.toHaveBeenCalled();
  });

  test("Scenario: Given two message channels When the user switches channels Then the chat surface clears the previous transcript before hydrating the next channel", async () => {
    const workspacePath = "/repo/channel-switch";
    const sessionId = "session-channel-switch";
    const mainChannel = createMessageChannel({
      chatId: "room-main",
      title: "Main room",
      transportUrl: "ws://localhost:7777/room/room-main",
    });
    const relayChannel = createMessageChannel({
      chatId: "room-relay-2",
      title: "Relay room 2",
      focused: false,
      transportUrl: "ws://localhost:7777/room/room-relay-2",
    });
    const listChannels = [mainChannel, relayChannel];

    window.history.replaceState(
      null,
      "",
      `/session/${encodeURIComponent(sessionId)}/chats?chatId=${encodeURIComponent(mainChannel.chatId)}`,
    );

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Channel switch",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:06:00.000Z",
          updatedAt: "2026-03-19T07:06:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-channel-switch",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
      runtimes: {
        [sessionId]: {
          sessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
    };
    listMessageChannelsMock.mockResolvedValue(listChannels);
    focusMessageChannelsMock.mockImplementation(async (input) =>
      listChannels.map((channel) => ({
        ...channel,
        focused: input.channels.some((entry) => entry.chatId === channel.chatId),
      })),
    );

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(1);
    });
    const mainSocket = WebSocketMock.instances[0]!;
    mainSocket.open();
    mainSocket.message({
      type: "snapshot",
      chatId: mainChannel.chatId,
      snapshot: {
        channel: mainChannel,
        items: [
          {
            rowId: 1,
            messageId: "m-1",
            chatId: mainChannel.chatId,
            from: "User",
            content: "[lunch-main] ask gaubee what to eat for lunch",
            createdAt: 1,
            metadata: {},
            attachments: [],
          },
          {
            rowId: 2,
            messageId: "m-2",
            chatId: mainChannel.chatId,
            from: "jon",
            content: "稍等，我去问一下。",
            createdAt: 2,
            metadata: {},
            attachments: [],
          },
        ],
        nextBefore: null,
        hasMoreBefore: false,
        headVersion: "2",
      },
    });

    const mainConversation = screen.getByRole("log", { name: "Channel conversation" });
    await waitFor(() => {
      expect(mainConversation).toHaveTextContent("稍等，我去问一下。");
    });

    fireEvent.click(await screen.findByRole("tab", { name: "Relay room 2" }));

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(2);
    });
    expect(screen.getByRole("log", { name: "Channel conversation" })).not.toHaveTextContent("稍等，我去问一下。");

    const relaySocket = WebSocketMock.instances[1]!;
    relaySocket.open();
    relaySocket.message({
      type: "snapshot",
      chatId: relayChannel.chatId,
      snapshot: {
        channel: relayChannel,
        items: [
          {
            rowId: 1,
            messageId: "m-3",
            chatId: relayChannel.chatId,
            from: "User",
            content: "[lunch-relay] ask gaubee lunch",
            createdAt: 3,
            metadata: {},
            attachments: [],
          },
          {
            rowId: 2,
            messageId: "m-4",
            chatId: relayChannel.chatId,
            from: "jon",
            content: "中午吃蛋炒饭。",
            createdAt: 4,
            metadata: {},
            attachments: [],
          },
        ],
        nextBefore: null,
        hasMoreBefore: false,
        headVersion: "4",
      },
    });

    const relayConversation = screen.getByRole("log", { name: "Channel conversation" });
    await waitFor(() => {
      expect(relayConversation).toHaveTextContent("中午吃蛋炒饭。");
    });
    expect(relayConversation).not.toHaveTextContent("稍等，我去问一下。");

    fireEvent.click((await screen.findAllByRole("tab", { name: "Main room" })).at(-1)!);

    await waitFor(() => {
      expect(WebSocketMock.instances).toHaveLength(3);
    });
    expect(screen.getByRole("log", { name: "Channel conversation" })).not.toHaveTextContent("中午吃蛋炒饭。");

    const switchedMainSocket = WebSocketMock.instances[2]!;
    switchedMainSocket.open();
    switchedMainSocket.message({
      type: "snapshot",
      chatId: mainChannel.chatId,
      snapshot: {
        channel: mainChannel,
        items: [
          {
            rowId: 1,
            messageId: "m-1",
            chatId: mainChannel.chatId,
            from: "User",
            content: "[lunch-main] ask gaubee what to eat for lunch",
            createdAt: 1,
            metadata: {},
            attachments: [],
          },
          {
            rowId: 2,
            messageId: "m-2",
            chatId: mainChannel.chatId,
            from: "jon",
            content: "稍等，我去问一下。",
            createdAt: 2,
            metadata: {},
            attachments: [],
          },
        ],
        nextBefore: null,
        hasMoreBefore: false,
        headVersion: "2",
      },
    });

    const switchedConversation = screen.getByRole("log", { name: "Channel conversation" });
    await waitFor(() => {
      expect(switchedConversation).toHaveTextContent("稍等，我去问一下。");
    });
    expect(switchedConversation).not.toHaveTextContent("中午吃蛋炒饭。");
  }, 15_000);

  test("Scenario: Given two running sessions that both select room-main When the route switches sessions Then message-channel focus is refreshed for the new session", async () => {
    const workspacePath = "/repo/focus";
    const firstSessionId = "session-focus-a";
    const secondSessionId = "session-focus-b";
    const chatId = "room-main";
    const channel = createMessageChannel({
      chatId,
      title: "Main room",
      transportUrl: `ws://localhost:7777/room/${chatId}`,
    });

    window.history.replaceState(
      null,
      "",
      `/session/${encodeURIComponent(firstSessionId)}/chats?chatId=${encodeURIComponent(chatId)}`,
    );

    mockState = {
      ...createState(),
      sessions: [
        {
          id: firstSessionId,
          name: "Focus A",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:06:00.000Z",
          updatedAt: "2026-03-19T07:06:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-focus-a",
          storeTarget: "global",
        },
        {
          id: secondSessionId,
          name: "Focus B",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:07:00.000Z",
          updatedAt: "2026-03-19T07:07:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-focus-b",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
      runtimes: {
        [firstSessionId]: {
          sessionId: firstSessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
        [secondSessionId]: {
          sessionId: secondSessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
    };
    listMessageChannelsMock.mockResolvedValue([channel]);
    focusMessageChannelsMock.mockResolvedValue([channel]);

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    await waitFor(() => {
      expect(focusMessageChannelsMock).toHaveBeenCalledWith({
        sessionId: firstSessionId,
        op: "replace",
        channels: [{ chatId, accessToken: channel.accessToken }],
      });
    });

    window.history.replaceState(
      null,
      "",
      `/session/${encodeURIComponent(secondSessionId)}/chats?chatId=${encodeURIComponent(chatId)}`,
    );
    fireEvent.popState(window);

    await waitFor(() => {
      expect(focusMessageChannelsMock).toHaveBeenCalledWith({
        sessionId: secondSessionId,
        op: "replace",
        channels: [{ chatId, accessToken: channel.accessToken }],
      });
    });
  });

  test("Scenario: Given attention-first Devtools When the route opens Then the removed model route does not trigger background debug fetches", async () => {
    const workspacePath = "/repo/devtools";
    const sessionId = "session-model";

    window.history.replaceState(null, "", `/session/${encodeURIComponent(sessionId)}/devtools`);

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Model shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-19T07:06:00.000Z",
          updatedAt: "2026-03-19T07:06:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-model",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: false,
          counts: EMPTY_COUNTS,
        },
      ],
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: "Model" })).not.toBeInTheDocument();
    });
  });

  test("Scenario: Given workspace session activity only updates timestamps When the workspace list is open Then the app does not refetch the whole session list", async () => {
    const workspacePath = "/repo/stable";
    const sessionId = "session-stable";
    const counts: WorkspaceSessionCounts = { all: 1, running: 1, stopped: 0, archive: 0 };

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "agenter",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-stable",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          counts,
          missing: false,
          lastSessionActivityAt: "2026-03-06T08:01:00.000Z",
        },
      ],
    };

    listWorkspaceSessionsMock.mockResolvedValue({
      items: [createWorkspaceSession({ sessionId })],
      nextCursor: null,
      counts,
    });

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Workspaces" }));
    const workspacePanel = (await screen.findByPlaceholderText("Search workspace or group")).closest("section");
    if (!workspacePanel) {
      throw new Error("workspace panel not found");
    }
    fireEvent.click(within(workspacePanel).getAllByTitle(workspacePath)[0]!);

    await waitFor(() => {
      expect(listWorkspaceSessionsMock).toHaveBeenCalledWith({
        path: workspacePath,
        tab: "all",
        cursor: 0,
        limit: 50,
      });
    });
    const callsAfterSelection = listWorkspaceSessionsMock.mock.calls.length;

    emitState({
      ...mockState,
      lastEventId: 1,
      sessions: [
        {
          ...mockState.sessions[0]!,
          updatedAt: "2026-03-06T08:02:00.000Z",
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getAllByText("Sessions").length).toBeGreaterThan(0);
    });
    expect(listWorkspaceSessionsMock).toHaveBeenCalledTimes(callsAfterSelection);
  });

  test("Scenario: Given an opened session When chat is resumed Then the left sidebar keeps primary navigation and running session entries together", async () => {
    const workspacePath = "/repo/demo";
    const sessionId = "session-1";
    const counts: WorkspaceSessionCounts = { all: 1, running: 1, stopped: 0, archive: 0 };

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Build shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-1",
          storeTarget: "global",
        },
      ],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          counts,
          missing: false,
          lastSessionActivityAt: "2026-03-06T08:01:00.000Z",
        },
      ],
      recentWorkspaces: [workspacePath],
    };

    listWorkspaceSessionsMock.mockResolvedValue({
      items: [
        createWorkspaceSession({
          sessionId,
          name: "Build shell",
          preview: { firstUserMessage: "Ship the shell", latestMessages: ["Session ready"] },
        }),
      ],
      nextCursor: null,
      counts,
    });

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: `Resume Build shell · ${sessionId}` }));

    await waitFor(() => {
      expect(screen.getAllByText("Build shell").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole("button", { name: "Workspaces" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Quick Start" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Build shell .*session-1.*\/repo\/demo/i })).toBeInTheDocument();
    expect(sessionIconUrlMock).toHaveBeenCalledWith(sessionId);
    expect(screen.getByAltText("Build shell")).toHaveAttribute(
      "src",
      expect.stringContaining(`http://127.0.0.1:4591/media/sessions/${sessionId}/icon`),
    );
    expect(screen.getByRole("tab", { name: "Chats" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Terminals" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Devtools" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
  });

  test("Scenario: Given the desktop shell sidebar When collapsing it Then the app navigation shrinks to an icon rail and can reopen", async () => {
    mockState = createState();

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    const sidebar = await screen.findByTestId("app-sidebar-nav");
    await waitFor(() => {
      expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
    });

    fireEvent.click(within(sidebar).getByRole("button", { name: "Collapse sidebar" }));

    await waitFor(() => {
      expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "true");
    });
    expect(within(sidebar).queryByText("Workspace-first shell")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Quick Start")).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Quick Start" })).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole("button", { name: "Expand sidebar" }));

    await waitFor(() => {
      expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
    });
    expect(within(sidebar).getByText("Workspace-first shell")).toBeInTheDocument();
  });

  test("Scenario: Given a workspace shell session When switching to Terminals Settings and Devtools Then the compact header keeps the workspace context attached to the route", async () => {
    const workspacePath = "/repo/demo";
    const sessionId = "session-keep-context";
    const counts: WorkspaceSessionCounts = { all: 1, running: 1, stopped: 0, archive: 0 };

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Build shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-keep-context",
          storeTarget: "global",
        },
      ],
      recentWorkspaces: [workspacePath],
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          counts,
          missing: false,
          lastSessionActivityAt: "2026-03-06T08:01:00.000Z",
        },
      ],
      runtimes: {
        [sessionId]: {
          sessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);
    window.history.replaceState(null, "", `/session/${encodeURIComponent(sessionId)}/chats`);
    fireEvent.popState(window);

    await waitFor(() => {
      expect(screen.getAllByText("Build shell").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Terminals" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/session/${encodeURIComponent(sessionId)}/terminals`);
    });
    expect(screen.getByTestId("workspace-basename-chip")).toHaveAttribute("title", workspacePath);
    expect(screen.getByTestId("workspace-basename-chip")).toHaveTextContent("demo");

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/session/${encodeURIComponent(sessionId)}/settings`);
    });
    expect(screen.getByTestId("workspace-basename-chip")).toHaveAttribute("title", workspacePath);
    expect(screen.getByTestId("workspace-basename-chip")).toHaveTextContent("demo");

    fireEvent.click(screen.getByRole("tab", { name: "Devtools" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/session/${encodeURIComponent(sessionId)}/devtools`);
    });
    expect(screen.getByTestId("workspace-basename-chip")).toHaveAttribute("title", workspacePath);
    expect(screen.getByTestId("workspace-basename-chip")).toHaveTextContent("demo");
    expect(screen.queryByText("No session")).not.toBeInTheDocument();
  });

  test("Scenario: Given a chat session When the route-local session status menu is opened Then one state-driven action starts or stops the session", async () => {
    const workspacePath = "/repo/control";
    const runningSessionId = "session-running";
    const stoppedSessionId = "session-stopped";

    mockState = {
      ...createState(),
      sessions: [
        {
          id: runningSessionId,
          name: "Running shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-running",
          storeTarget: "global",
        },
        {
          id: stoppedSessionId,
          name: "Stopped shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "stopped",
          storageState: "active",
          sessionRoot: "/tmp/session-stopped",
          storeTarget: "global",
        },
      ],
      runtimes: {
        [runningSessionId]: {
          sessionId: runningSessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    window.history.replaceState(null, "", `/session/${encodeURIComponent(runningSessionId)}/chats`);
    fireEvent.popState(window);

    fireEvent.click(await screen.findByRole("button", { name: "Session status: Session running" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Stop session" }));
    await waitFor(() => {
      expect(stopSessionMock).toHaveBeenCalledWith(runningSessionId);
    });

    window.history.replaceState(null, "", `/session/${encodeURIComponent(stoppedSessionId)}/chats`);
    fireEvent.popState(window);

    fireEvent.click(await screen.findByRole("button", { name: "Session status: Session stopped" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Start session" }));
    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(stoppedSessionId);
    });
  });

  test("Scenario: Given a paused session When route-local session actions are opened Then resume stays primary while abort stays secondary", async () => {
    const workspacePath = "/repo/lifecycle";
    const pausedSessionId = "session-paused";

    mockState = {
      ...createState(),
      sessions: [
        {
          id: pausedSessionId,
          name: "Paused shell",
          cwd: workspacePath,
          workspacePath,
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "paused",
          storageState: "active",
          sessionRoot: "/tmp/session-paused",
          storeTarget: "global",
        },
      ],
      runtimes: {
        [pausedSessionId]: {
          sessionId: pausedSessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "idle",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    window.history.replaceState(null, "", `/session/${encodeURIComponent(pausedSessionId)}/chats`);
    fireEvent.popState(window);

    fireEvent.click(await screen.findByRole("button", { name: "Session status: Session paused" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Resume session" }));
    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(pausedSessionId);
    });
    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: "Resume session" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Session status: Session paused" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Abort session/i }));
    await waitFor(() => {
      expect(abortSessionMock).toHaveBeenCalledWith(pausedSessionId);
    });
  });

  test("Scenario: Given missing workspaces When batch clean is confirmed Then app calls the runtime store cleanup", async () => {
    const workspacePath = "/repo/missing";
    cleanMissingWorkspacesMock.mockResolvedValue([workspacePath]);
    mockState = {
      ...createState(),
      workspaces: [
        {
          path: workspacePath,
          favorite: false,
          group: "Other",
          missing: true,
          counts: EMPTY_COUNTS,
        },
      ],
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    fireEvent.click(await screen.findByRole("button", { name: "Workspaces" }));
    fireEvent.click(await screen.findByRole("button", { name: /Clean Missing/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));

    await waitFor(() => {
      expect(cleanMissingWorkspacesMock).toHaveBeenCalledTimes(1);
    });
  });

  test("Scenario: Given the runtime kernel is back to waiting_commits While stage is stale Then the app header presents the AI ready signal instead of thinking", async () => {
    const sessionId = "session-idle";
    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "agenter",
          cwd: "/repo/demo",
          workspacePath: "/repo/demo",
          avatar: "jon",
          createdAt: "2026-03-06T08:00:00.000Z",
          updatedAt: "2026-03-06T08:01:00.000Z",
          status: "running",
          storageState: "active",
          sessionRoot: "/tmp/session-idle",
          storeTarget: "global",
        },
      ],
      runtimes: {
        [sessionId]: {
          sessionId,
          started: true,
          activityState: "idle",
          schedulerPhase: "waiting_commits",
          stage: "plan",
          focusedTerminalId: "",
          focusedTerminalIds: [],
          chatMessages: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
          schedulerSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
          modelCapabilities: {
            streaming: false,
            tools: false,
            imageInput: false,
            nativeCompact: false,
            summarizeFallback: false,
            fileUpload: false,
            mcpCatalog: false,
          },
          activeCycle: null,
        },
      },
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);
    window.history.replaceState(null, "", `/session/${encodeURIComponent(sessionId)}/chats`);
    fireEvent.popState(window);

    const header = await screen.findByRole("banner");
    expect(within(header).getByLabelText("AI ready")).toBeInTheDocument();
  });
});

const renderAppAt = (path = "/") => {
  window.history.replaceState(null, "", path);
  return render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);
};

describe("Feature: web ui app shell", () => {
  test("Scenario: Given the app entry route When rendering Then Workspaces welcome becomes the default shell", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/demo" })],
      recentWorkspaces: ["/repo/demo"],
    };

    renderAppAt("/");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/workspaces");
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get("view")).toBe("welcome");
    expect(await screen.findByRole("heading", { name: "Workspaces" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workspaces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminals" })).toBeInTheDocument();
    expect(screen.getByText("Running Avatars")).toBeInTheDocument();
  });

  test("Scenario: Given the legacy global settings route When rendering Then it redirects into the ~/ workspace settings tab", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/demo" })],
    };

    renderAppAt("/settings");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/workspaces");
      const params = new URLSearchParams(window.location.search);
      expect(params.get("view")).toBe("workspace");
      expect(params.get("workspacePath")).toBe("~/");
      expect(params.get("tab")).toBe("settings");
    });

    expect(await screen.findByText("Global Settings")).toBeInTheDocument();
  });

  test("Scenario: Given welcome orchestration selections When starting an avatar Then grants seats and opens runtime attention", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/demo" })],
      recentWorkspaces: ["/repo/demo"],
    };
    inspectWorkspaceWelcomeMock.mockImplementation(async (input: { workspacePath: string; avatar?: string }) => ({
      workspacePath: input.workspacePath,
      avatar: input.avatar ?? "default",
      sessionId: `session:${input.workspacePath}:${input.avatar ?? "default"}`,
      avatars: await listWorkspaceAvatarCatalogMock(input.workspacePath),
      rooms:
        input.workspacePath === "/repo/demo"
          ? [
              {
                channel: createGlobalRoom({ chatId: "room-main", title: "Room Main" }),
                accessState: "available",
                seatStored: false,
                seatState: null,
                canAuthorize: true,
                seatRole: "member",
              },
            ]
          : [],
      terminals:
        input.workspacePath === "/repo/demo"
          ? [
              {
                terminal: createGlobalTerminal({ terminalId: "term-main", title: "Build Terminal" }),
                accessState: "available",
                seatStored: false,
                seatState: null,
                canAuthorize: true,
                seatRole: "writer",
              },
            ]
          : [],
    }));
    listMessageChannelsMock.mockResolvedValue([createMessageChannel({ chatId: "room-main", title: "Room Main" })]);
    createSessionMock.mockImplementation(async ({ cwd, avatar }: { cwd: string; avatar?: string }) => {
      const sessionId = "session-demo";
      emitState({
        ...mockState,
        sessions: [...mockState.sessions, createSessionRecord({ id: sessionId, workspacePath: cwd, avatar })],
        runtimes: {
          ...mockState.runtimes,
          [sessionId]: createRuntimeEntry(),
        },
        attentionBySession: {
          ...(mockState.attentionBySession ?? {}),
          [sessionId]: createAttentionState({ systemId: "message", subjectId: "room-main" }),
        },
      });
      return { id: sessionId };
    });

    renderAppAt("/workspaces?view=welcome&tab=settings&sort=recent");

    await screen.findByRole("heading", { name: "Welcome" });
    fireEvent.change(screen.getByLabelText("Workspace"), {
      target: { value: "/repo/demo" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Room Main/i }));
    fireEvent.click(screen.getByRole("button", { name: /Build Terminal/i }));
    const startButton = screen.getByRole("button", { name: "Start Avatar" });
    await waitFor(() => {
      expect(startButton).toBeEnabled();
    });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith({
        cwd: "/repo/demo",
        avatar: "default",
        autoStart: true,
      });
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/session/session-demo/devtools");
      expect(new URLSearchParams(window.location.search).get("panel")).toBe("attention");
    });

    expect(issueGlobalRoomGrantMock).toHaveBeenCalledWith({
      chatId: "room-main",
      accessToken: expect.stringContaining("msgtok_roommain"),
      role: "member",
      participantId: "session:session-demo",
    });
    expect(saveWorkspaceAvatarRoomSeatMock).toHaveBeenCalledWith({
      workspacePath: "/repo/demo",
      avatar: "default",
      chatId: "room-main",
      accessToken: "msgtok_global_grant",
      accessRole: "member",
      state: "active",
    });
    expect(focusMessageChannelsMock).toHaveBeenCalledWith({
      sessionId: "session-demo",
      op: "replace",
      channels: [
        {
          chatId: "room-main",
          accessToken: expect.stringContaining("msgtok_roommain"),
        },
      ],
    });
    expect(issueGlobalTerminalGrantMock).toHaveBeenCalledWith({
      terminalId: "term-main",
      role: "writer",
      participantId: "session:session-demo",
    });
    expect(saveWorkspaceAvatarTerminalSeatMock).toHaveBeenCalledWith({
      workspacePath: "/repo/demo",
      avatar: "default",
      terminalId: "term-main",
      accessToken: "termtok_global_grant",
      accessRole: "writer",
      state: "active",
    });
    expect(focusTerminalsMock).toHaveBeenCalledWith({
      sessionId: "session-demo",
      op: "replace",
      terminalIds: ["term-main"],
    });
  });

  test("Scenario: Given a workspace avatar that still points at the global source When opening Avatars Then editing is gated behind forking a full copy", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/demo" })],
    };

    renderAppAt("/workspaces?view=workspace&workspacePath=%2Frepo%2Fdemo&tab=avatars&sort=recent");

    expect(await screen.findByText(/This workspace is still reading the global avatar source\./i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fork Avatar Copy" }));

    await waitFor(() => {
      expect(forkWorkspaceAvatarMock).toHaveBeenCalledWith({
        workspacePath: "/repo/demo",
        avatar: "default",
      });
    });
  });

  test("Scenario: Given a legacy session chats route When rendering Then it redirects to runtime Devtools attention", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "/repo/demo" })],
      sessions: [createSessionRecord({ id: "session-demo", workspacePath: "/repo/demo" })],
      runtimes: {
        "session-demo": createRuntimeEntry(),
      },
    };

    renderAppAt("/session/session-demo/chats");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/session/session-demo/devtools");
      expect(new URLSearchParams(window.location.search).get("panel")).toBe("attention");
    });

    expect(await screen.findByRole("heading", { name: "Attention" })).toBeInTheDocument();
  });

  test("Scenario: Given a welcome draft When detouring to Chats and returning Then the room and terminal selections stay intact", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/demo" })],
    };
    inspectWorkspaceWelcomeMock.mockImplementation(async (input: { workspacePath: string; avatar?: string }) => ({
      workspacePath: input.workspacePath,
      avatar: input.avatar ?? "default",
      sessionId: `session:${input.workspacePath}:${input.avatar ?? "default"}`,
      avatars: await listWorkspaceAvatarCatalogMock(input.workspacePath),
      rooms:
        input.workspacePath === "/repo/demo"
          ? [
              {
                channel: createGlobalRoom({ chatId: "room-main", title: "Room Main" }),
                accessState: "available",
                seatStored: false,
                seatState: null,
                canAuthorize: true,
                seatRole: "member",
              },
            ]
          : [],
      terminals:
        input.workspacePath === "/repo/demo"
          ? [
              {
                terminal: createGlobalTerminal({ terminalId: "term-main", title: "Build Terminal" }),
                accessState: "available",
                seatStored: false,
                seatState: null,
                canAuthorize: true,
                seatRole: "writer",
              },
            ]
          : [],
    }));
    listGlobalRoomsMock.mockResolvedValue([]);

    renderAppAt("/workspaces?view=welcome&tab=settings&sort=recent");

    await screen.findByRole("heading", { name: "Welcome" });
    fireEvent.change(screen.getByLabelText("Workspace"), {
      target: { value: "/repo/demo" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Room Main/i }));
    fireEvent.click(screen.getByRole("button", { name: /Build Terminal/i }));
    fireEvent.click(screen.getByRole("button", { name: "Open Chats" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/chats");
    });

    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/workspaces");
      expect(new URLSearchParams(window.location.search).get("view")).toBe("welcome");
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Workspace") as HTMLSelectElement).value).toBe("/repo/demo");
    });
    expect(await screen.findAllByText("Grant role")).toHaveLength(2);
  });

  test("Scenario: Given an attention item sourced from a global room When opening its source Then the app jumps to Chats with the room selected", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "/repo/demo" })],
      sessions: [createSessionRecord({ id: "session-demo", workspacePath: "/repo/demo" })],
      runtimes: {
        "session-demo": createRuntimeEntry(),
      },
      attentionBySession: {
        "session-demo": createAttentionState({ systemId: "message", subjectId: "room-main" }),
      },
    };
    listGlobalRoomsMock.mockResolvedValue([createGlobalRoom({ chatId: "room-main", title: "Room Main" })]);
    snapshotGlobalRoomMock.mockResolvedValue({
      channel: createGlobalRoom({ chatId: "room-main", title: "Room Main" }),
      items: [],
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "0",
    });

    renderAppAt("/session/session-demo/devtools?panel=attention&attentionView=items");

    fireEvent.click(await screen.findByRole("button", { name: "Open Room" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/chats");
      expect(new URLSearchParams(window.location.search).get("chatId")).toBe("room-main");
    });
  });

  test("Scenario: Given an attention item whose room source no longer exists When rendering Then the source action stays visible but disabled", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "/repo/demo" })],
      sessions: [createSessionRecord({ id: "session-demo", workspacePath: "/repo/demo" })],
      runtimes: {
        "session-demo": createRuntimeEntry(),
      },
      attentionBySession: {
        "session-demo": createAttentionState({ systemId: "message", subjectId: "room-main" }),
      },
    };
    listGlobalRoomsMock.mockResolvedValue([]);

    renderAppAt("/session/session-demo/devtools?panel=attention&attentionView=items");

    expect(await screen.findByText("Source unavailable: global room room-main is not present in Chats.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Room" })).toBeDisabled();
  });

  test("Scenario: Given missing workspaces in the catalog When clean is confirmed Then the runtime store cleanup runs", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/missing", missing: true })],
    };

    renderAppAt("/workspaces?view=welcome&tab=settings&sort=recent");

    fireEvent.click(await screen.findByRole("button", { name: "Clean Missing 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Clean" }));

    await waitFor(() => {
      expect(cleanMissingWorkspacesMock).toHaveBeenCalledTimes(1);
    });
  });

  test("Scenario: Given the desktop sidebar When toggling collapse Then the shell switches between full rail and icon rail", async () => {
    mockState = {
      ...createState(),
      connected: true,
      workspaces: [createWorkspace({ path: "~/" }), createWorkspace({ path: "/repo/demo" })],
    };

    renderAppAt("/workspaces?view=welcome&tab=settings&sort=recent");

    const sidebar = await screen.findByTestId("app-sidebar-nav");
    expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
  });
});
