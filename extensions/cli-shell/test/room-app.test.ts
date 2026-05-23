import type { CachedResourceState, GlobalRoomEntry, GlobalRoomMessage, RuntimeClientState, SessionEntry } from "@agenter/client-sdk";
import { afterEach, describe, expect, test } from "bun:test";
import { TextareaRenderable } from "@opentui/core";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { startCliShellRoomApp, type CliShellRoomAppStore, type CliShellRoomLayoutMode } from "../src/tui/room-app";
import type { CliShellKeybindings } from "../src/tui/settings";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

const cached = <T>(data: T): CachedResourceState<T> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: 1,
});

const createRoomEntry = (chatId: string): GlobalRoomEntry => ({
  chatId,
  kind: "room",
  title: chatId,
  owner: "ops",
  participants: [],
  metadata: {},
  createdAt: 1,
  updatedAt: 1,
  focused: true,
  accessRole: "admin",
  accessToken: `tok:${chatId}`,
});

const createSessionEntry = (avatar: string): SessionEntry => ({
  id: `session:/repo:${avatar}`,
  name: avatar,
  cwd: "/repo",
  workspacePath: "/repo",
  avatar,
  avatarPrincipalId: `auth:${avatar}`,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  status: "running",
  storageState: "active",
  sessionRoot: `/tmp/${avatar}`,
  storeTarget: "global",
});

class RoomAppStore implements CliShellRoomAppStore {
  sentMessages: Array<{ chatId: string; text: string; accessToken?: string }> = [];
  hydrateCalls = 0;
  failHydrateAfterSend = false;

  getState(): Pick<RuntimeClientState, "globalRoomSnapshotsById" | "globalTerminalApprovalsById"> {
    return {
      globalRoomSnapshotsById: {
        "room-shell-5": cached({
          channel: createRoomEntry("room-shell-5"),
          items: [
            {
              rowId: 1,
              messageId: 1,
              chatId: "room-shell-5",
              from: "@bangeel",
              senderActorId: "auth:bangeel",
              kind: "text",
              content: "hello from room",
              createdAt: 1,
              updatedAt: 1,
              readActorIds: [],
              unreadActorIds: [],
            },
          ],
          nextBefore: null,
          hasMoreBefore: false,
          headVersion: "1",
        }),
      },
      globalTerminalApprovalsById: {},
    };
  }

  subscribe(): () => void {
    return () => {};
  }

  retainGlobalRoomSnapshot(): () => void {
    return () => {};
  }

  retainTerminalPermissionRequests(): () => void {
    return () => {};
  }

  async hydrateGlobalRoomSnapshot(): Promise<null> {
    this.hydrateCalls += 1;
    if (this.failHydrateAfterSend && this.hydrateCalls > 1) {
      throw new Error("refresh exploded");
    }
    return null;
  }

  async sendGlobalRoomMessage(input: {
    chatId: string;
    text: string;
    accessToken?: string;
  }): Promise<{ ok: boolean }> {
    this.sentMessages.push(input);
    return { ok: true };
  }

  async pageGlobalRoomMessages(): Promise<{ items: GlobalRoomMessage[]; hasMore: boolean; nextBefore: null }> {
    return {
      items: [
        {
          rowId: 11,
          messageId: 11,
          chatId: "room-shell-5",
          from: "@bangeel",
          senderActorId: "auth:bangeel",
          kind: "text",
          content: "history line",
          createdAt: 11,
          updatedAt: 11,
          readActorIds: [],
          unreadActorIds: [],
        },
      ],
      hasMore: false,
      nextBefore: null,
    };
  }

  async hydrateGlobalTerminalApprovals(): Promise<[]> {
    return [];
  }

  async approveGlobalTerminalRequest(): Promise<unknown> {
    return {};
  }

  async denyGlobalTerminalRequest(): Promise<unknown> {
    return {};
  }
}

let setup: TestSetup | null = null;

afterEach(() => {
  setup?.renderer.destroy();
  setup = null;
});

const startRoom = async (input?: {
  store?: RoomAppStore;
  keybindings?: CliShellKeybindings;
  onQuit?: () => void;
  onLayoutRequest?: (mode: CliShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
}): Promise<TestSetup & { store: RoomAppStore }> => {
  setup = await createTestRenderer({ width: 80, height: 20, useMouse: true, kittyKeyboard: true });
  const store = input?.store ?? new RoomAppStore();
  await startCliShellRoomApp({
    store,
    shellName: "shell-5",
    keybindings: input?.keybindings,
    renderer: setup.renderer as TestRenderer,
    attached: {
      avatar: {
        avatarPrincipalId: "auth:bangeel",
        runtimeId: "runtime:bangeel",
        nickname: "bangeel",
        displayName: "bangeel",
        classify: null,
        iconUrl: null,
        defaultAvatar: false,
        sourceScope: "global",
        globalAvailable: true,
        workspacePrivateSlotReady: false,
        globalPath: "/global/bangeel",
        workspacePrivatePath: "/repo/.agenter/avatars/by-principal/auth:bangeel",
        effectivePath: "/global/bangeel",
      },
      avatarCreated: false,
      session: createSessionEntry("bangeel"),
      clearedRuntimeSessionIds: [],
      avatarActorId: "auth:bangeel",
      terminal: {
        entry: {
          terminalId: "terminal-shell-5",
          processKind: "shell",
          backend: "xterm",
          command: ["/bin/bash"],
          launchCwd: "/repo",
          workspace: null,
          status: "IDLE",
          processPhase: "running",
          seq: 1,
          snapshot: {
            seq: 1,
            timestamp: 1,
            cols: 80,
            rows: 24,
            lines: Array.from({ length: 24 }, () => ""),
            cursor: { x: 0, y: 0 },
            scrollback: {
              viewportOffset: 0,
              totalLines: 24,
              screenLines: 24,
            },
          },
          focused: true,
          icon: undefined,
          configuredTitle: "terminal-shell-5",
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
          transportUrl: "ws://127.0.0.1/pty/terminal-shell-5",
          currentAdminId: null,
          approvalTimeoutMs: 90_000,
          pendingRequestCount: 0,
          access: {
            role: "admin",
            accessToken: "tok:terminal-shell-5",
            participantId: "system:trusted-terminal-bootstrap",
            currentAdmin: true,
          },
          actors: [],
          metadata: {
            productId: "cli-shell",
            resourceKey: "shell-5",
            ownerSystem: "terminal-system",
          },
        },
        created: false,
        granted: false,
        focused: true,
        bindingMetadata: { productId: "cli-shell", resourceKey: "shell-5", ownerSystem: "terminal-system" },
      },
      room: {
        entry: createRoomEntry("room-shell-5"),
        created: false,
        granted: false,
        focused: true,
        bindingMetadata: { productId: "cli-shell", resourceKey: "shell-5", ownerSystem: "message-system" },
      },
      binding: {
        productId: "cli-shell",
        resourceKey: "shell-5",
        terminalId: "terminal-shell-5",
        roomId: "room-shell-5",
        runtimeSessionId: "session:/repo:bangeel",
        runtimeId: "runtime:bangeel",
        avatarActorId: "auth:bangeel",
        hostingContextId: "ctx-hosting-shell-5",
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        contextId: "ctx-hosting-shell-5",
        hostingMatches: [],
        hostingActive: false,
      },
    },
    onQuit: input?.onQuit,
    onLayoutRequest: input?.onLayoutRequest,
  });
  await setup.renderOnce();
  return {
    ...setup,
    store,
  };
};

const flushRoomAsync = async (room: TestSetup, cycles = 3): Promise<void> => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
    await room.renderOnce();
  }
};

describe("Feature: cli-shell OpenTUI room titlebar", () => {
  test("Scenario: Given Chat runs in OpenTUI When rendered Then the titlebar exposes a close button", async () => {
    const room = await startRoom();

    expect(room.captureCharFrame()).toContain("Chat [x] ◨  ◧  ⿴");
  });

  test("Scenario: Given the user clicks close When the titlebar handles it Then the Chat surface requests quit", async () => {
    let closed = false;
    const room = await startRoom({
      onQuit: () => {
        closed = true;
      },
    });

    await room.mockMouse.click(7, 0);

    expect(closed).toBe(true);
  });

  test("Scenario: Given the user clicks a layout control When Chat handles it Then OpenTUI requests tmux layout instead of self-layout", async () => {
    const requested: CliShellRoomLayoutMode[] = [];
    let closed = false;
    const room = await startRoom({
      onQuit: () => {
        closed = true;
      },
      onLayoutRequest: (mode) => {
        requested.push(mode);
      },
    });

    await room.mockMouse.click(11, 0);

    expect(requested).toEqual(["left"]);
    expect(closed).toBe(true);
    expect(room.captureCharFrame()).toContain("hello from room");
  });

  test("Scenario: Given tmux keeps the current pane surface When layout switching returns closeCurrentSurface false Then Room stays alive", async () => {
    const requested: CliShellRoomLayoutMode[] = [];
    let closed = false;
    const room = await startRoom({
      onQuit: () => {
        closed = true;
      },
      onLayoutRequest: async (mode) => {
        requested.push(mode);
        return { closeCurrentSurface: false };
      },
    });

    await room.mockMouse.click(11, 0);

    expect(requested).toEqual(["left"]);
    expect(closed).toBe(false);
    expect(room.captureCharFrame()).toContain("hello from room");
  });
});

describe("Feature: cli-shell OpenTUI room input", () => {
  test("Scenario: Given Chat room is rendered When the draft control is inspected Then it is a focused multiline OpenTUI textarea with a cursor", async () => {
    const room = await startRoom();
    const root = room.renderer.root.getRenderable("cli-shell-room-root");
    const draft = root?.getRenderable("cli-shell-room-draft");

    expect(draft).toBeInstanceOf(TextareaRenderable);
    expect(draft?.focused).toBe(true);
    expect(room.renderer.currentFocusedRenderable?.id).toBe("cli-shell-room-draft");
  });

  test("Scenario: Given Chat input lost focus When the user clicks the MessageRoom surface Then the draft input is focused again", async () => {
    const room = await startRoom();
    const root = room.renderer.root.getRenderable("cli-shell-room-root");
    const draft = root?.getRenderable("cli-shell-room-draft");
    if (!(draft instanceof TextareaRenderable)) {
      throw new Error("draft input must be an OpenTUI TextareaRenderable");
    }
    draft.blur();

    await room.mockMouse.click(5, 5);

    expect(room.renderer.currentFocusedRenderable?.id).toBe("cli-shell-room-draft");
  });

  test("Scenario: Given terminal approval requests exist When Room renders Then approval UI is not embedded inside the MessageRoom surface", async () => {
    const room = await startRoom();

    expect(room.renderer.root.getRenderable("cli-shell-room-top-layer")).toBeUndefined();
    expect(room.captureCharFrame()).not.toContain("Terminal write approval");
  });

  test("Scenario: Given the composer uses cli-shell product keybindings When the user presses Enter and Shift+Enter Then Enter sends while Shift+Enter keeps multiline editing", async () => {
    const room = await startRoom();

    await room.mockInput.typeText("line 1");
    room.mockInput.pressEnter({ shift: true });
    await flushRoomAsync(room);
    await room.mockInput.typeText("line 2");
    room.mockInput.pressEnter();
    await flushRoomAsync(room);

    expect(room.store.sentMessages).toEqual([
      {
        accessToken: "tok:room-shell-5",
        chatId: "room-shell-5",
        text: "line 1\nline 2",
      },
    ]);
  });

  test("Scenario: Given the current draft is empty When the user submits /history and accepts the selected item Then cli-shell inserts that history item into the textarea", async () => {
    const room = await startRoom();
    const root = room.renderer.root.getRenderable("cli-shell-room-root");
    const draft = root?.getRenderable("cli-shell-room-draft");
    if (!(draft instanceof TextareaRenderable)) {
      throw new Error("draft input must be an OpenTUI TextareaRenderable");
    }

    draft.replaceText("/history");
    await flushRoomAsync(room);
    room.mockInput.pressEnter();
    await flushRoomAsync(room);
    room.mockInput.pressEnter();
    await flushRoomAsync(room);

    expect(draft.plainText).toBe("history line");
  });

  test("Scenario: Given the current draft is non-empty When the user picks a history item and confirms replacement Then cli-shell replaces the draft", async () => {
    const room = await startRoom({
      keybindings: {
        composer: {
          history: ["ctrl+h"],
        },
      },
    });
    const root = room.renderer.root.getRenderable("cli-shell-room-root");
    const draft = root?.getRenderable("cli-shell-room-draft");
    if (!(draft instanceof TextareaRenderable)) {
      throw new Error("draft input must be an OpenTUI TextareaRenderable");
    }

    draft.replaceText("existing draft");
    await flushRoomAsync(room);
    room.mockInput.pressKey("h", { ctrl: true });
    await flushRoomAsync(room);
    room.mockInput.pressEnter();
    await flushRoomAsync(room);
    room.mockInput.pressEnter();
    await flushRoomAsync(room);

    expect(draft.plainText).toBe("history line");
  });

  test("Scenario: Given the current draft is non-empty When the user cancels replacement in the history confirm panel Then cli-shell inserts the history item at the current cursor", async () => {
    const room = await startRoom({
      keybindings: {
        composer: {
          history: ["ctrl+h"],
        },
      },
    });
    const root = room.renderer.root.getRenderable("cli-shell-room-root");
    const draft = root?.getRenderable("cli-shell-room-draft");
    if (!(draft instanceof TextareaRenderable)) {
      throw new Error("draft input must be an OpenTUI TextareaRenderable");
    }

    draft.replaceText("alpha beta");
    draft.cursorOffset = 6;
    await flushRoomAsync(room);
    room.mockInput.pressKey("h", { ctrl: true });
    await flushRoomAsync(room);
    room.mockInput.pressEnter();
    await flushRoomAsync(room);
    room.mockInput.pressEscape();
    await flushRoomAsync(room);

    expect(draft.plainText).toBe("alpha history linebeta");
  });

  test("Scenario: Given message send succeeds but refresh fails When the user submits Then cli-shell clears the draft and reports refresh failure without rewriting the send result", async () => {
    const store = new RoomAppStore();
    store.failHydrateAfterSend = true;
    const room = await startRoom({ store });
    const root = room.renderer.root.getRenderable("cli-shell-room-root");
    const draft = root?.getRenderable("cli-shell-room-draft");
    if (!(draft instanceof TextareaRenderable)) {
      throw new Error("draft input must be an OpenTUI TextareaRenderable");
    }

    await room.mockInput.typeText("hello refresh");
    room.mockInput.pressEnter();
    await flushRoomAsync(room, 5);

    expect(store.sentMessages).toEqual([
      {
        accessToken: "tok:room-shell-5",
        chatId: "room-shell-5",
        text: "hello refresh",
      },
    ]);
    expect(draft.plainText).toBe("");
    expect(room.captureCharFrame()).toContain("message sent; refresh failed: refresh exploded");
  });
});
