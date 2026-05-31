import { createTestRenderer } from "@opentui/core/testing";
import type {
  AuthSessionOutput,
  CachedResourceState,
  GlobalAvatarCatalogEntry,
  GlobalRoomEntry,
  GlobalTerminalEntry,
} from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

import { ShellNavigationApp, type ShellNavigationSelection } from "../src/app-navigation/navigation-app";
import { startShellNavigationTui } from "../src/app-navigation/run-navigation-tui";
import type { ShellNavigationShellItem, ShellNavigationStore } from "../src/app-navigation/navigation-model";
import { defaultShellSettings } from "../src/app-room/settings";
import { SHELL_APP_ID } from "../src/app-runtime/app";
import { createAvatarEntry, createRoomEntry, createTerminalEntry } from "./fake-shell-store";

const key = (name: string) => ({
  name,
  ctrl: false,
  meta: false,
  shift: false,
  option: false,
  sequence: name === "return" ? "\r" : name,
  raw: name === "return" ? "\r" : name,
  number: false,
  eventType: "press" as const,
  source: "raw" as const,
});

const existingShell: ShellNavigationShellItem = {
  kind: "shell",
  shellName: "shell-7",
  terminalId: "terminal-7",
  title: "dev",
  processPhase: "running",
  updatedAt: 7,
  currentTitle: "dev",
  currentPath: "/repo",
  roomId: "room-7",
  avatarNickname: "AAA",
  peopleMentions: ["@AAA"],
  rowFields: {
    id: "shell-7",
    pwd: "/repo",
    title: "dev",
    people: "@AAA",
  },
};

const newShell: ShellNavigationShellItem = {
  kind: "new-shell",
  shellName: "shell-8",
  title: "New Terminal",
};

const cached = <T,>(data: T): CachedResourceState<T> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: 1,
});

const shellTerminalEntry = (title: string): GlobalTerminalEntry => ({
  ...createTerminalEntry("terminal-7", {
    appId: SHELL_APP_ID,
    resourceKey: "shell-7",
    resourceKind: "terminal",
    ownerSystem: "terminal-system",
  }),
  currentTitle: title,
  currentPath: "/repo",
  updatedAt: 7,
});

const shellRoomEntry = (): GlobalRoomEntry => ({
  ...createRoomEntry(
    "room-7",
    {
      appId: SHELL_APP_ID,
      resourceKey: "shell-7",
      resourceKind: "room",
      ownerSystem: "message-system",
    },
    "shell-7",
  ),
  participants: [{ id: "auth:AAA", label: "AAA" }],
});

describe("Feature: shell entry navigation", () => {
  test("Scenario: Given an existing Terminal row When confirmed Then navigation completes without Avatar step", async () => {
    const setup = await createTestRenderer({ width: 72, height: 12 });
    const completed: ShellNavigationSelection[] = [];
    const app = new ShellNavigationApp({
      renderer: setup.renderer,
      shellItems: [newShell, existingShell],
      defaultShellIndex: 1,
      needsShell: true,
      avatarItems: [],
      defaultAvatarIndex: 0,
      needsAvatar: true,
      createAvatar: async () => undefined,
      onComplete: (selection) => {
        completed.push(selection);
      },
    });
    app.start();
    setup.renderer.keyInput.processParsedKey(key("return"));
    await setup.renderOnce();
    app.dispose();
    setup.renderer.destroy();

    expect(completed).toEqual([
      {
        shellName: "shell-7",
        avatarNickname: "AAA",
        createAvatar: false,
        entryKind: "existing-shell",
        skipBindingGrantEnsure: true,
      },
    ]);
  });

  test("Scenario: Given New Terminal row When confirmed Then navigation still asks for Avatar", async () => {
    const setup = await createTestRenderer({ width: 72, height: 12 });
    let completed: ShellNavigationSelection | null = null;
    const app = new ShellNavigationApp({
      renderer: setup.renderer,
      shellItems: [newShell],
      defaultShellIndex: 0,
      needsShell: true,
      avatarItems: [
        {
          kind: "avatar",
          nickname: "AAA",
          displayName: "AAA",
          classify: null,
          defaultAvatar: false,
        },
      ],
      defaultAvatarIndex: 0,
      needsAvatar: true,
      createAvatar: async () => undefined,
      onComplete: (selection) => {
        completed = selection;
      },
    });
    app.start();
    setup.renderer.keyInput.processParsedKey(key("return"));
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    app.dispose();
    setup.renderer.destroy();

    expect(completed).toBeNull();
    expect(frame).toContain("Select Avatar");
  });

  test("Scenario: Given the visual New Terminal row is clicked When another row was selected Then hit testing honors the bordered screen coordinates", async () => {
    const setup = await createTestRenderer({ width: 72, height: 12, useMouse: true });
    const completed: ShellNavigationSelection[] = [];
    const app = new ShellNavigationApp({
      renderer: setup.renderer,
      shellItems: [newShell, existingShell],
      defaultShellIndex: 1,
      needsShell: true,
      avatarItems: [
        {
          kind: "avatar",
          nickname: "AAA",
          displayName: "AAA",
          classify: null,
          defaultAvatar: false,
        },
      ],
      defaultAvatarIndex: 0,
      needsAvatar: true,
      createAvatar: async () => undefined,
      onComplete: (selection) => {
        completed.push(selection);
      },
    });
    app.start();
    await setup.renderOnce();

    await setup.mockMouse.click(4, 5);
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    app.dispose();
    setup.renderer.destroy();

    expect(completed).toEqual([]);
    expect(frame).toContain("Select Avatar");
  });

  test("Scenario: Given a wrapped Terminal row When mouse is pressed Then it only selects until click release confirms", async () => {
    const setup = await createTestRenderer({ width: 36, height: 12, useMouse: true });
    const completed: ShellNavigationSelection[] = [];
    const wrappedShell: ShellNavigationShellItem = {
      ...existingShell,
      currentTitle: "long-running-pty-title",
      currentPath: "/workspace/deep/project",
      rowFields: {
        id: "shell-7",
        pwd: "/workspace/deep/project",
        title: "long-running-pty-title",
        people: "@AAA",
      },
    };
    const app = new ShellNavigationApp({
      renderer: setup.renderer,
      shellItems: [newShell, wrappedShell],
      defaultShellIndex: 0,
      needsShell: true,
      avatarItems: [],
      defaultAvatarIndex: 0,
      needsAvatar: true,
      createAvatar: async () => undefined,
      onComplete: (selection) => {
        completed.push(selection);
      },
    });
    app.start();
    await setup.renderOnce();

    await setup.mockMouse.pressDown(4, 6);
    await setup.renderOnce();
    expect(completed).toEqual([]);

    await setup.mockMouse.release(4, 6);
    await setup.renderOnce();
    app.dispose();
    setup.renderer.destroy();

    expect(completed).toEqual([
      {
        shellName: "shell-7",
        avatarNickname: "AAA",
        createAvatar: false,
        entryKind: "existing-shell",
        skipBindingGrantEnsure: true,
      },
    ]);
  });

  test("Scenario: Given terminal identity changes while navigation is open When the store emits Then Select Terminal refreshes the pty title", async () => {
    const setup = await createTestRenderer({ width: 72, height: 12 });
    let terminal = shellTerminalEntry("old-title");
    let terminalState = cached<GlobalTerminalEntry[]>([terminal]);
    const roomState = cached<GlobalRoomEntry[]>([shellRoomEntry()]);
    const listeners = new Set<() => void>();
    const store: ShellNavigationStore = {
      async listGlobalTerminals(): Promise<GlobalTerminalEntry[]> {
        return terminalState.data;
      },
      async listGlobalTerminalIndex(): Promise<GlobalTerminalEntry[]> {
        return terminalState.data;
      },
      async listGlobalTerminalHistory(): Promise<GlobalTerminalEntry[]> {
        return [];
      },
      async listGlobalRooms(): Promise<GlobalRoomEntry[]> {
        return roomState.data;
      },
      async getAuthSession(): Promise<AuthSessionOutput> {
        return { claims: { authId: "root-superadmin", superadmin: true } } as AuthSessionOutput;
      },
      getGlobalTerminalsState(): CachedResourceState<GlobalTerminalEntry[]> {
        return terminalState;
      },
      getGlobalRoomsState(): CachedResourceState<GlobalRoomEntry[]> {
        return roomState;
      },
      retainGlobalTerminals(): () => void {
        return () => undefined;
      },
      retainGlobalRooms(): () => void {
        return () => undefined;
      },
      subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      async hydrateGlobalAvatarCatalog(): Promise<GlobalAvatarCatalogEntry[]> {
        return [createAvatarEntry("AAA")];
      },
      async createGlobalAvatar(): Promise<GlobalAvatarCatalogEntry> {
        return createAvatarEntry("created");
      },
    };

    const controller = await startShellNavigationTui({
      store,
      settings: defaultShellSettings(),
      needsShell: true,
      needsAvatar: false,
      initialAvatarNickname: "AAA",
      renderer: setup.renderer,
    });
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("old-title");

    terminal = { ...terminal, currentTitle: "new-title" };
    terminalState = cached([terminal]);
    for (const listener of listeners) {
      listener();
    }
    await Bun.sleep(80);
    await setup.renderOnce();
    const refreshedFrame = setup.captureCharFrame();
    controller.destroy();
    setup.renderer.destroy();

    expect(refreshedFrame).toContain("new-title");
  });
});
