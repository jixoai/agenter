/** @jsxImportSource @opentui/react */

import { describe, expect, test } from "bun:test";
import type {
  AttentionQueryItem,
  AuthSessionOutput,
  CachedResourceState,
  GlobalRoomEntry,
  GlobalRoomMessage,
  GlobalRoomSnapshotOutput,
  HeartbeatGroupItem,
  HeartbeatPartItem,
  ProductDelegationRecord,
  RuntimeClientState,
  SessionEntry,
} from "@agenter/client-sdk";
import { KeyEvent } from "@opentui/core";

import {
  buildCliShellHostingContextId,
  buildCliShellTuiModel,
  layoutCliShellTuiFrame,
  measureTerminalText,
  routeCliShellKey,
  routeCliShellPaste,
  resolveCliShellDialoguePlacement,
  resolveCliShellToolbarStatus,
  resolveCliShellTuiKeybindings,
  syncCliShellTerminalGeometry,
  summarizeCliShellHeartbeat,
  type CliShellManagedState,
  type CliShellTuiStore,
  type CliShellTuiViewState,
} from "../src";

const createCached = <T,>(data: T): CachedResourceState<T> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: 0,
});

const createHeartbeatPart = (input: {
  messageId: string;
  partType: HeartbeatPartItem["parts"][number]["partType"];
  payload: unknown;
  text: string;
  isComplete?: boolean;
}): HeartbeatPartItem => ({
  id: 1,
  messageId: input.messageId,
  windowId: null,
  aiCallId: 41,
  roundIndex: 1,
  scope: "heartbeat_part",
  role: "assistant",
  createdAt: 10,
  updatedAt: 20,
  isComplete: input.isComplete ?? true,
  text: input.text,
  parts: [
    {
      partId: 1,
      partIndex: 0,
      messageId: input.messageId,
      windowId: null,
      aiCallId: 41,
      roundIndex: 1,
      scope: "heartbeat_part",
      role: "assistant",
      partType: input.partType,
      mimeType: null,
      payload: input.payload,
      createdAt: 10,
      updatedAt: 20,
      isComplete: input.isComplete ?? true,
    },
  ],
});

const createHeartbeatGroup = (item: HeartbeatPartItem): HeartbeatGroupItem => ({
  id: 41,
  groupId: "heartbeat-group:call:41",
  kind: "call",
  aiCallId: 41,
  createdAt: 10,
  updatedAt: 20,
  isComplete: item.isComplete,
  items: [item],
});

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

const createRoomMessage = (input: {
  messageId: number;
  senderActorId: NonNullable<GlobalRoomMessage["senderActorId"]>;
  from: string;
  content: string;
  createdAt: number;
  unreadActorIds?: string[];
  recalledAt?: number;
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
  ...(typeof input.recalledAt === "number" ? { recalledAt: input.recalledAt } : {}),
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
      cursor: { x: 0, y: Math.max(0, input.lines.length - 1) },
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
    globalTerminals: createCached([]),
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

const createManagedState = (input: {
  shellName?: string;
  hostingActive?: boolean;
  managed?: boolean;
} = {}): CliShellManagedState => ({
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
          terminalId: "shell-1",
          roomId: "room-shell-1",
          enabledAt: 100,
          expiresAt: 100 + 30 * 60 * 1000,
          policy: { mode: "write" },
          provenance: { source: "cli-shell" },
          status: "active",
        } as ProductDelegationRecord)
      : null,
  managed: input.managed ?? false,
});

interface TuiStoreHarness {
  store: CliShellTuiStore;
  inputs: Array<{ terminalId: string; text: string }>;
  terminalConfigs: Array<{ terminalId: string; cols?: number; rows?: number }>;
  sentMessages: Array<{ chatId: string; text: string }>;
  attentionScores: Record<string, number>;
  delegations: ProductDelegationRecord[];
  terminalWriteLeases: Array<{ leaseId: string; terminalId: string; participantId: string; revokedAt?: number }>;
}

const createAttentionItem = (contextId: string, score: number): AttentionQueryItem =>
  ({
    contextId,
    commit: {
      scores: {
        hosting: score,
      },
    },
  }) as unknown as AttentionQueryItem;

const createTuiStore = (input: {
  state: RuntimeClientState;
  settingsContent?: string;
}): TuiStoreHarness => {
  let state = input.state;
  const listeners = new Set<() => void>();
  const inputs: Array<{ terminalId: string; text: string }> = [];
  const terminalConfigs: Array<{ terminalId: string; cols?: number; rows?: number }> = [];
  const sentMessages: Array<{ chatId: string; text: string }> = [];
  const attentionScores: Record<string, number> = {};
  let delegations: ProductDelegationRecord[] = [];
  let terminalWriteLeases: Array<{ leaseId: string; terminalId: string; participantId: string; revokedAt?: number }> = [];
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

  const store = {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect: async () => {},
    disconnect: () => {},
    hydrateSessionArtifacts: async () => undefined,
    retainGlobalRoomSnapshot: () => () => {},
    hydrateGlobalRoomSnapshot: async () => getRoomSnapshot(),
    sendGlobalRoomMessage: async (payload: { chatId: string; text: string }) => {
      sentMessages.push({
        chatId: payload.chatId,
        text: payload.text,
      });
      const snapshot = getRoomSnapshot();
      const nextMessage = createRoomMessage({
        messageId: snapshot.items.length + 100,
        senderActorId: "auth:user",
        from: "you",
        content: payload.text,
        createdAt: 1_714_560_000_000 + snapshot.items.length * 60_000,
      });
      const nextSnapshot: GlobalRoomSnapshotOutput = {
        ...snapshot,
        items: [...snapshot.items, nextMessage],
      };
      state = {
        ...state,
        globalRoomSnapshotsById: {
          ...state.globalRoomSnapshotsById,
          [payload.chatId]: createCached(nextSnapshot),
        },
      };
      emit();
      return { ok: true };
    },
    inputGlobalTerminal: async (payload: { terminalId: string; text: string }) => {
      inputs.push({
        terminalId: payload.terminalId,
        text: payload.text,
      });
      return { ok: true };
    },
    setGlobalTerminalConfig: async (payload: { terminalId: string; cols?: number; rows?: number }) => {
      terminalConfigs.push(payload);
      return {
        ...payload,
      };
    },
    readSettings: async () => ({
      path: "/tmp/settings.json",
      content: input.settingsContent ?? "",
      mtimeMs: 1,
    }),
    autoLogin: async () => ({
      ok: true as const,
      session: { token: "superadmin-token" },
    }),
    getAuthSession: async () => authSession,
    setAuthToken: () => {},
    grantGlobalTerminalWriteLease: async (payload: { terminalId: string; participantId: string; durationMs: number }) => {
      terminalWriteLeases = terminalWriteLeases
        .map((record) =>
          record.terminalId === payload.terminalId &&
          record.participantId === payload.participantId &&
          record.revokedAt === undefined
            ? { ...record, revokedAt: Date.now() }
            : record,
        )
        .concat({
          leaseId: `lease:${payload.terminalId}:${payload.participantId}:${terminalWriteLeases.length + 1}`,
          terminalId: payload.terminalId,
          participantId: payload.participantId,
        });
      const current = terminalWriteLeases.at(-1);
      return {
        leaseId: current?.leaseId ?? "lease:missing",
        participantId: payload.participantId,
        expiresAt: Date.now() + payload.durationMs,
      };
    },
    revokeGlobalTerminalWriteLease: async (payload: { terminalId: string; leaseId?: string; participantId?: string }) => {
      let revokedCount = 0;
      terminalWriteLeases = terminalWriteLeases.map((record) => {
        const matchesLease = payload.leaseId ? record.leaseId === payload.leaseId : false;
        const matchesParticipant = payload.participantId ? record.participantId === payload.participantId : false;
        if (
          record.terminalId !== payload.terminalId ||
          record.revokedAt !== undefined ||
          (!matchesLease && !matchesParticipant)
        ) {
          return record;
        }
        revokedCount += 1;
        return {
          ...record,
          revokedAt: Date.now(),
        };
      });
      return { ok: true as const, revokedCount };
    },
    queryAttention: async (payload: { query: string }) => {
      const contextId = payload.query.match(/contextId:([^\s]+)/)?.[1] ?? buildCliShellHostingContextId("shell-1");
      const score = attentionScores[contextId] ?? 0;
      return score > 0 ? [createAttentionItem(contextId, score)] : [];
    },
    commitAttention: async (payload: { contextId: string; scores: Record<string, number> }) => {
      attentionScores[payload.contextId] = payload.scores.hosting ?? 0;
      return { commit: payload };
    },
    settleAttention: async (payload: { contextId: string; scores: Record<string, number> }) => {
      attentionScores[payload.contextId] = payload.scores.hosting ?? 0;
      return { commit: payload };
    },
    listProductDelegations: async () => delegations,
    createProductDelegation: async (payload: Omit<ProductDelegationRecord, "delegationId" | "status">) => {
      const delegation = {
        ...payload,
        delegationId: `delegation:${payload.productId}:${payload.resourceKey}`,
        status: "active",
      } as ProductDelegationRecord;
      delegations = [...delegations.filter((item) => item.status !== "active"), delegation];
      return delegation;
    },
    revokeProductDelegation: async (payload: { delegationId: string; revokedAt: number; revokedReason: string }) => {
      const delegation = delegations.find((item) => item.delegationId === payload.delegationId);
      if (!delegation) {
        throw new Error("delegation not found");
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

  return {
    store: store as unknown as CliShellTuiStore,
    inputs,
    terminalConfigs,
    sentMessages,
    attentionScores,
    get delegations() {
      return delegations;
    },
    get terminalWriteLeases() {
      return terminalWriteLeases;
    },
  };
};

const createTestKeyEvent = (input: {
  name: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  option?: boolean;
  sequence?: string;
  raw?: string;
}): KeyEvent =>
  new KeyEvent({
    name: input.name,
    ctrl: input.ctrl ?? false,
    meta: input.meta ?? false,
    shift: input.shift ?? false,
    option: input.option ?? false,
    sequence: input.sequence ?? "",
    raw: input.raw ?? input.sequence ?? "",
    number: false,
    eventType: "press",
    source: "raw",
  });

describe("Feature: cli-shell interactive TUI", () => {
  test("Scenario: Given latest heartbeat parts When resolving toolbar state Then status icons and summaries stay product-local but derive from durable runtime facts", () => {
    const thinkingGroup = createHeartbeatGroup(
      createHeartbeatPart({
        messageId: "thinking",
        partType: "thinking",
        payload: { type: "thinking", text: "正在分析…" },
        text: "正在分析…",
        isComplete: false,
      }),
    );
    const terminalToolGroup = createHeartbeatGroup(
      createHeartbeatPart({
        messageId: "tool-call",
        partType: "tool_call",
        payload: { tool: "workspace_bash" },
        text: "workspace_bash",
        isComplete: false,
      }),
    );
    const messageToolGroup = createHeartbeatGroup(
      createHeartbeatPart({
        messageId: "message-tool",
        partType: "tool_result",
        payload: { tool: "message_send", error: null },
        text: "message_send",
      }),
    );
    const attentionToolGroup = createHeartbeatGroup(
      createHeartbeatPart({
        messageId: "attention-tool",
        partType: "tool_result",
        payload: { tool: "attention_query", error: null },
        text: "attention_query",
      }),
    );

    expect(resolveCliShellToolbarStatus([])).toBe("idle");
    expect(resolveCliShellToolbarStatus([thinkingGroup])).toBe("thinking");
    expect(resolveCliShellToolbarStatus([terminalToolGroup])).toBe("terminal-tool");
    expect(resolveCliShellToolbarStatus([messageToolGroup])).toBe("message-tool");
    expect(resolveCliShellToolbarStatus([attentionToolGroup])).toBe("tool-call");
    expect(
      summarizeCliShellHeartbeat({
        groups: [terminalToolGroup],
        terminalId: "shell-1",
        connected: true,
      }),
    ).toBe("终端工具 bash 处理中");
  });

  test("Scenario: Given multiple viewport sizes When resolving dialogue placement Then smart placement prefers right, then bottom, then floating", () => {
    expect(resolveCliShellDialoguePlacement({ requestedPlacement: "smart", width: 120, height: 40 })).toBe("right");
    expect(resolveCliShellDialoguePlacement({ requestedPlacement: "smart", width: 70, height: 40 })).toBe("bottom");
    expect(resolveCliShellDialoguePlacement({ requestedPlacement: "smart", width: 50, height: 14 })).toBe("floating");
  });

  test("Scenario: Given room truth with date boundaries When building the right dialogue frame Then terminal-first layout, date dividers, short times, and bottom toolbar all stay inside the shell-terminal grid", () => {
    const state = createRuntimeState({
      heartbeat: [
        createHeartbeatGroup(
          createHeartbeatPart({
            messageId: "heartbeat-text",
            partType: "text",
            payload: { type: "text", content: "分析测试结果：workspace 包已复用，shell-1 已连接…" },
            text: "分析测试结果：workspace 包已复用，shell-1 已连接…",
          }),
        ),
      ],
      lines: [
        "$ agenter shell",
        "shell-1:~/project $ pnpm test --filter @agenter/cli",
        "PASS packages/cli/test/product-command-launcher.test.ts",
      ],
      roomMessages: [
        createRoomMessage({
          messageId: 1,
          senderActorId: "auth:user",
          from: "you",
          content: "解释一下这次 terminal 测试结果。",
          createdAt: Date.parse("2026-05-06T10:28:00+08:00"),
          unreadActorIds: ["auth:shell-assistant"],
        }),
        createRoomMessage({
          messageId: 2,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: "- shell-1 复用了已有 terminal\n- room truth 保持不变",
          createdAt: Date.parse("2026-05-06T10:29:00+08:00"),
        }),
        createRoomMessage({
          messageId: 3,
          senderActorId: "auth:user",
          from: "you",
          content: "给我下一步最小命令。",
          createdAt: Date.parse("2026-05-07T09:12:00+08:00"),
          unreadActorIds: ["auth:shell-assistant"],
        }),
      ],
      unread: 99,
    });

    const model = buildCliShellTuiModel({
      state,
      projection: {
        roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
      },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        requestedPlacement: "right",
        dialogueDraft: "",
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 120,
      height: 40,
    });
    const frame = layoutCliShellTuiFrame({
      model,
      width: 120,
      height: 40,
    });

    expect(frame.lines).toHaveLength(40);
    expect(frame.lines[0]).toContain("$ agenter shell");
    expect(frame.lines[0]).toContain("│L  R  F  B  Dialogue");
    expect(frame.lines.some((line) => line.includes("2026-05-06"))).toBe(true);
    expect(frame.lines.some((line) => /\d{2}:\d{2} you/.test(line))).toBe(true);
    expect(frame.lines.some((line) => line.includes("shell-1 复用了已有 terminal"))).toBe(true);
    expect(frame.lines[37]).toContain("> _");
    expect(frame.lines[39]).toContain("托管 off");
    expect(frame.lines[39]).toContain("✉ 2 ⌘J");
    expect(frame.lines.join("\n")).not.toContain("SHELLS");
    expect(frame.lines.join("\n")).not.toContain("SESSIONS");
    const userLineIndex = frame.lines.findIndex((line) => /\d{2}:\d{2} you/.test(line));
    expect(userLineIndex).toBeGreaterThanOrEqual(0);
    expect(frame.styledLines[userLineIndex]?.spans.some((span) => span.bg === "gray")).toBe(true);
    const inputLineIndex = frame.lines.findIndex((line) => line.includes("> _"));
    expect(inputLineIndex).toBeGreaterThanOrEqual(0);
    expect(frame.styledLines[inputLineIndex]?.spans.some((span) => span.bg === "gray")).toBe(true);
  });

  test("Scenario: Given explicit dialogue placements and wide glyph content When building frames Then docked and floating chrome stay aligned inside the shell-terminal cell grid", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: [
        "$ agenter shell",
        "shell-1:~/project $ echo 你好🙂",
        "你好🙂 终端输出保持对齐",
      ],
      roomMessages: [
        createRoomMessage({
          messageId: 1,
          senderActorId: "auth:user",
          from: "you",
          content: "把 你好🙂 这行也保留到对话里。",
          createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
          unreadActorIds: ["auth:shell-assistant"],
        }),
      ],
      unread: 5,
    });
    const keybindings = resolveCliShellTuiKeybindings(null);
    const leftModel = buildCliShellTuiModel({
      state,
      projection: {
        roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
      },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        requestedPlacement: "left",
        dialogueDraft: "",
        managed: createManagedState({ hostingActive: true }),
        statusNotice: null,
      },
      keybindings,
      width: 120,
      height: 40,
    });
    expect(leftModel.toolbarManaged).toBe("托管 host");
    expect(leftModel.toolbarUnread).toBe("✉ 1 ⌘J");
    const leftFrame = layoutCliShellTuiFrame({
      model: leftModel,
      width: 120,
      height: 40,
    });
    expect(leftFrame.lines[0]?.startsWith("L  R  F  B  Dialogue")).toBe(true);
    expect(leftFrame.lines.every((line) => measureTerminalText(line) === 120)).toBe(true);

    const bottomModel = buildCliShellTuiModel({
      state,
      projection: {
        roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
      },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: true,
        requestedPlacement: "bottom",
        dialogueDraft: "继续",
        managed: createManagedState({ managed: true }),
        statusNotice: null,
      },
      keybindings,
      width: 72,
      height: 32,
    });
    expect(bottomModel.toolbarManaged).toBe("托管 on");
    const bottomFrame = layoutCliShellTuiFrame({
      model: bottomModel,
      width: 72,
      height: 32,
    });
    expect(bottomFrame.lines[0]).toContain("$ agenter shell");
    expect(bottomFrame.lines.some((line, index) => index > 8 && line.includes("L  R  F  B  Dialogue"))).toBe(true);
    expect(bottomFrame.lines.every((line) => measureTerminalText(line) === 72)).toBe(true);

    const floatingFrame = layoutCliShellTuiFrame({
      model: buildCliShellTuiModel({
        state,
        projection: {
          roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
        },
        sessionId: "session-1",
        shellName: "shell-1",
        fallbackTerminalId: "shell-1",
        avatarActorId: "auth:shell-assistant",
        ui: {
          dialogueOpen: true,
          requestedPlacement: "floating",
          dialogueDraft: "",
          managed: createManagedState(),
          statusNotice: null,
        },
        keybindings,
        width: 50,
        height: 14,
      }),
      width: 50,
      height: 14,
    });
    expect(floatingFrame.lines.some((line) => line.includes("┌"))).toBe(true);
    expect(floatingFrame.lines.some((line) => line.includes("┘"))).toBe(true);
    expect(floatingFrame.lines.some((line) => line.includes("你好🙂"))).toBe(true);
    expect(floatingFrame.lines.every((line) => measureTerminalText(line) === 50)).toBe(true);
  });

  test("Scenario: Given room truth carries unread inbound messages When building the toolbar Then cli-shell projects unread count from room facts instead of session badges", () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [
        createRoomMessage({
          messageId: 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: "我已经连上 terminal。",
          createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
        }),
        createRoomMessage({
          messageId: 2,
          senderActorId: "auth:user",
          from: "you",
          content: "看一下最新失败用例。",
          createdAt: Date.parse("2026-05-08T10:01:00+08:00"),
          unreadActorIds: ["auth:shell-assistant"],
        }),
        createRoomMessage({
          messageId: 3,
          senderActorId: "auth:user",
          from: "you",
          content: "这条已经读过。",
          createdAt: Date.parse("2026-05-08T10:02:00+08:00"),
        }),
        createRoomMessage({
          messageId: 4,
          senderActorId: "auth:user",
          from: "you",
          content: "这条被撤回了。",
          createdAt: Date.parse("2026-05-08T10:03:00+08:00"),
          unreadActorIds: ["auth:shell-assistant"],
          recalledAt: Date.parse("2026-05-08T10:04:00+08:00"),
        }),
      ],
      unread: 9,
    });

    const model = buildCliShellTuiModel({
      state,
      projection: {
        roomSnapshot: state.globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
      },
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      avatarActorId: "auth:shell-assistant",
      ui: {
        dialogueOpen: false,
        requestedPlacement: "smart",
        dialogueDraft: "",
        managed: createManagedState(),
        statusNotice: null,
      },
      keybindings: resolveCliShellTuiKeybindings(null),
      width: 120,
      height: 40,
    });

    expect(model.toolbarUnread).toBe("✉ 1 ⌘J");
  });

  test("Scenario: Given dialogue mode shortcuts When placement and cancel commands run Then chat focus changes without leaking control keys into the backend terminal", async () => {
    const state = createRuntimeState({
      heartbeat: [],
      lines: ["$ agenter shell", "shell-1:~/project $"],
      roomMessages: [],
      unread: 0,
    });
    const shortcutSettings = JSON.stringify({
      cliShell: {
        shortcuts: {
          openDialogue: "Ctrl+G",
          placeLeft: "Ctrl+H",
          placeRight: "Ctrl+L",
          placeFloating: "Ctrl+F",
          placeBottom: "Ctrl+B",
        },
      },
    });
    const harness = createTuiStore({
      state,
      settingsContent: shortcutSettings,
    });
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      requestedPlacement: "smart",
      dialogueDraft: "stale",
      managed: createManagedState(),
      statusNotice: null,
    };
    const controllerContext = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings: resolveCliShellTuiKeybindings(shortcutSettings),
      onQuit: () => {},
      getViewState: () => viewState,
      getModel: () =>
        buildCliShellTuiModel({
          state: harness.store.getState(),
          projection: {
            roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
          },
          sessionId: "session-1",
          shellName: "shell-1",
          fallbackTerminalId: "shell-1",
          avatarActorId: "auth:shell-assistant",
          ui: viewState,
          keybindings: resolveCliShellTuiKeybindings(shortcutSettings),
          width: 120,
          height: 40,
        }),
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    } as const;

    routeCliShellKey(controllerContext, createTestKeyEvent({ name: "g", ctrl: true, sequence: "\u0007" }));
    expect(viewState.dialogueOpen).toBe(true);

    routeCliShellKey(controllerContext, createTestKeyEvent({ name: "h", ctrl: true, sequence: "\b" }));
    expect(viewState.requestedPlacement).toBe("left");
    routeCliShellKey(controllerContext, createTestKeyEvent({ name: "l", ctrl: true, sequence: "\f" }));
    expect(viewState.requestedPlacement).toBe("right");
    routeCliShellKey(controllerContext, createTestKeyEvent({ name: "f", ctrl: true, sequence: "\u0006" }));
    expect(viewState.requestedPlacement).toBe("floating");
    routeCliShellKey(controllerContext, createTestKeyEvent({ name: "b", ctrl: true, sequence: "\u0002" }));
    expect(viewState.requestedPlacement).toBe("bottom");

    routeCliShellKey(controllerContext, createTestKeyEvent({ name: "escape", sequence: "\u001b", raw: "\u001b" }));
    expect(viewState.dialogueOpen).toBe(false);
    expect(viewState.dialogueDraft).toBe("");
    expect(harness.inputs).toHaveLength(0);
  });

  test("Scenario: Given terminal mode and dialogue mode When keys are routed through the controller Then terminal input, resize geometry, managed toggle, and room-message send each stay in their own backend contract", async () => {
    const state = createRuntimeState({
      heartbeat: [
        createHeartbeatGroup(
          createHeartbeatPart({
            messageId: "heartbeat-tool",
            partType: "tool_call",
            payload: { tool: "workspace_bash" },
            text: "workspace_bash",
            isComplete: false,
          }),
        ),
      ],
      lines: Array.from({ length: 12 }, (_, index) =>
        index === 0 ? "$ agenter shell" : index === 1 ? "shell-1:~/project $ git status --short" : "",
      ),
      roomMessages: [
        createRoomMessage({
          messageId: 1,
          senderActorId: "auth:shell-assistant",
          from: "shell-assistant",
          content: "可以开始。",
          createdAt: Date.parse("2026-05-08T10:00:00+08:00"),
        }),
      ],
      unread: 2,
    });
    const shortcutSettings = JSON.stringify({
      cliShell: {
        shortcuts: {
          openDialogue: "Ctrl+G",
          toggleManaged: "Ctrl+T",
        },
      },
    });
    const harness = createTuiStore({
      state,
      settingsContent: shortcutSettings,
    });
    const pendingTasks: Promise<void>[] = [];
    let viewState: CliShellTuiViewState = {
      dialogueOpen: false,
      requestedPlacement: "smart",
      dialogueDraft: "",
      managed: createManagedState(),
      statusNotice: null,
    };
    const keybindings = resolveCliShellTuiKeybindings(shortcutSettings);
    const buildModel = () =>
      buildCliShellTuiModel({
        state: harness.store.getState(),
        projection: {
          roomSnapshot: harness.store.getState().globalRoomSnapshotsById["room-shell-1"]?.data ?? null,
        },
        sessionId: "session-1",
        shellName: "shell-1",
        fallbackTerminalId: "shell-1",
        avatarActorId: "auth:shell-assistant",
        ui: viewState,
        keybindings,
        width: 120,
        height: 40,
      });
    const controllerContext = {
      store: harness.store,
      sessionId: "session-1",
      shellName: "shell-1",
      roomChatId: "room-shell-1",
      roomAccessToken: "tok:room-shell-1",
      runtimeId: "runtime:shell-assistant",
      avatarActorId: "auth:shell-assistant",
      keybindings,
      onQuit: () => {},
      trackAsyncTask: (task: Promise<void>) => {
        pendingTasks.push(task);
      },
      getViewState: () => viewState,
      getModel: () => buildModel(),
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        viewState = updater(viewState);
      },
    } as const;

    const geometryKey = await syncCliShellTerminalGeometry({
      store: harness.store,
      terminalId: "shell-1",
      width: 120,
      height: 40,
      previousGeometryKey: "",
    });
    expect(geometryKey).toBe("shell-1:120x39");
    expect(harness.terminalConfigs.at(-1)).toEqual({
      terminalId: "shell-1",
      cols: 120,
      rows: 39,
    });

    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "t", ctrl: true, sequence: "\u0014", raw: "\u0014" }),
    );
    await Promise.all(pendingTasks.splice(0));
    expect(harness.delegations).toHaveLength(1);
    expect(harness.attentionScores[buildCliShellHostingContextId("shell-1")]).toBe(1000);
    expect(viewState.managed.managed).toBe(true);

    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "l", sequence: "l", raw: "l" }),
    );
    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "s", sequence: "s", raw: "s" }),
    );
    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "c", ctrl: true, sequence: "\u0003", raw: "\u0003" }),
    );
    expect(harness.inputs.map((entry) => entry.text)).toEqual(["l", "s", "\u0003"]);

    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "g", ctrl: true, sequence: "\u0007", raw: "\u0007" }),
    );
    expect(viewState.dialogueOpen).toBe(true);
    routeCliShellPaste(controllerContext, "status?");
    expect(harness.inputs).toHaveLength(3);
    expect(viewState.dialogueDraft).toBe("status?");

    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "return", sequence: "\r", raw: "\r" }),
    );
    await Promise.all(pendingTasks.splice(0));
    expect(harness.sentMessages).toEqual([{ chatId: "room-shell-1", text: "status?" }]);
    expect(viewState.dialogueOpen).toBe(false);
    expect(viewState.dialogueDraft).toBe("");

    routeCliShellKey(
      controllerContext,
      createTestKeyEvent({ name: "t", ctrl: true, sequence: "\u0014", raw: "\u0014" }),
    );
    await Promise.all(pendingTasks.splice(0));
    expect(harness.attentionScores[buildCliShellHostingContextId("shell-1")]).toBe(0);
    expect(harness.delegations[0]?.status).toBe("revoked");
    expect(viewState.managed.managed).toBe(false);

    const resizedGeometryKey = await syncCliShellTerminalGeometry({
      store: harness.store,
      terminalId: "shell-1",
      width: 80,
      height: 24,
      previousGeometryKey: geometryKey,
    });
    expect(resizedGeometryKey).toBe("shell-1:80x23");
    expect(harness.terminalConfigs.at(-1)).toEqual({
      terminalId: "shell-1",
      cols: 80,
      rows: 23,
    });
  });
});
