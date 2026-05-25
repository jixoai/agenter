import { describe, expect, test } from "bun:test";

import type { RuntimeClientState } from "@agenter/client-sdk";

import { buildViewModel } from "../src/types";

describe("Feature: tui view-model mapping", () => {
  test("Scenario: Given active session runtime When building view Then expose phase text and only user-or-assistant messages", () => {
    const state: RuntimeClientState = {
      connected: true,
      connectionStatus: "connected",
      profileService: null,
      lastEventId: 3,
      sessions: [
        {
          id: "i-1",
          name: "demo",
          cwd: "/tmp/demo",
          workspacePath: "/tmp/demo",
          avatar: "tester-bot",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
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
          activityState: "active",
          schedulerPhase: "collecting_inputs",
          stage: "observe",
          focusedTerminalId: "iflow-main",
          focusedTerminalIds: ["iflow-main"],
          chatMessages: [],
          messageChannels: [],
          terminalSnapshots: {},
          terminalReads: {},
          terminals: [],
          tasks: [],
          schedulerState: null,
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
      activityBySession: { "i-1": "active" },
      terminalSnapshotsBySession: { "i-1": {} },
      terminalReadsBySession: { "i-1": {} },
      chatsBySession: {
        "i-1": [
          {
            id: "m-0",
            role: "system",
            content: "hidden",
            timestamp: Date.now(),
          },
          {
            id: "m-1",
            role: "assistant",
            content: "hello",
            timestamp: Date.now(),
          },
        ],
      },
      messageChannelsBySession: {},
      chatCyclesBySession: { "i-1": [] },
      attentionDeliveryBySession: { "i-1": { projections: [], dispatches: [], receipts: [], watches: [], effects: [] } },
      tasksBySession: { "i-1": [] },
      recentWorkspaces: [],
      workspaces: [],
      globalAvatarCatalog: { data: [], loaded: true, loading: false, refreshing: false, error: null, refreshedAt: 1 },
      workspaceAvatarCatalogByPath: {},
      globalRooms: { data: [], loaded: true, loading: false, refreshing: false, error: null, refreshedAt: 1 },
      globalRoomSnapshotsById: {},
      globalRoomGrantsById: {},
      globalRoomAssetsById: {},
      globalTerminals: { data: [], loaded: true, loading: false, refreshing: false, error: null, refreshedAt: 1 },
      globalTerminalHistory: { data: [], loaded: true, loading: false, refreshing: false, error: null, refreshedAt: 1 },
      globalTerminalArchive: { data: [], loaded: true, loading: false, refreshing: false, error: null, refreshedAt: 1 },
      globalTerminalGrantsById: {},
      globalTerminalApprovalsById: {},
      globalTerminalActivityById: {},
      schedulerLogsBySession: { "i-1": [] },
      observabilityTracesBySession: { "i-1": [] },
      apiCallsBySession: { "i-1": [] },
      heartbeatGroupsBySession: {},
      modelCallsBySession: { "i-1": [] },
      requestAuxBySession: { "i-1": [] },
      terminalActivityBySession: {},
      apiCallRecordingBySession: { "i-1": { enabled: false, refCount: 0 } },
      notifications: [],
      unreadBySession: {},
      unreadByBucket: {},
    };

    const view = buildViewModel(state, "i-1");
    expect(view.connected).toBe(true);
    expect(view.messages).toHaveLength(1);
    expect(view.messages[0]?.id).toBe("m-1");
    expect(view.phaseText).toContain("collecting_inputs");
    expect(view.phaseText).toContain("observe");
  });
});
