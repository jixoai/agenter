import { describe, expect, mock, test } from "bun:test";

import type { AgenterClient, GlobalAvatarCatalogEntry, GlobalRoomEntry, GlobalTerminalEntry, SessionEntry } from "@agenter/client-sdk";
import type { CliShellBootstrapResult } from "../src/bootstrap";
import { CLI_SHELL_HEARTBEAT_COPY } from "../src/tui/heartbeat";
import { runCliShellWithDependencies, type CliShellRunDependencies } from "../src/run-cli-shell";

const createSession = (): SessionEntry => ({
  id: "session-1",
  name: "shell-assistant",
  cwd: "/repo",
  workspacePath: "/repo",
  avatar: "shell-assistant",
  avatarPrincipalId: "auth:shell-assistant",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  status: "running",
  storageState: "active",
  sessionRoot: "/tmp/session-1",
  storeTarget: "global",
});

const createTerminalEntry = (
  terminalId: string,
  input: {
    processKind?: "shell" | "product";
    metadata?: Record<string, unknown>;
  } = {},
): GlobalTerminalEntry => ({
  terminalId,
  processKind: input.processKind ?? "shell",
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
    cols: 120,
    rows: 24,
    lines: [],
    richLines: [],
    cursor: { x: 0, y: 0, visible: true },
    scrollback: {
      viewportOffset: 0,
      totalLines: 0,
      screenLines: 24,
    },
  },
  focused: true,
  icon: undefined,
  configuredTitle: terminalId,
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
  transportUrl: `ws://127.0.0.1/pty/${terminalId}`,
  currentAdminId: null,
  approvalTimeoutMs: 90_000,
  pendingRequestCount: 0,
  access: {
    role: "admin",
    accessToken: `tok:${terminalId}`,
    participantId: "system:trusted-terminal-bootstrap",
    currentAdmin: true,
  },
  actors: [],
  metadata: input.metadata ?? {},
});

const createRoomEntry = (chatId: string): GlobalRoomEntry => ({
  chatId,
  kind: "room",
  title: "shell-1",
  owner: "ops",
  participants: [{ id: "auth:user", label: "User" }],
  metadata: {
    productId: "cli-shell",
    resourceKey: "shell-1",
    ownerSystem: "message-system",
  },
  createdAt: 1,
  updatedAt: 1,
  focused: true,
  accessRole: "admin",
  accessToken: `tok:${chatId}`,
});

const createAttachedResult = (avatar: GlobalAvatarCatalogEntry): CliShellBootstrapResult => ({
  avatar,
  session: createSession(),
  avatarActorId: "auth:shell-assistant",
  shellTruthTerminal: {
    entry: createTerminalEntry("shell-1:terminal-1"),
    created: true,
    granted: true,
    focused: true,
    bindingMetadata: {
      productId: "cli-shell",
      resourceKey: "shell-1:terminal-1",
      ownerSystem: "terminal-system",
    },
  },
  visibleTerminal: {
    entry: createTerminalEntry("shell-1:terminal-2", {
      processKind: "product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
    }),
    created: true,
    granted: true,
    focused: true,
    bindingMetadata: {
      productId: "cli-shell",
      resourceKey: "shell-1:terminal-2",
      ownerSystem: "terminal-system",
    },
  },
  room: {
    entry: createRoomEntry("room-shell-1"),
    created: true,
    granted: true,
    focused: true,
    bindingMetadata: {
      productId: "cli-shell",
      resourceKey: "shell-1",
      ownerSystem: "message-system",
    },
  },
  promptSeeded: false,
  memoryFiles: [],
  managed: {
    managed: false,
    hostingActive: false,
    activeDelegation: null,
    contextId: "ctx-hosting-shell-1",
    hostingMatches: [],
  },
});

describe("Feature: cli-shell startup sequencing", () => {
  test("Scenario: Given interactive cli-shell startup When bootstrap is still in flight Then the startup shell appears before bootstrap resolves and advances to observation-pending before the attached TUI takes over", async () => {
    const avatar = {
      avatarPrincipalId: "auth:shell-assistant",
      runtimeId: "runtime:shell-assistant",
      nickname: "shell-assistant",
      displayName: "Shell Assistant",
      classify: "assistant",
      iconUrl: null,
      defaultAvatar: false,
      sourceScope: "global",
      globalAvailable: true,
      workspacePrivateSlotReady: false,
      globalPath: "/global/shell-assistant",
      workspacePrivatePath: "/workspace/.agenter/avatars/by-principal/shell-assistant",
      effectivePath: "/global/shell-assistant",
    } satisfies GlobalAvatarCatalogEntry;
    const bootstrapController: {
      resolve: ((value: CliShellBootstrapResult) => void) | null;
    } = {
      resolve: null,
    };
    const bootstrap = new Promise<CliShellBootstrapResult>((resolve) => {
      bootstrapController.resolve = resolve;
    });
    const startupHeartbeats: string[] = [];
    const startupDestroyed = mock(() => {});
    const runtimeDestroyed = mock(() => {});
    const clientClose = mock(() => {});
    const startRuntimeTui = mock(async () => ({
      finished: Promise.resolve(),
      destroy: runtimeDestroyed,
    }));
    const client = {
      trpc: {} as AgenterClient["trpc"],
      wsUrl: "ws://127.0.0.1:13000/trpc",
      httpUrl: "http://127.0.0.1:13000",
      setAuthToken: mock(() => {}),
      getAuthToken: mock(() => null),
      subscribeTransport: mock(() => () => {}),
      close: clientClose,
    } satisfies AgenterClient;
    const dependencies: CliShellRunDependencies = {
      createClient: () => client,
      createStore: () =>
        ({
          connect: async () => {},
          disconnect: () => {},
          hydrateSessionArtifacts: async () => undefined,
          getState: () => ({
            runtimes: {
              "session-1": {
                schedulerSignals: {
                  terminal: {
                    version: 1,
                    timestamp: Date.parse("2026-05-10T10:00:00+08:00"),
                  },
                },
              },
            },
          }),
        }) as unknown as ReturnType<CliShellRunDependencies["createStore"]>,
      bootstrap: async (input) => {
        input.onProgress?.("authenticating");
        input.onProgress?.("observation-pending");
        return await bootstrap;
      },
      loadStartupTui: async () => ({
        startCliShellStartupTui: async (input) => ({
          finished: Promise.resolve(),
          destroy: startupDestroyed,
          setHeartbeat: (heartbeat) => {
            startupHeartbeats.push(heartbeat);
          },
        }),
      }),
      loadCliShellTui: async () => ({
        startCliShellTui: startRuntimeTui,
      }),
      loadCliShellWebHost: async () => ({
        startCliShellWebHost: async () => ({
          url: "http://127.0.0.1:0/",
          finished: Promise.resolve(),
          stop: async () => {},
        }),
      }),
      isInteractive: () => true,
    };

    const runPromise = runCliShellWithDependencies(["node", "agenter-cli-shell"], dependencies);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(startupHeartbeats).toEqual([CLI_SHELL_HEARTBEAT_COPY.observationPending]);

    if (!bootstrapController.resolve) {
      throw new Error("bootstrap resolver not captured");
    }
    const finishBootstrap = bootstrapController.resolve;
    finishBootstrap(createAttachedResult(avatar));

    await runPromise;

    expect(startupDestroyed).toHaveBeenCalledTimes(1);
    expect(startRuntimeTui).toHaveBeenCalledTimes(1);
    expect(runtimeDestroyed).toHaveBeenCalledTimes(1);
    expect(clientClose).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given cli-shell web host mode When startup runs Then bootstrap stays shared while native startup TUI is skipped and the browser host becomes the active product host", async () => {
    const avatar = {
      avatarPrincipalId: "auth:shell-assistant",
      runtimeId: "runtime:shell-assistant",
      nickname: "shell-assistant",
      displayName: "Shell Assistant",
      classify: "assistant",
      iconUrl: null,
      defaultAvatar: false,
      sourceScope: "global",
      globalAvailable: true,
      workspacePrivateSlotReady: false,
      globalPath: "/global/shell-assistant",
      workspacePrivatePath: "/workspace/.agenter/avatars/by-principal/shell-assistant",
      effectivePath: "/global/shell-assistant",
    } satisfies GlobalAvatarCatalogEntry;
    const clientClose = mock(() => {});
    const startStartupTui = mock(async () => ({
      finished: Promise.resolve(),
      destroy: mock(() => {}),
      setHeartbeat: mock(() => {}),
    }));
    const startRuntimeTui = mock(async () => ({
      finished: Promise.resolve(),
      destroy: mock(() => {}),
    }));
    const stopWebHost = mock(async () => {});
    type WebHostInput = Parameters<
      Awaited<ReturnType<CliShellRunDependencies["loadCliShellWebHost"]>>["startCliShellWebHost"]
    >[0];
    const webHostInputs: WebHostInput[] = [];
    const startCliShellWebHost: Awaited<
      ReturnType<CliShellRunDependencies["loadCliShellWebHost"]>
    >["startCliShellWebHost"] = async (input) => {
      webHostInputs.push(input);
      return {
        url: "http://127.0.0.1:3210/",
        finished: Promise.resolve(),
        stop: stopWebHost,
      };
    };

    await runCliShellWithDependencies(["node", "agenter-cli-shell", "--web=3210", "--experimental-dynamic-refresh"], {
      createClient: () =>
        ({
          trpc: {} as AgenterClient["trpc"],
          wsUrl: "ws://127.0.0.1:13000/trpc",
          httpUrl: "http://127.0.0.1:13000",
          setAuthToken: mock(() => {}),
          getAuthToken: mock(() => null),
          subscribeTransport: mock(() => () => {}),
          close: clientClose,
        }) satisfies AgenterClient,
      createStore: () =>
        ({
          hydrateGlobalTerminals: async () => [],
        }) as unknown as ReturnType<CliShellRunDependencies["createStore"]>,
      bootstrap: async () => createAttachedResult(avatar),
      loadStartupTui: async () => ({
        startCliShellStartupTui: startStartupTui,
      }),
      loadCliShellTui: async () => ({
        startCliShellTui: startRuntimeTui,
      }),
      loadCliShellWebHost: async () => ({
        startCliShellWebHost,
      }),
      isInteractive: () => true,
    } satisfies CliShellRunDependencies);

    expect(startStartupTui).not.toHaveBeenCalled();
    expect(startRuntimeTui).not.toHaveBeenCalled();
    expect(webHostInputs).toHaveLength(1);
    expect(webHostInputs[0]).toMatchObject({
      experimentalDynamicRefresh: true,
    });
    expect(stopWebHost).toHaveBeenCalledTimes(1);
    expect(clientClose).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given cli-shell debug and experimental dynamic refresh flags When native startup takes over Then runtime TUI receives both flags explicitly", async () => {
    const avatar = {
      avatarPrincipalId: "auth:shell-assistant",
      runtimeId: "runtime:shell-assistant",
      nickname: "shell-assistant",
      displayName: "Shell Assistant",
      classify: "assistant",
      iconUrl: null,
      defaultAvatar: false,
      sourceScope: "global",
      globalAvailable: true,
      workspacePrivateSlotReady: false,
      globalPath: "/global/shell-assistant",
      workspacePrivatePath: "/workspace/.agenter/avatars/by-principal/shell-assistant",
      effectivePath: "/global/shell-assistant",
    } satisfies GlobalAvatarCatalogEntry;
    type RuntimeTuiInput = Parameters<
      Awaited<ReturnType<CliShellRunDependencies["loadCliShellTui"]>>["startCliShellTui"]
    >[0];
    const runtimeTuiInputs: RuntimeTuiInput[] = [];
    const startRuntimeTui: Awaited<ReturnType<CliShellRunDependencies["loadCliShellTui"]>>["startCliShellTui"] = async (
      input,
    ) => {
      runtimeTuiInputs.push(input);
      return {
        finished: Promise.resolve(),
        destroy: mock(() => {}),
      };
    };
    const clientClose = mock(() => {});

    await runCliShellWithDependencies(["node", "agenter-cli-shell", "--debug", "--experimental-dynamic-refresh"], {
      createClient: () =>
        ({
          trpc: {} as AgenterClient["trpc"],
          wsUrl: "ws://127.0.0.1:13000/trpc",
          httpUrl: "http://127.0.0.1:13000",
          setAuthToken: mock(() => {}),
          getAuthToken: mock(() => null),
          subscribeTransport: mock(() => () => {}),
          close: clientClose,
        }) satisfies AgenterClient,
      createStore: () =>
        ({
          connect: async () => {},
          disconnect: () => {},
          hydrateSessionArtifacts: async () => undefined,
          getState: () => ({
            runtimes: {
              "session-1": {
                schedulerSignals: {
                  terminal: {
                    version: 1,
                    timestamp: Date.parse("2026-05-10T10:00:00+08:00"),
                  },
                },
              },
            },
          }),
        }) as unknown as ReturnType<CliShellRunDependencies["createStore"]>,
      bootstrap: async () => createAttachedResult(avatar),
      loadStartupTui: async () => ({
        startCliShellStartupTui: async () => ({
          finished: Promise.resolve(),
          destroy: mock(() => {}),
          setHeartbeat: mock(() => {}),
        }),
      }),
      loadCliShellTui: async () => ({
        startCliShellTui: startRuntimeTui,
      }),
      loadCliShellWebHost: async () => ({
        startCliShellWebHost: async () => ({
          url: "http://127.0.0.1:0/",
          finished: Promise.resolve(),
          stop: async () => {},
        }),
      }),
      isInteractive: () => true,
    } satisfies CliShellRunDependencies);

    expect(runtimeTuiInputs).toHaveLength(1);
    expect(runtimeTuiInputs[0]).toMatchObject({
      debug: true,
      experimentalDynamicRefresh: true,
      preconnected: true,
      shellName: "shell-1",
    });
    expect(clientClose).toHaveBeenCalledTimes(1);
  });
});
