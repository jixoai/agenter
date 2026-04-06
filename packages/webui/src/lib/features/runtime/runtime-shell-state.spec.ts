import type { RuntimeClientState, SessionEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildRunningAvatarRailItems } from "./runtime-shell-state";

const createSessionEntry = (input: {
  id: string;
  avatar: string;
  name?: string;
  createdAt: string;
  status: SessionEntry["status"];
  workspacePath: string;
}): SessionEntry => ({
  id: input.id,
  name: input.name ?? input.avatar,
  cwd: input.workspacePath,
  workspacePath: input.workspacePath,
  avatar: input.avatar,
  createdAt: input.createdAt,
  updatedAt: input.createdAt,
  status: input.status,
  storageState: "active",
  sessionRoot: `/tmp/sessions/${input.id}`,
  storeTarget: "global",
});

const createRuntimeState = (sessions: SessionEntry[], unreadBySession: Record<string, number>): RuntimeClientState => ({
  connected: true,
  connectionStatus: "connected",
  profileService: null,
  lastEventId: 1,
  sessions,
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  terminalReadsBySession: {},
  chatsBySession: {},
  messageChannelsBySession: {},
  chatCyclesBySession: {},
  attentionBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  workspaceAvatarCatalogByPath: {},
  globalRooms: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalRoomSnapshotsById: {},
  globalRoomGrantsById: {},
  globalRoomAssetsById: {},
  globalTerminals: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalTerminalGrantsById: {},
  globalTerminalApprovalsById: {},
  globalTerminalActivityById: {},
  schedulerLogsBySession: {},
  observabilityTracesBySession: {},
  modelCallsBySession: {},
  modelCallDeltasBySession: {},
  apiCallsBySession: {},
  terminalActivityBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession,
  unreadByChat: {},
  unreadByTerminal: {},
});

describe("Feature: Running avatar navigation order", () => {
  test("Scenario: Given the active avatar changes When building sidebar submenu items Then the session order stays stable and only the active flag moves", () => {
    const state = createRuntimeState(
      [
        createSessionEntry({
          id: "session-zebra",
          avatar: "zebra",
          createdAt: "2026-04-01T00:00:00.000Z",
          status: "running",
          workspacePath: "/repo/zebra",
        }),
        createSessionEntry({
          id: "session-alpha",
          avatar: "alpha",
          createdAt: "2026-04-02T00:00:00.000Z",
          status: "running",
          workspacePath: "/repo/alpha",
        }),
        createSessionEntry({
          id: "session-beta",
          avatar: "beta",
          createdAt: "2026-04-03T00:00:00.000Z",
          status: "starting",
          workspacePath: "/repo/beta",
        }),
      ],
      {
        "session-zebra": 0,
        "session-alpha": 9,
        "session-beta": 3,
      },
    );

    const alphaActive = buildRunningAvatarRailItems(state, {
      activeSessionId: "session-alpha",
      resolveSessionIconUrl: () => null,
    });
    const betaActive = buildRunningAvatarRailItems(state, {
      activeSessionId: "session-beta",
      resolveSessionIconUrl: () => null,
    });

    expect(alphaActive.map((item) => item.sessionId)).toEqual(["session-zebra", "session-alpha", "session-beta"]);
    expect(betaActive.map((item) => item.sessionId)).toEqual(["session-zebra", "session-alpha", "session-beta"]);
    expect(alphaActive.map((item) => item.active)).toEqual([false, true, false]);
    expect(betaActive.map((item) => item.active)).toEqual([false, false, true]);
  });
});
