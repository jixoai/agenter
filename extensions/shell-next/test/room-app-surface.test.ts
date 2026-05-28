import type { GlobalRoomEntry, GlobalRoomMessage } from "@agenter/client-sdk";
import { afterEach, describe, expect, test } from "bun:test";
import { MouseEvent } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";

import type { ShellNextRoomBootstrapResult } from "../src/product/bootstrap";
import { ShellNextRoomAppSurface } from "../src/surfaces/shell-next-room-app-surface";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

class RecordingAttachedRoomStore {
  readonly room: GlobalRoomEntry = {
    chatId: "room-shell-next",
    kind: "room",
    title: "Shell Next Room",
    owner: "ops",
    participants: [],
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
    roomRevision: "1",
    transcriptRevision: "1",
    focused: true,
    accessRole: "admin",
    accessToken: "tok:room-shell-next",
  };
  messages: GlobalRoomMessage[] = [
    {
      rowId: 1,
      messageId: 1,
      chatId: "room-shell-next",
      from: "@bangeel",
      senderActorId: "auth:bangeel" as GlobalRoomMessage["senderActorId"],
      kind: "text",
      content: "hello room",
      createdAt: 1,
      updatedAt: 1,
      readActorIds: [],
      unreadActorIds: [],
    },
  ];

  getState() {
    return {
      globalRoomSnapshotsById: {
        [this.room.chatId]: {
          data: {
            channel: this.room,
            items: this.messages,
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: "1",
            roomRevision: "1",
            transcriptRevision: "1",
          },
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: 1,
        },
      },
      globalTerminalApprovalsById: {},
    };
  }

  subscribe(): () => void {
    return () => undefined;
  }

  retainGlobalRoomSnapshot(): () => void {
    return () => undefined;
  }

  retainTerminalPermissionRequests(): () => void {
    return () => undefined;
  }

  async hydrateGlobalRoomSnapshot() {
    return {
      items: this.messages,
    };
  }

  async sendGlobalRoomMessage() {
    return { ok: true };
  }

  async pageGlobalRoomMessages() {
    return {
      items: this.messages,
      hasMore: false,
      nextBefore: null,
      roomRevision: "1",
      transcriptRevision: "1",
      headVersion: "1",
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
let surface: ShellNextRoomAppSurface | null = null;

afterEach(() => {
  surface?.dispose();
  surface = null;
  setup?.renderer.destroy();
  setup = null;
});

const createAttachedRoom = (store: RecordingAttachedRoomStore): ShellNextRoomBootstrapResult =>
  ({
    avatar: {
      avatarPrincipalId: "avatar-principal-1",
      nickname: "shell",
      displayName: "Shell Assistant",
      runtimeId: "runtime-1",
    },
    avatarCreated: false,
    session: { id: "session-1" },
    clearedRuntimeSessionIds: [],
    avatarActorId: "avatar-principal-1",
    terminal: {
      created: false,
      entry: {
        terminalId: "terminal-1",
        transportUrl: "ws://127.0.0.1/terminal-1",
      },
    },
    room: {
      created: false,
      entry: store.room,
    },
    binding: {
      productId: "shell-next",
      resourceKey: "shell-next-test",
      terminalId: "terminal-1",
      roomId: store.room.chatId,
      runtimeSessionId: "session-1",
      runtimeId: "runtime-1",
      avatarActorId: "avatar-principal-1",
      hostingContextId: "context-1",
    },
    promptSeeded: false,
    memoryFiles: [],
    managed: {
      managed: false,
      contextId: "context-1",
      contextDir: "/tmp/shell-next-test",
      bindingsPath: "/tmp/shell-next-test/bindings.json",
    },
  }) as unknown as ShellNextRoomBootstrapResult;

const findTextPosition = (frame: string, text: string): { x: number; y: number } | null => {
  const rows = frame.split("\n");
  for (let y = 0; y < rows.length; y += 1) {
    const x = rows[y].indexOf(text);
    if (x >= 0) {
      return { x, y };
    }
  }
  return null;
};

const waitForFrameText = async (setup: TestSetup, text: string): Promise<{ x: number; y: number } | null> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const position = findTextPosition(setup.captureCharFrame(), text);
    if (position) {
      return position;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();
  }
  return null;
};

describe("Feature: shell-next Room-backed Chat surface renderer selection", () => {
  test("Scenario: Given the Room-backed Chat surface installs the renderer semantic selection plugin When transcript row mouse-down events arrive through the surface Then the surface selects the whole word on the second click", async () => {
    setup = await createTestRenderer({ width: 64, height: 18, useMouse: true, kittyKeyboard: true });
    const store = new RecordingAttachedRoomStore();
    surface = new ShellNextRoomAppSurface({
      renderer: setup.renderer,
      node: {
        id: "chat",
        sourceId: "chat",
        sourceKind: "opentui-renderable",
        rect: { x: 0, y: 0, width: 64, height: 18 },
        focused: true,
      },
      room: {
        store,
        shellName: "shell-next-test",
        attached: createAttachedRoom(store),
      },
      layoutMode: "right",
    });
    setup.renderer.root.add(surface.root);
    await setup.renderOnce();

    const position = await waitForFrameText(setup, "hello room");
    expect(position).not.toBeNull();
    const row = setup.renderer.root.findDescendantById("shell-next-room-row-message:1:row-0");
    expect(row).toBeDefined();

    surface.root.processMouseEvent(
      new MouseEvent(row ?? null, {
        type: "down",
        button: 0,
        x: (position?.x ?? 0) + 1,
        y: position?.y ?? 0,
        modifiers: { shift: false, alt: false, ctrl: false },
      }),
    );
    surface.root.processMouseEvent(
      new MouseEvent(row ?? null, {
        type: "down",
        button: 0,
        x: (position?.x ?? 0) + 1,
        y: position?.y ?? 0,
        modifiers: { shift: false, alt: false, ctrl: false },
      }),
    );
    await setup.renderOnce();

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe("hello");
  });
});
