import { describe, expect, test } from "bun:test";

import type { RuntimeClientState } from "@agenter/client-sdk";

import { buildViewModel } from "../src/types";

describe("Feature: tui view-model mapping", () => {
  test("Scenario: Given active session runtime When building view Then expose phase text and messages", () => {
    const state: RuntimeClientState = {
      connected: true,
      lastEventId: 3,
      sessions: [
        {
          id: "i-1",
          name: "demo",
          cwd: "/tmp/demo",
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
          loopPhase: "collecting_inputs",
          stage: "observe",
          focusedTerminalId: "iflow-main",
          focusedTerminalIds: ["iflow-main"],
          chatMessages: [],
          terminalSnapshots: {},
          terminals: [],
          tasks: [],
          loopKernelState: null,
          loopInputSignals: {
            user: { version: 0, timestamp: null },
            terminal: { version: 0, timestamp: null },
            task: { version: 0, timestamp: null },
            attention: { version: 0, timestamp: null },
          },
          apiCallRecording: { enabled: false, refCount: 0 },
        },
      },
      activityBySession: { "i-1": "active" },
      terminalSnapshotsBySession: { "i-1": {} },
      chatsBySession: {
        "i-1": [
          {
            id: "m-1",
            role: "assistant",
            content: "hello",
            timestamp: Date.now(),
          },
        ],
      },
      tasksBySession: { "i-1": [] },
      recentWorkspaces: [],
      workspaces: [],
      loopbusStateLogsBySession: { "i-1": [] },
      loopbusTracesBySession: { "i-1": [] },
      apiCallsBySession: { "i-1": [] },
      modelCallsBySession: { "i-1": [] },
      apiCallRecordingBySession: { "i-1": { enabled: false, refCount: 0 } },
    };

    const view = buildViewModel(state, "i-1");
    expect(view.connected).toBe(true);
    expect(view.messages).toHaveLength(1);
    expect(view.phaseText).toContain("collecting_inputs");
    expect(view.phaseText).toContain("observe");
  });
});
