import type { RuntimeClientState, WorkspaceSessionCounts, WorkspaceSessionEntry } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../src/App";

const createState = (): RuntimeClientState => ({
  connected: true,
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
});

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
const resolveDraftMock = vi.fn(async (input: { cwd: string }) => ({
  cwd: input.cwd,
  provider: { providerId: "default", kind: "openai-compatible", model: "test" },
  modelCapabilities: { imageInput: false },
}));
const listDirectoriesMock = vi.fn(async () => [] as Array<{ name: string; path: string }>);
const validateDirectoryMock = vi.fn(async (path: string) => ({ ok: true, path }));

const emitState = (next: RuntimeClientState) => {
  mockState = next;
  for (const listener of stateListeners) {
    listener(mockState);
  }
};

vi.mock("@agenter/client-sdk", () => ({
  createAgenterClient: () => ({ close: () => {} }),
  createRuntimeStore: () => ({
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
    startSession: async () => {},
    stopSession: async () => {},
    archiveSession: async () => {},
    restoreSession: async () => {},
    deleteSession: async () => {},
    toggleSessionFavorite: async () => ({ sessionId: "", favorite: false }),
    listWorkspaceSessions: listWorkspaceSessionsMock,
    inspectModelDebug: async () => ({
      config: null,
      history: [],
      stats: null,
      latestModelCall: null,
      recentModelCalls: [],
      recentApiCalls: [],
    }),
    sendChat: sendChatMock,
    resolveDraft: resolveDraftMock,
    searchWorkspacePaths: async () => [],
    uploadSessionImages: async () => [],
    loadChatMessages: async () => {},
    loadChatCycles: async () => {},
    loadMoreChatMessagesBefore: async () => ({ items: 0, hasMore: false }),
    loadMoreChatCyclesBefore: async () => ({ items: 0, hasMore: false }),
    readSettings: async () => ({ path: "settings.json", content: "{}", mtimeMs: 0 }),
    saveSettings: async () => ({ ok: true, file: { path: "settings.json", content: "{}", mtimeMs: 1 } }),
    listRecentWorkspaces: async () => [],
    listAllWorkspaces: async () => [],
    toggleWorkspaceFavorite: async () => {},
    removeWorkspace: async () => {},
    cleanMissingWorkspaces: cleanMissingWorkspacesMock,
    listDirectories: listDirectoriesMock,
    validateDirectory: validateDirectoryMock,
    retainApiCallStream: () => () => {},
    loadMoreLoopbusTimeline: async () => ({ logs: 0, traces: 0, hasMore: false }),
    loadMoreModelCalls: async () => ({ items: 0, hasMore: false }),
    loadMoreApiCalls: async () => ({ items: 0, hasMore: false }),
  }),
}));

beforeEach(() => {
  mockState = createState();
  stateListeners = [];
  listWorkspaceSessionsMock.mockReset();
  cleanMissingWorkspacesMock.mockReset();
  createSessionMock.mockClear();
  sendChatMock.mockClear();
  resolveDraftMock.mockClear();
  listDirectoriesMock.mockClear();
  validateDirectoryMock.mockClear();
  listWorkspaceSessionsMock.mockResolvedValue({
    items: [],
    nextCursor: null,
    counts: EMPTY_COUNTS,
  });
  cleanMissingWorkspacesMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("Feature: web ui app shell", () => {
  test("Scenario: Given app mounted When rendering Then show quick start shell", () => {
    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(screen.getByText("Agenter")).toBeInTheDocument();
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workspaces" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tasks" })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByText("Change"));
    fireEvent.click(screen.getByRole("button", { name: workspacePath }));
    fireEvent.click(screen.getByRole("button", { name: "Use this folder" }));

    await waitFor(() => {
      expect(screen.getAllByText(workspacePath).length).toBeGreaterThan(0);
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

    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));
    fireEvent.click(screen.getAllByTitle(workspacePath)[0]!);

    await waitFor(() => {
      expect(screen.getByText("No chat yet.")).toBeInTheDocument();
    });

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

    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));
    fireEvent.click(screen.getAllByTitle(workspacePath)[0]!);

    await waitFor(() => {
      expect(listWorkspaceSessionsMock).toHaveBeenCalledTimes(1);
    });

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
    expect(listWorkspaceSessionsMock).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given an opened session When chat is resumed Then the sidebar shows a deterministic dynamic session shortcut", async () => {
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
      expect(screen.getByRole("button", { name: `Build shell · ${sessionId}` })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));
    fireEvent.click(screen.getByRole("button", { name: /Clean Missing/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));

    await waitFor(() => {
      expect(cleanMissingWorkspacesMock).toHaveBeenCalledTimes(1);
    });
  });

  test("Scenario: Given LoopBus is back to waiting_commits While stage is stale Then the AI badge shows idle instead of thinking", () => {
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
          modelCapabilities: { imageInput: false },
          activeCycle: null,
        },
      },
    };

    render(<App wsUrl="ws://127.0.0.1:9999/trpc" />);

    expect(screen.getByText("AI: idle")).toBeInTheDocument();
  });
});
