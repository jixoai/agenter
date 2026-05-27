import type { GlobalAvatarCatalogEntry } from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

import { bootstrapShellNextRoom } from "../src/product/bootstrap";
import {
  defaultShellNextKeybindings,
  defaultShellNextSettings,
  type ShellNextSettings,
} from "../src/product-room/settings";

import { FakeShellNextStore } from "./fake-shell-next-store";
import { createShellNextRuntimeApprovalStore } from "../src/product/approval-store";
import { parseShellNextArgs } from "../src/product/argv";
import type { ShellNextProductRunDependencies } from "../src/product/runtime";
import type { ChildLayoutNode } from "../src/renderable-mux/layout";
import { createPaneSourceId, type PaneSource, type TerminalFrameSnapshot } from "../src/renderable-mux/pane-source";
import { isShellNextMetadataOnlyArgv, runShellNext } from "../src/run-shell-next";

describe("Feature: shell-next argv metadata boundary", () => {
  test("Scenario: Given metadata flags When classifying argv Then help and version stay side-effect free", () => {
    expect(isShellNextMetadataOnlyArgv(["--help"])).toBe(true);
    expect(isShellNextMetadataOnlyArgv(["renderer-grid-demo", "--help"])).toBe(true);
    expect(isShellNextMetadataOnlyArgv(["--version"])).toBe(true);
    expect(isShellNextMetadataOnlyArgv(["version"])).toBe(true);
  });

  test("Scenario: Given metadata words are product values When classifying argv Then they do not swallow the demo command", () => {
    expect(isShellNextMetadataOnlyArgv(["renderer-grid-demo", "--selection-text", "help"])).toBe(false);
    expect(isShellNextMetadataOnlyArgv(["renderer-grid-demo", "--selection-text", "version"])).toBe(false);
  });
});

const seedAvatar = (store: FakeShellNextStore, nickname: string): void => {
  store.avatars.push({
    avatarPrincipalId: `auth:${nickname}`,
    runtimeId: `runtime:${nickname}`,
    nickname,
    displayName: nickname,
    classify: null,
    iconUrl: null,
    defaultAvatar: false,
    sourceScope: "global",
    globalAvailable: true,
    workspacePrivateSlotReady: false,
    globalPath: `/global/${nickname}`,
    workspacePrivatePath: `/workspace/.agenter/avatars/by-principal/${nickname}`,
    effectivePath: `/global/${nickname}`,
  } satisfies GlobalAvatarCatalogEntry);
};

const testNode: ChildLayoutNode = {
  id: "pane-1",
  sourceId: "source-1",
  sourceKind: "terminal-protocol",
  rect: { x: 0, y: 0, width: 20, height: 8 },
  focused: true,
};

const createTestDependencies = (input: {
  store: FakeShellNextStore;
  tty?: boolean;
  bootstrap?: ShellNextProductRunDependencies["bootstrapRoom"];
  startApp?: ShellNextProductRunDependencies["startApp"];
  navigation?: ShellNextProductRunDependencies["startNavigationTui"];
  savedSettings?: ShellNextSettings[];
  output?: string[];
  liveSourceCalls?: Array<{ id: string; terminalId: string; transportUrl: string }>;
}): ShellNextProductRunDependencies => ({
  createClient: () => ({ close() {} }) as ReturnType<ShellNextProductRunDependencies["createClient"]>,
  createStore: () => input.store as unknown as ReturnType<ShellNextProductRunDependencies["createStore"]>,
  bootstrapRoom: input.bootstrap ?? (async (bootstrapInput) => await bootstrapShellNextRoom(bootstrapInput)),
  startNavigationTui:
    input.navigation ??
    (async () => ({
      shellName: "shell-9",
      avatarNickname: "bangeel",
      createAvatar: false,
    })),
  startApp:
    input.startApp ??
    (async () => ({
      finished: Promise.resolve(),
      destroy() {},
    })),
  createLiveTerminalSource: (sourceInput): PaneSource => {
    input.liveSourceCalls?.push({
      id: sourceInput.id,
      terminalId: sourceInput.terminalId,
      transportUrl: sourceInput.transportUrl,
    });
    return {
      kind: "terminal-protocol",
      id: createPaneSourceId(sourceInput.id),
      readFrame: (): TerminalFrameSnapshot => ({
        size: { cols: 20, rows: 8 },
        lines: ["live frame"],
        revision: 1,
      }),
      writeInput: () => undefined,
      resize: () => undefined,
      dispose: () => undefined,
    };
  },
  readSettings: async () => defaultShellNextSettings(),
  saveSettings: async (settings) => {
    input.savedSettings?.push(settings);
  },
  readKeybindings: async () => defaultShellNextKeybindings(),
  readHeartbeatStatus: async () => "Idle · runtime heartbeat",
  stdout: {
    write: (chunk: string | Uint8Array) => {
      input.output?.push(String(chunk));
      return true;
    },
  },
  stdinIsTty: () => input.tty === true,
  stdoutIsTty: () => input.tty === true,
});

describe("Feature: shell-next product runtime argv", () => {
  test("Scenario: Given shell2 attach flags When parsing argv Then Shell Avatar and default mixed view are normalized separately", () => {
    expect(parseShellNextArgs(["--session=7", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "none",
      shellName: "shell-7",
      avatarNickname: "bangeel",
      sessionExplicit: true,
      avatarExplicit: true,
    });
    expect(parseShellNextArgs(["@bangeel", "--session=shell-8"])).toMatchObject({
      command: "attach",
      view: "none",
      shellName: "shell-8",
      avatarNickname: "bangeel",
    });
  });

  test("Scenario: Given explicit view selection When parsing argv Then shell-next treats view as a product attach selector", () => {
    expect(parseShellNextArgs(["--view=room", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "room",
      shellName: "shell-5",
      avatarNickname: "bangeel",
    });
    expect(parseShellNextArgs(["--view=help", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "help",
    });
    expect(parseShellNextArgs(["--view=status", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "status",
    });
    expect(parseShellNextArgs(["--view=none", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "none",
    });
  });

  test("Scenario: Given tmux-action argv When parsing shell-next Then it becomes an explicit unsupported action", () => {
    expect(parseShellNextArgs(["tmux-action", "--action=chat"])).toEqual({
      command: "unsupported-tmux-action",
      action: "chat",
    });
  });

  test("Scenario: Given legacy positional view commands When parsing shell-next Then parser requires the unified --view grammar", () => {
    expect(() => parseShellNextArgs(["chat", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell-next view commands moved to --view=room",
    );
    expect(() => parseShellNextArgs(["help-panel", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell-next view commands moved to --view=help",
    );
    expect(() => parseShellNextArgs(["top", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell-next view commands moved to --view=status",
    );
    expect(() => parseShellNextArgs(["heartbeat-status", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell-next view commands moved to --view=status",
    );
  });
});

describe("Feature: shell-next product runtime bootstrap", () => {
  test("Scenario: Given non-TTY shell2 attach lacks explicit selectors When running Then shell-next fails before bootstrap", async () => {
    const store = new FakeShellNextStore();
    const dependencies = createTestDependencies({ store, tty: false });

    await expect(runShellNext(["bun", "agenter-shell-next"], dependencies)).rejects.toThrow(
      "shell-next requires --session and --avatar",
    );
    expect(store.terminals).toEqual([]);
  });

  test("Scenario: Given non-TTY shell2 attach has explicit selectors When running Then it bootstraps product resources and prints a summary", async () => {
    const store = new FakeShellNextStore();
    seedAvatar(store, "bangeel");
    const output: string[] = [];
    const dependencies = createTestDependencies({ store, tty: false, output });

    const result = await runShellNext(["bun", "agenter-shell-next", "--session=5", "--avatar=bangeel"], dependencies);

    expect(result.exitCode).toBe(0);
    expect(store.terminals.map((terminal) => terminal.metadata?.resourceKey)).toEqual(["shell-5"]);
    expect(store.rooms.map((room) => room.metadata?.resourceKey)).toEqual(["shell-5"]);
    expect(output.join("")).toContain("shell-next attached");
    expect(output.join("")).toContain("terminal: terminal-1");
  });

  test("Scenario: Given TTY shell2 attach When starting app Then shell-next provides live terminal, Room, approval, and runtime status inputs", async () => {
    const store = new FakeShellNextStore();
    seedAvatar(store, "bangeel");
    const liveSourceCalls: Array<{ id: string; terminalId: string; transportUrl: string }> = [];
    const savedSettings: ShellNextSettings[] = [];
    const dependencies = createTestDependencies({
      store,
      tty: true,
      liveSourceCalls,
      savedSettings,
      startApp: async (input) => {
        input.terminalSourcePolicy?.createInitialSource({
          id: "source-1",
          cwd: "/repo",
          node: testNode,
          onExit: () => undefined,
        });
        expect(input.terminalSourcePolicy?.createSplitSource).toBeUndefined();
        expect(input.terminalSourcePolicy?.describeSplitUnavailable?.()).toBe(
          "Product-bound terminal split is not implemented",
        );
        expect(input.room?.attached?.room.entry.chatId).toBe("room-1");
        expect(input.room?.attached?.terminal.entry.terminalId).toBe("terminal-1");
        expect(input.approvalStore?.getPendingApproval()).toBeNull();
        expect(input.initialStatus?.runtime.label).toBe("Idle");
        expect(input.syncStatusbarWithLayout).toBe(false);
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    const result = await runShellNext(["bun", "agenter-shell-next"], dependencies);

    expect(result.exitCode).toBe(0);
    expect(savedSettings.at(-1)?.startup).toEqual({
      lastShellName: "shell-9",
      lastAvatarNickname: "bangeel",
    });
    expect(liveSourceCalls).toEqual([
      {
        id: "source-1",
        terminalId: "terminal-1",
        transportUrl: "ws://127.0.0.1/pty/terminal-1",
      },
    ]);
    expect(store.getAuthToken()).toBe("superadmin-token");
  });

  test("Scenario: Given single-view attach selection When starting app Then shell-next uses rootPane mode instead of top-layer or dock toggles", async () => {
    const store = new FakeShellNextStore();
    seedAvatar(store, "bangeel");
    const surfaces: Array<{
      rootPane?: { id: string; sourceId?: string; sourceKind: "terminal-protocol" | "opentui-renderable" };
      initialSurfaces?: readonly ("help" | "chat")[];
      showStatusbar?: boolean;
      showTopLayer?: boolean;
    }> = [];
    const dependencies = createTestDependencies({
      store,
      tty: true,
      startApp: async (input) => {
        surfaces.push({
          rootPane: input.rootPane,
          initialSurfaces: input.initialSurfaces,
          showStatusbar: input.showStatusbar,
          showTopLayer: input.showTopLayer,
        });
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    await runShellNext(["bun", "agenter-shell-next", "--view=room"], dependencies);
    await runShellNext(["bun", "agenter-shell-next", "--view=help"], dependencies);
    await runShellNext(["bun", "agenter-shell-next", "--view=status"], dependencies);
    await runShellNext(["bun", "agenter-shell-next", "--view=none"], dependencies);

    expect(surfaces).toEqual([
      {
        rootPane: { id: "pane-1", sourceId: "view-room", sourceKind: "opentui-renderable" },
        initialSurfaces: [],
        showStatusbar: false,
        showTopLayer: false,
      },
      {
        rootPane: { id: "pane-1", sourceId: "view-help", sourceKind: "opentui-renderable" },
        initialSurfaces: [],
        showStatusbar: false,
        showTopLayer: false,
      },
      {
        rootPane: { id: "pane-1", sourceId: "view-status", sourceKind: "opentui-renderable" },
        initialSurfaces: [],
        showStatusbar: false,
        showTopLayer: false,
      },
      {
        rootPane: { id: "pane-1", sourceId: "source-1", sourceKind: "terminal-protocol" },
        initialSurfaces: [],
        showStatusbar: true,
        showTopLayer: false,
      },
    ]);
  });

  test("Scenario: Given attached terminal has no transport URL When creating the product-bound source Then shell-next fails the product source policy", async () => {
    const store = new FakeShellNextStore();
    seedAvatar(store, "bangeel");
    const dependencies = createTestDependencies({
      store,
      tty: true,
      bootstrap: async (bootstrapInput) => {
        const attached = await bootstrapShellNextRoom(bootstrapInput);
        return {
          ...attached,
          terminal: {
            ...attached.terminal,
            entry: {
              ...attached.terminal.entry,
              transportUrl: undefined,
            },
          },
        };
      },
      startApp: async (input) => {
        input.terminalSourcePolicy?.createInitialSource({
          id: "source-1",
          cwd: "/repo",
          node: testNode,
          onExit: () => undefined,
        });
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    await expect(runShellNext(["bun", "agenter-shell-next"], dependencies)).rejects.toThrow(
      "attached terminal missing transportUrl",
    );
  });

  test("Scenario: Given cleanup command When running shell-next Then cleanup ignores tmux sessions and reports product resources", async () => {
    const store = new FakeShellNextStore();
    seedAvatar(store, "bangeel");
    await bootstrapShellNextRoom({
      store,
      workspacePath: process.cwd(),
      shellName: "shell-5",
      avatarNickname: "bangeel",
    });
    const output: string[] = [];
    const dependencies = createTestDependencies({ store, tty: false, output });

    const result = await runShellNext(["bun", "agenter-shell-next", "cleanup", "--session=5"], dependencies);

    expect(result.exitCode).toBe(0);
    expect(output.join("")).toContain("shell-next cleanup dry-run");
    expect(output.join("")).not.toContain("tmuxSessions");
    expect(output.join("")).toContain("shell-5");
  });

  test("Scenario: Given pending terminal approval When using runtime approval store Then approve and deny calls reach TerminalSystem store APIs", async () => {
    const store = new FakeShellNextStore();
    store.terminalApprovalRequests.set("terminal-1", [
      {
        requestId: "approval-1",
        terminalId: "terminal-1",
        participantId: "auth:bangeel",
        status: "pending",
        requestedInput: { mode: "raw", text: "echo ok" },
        createdAt: 1,
        expiresAt: 90_001,
      },
    ]);
    const approvalStore = createShellNextRuntimeApprovalStore({
      store,
      terminalId: "terminal-1",
    });

    expect(approvalStore.getPendingApproval()?.requestId).toBe("approval-1");
    await approvalStore.approve({ terminalId: "terminal-1", requestId: "approval-1", durationMs: 30_000 });
    expect(store.terminalApprovalRequests.get("terminal-1")?.[0]?.status).toBe("approved");
    store.terminalApprovalRequests.set("terminal-1", [
      {
        requestId: "approval-2",
        terminalId: "terminal-1",
        participantId: "auth:bangeel",
        status: "pending",
        requestedInput: { mode: "raw", text: "echo nope" },
        createdAt: 2,
        expiresAt: 90_002,
      },
    ]);
    await approvalStore.deny({ terminalId: "terminal-1", requestId: "approval-2" });
    expect(store.terminalApprovalRequests.get("terminal-1")?.[0]?.status).toBe("denied");
  });
});
