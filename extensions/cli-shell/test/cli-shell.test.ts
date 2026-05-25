import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CLI_SHELL_TMUX_SOCKET_NAME,
  bootstrapCliShell,
  cleanupCliShellResources,
  isCliShellMetadataOnlyArgv,
  parseCliShellArgs,
  runCliShellWithDependencies,
  type CliShellRunDependencies,
  type CliShellTmuxPlan,
} from "../src";
import { FakeCliShellStore } from "./fake-cli-shell-store";

type CliShellRunStore = ReturnType<CliShellRunDependencies["createStore"]>;

const seedAvatar = (store: FakeCliShellStore, nickname: string): void => {
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
  });
};

describe("Feature: cli-shell tmux migration bootstrap", () => {
  test("Scenario: Given cli-shell attach bootstrap When resources are ensured Then a bound TerminalSystem terminal and MessageSystem room are created for the product binding", async () => {
    const store = new FakeCliShellStore();
    seedAvatar(store, "bangeel");
    const attached = await bootstrapCliShell({
      store,
      workspacePath: "/repo",
      avatarNickname: "bangeel",
      shellName: "shell-5",
      createAvatar: true,
    });

    expect(attached.avatar.nickname).toBe("bangeel");
    expect(attached.terminal.entry.terminalId).toBe("shell-5");
    expect(attached.terminal.entry.backend).toBe("ghostty-native");
    expect(attached.terminal.entry.metadata?.productId).toBe("cli-shell");
    expect(attached.terminal.entry.metadata?.resourceKey).toBe("shell-5");
    expect(attached.room.entry.metadata?.productId).toBe("cli-shell");
    expect(attached.room.entry.metadata?.resourceKey).toBe("shell-5");
    expect(attached.binding.productId).toBe("cli-shell");
    expect(attached.binding.resourceKey).toBe("shell-5");
    expect(attached.binding.terminalId).toBe("shell-5");
    expect(attached.binding.roomId).toBe(attached.room.entry.chatId);
    expect(attached.binding.runtimeSessionId).toBe(attached.session.id);
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["shell-5"]);
    expect(store.terminals.map((entry) => entry.backend)).toEqual(["ghostty-native"]);
    expect(store.focusTerminalCalls).toEqual([["shell-5"]]);
  });

  test("Scenario: Given legacy terminal flags When parsing cli-shell argv Then the tmux migration rejects them before backend mutation", () => {
    expect(() => parseCliShellArgs(["--backend=ghostty-native"])).toThrow("unsupported cli-shell flag");
    expect(() => parseCliShellArgs(["--web=4321"])).toThrow("unsupported cli-shell flag");
  });

  test("Scenario: Given Help is launched as a product surface When parsing cli-shell argv Then help-panel is a dedicated command", () => {
    expect(parseCliShellArgs(["help-panel", "--session=5", "--avatar=bangeel"])).toMatchObject({
      command: "help-panel",
      shellName: "shell-5",
      avatarNickname: "bangeel",
    });
  });

  test("Scenario: Given Help is a tmux action value When checking metadata-only argv Then cli-shell does not swallow the product action", () => {
    expect(isCliShellMetadataOnlyArgv(["help"])).toBe(true);
    expect(isCliShellMetadataOnlyArgv(["@bangeel", "--version"])).toBe(true);
    expect(
      isCliShellMetadataOnlyArgv([
        "tmux-action",
        "--action",
        "help",
        "--session=5",
        "--avatar=bangeel",
        "--runtime-session-id=session:/repo:bangeel",
        "--target-pane=%0",
      ]),
    ).toBe(false);
    expect(parseCliShellArgs([
      "tmux-action",
      "--action",
      "help",
      "--session=5",
      "--avatar=bangeel",
      "--runtime-session-id=session:/repo:bangeel",
      "--target-pane=%0",
    ])).toMatchObject({
      command: "tmux-action",
      action: "help",
      shellName: "shell-5",
      avatarNickname: "bangeel",
    });
  });

  test("Scenario: Given active cli-shell runtime sources When inspected Then composed TerminalSystem publication stays out of the product path", () => {
    const runtimeSourceFiles = [
      "argv.ts",
      "bootstrap.ts",
      "managed.ts",
      "heartbeat-status.ts",
      "product.ts",
      "run-cli-shell.ts",
      "shell-assistant-seeds.ts",
      "tmux-host.ts",
      "tui/room-app.ts",
      "tui/room-model.ts",
      "tui/run-cli-shell-room-tui.ts",
    ];
    const forbiddenTokens = [
      "publishGlobalTerminalComposedSurface",
      "ProductTerminalComposedSurfaceState",
      "terminalRuntimeKind",
      "composedShellTerminalId",
      "createGlobalTerminal(",
      "bootstrapGlobalTerminal(",
      "setGlobalTerminalConfig(",
      "focusGlobalTerminals(",
    ];

    for (const fileName of runtimeSourceFiles) {
      const source = readFileSync(join(import.meta.dir, "..", "src", fileName), "utf8");
      for (const token of forbiddenTokens) {
        expect(source).not.toContain(token);
      }
    }
  });

  test("Scenario: Given the active room command starts When inspecting sources Then MessageRoom uses OpenTUI instead of the text console fallback", () => {
    const runSource = readFileSync(join(import.meta.dir, "..", "src", "run-cli-shell.ts"), "utf8");
    const packageSource = readFileSync(join(import.meta.dir, "..", "package.json"), "utf8");

    expect(runSource).toContain("startCliShellRoomTui");
    expect(runSource).not.toContain("startCliShellRoomConsole");
    expect(packageSource).toContain('"@opentui/core"');
  });

  test("Scenario: Given the shell subcommand starts When cli-shell runs in a tty Then the main pane binds the current TerminalSystem terminal instead of spawning workspace bash exec", async () => {
    const store = new FakeCliShellStore();
    seedAvatar(store, "bangeel");
    const shellPaneCalls: Array<{
      terminalId: string;
      roomId: string;
      runtimeSessionId: string;
    }> = [];

    const stdin = process.stdin;
    const stdout = process.stdout;
    const stdinDescriptor = Object.getOwnPropertyDescriptor(stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(stdout, "isTTY");

    Object.defineProperty(stdin, "isTTY", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(stdout, "isTTY", {
      configurable: true,
      value: true,
    });

    try {
      await runCliShellWithDependencies(
        [
          "bun",
          "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts",
          "shell",
          "--session=5",
          "--avatar=bangeel",
        ],
        {
          createClient: () =>
            ({
              close() {},
            }) as ReturnType<typeof import("@agenter/client-sdk").createAgenterClient>,
          createStore: () => store as unknown as CliShellRunStore,
          bootstrap: async () => {
            throw new Error("attach bootstrap should not run for shell subcommand");
          },
          bootstrapRoom: async (input) => await bootstrapCliShell(input),
          startRoomTui: async () => {
            throw new Error("room TUI should not start for shell subcommand");
          },
          startTopLayerTui: async () => {
            throw new Error("top layer TUI should not start for shell subcommand");
          },
          startHelpPanelTui: async () => {
            throw new Error("help panel TUI should not start for shell subcommand");
          },
          startShellPaneTui: async (input) => {
            shellPaneCalls.push({
              terminalId: input.attached.terminal.entry.terminalId,
              roomId: input.attached.room.entry.chatId,
              runtimeSessionId: input.attached.session.id,
            });
          },
          readHeartbeatStatus: async () => "unused",
          buildTmuxPlan: () => {
            throw new Error("tmux host plan should not run for shell subcommand");
          },
          runTmuxHost: async () => {
            throw new Error("tmux host should not run for shell subcommand");
          },
          refreshManagedTmuxStatus: async () => {
            throw new Error("managed refresh should not run for shell subcommand");
          },
        },
      );
    } finally {
      if (stdinDescriptor) {
        Object.defineProperty(stdin, "isTTY", stdinDescriptor);
      } else {
        Object.defineProperty(stdin, "isTTY", {
          configurable: true,
          value: undefined,
        });
      }
      if (stdoutDescriptor) {
        Object.defineProperty(stdout, "isTTY", stdoutDescriptor);
      } else {
        Object.defineProperty(stdout, "isTTY", {
          configurable: true,
          value: undefined,
        });
      }
    }

    const expectedRuntimeSessionId = `session:${process.cwd()}:bangeel`;
    expect(shellPaneCalls).toEqual([
      {
        terminalId: "shell-5",
        roomId: "room-1",
        runtimeSessionId: expectedRuntimeSessionId,
      },
    ]);
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["shell-5"]);
    expect(store.focusTerminalCalls).toEqual([["shell-5"]]);
  });

  test("Scenario: Given the help-panel command starts When cli-shell runs in a tty Then the dedicated Help TUI starts without bootstrapping product resources", async () => {
    const helpPanelCalls: Array<{ shellName: string; avatarNickname: string }> = [];

    const stdin = process.stdin;
    const stdout = process.stdout;
    const stdinDescriptor = Object.getOwnPropertyDescriptor(stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(stdout, "isTTY");

    Object.defineProperty(stdin, "isTTY", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(stdout, "isTTY", {
      configurable: true,
      value: true,
    });

    try {
      await runCliShellWithDependencies(
        [
          "bun",
          "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts",
          "help-panel",
          "--session=5",
          "--avatar=bangeel",
        ],
        {
          createClient: () => {
            throw new Error("client should not be created for help-panel subcommand");
          },
          createStore: () => {
            throw new Error("store should not be created for help-panel subcommand");
          },
          bootstrap: async () => {
            throw new Error("attach bootstrap should not run for help-panel subcommand");
          },
          bootstrapRoom: async () => {
            throw new Error("room bootstrap should not run for help-panel subcommand");
          },
          startRoomTui: async () => {
            throw new Error("room TUI should not start for help-panel subcommand");
          },
          startTopLayerTui: async () => {
            throw new Error("top layer TUI should not start for help-panel subcommand");
          },
          startHelpPanelTui: async (input) => {
            helpPanelCalls.push({
              shellName: input.shellName,
              avatarNickname: input.avatarNickname,
            });
          },
          startShellPaneTui: async () => {
            throw new Error("shell pane TUI should not start for help-panel subcommand");
          },
          readHeartbeatStatus: async () => "unused",
          buildTmuxPlan: () => {
            throw new Error("tmux host plan should not run for help-panel subcommand");
          },
          runTmuxHost: async () => {
            throw new Error("tmux host should not run for help-panel subcommand");
          },
          refreshManagedTmuxStatus: async () => {
            throw new Error("managed refresh should not run for help-panel subcommand");
          },
        },
      );
    } finally {
      if (stdinDescriptor) {
        Object.defineProperty(stdin, "isTTY", stdinDescriptor);
      } else {
        Object.defineProperty(stdin, "isTTY", {
          configurable: true,
          value: undefined,
        });
      }
      if (stdoutDescriptor) {
        Object.defineProperty(stdout, "isTTY", stdoutDescriptor);
      } else {
        Object.defineProperty(stdout, "isTTY", {
          configurable: true,
          value: undefined,
        });
      }
    }

    expect(helpPanelCalls).toEqual([{ shellName: "shell-5", avatarNickname: "bangeel" }]);
  });
});

describe("Feature: cli-shell tmux cleanup", () => {
  test("Scenario: Given cleanup targets one session When confirmed Then tmux session and legacy resources are removed in one report", async () => {
    const store = new FakeCliShellStore();
    store.rooms.push({
      chatId: "room-shell-5",
      kind: "room",
      title: "shell-5",
      owner: "ops",
      participants: [],
      metadata: {
        productId: "cli-shell",
        resourceKey: "shell-5",
        ownerSystem: "message-system",
      },
      createdAt: 1,
      updatedAt: 1,
      roomRevision: "1",
      transcriptRevision: "0",
      focused: true,
      accessRole: "admin",
      accessToken: "tok:room-shell-5",
    });
    const killed: string[] = [];
    const result = await cleanupCliShellResources(store, {
      shellName: "shell-5",
      confirm: true,
      tmux: "tmux-test",
      tmuxExecutor: {
        listSessions: async () => ["shell-5", "shell-6"],
        killSession: async (_tmux, sessionName) => {
          killed.push(sessionName);
        },
      },
    });

    expect(result.deleted.tmuxSessions).toEqual(["shell-5"]);
    expect(killed).toEqual(["shell-5"]);
    expect(result.deleted.rooms).toEqual(["room-shell-5"]);
  });

  test("Scenario: Given cli-shell tmux cleanup When inspecting the public cleanup law Then cleanup uses the product-owned tmux socket", () => {
    const source = readFileSync(join(import.meta.dir, "..", "src", "cleanup.ts"), "utf8");

    expect(CLI_SHELL_TMUX_SOCKET_NAME).toBe("agenter-cli-shell");
    expect(source).toContain("CLI_SHELL_TMUX_SOCKET_NAME");
    expect(source).toContain(`"-L", CLI_SHELL_TMUX_SOCKET_NAME, "list-sessions"`);
    expect(source).toContain(`"-L", CLI_SHELL_TMUX_SOCKET_NAME, "kill-session"`);
  });
});

describe("Feature: cli-shell tmux managed status action", () => {
  test("Scenario: Given managed is off When the user clicks managed in the tmux status bar Then cli-shell commits hosting attention and refreshes product-local tmux state", async () => {
    const store = new FakeCliShellStore();
    seedAvatar(store, "bangeel");
    const refreshed: boolean[] = [];
    const clients: Array<{ close(): void }> = [];

    await runCliShellWithDependencies(
      [
        "bun",
        "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts",
        "tmux-action",
        "--action=managed",
        "--session=5",
        "--avatar=bangeel",
        "--runtime-session-id=session:/repo:bangeel",
        "--workspace-path=/repo",
        "--target-pane=%0",
        "--tmux=tmux-test",
      ],
      {
        createClient: () => {
          const client = { close() {} };
          clients.push(client);
          return client as ReturnType<typeof import("@agenter/client-sdk").createAgenterClient>;
        },
        createStore: () => store as unknown as CliShellRunStore,
        bootstrap: async () => {
          throw new Error("attach bootstrap should not run for tmux managed action");
        },
        bootstrapRoom: async (input) => await bootstrapCliShell(input),
        startRoomTui: async () => {
          throw new Error("room TUI should not start for tmux managed action");
        },
        startTopLayerTui: async () => {
          throw new Error("top layer TUI should not start for tmux managed action");
        },
        startHelpPanelTui: async () => {
          throw new Error("help panel TUI should not start for tmux managed action");
        },
        startShellPaneTui: async () => {
          throw new Error("shell pane TUI should not start for tmux managed action");
        },
        readHeartbeatStatus: async () => "unused",
        buildTmuxPlan: () => ({ sessionName: "unused", tmux: "tmux-test", socketName: "unused", steps: [] }) satisfies CliShellTmuxPlan,
        runTmuxHost: async () => {
          throw new Error("tmux host should not attach for tmux managed action");
        },
        refreshManagedTmuxStatus: async (_input, managed) => {
          refreshed.push(managed);
        },
      },
    );

    expect(clients).toHaveLength(1);
    expect(store.attentionCommits).toHaveLength(1);
    expect(store.attentionCommits[0]?.contextId).toBe("ctx-hosting-shell-5");
    expect(store.attentionCommits[0]?.scores).toEqual({ hosting: 1000 });
    expect(store.attentionCommits[0]?.body).toContain("surfaceId=tmux:shell-5");
    expect(store.attentionCommits[0]?.body).toContain("terminalId=shell-5");
    expect(store.attentionCommits[0]?.body).toContain("roomId=room-1");
    expect(store.attentionCommits[0]?.meta?.surfaceId).toBe("tmux:shell-5");
    expect(store.attentionCommits[0]?.meta?.terminalId).toBe("shell-5");
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["shell-5"]);
    expect(refreshed).toEqual([true]);
  });

  test("Scenario: Given managed is on When the user clicks managed in the tmux status bar Then cli-shell settles hosting attention without touching TerminalSystem", async () => {
    const store = new FakeCliShellStore();
    seedAvatar(store, "bangeel");
    store.attentionQueryItems.push({
      contextId: "ctx-hosting-shell-5",
      context: {
        contextId: "ctx-hosting-shell-5",
        owner: "cli-shell",
        focusState: "focused",
        content: "managed on",
        contentFormat: "text/plain",
        scoreMap: { hosting: 1000 },
        consumedPushCommitIds: [],
        headCommitId: "commit:ctx-hosting-shell-5",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      commit: {
        commitId: "commit:ctx-hosting-shell-5",
        contextId: "ctx-hosting-shell-5",
        ingressType: "commit",
        contextMutation: "apply",
        parentCommitIds: [],
        scores: { hosting: 1000 },
        meta: { author: "cli-shell", source: "test" },
        summary: "managed on",
        change: { type: "clean" },
        createdAt: new Date(0).toISOString(),
      },
    });
    const refreshed: boolean[] = [];

    await runCliShellWithDependencies(
      [
        "bun",
        "/repo/extensions/cli-shell/src/bin/agenter-cli-shell.ts",
        "tmux-action",
        "--action=managed",
        "--session=5",
        "--avatar=bangeel",
        "--runtime-session-id=session:/repo:bangeel",
        "--workspace-path=/repo",
        "--target-pane=%0",
        "--tmux=tmux-test",
      ],
      {
        createClient: () => ({ close() {} }) as ReturnType<typeof import("@agenter/client-sdk").createAgenterClient>,
        createStore: () => store as unknown as CliShellRunStore,
        bootstrap: async () => {
          throw new Error("attach bootstrap should not run for tmux managed action");
        },
        bootstrapRoom: async (input) => await bootstrapCliShell(input),
        startRoomTui: async () => {
          throw new Error("room TUI should not start for tmux managed action");
        },
        startTopLayerTui: async () => {
          throw new Error("top layer TUI should not start for tmux managed action");
        },
        startHelpPanelTui: async () => {
          throw new Error("help panel TUI should not start for tmux managed action");
        },
        startShellPaneTui: async () => {
          throw new Error("shell pane TUI should not start for tmux managed action");
        },
        readHeartbeatStatus: async () => "unused",
        buildTmuxPlan: () => ({ sessionName: "unused", tmux: "tmux-test", socketName: "unused", steps: [] }) satisfies CliShellTmuxPlan,
        runTmuxHost: async () => {
          throw new Error("tmux host should not attach for tmux managed action");
        },
        refreshManagedTmuxStatus: async (_input, managed) => {
          refreshed.push(managed);
        },
      },
    );

    expect(store.attentionSettles).toHaveLength(1);
    expect(store.attentionSettles[0]?.contextId).toBe("ctx-hosting-shell-5");
    expect(store.attentionSettles[0]?.scores).toEqual({ hosting: 0 });
    expect(store.attentionSettles[0]?.reason).toBe("user_disabled");
    expect(store.attentionSettles[0]?.meta?.surfaceId).toBe("tmux:shell-5");
    expect(store.attentionSettles[0]?.meta?.terminalId).toBe("shell-5");
    expect(store.terminals.map((entry) => entry.terminalId)).toEqual(["shell-5"]);
    expect(refreshed).toEqual([false]);
  });
});
