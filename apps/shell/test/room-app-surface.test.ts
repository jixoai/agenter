import type {
  GlobalAvatarCatalogEntry,
  GlobalRoomActorId,
  GlobalRoomEntry,
  GlobalRoomGrantEntry,
  GlobalRoomMessage,
  GlobalTerminalActorId,
  GlobalTerminalGrantEntry,
} from "@agenter/client-sdk";
import { KeyEvent, MouseEvent } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, test } from "bun:test";

import type { ShellRoomBootstrapResult } from "../src/app-runtime/bootstrap";
import { ShellRoomAppSurface } from "../src/surfaces/shell-room-app-surface";
import { createAvatarEntry } from "./fake-shell-store";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

class RecordingAttachedRoomStore {
  readonly room: GlobalRoomEntry = {
    chatId: "room-shell",
    kind: "room",
    title: "Shell Room",
    owner: "ops",
    superKey: "0x0000000000000000000000000000000000000001",
    createdBySystemId: "0x0000000000000000000000000000000000000001",
    participants: [],
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
    roomRevision: "1",
    transcriptRevision: "1",
    focused: true,
    accessRole: "admin",
    accessToken: "tok:room-shell",
  };
  messages: GlobalRoomMessage[] = [
    {
      rowId: 1,
      messageId: 1,
      chatId: "room-shell",
      sourceSystemId: "0x0000000000000000000000000000000000000001",
      senderContactId: "auth:bangeel",
      from: "@bangeel",
      kind: "text",
      content: "hello room",
      createdAt: 1,
      updatedAt: 1,
      readContactIds: [],
      unreadContactIds: [],
    },
  ];
  avatars: GlobalAvatarCatalogEntry[] = [];
  roomGrants: GlobalRoomGrantEntry[] = [];
  terminalGrants: GlobalTerminalGrantEntry[] = [];

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

  async hydrateGlobalAvatarCatalog(): Promise<GlobalAvatarCatalogEntry[]> {
    return this.avatars;
  }

  async listGlobalRoomGrants(): Promise<GlobalRoomGrantEntry[]> {
    return this.roomGrants;
  }

  async issueGlobalRoomGrant(input: {
    chatId: string;
    role: "admin" | "member" | "readonly";
    participantId: GlobalRoomActorId;
    label?: string;
  }): Promise<unknown> {
    const grant = {
      grantId: `room:${input.participantId}`,
      chatId: input.chatId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      accessToken: `room-token:${input.participantId}`,
      createdAt: Date.now(),
    } satisfies GlobalRoomGrantEntry;
    this.roomGrants = this.roomGrants.filter((item) => item.participantId !== input.participantId).concat(grant);
    return grant;
  }

  async revokeGlobalRoomGrant(input: { grantId: string }): Promise<unknown> {
    this.roomGrants = this.roomGrants.filter((grant) => grant.grantId !== input.grantId);
    return { ok: true };
  }

  async listGlobalTerminalGrants(): Promise<GlobalTerminalGrantEntry[]> {
    return this.terminalGrants;
  }

  async issueGlobalTerminalGrant(input: {
    terminalId: string;
    role: "admin" | "writer" | "guard" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
  }): Promise<unknown> {
    const grant = {
      grantId: `terminal:${input.participantId}`,
      terminalId: input.terminalId,
      role: input.role,
      participantId: input.participantId,
      label: input.label,
      accessToken: `terminal-token:${input.participantId}`,
      createdAt: Date.now(),
    } satisfies GlobalTerminalGrantEntry;
    this.terminalGrants = this.terminalGrants
      .filter((item) => item.participantId !== input.participantId)
      .concat(grant);
    return grant;
  }

  async revokeGlobalTerminalGrant(input: { grantId: string }): Promise<unknown> {
    this.terminalGrants = this.terminalGrants.filter((grant) => grant.grantId !== input.grantId);
    return { ok: true };
  }
}

let setup: TestSetup | null = null;
let surface: ShellRoomAppSurface | null = null;

afterEach(() => {
  surface?.dispose();
  surface = null;
  setup?.renderer.destroy();
  setup = null;
});

const createAttachedRoom = (store: RecordingAttachedRoomStore): ShellRoomBootstrapResult =>
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
      appId: "shell",
      resourceKey: "shell-test",
      terminalId: "terminal-1",
      roomId: store.room.chatId,
      runtimeSessionId: "session-1",
      runtimeId: "runtime-1",
      avatarActorId: "avatar-principal-1",
      hostingContextId: "context-1",
    },
    promptSeeded: false,
    managed: {
      managed: false,
      contextId: "context-1",
      contextDir: "/tmp/shell-test",
      bindingsPath: "/tmp/shell-test/bindings.json",
    },
  }) as unknown as ShellRoomBootstrapResult;

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

const settle = async (setup: TestSetup): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await setup.renderOnce();
};

const key = (name: string): KeyEvent =>
  new KeyEvent({
    name,
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    sequence: name === "return" ? "\r" : name,
    raw: name === "return" ? "\r" : name,
    number: false,
    eventType: "press",
    source: "raw",
  });

const startRoomSurface = async (store: RecordingAttachedRoomStore): Promise<TestSetup> => {
  setup = await createTestRenderer({ width: 64, height: 18, useMouse: true, kittyKeyboard: true });
  surface = new ShellRoomAppSurface({
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
      shellName: "shell-test",
      attached: createAttachedRoom(store),
    },
    layoutMode: "right",
  });
  setup.renderer.root.add(surface.root);
  await settle(setup);
  return setup;
};

describe("Feature: shell Room-backed Chat surface renderer selection", () => {
  test("Scenario: Given the Room-backed Chat surface installs the renderer semantic selection plugin When transcript row mouse-down events arrive through the surface Then the surface selects the whole word on the second click", async () => {
    setup = await createTestRenderer({ width: 64, height: 18, useMouse: true, kittyKeyboard: true });
    const store = new RecordingAttachedRoomStore();
    surface = new ShellRoomAppSurface({
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
        shellName: "shell-test",
        attached: createAttachedRoom(store),
      },
      layoutMode: "right",
    });
    setup.renderer.root.add(surface.root);
    await setup.renderOnce();

    const position = await waitForFrameText(setup, "hello room");
    expect(position).not.toBeNull();
    const row = setup.renderer.root.findDescendantById("shell-room-row-message:1:row-0");
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

describe("Feature: shell /avatar Room command panel", () => {
  test("Scenario: Given Room composer focus When /avatar is submitted Then the panel opens and Escape returns to composer editing", async () => {
    const store = new RecordingAttachedRoomStore();
    store.avatars = [createAvatarEntry("AAA")];
    const setup = await startRoomSurface(store);

    await setup.mockInput.typeText("/avatar");
    setup.mockInput.pressEnter();
    await settle(setup);
    await settle(setup);

    expect(setup.captureCharFrame()).toContain("@AAA  room:none  terminal:none");

    expect(surface?.handleKeypress(key("escape"))).toBe(true);
    await settle(setup);

    const frame = setup.captureCharFrame();
    expect(frame).toContain("/history /avatar");
    expect(frame).not.toContain("@AAA  room:none  terminal:none");
  });

  test("Scenario: Given the /avatar panel When adding, editing, and removing an Avatar Then it mutates only system grants", async () => {
    const store = new RecordingAttachedRoomStore();
    store.avatars = [createAvatarEntry("AAA")];
    const setup = await startRoomSurface(store);

    await setup.mockInput.typeText("/avatar");
    setup.mockInput.pressEnter();
    await settle(setup);
    await settle(setup);

    setup.mockInput.pressEnter();
    await settle(setup);
    await settle(setup);

    expect(store.roomGrants).toMatchObject([{ chatId: "room-shell", participantId: "auth:AAA", role: "member" }]);
    expect(store.terminalGrants).toMatchObject([
      { terminalId: "terminal-1", participantId: "auth:AAA", role: "writer" },
    ]);

    expect(surface?.handleKeypress(key("r"))).toBe(true);
    await settle(setup);
    await settle(setup);
    expect(store.roomGrants).toMatchObject([{ participantId: "auth:AAA", role: "readonly" }]);

    expect(surface?.handleKeypress(key("t"))).toBe(true);
    await settle(setup);
    await settle(setup);
    expect(store.terminalGrants).toMatchObject([{ participantId: "auth:AAA", role: "guard" }]);

    expect(surface?.handleKeypress(key("delete"))).toBe(true);
    await settle(setup);
    await settle(setup);
    expect(store.roomGrants).toEqual([]);
    expect(store.terminalGrants).toEqual([]);
    expect(store.avatars).toHaveLength(1);
  });
});
