import type { ModelDebugOutput, RuntimeClientState, WorkspaceSessionCounts, WorkspaceSessionEntry } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../src/App";
import { createRealSessionHistoryFixture } from "../src/features/chat/real-session-history-fixture";

const originalMatchMedia = globalThis.window?.matchMedia;
const originalInnerWidth = globalThis.window?.innerWidth;
const originalInnerHeight = globalThis.window?.innerHeight;

const createState = (): RuntimeClientState => ({
  connected: true,
  connectionStatus: "connected",
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  chatsBySession: {},
  chatCyclesBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
  workspaces: [],
  loopbusStateLogsBySession: {},
  loopbusTracesBySession: {},
  apiCallsBySession: {},
  modelCallsBySession: {},
  apiCallRecordingBySession: {},
  notifications: [],
  unreadBySession: {},
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

let mockState: RuntimeClientState = createState();
let stateListeners: Array<(state: RuntimeClientState) => void> = [];
const listWorkspaceSessionsMock = vi.fn<
  (input: { path: string; tab: string; cursor?: number; limit?: number }) => Promise<{
    items: WorkspaceSessionEntry[];
    nextCursor: number | null;
    counts: WorkspaceSessionCounts;
  }>
>();
const cleanMissingWorkspacesMock = vi.fn<() => Promise<string[]>>();
const createSessionMock = vi.fn(async () => ({ id: "session-new" }));
const sendChatMock = vi.fn(async () => {});
const startSessionMock = vi.fn(async () => {});
const stopSessionMock = vi.fn(async () => {});
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
const setChatVisibilityMock = vi.fn(async () => ({ items: [], unreadBySession: {} }));
const consumeNotificationsMock = vi.fn(async () => ({ items: [], unreadBySession: {} }));
const hydrateSessionHistoryMock = vi.fn(async () => {});
const loadChatMessagesMock = vi.fn(async () => {});
const loadChatCyclesMock = vi.fn(async () => {});
const retainApiCallStreamMock = vi.fn(() => () => {});
const sessionIconUrlMock = vi.fn((sessionId: string) => `/media/sessions/${sessionId}/icon`);
const avatarIconUrlMock = vi.fn((nickname: string) => `/media/avatars/${nickname}/icon`);
const uploadSessionIconMock = vi.fn(async () => ({ ok: true }));
const uploadAvatarIconMock = vi.fn(async () => ({ ok: true }));
const readGlobalSettingsMock = vi.fn(async () => ({ path: "settings.json", content: "{}\n", mtimeMs: 0 }));
const saveGlobalSettingsMock = vi.fn(async () => ({
  ok: true,
  file: { path: "settings.json", content: "{}\n", mtimeMs: 1 },
  latest: { path: "settings.json", content: "{}\n", mtimeMs: 1 },
}));
const listAvatarCatalogMock = vi.fn(async () => ({ items: [], activeAvatar: "" }));
const createAvatarMock = vi.fn(async () => ({ nickname: "assistant" }));
const inspectModelDebugMock = vi.fn<() => Promise<ModelDebugOutput>>(async () => ({
  config: null,
  history: [],
  stats: null,
  latestModelCall: null,
  recentModelCalls: [],
  recentApiCalls: [],
}));

const emitState = (next: RuntimeClientState) => {
  mockState = next;
  for (const listener of stateListeners) {
    listener(mockState);
  }
};

vi.mock("@agenter/client-sdk", () => ({
  createAgenterClient: () => ({ close: () => {} }),
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
    archiveSession: async () => {},
    restoreSession: async () => {},
    deleteSession: async () => {},
    toggleSessionFavorite: async () => ({ sessionId: "", favorite: false }),
    listWorkspaceSessions: listWorkspaceSessionsMock,
    inspectModelDebug: inspectModelDebugMock,
    sendChat: sendChatMock,
    resolveDraft: resolveDraftMock,
    searchWorkspacePaths: async () => [],
    uploadSessionAssets: async () => [],
    sessionIconUrl: sessionIconUrlMock,
    avatarIconUrl: avatarIconUrlMock,
    uploadSessionIcon: uploadSessionIconMock,
    uploadAvatarIcon: uploadAvatarIconMock,
    hydrateSessionHistory: hydrateSessionHistoryMock,
    loadChatMessages: loadChatMessagesMock,
    loadChatCycles: loadChatCyclesMock,
    loadMoreChatMessagesBefore: async () => ({ items: 0, hasMore: false }),
    loadMoreChatCyclesBefore: async () => ({ items: 0, hasMore: false }),
    readSettings: async () => ({ path: "settings.json", content: "{}", mtimeMs: 0 }),
    saveSettings: async () => ({ ok: true, file: { path: "settings.json", content: "{}", mtimeMs: 1 } }),
    readGlobalSettings: readGlobalSettingsMock,
    saveGlobalSettings: saveGlobalSettingsMock,
    listAvatarCatalog: listAvatarCatalogMock,
    createAvatar: createAvatarMock,
    listSettingsLayers: listSettingsLayersMock,
    readSettingsLayer: readSettingsLayerMock,
    saveSettingsLayer: saveSettingsLayerMock,
    setChatVisibility: setChatVisibilityMock,
    consumeNotifications: consumeNotificationsMock,
    listRecentWorkspaces: async () => [],
    listAllWorkspaces: async () => [],
    toggleWorkspaceFavorite: async () => {},
    removeWorkspace: async () => {},
    cleanMissingWorkspaces: cleanMissingWorkspacesMock,
    listDirectories: listDirectoriesMock,
    validateDirectory: validateDirectoryMock,
    retainApiCallStream: retainApiCallStreamMock,
    loadMoreLoopbusTimeline: async () => ({ logs: 0, traces: 0, hasMore: false }),
    loadMoreModelCalls: async () => ({ items: 0, hasMore: false }),
    loadMoreApiCalls: async () => ({ items: 0, hasMore: false }),
  }),
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  stubMatchMedia(false);
  mockState = createState();
  stateListeners = [];
  listWorkspaceSessionsMock.mockReset();
  cleanMissingWorkspacesMock.mockReset();
  createSessionMock.mockClear();
  sendChatMock.mockClear();
  startSessionMock.mockClear();
  stopSessionMock.mockClear();
  resolveDraftMock.mockClear();
  listDirectoriesMock.mockClear();
  validateDirectoryMock.mockClear();
  listSettingsLayersMock.mockClear();
  readSettingsLayerMock.mockClear();
  saveSettingsLayerMock.mockClear();
  setChatVisibilityMock.mockClear();
  consumeNotificationsMock.mockClear();
  hydrateSessionHistoryMock.mockClear();
  loadChatMessagesMock.mockClear();
  loadChatCyclesMock.mockClear();
  retainApiCallStreamMock.mockClear();
  sessionIconUrlMock.mockClear();
  avatarIconUrlMock.mockClear();
  uploadSessionIconMock.mockClear();
  uploadAvatarIconMock.mockClear();
  readGlobalSettingsMock.mockClear();
  saveGlobalSettingsMock.mockClear();
  listAvatarCatalogMock.mockClear();
  createAvatarMock.mockClear();
  inspectModelDebugMock.mockReset();
  listWorkspaceSessionsMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    counts: EMPTY_COUNTS,
  });
  cleanMissingWorkspacesMock.mockResolvedValue([]);
  inspectModelDebugMock.mockResolvedValue({
    config: null,
    history: [],
    stats: null,
    latestModelCall: null,
    recentModelCalls: [],
    recentApiCalls: [],
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
});

describe("Feature: web ui app shell", () => {
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

  test("Scenario: Given quick start workspace When Enter is pressed Then the app creates a session and navigates into workspace chat", async () => {
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
      expect(window.location.pathname).toBe("/workspace/chat");
      expect(window.location.search).toContain(`workspacePath=${encodeURIComponent(workspacePath)}`);
      expect(window.location.search).toContain("sessionId=session-enter");
    });
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

    window.history.replaceState(
      null,
      "",
      `/workspace/devtools?workspacePath=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(sessionId)}`,
    );

    mockState = {
      ...createState(),
      connected: false,
      connectionStatus: "reconnecting",
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(loadChatMessagesMock).not.toHaveBeenCalled();
    expect(loadChatCyclesMock).not.toHaveBeenCalled();
    expect(hydrateSessionHistoryMock).not.toHaveBeenCalled();
    expect(retainApiCallStreamMock).not.toHaveBeenCalled();

    emitState({
      ...createState(),
      connected: true,
      connectionStatus: "connected",
      sessions: [
        {
          id: sessionId,
          name: "Devtools shell",
          cwd: workspacePath,
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
      expect(retainApiCallStreamMock).toHaveBeenCalledWith(sessionId);
    });
  });

  test("Scenario: Given a long-history chat route When the route becomes visible Then hydration runs without consuming unread replies before the viewport reports a visible boundary", async () => {
    const workspacePath = "/repo/real-history";
    const sessionId = "session-real-history";
    const fixture = createRealSessionHistoryFixture();

    window.history.replaceState(
      null,
      "",
      `/workspace/chat?workspacePath=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(sessionId)}`,
    );

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Real history",
          cwd: workspacePath,
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
      chatsBySession: {
        [sessionId]: fixture.messages,
      },
      unreadBySession: {
        [sessionId]: fixture.unreadMessageIds.length,
      },
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    await waitFor(() => {
      expect(hydrateSessionHistoryMock).toHaveBeenCalledWith(sessionId, { messageLimit: 200, cycleLimit: 120 });
      expect(setChatVisibilityMock).toHaveBeenCalledWith({ sessionId, visible: true, focused: true });
    });
    expect(consumeNotificationsMock).not.toHaveBeenCalled();
    expect(screen.getByText("Assistant reply 14: completed the visible conversation turn 14.")).toBeInTheDocument();
  });

  test("Scenario: Given Devtools Model is opened When the first debug request is still pending Then the route does not recursively refetch", async () => {
    const workspacePath = "/repo/devtools";
    const sessionId = "session-model";
    let resolveInspect: ((value: ModelDebugOutput) => void) | null = null;

    inspectModelDebugMock.mockImplementation(
      () =>
        new Promise<ModelDebugOutput>((resolve) => {
          resolveInspect = resolve;
        }),
    );

    window.history.replaceState(
      null,
      "",
      `/workspace/devtools?workspacePath=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(sessionId)}`,
    );

    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "Model shell",
          cwd: workspacePath,
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

    fireEvent.click(await screen.findByRole("tab", { name: "Model" }));

    await waitFor(() => {
      expect(inspectModelDebugMock).toHaveBeenCalledTimes(1);
    });

    resolveInspect!({
      config: null,
      history: [],
      stats: null,
      latestModelCall: {
        id: 7,
        cycleId: 4,
        createdAt: 1_709_800_000_000,
        status: "done",
        completedAt: 1_709_800_000_900,
        provider: "deepseek/openai-chat",
        model: "deepseek-chat",
        request: { messages: [] },
        response: { assistant: { text: "done" } },
        error: null,
      },
      recentModelCalls: [],
      recentApiCalls: [],
    });

    await waitFor(() => {
      expect(screen.getByText(/Latest call #7 done at/i)).toBeInTheDocument();
    });
    expect(inspectModelDebugMock).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Devtools" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
  });

  test("Scenario: Given a workspace shell session When switching to Settings and Devtools Then the session context stays attached to the route", async () => {
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
          loopPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
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
    window.history.replaceState(
      null,
      "",
      `/workspace/chat?workspacePath=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(sessionId)}`,
    );
    fireEvent.popState(window);

    await waitFor(() => {
      expect(screen.getAllByText("Build shell").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));

    await waitFor(() => {
      expect(window.location.search).toContain(`sessionId=${encodeURIComponent(sessionId)}`);
    });
    expect(screen.getByText(workspacePath)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Devtools" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/workspace/devtools");
      expect(window.location.search).toContain(`sessionId=${encodeURIComponent(sessionId)}`);
    });
    expect(screen.getByText(workspacePath)).toBeInTheDocument();
    expect(screen.queryByText("No session")).not.toBeInTheDocument();
  });

  test("Scenario: Given a chat session When the toolbar action is pressed Then one state-driven button starts or stops the session", async () => {
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
          loopPhase: "waiting_commits",
          stage: "observe",
          focusedTerminalId: "",
          focusedTerminalIds: [],
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

    window.history.replaceState(
      null,
      "",
      `/workspace/chat?workspacePath=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(runningSessionId)}`,
    );
    fireEvent.popState(window);

    fireEvent.click(await screen.findByRole("button", { name: "Stop session" }));
    await waitFor(() => {
      expect(stopSessionMock).toHaveBeenCalledWith(runningSessionId);
    });

    window.history.replaceState(
      null,
      "",
      `/workspace/chat?workspacePath=${encodeURIComponent(workspacePath)}&sessionId=${encodeURIComponent(stoppedSessionId)}`,
    );
    fireEvent.popState(window);

    fireEvent.click(await screen.findByRole("button", { name: "Start session" }));
    await waitFor(() => {
      expect(startSessionMock).toHaveBeenCalledWith(stoppedSessionId);
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

  test("Scenario: Given LoopBus is back to waiting_commits While stage is stale Then the app header presents AI ready instead of thinking", async () => {
    const sessionId = "session-idle";
    mockState = {
      ...createState(),
      sessions: [
        {
          id: sessionId,
          name: "agenter",
          cwd: "/repo/demo",
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
          loopPhase: "waiting_commits",
          stage: "plan",
          focusedTerminalId: "",
          focusedTerminalIds: [],
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
    window.history.replaceState(
      null,
      "",
      `/workspace/chat?workspacePath=${encodeURIComponent("/repo/demo")}&sessionId=${encodeURIComponent(sessionId)}`,
    );
    fireEvent.popState(window);

    const header = await screen.findByRole("banner");
    expect(within(header).getByText("AI ready")).toBeInTheDocument();
  });
});
