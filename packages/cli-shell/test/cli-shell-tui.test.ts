import type {
  AuthSessionOutput,
  CachedResourceState,
  GlobalRoomEntry,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  GlobalTerminalApprovalRequest,
  GlobalTerminalEntry,
  HeartbeatGroupItem,
  RuntimeClientState,
  SessionEntry,
} from "@agenter/client-sdk";
import type {
  TerminalTransportClientMessage,
  TerminalTransportServerMessage,
} from "@agenter/terminal-transport-protocol";
import { KeyEvent, MouseEvent as OpenTuiMouseEvent, parseKeypress, ScrollBoxRenderable } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, mock, test } from "bun:test";

import {
  BackendFrameRenderable,
  BackendScrollbarRenderable,
  BackendTerminalFrameRenderable,
  CliShellDialogueScrollBoxController,
  buildCliShellComposedSurface,
  buildCliShellDialogueScrollRows,
  buildCliShellHostingContextId,
  buildCliShellTuiModel,
  CLI_SHELL_BACKEND_INTERACTION_RECOMMENDATIONS,
  CliShellCoreApp,
  CliShellDialogueBackend,
  createCliShellPerfTracer,
  createTerminalCanvas,
  encodeCliShellTerminalKey,
  findNextTerminalWordBoundary,
  findPreviousTerminalWordBoundary,
  findWordInTerminal,
  formatCliShellDebugBarLine,
  layoutCliShellTuiFrame,
  loadCliShellDialogueOlderMessages,
  measureTerminalText,
  projectCliShellDialogueBackendFrame,
  renderCanvasLines,
  captureCliShellDialogueAnchor,
  createCliShellDialogueMessageWindowFromSnapshot,
  resolveCliShellDialoguePlacement,
  mergeCliShellDialogueIncomingMessages,
  resolveCliShellInteractionEnhancementProfile,
  prependCliShellDialogueMessagePage,
  resolveCliShellDialogueScrollMetrics,
  resolveCliShellScrollbarPointerTarget,
  resolveCliShellShellScrollbarProjection,
  resolveCliShellTerminalRegion,
  resolveCliShellTranscriptPanelLayout,
  resolveCliShellTuiInteractionLayout,
  resolveCliShellDialogueWheelDelta,
  resolveCliShellTuiKeybindings,
  restoreCliShellDialogueAnchorScrollTop,
  restoreCliShellDialoguePrependScrollTop,
  routeCliShellKey,
  routeCliShellMouseScroll,
  routeCliShellPaste,
  routeCliShellPointerAction,
  routeCliShellViewportTarget,
  ShellTerminalViewRenderable,
  stringIndexToTerminalColumn,
  submitCliShellDialogue,
  loadOlderCliShellDialogueMessages,
  terminalColumnToStringIndex,
  writeCanvasStyledText,
  type BackendFrameInteractionTraceEvent,
  type CliShellLiveTerminalTransportSessionFactory,
  type CliShellManagedState,
  type CliShellTuiStore,
  type CliShellTuiViewState,
} from "../src";
import { createTestTransportSession } from "./test-transport-session";

const createCached = <T>(data: T): CachedResourceState<T> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: 0,
});

const normalizeAsciiLetters = (value: string): string => value.replace(/[^a-z]+/gi, "").toLowerCase();

const createSession = (): SessionEntry => ({
  id: "session-1",
  name: "shell-assistant",
  cwd: "/repo",
  workspacePath: "/repo",
  avatar: "shell-assistant",
  avatarPrincipalId: "auth:shell-assistant",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  status: "running",
  storageState: "active",
  sessionRoot: "/tmp/session-1",
  storeTarget: "global",
});

const createRoomEntry = (chatId: string): GlobalRoomEntry => ({
  chatId,
  kind: "room",
  title: "shell-1",
  owner: "ops",
  participants: [{ id: "auth:user", label: "User" }],
  metadata: {
    product: "cli-shell",
    resourceKey: "shell-1",
  },
  createdAt: 1,
  updatedAt: 1,
  focused: false,
  accessRole: "admin",
  accessToken: `tok:${chatId}`,
});

const createGlobalTerminalEntry = (terminalId: string, lines: string[]): GlobalTerminalEntry => ({
  terminalId,
  processKind: "shell",
  backend: "xterm",
  command: ["/bin/bash"],
  launchCwd: "/repo",
  workspace: null,
  status: "IDLE",
  processPhase: "running",
  seq: 2,
  snapshot: {
    seq: 2,
    timestamp: 20,
    cols: 120,
    rows: 39,
    lines,
    cursor: { x: 0, y: Math.max(0, lines.length - 1), visible: true },
    scrollback: {
      viewportOffset: Math.max(0, lines.length - 39),
      totalLines: lines.length,
      screenLines: 39,
    },
  },
  focused: false,
  icon: undefined,
  configuredTitle: terminalId,
  currentTitle: undefined,
  currentPath: undefined,
  shortcuts: undefined,
  rendererPreference: "auto",
  theme: "default-dark",
  cursor: "block",
  font: {
    family: "monospace",
    sizePx: 13,
    lineHeight: 1.4,
    letterSpacing: 0,
    weight: "400",
    weightBold: "700",
    ligatures: false,
  },
  transportUrl: `ws://127.0.0.1/pty/${terminalId}`,
  currentAdminId: null,
  approvalTimeoutMs: 90_000,
  pendingRequestCount: 0,
  access: {
    role: "admin",
    accessToken: `tok:${terminalId}`,
    participantId: "system:trusted-terminal-bootstrap",
    currentAdmin: true,
  },
  actors: [],
  metadata: {},
});

const createCliShellTerminal2Entry = (
  input: {
    terminalId?: string;
    shellTerminalId?: string;
    lines?: string[];
    cols?: number;
    rows?: number;
    metadata?: Record<string, unknown>;
  } = {},
): GlobalTerminalEntry => {
  const terminalId = input.terminalId ?? "shell-1:terminal-2";
  const shellTerminalId = input.shellTerminalId ?? "shell-1:terminal-1";
  const entry = createGlobalTerminalEntry(terminalId, input.lines ?? []);
  return {
    ...entry,
    processKind: "product",
    configuredTitle: terminalId,
    metadata: {
      terminalRuntimeKind: "composed",
      composedShellTerminalId: shellTerminalId,
      ...(input.metadata ?? {}),
    },
    snapshot: entry.snapshot
      ? {
          ...entry.snapshot,
          cols: input.cols ?? entry.snapshot.cols,
          rows: input.rows ?? entry.snapshot.rows,
          scrollback: {
            ...entry.snapshot.scrollback,
            screenLines: input.rows ?? entry.snapshot.scrollback.screenLines,
          },
        }
      : entry.snapshot,
  };
};

const withoutTransportUrl = (entry: GlobalTerminalEntry): GlobalTerminalEntry => ({
  ...entry,
  transportUrl: undefined,
});

const createRoomMessage = (input: {
  messageId: number;
  senderActorId: NonNullable<GlobalRoomMessage["senderActorId"]>;
  from: string;
  content: string;
  createdAt: number;
  unreadActorIds?: GlobalRoomMessage["unreadActorIds"];
}): GlobalRoomMessage => ({
  rowId: input.messageId,
  messageId: input.messageId,
  chatId: "room-shell-1",
  senderActorId: input.senderActorId,
  from: input.from,
  kind: "text",
  content: input.content,
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
  readActorIds: [],
  unreadActorIds: input.unreadActorIds ?? [],
  metadata: {},
  attachments: [],
});

const createRuntimeState = (input: {
  heartbeat: HeartbeatGroupItem[];
  lines: string[];
  roomMessages?: GlobalRoomMessage[];
  unread?: number;
}): RuntimeClientState => {
  const sessionId = "session-1";
  const roomEntry = createRoomEntry("room-shell-1");
  const terminalSnapshots = {
    "shell-1": {
      seq: 2,
      timestamp: 20,
      cols: 120,
      rows: 39,
      lines: input.lines,
      cursor: { x: 0, y: Math.max(0, input.lines.length - 1), visible: true },
      scrollback: {
        viewportOffset: Math.max(0, input.lines.length - 39),
        totalLines: input.lines.length,
        screenLines: 39,
      },
    },
  };
  const roomSnapshot: GlobalRoomSnapshotOutput = {
    channel: roomEntry,
    items: input.roomMessages ?? [],
    nextBefore: null,
    hasMoreBefore: false,
    headVersion: "1",
  };

  return {
    connected: true,
    connectionStatus: "connected",
    profileService: null,
    lastEventId: 2,
    sessions: [createSession()],
    runtimes: {
      [sessionId]: {
        sessionId,
        started: true,
        activityState: "active",
        schedulerPhase: "waiting_commits",
        stage: "idle",
        focusedTerminalId: "shell-1",
        focusedTerminalIds: ["shell-1"],
        chatMessages: [],
        terminalSnapshots,
        terminalReads: {},
        tasks: [],
        schedulerState: null,
        attention: undefined,
        attentionDelivery: {
          projections: [],
          dispatches: [],
          receipts: [],
          watches: [],
          effects: [],
        },
        schedulerSignals: {
          user: { version: 0, timestamp: null },
          terminal: { version: 0, timestamp: null },
          task: { version: 0, timestamp: null },
          attention: { version: 0, timestamp: null },
        },
        apiCallRecording: { enabled: false, refCount: 0 },
        attentionApi: null,
        terminals: [
          {
            terminalId: "shell-1",
            status: "IDLE",
            processPhase: "running",
            lifecycleTransition: null,
            seq: 2,
            launchCwd: "/repo",
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
    activityBySession: { [sessionId]: "active" },
    terminalSnapshotsBySession: { [sessionId]: terminalSnapshots },
    terminalReadsBySession: { [sessionId]: {} },
    chatsBySession: { [sessionId]: [] },
    messageChannelsBySession: {},
    chatCyclesBySession: { [sessionId]: [] },
    attentionBySession: {},
    attentionDeliveryBySession: {
      [sessionId]: {
        projections: [],
        dispatches: [],
        receipts: [],
        watches: [],
        effects: [],
      },
    },
    tasksBySession: { [sessionId]: [] },
    recentWorkspaces: [],
    workspaces: [],
    globalAvatarCatalog: createCached([]),
    workspaceAvatarCatalogByPath: {},
    globalRooms: createCached([roomEntry]),
    globalRoomSnapshotsById: { [roomEntry.chatId]: createCached(roomSnapshot) },
    globalRoomGrantsById: {},
    globalRoomAssetsById: {},
    globalTerminals: createCached([createGlobalTerminalEntry("shell-1", input.lines)]),
    globalTerminalGrantsById: {},
    globalTerminalApprovalsById: {},
    globalTerminalActivityById: {},
    schedulerLogsBySession: { [sessionId]: [] },
    observabilityTracesBySession: { [sessionId]: [] },
    heartbeatGroupsBySession: { [sessionId]: createCached(input.heartbeat) },
    modelCallsBySession: { [sessionId]: [] },
    requestAuxBySession: { [sessionId]: [] },
    modelCallDeltasBySession: { [sessionId]: [] },
    apiCallsBySession: { [sessionId]: [] },
    terminalActivityBySession: { [sessionId]: {} },
    apiCallRecordingBySession: { [sessionId]: { enabled: false, refCount: 0 } },
    notifications: [],
    unreadBySession: { [sessionId]: input.unread ?? 3 },
    unreadByBucket: {},
  };
};

const createManagedState = (input: { shellName?: string; managed?: boolean } = {}): CliShellManagedState => ({
  contextId: buildCliShellHostingContextId(input.shellName ?? "shell-1"),
  hostingMatches: [],
  hostingActive: input.managed ?? false,
  managed: input.managed ?? false,
});

const createTerminalPermissionRequest = (
  input: Partial<GlobalTerminalApprovalRequest> = {},
): GlobalTerminalApprovalRequest => ({
  requestId: input.requestId ?? "approval-shell-1",
  terminalId: input.terminalId ?? "shell-1",
  participantId: input.participantId ?? "auth:shell-assistant",
  assignedAdminId: input.assignedAdminId ?? "auth:admin",
  status: input.status ?? "pending",
  requestedInput: input.requestedInput ?? {
    mode: "raw",
    text: "echo guarded && pwd",
  },
  createdAt: input.createdAt ?? 1_714_560_000_000,
  expiresAt: input.expiresAt ?? 1_714_560_090_000,
  decidedAt: input.decidedAt,
  decidedBy: input.decidedBy,
  leaseId: input.leaseId,
});

interface TuiStoreHarness {
  store: CliShellTuiStore;
  replaceGlobalTerminals(nextTerminals: GlobalTerminalEntry[]): void;
  replaceTerminalPermissionRequests(terminalId: string, requests: GlobalTerminalApprovalRequest[]): void;
  setPublishComposedSurfaceEnabled(enabled: boolean): void;
  inputs: Array<{ terminalId: string; text: string }>;
  terminalConfigs: Array<{ terminalId: string; cols?: number; rows?: number }>;
  sentMessages: Array<{ chatId: string; text: string }>;
  roomPageCalls: Array<{ chatId: string; before: { beforeTimeMs: number; beforeId: number } | null; limit?: number }>;
  approvedRequests: Array<{ terminalId: string; requestId: string; durationMs: number }>;
  deniedRequests: Array<{ terminalId: string; requestId: string }>;
  retainedPermissionRequestStreams: Array<{ terminalId?: string; released: boolean }>;
  enqueueRoomPage(page: {
    items: GlobalRoomMessage[];
    nextBefore: { beforeTimeMs: number; beforeId: number } | null;
    hasMore: boolean;
  }): void;
  lastPublishedComposedSurface:
    | Parameters<CliShellTuiStore["publishGlobalTerminalComposedSurface"]>[0]["surface"]
    | null;
}

const createTuiStore = (input: { state: RuntimeClientState; settingsContent?: string }): TuiStoreHarness => {
  let state = input.state;
  const listeners = new Set<() => void>();
  const inputs: Array<{ terminalId: string; text: string }> = [];
  const terminalConfigs: Array<{ terminalId: string; cols?: number; rows?: number }> = [];
  const sentMessages: Array<{ chatId: string; text: string }> = [];
  const roomPageCalls: TuiStoreHarness["roomPageCalls"] = [];
  const approvedRequests: Array<{ terminalId: string; requestId: string; durationMs: number }> = [];
  const deniedRequests: Array<{ terminalId: string; requestId: string }> = [];
  const retainedPermissionRequestStreams: Array<{ terminalId?: string; released: boolean }> = [];
  const queuedRoomPages: Array<{
    items: GlobalRoomMessage[];
    nextBefore: { beforeTimeMs: number; beforeId: number } | null;
    hasMore: boolean;
  }> = [];
  let lastPublishedComposedSurface: TuiStoreHarness["lastPublishedComposedSurface"] = null;
  let publishComposedSurfaceEnabled = true;
  const authSession: AuthSessionOutput = {
    token: "superadmin-token",
    issuedAt: new Date(0).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    claims: {
      authId: "root-superadmin",
      profileId: "profile-root",
      admin: true,
      superadmin: true,
    },
    profile: {
      profileId: "profile-root",
      identifiers: [{ kind: "email", value: "root@example.com" }],
      metadata: {},
      iconUrl: "",
      isVirtual: false,
    },
  };

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const getRoomSnapshot = (): GlobalRoomSnapshotOutput =>
    state.globalRoomSnapshotsById["room-shell-1"]?.data ?? {
      channel: createRoomEntry("room-shell-1"),
      items: [],
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "0",
    };

  const replaceGlobalTerminals = (nextTerminals: GlobalTerminalEntry[]): void => {
    state = {
      ...state,
      globalTerminals: createCached(nextTerminals),
    };
    emit();
  };

  const replaceTerminalPermissionRequests = (terminalId: string, requests: GlobalTerminalApprovalRequest[]): void => {
    state = {
      ...state,
      globalTerminalApprovalsById: {
        ...state.globalTerminalApprovalsById,
        [terminalId]: createCached(requests),
      },
    };
    emit();
  };

  const store = {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: async () => {},
    disconnect: () => {},
    hydrateSessionArtifacts: async () => undefined,
    retainGlobalTerminals: () => () => {},
    retainTerminalPermissionRequests: (payload?: { terminalId?: string }) => {
      const record = { terminalId: payload?.terminalId, released: false };
      retainedPermissionRequestStreams.push(record);
      return () => {
        record.released = true;
      };
    },
    hydrateGlobalTerminals: async () => state.globalTerminals.data,
    readGlobalTerminal: async (payload: { terminalId: string }) => {
      const terminal = state.globalTerminals.data.find((entry) => entry.terminalId === payload.terminalId);
      if (!terminal?.snapshot) {
        throw new Error(`terminal snapshot missing: ${payload.terminalId}`);
      }
      return {
        terminalId: payload.terminalId,
        representation: "snapshot" as const,
        snapshot: terminal.snapshot,
      };
    },
    retainGlobalRoomSnapshot: () => () => {},
    hydrateGlobalRoomSnapshot: async () => getRoomSnapshot(),
    pageGlobalRoomMessages: async (payload: {
      chatId: string;
      before?: { beforeTimeMs: number; beforeId: number } | null;
      limit?: number;
    }) => {
      roomPageCalls.push({ chatId: payload.chatId, before: payload.before ?? null, limit: payload.limit });
      const queuedPage = queuedRoomPages.shift();
      if (queuedPage) {
        return queuedPage;
      }
      return {
        items: [],
        hasMore: false,
        nextBefore: null,
      };
    },
    sendGlobalRoomMessage: async (payload: { chatId: string; text: string }) => {
      sentMessages.push({ chatId: payload.chatId, text: payload.text });
      const snapshot = getRoomSnapshot();
      const nextMessage = createRoomMessage({
        messageId: snapshot.items.length + 100,
        senderActorId: "auth:user",
        from: "you",
        content: payload.text,
        createdAt: 1_714_560_000_000 + snapshot.items.length * 60_000,
      });
      state = {
        ...state,
        globalRoomSnapshotsById: {
          ...state.globalRoomSnapshotsById,
          [payload.chatId]: createCached({ ...snapshot, items: [...snapshot.items, nextMessage] }),
        },
      };
      emit();
      return { ok: true };
    },
    inputGlobalTerminal: async (payload: { terminalId: string; text: string }) => {
      inputs.push({ terminalId: payload.terminalId, text: payload.text });
      return { ok: true };
    },
    setGlobalTerminalConfig: async (payload: { terminalId: string; cols?: number; rows?: number }) => {
      terminalConfigs.push(payload);
      return payload;
    },
    publishGlobalTerminalComposedSurface: async (payload: {
      terminalId: string;
      surface: NonNullable<TuiStoreHarness["lastPublishedComposedSurface"]>;
    }) => {
      if (!publishComposedSurfaceEnabled) {
        lastPublishedComposedSurface = structuredClone(payload.surface);
        return state.globalTerminals.data.find((entry) => entry.terminalId === payload.terminalId)!;
      }
      const index = state.globalTerminals.data.findIndex((entry) => entry.terminalId === payload.terminalId);
      if (index === -1) {
        throw new Error(`terminal missing: ${payload.terminalId}`);
      }
      const current = state.globalTerminals.data[index]!;
      const nextEntry: GlobalTerminalEntry = {
        ...current,
        seq: current.seq + 1,
        metadata: {
          ...current.metadata,
          composedFrameSeq: payload.surface.seq ?? (current.snapshot?.seq ?? 0) + 1,
          composedFrameMetadata: payload.surface.metadata ? { ...payload.surface.metadata } : {},
          composedSelectionSources: payload.surface.selectionSources?.map((source) => ({ ...source })),
        },
        snapshot: {
          seq: payload.surface.seq ?? (current.snapshot?.seq ?? 0) + 1,
          timestamp: Date.now(),
          cols: payload.surface.cols,
          rows: payload.surface.rows,
          lines: [...payload.surface.lines],
          richLines: payload.surface.richLines?.map((line) => ({
            spans: line.spans.map((span) => ({ ...span })),
          })),
          cursor: { ...payload.surface.cursor },
          scrollback: { ...payload.surface.scrollback },
        },
      };
      lastPublishedComposedSurface = structuredClone(payload.surface);
      state = {
        ...state,
        globalTerminals: createCached(
          state.globalTerminals.data.map((entry, entryIndex) => (entryIndex === index ? nextEntry : entry)),
        ),
      };
      emit();
      return nextEntry;
    },
    readSettings: async () => ({
      path: "/tmp/settings.json",
      content: input.settingsContent ?? "",
      mtimeMs: 1,
    }),
    getAuthSession: async () => authSession,
    grantGlobalTerminalWriteLease: async (payload: {
      terminalId: string;
      participantId: string;
      durationMs: number;
    }) => ({
      leaseId: `lease:${payload.terminalId}:${payload.participantId}`,
      participantId: payload.participantId,
      expiresAt: Date.now() + payload.durationMs,
    }),
    revokeGlobalTerminalWriteLease: async () => ({ ok: true as const, revokedCount: 1 }),
    queryAttention: async () => [],
    commitAttention: async (payload: { contextId: string }) => ({ commit: payload }),
    settleAttention: async (payload: { contextId: string }) => ({ commit: payload }),
    approveGlobalTerminalRequest: async (payload: { terminalId: string; requestId: string; durationMs: number }) => {
      approvedRequests.push(payload);
      replaceTerminalPermissionRequests(
        payload.terminalId,
        state.globalTerminalApprovalsById[payload.terminalId]?.data.filter(
          (request) => request.requestId !== payload.requestId,
        ) ?? [],
      );
      return {
        leaseId: `lease:${payload.requestId}`,
        participantId: "auth:shell-assistant",
        expiresAt: Date.now() + payload.durationMs,
      };
    },
    denyGlobalTerminalRequest: async (payload: { terminalId: string; requestId: string }) => {
      deniedRequests.push(payload);
      replaceTerminalPermissionRequests(
        payload.terminalId,
        state.globalTerminalApprovalsById[payload.terminalId]?.data.filter(
          (request) => request.requestId !== payload.requestId,
        ) ?? [],
      );
      return { ok: true as const };
    },
  };

  return {
    store: store as unknown as CliShellTuiStore,
    replaceGlobalTerminals,
    replaceTerminalPermissionRequests,
    setPublishComposedSurfaceEnabled(enabled: boolean) {
      publishComposedSurfaceEnabled = enabled;
    },
    inputs,
    terminalConfigs,
    sentMessages,
    roomPageCalls,
    approvedRequests,
    deniedRequests,
    retainedPermissionRequestStreams,
    enqueueRoomPage(page) {
      queuedRoomPages.push(page);
    },
    get lastPublishedComposedSurface() {
      return lastPublishedComposedSurface;
    },
  };
};

const createTestKeyEvent = (input: {
  name: string;
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
  shift?: boolean;
  option?: boolean;
  sequence?: string;
  raw?: string;
}): KeyEvent =>
  new KeyEvent({
    name: input.name,
    ctrl: input.ctrl ?? false,
    meta: input.meta ?? false,
    super: input.super ?? false,
    shift: input.shift ?? false,
    option: input.option ?? false,
    sequence: input.sequence ?? "",
    raw: input.raw ?? input.sequence ?? "",
    number: false,
    eventType: "press",
    source: "raw",
  });

interface CoreAppTestSetup {
  renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"];
  mockInput: Awaited<ReturnType<typeof createTestRenderer>>["mockInput"];
  mockMouse: Awaited<ReturnType<typeof createTestRenderer>>["mockMouse"];
  renderOnce: Awaited<ReturnType<typeof createTestRenderer>>["renderOnce"];
  captureCharFrame: Awaited<ReturnType<typeof createTestRenderer>>["captureCharFrame"];
  captureSpans: Awaited<ReturnType<typeof createTestRenderer>>["captureSpans"];
  resize: Awaited<ReturnType<typeof createTestRenderer>>["resize"];
  app: CliShellCoreApp;
  destroy(): void;
}

const createCoreAppTestSetup = async (input: {
  state: RuntimeClientState;
  width?: number;
  height?: number;
  fallbackTerminalId?: string;
  debug?: boolean;
  managed?: CliShellManagedState;
  createTransportSession?: CliShellLiveTerminalTransportSessionFactory;
  harness?: TuiStoreHarness;
}): Promise<CoreAppTestSetup> => {
  const testRenderer = await createTestRenderer({
    width: input.width ?? 80,
    height: input.height ?? 24,
    useMouse: true,
    exitOnCtrlC: false,
  });
  const harness = input.harness ?? createTuiStore({ state: input.state });
  const app = new CliShellCoreApp({
    renderer: testRenderer.renderer,
    store: harness.store,
    sessionId: "session-1",
    shellName: "shell-1",
    fallbackTerminalId: input.fallbackTerminalId ?? "shell-1",
    roomChatId: "room-shell-1",
    roomAccessToken: "tok:room-shell-1",
    runtimeId: "runtime:shell-assistant",
    avatarActorId: "auth:shell-assistant",
    managed: input.managed ?? createManagedState(),
    keybindings: resolveCliShellTuiKeybindings(null),
    onQuit: () => {},
    debug: input.debug ?? false,
    createTransportSession: input.createTransportSession,
  });
  app.start();
  return {
    ...testRenderer,
    app,
    destroy() {
      app.dispose();
      testRenderer.renderer.destroy();
    },
  };
};

const createShellTerminalViewTestSetup = async (
  input: ConstructorParameters<typeof ShellTerminalViewRenderable>[1],
) => {
  const setup = await createTestRenderer({
    width: typeof input.width === "number" ? input.width : 80,
    height: typeof input.height === "number" ? input.height : 24,
    useMouse: true,
    exitOnCtrlC: false,
  });
  const view = new ShellTerminalViewRenderable(setup.renderer, input);
  setup.renderer.root.add(view);
  view.focus();
  return { ...setup, view };
};

const createBackendScrollbarTestSetup = async (input: ConstructorParameters<typeof BackendScrollbarRenderable>[1]) => {
  const setup = await createTestRenderer({
    width: typeof input.width === "number" ? input.width : 1,
    height: typeof input.height === "number" ? input.height : 10,
    useMouse: true,
    exitOnCtrlC: false,
  });
  const scrollbar = new BackendScrollbarRenderable(setup.renderer, input);
  setup.renderer.root.add(scrollbar);
  scrollbar.focus();
  return { ...setup, scrollbar };
};

const createBackendTerminalFrameTestSetup = async (
  input: ConstructorParameters<typeof BackendTerminalFrameRenderable>[1],
) => {
  const setup = await createTestRenderer({
    width: typeof input.width === "number" ? input.width : 80,
    height: typeof input.height === "number" ? input.height : 24,
    useMouse: true,
    exitOnCtrlC: false,
  });
  const frame = new BackendTerminalFrameRenderable(setup.renderer, input);
  setup.renderer.root.add(frame);
  frame.focusTerminal();
  return { ...setup, frame };
};

const createDialogueScrollBoxTestSetup = async (
  input: ConstructorParameters<typeof CliShellDialogueScrollBoxController>[1],
) => {
  const setup = await createTestRenderer({
    width: typeof input.width === "number" ? input.width : 40,
    height: typeof input.height === "number" ? input.height : 10,
    useMouse: true,
    exitOnCtrlC: false,
  });
  const controller = new CliShellDialogueScrollBoxController(setup.renderer, input);
  setup.renderer.root.add(controller.scrollBox);
  controller.scrollBox.focus();
  return { ...setup, controller };
};

const dispatchRenderableMouseEvent = (
  target: ShellTerminalViewRenderable,
  input: {
    type: "down" | "drag" | "drag-end" | "up";
    x: number;
    y: number;
    button?: number;
  },
): void => {
  target.processMouseEvent(
    new OpenTuiMouseEvent(target, {
      type: input.type,
      x: input.x,
      y: input.y,
      button: input.button ?? 0,
      modifiers: { shift: false, alt: false, ctrl: false },
    }),
  );
};

const selectedSpanCells = (setup: Pick<Awaited<ReturnType<typeof createTestRenderer>>, "captureSpans">) =>
  setup
    .captureSpans()
    .lines.flatMap((line, row) =>
      line.spans
        .filter((span) => span.bg.toString() === "rgba(0.15, 0.39, 0.92, 1.00)")
        .map((span) => ({ row, text: span.text })),
    );

describe("Feature: cli-shell interactive TUI", () => {
  test("Scenario: Given native Chat uses OpenTUI scrolling When constructed Then ScrollBox owns the message-list viewport", async () => {
    const setup = await createDialogueScrollBoxTestSetup({
      width: 32,
      height: 6,
      rows: Array.from({ length: 12 }, (_, index) => ({
        key: `row-${index}`,
        text: `message row ${index}`,
      })),
    });

    expect(setup.controller.scrollBox).toBeInstanceOf(ScrollBoxRenderable);
    expect(setup.controller.scrollBox.verticalScrollBar).toBeDefined();
    expect(setup.controller.snapshot().viewportHeight).toBe(6);
    expect(setup.controller.snapshot().scrollHeight).toBeGreaterThan(setup.controller.snapshot().viewportHeight);
    setup.renderer.destroy();
  });

  test("Scenario: Given native Chat backend projects terminal-2 cells When rendering Then it consumes the OpenTUI ScrollBox viewport owner", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["shell"],
      roomMessages: Array.from({ length: 10 }, (_, index) =>
        createRoomMessage({
          messageId: index + 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message row ${index + 1}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + index * 60_000,
        }),
      ),
      unread: 0,
    });
    const model = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "dialogue",
        activeFocusTarget: "dialogue",
        requestedPlacement: "right",
        dialogueDraft: "",
        dialogueScrollTop: 3,
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 80,
      height: 24,
    });
    const syncCalls: Array<{ width: number; height: number; scrollTop: number; rowCount: number }> = [];
    const viewportOwner = {
      sync(input: { width: number; height: number; rows: readonly { key: string }[]; scrollTop: number }) {
        syncCalls.push({
          width: input.width,
          height: input.height,
          scrollTop: input.scrollTop,
          rowCount: input.rows.length,
        });
        return {
          scrollTop: 4,
          viewportHeight: input.height,
          scrollHeight: input.rows.length,
          maxScrollTop: Math.max(0, input.rows.length - input.height),
          nearTop: false,
          pinnedToBottom: false,
        };
      },
    };

    const frame = projectCliShellDialogueBackendFrame({
      layout: { width: 30, height: 10 },
      model,
      viewportOwner,
    });

    expect(syncCalls).toHaveLength(1);
    expect(syncCalls[0]).toMatchObject({ width: 26, height: 6, scrollTop: model.dialogueScroll.scrollTop });
    expect(syncCalls[0]!.rowCount).toBeGreaterThan(10);
    expect(frame.viewport.scrollTop).toBe(4);
  });

  test("Scenario: Given native Chat scroll adapter When wheel directions are normalized Then down moves toward newer content and up moves toward older content", () => {
    expect(resolveCliShellDialogueWheelDelta({ direction: "down", delta: 3 })).toBe(3);
    expect(resolveCliShellDialogueWheelDelta({ direction: "up", delta: 2 })).toBe(-2);
    expect(resolveCliShellDialogueWheelDelta({ direction: undefined, delta: 2 })).toBe(0);
  });

  test("Scenario: Given native Chat ScrollBox is away from the top When wheel down is applied Then it moves toward newer lower content", async () => {
    const setup = await createDialogueScrollBoxTestSetup({
      width: 32,
      height: 5,
      rows: Array.from({ length: 20 }, (_, index) => ({
        key: `row-${index}`,
        text: `message row ${index}`,
      })),
      initialScrollTop: 4,
    });

    const before = setup.controller.snapshot().scrollTop;
    setup.controller.applyWheel({ direction: "down", delta: 3 });
    const afterDown = setup.controller.snapshot().scrollTop;
    setup.controller.applyWheel({ direction: "up", delta: 2 });
    const afterUp = setup.controller.snapshot().scrollTop;

    expect(afterDown).toBeGreaterThan(before);
    expect(afterUp).toBeLessThan(afterDown);
    setup.renderer.destroy();
  });

  test("Scenario: Given a room snapshot When cli-shell creates a Chat window Then it keeps MessageRoom pagination cursors without exposing dialogueScrollOffset", () => {
    const snapshot = createRuntimeState({
      heartbeat: [],
      lines: ["shell"],
      roomMessages: Array.from({ length: 4 }, (_, index) =>
        createRoomMessage({
          messageId: index + 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message ${index + 1}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + index * 60_000,
        }),
      ),
    }).globalRoomSnapshotsById["room-shell-1"]!.data;
    expect(snapshot).not.toBeNull();

    const window = createCliShellDialogueMessageWindowFromSnapshot(snapshot!);

    expect(window.messageIds).toEqual([1, 2, 3, 4]);
    expect(window.nextBefore).toBe(snapshot!.nextBefore);
    expect(window.hasMoreBefore).toBe(snapshot!.hasMoreBefore);
    expect("dialogueScrollOffset" in window).toBe(false);
  });

  test("Scenario: Given near-top Chat scroll with older history When loading before Then cli-shell pages MessageRoom through nextBefore", async () => {
    const before = { beforeTimeMs: 1_714_560_000_000, beforeId: 10 };
    const window = {
      ...createCliShellDialogueMessageWindowFromSnapshot({
        channel: createRoomEntry("room-shell-1"),
        items: [createRoomMessage({
          messageId: 10,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: "newer",
          createdAt: before.beforeTimeMs,
        })],
        nextBefore: before,
        hasMoreBefore: true,
        headVersion: "1",
      }),
      scroll: {
        scrollTop: 1,
        viewportHeight: 8,
        scrollHeight: 40,
      },
    };
    const calls: Array<{ chatId: string; before: typeof before | null; limit: number }> = [];

    await loadCliShellDialogueOlderMessages({
      chatId: "room-shell-1",
      accessToken: "tok:room-shell-1",
      window,
      thresholdRows: 2,
      limit: 25,
      pageMessages: async (input) => {
        calls.push({ chatId: input.chatId, before: input.before ?? null, limit: input.limit ?? 0 });
        return {
          items: [
            createRoomMessage({
              messageId: 9,
              senderActorId: "auth:user",
              from: "you",
              content: "older",
              createdAt: before.beforeTimeMs - 60_000,
            }),
          ],
          nextBefore: null,
          hasMore: false,
        };
      },
    });

    expect(calls).toEqual([{ chatId: "room-shell-1", before, limit: 25 }]);
    expect(window.messageIds).toEqual([9, 10]);
    expect(window.hasMoreBefore).toBe(false);
  });

  test("Scenario: Given controller loads older Chat history When messages are prepended Then it restores the captured visible anchor", async () => {
    const before = { beforeTimeMs: 1_714_560_000_000, beforeId: 4 };
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["shell"],
      roomMessages: [4, 5, 6].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message ${messageId}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + messageId * 60_000,
        }),
      ),
      unread: 0,
    });
    state.globalRoomSnapshotsById["room-shell-1"] = createCached({
      ...state.globalRoomSnapshotsById["room-shell-1"]!.data!,
      nextBefore: before,
      hasMoreBefore: true,
    });
    const harness = createTuiStore({ state });
    harness.enqueueRoomPage({
      items: [2, 3].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:user",
          from: "you",
          content: `older ${messageId}`,
          createdAt: Date.parse("2026-05-08T09:00:00+08:00") + messageId * 60_000,
        }),
      ),
      nextBefore: null,
      hasMore: false,
    });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: true,
      focusTarget: "dialogue",
      requestedPlacement: "right",
      dialogueDraft: "",
      dialogueScrollTop: 3,
      managed: createManagedState(),
      statusNotice: null,
    };
    const keybindings = resolveCliShellTuiKeybindings(null);
    const rowsBefore = [4, 5, 6].map((messageId) => ({ key: `message:${messageId}`, height: 2 }));
    const rowsAfter = [2, 3, 4, 5, 6].map((messageId) => ({ key: `message:${messageId}`, height: 2 }));
    let readRows = rowsBefore;
    const model = () =>
      buildCliShellTuiModel({
        state: harness.store.getState(),
        projection: { roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
        sessionId: "session-1",
        shellName: "shell-1",
        fallbackTerminalId: "shell-1",
        avatarActorId: "auth:shell-assistant",
        ui: viewState,
        keybindings,
        width: 120,
        height: 40,
      });
    viewState = {
      ...viewState,
      dialogueWindow: model().dialogueWindow,
    };
    const ctx = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: model,
      getDialogueScrollRows: () => readRows,
      resolveDialogueScrollRows: () => rowsAfter,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
        if (viewState.dialogueWindow?.messageIds.includes(2)) {
          readRows = rowsAfter;
        }
      },
    };

    await loadOlderCliShellDialogueMessages(ctx);

    expect(harness.roomPageCalls).toEqual([{ chatId: "room-shell-1", before, limit: 50 }]);
    expect(viewState.dialogueWindow?.messageIds).toEqual([2, 3, 4, 5, 6]);
    expect(viewState.dialogueScrollTop).toBe(7);
  });

  test("Scenario: Given older messages are prepended When anchor is restored Then the first visible message keeps its visual row", () => {
    const window = createCliShellDialogueMessageWindowFromSnapshot({
      channel: createRoomEntry("room-shell-1"),
      items: [4, 5, 6].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message ${messageId}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + messageId * 60_000,
        }),
      ),
      nextBefore: { beforeTimeMs: 1_714_560_000_000, beforeId: 4 },
      hasMoreBefore: true,
      headVersion: "1",
    });
    const rowsBefore = window.messageIds.map((messageId) => ({ key: `message:${messageId}`, height: 2 }));
    const anchor = captureCliShellDialogueAnchor({
      rows: rowsBefore,
      scrollTop: 3,
    });

    prependCliShellDialogueMessagePage(window, {
      items: [2, 3].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:user",
          from: "you",
          content: `older ${messageId}`,
          createdAt: Date.parse("2026-05-08T09:00:00+08:00") + messageId * 60_000,
        }),
      ),
      nextBefore: null,
      hasMore: false,
    });
    const rowsAfter = window.messageIds.map((messageId) => ({ key: `message:${messageId}`, height: 2 }));

    expect(restoreCliShellDialogueAnchorScrollTop({ rows: rowsAfter, anchor })).toBe(7);
    expect(
      restoreCliShellDialoguePrependScrollTop({
        rowsBefore,
        rowsAfter,
        anchor,
        previousScrollTop: 3,
      }),
    ).toBe(7);
  });

  test("Scenario: Given Chat is pinned or scrolled up When new messages arrive Then pinned follows latest and scrolled-up preserves anchor", () => {
    const baseSnapshot = {
      channel: createRoomEntry("room-shell-1"),
      items: [1, 2].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message ${messageId}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + messageId * 60_000,
        }),
      ),
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "1",
    };
    const pinned = createCliShellDialogueMessageWindowFromSnapshot(baseSnapshot);
    const scrolled = {
      ...createCliShellDialogueMessageWindowFromSnapshot(baseSnapshot),
      pinnedToBottom: false,
      pendingNewMessageCount: 0,
      anchor: { key: "message:1", offset: 0 },
    };
    const incoming = createRoomMessage({
      messageId: 3,
      senderActorId: "auth:user",
      from: "you",
      content: "new",
      createdAt: Date.parse("2026-05-08T10:03:00+08:00"),
    });

    mergeCliShellDialogueIncomingMessages(pinned, [incoming]);
    mergeCliShellDialogueIncomingMessages(scrolled, [incoming]);

    expect(pinned.pinnedToBottom).toBe(true);
    expect(pinned.pendingNewMessageCount).toBe(0);
    expect(scrolled.anchor).toEqual({ key: "message:1", offset: 0 });
    expect(scrolled.pendingNewMessageCount).toBe(1);
  });

  test("Scenario: Given Chat is bottom-pinned When the model rebuilds after new room messages Then it remains pinned to the latest content", () => {
    const initialState = createRuntimeState({
      heartbeat: [],
      lines: ["shell"],
      roomMessages: [1, 2].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message ${messageId}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + messageId * 60_000,
        }),
      ),
      unread: 0,
    });
    const keybindings = resolveCliShellTuiKeybindings(null);
    const initialModel = buildCliShellTuiModel({
      state: initialState,
      projection: { roomSnapshot: initialState.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "dialogue",
        requestedPlacement: "right",
        dialogueDraft: "",
        dialogueScrollTop: Number.MAX_SAFE_INTEGER,
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings,
      width: 120,
      height: 40,
    });
    const nextState = createRuntimeState({
      heartbeat: [],
      lines: ["shell"],
      roomMessages: [1, 2, 3].map((messageId) =>
        createRoomMessage({
          messageId,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `message ${messageId}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + messageId * 60_000,
        }),
      ),
      unread: 0,
    });

    const nextModel = buildCliShellTuiModel({
      state: nextState,
      projection: { roomSnapshot: nextState.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "dialogue",
        requestedPlacement: "right",
        dialogueDraft: "",
        dialogueScrollTop: initialModel.dialogueScroll.scrollTop,
        dialogueWindow: initialModel.dialogueWindow,
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings,
      width: 120,
      height: 40,
    });

    expect(initialModel.dialogueWindow.pinnedToBottom).toBe(true);
    expect(nextModel.dialogueWindow.pinnedToBottom).toBe(true);
    expect(nextModel.dialogueScroll.pinnedToBottom).toBe(true);
    expect(nextModel.dialogueScroll.pendingNewMessageCount).toBe(0);
    expect(nextModel.dialogueWindow.messageIds).toEqual([1, 2, 3]);
  });

  test("Scenario: Given ScrollBox metrics When semantic edges are resolved Then near-top loading and bottom-pinned state come from host viewport facts", () => {
    expect(
      resolveCliShellDialogueScrollMetrics({
        scrollTop: 1,
        viewportHeight: 10,
        scrollHeight: 100,
        edgeThresholdRows: 2,
      }),
    ).toMatchObject({
      nearTop: true,
      pinnedToBottom: false,
    });
    expect(
      resolveCliShellDialogueScrollMetrics({
        scrollTop: 90,
        viewportHeight: 10,
        scrollHeight: 100,
        edgeThresholdRows: 2,
      }),
    ).toMatchObject({
      nearTop: false,
      pinnedToBottom: true,
    });
  });

  test("Scenario: Given backend interaction recommendations When cli-shell resolves profiles Then every supported backend has explicit enhancement decisions", () => {
    expect(CLI_SHELL_BACKEND_INTERACTION_RECOMMENDATIONS.xterm).toEqual({
      semanticWordSelection: true,
      semanticRowSelection: true,
      wordNavigation: true,
      followCursorOnInput: true,
      homeEndFallback: true,
    });
    expect(CLI_SHELL_BACKEND_INTERACTION_RECOMMENDATIONS["ghostty-native"]).toEqual({
      semanticWordSelection: true,
      semanticRowSelection: true,
      wordNavigation: true,
      followCursorOnInput: true,
      homeEndFallback: true,
    });
    expect(resolveCliShellInteractionEnhancementProfile(undefined)).toEqual({
      semanticWordSelection: true,
      semanticRowSelection: true,
      wordNavigation: true,
      followCursorOnInput: true,
      homeEndFallback: true,
    });
  });

  test("Scenario: Given terminal word navigation helper When CJK ASCII and punctuation are segmented Then selection and word navigation share ICU boundaries", () => {
    const line = "$ echo 你好world ok";
    const cjkWord = findWordInTerminal(line, line.indexOf("你"));
    expect(cjkWord?.word).toBe("你好");
    expect(findPreviousTerminalWordBoundary(line, line.indexOf("ok"))).toBe(line.indexOf("world"));
    expect(findNextTerminalWordBoundary(line, line.indexOf("你"))).toBe(line.indexOf("你") + "你好".length);

    expect(terminalColumnToStringIndex("你a", 0)).toBe(0);
    expect(terminalColumnToStringIndex("你a", 2)).toBe("你".length);
    expect(stringIndexToTerminalColumn("你a", "你".length)).toBe(2);
  });

  test("Scenario: Given supported terminal keys When encoding shell input Then native Home End sequences are preferred and fallback stays explicit", () => {
    const cases: Array<{ key: Parameters<typeof createTestKeyEvent>[0]; expected: string | null }> = [
      { key: { name: "x", sequence: "x", raw: "x" }, expected: "x" },
      { key: { name: "return" }, expected: "\r" },
      { key: { name: "linefeed" }, expected: "\n" },
      { key: { name: "backspace" }, expected: "\u007f" },
      { key: { name: "tab" }, expected: "\t" },
      { key: { name: "space" }, expected: " " },
      { key: { name: "escape" }, expected: "\u001b" },
      { key: { name: "up" }, expected: "\u001b[A" },
      { key: { name: "down" }, expected: "\u001b[B" },
      { key: { name: "right" }, expected: "\u001b[C" },
      { key: { name: "left" }, expected: "\u001b[D" },
      { key: { name: "delete" }, expected: "\u001b[3~" },
      { key: { name: "pageup" }, expected: "\u001b[5~" },
      { key: { name: "pagedown" }, expected: "\u001b[6~" },
      { key: { name: "a", ctrl: true }, expected: "\x01" },
    ];

    for (const item of cases) {
      expect(encodeCliShellTerminalKey(createTestKeyEvent(item.key))).toBe(item.expected);
    }
    expect(encodeCliShellTerminalKey(createTestKeyEvent({ name: "home", sequence: "\u001b[1~" }))).toBe("\u001b[1~");
    expect(encodeCliShellTerminalKey(createTestKeyEvent({ name: "end", sequence: "\u001b[4~" }))).toBe("\u001b[4~");
    expect(encodeCliShellTerminalKey(createTestKeyEvent({ name: "home" }))).toBe("\x01");
    expect(encodeCliShellTerminalKey(createTestKeyEvent({ name: "end" }))).toBe("\x05");
    expect(encodeCliShellTerminalKey(createTestKeyEvent({ name: "home" }), { homeEndFallback: false })).toBeNull();
    expect(encodeCliShellTerminalKey(createTestKeyEvent({ name: "f13" }))).toBeNull();
  });

  test("Scenario: Given debug mode is enabled When the debug bar formats frame timing Then the line separates paint cost from frame gap facts", () => {
    const line = formatCliShellDebugBarLine(
      {
        dirtyAgoMs: 1200,
        pullMs: 18,
        patch: "rows:4",
        frameBytes: 16_384,
        diffBytes: 512,
        applyMs: 3,
        renderMs: 16,
        frameGapMs: 120,
        fps: 61,
        dirtyQueue: 1,
        pullQueue: 0,
        renderQueue: 2,
        skippedFrames: 3,
        paintCells: "10r/12s/240g",
        viewport: "20-40/80",
        frameSource: "terminal-2-composed",
        mode: "active",
      },
      260,
    );

    expect(line).toContain("dirty 1200ms");
    expect(line).toContain("pull 18ms");
    expect(line).toContain("patch rows:4");
    expect(line).toContain("bytes f16.0kb/d512b");
    expect(line).toContain("paint 16ms");
    expect(line).toContain("gap 120ms");
    expect(line).toContain("q d1/p0/r2");
    expect(line).toContain("skip 3");
    expect(line).toContain("cells 10r/12s/240g");
    expect(line).toContain("src terminal-2-composed");
    expect(line).toContain("vp 20-40/80");
    expect(line).toContain("mode active");
  });

  test("Scenario: Given shell-terminal-view receives one projection update When content and selection bounds change together Then it repaints the backend canvas once", async () => {
    let paintCalls = 0;
    class CountingBackendFrameRenderable extends BackendFrameRenderable {
      protected override paintBackendFrame() {
        paintCalls += 1;
        return super.paintBackendFrame();
      }
    }
    const setup = await createTestRenderer({
      width: 20,
      height: 3,
      useMouse: true,
      exitOnCtrlC: false,
    });
    const view = new CountingBackendFrameRenderable(setup.renderer, {
      width: 20,
      height: 3,
      lines: [{ spans: [{ text: "old" }] }],
    });
    setup.renderer.root.add(view);
    paintCalls = 0;

    const stats = view.updateProjection({
      lines: [{ spans: [{ text: "new line" }] }, { spans: [{ text: "dialogue" }] }],
      selectionRegion: { x: 0, y: 0, width: 8, height: 2 },
      selectionRegions: [
        { owner: "terminal", row: 0, col: 0, width: 8, height: 2 },
        { owner: "dialogue", row: 0, col: 10, width: 8, height: 2 },
      ],
    });

    expect(paintCalls).toBe(1);
    expect(stats.rows).toBe(2);
    expect(stats.spans).toBe(2);
    expect(stats.glyphs).toBe("new line".length + "dialogue".length);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("new line");
    setup.renderer.destroy();
  });

  test("Scenario: Given shell-terminal-view rich spans When rendered through OpenTUI core Then shell body stays cell-locked without host text-flow re-layout", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 8,
      height: 2,
      lines: [
        {
          spans: [
            { text: "$ ", fg: "#00ff00" },
            { text: "ls", fg: "#ffffff", bg: "#333333", bold: true },
          ],
        },
        {
          spans: [{ text: "█", fg: "#111111", bg: "#f3f6fb" }],
        },
      ],
    });

    await setup.renderOnce();
    const captured = setup.captureSpans();
    expect(captured.lines[0]?.spans.map((span) => span.text)).toEqual(["$ ", "ls", "    "]);
    expect(captured.lines[0]?.spans[0]?.fg.toString()).toBe("rgba(0.00, 1.00, 0.00, 1.00)");
    expect(captured.lines[0]?.spans[1]?.bg.toString()).toBe("rgba(0.20, 0.20, 0.20, 1.00)");
    expect(captured.lines[1]?.spans[0]?.text).toBe("█");
    setup.renderer.destroy();
  });

  test("Scenario: Given shell-terminal-view receives a pending terminal permission request When rendered Then the default TopLayer overlay stays above terminal cells", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 72,
      height: 12,
      terminalId: "shell-1",
      lines: [
        { spans: [{ text: "$ pnpm test" }] },
        { spans: [{ text: "terminal output remains visible behind approval" }] },
      ],
      permissionRequests: [
        createTerminalPermissionRequest({
          requestId: "approval-overlay",
          terminalId: "shell-1",
          requestedInput: { mode: "raw", text: "pnpm test -- --runInBand" },
        }),
      ],
    });

    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Terminal write approval");
    expect(frame).toContain("auth:shell-assistant requests raw access");
    expect(frame).toContain("pnpm test -- --runInBand");
    expect(frame).toContain("[ Deny ]");
    expect(frame).toContain("[ Approve ]");
    setup.renderer.destroy();
  });

  test("Scenario: Given a host handles shell terminal permission requests When the callback returns true Then the default TopLayer overlay is suppressed", async () => {
    const handledRequests: string[] = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 72,
      height: 12,
      terminalId: "shell-1",
      lines: [{ spans: [{ text: "$ pnpm test" }] }],
      permissionRequests: [
        createTerminalPermissionRequest({
          requestId: "approval-custom",
          terminalId: "shell-1",
        }),
      ],
      onRequestPermissions: (detail) => {
        handledRequests.push(detail.request.requestId);
        return true;
      },
    });

    await setup.renderOnce();
    expect(handledRequests).toEqual(["approval-custom"]);
    expect(setup.captureCharFrame()).not.toContain("Terminal write approval");
    setup.renderer.destroy();
  });

  test("Scenario: Given an equivalent shell terminal permission request is refreshed When projection updates Then one overlay is updated instead of duplicated", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 72,
      height: 12,
      terminalId: "shell-1",
      lines: [{ spans: [{ text: "$ pnpm test" }] }],
      permissionRequests: [
        createTerminalPermissionRequest({
          requestId: "approval-refresh",
          terminalId: "shell-1",
          requestedInput: { mode: "raw", text: "echo old" },
        }),
      ],
    });

    await setup.renderOnce();
    setup.view.updateProjection({
      permissionRequests: [
        createTerminalPermissionRequest({
          requestId: "approval-refresh",
          terminalId: "shell-1",
          requestedInput: { mode: "raw", text: "echo refreshed" },
          expiresAt: 1_714_560_120_000,
        }),
      ],
    });
    await setup.renderOnce();

    const frame = setup.captureCharFrame();
    expect(frame.match(/Terminal write approval/g)?.length).toBe(1);
    expect(frame).toContain("echo refreshed");
    expect(frame).not.toContain("echo old");
    setup.renderer.destroy();
  });

  test("Scenario: Given CliShellCoreApp debug mode is enabled When the product renders Then the debug bar owns the top row and shell projection starts below it", async () => {
    const previousTraceEnv = process.env.AGENTER_CLI_SHELL_TRACE;
    const tracePath = `/tmp/agenter-cli-shell-debug-bar-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`;
    process.env.AGENTER_CLI_SHELL_TRACE = tracePath;
    try {
      const shellLines = ["debug-shell-row", "shell-1:~/project $"];
      const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
      const harness = createTuiStore({ state });
      const setup = await createCoreAppTestSetup({ state, harness, width: 80, height: 12, debug: true });

      await setup.renderOnce();
      const rows = setup.captureCharFrame().split("\n");
      expect(rows[0]).toContain("dirty");
      expect(rows[0]).toContain("pull");
      expect(rows[1]).toContain("debug-shell-row");
      setup.destroy();
    } finally {
      if (previousTraceEnv === undefined) {
        delete process.env.AGENTER_CLI_SHELL_TRACE;
      } else {
        process.env.AGENTER_CLI_SHELL_TRACE = previousTraceEnv;
      }
      await Bun.file(tracePath)
        .delete()
        .catch(() => undefined);
    }
  });

  test("Scenario: Given CliShellCoreApp debug mode is disabled When the product renders Then shell projection keeps the top row without the debug bar", async () => {
    const shellLines = ["normal-shell-row", "shell-1:~/project $"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({ state, harness, width: 80, height: 12 });

    await setup.renderOnce();
    const rows = setup.captureCharFrame().split("\n");
    expect(rows[0]).toContain("normal-shell-row");
    expect(rows[0]).not.toContain("dirty");
    setup.destroy();
  });

  test("Scenario: Given cli-shell native host observes a terminal-scoped permission request When the overlay approves it Then TerminalSystem authority is called without mutating managed state", async () => {
    const shellLines = ["$ pnpm test", "shell-1:~/project $"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const pendingRequest = createTerminalPermissionRequest({
      requestId: "approval-native-approve",
      terminalId: "shell-1",
      requestedInput: { mode: "raw", text: "pnpm test" },
    });
    state.globalTerminalApprovalsById = {
      "shell-1": createCached([pendingRequest]),
    };
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({ state, harness, width: 80, height: 14 });

    await setup.renderOnce();
    expect(harness.retainedPermissionRequestStreams).toEqual([{ terminalId: "shell-1", released: false }]);
    expect(setup.captureCharFrame()).toContain("Terminal write approval");
    await setup.mockMouse.click(58, 8);
    await setup.renderOnce();

    expect(harness.approvedRequests).toEqual([
      {
        terminalId: "shell-1",
        requestId: "approval-native-approve",
        durationMs: 30 * 60 * 1000,
      },
    ]);
    expect(harness.deniedRequests).toEqual([]);
    expect(setup.captureCharFrame()).not.toContain("Terminal write approval");
    expect(harness.store.getState().globalTerminalApprovalsById["shell-1"]?.data).toEqual([]);
    setup.destroy();
    expect(harness.retainedPermissionRequestStreams[0]?.released).toBe(true);
  });

  test("Scenario: Given cli-shell managed state is active When a native permission overlay is denied Then only TerminalSystem denial runs and hosting attention is unchanged", async () => {
    const shellLines = ["$ cargo run", "shell-1:~/project $"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    state.globalTerminalApprovalsById = {
      "shell-1": createCached([
        createTerminalPermissionRequest({
          requestId: "approval-native-deny",
          terminalId: "shell-1",
          requestedInput: { mode: "raw", text: "cargo run" },
        }),
      ]),
    };
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      width: 80,
      height: 14,
      managed: createManagedState({ managed: true }),
    });

    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("Terminal write approval");
    await setup.mockMouse.click(47, 8);
    await setup.renderOnce();

    expect(harness.deniedRequests).toEqual([
      {
        terminalId: "shell-1",
        requestId: "approval-native-deny",
      },
    ]);
    expect(harness.approvedRequests).toEqual([]);
    expect(setup.captureCharFrame()).not.toContain("Terminal write approval");
    setup.destroy();
  });

  test("Scenario: Given a guard request appears on another terminal When native cli-shell renders Then it keeps the visible surface bound to the current opened terminal only", async () => {
    const shellLines = ["$ pnpm test", "shell-1:~/project $"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    state.globalTerminalApprovalsById = {
      "shell-1": createCached([]),
      "shell-1:hidden": createCached([
        createTerminalPermissionRequest({
          requestId: "approval-hidden",
          terminalId: "shell-1:hidden",
          requestedInput: { mode: "raw", text: "pnpm test" },
        }),
      ]),
    };
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({ state, harness, width: 80, height: 14 });

    await setup.renderOnce();

    expect(harness.retainedPermissionRequestStreams).toEqual([{ terminalId: "shell-1", released: false }]);
    expect(setup.captureCharFrame()).not.toContain("Terminal write approval");
    setup.destroy();
  });

  test("Scenario: Given composed terminal has no live transport When CliShellCoreApp renders repeatedly Then mirror lifecycle does not schedule self-feeding terminal revisions", async () => {
    const previousTraceEnv = process.env.AGENTER_CLI_SHELL_TRACE;
    const tracePath = `/tmp/agenter-cli-shell-no-transport-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`;
    process.env.AGENTER_CLI_SHELL_TRACE = tracePath;
    try {
      const shellEntry = withoutTransportUrl(createGlobalTerminalEntry("shell-1:terminal-1", ["shell source"]));
      const visibleEntry = withoutTransportUrl(
        createCliShellTerminal2Entry({
          terminalId: "shell-1:terminal-2",
          shellTerminalId: "shell-1:terminal-1",
          lines: ["composed product"],
          cols: 80,
          rows: 12,
        }),
      );
      const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
      state.globalTerminals = createCached([shellEntry, visibleEntry]);
      const harness = createTuiStore({ state });
      const setup = await createCoreAppTestSetup({
        state,
        harness,
        fallbackTerminalId: "shell-1:terminal-2",
        width: 80,
        height: 12,
      });

      await setup.renderOnce();
      await setup.renderOnce();
      await setup.renderOnce();
      setup.destroy();

      const lines = (await Bun.file(tracePath).text()).trim().split("\n").filter(Boolean);
      const events = lines.map((line) => JSON.parse(line) as { kind: string; detail?: { reason?: string } });
      const liveRevisionStarts = events.filter(
        (event) => event.kind === "render-now-started" && event.detail?.reason === "live-terminal-revision",
      );
      expect(liveRevisionStarts.length).toBeLessThanOrEqual(1);
    } finally {
      if (previousTraceEnv === undefined) {
        delete process.env.AGENTER_CLI_SHELL_TRACE;
      } else {
        process.env.AGENTER_CLI_SHELL_TRACE = previousTraceEnv;
      }
      await Bun.file(tracePath)
        .delete()
        .catch(() => undefined);
    }
  });

  test("Scenario: Given shell-terminal-view projected cells When the user drags across terminal text Then projection sends selection lifecycle to the backend owner", async () => {
    const selectionEvents: Array<{ type: string; ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 3,
      lines: [
        { spans: [{ text: "$ echo hello" }] },
        { spans: [{ text: "你好 emoji 🙂 ok" }] },
        { spans: [{ text: "shell prompt" }] },
      ],
      onSelectionStart: (point) => {
        selectionEvents.push({ type: "start", ...point });
        return true;
      },
      onSelectionUpdate: (point) => {
        selectionEvents.push({ type: "update", ...point });
        return true;
      },
      onSelectionEnd: (point) => {
        selectionEvents.push({ type: "end", ...point });
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.drag(0, 0, 7, 1);
    await setup.renderOnce();
    expect(selectionEvents[0]).toEqual({ type: "start", ownerId: "terminal", row: 0, col: 0 });
    expect(selectionEvents.some((event) => event.type === "update" && event.ownerId === "terminal")).toBe(true);
    expect(selectionEvents.at(-1)).toEqual({ type: "end", ownerId: "terminal", row: 1, col: 7 });
    expect(setup.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
    setup.renderer.destroy();
  });

  test("Scenario: Given shell-terminal-view renders wide glyphs When selection highlights Chinese cells Then glyph width stays two cells and foreground color is not rewritten", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 10,
      height: 1,
      lines: [{ spans: [{ text: "你a", fg: "#00ff00", bg: "#111111" }] }],
    });

    await setup.renderOnce();
    let spans = setup.captureSpans().lines[0]?.spans ?? [];
    expect(
      spans
        .map((span) => span.text)
        .join("")
        .replace(/\s+/g, ""),
    ).toContain("你a");
    expect(spans.find((span) => span.text.includes("你a"))?.width).toBe(3);
    expect(measureTerminalText("你a")).toBe(3);

    setup.view.updateProjection({
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-adapter-owned",
          rows: [{ row: 0, startCol: 0, endCol: 2 }],
        },
      ],
    });
    await setup.renderOnce();
    spans = setup.captureSpans().lines[0]?.spans ?? [];
    const selectedSpan = spans.find((span) => span.text.includes("你"));
    expect(selectedSpan?.fg.toString()).toBe("rgba(0.00, 1.00, 0.00, 1.00)");
    setup.renderer.destroy();
  });

  test("Scenario: Given shell-terminal-view projected cells When the user only clicks terminal text Then native selection stays empty until a real drag happens", async () => {
    const selectionEvents: Array<{ type: string; ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 2,
      lines: [{ spans: [{ text: "$ echo hello" }] }, { spans: [{ text: "shell prompt" }] }],
      onSelectionStart: (point) => {
        selectionEvents.push({ type: "start", ...point });
        return true;
      },
      onSelectionUpdate: (point) => {
        selectionEvents.push({ type: "update", ...point });
        return true;
      },
      onSelectionEnd: (point) => {
        selectionEvents.push({ type: "end", ...point });
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.click(2, 0);
    await setup.renderOnce();
    expect(selectionEvents).toEqual([]);
    expect(setup.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
    setup.renderer.destroy();
  });

  test("Scenario: Given native renderable mouse events When the user drags terminal text Then shell-terminal-view bridges selection to the backend owner", async () => {
    const selectionEvents: Array<{ type: string; ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 2,
      lines: [{ spans: [{ text: "$ echo hello" }] }, { spans: [{ text: "shell prompt" }] }],
      onSelectionStart: (point) => {
        selectionEvents.push({ type: "start", ...point });
        return true;
      },
      onSelectionUpdate: (point) => {
        selectionEvents.push({ type: "update", ...point });
        return true;
      },
      onSelectionEnd: (point) => {
        selectionEvents.push({ type: "end", ...point });
        return true;
      },
    });

    await setup.renderOnce();
    dispatchRenderableMouseEvent(setup.view, { type: "down", x: 1, y: 0 });
    dispatchRenderableMouseEvent(setup.view, { type: "drag", x: 7, y: 0 });
    dispatchRenderableMouseEvent(setup.view, { type: "drag-end", x: 7, y: 0 });
    dispatchRenderableMouseEvent(setup.view, { type: "up", x: 7, y: 0 });

    expect(selectionEvents).toEqual([
      { type: "start", ownerId: "terminal", row: 0, col: 1 },
      { type: "update", ownerId: "terminal", row: 0, col: 7 },
      { type: "end", ownerId: "terminal", row: 0, col: 7 },
    ]);
    expect(setup.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
    setup.renderer.destroy();
  });

  test("Scenario: Given shell-terminal-view projected cells When the user double-clicks mixed CJK ASCII text Then projection asks the backend owner for word selection", async () => {
    const semanticPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 40,
      height: 2,
      lines: [{ spans: [{ text: "$ echo 你好world ok" }] }, { spans: [{ text: "shell prompt" }] }],
      onSelectWordAt: (point) => {
        semanticPoints.push(point);
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.doubleClick(9, 0);
    await setup.renderOnce();

    expect(semanticPoints).toEqual([{ ownerId: "terminal", row: 0, col: 9 }]);
    expect(setup.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
    setup.renderer.destroy();
  });

  test("Scenario: Given semantic click drift exceeds configured cell distance When the user clicks twice Then word selection cluster resets", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 40,
      height: 2,
      semanticClickMaxDistanceCells: 1,
      lines: [{ spans: [{ text: "$ echo hello world" }] }, { spans: [{ text: "shell prompt" }] }],
    });

    await setup.renderOnce();
    await setup.mockMouse.click(2, 0);
    await setup.mockMouse.click(5, 0);
    await setup.renderOnce();

    expect(setup.view.hasSelection()).toBe(false);
    setup.renderer.destroy();
  });

  test("Scenario: Given OpenTUI reports a double click after cursor drift When adjacent clicks exceed cell distance Then semantic word selection resets", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 40,
      height: 2,
      semanticClickMaxDistanceCells: 1,
      lines: [{ spans: [{ text: "$ echo hello world" }] }, { spans: [{ text: "shell prompt" }] }],
    });

    await setup.renderOnce();
    await setup.view.onMouseDown?.({
      x: 2,
      y: 0,
      button: 0,
      preventDefault() {},
    } as never);
    await setup.view.onMouseDown?.({
      x: 5,
      y: 0,
      button: 0,
      clickCount: 2,
      preventDefault() {},
    } as never);
    await setup.renderOnce();

    expect(setup.view.hasSelection()).toBe(false);
    setup.renderer.destroy();
  });

  test("Scenario: Given selection is anchored to backend rows When the viewport scrolls Then highlight follows content instead of the screen row", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 2,
      selectionRegions: [{ owner: "terminal", row: 0, col: 0, width: 20, height: 2 }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 10,
          lines: [{ spans: [{ text: "line-10" }] }, { spans: [{ text: "line-11" }] }],
        },
      ],
      lines: [{ spans: [{ text: "line-10" }] }, { spans: [{ text: "line-11" }] }],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-adapter-owned",
          rows: [{ row: 11, startCol: 0, endCol: 4 }],
        },
      ],
    });

    await setup.renderOnce();

    setup.view.updateProjection({
      lines: [{ spans: [{ text: "line-11" }] }, { spans: [{ text: "line-12" }] }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 11,
          lines: [{ spans: [{ text: "line-11" }] }, { spans: [{ text: "line-12" }] }],
        },
      ],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-adapter-owned",
          rows: [{ row: 11, startCol: 0, endCol: 4 }],
        },
      ],
    });
    await setup.renderOnce();
    const selectedCells = setup
      .captureSpans()
      .lines.flatMap((line, row) =>
        line.spans
          .filter((span) => span.bg.toString() === "rgba(0.15, 0.39, 0.92, 1.00)")
          .map((span) => ({ row, text: span.text })),
      );
    expect(selectedCells.some((cell) => cell.row === 0 && cell.text.includes("line"))).toBe(true);
    expect(selectedCells.some((cell) => cell.row === 1 && cell.text.includes("line"))).toBe(false);
    expect(setup.view.getSelectionOwner()).toBe("terminal");
    setup.renderer.destroy();
  });

  test("Scenario: Given drag selection is anchored to backend rows When the viewport scrolls Then the selected range follows the selected content", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 2,
      selectionRegions: [{ owner: "terminal", row: 0, col: 0, width: 20, height: 2 }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 10,
          lines: [{ spans: [{ text: "line-10" }] }, { spans: [{ text: "line-11" }] }],
        },
      ],
      lines: [{ spans: [{ text: "line-10" }] }, { spans: [{ text: "line-11" }] }],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-adapter-owned",
          rows: [{ row: 11, startCol: 0, endCol: 7 }],
        },
      ],
    });

    await setup.renderOnce();

    setup.view.updateProjection({
      lines: [{ spans: [{ text: "line-11" }] }, { spans: [{ text: "line-12" }] }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 11,
          lines: [{ spans: [{ text: "line-11" }] }, { spans: [{ text: "line-12" }] }],
        },
      ],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-adapter-owned",
          rows: [{ row: 11, startCol: 0, endCol: 7 }],
        },
      ],
    });
    await setup.renderOnce();
    const selectedCells = setup
      .captureSpans()
      .lines.flatMap((line, row) =>
        line.spans
          .filter((span) => span.bg.toString() === "rgba(0.15, 0.39, 0.92, 1.00)")
          .map((span) => ({ row, text: span.text })),
      );
    expect(selectedCells.some((cell) => cell.row === 0 && cell.text.includes("line-11"))).toBe(true);
    expect(selectedCells.some((cell) => cell.row === 1 && cell.text.includes("line-12"))).toBe(false);
    expect(setup.view.getSelectionOwner()).toBe("terminal");
    setup.renderer.destroy();
  });

  test("Scenario: Given selected backend text is visible after a scroll round trip When projection updates Then the same content remains highlighted", async () => {
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 2,
      selectionRegions: [{ owner: "terminal", row: 0, col: 0, width: 20, height: 2 }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 2,
          lines: [{ spans: [{ text: "line-2" }] }, { spans: [{ text: "line-3" }] }],
        },
      ],
      lines: [{ spans: [{ text: "line-2" }] }, { spans: [{ text: "line-3" }] }],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-native",
          rows: [{ row: 3, startCol: 0, endCol: 6 }],
          selectedText: "line-3",
        },
      ],
    });

    await setup.renderOnce();
    expect(selectedSpanCells(setup)).toContainEqual({ row: 1, text: "line-3" });

    setup.view.updateProjection({
      lines: [{ spans: [{ text: "line-0" }] }, { spans: [{ text: "line-1" }] }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 0,
          lines: [{ spans: [{ text: "line-0" }] }, { spans: [{ text: "line-1" }] }],
        },
      ],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-native",
          rows: [{ row: 3, startCol: 0, endCol: 6 }],
          selectedText: "line-3",
        },
      ],
    });
    await setup.renderOnce();
    expect(selectedSpanCells(setup)).toEqual([]);

    setup.view.updateProjection({
      lines: [{ spans: [{ text: "line-2" }] }, { spans: [{ text: "line-3" }] }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 2,
          lines: [{ spans: [{ text: "line-2" }] }, { spans: [{ text: "line-3" }] }],
        },
      ],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-native",
          rows: [{ row: 3, startCol: 0, endCol: 6 }],
          selectedText: "line-3",
        },
      ],
    });
    await setup.renderOnce();
    expect(selectedSpanCells(setup)).toContainEqual({ row: 1, text: "line-3" });
    expect(setup.view.getSelectionOwner()).toBe("terminal");
    setup.renderer.destroy();
  });

  test("Scenario: Given backend selection is active When the user single-clicks without dragging Then shell-terminal-view requests backend clear selection", async () => {
    const traces: BackendFrameInteractionTraceEvent[] = [];
    const clearRequests: Array<{ ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 2,
      selectionRegions: [{ owner: "terminal", row: 0, col: 0, width: 20, height: 2 }],
      selectionSources: [
        {
          owner: "terminal",
          row: 0,
          col: 0,
          width: 20,
          height: 2,
          sourceStartRow: 0,
          lines: [{ spans: [{ text: "line-0" }] }, { spans: [{ text: "line-1" }] }],
        },
      ],
      lines: [{ spans: [{ text: "line-0" }] }, { spans: [{ text: "line-1" }] }],
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-native",
          rows: [{ row: 0, startCol: 0, endCol: 6 }],
        },
      ],
      onInteractionTrace: (event) => traces.push(event),
      onClearSelection: (point) => {
        clearRequests.push(point);
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.click(3, 0);
    await setup.renderOnce();

    expect(traces).toContainEqual({
      kind: "selection-clear-requested",
      detail: {
        eventType: "up",
        button: 0,
        x: 3,
        y: 0,
        ownerId: "terminal",
        row: 0,
        col: 3,
      },
    });
    expect(clearRequests).toEqual([{ ownerId: "terminal", row: 0, col: 3 }]);
    setup.renderer.destroy();
  });

  test("Scenario: Given backend selection is active in cli-shell When the user single-clicks without dragging Then cli-shell forwards clearSelection to the backend owner", async () => {
    const shellLines = ["row-0", "row-1", "row-2"];
    const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
    const shellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        rows: 3,
        cols: 20,
        cursor: { x: 0, y: 2, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: shellLines.length,
          screenLines: 3,
        },
        interaction: {
          activeOwnerId: "terminal",
          selectionOverlays: [
            {
              ownerId: "terminal",
              ownership: "backend-native",
              rows: [{ row: 1, startCol: 0, endCol: 5 }],
              selectedText: "row-1",
            },
          ],
        },
      },
    };
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      terminalId: "shell-1:terminal-2",
      shellTerminalId: "shell-1:terminal-1",
      lines: ["product"],
      cols: 20,
      rows: 4,
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 20,
      height: 4,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();
    expect(selectedSpanCells(setup)).toContainEqual({ row: 1, text: "row-1" });
    await setup.mockMouse.click(3, 1);
    await setup.renderOnce();

    expect(sentMessages).toContainEqual({ type: "clearSelection", ownerId: "terminal" });
    setup.destroy();
  });

  test("Scenario: Given shell viewport is scrolled When the user drags visible rows Then backend selection receives absolute scrollback rows", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["row-0", "row-1", "row-2", "row-3", "row-4"],
      roomMessages: [],
      unread: 0,
    });
    const viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const model = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 20,
      height: 3,
    });
    const scrolledModel = {
      ...model,
      terminalView: {
        ...model.terminalView,
        richLines: model.terminalView.richLines.slice(2, 5),
        plainLines: model.terminalView.plainLines.slice(2, 5),
        viewportStart: 2,
        viewportEnd: 5,
        scrollbackRows: 5,
        rows: 3,
      },
    };
    const frame = layoutCliShellTuiFrame({
      model: scrolledModel,
      width: 20,
      height: 3,
      renderToolbar: false,
    });
    const selectionEvents: Array<{ type: string; ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 3,
      lines: frame.styledLines,
      selectionRegions: [{ owner: "terminal", row: 0, col: 0, width: 20, height: 3 }],
      selectionSources: frame.selectionSources,
      onSelectionStart: (point) => {
        selectionEvents.push({ type: "start", ...point });
        return true;
      },
      onSelectionUpdate: (point) => {
        selectionEvents.push({ type: "update", ...point });
        return true;
      },
      onSelectionEnd: (point) => {
        selectionEvents.push({ type: "end", ...point });
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.drag(0, 0, 4, 1);
    await setup.renderOnce();

    expect(selectionEvents[0]).toEqual({ type: "start", ownerId: "terminal", row: 2, col: 0 });
    expect(selectionEvents.at(-1)).toEqual({ type: "end", ownerId: "terminal", row: 3, col: 4 });
    setup.renderer.destroy();
  });

  test("Scenario: Given cli-shell displays a scrolled shell backend When the user drags visible terminal rows Then selection messages include the backend viewport offset", async () => {
    const shellLines = ["row-0", "row-1", "row-2", "row-3", "row-4"];
    const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
    const shellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        rows: 3,
        cols: 20,
        cursor: { x: 0, y: 4, visible: true },
        scrollback: {
          viewportOffset: 2,
          totalLines: shellLines.length,
          screenLines: 3,
        },
      },
    };
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      terminalId: "shell-1:terminal-2",
      shellTerminalId: "shell-1:terminal-1",
      lines: ["product"],
      cols: 20,
      rows: 4,
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 20,
      height: 4,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();
    await setup.mockMouse.drag(0, 0, 4, 1);
    await setup.renderOnce();

    expect(sentMessages).toContainEqual({ type: "selectionStart", point: { ownerId: "terminal", row: 2, col: 0 } });
    expect(sentMessages).toContainEqual({ type: "selectionEnd", point: { ownerId: "terminal", row: 3, col: 4 } });
    setup.destroy();
  });

  test("Scenario: Given terminal-2 publishes a scrolled composed shell frame When terminal-1 mirror is stale Then dragging visible shell text still uses terminal-2 selection source rows", async () => {
    const shellLines = ["row-0", "row-1", "row-2", "row-3", "row-4"];
    const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
    const staleShellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        seq: 2,
        rows: 3,
        cols: 20,
        cursor: { x: 0, y: 0, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: shellLines.length,
          screenLines: 3,
        },
      },
    };
    const publishedVisibleTerminalEntry: GlobalTerminalEntry = {
      ...createCliShellTerminal2Entry({
        terminalId: "shell-1:terminal-2",
        shellTerminalId: "shell-1:terminal-1",
        lines: ["row-2", "row-3", "row-4"],
        cols: 20,
        rows: 4,
        metadata: {
          composedBottomLine: "row-4",
          composedDialogueOpen: false,
          composedDialoguePlacement: null,
          composedDialogueDraft: "",
          composedManagedLabel: "托管 off",
          composedUnreadLabel: "✉ 0",
          composedHeartbeatLabel: "ready",
          composedShellSnapshotSeq: 10,
          composedSelectionSources: [
            {
              owner: "terminal",
              row: 0,
              col: 0,
              width: 19,
              height: 3,
              sourceStartRow: 2,
            },
          ],
        },
      }),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-2", ["row-2", "row-3", "row-4"]).snapshot!,
        seq: 3,
        cols: 20,
        rows: 4,
        lines: ["row-2", "row-3", "row-4", ""],
        richLines: ["row-2", "row-3", "row-4", ""].map((text) => ({ spans: text ? [{ text }] : [] })),
        cursor: { x: 0, y: 0, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: 4,
          screenLines: 4,
        },
      },
    };
    state.globalTerminals = createCached([staleShellTerminalEntry, publishedVisibleTerminalEntry]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const harness = createTuiStore({ state });
    harness.setPublishComposedSurfaceEnabled(false);
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 20,
      height: 4,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("row-2");
    await setup.mockMouse.drag(0, 0, 4, 1);
    await setup.renderOnce();

    expect(sentMessages).toContainEqual({ type: "selectionStart", point: { ownerId: "terminal", row: 2, col: 0 } });
    expect(sentMessages).toContainEqual({ type: "selectionEnd", point: { ownerId: "terminal", row: 3, col: 4 } });
    setup.destroy();
  });

  test("Scenario: Given debug bar shifts cli-shell content and shell viewport is scrolled When the user drags visible terminal rows Then backend selection still receives visible rows plus viewport offset", async () => {
    const shellLines = ["row-0", "row-1", "row-2", "row-3", "row-4"];
    const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
    const shellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        rows: 3,
        cols: 20,
        cursor: { x: 0, y: 4, visible: true },
        scrollback: {
          viewportOffset: 2,
          totalLines: shellLines.length,
          screenLines: 3,
        },
      },
    };
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      terminalId: "shell-1:terminal-2",
      shellTerminalId: "shell-1:terminal-1",
      lines: ["product"],
      cols: 20,
      rows: 3,
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 20,
      height: 4,
      debug: true,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();
    await setup.mockMouse.drag(0, 1, 4, 2);
    await setup.renderOnce();

    expect(sentMessages).toContainEqual({ type: "selectionStart", point: { ownerId: "terminal", row: 2, col: 0 } });
    expect(sentMessages).toContainEqual({ type: "selectionEnd", point: { ownerId: "terminal", row: 3, col: 4 } });
    setup.destroy();
  });

  test("Scenario: Given cli-shell displays a scrolled shell backend When backend selection overlay arrives Then highlight is projected onto the visible content row", async () => {
    const shellLines = ["row-0", "row-1", "row-2", "row-3", "row-4"];
    const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
    const shellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        seq: 10,
        rows: 3,
        cols: 20,
        cursor: { x: 0, y: 4, visible: true },
        scrollback: {
          viewportOffset: 2,
          totalLines: shellLines.length,
          screenLines: 3,
        },
      },
    };
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      terminalId: "shell-1:terminal-2",
      shellTerminalId: "shell-1:terminal-1",
      lines: ["product"],
      cols: 20,
      rows: 4,
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 20,
      height: 4,
      createTransportSession: ({ terminalId, events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
            if (terminalId === "shell-1:terminal-1") {
              events.onMessage({
                type: "frame",
                terminalId,
                frameSeq: 11,
                status: "IDLE",
                patch: {
                  type: "full",
                  frame: {
                    ...shellTerminalEntry.snapshot!,
                    seq: 11,
                    interaction: {
                      activeOwnerId: "terminal",
                      selectionOverlays: [
                        {
                          ownerId: "terminal",
                          ownership: "backend-adapter-owned",
                          rows: [{ row: 2, startCol: 0, endCol: 5 }],
                        },
                      ],
                    },
                  },
                },
              });
            }
          },
          disconnect() {},
          send() {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();

    const selectedCells = setup
      .captureSpans()
      .lines.flatMap((line, row) =>
        line.spans
          .filter((span) => span.bg.toString() === "rgba(0.15, 0.39, 0.92, 1.00)")
          .map((span) => ({ row, text: span.text })),
      );
    expect(selectedCells.some((cell) => cell.row === 0 && cell.text.includes("row-2"))).toBe(true);
    expect(selectedCells.some((cell) => cell.row === 2 && cell.text.includes("row-4"))).toBe(false);
    setup.destroy();
  });

  test("Scenario: Given backend selection changes without drawable text changes When a new frame arrives Then cli-shell still projects the selection truth", async () => {
    const shellLines = ["row-0", "row-1", "row-2"];
    const state = createRuntimeState({ heartbeat: [], lines: [], roomMessages: [], unread: 0 });
    const shellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        seq: 10,
        rows: 3,
        cols: 20,
        cursor: { x: 0, y: 2, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: shellLines.length,
          screenLines: 3,
        },
      },
    };
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      terminalId: "shell-1:terminal-2",
      shellTerminalId: "shell-1:terminal-1",
      lines: ["product"],
      cols: 20,
      rows: 4,
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 20,
      height: 4,
      createTransportSession: ({ terminalId, events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
            if (terminalId === "shell-1:terminal-1") {
              events.onMessage({
                type: "frame",
                terminalId,
                frameSeq: 11,
                status: "IDLE",
                patch: {
                  type: "full",
                  frame: {
                    ...shellTerminalEntry.snapshot!,
                    seq: 11,
                    interaction: {
                      activeOwnerId: "terminal",
                      selectionOverlays: [
                        {
                          ownerId: "terminal",
                          ownership: "backend-native",
                          rows: [{ row: 1, startCol: 0, endCol: 5 }],
                          selectedText: "row-1",
                        },
                      ],
                    },
                  },
                },
              });
            }
          },
          disconnect() {},
          send() {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();

    expect(selectedSpanCells(setup)).toContainEqual({ row: 1, text: "row-1" });
    setup.destroy();
  });

  test("Scenario: Given shell-terminal-view has separate owner regions When the user triple-clicks a dialogue row Then projection routes line selection to the dialogue owner", async () => {
    const lineSelectionPoints: Array<{ ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 32,
      height: 4,
      selectionRegions: [
        { owner: "terminal", row: 0, col: 0, width: 10, height: 4 },
        { owner: "dialogue", row: 0, col: 12, width: 20, height: 4 },
      ],
      selectionSources: [
        {
          owner: "dialogue",
          row: 0,
          col: 12,
          width: 20,
          height: 4,
          lines: [{ spans: [{ text: "dialogue first row" }] }, { spans: [{ text: "dialogue second row" }] }],
        },
      ],
      lines: [
        { spans: [{ text: "shell-00    dialogue first row" }] },
        { spans: [{ text: "shell-11    dialogue second row" }] },
      ],
      onSelectLineAt: (point) => {
        lineSelectionPoints.push(point);
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.click(14, 1);
    await setup.mockMouse.click(14, 1);
    await setup.mockMouse.click(14, 1);
    await setup.renderOnce();

    expect(lineSelectionPoints).toEqual([{ ownerId: "dialogue", row: 1, col: 2 }]);
    expect(setup.renderer.getSelection()?.getSelectedText() ?? "").toBe("");
    setup.renderer.destroy();
  });

  test("Scenario: Given shell-terminal-view has separate shell and dialogue regions When dragging starts inside dialogue Then selection events stay inside dialogue owner coordinates", async () => {
    const selectionEvents: Array<{ type: string; ownerId: string; row: number; col: number }> = [];
    const setup = await createShellTerminalViewTestSetup({
      width: 20,
      height: 4,
      selectionRegions: [
        { owner: "terminal", row: 0, col: 0, width: 8, height: 4 },
        { owner: "dialogue", row: 0, col: 10, width: 10, height: 4 },
      ],
      lines: [
        { spans: [{ text: "shell-00  dlg-alpha" }] },
        { spans: [{ text: "shell-11  dlg-beta" }] },
        { spans: [{ text: "shell-22  dlg-gamma" }] },
      ],
      onSelectionStart: (point) => {
        selectionEvents.push({ type: "start", ...point });
        return true;
      },
      onSelectionUpdate: (point) => {
        selectionEvents.push({ type: "update", ...point });
        return true;
      },
      onSelectionEnd: (point) => {
        selectionEvents.push({ type: "end", ...point });
        return true;
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.drag(10, 0, 19, 1);
    await setup.renderOnce();
    expect(selectionEvents[0]).toEqual({ type: "start", ownerId: "dialogue", row: 0, col: 0 });
    expect(selectionEvents.every((event) => event.ownerId === "dialogue")).toBe(true);
    expect(selectionEvents.some((event) => event.row === 1)).toBe(true);
    setup.renderer.destroy();
  });

  test("Scenario: Given terminal-chat backend frame is active When dialogue text wraps and scrolls Then cursor selection and copy stay inside dialogue truth with visible Chat scrollbar chrome", async () => {
    const messages = Array.from({ length: 8 }, (_, index) =>
      createRoomMessage({
        messageId: index + 1,
        senderActorId: index % 2 === 0 ? "auth:shell-assistant" : "auth:user",
        from: index % 2 === 0 ? "shell-assistant" : "you",
        content: `dialogue message ${index} with 中文内容 wrapping around the panel`,
        createdAt: Date.parse("2026-05-08T10:00:00+08:00") + index * 60_000,
      }),
    );
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["shell-row"],
      roomMessages: messages,
      unread: 0,
    });
    const model = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "dialogue",
        activeFocusTarget: "dialogue",
        requestedPlacement: "right",
        dialogueDraft: "中文 draft input wraps here",
        dialogueScrollTop: 2,
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 80,
      height: 24,
    });
    const backend = new CliShellDialogueBackend();
    const frame = backend.project({
      layout: { width: 30, height: 10 },
      model,
    });

    expect(frame.chrome.scrollbar).toBe("visible");
    expect(frame.viewport.scrollTop).toBeGreaterThan(0);
    expect(frame.viewport.totalRows).toBeGreaterThan(frame.viewport.visibleRows);
    expect(frame.cursor.visible).toBe(true);
    expect(frame.lines.join("\n")).toContain("中文");
    expect(frame.lines.join("\n")).toContain("█");
    expect(frame.lines.join("\n")).toContain("↓");

    expect(backend.selectionStart({ ownerId: "dialogue", row: 2, col: 1 })).toBe(true);
    expect(backend.selectionUpdate({ ownerId: "dialogue", row: 3, col: 18 })).toBe(true);
    expect(backend.selectionEnd({ ownerId: "dialogue", row: 3, col: 18 })).toBe(true);
    const selectedText = backend.copySelection();
    expect(selectedText.length).toBeGreaterThan(0);
    expect(selectedText).not.toContain("shell-row");
    const overlay = backend.getInteractionFrameState().selectionOverlays?.[0];
    expect(overlay?.ownerId).toBe("dialogue");
    expect(overlay?.ownership).toBe("backend-adapter-owned");
    expect(overlay?.rows.every((row) => row.row >= 2 && row.row <= 3)).toBe(true);
  });

  test("Scenario: Given cli-shell frame layout When terminal content is projected Then shell offscreen frame owns the scrollbar cells", () => {
    const model = buildCliShellTuiModel({
      state: createRuntimeState({
        heartbeat: [],
        lines: Array.from({ length: 12 }, (_, index) => `line-${index}`),
        roomMessages: [],
        unread: 0,
      }),
      projection: { roomSnapshot: null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: false,
        focusTarget: "terminal",
        requestedPlacement: "smart",
        dialogueDraft: "",
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 12,
      height: 5,
    });

    const frame = layoutCliShellTuiFrame({ model, width: 12, height: 5, renderToolbar: false });
    expect(frame.lines.some((line) => line.endsWith("█") || line.endsWith("░"))).toBe(true);
    expect(resolveCliShellTuiInteractionLayout({ model, width: 12, height: 5 }).terminalScrollbarRegion).toEqual({
      row: 0,
      col: 11,
      width: 1,
      height: 4,
    });
    const projection = resolveCliShellShellScrollbarProjection({ model, width: 12, height: 5 });
    expect(projection?.region).toEqual({ row: 0, col: 11, width: 1, height: 4 });
    expect(projection?.state.scrollSize).toBeGreaterThan(projection?.state.viewportSize ?? 0);
    expect(resolveCliShellScrollbarPointerTarget({ projection: projection!, row: 3 })).toBeGreaterThan(0);
  });

  test("Scenario: Given v9 collapsed toolbar renders When projected into one bottom row Then it shows compact activity and action entries without Heartbeat text or shortcuts", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell"],
      roomMessages: [],
      unread: 3,
    });
    const model = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: false,
        focusTarget: "terminal",
        requestedPlacement: "smart",
        dialogueDraft: "",
        managed: createManagedState({ managed: true }),
        statusNotice: "运行 cli-shell TUI 回归：已更新 Chat 面板滚动契约",
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 120,
      height: 40,
    });
    const frame = layoutCliShellTuiFrame({ model, width: 120, height: 40 });
    const bottomLine = frame.lines.at(-1) ?? "";

    expect(bottomLine).toContain("托管 on");
    expect(bottomLine).toContain("✉ 3");
    expect(bottomLine).toContain("运行 cli-shell TUI 回归");
    expect(bottomLine).not.toContain("Heartbeat");
    expect(bottomLine).not.toContain("心跳");
    expect(bottomLine).not.toContain("⌘");
    expect(bottomLine).not.toContain("terminal");
  });

  test("Scenario: Given constrained cli-shell space When smart placement resolves Chat Then it may cover the shell as a full frameless panel", () => {
    expect(resolveCliShellDialoguePlacement({ requestedPlacement: "smart", width: 34, height: 10 })).toBe("cover");
  });

  test("Scenario: Given Chat placement toolbar is visible When cover control is clicked Then the requested placement becomes cover", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell"],
      roomMessages: [],
      unread: 0,
    });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: true,
      focusTarget: "dialogue",
      requestedPlacement: "right",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const keybindings = resolveCliShellTuiKeybindings(null);
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state,
          projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings,
          width: 120,
          height: 40,
        }),
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    routeCliShellPointerAction(ctx, "placeCover");

    expect(viewState.dialogueOpen).toBe(true);
    expect(viewState.focusTarget).toBe("dialogue");
    expect(viewState.requestedPlacement).toBe("cover");
  });

  test("Scenario: Given a shell selection exists When copy shortcut is pressed Then cli-shell copies the projected shell text through OSC52", async () => {
    const exerciseCopyShortcut = async (shortcut: {
      meta?: boolean;
      super?: boolean;
      ctrl?: boolean;
      shift?: boolean;
    }) => {
      const state = createRuntimeState({
        heartbeat: [],
        lines: ["$ echo hello", "copy target"],
        roomMessages: [],
        unread: 0,
      });
      const harness = createTuiStore({ state });
      const sentMessages: TerminalTransportClientMessage[] = [];
      const transportHooks: {
        onMessage?: (message: TerminalTransportServerMessage) => void;
      } = {};
      const setup = await createCoreAppTestSetup({
        state,
        harness,
        width: 40,
        height: 10,
        createTransportSession: ({ events }) =>
          createTestTransportSession({
            async connect() {
              transportHooks.onMessage = events.onMessage;
              events.onOpen();
            },
            disconnect() {},
            send(message) {
              sentMessages.push(message);
              return true;
            },
            getConnectionState() {
              return "connected";
            },
          }),
      });
      const copyCalls: string[] = [];
      setup.renderer.copyToClipboardOSC52 = mock((text: string) => {
        copyCalls.push(text);
        return true;
      });

      await setup.renderOnce();
      await setup.mockMouse.drag(0, 0, 11, 0);
      await setup.renderOnce();
      if (shortcut.ctrl && shortcut.shift) {
        setup.renderer.keyInput.processParsedKey({
          name: "c",
          ctrl: true,
          meta: false,
          shift: true,
          option: false,
          sequence: "\u001b[27;6;99~",
          raw: "\u001b[27;6;99~",
          number: false,
          eventType: "press",
          source: "raw",
        });
      } else if (shortcut.super) {
        setup.renderer.keyInput.processParsedKey({
          name: "c",
          ctrl: false,
          meta: false,
          super: true,
          shift: false,
          option: false,
          sequence: "c",
          raw: "c",
          number: false,
          eventType: "press",
          source: "raw",
        });
      } else {
        setup.mockInput.pressKey("c", shortcut);
      }
      expect(sentMessages).toContainEqual({ type: "copySelection", ownerId: "terminal" });
      transportHooks.onMessage?.({
        type: "selectionText",
        terminalId: "shell-1",
        ownerId: "terminal",
        text: "$ echo hello",
      });
      setup.destroy();
      return copyCalls;
    };

    expect(await exerciseCopyShortcut({ meta: true })).toEqual(["$ echo hello"]);
    expect(await exerciseCopyShortcut({ super: true })).toEqual(["$ echo hello"]);
    expect(await exerciseCopyShortcut({ ctrl: true, shift: true })).toEqual(["$ echo hello"]);
  });

  test("Scenario: Given adjacent styled spans When projecting one terminal row Then later spans keep their own columns instead of being padded over", () => {
    const canvas = createTerminalCanvas(6, 1);
    writeCanvasStyledText(canvas, {
      row: 0,
      col: 0,
      spans: [{ text: "two" }, { text: "X" }],
      width: 6,
    });
    expect(renderCanvasLines(canvas)[0]).toBe("twoX  ");
  });

  test("Scenario: Given backend-owned composed surface is built When dialogue is open Then terminal and dialogue are mixed into one backend projection", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [
        createRoomMessage({
          messageId: 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: "ready",
          createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
        }),
      ],
      unread: 0,
    });
    const model = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "dialogue",
        activeFocusTarget: "dialogue",
        requestedPlacement: "right",
        dialogueDraft: "status?",
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 80,
      height: 24,
    });

    const surface = buildCliShellComposedSurface({
      shellTerminalId: "shell-1:terminal-1",
      terminalId: "shell-1:terminal-2",
      model,
      width: 80,
      height: 24,
    });
    expect(surface.dialogueOpen).toBe(true);
    expect(surface.dialoguePlacement).toBe("right");
    expect(surface.dialogueDraft).toBe("status?");
    expect(surface.terminalLines.join("\n")).toContain("Chat");
    expect(surface.terminalLines.join("\n")).toContain("×");
    expect(surface.terminalLines.join("\n")).toContain("█");
    expect(surface.terminalLines.join("\n")).not.toContain("┌layout");
    expect(surface.terminalLines.join("\n")).not.toContain("[Send]");
  });

  test("Scenario: Given terminal-chat backend is active When terminal-2 composes dialogue Then it consumes the backend frame instead of owning a replacement dialogue algorithm", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [
        createRoomMessage({
          messageId: 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: "backend-owned dialogue line",
          createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
        }),
      ],
      unread: 0,
    });
    const model = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "dialogue",
        activeFocusTarget: "dialogue",
        requestedPlacement: "right",
        dialogueDraft: "backend draft",
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 80,
      height: 24,
    });
    const surface = buildCliShellComposedSurface({
      shellTerminalId: "shell-1:terminal-1",
      terminalId: "shell-1:terminal-2",
      model,
      width: 80,
      height: 24,
    });
    const backendFrame = projectCliShellDialogueBackendFrame({
      layout: { width: 44, height: 23 },
      model,
    });

    for (const backendLine of backendFrame.lines.filter((line) => line.trim().length > 0)) {
      expect(surface.terminalLines.some((line) => line.includes(backendLine.trim()))).toBe(true);
    }
    expect(backendFrame.chrome.scrollbar).toBe("visible");
    expect(surface.terminalLines.join("\n")).toContain("backend draft");
  });

  test("Scenario: Given terminal-2 is the visible cli-shell surface When CliShellCoreApp renders and opens dialogue Then backend-owned composed surface truth is published through the standard runtime contract", async () => {
    const shellLines = ["$ agenter shell", "shell-1:~/project $ ls"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", shellLines);
    const visibleTerminalEntry = createCliShellTerminal2Entry({ lines: shellLines });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 24,
    });

    await setup.renderOnce();
    await setup.renderOnce();
    expect(harness.lastPublishedComposedSurface).not.toBeNull();
    expect(harness.lastPublishedComposedSurface?.terminalId).toBe("shell-1:terminal-2");
    expect(harness.lastPublishedComposedSurface?.shellTerminalId).toBe("shell-1:terminal-1");
    expect(harness.lastPublishedComposedSurface?.metadata?.cliShellFrame).toBe(true);
    expect(harness.lastPublishedComposedSurface?.lines.join("\n")).toContain("$ agenter shell");

    setup.mockInput.pressKey("j", { meta: true });
    await setup.renderOnce();
    await setup.renderOnce();
    expect(harness.lastPublishedComposedSurface?.metadata?.composedDialogueOpen).toBe(true);
    expect(harness.lastPublishedComposedSurface?.lines.join("\n")).toContain("Chat");
    setup.destroy();
  });

  test("Scenario: Given terminal-2 is the single product screen When native core renders collapsed and dialogue-open modes Then both modes are published as the same terminal-2 surface consumed by host adapters", async () => {
    const shellLines = ["$ agenter shell", "shell-1:~/project $ pwd", "/repo"];
    const roomMessages = [
      createRoomMessage({
        messageId: 1,
        senderActorId: "auth:shell-assistant",
        from: "shell-assistant",
        content: "dialogue backend body",
        createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
      }),
    ];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages, unread: 0 });
    const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", shellLines);
    const visibleTerminalEntry = createCliShellTerminal2Entry({ lines: shellLines });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 90,
      height: 22,
    });

    await setup.renderOnce();
    await setup.renderOnce();
    const collapsedSurface = harness.lastPublishedComposedSurface;
    expect(collapsedSurface?.terminalId).toBe("shell-1:terminal-2");
    expect(collapsedSurface?.shellTerminalId).toBe("shell-1:terminal-1");
    expect(collapsedSurface?.cols).toBe(90);
    expect(collapsedSurface?.rows).toBe(22);
    expect(collapsedSurface?.lines.join("\n")).toContain("$ agenter shell");
    expect(collapsedSurface?.metadata?.composedDialogueOpen).toBe(false);
    expect(collapsedSurface?.lines.at(-1)).toContain("◉");
    expect(collapsedSurface?.lines.at(-1)).not.toContain("◉ terminal");
    expect(collapsedSurface?.lines.at(-1)).not.toContain("M-J");

    setup.mockInput.pressKey("j", { meta: true });
    await setup.renderOnce();
    await setup.renderOnce();
    const openSurface = harness.lastPublishedComposedSurface;
    expect(openSurface?.terminalId).toBe("shell-1:terminal-2");
    expect(openSurface?.shellTerminalId).toBe("shell-1:terminal-1");
    expect(openSurface?.cols).toBe(90);
    expect(openSurface?.rows).toBe(22);
    expect(normalizeAsciiLetters(openSurface?.lines.join("") ?? "")).toContain("dialoguebackendbody");
    expect(openSurface?.metadata?.composedDialogueOpen).toBe(true);
    expect(openSurface?.metadata?.composedDialoguePlacement).toBe("right");
    expect(openSurface?.lines.at(-1)).toContain("◉");
    expect(openSurface?.lines.at(-1)).not.toContain("◉ terminal");
    expect(openSurface?.lines.at(-1)).not.toContain("M-J");
    setup.destroy();
  });

  test("Scenario: Given terminal-2 snapshot has old geometry When native core is resized with dialogue open Then terminal-2 republishes new geometry and host adapters never consume a stale partial frame", async () => {
    const shellLines = ["$ agenter shell", "shell-1:~/project $", "resize target"];
    const roomMessages = [
      createRoomMessage({
        messageId: 1,
        senderActorId: "auth:shell-assistant",
        from: "shell-assistant",
        content: "dialogue resize body",
        createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
      }),
    ];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages, unread: 0 });
    const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", shellLines);
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      lines: ["old terminal-2 row"],
      cols: 80,
      rows: 24,
      metadata: {
        composedBottomLine: "old bottom",
        composedDialogueOpen: true,
        composedDialoguePlacement: "right",
        composedShellSnapshotSeq: shellTerminalEntry.snapshot?.seq ?? 0,
      },
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 24,
    });

    await setup.renderOnce();
    setup.mockInput.pressKey("j", { meta: true });
    await setup.renderOnce();
    setup.resize(100, 30);
    await setup.renderOnce();
    await setup.renderOnce();

    const resizedSurface = harness.lastPublishedComposedSurface;
    expect(resizedSurface?.cols).toBe(100);
    expect(resizedSurface?.rows).toBe(30);
    expect(resizedSurface?.lines).toHaveLength(30);
    expect(resizedSurface?.lines.join("\n")).toContain("resize target");
    expect(normalizeAsciiLetters(resizedSurface?.lines.join("") ?? "")).toContain("dialogueresizebody");
    expect(resizedSurface?.lines.join("\n")).not.toContain("old terminal-2 row");

    const model = buildCliShellTuiModel({
      state: harness.store.getState(),
      projection: { roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1:terminal-2",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        focusTarget: "terminal",
        activeFocusTarget: "terminal",
        requestedPlacement: "right",
        dialogueDraft: "",
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 100,
      height: 30,
    });
    const terminalRegion = resolveCliShellTerminalRegion({ model, width: 100, height: 30 });
    const dialogueLayout = resolveCliShellTranscriptPanelLayout({ model, width: 100, height: 30 });
    expect(terminalRegion.height).toBe(29);
    expect(dialogueLayout.height).toBe(29);
    expect(terminalRegion.width + dialogueLayout.width).toBeLessThanOrEqual(98);
    setup.destroy();
  });

  test("Scenario: Given terminal-2 carries a stale-size composed snapshot When CliShellCoreApp renders before live transport catches up Then native draws local terminal-2 composition instead of the stale snapshot", async () => {
    const shellLines = ["$ agenter shell", "shell-1:~/project $ ls"];
    const visibleLines = ["visible terminal-2 line 1", "visible terminal-2 line 2", "visible terminal-2 line 3"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", shellLines);
    const visibleTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-2", visibleLines),
      processKind: "product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
      configuredTitle: "shell-1:terminal-2",
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-2", visibleLines).snapshot!,
        richLines: visibleLines.map((text) => ({ spans: [{ text }] })),
      },
    };
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 24,
    });

    await setup.renderOnce();
    const rendered = setup.captureCharFrame();
    expect(rendered).toContain("$ agenter shell");
    expect(rendered).toContain("shell-1:~/project $ ls");
    expect(rendered).not.toContain("visible terminal-2 line 1");
    setup.destroy();
  });

  test("Scenario: Given terminal-2 snapshot still has an old native height When CliShellCoreApp renders Then it uses local composed truth instead of clearing the larger canvas with partial rows", async () => {
    const shellLines = ["$ agenter shell", "shell-1:~/project $"];
    const oldVisibleLines = ["old-visible-0", "old-visible-1"];
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", shellLines);
    const visibleTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-2", oldVisibleLines),
      processKind: "product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
      configuredTitle: "shell-1:terminal-2",
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-2", oldVisibleLines).snapshot!,
        cols: 80,
        rows: 2,
        lines: oldVisibleLines,
        richLines: oldVisibleLines.map((text) => ({ spans: [{ text }] })),
        cursor: { x: 12, y: 1, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: 2,
          screenLines: 2,
        },
      },
    };
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 12,
      createTransportSession: ({ terminalId, events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
            expect(terminalId).toBe("shell-1:terminal-1");
            events.onMessage({
              type: "frameDirty",
              terminalId: "shell-1:terminal-1",
              frameSeq: visibleTerminalEntry.snapshot!.seq + 1,
              reason: "stale-source-frame",
            });
          },
          disconnect() {},
          send() {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();

    const rendered = setup.captureCharFrame();
    expect(rendered).toContain("$ agenter shell");
    expect(rendered).toContain("shell-1:~/project $");
    expect(rendered).not.toContain("old-visible-0");
    setup.destroy();
  });

  test("Scenario: Given terminal-2 advertises a transport URL When native core attaches to the composed product Then it never opens a terminal-2 pull session", async () => {
    const shellLines = ["$ agenter shell", "shell-1:~/project $"];
    const liveLines = Array.from({ length: 12 }, (_, index) => (index === 0 ? "visible-live-row" : `live-${index}`));
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", shellLines);
    const visibleTerminalEntry = createCliShellTerminal2Entry({
      lines: ["snapshot row"],
      cols: 80,
      rows: 12,
    });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const openedTerminalIds: Array<string | undefined> = [];
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 12,
      createTransportSession: ({ terminalId, events }) =>
        createTestTransportSession({
          async connect() {
            openedTerminalIds.push(terminalId);
            events.onOpen();
            if (terminalId === "shell-1:terminal-2") {
              events.onMessage({
                type: "frame",
                terminalId,
                frameSeq: visibleTerminalEntry.snapshot!.seq + 1,
                status: "IDLE",
                patch: {
                  type: "full",
                  frame: {
                    seq: visibleTerminalEntry.snapshot!.seq + 1,
                    timestamp: Date.now(),
                    cols: 80,
                    rows: 12,
                    lines: liveLines,
                    richLines: liveLines.map((text) => ({ spans: [{ text }] })),
                    cursor: { x: "visible-live-row".length, y: 0, visible: true },
                    scrollback: {
                      viewportOffset: 0,
                      totalLines: 12,
                      screenLines: 12,
                    },
                  },
                },
              });
            }
          },
          disconnect() {},
          send() {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();

    const rendered = setup.captureCharFrame();
    expect(openedTerminalIds).toEqual(["shell-1:terminal-1"]);
    expect(rendered).not.toContain("visible-live-row");
    setup.destroy();
  });

  test("Scenario: Given shell owner cursor is stored as an absolute scrollback row When CliShellCoreApp renders scrolled shell projection Then hardware cursor remains visible in the local viewport", async () => {
    const visibleLines = Array.from({ length: 10 }, (_, index) => `line-${index + 20}`);
    const state = createRuntimeState({ heartbeat: [], lines: visibleLines, roomMessages: [], unread: 0 });
    const visibleTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1", visibleLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1", visibleLines).snapshot!,
        cols: 80,
        rows: 10,
        lines: visibleLines,
        richLines: visibleLines.map((text) => ({ spans: [{ text }] })),
        cursor: { x: 6, y: 29, visible: true },
        scrollback: {
          viewportOffset: 20,
          totalLines: 30,
          screenLines: 10,
        },
      },
    };
    state.globalTerminals = createCached([visibleTerminalEntry]);
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1",
      width: 80,
      height: 10,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
            events.onMessage({
              type: "frame",
              terminalId: "shell-1",
              frameSeq: visibleTerminalEntry.snapshot!.seq,
              status: "IDLE",
              patch: { type: "full", frame: visibleTerminalEntry.snapshot! },
            });
          },
          disconnect() {},
          send() {
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();

    const cursor = setup.renderer.getCursorState();
    expect(cursor.visible).toBe(true);
    expect(cursor.x).toBe(7);
    expect(cursor.y).toBe(9);
    setup.destroy();
  });

  test("Scenario: Given an attached live mirror When terminal region scroll is requested through mouse interaction Then cli-shell forwards shared viewport movement to backend truth", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $", "line-3"],
      roomMessages: [],
      unread: 0,
    });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const scrollCalls: number[] = [];
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings: resolveCliShellTuiKeybindings(null),
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state,
          projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings: resolveCliShellTuiKeybindings(null),
          width: 120,
          height: 40,
        }),
      getLiveMirror: () => ({ scrollViewport: (deltaRows: number) => (scrollCalls.push(deltaRows), true) }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellMouseScroll(ctx, { deltaRows: -3 })).toBe(true);
    expect(scrollCalls).toEqual([-3]);
  });

  test("Scenario: Given an attached live mirror When the native scrollbar targets an absolute viewport start Then cli-shell forwards backend-truth viewport targeting", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $", "line-3", "line-4"],
      roomMessages: [],
      unread: 0,
    });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const targetCalls: number[] = [];
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings: resolveCliShellTuiKeybindings(null),
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state,
          projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings: resolveCliShellTuiKeybindings(null),
          width: 120,
          height: 40,
        }),
      getLiveMirror: () =>
        ({ setViewportStart: (viewportStart: number) => (targetCalls.push(viewportStart), true) }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellViewportTarget(ctx, { viewportStart: 7 })).toBe(true);
    expect(targetCalls).toEqual([7]);
  });

  test("Scenario: Given CliShellCoreApp renders the shell offscreen scrollbar When the user clicks and drags it Then cli-shell sends absolute backend viewport targets", async () => {
    const shellLines = Array.from({ length: 80 }, (_, index) => `line-${index}`);
    const state = createRuntimeState({ heartbeat: [], lines: shellLines, roomMessages: [], unread: 0 });
    const shellTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines),
      snapshot: {
        ...createGlobalTerminalEntry("shell-1:terminal-1", shellLines).snapshot!,
        rows: 10,
        cols: 80,
        cursor: { x: 0, y: 35, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: shellLines.length,
          screenLines: 10,
        },
      },
    };
    const visibleTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-2", shellLines),
      processKind: "product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
      configuredTitle: "shell-1:terminal-2",
    };
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 12,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
            events.onMessage({
              type: "frame",
              terminalId: "shell-1:terminal-1",
              frameSeq: shellTerminalEntry.snapshot!.seq,
              status: "IDLE",
              patch: { type: "full", frame: shellTerminalEntry.snapshot! },
            });
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    await setup.renderOnce();
    const before = setup.captureCharFrame();
    expect(
      before
        .split("\n")
        .slice(0, 10)
        .some((line) => line.endsWith("█") || line.endsWith("░")),
    ).toBe(true);
    await setup.mockMouse.click(79, 8);
    await setup.mockMouse.drag(79, 2, 79, 9);
    await setup.renderOnce();
    const viewportTargets = sentMessages.filter((message) => message.type === "viewportTarget");
    expect(viewportTargets.length).toBeGreaterThan(0);
    if (viewportTargets.at(-1)?.type === "viewportTarget") {
      expect(viewportTargets.at(-1)?.viewportStart).toBeGreaterThan(0);
    }
    setup.destroy();
  });

  test("Scenario: Given backend scrollbar receives real mouse input When the track is clicked and dragged Then every change is a backend viewport target", async () => {
    const changes: number[] = [];
    const setup = await createBackendScrollbarTestSetup({
      width: 1,
      height: 10,
      orientation: "vertical",
      backendState: {
        scrollSize: 100,
        viewportSize: 20,
        scrollPosition: 0,
      },
      onBackendChange: (position: number) => {
        changes.push(position);
      },
    });

    await setup.renderOnce();
    await setup.mockMouse.click(0, 8);
    await setup.renderOnce();
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.at(-1)).toBeGreaterThan(0);
    expect(setup.scrollbar.latestBackendPosition).toBe(0);
    const afterClickTarget = changes.at(-1) ?? 0;
    setup.scrollbar.applyBackendState({
      scrollSize: 100,
      viewportSize: 20,
      scrollPosition: afterClickTarget,
    });
    await setup.renderOnce();
    expect(setup.scrollbar.latestBackendPosition).toBe(afterClickTarget);
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame is rendered When scrollbar input changes position Then the frame routes viewport targets to the backend bridge", async () => {
    const viewportTargets: number[] = [];
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-test",
      width: 20,
      height: 6,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: Array.from({ length: 6 }, (_, row) => ({
          spans: [{ text: `line-${row}` }],
        })),
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 60,
      },
      bridge: {
        scrollViewport: () => true,
        setViewportStart: (viewportStart) => {
          viewportTargets.push(viewportStart);
          return true;
        },
      },
    });

    expect(setup.frame.terminalView.width).toBe(19);
    expect(setup.frame.scrollbar.left).toBe(19);
    expect(setup.frame.scrollbar.visible).toBe(true);
    await setup.renderOnce();
    await setup.mockMouse.click(19, 5);
    await setup.renderOnce();
    expect(viewportTargets.length).toBeGreaterThan(0);
    expect(viewportTargets.at(-1)).toBeGreaterThan(0);
    setup.renderer.destroy();
  });

  test("Scenario: Given backend scrollbar receives backend viewport state When the backend scroll position changes Then visible progress state changes from backend truth", async () => {
    const setup = await createBackendScrollbarTestSetup({
      width: 1,
      height: 10,
      orientation: "vertical",
      backendState: {
        scrollSize: 100,
        viewportSize: 20,
        scrollPosition: 0,
      },
      onBackendChange: () => {},
    });

    await setup.renderOnce();
    const before = setup.scrollbar.visibleProgressState;
    expect(before).toMatchObject({ min: 0, max: 80, value: 0, viewportSize: 20 });

    setup.scrollbar.applyBackendState({
      scrollSize: 100,
      viewportSize: 20,
      scrollPosition: 40,
    });
    await setup.renderOnce();

    expect(setup.scrollbar.visibleProgressState).toMatchObject({
      min: 0,
      max: 80,
      value: 40,
      viewportSize: 20,
    });
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame owns selected text When copy is requested Then the frame asks the backend bridge to copy selection", async () => {
    const copyOwners: Array<string | undefined> = [];
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-copy-test",
      width: 20,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "copy target" }] }, { spans: [{ text: "next line" }] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        scrollViewport: () => true,
        setViewportStart: () => true,
        copySelection: (ownerId) => {
          copyOwners.push(ownerId);
          return true;
        },
      },
    });

    await setup.renderOnce();

    expect(setup.frame.copySelectionViaOsc52()).toBe(true);
    expect(copyOwners).toEqual(["terminal"]);
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame has no backend copy bridge When copy is requested Then it reports no copy", async () => {
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-semantic-copy-test",
      width: 30,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "$ echo semantic" }] }, { spans: [] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        scrollViewport: () => true,
        setViewportStart: () => true,
      },
    });

    await setup.renderOnce();

    expect(setup.frame.copySelectionViaOsc52()).toBe(false);
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame is focused When paste text arrives Then the frame writes the text to backend input", async () => {
    const inputTexts: string[] = [];
    let followCursorCount = 0;
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-paste-test",
      width: 20,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "paste target" }] }, { spans: [] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        sendInputText: (text) => {
          inputTexts.push(text);
          return true;
        },
        scrollViewport: () => true,
        setViewportStart: () => true,
        followCursor: () => {
          followCursorCount += 1;
          return true;
        },
      },
    });

    setup.renderer.keyInput.processPaste(new TextEncoder().encode("粘贴 ok\n"));

    expect(inputTexts).toEqual(["粘贴 ok\n"]);
    expect(followCursorCount).toBe(1);
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame receives Unicode prompt text When paste arrives Then the frame preserves the original string before shell editor display", async () => {
    const inputTexts: string[] = [];
    const promptText = "agenter on  main [$✘!?⇡] via 🥟 v1.3.14";
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-unicode-paste-test",
      width: 60,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "paste target" }] }, { spans: [] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        sendInputText: (text) => {
          inputTexts.push(text);
          return true;
        },
        scrollViewport: () => true,
        setViewportStart: () => true,
      },
    });

    setup.renderer.keyInput.processPaste(new TextEncoder().encode(promptText));

    expect(inputTexts).toEqual([promptText]);
    expect(new TextEncoder().encode(inputTexts[0] ?? "")).toEqual(new TextEncoder().encode(promptText));
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame receives image paste metadata When no media bridge is installed Then the image is not sent to shell input", async () => {
    const inputTexts: string[] = [];
    const mediaPayloadKinds: string[] = [];
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-image-paste-test",
      width: 20,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "paste target" }] }, { spans: [] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        sendInputText: (text) => {
          inputTexts.push(text);
          return true;
        },
        handleUnsupportedMediaPaste: (payload) => {
          mediaPayloadKinds.push(...payload.items.map((item) => `${item.kind}:${item.mimeType}`));
          return true;
        },
        scrollViewport: () => true,
        setViewportStart: () => true,
      },
    });

    setup.renderer.keyInput.processPaste(new Uint8Array([137, 80, 78, 71]), {
      kind: "binary",
      mimeType: "image/png",
    });

    expect(inputTexts).toEqual([]);
    expect(mediaPayloadKinds).toEqual(["image:image/png"]);
    setup.renderer.destroy();
  });

  test("Scenario: Given a backend terminal frame receives a pasted image file URL When no image reader is installed Then the file URL is blocked from shell stdin", async () => {
    const inputTexts: string[] = [];
    const mediaPayloadKinds: string[] = [];
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-image-url-paste-test",
      width: 20,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "paste target" }] }, { spans: [] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        sendInputText: (text) => {
          inputTexts.push(text);
          return true;
        },
        handleUnsupportedMediaPaste: (payload) => {
          mediaPayloadKinds.push(...payload.items.map((item) => `${item.kind}:${item.mimeType}:${item.name ?? ""}`));
          return true;
        },
        scrollViewport: () => true,
        setViewportStart: () => true,
      },
    });

    setup.renderer.keyInput.processPaste(new TextEncoder().encode("file:///tmp/screenshot.png"));

    expect(inputTexts).toEqual([]);
    expect(mediaPayloadKinds).toEqual(["image:image/png:screenshot.png"]);
    setup.renderer.destroy();
  });

  test("Scenario: Given CliShellCoreApp receives image paste metadata When no media attachment bridge is installed Then the image paste does not become terminal input", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [],
      unread: 0,
    });
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({ state, harness, width: 80, height: 18 });

    setup.renderer.keyInput.processPaste(new Uint8Array([137, 80, 78, 71]), {
      kind: "binary",
      mimeType: "image/png",
    });

    expect(harness.inputs).toEqual([]);
    expect(harness.sentMessages).toEqual([]);
    setup.destroy();
  });

  test("Scenario: Given a backend terminal frame has no selected text When OSC52 copy is requested Then the frame reports no copy", async () => {
    const setup = await createBackendTerminalFrameTestSetup({
      id: "backend-terminal-frame-empty-copy-test",
      width: 20,
      height: 4,
      position: "absolute",
      top: 0,
      left: 0,
      state: {
        lines: [{ spans: [{ text: "copy target" }] }, { spans: [] }, { spans: [] }, { spans: [] }],
        cursorCol: 0,
        cursorAbsRow: 0,
        cursorVisible: true,
        viewportStart: 0,
        scrollbackRows: 4,
      },
      bridge: {
        scrollViewport: () => true,
        setViewportStart: () => true,
      },
    });
    const copyCalls: string[] = [];
    setup.renderer.copyToClipboardOSC52 = mock((text: string) => {
      copyCalls.push(text);
      return true;
    });

    expect(setup.frame.copySelectionViaOsc52()).toBe(false);
    expect(copyCalls).toEqual([]);
    setup.renderer.destroy();
  });

  test("Scenario: Given perf tracing is enabled When cli-shell records render events Then trace output is newline-delimited JSON", async () => {
    const previousTraceEnv = process.env.AGENTER_CLI_SHELL_TRACE;
    const tracePath = `/tmp/agenter-cli-shell-trace-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`;
    process.env.AGENTER_CLI_SHELL_TRACE = tracePath;
    try {
      await Bun.write(tracePath, "stale trace line\n");
      const tracer = createCliShellPerfTracer();
      expect(tracer.enabled).toBe(true);
      tracer.record({ kind: "frame-dirty-received", detail: { dirtyQueueDepth: 4 } });
      tracer.record({
        kind: "pull-frame-blocked",
        detail: { blockedReasons: ["paint-in-flight"], dirtyQueueDepth: 5, pullMode: "active" },
      });
      tracer.record({
        kind: "frame-received",
        detail: {
          latencyMs: 8,
          patchType: "rows",
          patchRows: 4,
          frameBytes: 16_384,
          diffBytes: 512,
          skippedFrames: 2,
        },
      });
      tracer.record({
        kind: "render-applied",
        detail: {
          elapsedMs: 20,
          estimatedFps: 50,
          stats: {
            fps: 50,
            frameCount: 3,
            frameTimes: [1, 18, 40],
            averageFrameTime: 19.67,
            minFrameTime: 1,
            maxFrameTime: 40,
          },
        },
      });
      tracer.record({ kind: "viewport-target", detail: { source: "scrollbar", targetPosition: 12 } });
      tracer.record({ kind: "render-revision-coalesced", detail: { trigger: "source-mirror.requestPaint" } });
      expect(tracer.snapshot()).toMatchObject({
        pullMs: 8,
        patch: "rows:4",
        frameBytes: 16_384,
        diffBytes: 512,
        dirtyQueue: 5,
        skippedFrames: 2,
        frameGapMs: 20,
        fps: 50,
        mode: "active",
      });
      tracer.dispose();

      const lines = (await Bun.file(tracePath).text()).trim().split("\n");
      expect(lines.length).toBe(6);
      const parsedLines = lines.map((line) => JSON.parse(line));
      expect(lines.some((line) => line.includes("stale trace line"))).toBe(false);
      expect(parsedLines[0]).toMatchObject({
        kind: "frame-dirty-received",
        seq: 1,
        sinceStartMs: 0,
        sincePreviousMs: 0,
        detail: { dirtyQueueDepth: 4 },
      });
      expect(parsedLines[1]).toMatchObject({
        kind: "pull-frame-blocked",
        seq: 2,
        detail: { blockedReasons: ["paint-in-flight"], dirtyQueueDepth: 5 },
      });
      expect(parsedLines[2]).toMatchObject({
        kind: "frame-received",
        detail: { frameBytes: 16_384, diffBytes: 512, skippedFrames: 2 },
      });
      expect(parsedLines[3]).toMatchObject({
        kind: "render-applied",
        detail: {
          elapsedMs: 20,
          estimatedFps: 50,
          rendererStats: {
            frameTimeSampleCount: 3,
            slowFramesOver16Ms: 2,
            slowFramesOver33Ms: 1,
          },
        },
      });
      expect(parsedLines[3].detail.stats).toBeUndefined();
      expect(parsedLines[4]).toMatchObject({
        kind: "viewport-target",
        detail: { targetPosition: 12 },
      });
      expect(parsedLines[5]).toMatchObject({
        kind: "render-revision-coalesced",
        detail: { trigger: "source-mirror.requestPaint" },
      });
    } finally {
      if (previousTraceEnv === undefined) {
        delete process.env.AGENTER_CLI_SHELL_TRACE;
      } else {
        process.env.AGENTER_CLI_SHELL_TRACE = previousTraceEnv;
      }
      await Bun.file(tracePath)
        .delete()
        .catch(() => undefined);
    }
  });

  test("Scenario: Given perf tracing filters are enabled When mixed events are recorded Then only matching debug groups are written", async () => {
    const previousTraceEnv = process.env.AGENTER_CLI_SHELL_TRACE;
    const tracePath = `/tmp/agenter-cli-shell-trace-filter-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`;
    process.env.AGENTER_CLI_SHELL_TRACE = tracePath;
    try {
      const tracer = createCliShellPerfTracer({ enabled: true, filters: ["key", "follow"] });
      tracer.record({ kind: "render-applied", detail: { elapsedMs: 1 } });
      tracer.record({ kind: "terminal-key-encoded", detail: { keyName: "left" } });
      tracer.record({ kind: "follow-cursor-requested", detail: { followed: true } });
      tracer.record({ kind: "selection-drag", detail: { owner: "terminal" } });
      tracer.dispose();

      const parsedLines = (await Bun.file(tracePath).text())
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
      expect(parsedLines.filter((line) => line.kind !== "trace-summary").map((line) => line.kind)).toEqual([
        "terminal-key-encoded",
        "follow-cursor-requested",
      ]);
    } finally {
      if (previousTraceEnv === undefined) {
        delete process.env.AGENTER_CLI_SHELL_TRACE;
      } else {
        process.env.AGENTER_CLI_SHELL_TRACE = previousTraceEnv;
      }
      await Bun.file(tracePath)
        .delete()
        .catch(() => undefined);
    }
  });

  test("Scenario: Given fixed pacing records many unchanged pulls When perf trace writes to disk Then empty frame traffic is summarized instead of logged per pull", async () => {
    const previousTraceEnv = process.env.AGENTER_CLI_SHELL_TRACE;
    const tracePath = `/tmp/agenter-cli-shell-trace-summary-${Date.now()}-${Math.random().toString(36).slice(2)}.ndjson`;
    process.env.AGENTER_CLI_SHELL_TRACE = tracePath;
    try {
      const tracer = createCliShellPerfTracer();
      expect(tracer.enabled).toBe(true);
      for (let index = 0; index < 20; index += 1) {
        tracer.record({
          kind: "pull-frame-sent",
          detail: {
            dirtyQueueDepth: 0,
            pullMode: "active",
          },
        });
        tracer.record({
          kind: "frame-received",
          detail: {
            frameSeq: 10,
            patchType: "notModified",
            patchRows: 0,
            latencyMs: 1,
          },
        });
        tracer.record({
          kind: "frame-not-modified",
          detail: {
            frameSeq: 10,
            latencyMs: 1,
          },
        });
      }
      tracer.dispose();

      const lines = (await Bun.file(tracePath).text()).trim().split("\n");
      expect(lines).toHaveLength(1);
      const summary = JSON.parse(lines[0] ?? "{}") as {
        kind?: string;
        detail?: {
          suppressedEvents?: number;
          kinds?: string;
          lastFrameSeq?: number;
          lastPatchType?: string;
          maxPullLatencyMs?: number;
        };
      };
      expect(summary.kind).toBe("trace-summary");
      expect(summary.detail?.suppressedEvents).toBe(60);
      expect(summary.detail?.lastFrameSeq).toBe(10);
      expect(summary.detail?.lastPatchType).toBe("notModified");
      expect(summary.detail?.maxPullLatencyMs).toBe(1);
      expect(summary.detail?.kinds).toContain("frame-not-modified");
    } finally {
      if (previousTraceEnv === undefined) {
        delete process.env.AGENTER_CLI_SHELL_TRACE;
      } else {
        process.env.AGENTER_CLI_SHELL_TRACE = previousTraceEnv;
      }
      await Bun.file(tracePath)
        .delete()
        .catch(() => undefined);
    }
  });

  test("Scenario: Given dialogue mode owns keyboard routing When Enter is pressed Then cli-shell submits exactly one room message without a second visible input", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [],
      unread: 0,
    });
    const harness = createTuiStore({ state });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: true,
      focusTarget: "dialogue",
      requestedPlacement: "right",
      dialogueDraft: "send once",
      managed: createManagedState(),
      statusNotice: null,
    };
    const keybindings = resolveCliShellTuiKeybindings(null);
    const ctx = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state: harness.store.getState(),
          projection: { roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings,
          width: 120,
          height: 40,
        }),
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    await submitCliShellDialogue(ctx);
    expect(harness.sentMessages).toEqual([{ chatId: "room-shell-1", text: "send once" }]);
    expect(viewState.dialogueOpen).toBe(true);
    expect(viewState.dialogueDraft).toBe("");
    expect(viewState.dialogueScrollTop).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("Scenario: Given Chat is scrolled up When a user message is sent Then cli-shell returns the transcript to bottom-pinned mode", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: Array.from({ length: 8 }, (_, index) =>
        createRoomMessage({
          messageId: index + 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: `history row ${index}`,
          createdAt: Date.parse("2026-05-08T10:00:00+08:00") + index * 60_000,
        }),
      ),
      unread: 0,
    });
    const harness = createTuiStore({ state });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: true,
      focusTarget: "dialogue",
      requestedPlacement: "right",
      dialogueDraft: "pin me",
      dialogueScrollTop: 5,
      managed: createManagedState(),
      statusNotice: null,
    };
    const keybindings = resolveCliShellTuiKeybindings(null);
    const ctx = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state: harness.store.getState(),
          projection: { roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings,
          width: 120,
          height: 40,
        }),
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    await submitCliShellDialogue(ctx);

    expect(harness.sentMessages).toEqual([{ chatId: "room-shell-1", text: "pin me" }]);
    expect(viewState.dialogueDraft).toBe("");
    expect(viewState.dialogueScrollTop).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("Scenario: Given dialogue backend owns scroll When the wheel targets dialogue Then shell viewport is not changed by the event", async () => {
    const roomMessages = Array.from({ length: 12 }, (_, index) =>
      createRoomMessage({
        messageId: index + 1,
        senderActorId: "auth:shell-assistant",
        from: "shell-assistant",
        content: `dialogue scroll row ${index}`,
        createdAt: Date.parse("2026-05-08T10:00:00+08:00") + index * 60_000,
      }),
    );
    const state = createRuntimeState({
      heartbeat: [],
      lines: Array.from({ length: 40 }, (_, index) => `shell-${index}`),
      roomMessages,
      unread: 0,
    });
    const shellTerminalEntry = createGlobalTerminalEntry(
      "shell-1:terminal-1",
      state.globalTerminals.data[0]?.snapshot?.lines ?? [],
    );
    const visibleTerminalEntry: GlobalTerminalEntry = {
      ...createGlobalTerminalEntry("shell-1:terminal-2", ["product"]),
      processKind: "product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
      configuredTitle: "shell-1:terminal-2",
    };
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const setup = await createCoreAppTestSetup({
      state,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 16,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    setup.mockInput.pressKey("j", { meta: true });
    await setup.renderOnce();
    await setup.mockMouse.scroll(60, 4, "down");
    await setup.renderOnce();

    expect(sentMessages.filter((message) => message.type === "viewportDelta")).toHaveLength(0);
    setup.destroy();
  });

  test("Scenario: Given terminal mode and dialogue mode When keys are routed through the controller Then terminal input and room-message send each stay in their own backend contract", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [],
      unread: 0,
    });
    const harness = createTuiStore({ state });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const keybindings = resolveCliShellTuiKeybindings(null);
    const ctx = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state: harness.store.getState(),
          projection: { roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings,
          width: 120,
          height: 40,
        }),
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    routeCliShellKey(ctx, createTestKeyEvent({ name: "l", sequence: "l", raw: "l" }));
    routeCliShellKey(ctx, createTestKeyEvent({ name: "s", sequence: "s", raw: "s" }));
    expect(harness.inputs.map((entry) => entry.text)).toEqual(["l", "s"]);
    routeCliShellKey(ctx, createTestKeyEvent({ name: "j", meta: true, sequence: "j", raw: "j" }));
    expect(viewState.dialogueOpen).toBe(true);
    routeCliShellPaste(ctx, "status?");
    expect(harness.inputs).toHaveLength(2);
    expect(viewState.dialogueDraft).toBe("status?");
    await submitCliShellDialogue(ctx);
    expect(harness.sentMessages).toEqual([{ chatId: "room-shell-1", text: "status?" }]);
  });

  test("Scenario: Given terminal input is routed to a live mirror When backend accepts bytes Then cli-shell requests backend cursor follow", () => {
    const state = createRuntimeState({ heartbeat: [], lines: ["$ agenter shell"], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const sentInput: string[] = [];
    let followCursorCount = 0;
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings: resolveCliShellTuiKeybindings(null),
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state,
          projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings: resolveCliShellTuiKeybindings(null),
          width: 120,
          height: 40,
        }),
      getLiveMirror: () =>
        ({
          sendInputBytes: (data: Uint8Array) => {
            sentInput.push(new TextDecoder().decode(data));
            return true;
          },
          followCursor: () => {
            followCursorCount += 1;
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellKey(ctx, createTestKeyEvent({ name: "x", sequence: "x", raw: "x" }))).toBe(true);
    expect(sentInput).toEqual(["x"]);
    expect(followCursorCount).toBe(1);
  });

  test("Scenario: Given terminal input is routed to a live mirror When navigation keys move the cursor Then cli-shell still requests backend cursor follow", () => {
    const state = createRuntimeState({ heartbeat: [], lines: ["$ agenter shell"], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const sentInput: string[] = [];
    let followCursorCount = 0;
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings: resolveCliShellTuiKeybindings(null),
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state,
          projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings: resolveCliShellTuiKeybindings(null),
          width: 120,
          height: 40,
        }),
      getLiveMirror: () =>
        ({
          sendInputBytes: (data: Uint8Array) => {
            sentInput.push(new TextDecoder().decode(data));
            return true;
          },
          followCursor: () => {
            followCursorCount += 1;
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    for (const key of ["left", "right", "home", "end"]) {
      expect(routeCliShellKey(ctx, createTestKeyEvent({ name: key }))).toBe(true);
    }
    expect(sentInput).toEqual(["\u001b[D", "\u001b[C", "\x01", "\x05"]);
    expect(followCursorCount).toBe(4);
  });

  test("Scenario: Given word navigation enhancement is enabled When Option Left Right is pressed Then cli-shell sends segmented cursor movement", () => {
    const wordLine = "$ echo hello world ok";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const sentInput: string[] = [];
    let followCursorCount = 0;
    const keybindings = resolveCliShellTuiKeybindings(null);
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
      interactionProfile: {
        semanticWordSelection: true,
        semanticRowSelection: true,
        wordNavigation: true,
        followCursorOnInput: true,
        homeEndFallback: true,
      },
    });
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")),
        },
      }),
      getLiveMirror: () =>
        ({
          sendInputBytes: (data: Uint8Array) => {
            sentInput.push(new TextDecoder().decode(data));
            return true;
          },
          followCursor: () => {
            followCursorCount += 1;
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellKey(ctx, createTestKeyEvent({ name: "left", option: true, sequence: "\u001bb" }))).toBe(true);
    const expectedLeftCells =
      stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")) -
      stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world"));
    expect(sentInput).toEqual(["\u001b[D".repeat(expectedLeftCells)]);
    expect(followCursorCount).toBe(1);

    const rightCtx = {
      ...ctx,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world")),
        },
      }),
    };
    expect(routeCliShellKey(rightCtx, createTestKeyEvent({ name: "right", option: true, sequence: "\u001bf" }))).toBe(
      true,
    );
    const expectedRightCells =
      stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world") + "world".length) -
      stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world"));
    expect(sentInput.at(-1)).toBe("\u001b[C".repeat(expectedRightCells));

    const escSequenceCtx = {
      ...ctx,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")),
        },
      }),
    };
    expect(routeCliShellKey(escSequenceCtx, createTestKeyEvent({ name: "b", sequence: "\u001bb" }))).toBe(true);
    expect(sentInput.at(-1)).toBe("\u001b[D".repeat(expectedLeftCells));

    const escRightSequenceCtx = {
      ...ctx,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world")),
        },
      }),
    };
    expect(routeCliShellKey(escRightSequenceCtx, createTestKeyEvent({ name: "f", sequence: "\u001bf" }))).toBe(true);
    expect(sentInput.at(-1)).toBe("\u001b[C".repeat(expectedRightCells));
  });

  test("Scenario: Given word navigation enhancement is enabled When Option Shift Left Right is pressed Then cli-shell extends backend-owned selection by word", () => {
    const wordLine = "$ echo hello world ok";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const ranges: Array<{ ownerId: string; startCol: number; endCol: number }> = [];
    const sentInput: string[] = [];
    let followCursorCount = 0;
    const keybindings = resolveCliShellTuiKeybindings(null);
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
      interactionProfile: {
        semanticWordSelection: true,
        semanticRowSelection: true,
        wordNavigation: true,
        followCursorOnInput: true,
        homeEndFallback: true,
      },
    });
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")),
        },
      }),
      getLiveMirror: () =>
        ({
          sendInputBytes: (data: Uint8Array) => {
            sentInput.push(new TextDecoder().decode(data));
            return true;
          },
          followCursor: () => {
            followCursorCount += 1;
            return true;
          },
          selectRange: (range: { ownerId: string; startCol: number; endCol: number }) => {
            ranges.push({ ownerId: range.ownerId, startCol: range.startCol, endCol: range.endCol });
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(
      routeCliShellKey(ctx, createTestKeyEvent({ name: "left", option: true, shift: true, sequence: "\u001bb" })),
    ).toBe(true);
    expect(ranges).toEqual([
      {
        ownerId: "terminal",
        startCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world")),
        endCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")),
      },
    ]);
    expect(sentInput).toEqual([
      "\u001b[D".repeat(
        stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")) -
          stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world")),
      ),
    ]);
    expect(followCursorCount).toBe(1);

    const rightCtx = {
      ...ctx,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world")),
        },
      }),
    };
    expect(
      routeCliShellKey(rightCtx, createTestKeyEvent({ name: "right", option: true, shift: true, sequence: "\u001bf" })),
    ).toBe(true);
    expect(ranges.at(-1)).toEqual({
      ownerId: "terminal",
      startCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world") + "world".length),
      endCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok")),
    });
    expect(sentInput.at(-1)).toBe(
      "\u001b[C".repeat(
        stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world") + "world".length) -
          stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world")),
      ),
    );
    expect(followCursorCount).toBe(2);
  });

  test("Scenario: Given word selection is already anchored When Option Shift Left is pressed again Then cli-shell preserves the original anchor and moves only the focus", () => {
    const wordLine = "$ echo alpha beta gamma";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const ranges: Array<{ ownerId: string; startCol: number; endCol: number }> = [];
    const sentInput: string[] = [];
    const keybindings = resolveCliShellTuiKeybindings(null);
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
      interactionProfile: {
        semanticWordSelection: true,
        semanticRowSelection: true,
        wordNavigation: true,
        followCursorOnInput: true,
        homeEndFallback: true,
      },
    });
    let cursorCol = stringIndexToTerminalColumn(wordLine, wordLine.indexOf("gamma"));
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol,
        },
      }),
      getLiveMirror: () =>
        ({
          sendInputBytes: (data: Uint8Array) => {
            const input = new TextDecoder().decode(data);
            sentInput.push(input);
            cursorCol -= input.split("\u001b[D").length - 1;
            return true;
          },
          followCursor: () => true,
          selectRange: (range: { ownerId: string; startCol: number; endCol: number }) => {
            ranges.push({ ownerId: range.ownerId, startCol: range.startCol, endCol: range.endCol });
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(
      routeCliShellKey(ctx, createTestKeyEvent({ name: "left", option: true, shift: true, sequence: "\u001bb" })),
    ).toBe(true);
    expect(
      routeCliShellKey(ctx, createTestKeyEvent({ name: "left", option: true, shift: true, sequence: "\u001bb" })),
    ).toBe(true);

    expect(ranges.at(0)).toEqual({
      ownerId: "terminal",
      startCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("beta")),
      endCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("gamma")),
    });
    expect(ranges.at(1)).toEqual({
      ownerId: "terminal",
      startCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("alpha")),
      endCol: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("gamma")),
    });
    expect(sentInput.length).toBe(2);
  });

  test("Scenario: Given the shell viewport is scrolled When Option Shift Left selects by word Then cli-shell sends the absolute backend row", () => {
    const visibleLine = "$ echo alpha beta gamma";
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["row-0", "row-1", visibleLine, "row-3"],
      roomMessages: [],
      unread: 0,
    });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const ranges: Array<{ ownerId: string; startRow: number; startCol: number; endRow: number; endCol: number }> = [];
    const keybindings = resolveCliShellTuiKeybindings(null);
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
      interactionProfile: {
        semanticWordSelection: true,
        semanticRowSelection: true,
        wordNavigation: true,
        followCursorOnInput: true,
        homeEndFallback: true,
      },
    });
    const cursorCol = stringIndexToTerminalColumn(visibleLine, visibleLine.indexOf("gamma"));
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [visibleLine],
          cursorAbsRow: 3,
          viewportStart: 3,
          cursorCol,
        },
      }),
      getLiveMirror: () =>
        ({
          sendInputBytes: () => true,
          followCursor: () => true,
          selectRange: (range: {
            ownerId: string;
            startRow: number;
            startCol: number;
            endRow: number;
            endCol: number;
          }) => {
            ranges.push(range);
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(
      routeCliShellKey(ctx, createTestKeyEvent({ name: "left", option: true, shift: true, sequence: "\u001bb" })),
    ).toBe(true);

    expect(ranges).toEqual([
      {
        ownerId: "terminal",
        startRow: 3,
        startCol: stringIndexToTerminalColumn(visibleLine, visibleLine.indexOf("beta")),
        endRow: 3,
        endCol: stringIndexToTerminalColumn(visibleLine, visibleLine.indexOf("gamma")),
      },
    ]);
  });

  test("Scenario: Given word selection has an anchor When plain terminal input is routed Then cli-shell resets the keyboard selection anchor", () => {
    const wordLine = "$ echo alpha beta gamma";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
      terminalSelectionAnchor: {
        row: 0,
        col: stringIndexToTerminalColumn(wordLine, wordLine.indexOf("gamma")),
      },
    };
    const keybindings = resolveCliShellTuiKeybindings(null);
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
    });
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => baseModel,
      getLiveMirror: () =>
        ({
          sendInputBytes: () => true,
          followCursor: () => true,
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellKey(ctx, createTestKeyEvent({ name: "a", sequence: "a", raw: "a" }))).toBe(true);

    expect(viewState.terminalSelectionAnchor).toBeUndefined();
  });

  test("Scenario: Given backend selection is active When plain terminal input is routed Then cli-shell clears backend selection before sending input bytes", () => {
    const state = createRuntimeState({ heartbeat: [], lines: ["$ echo hello"], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const actions: string[] = [];
    const keybindings = resolveCliShellTuiKeybindings(null);
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
    });
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => baseModel,
      getLiveMirror: () =>
        ({
          clearSelection: (ownerId?: string) => {
            actions.push(`clear:${ownerId ?? "all"}`);
            return true;
          },
          sendInputBytes: (data: Uint8Array) => {
            actions.push(`input:${new TextDecoder().decode(data)}`);
            return true;
          },
          followCursor: () => {
            actions.push("follow");
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellKey(ctx, createTestKeyEvent({ name: "a", sequence: "a", raw: "a" }))).toBe(true);

    expect(actions).toEqual(["clear:terminal", "input:a", "follow"]);
  });

  test("Scenario: Given Option Shift selection is extending When cursor movement bytes are routed Then cli-shell keeps backend selection active", () => {
    const wordLine = "$ echo alpha beta";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const actions: string[] = [];
    const keybindings = resolveCliShellTuiKeybindings(null);
    const cursorCol = stringIndexToTerminalColumn(wordLine, wordLine.indexOf("beta"));
    const baseModel = buildCliShellTuiModel({
      state,
      projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: viewState,
      keybindings,
      width: 120,
      height: 40,
      interactionProfile: {
        semanticWordSelection: true,
        semanticRowSelection: true,
        wordNavigation: true,
        followCursorOnInput: true,
        homeEndFallback: true,
      },
    });
    const ctx = {
      store: createTuiStore({ state }).store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () => ({
        ...baseModel,
        terminalView: {
          ...baseModel.terminalView,
          plainLines: [wordLine],
          cursorAbsRow: 0,
          viewportStart: 0,
          cursorCol,
        },
      }),
      getLiveMirror: () =>
        ({
          clearSelection: (ownerId?: string) => {
            actions.push(`clear:${ownerId ?? "all"}`);
            return true;
          },
          selectRange: () => {
            actions.push("select-range");
            return true;
          },
          sendInputBytes: (data: Uint8Array) => {
            actions.push(`input:${new TextDecoder().decode(data)}`);
            return true;
          },
          followCursor: () => {
            actions.push("follow");
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(
      routeCliShellKey(ctx, createTestKeyEvent({ name: "left", option: true, shift: true, sequence: "\u001bb" })),
    ).toBe(true);

    expect(actions).toEqual(["select-range", `input:${"\u001b[D".repeat(6)}`, "follow"]);
  });

  test("Scenario: Given real terminal Shift Option Left Right sequences When routed through key input Then cli-shell sends backend selection ranges instead of plain word jumps", async () => {
    const wordLine = "$ echo hello world ok";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    const lineStartCol = stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world"));
    const lineEndCol = stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok"));
    const shellEntry = createGlobalTerminalEntry("shell-1", [wordLine]);
    state.globalTerminals = createCached([
      {
        ...shellEntry,
        snapshot: shellEntry.snapshot
          ? {
              ...shellEntry.snapshot,
              cursor: { ...shellEntry.snapshot.cursor, x: lineEndCol, y: 0, visible: true, absY: 0 },
            }
          : shellEntry.snapshot,
      },
    ]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const setup = await createCoreAppTestSetup({
      state,
      width: 120,
      height: 8,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    setup.renderer.keyInput.processParsedKey({
      name: "left",
      ctrl: false,
      meta: true,
      shift: true,
      option: true,
      sequence: "\x1b[1;4D",
      raw: "\x1b[1;4D",
      number: false,
      eventType: "press",
      source: "raw",
    });

    expect(sentMessages).toContainEqual({
      type: "selectRange",
      range: {
        ownerId: "terminal",
        startRow: 0,
        startCol: lineStartCol,
        endRow: 0,
        endCol: lineEndCol,
      },
    });
    expect(sentMessages.some((message) => message.type === "inputBytes")).toBe(true);
    setup.destroy();
  });

  test("Scenario: Given OpenTUI parses Option Shift as meta uppercase letters When routed through key input Then cli-shell extends backend selection instead of plain word jumps", async () => {
    const wordLine = "$ echo hello world ok";
    const state = createRuntimeState({ heartbeat: [], lines: [wordLine], roomMessages: [], unread: 0 });
    const lineStartCol = stringIndexToTerminalColumn(wordLine, wordLine.indexOf("world"));
    const lineEndCol = stringIndexToTerminalColumn(wordLine, wordLine.indexOf("ok"));
    const shellEntry = createGlobalTerminalEntry("shell-1", [wordLine]);
    state.globalTerminals = createCached([
      {
        ...shellEntry,
        snapshot: shellEntry.snapshot
          ? {
              ...shellEntry.snapshot,
              cursor: { ...shellEntry.snapshot.cursor, x: lineEndCol, y: 0, visible: true, absY: 0 },
            }
          : shellEntry.snapshot,
      },
    ]);
    const sentMessages: TerminalTransportClientMessage[] = [];
    const setup = await createCoreAppTestSetup({
      state,
      width: 120,
      height: 8,
      createTransportSession: ({ events }) =>
        createTestTransportSession({
          async connect() {
            events.onOpen();
          },
          disconnect() {},
          send(message) {
            sentMessages.push(message);
            return true;
          },
          getConnectionState() {
            return "connected";
          },
        }),
    });

    await setup.renderOnce();
    const parsed = parseKeypress("\x1bB", { useKittyKeyboard: true });
    expect(parsed).toMatchObject({ name: "left", meta: true, shift: false, sequence: "\x1bB" });
    setup.renderer.keyInput.processParsedKey(parsed!);

    expect(sentMessages).toContainEqual({
      type: "selectRange",
      range: {
        ownerId: "terminal",
        startRow: 0,
        startCol: lineStartCol,
        endRow: 0,
        endCol: lineEndCol,
      },
    });
    setup.destroy();
  });

  test("Scenario: Given terminal input is rejected by a live mirror When a key is routed Then cli-shell does not request backend cursor follow", () => {
    const state = createRuntimeState({ heartbeat: [], lines: ["$ agenter shell"], roomMessages: [], unread: 0 });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      focusTarget: "terminal",
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    let followCursorCount = 0;
    const harness = createTuiStore({ state });
    const ctx = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings: resolveCliShellTuiKeybindings(null),
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state,
          projection: { roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings: resolveCliShellTuiKeybindings(null),
          width: 120,
          height: 40,
        }),
      getLiveMirror: () =>
        ({
          sendInputBytes: () => false,
          followCursor: () => {
            followCursorCount += 1;
            return true;
          },
        }) as never,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    };

    expect(routeCliShellKey(ctx, createTestKeyEvent({ name: "x", sequence: "x", raw: "x" }))).toBe(true);
    expect(followCursorCount).toBe(0);
    expect(harness.inputs.map((entry) => entry.text)).toEqual(["x"]);
  });

  test("Scenario: Given native OpenTUI controls receive dialogue input When the user opens types and submits dialogue Then visible control effects return through terminal-2 publication", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [],
      unread: 0,
    });
    const shellTerminalEntry = createGlobalTerminalEntry(
      "shell-1:terminal-1",
      state.globalTerminals.data[0]?.snapshot?.lines ?? [],
    );
    const visibleTerminalEntry = createCliShellTerminal2Entry({ lines: ["initial terminal-2"] });
    state.globalTerminals = createCached([shellTerminalEntry, visibleTerminalEntry]);
    const harness = createTuiStore({ state });
    const setup = await createCoreAppTestSetup({
      state,
      harness,
      fallbackTerminalId: "shell-1:terminal-2",
      width: 80,
      height: 18,
    });

    await setup.renderOnce();
    setup.mockInput.pressKey("j", { meta: true });
    setup.renderer.keyInput.processParsedKey(createTestKeyEvent({ name: "h", sequence: "h", raw: "h" }));
    setup.renderer.keyInput.processParsedKey(createTestKeyEvent({ name: "i", sequence: "i", raw: "i" }));
    await setup.renderOnce();
    await setup.renderOnce();

    const draftSurface = harness.lastPublishedComposedSurface;
    expect(draftSurface?.terminalId).toBe("shell-1:terminal-2");
    expect(draftSurface?.lines.join("\n")).toContain("> hi");

    setup.mockInput.pressEnter();
    await setup.renderOnce();
    await setup.renderOnce();

    expect(harness.sentMessages).toEqual([{ chatId: "room-shell-1", text: "hi" }]);
    expect(harness.lastPublishedComposedSurface?.lines.join("\n")).not.toContain("> hi");
    setup.destroy();
  });
});
