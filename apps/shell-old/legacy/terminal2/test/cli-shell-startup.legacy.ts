import { describe, expect, mock, test } from "bun:test";

import type {
  AgenterClient,
  GlobalAvatarCatalogEntry,
  GlobalRoomEntry,
  GlobalTerminalEntry,
  SessionEntry,
} from "@agenter/client-sdk";
import type { CliShellBootstrapResult } from "../src/bootstrap";
import { runCliShellWithDependencies, type CliShellRunDependencies } from "../src/run-cli-shell";
import { CLI_SHELL_HEARTBEAT_COPY } from "../src/tui/heartbeat";

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
    processKind?: "shell" | "app";
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
    appId: "cli-shell",
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
  avatarCreated: false,
  session: createSession(),
  clearedRuntimeSessionIds: [],
  avatarActorId: "auth:shell-assistant",
  shellTruthTerminal: {
    entry: createTerminalEntry("shell-1:terminal-1"),
    created: true,
    granted: true,
    focused: true,
    bindingMetadata: {
      appId: "cli-shell",
      resourceKey: "shell-1:terminal-1",
      ownerSystem: "terminal-system",
    },
  },
  visibleTerminal: {
    entry: createTerminalEntry("shell-1:terminal-2", {
      processKind: "app",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
    }),
    created: true,
    granted: true,
    focused: true,
    bindingMetadata: {
      appId: "cli-shell",
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
      appId: "cli-shell",
      resourceKey: "shell-1",
      ownerSystem: "message-system",
    },
  },
  promptSeeded: false,
  memoryFiles: [],
  managed: {
    managed: false,
    hostingActive: false,
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

  test("Scenario: Given cli-shell web host mode When startup runs Then bootstrap stays shared while native startup TUI is skipped and the browser host becomes the active app host", async () => {
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

  test("Scenario: Given cleanup mode When startup runs Then cli-shell performs resource cleanup without bootstrapping a shell", async () => {
    const bootstrap = mock(async () =>
      createAttachedResult({
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
      }),
    );
    const clientClose = mock(() => {});
    const deleteGlobalTerminal = mock(async () => ({ ok: true, message: "terminal deleted" }));
    const deleteGlobalRoom = mock(async (input: { chatId: string }) => createRoomEntry(input.chatId));
    const deleteSession = mock(async () => {});
    const writes: string[] = [];
    const write = mock((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    const previousWrite = process.stdout.write;
    process.stdout.write = write as unknown as typeof process.stdout.write;
    try {
      await runCliShellWithDependencies(["node", "agenter-cli-shell", "cleanup", "--confirm"], {
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
            autoLogin: async () => ({ ok: true, session: { token: "superadmin-token" } }),
            setAuthToken: mock(() => {}),
            listSessions: async () => [
              {
                ...createSession(),
              },
            ],
            listGlobalTerminals: async () => [
              createTerminalEntry("shell-1:terminal-1", {
                metadata: {
                  appId: "cli-shell",
                  resourceKey: "shell-1:terminal-1",
                  ownerSystem: "terminal-system",
                },
              }),
              createTerminalEntry("ordinary-terminal"),
            ],
            listGlobalRooms: async () => [
              {
                ...createRoomEntry("room-shell-1"),
                metadata: {
                  appId: "cli-shell",
                  resourceKey: "shell-1",
                  ownerSystem: "message-system",
                },
              },
            ],
            deleteGlobalTerminal,
            deleteGlobalRoom,
            deleteSession,
          }) as unknown as ReturnType<CliShellRunDependencies["createStore"]>,
        bootstrap,
        loadStartupTui: async () => ({
          startCliShellStartupTui: async () => ({
            finished: Promise.resolve(),
            destroy: mock(() => {}),
            setHeartbeat: mock(() => {}),
          }),
        }),
        loadCliShellTui: async () => ({
          startCliShellTui: async () => ({
            finished: Promise.resolve(),
            destroy: mock(() => {}),
          }),
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
    } finally {
      process.stdout.write = previousWrite;
    }

    expect(bootstrap).not.toHaveBeenCalled();
    expect(deleteGlobalTerminal).toHaveBeenCalledWith({ terminalId: "shell-1:terminal-1" });
    expect(deleteGlobalRoom).toHaveBeenCalledWith({ chatId: "room-shell-1" });
    expect(deleteSession).toHaveBeenCalledWith("session-1");
    expect(writes.join("")).toContain("cli-shell cleanup executed");
    expect(clientClose).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given room-only mode When startup runs interactively Then cli-shell starts the MessageRoom TUI without starting the terminal TUI", async () => {
    const avatar = {
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
      workspacePrivatePath: "/workspace/.agenter/avatars/by-principal/bangeel",
      effectivePath: "/global/bangeel",
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
    const roomDestroyed = mock(() => {});
    type RoomTuiLoader = NonNullable<CliShellRunDependencies["loadCliShellRoomTui"]>;
    type RoomBootstrap = NonNullable<CliShellRunDependencies["bootstrapRoom"]>;
    type RoomTuiInput = Parameters<Awaited<ReturnType<RoomTuiLoader>>["startCliShellRoomTui"]>[0];
    const roomTuiInputs: RoomTuiInput[] = [];
    const bootstrapRoomInputs: Parameters<RoomBootstrap>[0][] = [];
    const startRoomTui: Awaited<ReturnType<RoomTuiLoader>>["startCliShellRoomTui"] = async (input) => {
      roomTuiInputs.push(input);
      return {
        finished: Promise.resolve(),
        destroy: roomDestroyed,
      };
    };

    await runCliShellWithDependencies(
      ["node", "agenter-cli-shell", "room", "--session=5", "--avatar=bangeel", "--create-avatar", "--clear-avatar"],
      {
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
            getState: () => ({}) as ReturnType<ReturnType<CliShellRunDependencies["createStore"]>["getState"]>,
            hydrateGlobalRoomSnapshot: async () => null,
            retainGlobalRoomSnapshot: () => () => {},
          }) as unknown as ReturnType<CliShellRunDependencies["createStore"]>,
        bootstrap: async () => createAttachedResult(avatar),
        bootstrapRoom: async (input) => {
          bootstrapRoomInputs.push(input);
          const attached = createAttachedResult(avatar);
          return {
            avatar: attached.avatar,
            avatarCreated: true,
            session: attached.session,
            clearedRuntimeSessionIds: ["session:/repo:bangeel"],
            avatarActorId: attached.avatarActorId,
            room: attached.room,
            promptSeeded: false,
            memoryFiles: [],
            managed: attached.managed,
          };
        },
        loadStartupTui: async () => ({
          startCliShellStartupTui: startStartupTui,
        }),
        loadCliShellRoomTui: async () => ({
          startCliShellRoomTui: startRoomTui,
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
      } satisfies CliShellRunDependencies,
    );

    expect(bootstrapRoomInputs).toHaveLength(1);
    expect(bootstrapRoomInputs[0]).toMatchObject({
      avatarNickname: "bangeel",
      shellName: "shell-5",
      createAvatar: true,
      clearAvatar: true,
    });
    expect(startStartupTui).not.toHaveBeenCalled();
    expect(startRuntimeTui).not.toHaveBeenCalled();
    expect(roomTuiInputs).toHaveLength(1);
    expect(roomTuiInputs[0]).toMatchObject({
      shellName: "shell-5",
      debug: false,
    });
    expect(roomDestroyed).toHaveBeenCalledTimes(1);
    expect(clientClose).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given cli-shell debug startup When native startup takes over Then runtime TUI receives app dynamic refresh by default", async () => {
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

    await runCliShellWithDependencies(["node", "agenter-cli-shell", "--debug"], {
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

  test("Scenario: Given cli-shell disables dynamic refresh When native startup takes over Then runtime TUI receives explicit fixed pacing", async () => {
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

    await runCliShellWithDependencies(["node", "agenter-cli-shell", "--experimental-dynamic-refresh=false"], {
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
      experimentalDynamicRefresh: false,
      preconnected: true,
      shellName: "shell-1",
    });
    expect(clientClose).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given non-interactive Avatar startup flags When cli-shell attaches Then bootstrap receives ordinary Avatar controls and stdout reports create and clear state", async () => {
    const avatar = {
      avatarPrincipalId: "auth:review-4",
      runtimeId: "runtime:review-4",
      nickname: "review-4",
      displayName: "review-4",
      classify: null,
      iconUrl: null,
      defaultAvatar: false,
      sourceScope: "global",
      globalAvailable: true,
      workspacePrivateSlotReady: false,
      globalPath: "/global/review-4",
      workspacePrivatePath: "/workspace/.agenter/avatars/by-principal/review-4",
      effectivePath: "/global/review-4",
    } satisfies GlobalAvatarCatalogEntry;
    const bootstrapInputs: Parameters<CliShellRunDependencies["bootstrap"]>[0][] = [];
    const writes: string[] = [];
    const previousLog = console.log;
    console.log = (message?: unknown, ...optionalParams: unknown[]) => {
      writes.push([message, ...optionalParams].map(String).join(" "));
    };
    try {
      await runCliShellWithDependencies(
        ["node", "agenter-cli-shell", "--avatar=review-4", "--session=4", "--create-avatar", "--clear-avatar"],
        {
          createClient: () =>
            ({
              trpc: {} as AgenterClient["trpc"],
              wsUrl: "ws://127.0.0.1:13000/trpc",
              httpUrl: "http://127.0.0.1:13000",
              setAuthToken: mock(() => {}),
              getAuthToken: mock(() => null),
              subscribeTransport: mock(() => () => {}),
              close: mock(() => {}),
            }) satisfies AgenterClient,
          createStore: () =>
            ({
              hydrateGlobalTerminals: async () => [],
            }) as unknown as ReturnType<CliShellRunDependencies["createStore"]>,
          bootstrap: async (input) => {
            bootstrapInputs.push(input);
            return {
              ...createAttachedResult(avatar),
              avatarCreated: true,
              clearedRuntimeSessionIds: ["session:/repo:review-4"],
            };
          },
          loadStartupTui: async () => ({
            startCliShellStartupTui: async () => ({
              finished: Promise.resolve(),
              destroy: mock(() => {}),
              setHeartbeat: mock(() => {}),
            }),
          }),
          loadCliShellTui: async () => ({
            startCliShellTui: async () => ({
              finished: Promise.resolve(),
              destroy: mock(() => {}),
            }),
          }),
          loadCliShellWebHost: async () => ({
            startCliShellWebHost: async () => ({
              url: "http://127.0.0.1:0/",
              finished: Promise.resolve(),
              stop: async () => {},
            }),
          }),
          isInteractive: () => false,
        } satisfies CliShellRunDependencies,
      );
    } finally {
      console.log = previousLog;
    }

    expect(bootstrapInputs).toHaveLength(1);
    expect(bootstrapInputs[0]).toMatchObject({
      avatarNickname: "review-4",
      shellName: "shell-4",
      createAvatar: true,
      clearAvatar: true,
    });
    expect(writes).toContain("avatar: review-4");
    expect(writes).toContain("avatarState: created");
    expect(writes).toContain("runtimeSessionClear: cleared (session:/repo:review-4)");
  });
});
