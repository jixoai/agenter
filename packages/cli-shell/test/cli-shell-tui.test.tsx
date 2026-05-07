/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type {
  CachedResourceState,
  HeartbeatGroupItem,
  HeartbeatPartItem,
  RuntimeClientState,
  RuntimeStore,
  SessionEntry,
} from "@agenter/client-sdk";

import {
  CliShellTuiApp,
  buildCliShellCollapsedModel,
  layoutCliShellCollapsedFrame,
  resolveCliShellToolbarStatus,
  summarizeCliShellHeartbeat,
} from "../src";

let renderHandle: Awaited<ReturnType<typeof testRender>> | null = null;

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
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  status: "running",
  storageState: "active",
  sessionRoot: "/tmp/session-1",
  storeTarget: "global",
});

const createRuntimeState = (input: {
  heartbeat: HeartbeatGroupItem[];
  lines: string[];
  unread?: number;
}): RuntimeClientState => {
  const sessionId = "session-1";
  const terminalSnapshots = {
    "shell-1": {
      seq: 2,
      timestamp: 20,
      cols: 120,
      rows: 40,
      lines: input.lines,
      cursor: { x: 0, y: Math.max(0, input.lines.length - 1) },
    },
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
    globalRooms: createCached([]),
    globalRoomSnapshotsById: {},
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

afterEach(() => {
  renderHandle?.renderer.destroy();
  renderHandle = null;
});

describe("Feature: cli-shell collapsed TUI", () => {
  test("Scenario: Given latest heartbeat parts When resolving collapsed toolbar state Then status icons and summaries stay product-local but derive from durable runtime facts", () => {
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
    expect(
      summarizeCliShellHeartbeat({
        groups: [messageToolGroup],
        terminalId: "shell-1",
        connected: true,
      }),
    ).toBe("消息工具 send 完成");
    expect(
      summarizeCliShellHeartbeat({
        groups: [attentionToolGroup],
        terminalId: "shell-1",
        connected: true,
      }),
    ).toBe("注意力工具 query 完成");
  });

  test("Scenario: Given a focused runtime terminal and heartbeat text When building the collapsed frame Then the body stays terminal-first and the toolbar stays one row at the bottom", () => {
    const state = createRuntimeState({
      heartbeat: [
        createHeartbeatGroup(
          createHeartbeatPart({
            messageId: "heartbeat-text",
            partType: "text",
            payload: {
              type: "text",
              content: "分析测试结果：workspace 包已复用，shell-1 已连接，下一步进入 toolbar grid。",
            },
            text: "分析测试结果：workspace 包已复用，shell-1 已连接，下一步进入 toolbar grid。",
          }),
        ),
      ],
      lines: [
        "$ agenter shell",
        "shell-1:~/project $ pnpm test --filter @agenter/cli",
        "PASS packages/cli/test/product-command-launcher.test.ts",
      ],
      unread: 3,
    });

    const model = buildCliShellCollapsedModel({
      state,
      sessionId: "session-1",
      shellName: "shell-1",
      fallbackTerminalId: "shell-1",
      managed: false,
    });
    const frame = layoutCliShellCollapsedFrame({
      model,
      width: 120,
      height: 40,
    });

    expect(frame.bodyLines).toHaveLength(39);
    expect(frame.bodyLines[0]?.trim()).toBe("$ agenter shell");
    expect(frame.bodyLines[2]?.trim()).toBe("PASS packages/cli/test/product-command-launcher.test.ts");
    expect(frame.toolbarLine).toContain("◉ terminal");
    expect(frame.toolbarLine).toContain("托管 off");
    expect(frame.toolbarLine).toContain("✉ 3 ⌘J");
  });

  test("Scenario: Given the collapsed TUI app When rendering at 120x40 Then there is no top chrome and the final row stays reserved for the toolbar", async () => {
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
      lines: Array.from({ length: 39 }, (_, index) =>
        index === 0 ? "$ agenter shell" : index === 1 ? "shell-1:~/project $ git status --short" : "",
      ),
      unread: 3,
    });
    const store: Pick<RuntimeStore, "getState" | "subscribe"> = {
      getState: () => state,
      subscribe: () => () => {},
    };

    renderHandle = await testRender(
      <CliShellTuiApp
        store={store}
        sessionId="session-1"
        shellName="shell-1"
        fallbackTerminalId="shell-1"
        managed={false}
        onQuit={() => {}}
      />,
      {
        width: 120,
        height: 40,
      },
    );
    await renderHandle.renderOnce();

    const output = renderHandle.captureCharFrame();
    const lines = output.trimEnd().split("\n");

    expect(lines).toHaveLength(40);
    expect(lines[0]).toContain("$ agenter shell");
    expect(lines[39]).toContain("⌘ terminal");
    expect(lines[39]).toContain("托管 off");
    expect(lines[39]).toContain("✉ 3 ⌘J");
    expect(lines.slice(0, 39).some((line) => line.includes("托管 off"))).toBe(false);
    expect(output).not.toContain("Sessions");
    expect(output).not.toContain("ChatPanel");
  });
});
