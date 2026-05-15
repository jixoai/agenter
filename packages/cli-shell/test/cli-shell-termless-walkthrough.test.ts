import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTerminal, createXtermBackend, termlessMatchers } from "@agenter/termless-core";

import {
  buildCliShellHostingContextId,
  type CliShellManagedState,
} from "../src";
import type {
  AttentionQueryItem,
  AuthSessionOutput,
  CachedResourceState,
  GlobalRoomEntry,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  ProductDelegationRecord,
  RuntimeClientState,
  SessionEntry,
} from "@agenter/client-sdk";
import type { CliShellTuiStore, CliShellTuiViewState } from "../src";

expect.extend(termlessMatchers);

const tempDirs: string[] = [];

function createCached<T>(data: T): CachedResourceState<T> {
  return {
    data,
    loaded: true,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: 0,
  };
}

function createSession(): SessionEntry {
  return {
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
  };
}

function createRoomEntry(chatId: string): GlobalRoomEntry {
  return {
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
  };
}

function createGlobalTerminalEntry(
  terminalId: string,
  lines: string[],
  input: {
    processKind?: "shell" | "product";
    metadata?: Record<string, unknown>;
    cols?: number;
    rows?: number;
    viewportOffset?: number;
  } = {},
): GlobalTerminalEntry {
  const cols = input.cols ?? 120;
  const rows = input.rows ?? 24;
  return {
    terminalId,
    processKind: input.processKind ?? "shell",
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
      cols,
      rows,
      lines,
      richLines: lines.map((text) => ({
        spans: text.length > 0 ? [{ text }] : [],
      })),
      cursor: { x: 0, y: Math.max(0, lines.length - 1), visible: true },
      scrollback: {
        viewportOffset: input.viewportOffset ?? Math.max(0, lines.length - rows),
        totalLines: lines.length,
        screenLines: rows,
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
    metadata: input.metadata ?? {},
  };
}

function createRoomMessage(input: {
  messageId: number;
  senderActorId: NonNullable<GlobalRoomMessage["senderActorId"]>;
  from: string;
  content: string;
  createdAt: number;
}): GlobalRoomMessage {
  return {
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
    unreadActorIds: [],
    metadata: {},
    attachments: [],
  };
}

function createRuntimeState(input: {
  shellLines: string[];
  visibleLines?: string[];
  roomMessages?: GlobalRoomMessage[];
  unread?: number;
  viewportOffset?: number;
}): RuntimeClientState {
  const sessionId = "session-1";
  const roomEntry = createRoomEntry("room-shell-1");
  const shellTerminalEntry = createGlobalTerminalEntry("shell-1:terminal-1", input.shellLines, {
    viewportOffset: input.viewportOffset,
  });
  const visibleTerminalEntry = createGlobalTerminalEntry(
    "shell-1:terminal-2",
    input.visibleLines ?? input.shellLines,
    {
      processKind: "product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
        composedDialogueOpen: false,
        composedDialoguePlacement: "right",
        composedDialogueDraft: "",
        composedBottomLine: "◉ terminal │ Avatar started │ 托管 off │ ✉ 0 M-J",
        composedManagedLabel: "托管 off",
        composedUnreadLabel: "✉ 0 M-J",
        composedHeartbeatLabel: "Avatar started",
        composedShellSnapshotSeq: shellTerminalEntry.snapshot?.seq ?? 0,
      },
      viewportOffset: input.viewportOffset,
    },
  );
  const terminalSnapshots = {
    "shell-1:terminal-1": shellTerminalEntry.snapshot!,
    "shell-1:terminal-2": visibleTerminalEntry.snapshot!,
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
        focusedTerminalId: "shell-1:terminal-2",
        focusedTerminalIds: ["shell-1:terminal-2"],
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
          terminal: { version: 1, timestamp: 1 },
          task: { version: 0, timestamp: null },
          attention: { version: 0, timestamp: null },
        },
        apiCallRecording: { enabled: false, refCount: 0 },
        attentionApi: null,
        terminals: [
          {
            terminalId: "shell-1:terminal-1",
            status: "IDLE",
            processPhase: "running",
            lifecycleTransition: null,
            seq: 2,
            launchCwd: "/repo",
          },
          {
            terminalId: "shell-1:terminal-2",
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
    globalTerminals: createCached([shellTerminalEntry, visibleTerminalEntry]),
    globalTerminalGrantsById: {},
    globalTerminalApprovalsById: {},
    globalTerminalActivityById: {},
    schedulerLogsBySession: { [sessionId]: [] },
    observabilityTracesBySession: { [sessionId]: [] },
    heartbeatGroupsBySession: { [sessionId]: createCached([]) },
    modelCallsBySession: { [sessionId]: [] },
    requestAuxBySession: { [sessionId]: [] },
    modelCallDeltasBySession: { [sessionId]: [] },
    apiCallsBySession: { [sessionId]: [] },
    terminalActivityBySession: { [sessionId]: {} },
    apiCallRecordingBySession: { [sessionId]: { enabled: false, refCount: 0 } },
    notifications: [],
    unreadBySession: { [sessionId]: input.unread ?? 0 },
    unreadByBucket: {},
  };
}

function createManagedState(input: {
  shellName?: string;
  hostingActive?: boolean;
  managed?: boolean;
} = {}): CliShellManagedState {
  return {
    contextId: buildCliShellHostingContextId(input.shellName ?? "shell-1"),
    hostingMatches: [],
    hostingActive: input.hostingActive ?? false,
    activeDelegation:
      input.managed === true
        ? ({
            delegationId: "delegation:cli-shell:shell-1",
            productId: "cli-shell",
            resourceKey: "shell-1",
            runtimeId: "runtime:shell-assistant",
            avatarActorId: "auth:shell-assistant",
            grantedByActorId: "auth:root-superadmin",
            terminalId: "shell-1:terminal-1",
            roomId: "room-shell-1",
            enabledAt: 100,
            expiresAt: 100 + 30 * 60 * 1000,
            policy: { mode: "write" },
            provenance: { source: "cli-shell" },
            status: "active",
          } as ProductDelegationRecord)
        : null,
    managed: input.managed ?? false,
  };
}

interface TransportHarness {
  state: RuntimeClientState;
  roomMessages: GlobalRoomMessage[];
  sentMessages: Array<{ chatId: string; text: string }>;
  viewportStarts: number[];
  resizeCalls: Array<{ terminalId: string; cols: number; rows: number }>;
  shellInputBytes: string[];
  attentionScores: Record<string, number>;
  delegations: ProductDelegationRecord[];
  publishSurfaceCalls: number;
  lastBottomLine: string | null;
  lastDialogueOpen: boolean | null;
  lastDialoguePlacement: string | null;
  lastManagedLabel: string | null;
  lastCursorVisible: boolean | null;
}

function createTuiHarnessStore(
  initialState: RuntimeClientState,
): { store: CliShellTuiStore; harness: TransportHarness } {
  let state = initialState;
  const listeners = new Set<(state: RuntimeClientState) => void>();
  const sentMessages: Array<{ chatId: string; text: string }> = [];
  const viewportStarts: number[] = [];
  const resizeCalls: Array<{ terminalId: string; cols: number; rows: number }> = [];
  const shellInputBytes: string[] = [];
  const attentionScores: Record<string, number> = {};
  let delegations: ProductDelegationRecord[] = [];
  let publishSurfaceCalls = 0;
  let lastBottomLine: string | null = null;
  let lastDialogueOpen: boolean | null = null;
  let lastDialoguePlacement: string | null = null;
  let lastManagedLabel: string | null = null;
  let lastCursorVisible: boolean | null = null;
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
      listener(state);
    }
  };

  const createAttentionItem = (contextId: string, score: number): AttentionQueryItem => ({
    contextId,
    context: {
      contextId,
      owner: "cli-shell",
      focusState: "focused",
      content: contextId,
      contentFormat: "text/plain",
      scoreMap: {
        hosting: score,
      },
      consumedPushCommitIds: [],
      headCommitId: `commit:${contextId}`,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    } satisfies AttentionQueryItem["context"],
    commit: {
      commitId: `commit:${contextId}`,
      contextId,
      ingressType: "commit",
      parentCommitIds: [],
      scores: {
        hosting: score,
      },
      meta: {
        author: "cli-shell",
        source: "walkthrough",
      },
      summary: contextId,
      change: {
        type: "clean",
      },
      createdAt: new Date(0).toISOString(),
    } satisfies AttentionQueryItem["commit"],
  });

  const updateVisibleTerminalSnapshot = (
    updater: (entry: GlobalTerminalEntry) => GlobalTerminalEntry,
  ) => {
    state = {
      ...state,
      globalTerminals: createCached(
        state.globalTerminals.data.map((entry) =>
          entry.terminalId === "shell-1:terminal-2" ? updater(entry) : entry
        ),
      ),
    };
  };

  const harness: TransportHarness = {
    get state() {
      return state;
    },
    roomMessages: [],
    sentMessages,
    viewportStarts,
    resizeCalls,
    shellInputBytes,
    attentionScores,
    get delegations() {
      return delegations;
    },
    get publishSurfaceCalls() {
      return publishSurfaceCalls;
    },
    get lastBottomLine() {
      return lastBottomLine;
    },
    get lastDialogueOpen() {
      return lastDialogueOpen;
    },
    get lastDialoguePlacement() {
      return lastDialoguePlacement;
    },
    get lastManagedLabel() {
      return lastManagedLabel;
    },
    get lastCursorVisible() {
      return lastCursorVisible;
    },
  };

  const store: CliShellTuiStore = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect: async () => {},
    disconnect: () => {},
    hydrateSessionArtifacts: async () => undefined,
    retainGlobalTerminals: () => () => {},
    hydrateGlobalTerminals: async () => state.globalTerminals.data,
    readGlobalTerminal: async (payload) => {
      const terminal = state.globalTerminals.data.find((entry) => entry.terminalId === payload.terminalId);
      if (!terminal?.snapshot) {
        throw new Error(`terminal snapshot missing: ${payload.terminalId}`);
      }
      return {
        kind: "terminal-snapshot" as const,
        terminalId: payload.terminalId,
        representation: "snapshot" as const,
        snapshot: terminal.snapshot,
        status: terminal.status,
        processPhase: terminal.processPhase,
      };
    },
    retainGlobalRoomSnapshot: () => () => {},
    hydrateGlobalRoomSnapshot: async () =>
      state.globalRoomSnapshotsById["room-shell-1"]?.data ?? {
        channel: createRoomEntry("room-shell-1"),
        items: [],
        nextBefore: null,
        hasMoreBefore: false,
        headVersion: "0",
      },
    sendGlobalRoomMessage: async (payload: { chatId: string; text: string }) => {
      sentMessages.push({ chatId: payload.chatId, text: payload.text });
      const nextMessage = createRoomMessage({
        messageId: 100 + sentMessages.length,
        senderActorId: "auth:user",
        from: "you",
        content: payload.text,
        createdAt: 1_714_560_000_000 + sentMessages.length * 60_000,
      });
      harness.roomMessages.push(nextMessage);
      state = {
        ...state,
        globalRoomSnapshotsById: {
          ...state.globalRoomSnapshotsById,
          "room-shell-1": createCached({
            channel: createRoomEntry("room-shell-1"),
            items: [...harness.roomMessages],
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: "1",
          }),
        },
      };
      emit();
      return { ok: true };
    },
    inputGlobalTerminal: async (payload) => {
      shellInputBytes.push(`${payload.terminalId}:${payload.text}`);
      return { ok: true as const, message: "ok" };
    },
    setGlobalTerminalConfig: async (payload) => {
      resizeCalls.push({
        terminalId: payload.terminalId,
        cols: payload.cols ?? 0,
        rows: payload.rows ?? 0,
      });
      const terminal = state.globalTerminals.data.find((entry) => entry.terminalId === payload.terminalId);
      return {
        config: {
          terminalId: payload.terminalId,
          processKind: terminal?.processKind ?? "shell",
          backend: terminal?.backend ?? "xterm",
          command: terminal?.command ?? ["/bin/bash"],
          launchCwd: terminal?.launchCwd ?? "/repo",
          profile: {
            cols: payload.cols,
            rows: payload.rows,
            icon: terminal?.icon,
            title: terminal?.configuredTitle,
            shortcuts: terminal?.shortcuts,
            rendererPreference: terminal?.rendererPreference,
            theme: terminal?.theme,
            cursor: terminal?.cursor,
            font: terminal?.font,
          },
          metadata: terminal?.metadata ?? {},
          processPhase: terminal?.processPhase ?? "running",
          lifecycleTransition: null,
        },
        appliedLiveFields: ["cols", "rows"],
        nextBootstrapFields: [],
      };
    },
    publishGlobalTerminalComposedSurface: async (payload: {
      terminalId: string;
      surface: {
        cols: number;
        rows: number;
        terminalLines: string[];
        terminalRichLines?: Array<{ spans: Array<{ text: string; fg?: string; bg?: string }> }>;
        cursor: { x: number; y: number; visible?: boolean };
        scrollback: {
          viewportOffset: number;
          totalLines: number;
          screenLines: number;
        };
        dialogueOpen: boolean;
        dialoguePlacement: string | null;
        dialogueDraft: string;
        bottomLine: string;
        managedLabel: string;
        unreadLabel: string;
        heartbeatLabel: string;
        shellSnapshotSeq: number;
      };
    }) => {
      publishSurfaceCalls += 1;
      lastBottomLine = payload.surface.bottomLine;
      lastDialogueOpen = payload.surface.dialogueOpen;
      lastDialoguePlacement = payload.surface.dialoguePlacement;
      lastManagedLabel = payload.surface.managedLabel;
      lastCursorVisible = payload.surface.cursor.visible ?? null;
      updateVisibleTerminalSnapshot((entry) => ({
        ...entry,
        seq: entry.seq + 1,
        metadata: {
          ...entry.metadata,
          composedDialogueOpen: payload.surface.dialogueOpen,
          composedDialoguePlacement: payload.surface.dialoguePlacement,
          composedDialogueDraft: payload.surface.dialogueDraft,
          composedBottomLine: payload.surface.bottomLine,
          composedManagedLabel: payload.surface.managedLabel,
          composedUnreadLabel: payload.surface.unreadLabel,
          composedHeartbeatLabel: payload.surface.heartbeatLabel,
          composedShellSnapshotSeq: payload.surface.shellSnapshotSeq,
        },
        snapshot: {
          seq: (entry.snapshot?.seq ?? 0) + 1,
          timestamp: Date.now(),
          cols: payload.surface.cols,
          rows: payload.surface.rows,
          lines: [...payload.surface.terminalLines],
          richLines: payload.surface.terminalRichLines?.map((line) => ({
            spans: line.spans.map((span) => ({ ...span })),
          })),
          cursor: { ...payload.surface.cursor },
          scrollback: { ...payload.surface.scrollback },
        },
      }));
      emit();
      return state.globalTerminals.data.find((entry) => entry.terminalId === payload.terminalId)!;
    },
    readSettings: async () => ({
      path: "/tmp/settings.json",
      content: "",
      mtimeMs: 1,
    }),
    getAuthSession: async () => authSession,
    grantGlobalTerminalWriteLease: async (payload) => ({
      leaseId: `lease:${payload.terminalId}:${payload.participantId}`,
      participantId: payload.participantId,
      expiresAt: Date.now() + payload.durationMs,
    }),
    revokeGlobalTerminalWriteLease: async () => ({ ok: true as const, revokedCount: 1 }),
    queryAttention: async (payload: { sessionId: string; query: string }): Promise<AttentionQueryItem[]> => {
      void payload.sessionId;
      const contextId = payload.query.match(/contextId:([^\s]+)/)?.[1] ?? buildCliShellHostingContextId("shell-1");
      const score = attentionScores[contextId] ?? 0;
      return score > 0 ? [createAttentionItem(contextId, score)] : [];
    },
    commitAttention: async (payload: {
      sessionId: string;
      contextId: string;
      scores?: Record<string, number>;
    }) => {
      void payload.sessionId;
      attentionScores[payload.contextId] = payload.scores?.hosting ?? 0;
      return { commit: payload };
    },
    settleAttention: async (payload: {
      sessionId: string;
      contextId: string;
      scores?: Record<string, number>;
    }) => {
      void payload.sessionId;
      attentionScores[payload.contextId] = payload.scores?.hosting ?? 0;
      return { commit: payload };
    },
    listProductDelegations: async () => [...delegations],
    createProductDelegation: async (payload: Omit<ProductDelegationRecord, "delegationId" | "status">) => {
      const delegation =
        ({
        ...payload,
        delegationId: `delegation:${payload.productId}:${payload.resourceKey}`,
        status: "active",
      }) as ProductDelegationRecord;
      delegations = [...delegations.filter((item) => item.status !== "active"), delegation];
      return delegation;
    },
    revokeProductDelegation: async (payload: { delegationId: string; revokedAt: number; revokedReason: string }) => {
      const delegation = delegations.find((item) => item.delegationId === payload.delegationId);
      if (!delegation) {
        throw new Error(`unknown delegation: ${payload.delegationId}`);
      }
      const revoked = {
        ...delegation,
        status: "revoked",
        revokedAt: payload.revokedAt,
        revokedReason: payload.revokedReason,
      } as ProductDelegationRecord;
      delegations = delegations.map((item) => (item.delegationId === payload.delegationId ? revoked : item));
      return revoked;
    },
  };

  return { store, harness };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

interface WalkthroughStateSnapshot {
  tag: string;
  viewportStarts: number[];
  resizeCalls: Array<{ terminalId: string; cols: number; rows: number }>;
  sentMessages: Array<{ chatId: string; text: string }>;
  publishSurfaceCalls: number;
  shellInputBytes: string[];
  attentionScores: Record<string, number>;
  delegations: Array<{ delegationId: string; status: string }>;
  lastBottomLine: string | null;
  lastDialogueOpen: boolean | null;
  lastDialoguePlacement: string | null;
  lastManagedLabel: string | null;
  lastCursorVisible: boolean | null;
}

function readWalkthroughStateSnapshot(statePath: string): {
  snapshot: WalkthroughStateSnapshot | null;
  raw: string;
} {
  if (!existsSync(statePath)) {
    return {
      snapshot: null,
      raw: "",
    };
  }
  const raw = readFileSync(statePath, "utf8");
  return {
    snapshot: JSON.parse(raw) as WalkthroughStateSnapshot,
    raw,
  };
}

async function waitForWalkthroughSnapshot(
  statePath: string,
  predicate: (snapshot: WalkthroughStateSnapshot) => boolean,
  input: {
    description: string;
    timeoutMs?: number;
  },
): Promise<WalkthroughStateSnapshot> {
  const timeoutMs = input.timeoutMs ?? 5_000;
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot: WalkthroughStateSnapshot | null = null;
  let lastRaw = "";
  while (Date.now() < deadline) {
    try {
      const { snapshot, raw } = readWalkthroughStateSnapshot(statePath);
      lastRaw = raw;
      if (snapshot) {
        lastSnapshot = snapshot;
        if (predicate(snapshot)) {
          return snapshot;
        }
      }
    } catch {
      // The sidecar file is rewritten in-place by the walkthrough process.
    }
    await Bun.sleep(50);
  }
  throw new Error(
    [
      `Timed out waiting for walkthrough snapshot: ${input.description}`,
      `statePath: ${statePath}`,
      `lastSnapshot: ${lastSnapshot ? JSON.stringify(lastSnapshot) : "<none>"}`,
      `lastRaw: ${lastRaw || "<empty>"}`,
    ].join("\n"),
  );
}

async function waitForWalkthroughState(
  statePath: string,
  tag: string,
  timeoutMs = 5_000,
): Promise<WalkthroughStateSnapshot> {
  return waitForWalkthroughSnapshot(statePath, (snapshot) => snapshot.tag === tag, {
    description: `tag=${tag}`,
    timeoutMs,
  });
}

const createWalkthroughScript = (
  filePath: string,
  supportPath: string,
  statePath: string,
): void => {
  writeFileSync(
    filePath,
    `
import { writeFileSync } from "node:fs";
import { createCliRenderer } from "@opentui/core";
import { CliShellCoreApp, resolveCliShellTuiKeybindings } from "${join(import.meta.dir, "..", "src", "index.ts").replace(/\\/g, "/")}";
import type { TerminalTransportClientMessage, TerminalTransportClientSession, TerminalTransportSnapshot } from "@agenter/terminal-transport-protocol";
import { createHarnessStore, createHarnessState, createManagedState, flushHarnessPromises } from "${supportPath.replace(/\\/g, "/")}";

const shellLines = Array.from({ length: 50 }, (_, index) => index === 0 ? "$ agenter shell" : index === 1 ? "shell-1:~/project $" : \`scrollback-\${index.toString().padStart(2, "0")}\`);
const { store, harness } = createHarnessStore(createHarnessState({ shellLines, visibleLines: shellLines }));
const renderer = await createCliRenderer({ exitOnCtrlC: false, useMouse: true });
const statePath = "${statePath.replace(/\\/g, "/")}";

let sourceSnapshot = {
  seq: 2,
  timestamp: Date.now(),
  cols: 80,
  rows: 23,
  lines: [...shellLines],
  richLines: shellLines.map((text) => ({
    spans: text.length > 0 ? [{ text }] : [],
  })),
  cursor: { x: 0, y: shellLines.length - 1, visible: true },
  scrollback: {
    viewportOffset: 26,
    totalLines: shellLines.length,
    screenLines: 23,
  },
} satisfies TerminalTransportSnapshot;

type CliShellTuiTransportEvents = {
  onOpen: () => void;
  onClose: () => void;
  onError: () => void;
  onMessage: (message: unknown) => void;
};

const publishSourceSnapshot = (events: CliShellTuiTransportEvents, snapshot: TerminalTransportSnapshot) => {
  events.onMessage({
    type: "frame",
    terminalId: "shell-1:terminal-1",
    frameSeq: snapshot.seq,
    status: "IDLE",
    patch: {
      type: "full",
      frame: snapshot,
    },
  });
};

const createCliShellTuiTransportSession = (input: {
  terminalId?: string;
  geometryRole?: "projection-only" | "authority";
  events: CliShellTuiTransportEvents;
}): TerminalTransportClientSession => {
  const sendTransportMessage = (message: TerminalTransportClientMessage): boolean => {
    if (input.terminalId !== "shell-1:terminal-1") {
      return true;
    }
    if (message.type === "resize") {
      sourceSnapshot = {
        ...sourceSnapshot,
        seq: sourceSnapshot.seq + 1,
        timestamp: Date.now(),
        cols: message.cols,
        rows: message.rows,
        scrollback: {
          ...sourceSnapshot.scrollback,
          screenLines: message.rows,
        },
      };
      harness.resizeCalls.push({
        terminalId: "shell-1:terminal-1",
        cols: message.cols,
        rows: message.rows,
      });
      publishSourceSnapshot(input.events, sourceSnapshot);
      return true;
    }
    if (message.type === "viewportDelta") {
      sourceSnapshot = {
        ...sourceSnapshot,
        seq: sourceSnapshot.seq + 1,
        timestamp: Date.now(),
        scrollback: {
          ...sourceSnapshot.scrollback,
          viewportOffset: Math.max(0, sourceSnapshot.scrollback.viewportOffset + message.deltaRows),
        },
      };
      harness.viewportStarts.push(sourceSnapshot.scrollback.viewportOffset);
      publishSourceSnapshot(input.events, sourceSnapshot);
      return true;
    }
    if (message.type === "viewportTarget") {
      sourceSnapshot = {
        ...sourceSnapshot,
        seq: sourceSnapshot.seq + 1,
        timestamp: Date.now(),
        scrollback: {
          ...sourceSnapshot.scrollback,
          viewportOffset: Math.max(0, message.viewportStart),
        },
      };
      harness.viewportStarts.push(sourceSnapshot.scrollback.viewportOffset);
      publishSourceSnapshot(input.events, sourceSnapshot);
      return true;
    }
    if (message.type === "inputBytes") {
      harness.shellInputBytes.push(\`shell-1:terminal-1:\${new TextDecoder().decode(message.data)}\`);
      return true;
    }
    return true;
  };
  return {
    async connect(): Promise<void> {
      input.events.onOpen();
      if (input.terminalId === "shell-1:terminal-1") {
        publishSourceSnapshot(input.events, sourceSnapshot);
      }
    },
    disconnect(): void {
      input.events.onClose();
    },
    send: sendTransportMessage,
    sendInputBytes(data: Uint8Array): boolean {
      return sendTransportMessage({ type: "inputBytes", data });
    },
    resize(cols: number, rows: number): boolean {
      return sendTransportMessage({ type: "resize", cols, rows });
    },
    scrollViewport(deltaRows: number): boolean {
      return sendTransportMessage({ type: "viewportDelta", deltaRows });
    },
    setViewportStart(viewportStart: number): boolean {
      return sendTransportMessage({ type: "viewportTarget", viewportStart });
    },
    pullFrame(inputFrame: { lastAppliedFrameSeq: number; cols: number; rows: number; maxPatchBytes?: number }): boolean {
      if (input.terminalId !== "shell-1:terminal-1") {
        return true;
      }
      publishSourceSnapshot(input.events, {
        ...sourceSnapshot,
        cols: inputFrame.cols,
        rows: inputFrame.rows,
        scrollback: {
          ...sourceSnapshot.scrollback,
          screenLines: inputFrame.rows,
        },
      });
      return true;
    },
    getConnectionState() {
      return "connected";
    },
  };
};

let app = null;
let shuttingDown = false;

const shutdown = () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  app?.dispose();
  renderer.destroy();
  process.exit(0);
};

app = new CliShellCoreApp({
  renderer,
  store,
  sessionId: "session-1",
  shellName: "shell-1",
  fallbackTerminalId: "shell-1:terminal-2",
  roomChatId: "room-shell-1",
  roomAccessToken: "tok:room-shell-1",
  runtimeId: "runtime:shell-assistant",
  avatarActorId: "auth:shell-assistant",
  managed: createManagedState(),
  keybindings: resolveCliShellTuiKeybindings(null),
  onQuit: shutdown,
  observationReadyBaseline: { version: 0, timestamp: null },
  createTransportSession: ({ terminalId, geometryRole, events }) =>
    createCliShellTuiTransportSession({
      terminalId,
      geometryRole,
      events,
    }),
});
app.start();

const emit = (tag) => {
  writeFileSync(statePath, JSON.stringify({
    tag,
    viewportStarts: harness.viewportStarts,
    resizeCalls: harness.resizeCalls,
    sentMessages: harness.sentMessages,
    publishSurfaceCalls: harness.publishSurfaceCalls,
    shellInputBytes: harness.shellInputBytes,
    attentionScores: harness.attentionScores,
    delegations: harness.delegations.map((delegation) => ({
      delegationId: delegation.delegationId,
      status: delegation.status,
    })),
    lastBottomLine: harness.lastBottomLine,
    lastDialogueOpen: harness.lastDialogueOpen,
    lastDialoguePlacement: harness.lastDialoguePlacement,
    lastManagedLabel: harness.lastManagedLabel,
    lastCursorVisible: harness.lastCursorVisible,
  }), "utf8");
};

await flushHarnessPromises();
emit("ready");
process.stdout.write("READY\\n");

setInterval(() => {
  emit("tick");
}, 25);

await new Promise(() => {});
	`,
    "utf8",
  );
};

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Feature: cli-shell termless walkthrough", () => {
  test("Scenario: Given cli-shell runs inside a termless PTY When dialogue managed placement close send and scrollbar flows are exercised Then native product contracts stay visible through one terminal surface", async () => {
    const tempDir = mkdtempSync(join(import.meta.dir, "..", ".tmp-agenter-cli-shell-termless-"));
    tempDirs.push(tempDir);
    const supportDir = join(tempDir, "support");
    const entryPath = join(tempDir, "walkthrough.ts");
    const statePath = join(tempDir, "walkthrough-state.json");
    const supportPath = join(supportDir, "cli-shell-termless-harness.ts");
    mkdirSync(supportDir, { recursive: true });
    writeFileSync(
      supportPath,
      `
import type {
  AttentionQueryItem,
  AuthSessionOutput,
  CachedResourceState,
  GlobalRoomEntry,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  GlobalTerminalEntry,
  ProductDelegationRecord,
  RuntimeClientState,
  SessionEntry,
} from "@agenter/client-sdk";
import type { CliShellTuiStore } from "${join(import.meta.dir, "..", "src", "index.ts").replace(/\\/g, "/")}";
import { buildCliShellHostingContextId, type CliShellManagedState } from "${join(import.meta.dir, "..", "src", "index.ts").replace(/\\/g, "/")}";

${createCached.toString()}
${createSession.toString()}
${createRoomEntry.toString()}
${createGlobalTerminalEntry.toString()}
${createRoomMessage.toString()}
${createRuntimeState.toString().replace("createRuntimeState", "createHarnessState")}
${createManagedState.toString()}
${createTuiHarnessStore.toString().replace("createTuiHarnessStore", "createHarnessStore")}
${flushPromises.toString().replace("flushPromises", "flushHarnessPromises")}
export { createHarnessStore, createHarnessState, createManagedState, flushHarnessPromises };
`,
      "utf8",
    );
    createWalkthroughScript(entryPath, supportPath, statePath);

    const term = createTerminal({
      backend: createXtermBackend(),
      cols: 80,
      rows: 24,
      scrollbackLimit: 1_000,
    });
    await term.spawn(["bun", entryPath], {
      cwd: "/Users/kzf/Dev/GitHub/jixoai-labs/agenter",
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      },
    });

    try {
    await term.waitFor("Avatar started", 15_000);
      await waitForWalkthroughSnapshot(
        statePath,
        (snapshot) => snapshot.tag === "ready" || snapshot.tag === "tick",
        {
          description: "startup state sidecar",
          timeoutMs: 15_000,
        },
      );
    } catch (error) {
      throw new Error(
        [
          error instanceof Error ? error.message : String(error),
          "screen:",
          term.screen.getText(),
          "buffer:",
          term.buffer.getText(),
        ].join("\n---\n"),
      );
    }

    const startupState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) =>
        snapshot.lastDialogueOpen === false &&
        snapshot.lastDialoguePlacement === null &&
        (snapshot.lastBottomLine?.includes("Avatar started") ?? false) &&
        (snapshot.lastBottomLine?.includes("托管 off") ?? false),
      {
        description: "collapsed startup shell-first state",
      },
    );
    expect(startupState.lastBottomLine).toContain("Avatar started");
    expect(startupState.lastBottomLine).toContain("托管 off");
    expect(startupState.lastBottomLine).toContain("✉ 0 M-J");
    expect(term.screen.getText()).not.toContain("layout");

    term.press("Meta+j");
    const openedState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) => snapshot.lastDialogueOpen === true && snapshot.lastDialoguePlacement === "right",
      {
        description: "dialogue open on right",
      },
    );
    expect(openedState.lastDialogueOpen).toBe(true);
    await term.waitFor("[Send]", 5_000);

    term.type("termless-message");
    try {
      await term.waitFor("termless-message", 5_000);
    } catch (error) {
      const snapshot = await waitForWalkthroughSnapshot(statePath, () => true, {
        description: "post-type diagnostic snapshot",
        timeoutMs: 1_000,
      });
      throw new Error(
        [
          error instanceof Error ? error.message : String(error),
          `diagnostic: ${JSON.stringify(snapshot)}`,
          "screen:",
          term.screen.getText(),
          "buffer:",
          term.buffer.getText(),
        ].join("\n---\n"),
      );
    }

    term.press("Enter");
    const sendState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) =>
        snapshot.sentMessages.at(-1)?.chatId === "room-shell-1" &&
        snapshot.sentMessages.at(-1)?.text === "termless-message",
      {
        description: "dialogue send acknowledgement",
      },
    );
    expect(sendState.sentMessages.at(-1)).toEqual({ chatId: "room-shell-1", text: "termless-message" });

    const preManagedState = await waitForWalkthroughSnapshot(statePath, () => true, {
      description: "pre-managed snapshot",
    });
    term.press("Meta+m");
    const managedOnState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) =>
        snapshot.attentionScores[buildCliShellHostingContextId("shell-1")] === 1000 &&
        snapshot.delegations.some((delegation) => delegation.status === "active") &&
        snapshot.publishSurfaceCalls > preManagedState.publishSurfaceCalls &&
        (snapshot.lastBottomLine?.includes("托管 on") ?? false) &&
        snapshot.lastManagedLabel === "托管 on",
      {
        description: "managed mode enabled",
      },
    );
    expect(managedOnState.lastManagedLabel).toBe("托管 on");
    expect(managedOnState.lastBottomLine).toContain("✉ 0 M-J");
    expect(term.screen.getText()).toContain("on");

    const preManagedOffState = await waitForWalkthroughSnapshot(statePath, () => true, {
      description: "pre-managed-off snapshot",
    });
    term.press("Meta+m");
    const managedOffState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) =>
        snapshot.attentionScores[buildCliShellHostingContextId("shell-1")] === 0 &&
        snapshot.delegations.some((delegation) => delegation.status === "revoked") &&
        snapshot.publishSurfaceCalls > preManagedOffState.publishSurfaceCalls &&
        snapshot.lastManagedLabel === "托管 off" &&
        (snapshot.lastBottomLine?.includes("托管 off") ?? false),
      {
        description: "managed mode disabled",
      },
    );
    expect(managedOffState.lastManagedLabel).toBe("托管 off");

    term.press("Meta+l");
    const leftPlacementState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) => snapshot.lastDialogueOpen === true && snapshot.lastDialoguePlacement === "left",
      {
        description: "dialogue placed left",
      },
    );
    expect(leftPlacementState.lastDialoguePlacement).toBe("left");

    term.press("Meta+f");
    const floatingPlacementState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) => snapshot.lastDialogueOpen === true && snapshot.lastDialoguePlacement === "floating",
      {
        description: "dialogue placed floating",
      },
    );
    expect(floatingPlacementState.lastDialoguePlacement).toBe("floating");

    const preCloseState = await waitForWalkthroughSnapshot(statePath, () => true, {
      description: "pre-close snapshot",
    });
    term.press("Escape");
    const closedState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) =>
        snapshot.publishSurfaceCalls > preCloseState.publishSurfaceCalls &&
        snapshot.lastDialogueOpen === false &&
        snapshot.lastDialoguePlacement === null,
      {
        description: "dialogue closed",
      },
    );
    expect(closedState.lastDialogueOpen).toBe(false);
    expect(closedState.lastDialoguePlacement).toBeNull();

    term.press("Meta+j");
    const reopenedState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) => snapshot.lastDialogueOpen === true && snapshot.lastDialoguePlacement === "floating",
      {
        description: "dialogue reopened with preserved placement",
      },
    );
    expect(reopenedState.lastDialogueOpen).toBe(true);
    expect(reopenedState.lastDialoguePlacement).toBe("floating");

    const preScrollState = await waitForWalkthroughSnapshot(statePath, () => true, {
      description: "pre-scroll snapshot",
    });
    term.click(79, 0);
    const scrolltopState = await waitForWalkthroughSnapshot(
      statePath,
      (snapshot) => snapshot.publishSurfaceCalls > preScrollState.publishSurfaceCalls,
      {
        description: `publishSurfaceCalls > ${preScrollState.publishSurfaceCalls}`,
      },
    );
    expect(Array.isArray(scrolltopState.viewportStarts)).toBe(true);
    expect(scrolltopState.publishSurfaceCalls).toBeGreaterThan(0);

    term.press("Ctrl+c");
    await term.close();
  }, 30_000);
});
