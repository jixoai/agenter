import type { RuntimeClientState, SessionEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "vitest";

import { buildAvatarSessionRailItems } from "./runtime-shell-state";

const createSessionEntry = (input: {
  id: string;
  avatar: string;
  name?: string;
  createdAt: string;
  status: SessionEntry["status"];
  workspacePath: string;
  avatarPrincipalId?: string;
}): SessionEntry => ({
  id: input.id,
  name: input.name ?? input.avatar,
  cwd: input.workspacePath,
  workspacePath: input.workspacePath,
  avatar: input.avatar,
  avatarPrincipalId: input.avatarPrincipalId,
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
  attentionDeliveryBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  globalAvatarCatalog: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
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
  globalTerminalHistory: {
    data: [],
    loaded: false,
    loading: false,
    refreshing: false,
    error: null,
    refreshedAt: null,
  },
  globalTerminalArchive: {
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
  heartbeatGroupsBySession: {},
  modelCallsBySession: {},
  requestAuxBySession: {},
  modelCallDeltasBySession: {},
  apiCallsBySession: {},
  terminalActivityBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession,
  unreadByBucket: {},
});

describe("Feature: Avatar submenu navigation order", () => {
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

    const alphaActive = buildAvatarSessionRailItems(state, {
      activeSessionId: "session-alpha",
      pinnedSessionIds: [],
      openedSessionIds: [],
      resolveAvatarIconUrl: () => null,
    });
    const betaActive = buildAvatarSessionRailItems(state, {
      activeSessionId: "session-beta",
      pinnedSessionIds: [],
      openedSessionIds: [],
      resolveAvatarIconUrl: () => null,
    });

    expect(alphaActive.map((item) => item.sessionId)).toEqual(["session-zebra", "session-alpha", "session-beta"]);
    expect(betaActive.map((item) => item.sessionId)).toEqual(["session-zebra", "session-alpha", "session-beta"]);
    expect(alphaActive.map((item) => item.active)).toEqual([false, true, false]);
    expect(betaActive.map((item) => item.active)).toEqual([false, false, true]);
  });

  test("Scenario: Given a pinned stopped avatar When building sidebar submenu items Then it remains visible without disturbing the stable avatar-tab order", () => {
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
          status: "stopped",
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
        "session-alpha": 0,
        "session-beta": 0,
      },
    );

    const items = buildAvatarSessionRailItems(state, {
      activeSessionId: "session-alpha",
      pinnedSessionIds: ["session-alpha"],
      openedSessionIds: [],
      resolveAvatarIconUrl: () => null,
    });

    expect(items.map((item) => item.sessionId)).toEqual(["session-zebra", "session-alpha", "session-beta"]);
    expect(items.map((item) => item.pinned)).toEqual([false, true, false]);
    expect(items.map((item) => item.active)).toEqual([false, true, false]);
    expect(items[1]?.status).toBe("stopped");
  });

  test("Scenario: Given an opened stopped avatar session When building sidebar submenu items Then it remains visible so the shared runtime shell stays reachable", () => {
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
          id: "session-helper",
          avatar: "helper",
          createdAt: "2026-04-02T00:00:00.000Z",
          status: "stopped",
          workspacePath: "/repo/helper",
        }),
      ],
      {
        "session-zebra": 0,
        "session-helper": 0,
      },
    );

    const items = buildAvatarSessionRailItems(state, {
      activeSessionId: "session-helper",
      openedSessionIds: ["session-helper"],
      pinnedSessionIds: [],
      resolveAvatarIconUrl: () => null,
    });

    expect(items.map((item) => item.sessionId)).toEqual(["session-zebra", "session-helper"]);
    expect(items.map((item) => item.active)).toEqual([false, true]);
    expect(items[1]?.status).toBe("stopped");
  });

  test("Scenario: Given a runtime session is missing avatarPrincipalId When the global avatar catalog still knows that avatar Then the sidebar keeps the avatar principal icon instead of falling back to initials", () => {
    const state = createRuntimeState(
      [
        createSessionEntry({
          id: "session-backend",
          avatar: "backend",
          createdAt: "2026-04-04T00:00:00.000Z",
          status: "running",
          workspacePath: "/repo/backend",
        }),
      ],
      {
        "session-backend": 0,
      },
    );

    const items = buildAvatarSessionRailItems(state, {
      activeSessionId: "session-backend",
      openedSessionIds: [],
      pinnedSessionIds: [],
      resolveAvatarIconUrl: (principalId) => `https://profiles.test/media/avatars/${principalId}/icon`,
      resolveAvatarCatalogEntry: (avatarNickname) =>
        avatarNickname === "backend"
          ? {
              avatarPrincipalId: "avatar-backend",
              iconUrl: "https://profiles.test/media/avatars/avatar-backend/icon",
            }
          : null,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sessionId: "session-backend",
      avatarPrincipalId: "avatar-backend",
      iconUrl: "https://profiles.test/media/avatars/avatar-backend/icon",
    });
  });

  test("Scenario: Given session avatarPrincipalId diverges from the canonical avatar catalog When building avatar identity surfaces Then the catalog-backed avatar icon wins", () => {
    const state = createRuntimeState(
      [
        createSessionEntry({
          id: "session-backend",
          avatar: "backend",
          avatarPrincipalId: "session-actor-backend",
          createdAt: "2026-04-04T00:00:00.000Z",
          status: "running",
          workspacePath: "/repo/backend",
        }),
      ],
      {
        "session-backend": 0,
      },
    );

    const items = buildAvatarSessionRailItems(state, {
      activeSessionId: "session-backend",
      openedSessionIds: [],
      pinnedSessionIds: [],
      resolveAvatarIconUrl: (principalId) => `https://profiles.test/media/avatars/${principalId}/icon`,
      resolveAvatarCatalogEntry: (avatarNickname) =>
        avatarNickname === "backend"
          ? {
              avatarPrincipalId: "canonical-backend",
              iconUrl: "https://profiles.test/media/avatars/canonical-backend/icon",
            }
          : null,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      avatarPrincipalId: "canonical-backend",
      iconUrl: "https://profiles.test/media/avatars/canonical-backend/icon",
    });
  });
});
