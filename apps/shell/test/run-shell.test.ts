import type { GlobalAvatarCatalogEntry, RuntimeClientState } from "@agenter/client-sdk";
import { describe, expect, test } from "bun:test";

import {
  defaultShellKeybindings,
  defaultShellSettings,
  type ShellSettings,
} from "../src/app-room/settings";
import { bootstrapShellRoom } from "../src/app/bootstrap";

import { createShellRuntimeApprovalStore } from "../src/app/approval-store";
import { parseShellArgs } from "../src/app/argv";
import type { ShellAppRunDependencies } from "../src/app/runtime";
import type { ChildLayoutNode } from "../src/renderable-mux/layout";
import { createPaneSourceId, type PaneSource, type TerminalFrameSnapshot } from "../src/renderable-mux/pane-source";
import { isShellMetadataOnlyArgv, runShell } from "../src/run-shell";
import { FakeShellStore } from "./fake-shell-store";

describe("Feature: shell argv metadata boundary", () => {
  test("Scenario: Given metadata flags When classifying argv Then help and version stay side-effect free", () => {
    expect(isShellMetadataOnlyArgv(["--help"])).toBe(true);
    expect(isShellMetadataOnlyArgv(["renderer-grid-demo", "--help"])).toBe(true);
    expect(isShellMetadataOnlyArgv(["--version"])).toBe(true);
    expect(isShellMetadataOnlyArgv(["version"])).toBe(true);
  });

  test("Scenario: Given metadata words are app values When classifying argv Then they do not swallow the demo command", () => {
    expect(isShellMetadataOnlyArgv(["renderer-grid-demo", "--selection-text", "help"])).toBe(false);
    expect(isShellMetadataOnlyArgv(["renderer-grid-demo", "--selection-text", "version"])).toBe(false);
  });
});

const seedAvatar = (store: FakeShellStore, nickname: string): void => {
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
  store: FakeShellStore;
  tty?: boolean;
  bootstrap?: ShellAppRunDependencies["bootstrapRoom"];
  startApp?: ShellAppRunDependencies["startApp"];
  navigation?: ShellAppRunDependencies["startNavigationTui"];
  savedSettings?: ShellSettings[];
  output?: string[];
  liveSourceCalls?: Array<{ id: string; terminalId: string; transportUrl: string }>;
  readHeartbeatStatus?: ShellAppRunDependencies["readHeartbeatStatus"];
}): ShellAppRunDependencies => ({
  createClient: () => ({ close() {} }) as ReturnType<ShellAppRunDependencies["createClient"]>,
  createStore: () => input.store as unknown as ReturnType<ShellAppRunDependencies["createStore"]>,
  bootstrapRoom: input.bootstrap ?? (async (bootstrapInput) => await bootstrapShellRoom(bootstrapInput)),
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
      writeInput: () => true,
      resize: () => undefined,
      terminate: () => sourceInput.terminateTerminal?.(),
      dispose: () => undefined,
    };
  },
  readSettings: async () => defaultShellSettings(),
  saveSettings: async (settings) => {
    input.savedSettings?.push(settings);
  },
  readKeybindings: async () => defaultShellKeybindings(),
  readHeartbeatStatus: input.readHeartbeatStatus ?? (async () => "Idle · runtime heartbeat"),
  stdout: {
    write: (chunk: string | Uint8Array) => {
      input.output?.push(String(chunk));
      return true;
    },
  },
  stdinIsTty: () => input.tty === true,
  stdoutIsTty: () => input.tty === true,
});

describe("Feature: shell app runtime argv", () => {
  test("Scenario: Given shell attach flags When parsing argv Then Shell Avatar and default mixed view are normalized separately", () => {
    expect(parseShellArgs(["--session=7", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "none",
      shellName: "shell-7",
      avatarNickname: "bangeel",
      sessionExplicit: true,
      avatarExplicit: true,
    });
    expect(parseShellArgs(["@bangeel", "--session=shell-8"])).toMatchObject({
      command: "attach",
      view: "none",
      shellName: "shell-8",
      avatarNickname: "bangeel",
    });
  });

  test("Scenario: Given explicit view selection When parsing argv Then shell treats view as a app attach selector", () => {
    expect(parseShellArgs(["--view=room", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "room",
      shellName: "shell-5",
      avatarNickname: "bangeel",
    });
    expect(parseShellArgs(["--view=help", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "help",
    });
    expect(parseShellArgs(["--view=status", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "status",
    });
    expect(parseShellArgs(["--view=none", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "attach",
      view: "none",
    });
  });

  test("Scenario: Given tmux-action argv When parsing shell Then it becomes an explicit unsupported action", () => {
    expect(parseShellArgs(["tmux-action", "--action=chat"])).toEqual({
      command: "unsupported-tmux-action",
      action: "chat",
    });
  });

  test("Scenario: Given legacy positional view commands When parsing shell Then parser requires the unified --view grammar", () => {
    expect(() => parseShellArgs(["chat", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell view commands moved to --view=room",
    );
    expect(() => parseShellArgs(["help-panel", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell view commands moved to --view=help",
    );
    expect(() => parseShellArgs(["top", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell view commands moved to --view=status",
    );
    expect(() => parseShellArgs(["heartbeat-status", "--session=5", "--avatar=bangeel"])).toThrow(
      "shell view commands moved to --view=status",
    );
  });
});

describe("Feature: shell app runtime bootstrap", () => {
  test("Scenario: Given non-TTY shell attach lacks explicit selectors When running Then shell fails before bootstrap", async () => {
    const store = new FakeShellStore();
    const dependencies = createTestDependencies({ store, tty: false });

    await expect(runShell(["bun", "agenter-shell"], dependencies)).rejects.toThrow(
      "shell requires --session and --avatar",
    );
    expect(store.terminals).toEqual([]);
  });

  test("Scenario: Given non-TTY shell attach has explicit selectors When running Then it bootstraps app resources and prints a summary", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    const output: string[] = [];
    const dependencies = createTestDependencies({ store, tty: false, output });

    const result = await runShell(["bun", "agenter-shell", "--session=5", "--avatar=bangeel"], dependencies);

    expect(result.exitCode).toBe(0);
    expect(store.terminals.map((terminal) => terminal.metadata?.resourceKey)).toEqual(["shell-5"]);
    expect(store.rooms.map((room) => room.metadata?.resourceKey)).toEqual(["shell-5"]);
    expect(output.join("")).toContain("shell attached");
    expect(output.join("")).toContain("terminal: terminal-1");
  });

  test("Scenario: Given TTY shell attach When starting app Then shell provides live terminal, Room, approval, and runtime status inputs", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    const liveSourceCalls: Array<{ id: string; terminalId: string; transportUrl: string }> = [];
    const savedSettings: ShellSettings[] = [];
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
          "App-bound terminal split is not implemented",
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

    const result = await runShell(["bun", "agenter-shell"], dependencies);

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

  test("Scenario: Given background-run exits app attach When reconnecting Then shell reuses the still-live terminal binding", async () => {
    class RecordingDisconnectStore extends FakeShellStore {
      createTerminalCalls = 0;
      disconnectCalls = 0;

      async createGlobalTerminal(input: Parameters<FakeShellStore["createGlobalTerminal"]>[0]) {
        this.createTerminalCalls += 1;
        return await super.createGlobalTerminal(input);
      }

      disconnect(): void {
        this.disconnectCalls += 1;
        super.disconnect();
      }
    }

    const store = new RecordingDisconnectStore();
    seedAvatar(store, "bangeel");
    const firstDependencies = createTestDependencies({
      store,
      tty: true,
      startApp: async (input) => {
        const source = input.terminalSourcePolicy?.createInitialSource({
          id: "source-1",
          cwd: "/repo",
          node: testNode,
          onExit: () => undefined,
        });
        if (source?.kind === "terminal-protocol") {
          await source.dispose();
        }
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    await runShell(["bun", "agenter-shell", "--session=5", "--avatar=bangeel"], firstDependencies);

    expect(store.disconnectCalls).toBe(1);
    expect(store.connected).toBe(false);
    expect(store.createTerminalCalls).toBe(1);
    expect(store.stoppedTerminalIds).toEqual([]);
    expect(store.terminals.map((terminal) => terminal.metadata?.resourceKey)).toEqual(["shell-5"]);

    const output: string[] = [];
    const secondDependencies = createTestDependencies({ store, tty: false, output });

    await runShell(["bun", "agenter-shell", "--session=5", "--avatar=bangeel"], secondDependencies);

    expect(store.createTerminalCalls).toBe(1);
    expect(output.join("")).toContain("terminal: terminal-1 (reused)");
  });

  test("Scenario: Given shell bootstraps a app terminal When TerminalSystem creates the binding Then git-backed history is requested", async () => {
    class RecordingCreateStore extends FakeShellStore {
      createTerminalInputs: Array<Parameters<FakeShellStore["createGlobalTerminal"]>[0]> = [];

      async createGlobalTerminal(input: Parameters<FakeShellStore["createGlobalTerminal"]>[0]) {
        this.createTerminalInputs.push(input);
        return await super.createGlobalTerminal(input);
      }
    }

    const store = new RecordingCreateStore();
    seedAvatar(store, "bangeel");

    await bootstrapShellRoom({
      store,
      workspacePath: process.cwd(),
      shellName: "shell-history",
      avatarNickname: "bangeel",
    });

    expect(store.createTerminalInputs).toHaveLength(1);
    expect(store.createTerminalInputs[0]?.profile?.gitLog).toBe("normal");
  });

  test("Scenario: Given app attach exits by terminate When the bound terminal is killed Then shell archives the bound room through public APIs", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    const dependencies = createTestDependencies({
      store,
      tty: true,
      startApp: async (input) => {
        const source = input.terminalSourcePolicy?.createInitialSource({
          id: "source-1",
          cwd: "/repo",
          node: testNode,
          onExit: () => undefined,
        });
        if (source?.kind === "terminal-protocol") {
          await source.terminate?.();
        }
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    await runShell(["bun", "agenter-shell", "--session=5", "--avatar=bangeel"], dependencies);

    expect(store.stoppedTerminalIds).toEqual(["terminal-1"]);
    expect(store.archivedRoomIds).toEqual(["room-1"]);
    expect(store.terminals).toHaveLength(0);
    expect(store.terminalHistory.map((terminal) => terminal.terminalId)).toEqual(["terminal-1"]);
    expect(store.rooms.find((room) => room.chatId === "room-1")?.archivedAt).toEqual(expect.any(Number));
  });

  test("Scenario: Given shell binds terminal A to room R When unrelated terminal B is killed Then room R is not archived", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    const dependencies = createTestDependencies({
      store,
      tty: true,
      startApp: async () => {
        await store.createGlobalTerminal({
          terminalId: "terminal-b",
          start: true,
        });
        await store.stopGlobalTerminal({ terminalId: "terminal-b" });
        await Bun.sleep(0);
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    await runShell(["bun", "agenter-shell", "--session=5", "--avatar=bangeel"], dependencies);

    expect(store.stoppedTerminalIds).toEqual(["terminal-b"]);
    expect(store.archivedRoomIds).toEqual([]);
    expect(store.rooms.find((room) => room.chatId === "room-1")?.archivedAt).toBeUndefined();
  });

  test("Scenario: Given heartbeat has preview text and model calls have usage When starting app Then statusbar receives macro facts only", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    const dependencies = createTestDependencies({
      store,
      tty: true,
      readHeartbeatStatus: async () => "✎ generating a detailed heartbeat preview",
      bootstrap: async (bootstrapInput) => {
        const attached = await bootstrapShellRoom(bootstrapInput);
        store.modelCallsBySession[attached.session.id] = [
          {
            id: 1,
            cycleId: 1,
            roundIndex: 0,
            kind: "model",
            status: "done",
            provider: "openai",
            model: "gpt-test",
            providerSnapshot: {
              providerId: "openai-test",
              apiStandard: "openai-responses",
              vendor: "openai",
              profile: null,
              model: "gpt-test",
              maxContextTokens: 100000,
            },
            requestUrl: "https://example.invalid/model",
            request: {},
            response: { usage: { inputTokens: 700, totalTokens: 900 } },
            error: null,
            outcome: null,
            createdAt: 1,
            updatedAt: 2,
            completedAt: 2,
            isComplete: true,
          } satisfies RuntimeClientState["modelCallsBySession"][string][number],
        ];
        return attached;
      },
      startApp: async (input) => {
        expect(input.initialStatus?.runtime.label).toBe("Active");
        expect(input.initialStatus?.runtime.label).not.toContain("heartbeat preview");
        expect(input.initialStatus?.aiContext).toEqual({ usedTokens: 700, maxTokens: 100000 });
        return {
          finished: Promise.resolve(),
          destroy() {},
        };
      },
    });

    const result = await runShell(["bun", "agenter-shell"], dependencies);

    expect(result.exitCode).toBe(0);
  });

  test("Scenario: Given single-view attach selection When starting app Then shell uses rootPane mode instead of top-layer or dock toggles", async () => {
    const store = new FakeShellStore();
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

    await runShell(["bun", "agenter-shell", "--view=room"], dependencies);
    await runShell(["bun", "agenter-shell", "--view=help"], dependencies);
    await runShell(["bun", "agenter-shell", "--view=status"], dependencies);
    await runShell(["bun", "agenter-shell", "--view=none"], dependencies);

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

  test("Scenario: Given attached terminal has no transport URL When creating the app-bound source Then shell fails the app source policy", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    const dependencies = createTestDependencies({
      store,
      tty: true,
      bootstrap: async (bootstrapInput) => {
        const attached = await bootstrapShellRoom(bootstrapInput);
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

    await expect(runShell(["bun", "agenter-shell"], dependencies)).rejects.toThrow(
      "attached terminal missing transportUrl",
    );
  });

  test("Scenario: Given cleanup command When running shell Then cleanup ignores tmux sessions and reports app resources", async () => {
    const store = new FakeShellStore();
    seedAvatar(store, "bangeel");
    await bootstrapShellRoom({
      store,
      workspacePath: process.cwd(),
      shellName: "shell-5",
      avatarNickname: "bangeel",
    });
    const output: string[] = [];
    const dependencies = createTestDependencies({ store, tty: false, output });

    const result = await runShell(["bun", "agenter-shell", "cleanup", "--session=5"], dependencies);

    expect(result.exitCode).toBe(0);
    expect(output.join("")).toContain("shell cleanup dry-run");
    expect(output.join("")).not.toContain("tmuxSessions");
    expect(output.join("")).toContain("shell-5");
  });

  test("Scenario: Given pending terminal approval When using runtime approval store Then approve and deny calls reach TerminalSystem store APIs", async () => {
    const store = new FakeShellStore();
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
    const approvalStore = createShellRuntimeApprovalStore({
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
