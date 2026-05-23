import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { isCliShellMetadataOnlyArgv, parseCliShellArgs } from "./argv";
import {
  bootstrapCliShell,
  bootstrapCliShellRoom,
  type CliShellBootstrapInput,
  type CliShellBootstrapResult,
  type CliShellRoomBootstrapInput,
  type CliShellRoomBootstrapResult,
} from "./bootstrap";
import { cleanupCliShellResources, formatCliShellCleanupResult, hasCliShellCleanupFailures } from "./cleanup";
import { readCliShellHeartbeatStatus } from "./heartbeat-status";
import {
  disableCliShellManagedMode,
  enableCliShellManagedMode,
} from "./managed";
import {
  buildCliShellTmuxPlan,
  describeCliShellTmuxAttachment,
  refreshCliShellManagedTmuxStatus,
  resolveCliShellCommandFromArgv,
  runCliShellTmuxAction,
  runCliShellTmuxHost,
  type CliShellTmuxExecutor,
  type CliShellTmuxPlan,
} from "./tmux-host";
import { startCliShellRoomTui } from "./tui/run-cli-shell-room-tui";
import {
  readCliShellKeybindings,
  readCliShellSettings,
  type CliShellKeybindings,
  type CliShellSettings,
} from "./tui/settings";
import { startCliShellTopLayerTui } from "./tui/run-cli-shell-top-tui";
import { startCliShellShellPaneTui } from "./tui/shell-pane-app";

const formatCreatedState = (created: boolean): string => (created ? "created" : "reused");
const formatRuntimeClearState = (sessionIds: readonly string[]): string =>
  sessionIds.length > 0 ? `cleared (${sessionIds.join(", ")})` : "not-cleared";

type CliShellClient = ReturnType<typeof createAgenterClient>;
type CliShellRuntimeStore = ReturnType<typeof createRuntimeStore>;

export interface CliShellRunDependencies {
  createClient(args: ReturnType<typeof parseCliShellArgs>): CliShellClient;
  createStore(client: CliShellClient): CliShellRuntimeStore;
  bootstrap(input: CliShellBootstrapInput): Promise<CliShellBootstrapResult>;
  bootstrapRoom(input: CliShellRoomBootstrapInput): Promise<CliShellRoomBootstrapResult>;
  startRoomTui(input: Parameters<typeof startCliShellRoomTui>[0] & { argv?: readonly string[] }): Promise<void>;
  startTopLayerTui(input: Parameters<typeof startCliShellTopLayerTui>[0] & { argv?: readonly string[] }): Promise<void>;
  startShellPaneTui(input: Parameters<typeof startCliShellShellPaneTui>[0]): Promise<void>;
  readHeartbeatStatus(input: Parameters<typeof readCliShellHeartbeatStatus>[0]): Promise<string>;
  buildTmuxPlan(input: Parameters<typeof buildCliShellTmuxPlan>[0]): CliShellTmuxPlan;
  runTmuxHost(input: {
    plan: CliShellTmuxPlan;
    env?: NodeJS.ProcessEnv;
    executor?: CliShellTmuxExecutor;
  }): Promise<void>;
  refreshManagedTmuxStatus(input: Parameters<typeof refreshCliShellManagedTmuxStatus>[0], managed: boolean): Promise<void>;
  readCliShellSettings?(): Promise<CliShellSettings>;
  readCliShellKeybindings?(): Promise<CliShellKeybindings>;
}

const defaultRunDependencies: CliShellRunDependencies = {
  createClient: (args) =>
    createAgenterClient({
      wsUrl: `ws://${args.host}:${args.port}/trpc`,
    }),
  createStore: (client) => createRuntimeStore(client),
  bootstrap: (input) => bootstrapCliShell(input),
  bootstrapRoom: (input) => bootstrapCliShellRoom(input),
  startRoomTui: async (input) => {
    const controller = await startCliShellRoomTui(input);
    await controller.finished;
  },
  startTopLayerTui: async (input) => {
    const controller = await startCliShellTopLayerTui(input);
    await controller.finished;
  },
  startShellPaneTui: async (input) => {
    const controller = await startCliShellShellPaneTui(input);
    await controller.finished;
  },
  readHeartbeatStatus: async (input) => await readCliShellHeartbeatStatus(input),
  buildTmuxPlan: (input) => buildCliShellTmuxPlan(input),
  runTmuxHost: async (input) => await runCliShellTmuxHost(input),
  refreshManagedTmuxStatus: async (input, managed) => await refreshCliShellManagedTmuxStatus(input, managed),
  readCliShellSettings: async () => await readCliShellSettings(),
  readCliShellKeybindings: async () => await readCliShellKeybindings(),
};

const writeRoomSummary = (attached: CliShellRoomBootstrapResult): void => {
  console.log(`cli-shell room attached`);
  console.log(`avatar: ${attached.avatar.nickname}`);
  console.log(`avatarState: ${formatCreatedState(attached.avatarCreated)}`);
  console.log(`runtimeSessionClear: ${formatRuntimeClearState(attached.clearedRuntimeSessionIds)}`);
  console.log(`runtime: ${attached.avatar.runtimeId}`);
  console.log(`terminal: ${attached.terminal.entry.terminalId} (${formatCreatedState(attached.terminal.created)})`);
  console.log(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})`);
  console.log(`managed: ${attached.managed.managed ? "on" : "off"}`);
  console.log(`source: ${process.env.AGENTER_PRODUCT_SOURCE?.trim() || "direct"}`);
  console.log(`promptSeeded: ${attached.promptSeeded ? "yes" : "no"}`);
  console.log(
    `memorySeeds: ${attached.memoryFiles.map((file) => `${file.path}:${file.created ? "created" : "kept"}`).join(", ") || "none"}`,
  );
};

const buildCliShellTmuxSurfaceId = (shellName: string): string => `tmux:${shellName}`;

const toggleCliShellManagedFromTmuxAction = async (
  input: {
    store: CliShellRuntimeStore;
    workspacePath: string;
    shellName: string;
    avatarNickname: string;
    runtimeSessionId: string;
    tmuxAction: Parameters<typeof refreshCliShellManagedTmuxStatus>[0];
  },
  dependencies: CliShellRunDependencies,
): Promise<void> => {
  const attached = await dependencies.bootstrapRoom({
    store: input.store,
    workspacePath: input.workspacePath,
    avatarNickname: input.avatarNickname,
    shellName: input.shellName,
    createAvatar: false,
    clearAvatar: false,
  });
  const managed = attached.managed.managed;
  const localSurfaceId = buildCliShellTmuxSurfaceId(input.shellName);
  if (managed) {
    await disableCliShellManagedMode({
      store: input.store,
      sessionId: attached.session.id,
      runtimeId: attached.avatar.runtimeId,
      avatarActorId: attached.avatarActorId,
      shellName: input.shellName,
      surfaceId: localSurfaceId,
      terminalId: attached.terminal.entry.terminalId,
      roomId: attached.room.entry.chatId,
      notes: "disabled from cli-shell tmux status bar",
    });
    await dependencies.refreshManagedTmuxStatus(input.tmuxAction, false);
    return;
  }
  await enableCliShellManagedMode({
    store: input.store,
    sessionId: attached.session.id,
    runtimeId: attached.avatar.runtimeId,
    avatarActorId: attached.avatarActorId,
    shellName: input.shellName,
    surfaceId: localSurfaceId,
    terminalId: attached.terminal.entry.terminalId,
    roomId: attached.room.entry.chatId,
    objective: "Continue hosting the current cli-shell terminal session.",
    notes: "enabled from cli-shell tmux status bar",
  });
  await dependencies.refreshManagedTmuxStatus(input.tmuxAction, true);
};

export const runCliShellWithDependencies = async (
  argvInput = process.argv,
  dependencies: CliShellRunDependencies = defaultRunDependencies,
): Promise<void> => {
  const productArgv = argvInput.slice(2);
  if (isCliShellMetadataOnlyArgv(productArgv)) {
    parseCliShellArgs(productArgv);
    return;
  }
  const args = parseCliShellArgs(productArgv);
  if (args.command === "tmux-action") {
    if (args.action === "managed") {
      const client = dependencies.createClient(args);
      try {
        const store = dependencies.createStore(client);
        await toggleCliShellManagedFromTmuxAction(
          {
            store,
            workspacePath: args.workspacePath ?? process.cwd(),
            shellName: args.shellName,
            avatarNickname: args.avatarNickname,
            runtimeSessionId: args.runtimeSessionId,
            tmuxAction: {
              action: args.action,
              shellName: args.shellName,
              avatarNickname: args.avatarNickname,
              runtimeSessionId: args.runtimeSessionId,
              workspacePath: args.workspacePath,
              targetPane: args.targetPane,
              tmux: args.tmux,
              socketName: args.socket,
              cliShellCommand: resolveCliShellCommandFromArgv(argvInput),
              daemonHost: args.host,
              daemonPort: args.port,
              authServiceEndpoint: args.authServiceEndpoint,
            },
          },
          dependencies,
        );
        return;
      } finally {
        client.close();
      }
    }
    await runCliShellTmuxAction({
      action: args.action,
      shellName: args.shellName,
      avatarNickname: args.avatarNickname,
      runtimeSessionId: args.runtimeSessionId,
      workspacePath: args.workspacePath,
      targetPane: args.targetPane,
      tmux: args.tmux,
      socketName: args.socket,
      cliShellCommand: resolveCliShellCommandFromArgv(argvInput),
      daemonHost: args.host,
      daemonPort: args.port,
      authServiceEndpoint: args.authServiceEndpoint,
    });
    return;
  }
  if (args.command === "heartbeat-status") {
    const client = dependencies.createClient(args);
    try {
      const store = dependencies.createStore(client);
      const status = await dependencies.readHeartbeatStatus({
        store,
        runtimeSessionId: args.runtimeSessionId,
        shellName: args.shellName,
      });
      process.stdout.write(`${status}\n`);
      return;
    } finally {
      client.close();
    }
  }
  const client = dependencies.createClient(args);

  try {
    const store = dependencies.createStore(client);
    if (args.command === "cleanup") {
      const result = await cleanupCliShellResources(store, {
        shellName: args.shellName,
        confirm: args.confirm,
        tmux: args.tmux,
      });
      process.stdout.write(formatCliShellCleanupResult(result));
      if (hasCliShellCleanupFailures(result)) {
        process.exitCode = 1;
      }
      return;
    }

    if (args.command === "room") {
      const settings = await (dependencies.readCliShellSettings?.() ?? readCliShellSettings());
      const keybindings = await (dependencies.readCliShellKeybindings?.() ?? readCliShellKeybindings());
      const attached = await dependencies.bootstrapRoom({
        store,
        workspacePath: process.cwd(),
        avatarNickname: args.avatarNickname,
        shellName: args.shellName,
        createAvatar: args.createAvatar,
        clearAvatar: args.clearAvatar,
      });
      if (process.stdin.isTTY && process.stdout.isTTY) {
        await dependencies.startRoomTui({
          store,
          shellName: args.shellName,
          attached,
          settings,
          keybindings,
          env: process.env,
          argv: argvInput,
        });
        return;
      }
      writeRoomSummary(attached);
      return;
    }

    if (args.command === "top") {
      const attached = await dependencies.bootstrapRoom({
        store,
        workspacePath: process.cwd(),
        avatarNickname: args.avatarNickname,
        shellName: args.shellName,
        createAvatar: args.createAvatar,
        clearAvatar: args.clearAvatar,
      });
      if (process.stdin.isTTY && process.stdout.isTTY) {
        await dependencies.startTopLayerTui({
          store,
          shellName: args.shellName,
          attached,
        });
        return;
      }
      console.log(`cli-shell top attached`);
      console.log(`avatar: ${args.avatarNickname}`);
      console.log(`terminal: ${attached.terminal.entry.terminalId}`);
      console.log(`tmux: ${args.shellName}`);
      return;
    }

    if (args.command === "shell") {
      const attached = await dependencies.bootstrapRoom({
        store,
        workspacePath: process.cwd(),
        avatarNickname: args.avatarNickname,
        shellName: args.shellName,
        createAvatar: args.createAvatar,
        clearAvatar: args.clearAvatar,
      });
      if (process.stdin.isTTY && process.stdout.isTTY) {
        await dependencies.startShellPaneTui({
          attached,
        });
        return;
      }
      console.log(`cli-shell shell attached`);
      console.log(`avatar: ${args.avatarNickname}`);
      console.log(`runtime: ${attached.avatar.runtimeId}`);
      console.log(`terminal: ${attached.terminal.entry.terminalId} (${formatCreatedState(attached.terminal.created)})`);
      console.log(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})`);
      console.log(`managed: ${attached.managed.managed ? "on" : "off"}`);
      return;
    }

    const attached = await dependencies.bootstrap({
      store,
      workspacePath: process.cwd(),
      avatarNickname: args.avatarNickname,
      shellName: args.shellName,
      createAvatar: args.createAvatar,
      clearAvatar: args.clearAvatar,
    });
    const settings = await (dependencies.readCliShellSettings?.() ?? readCliShellSettings());
    const plan = dependencies.buildTmuxPlan({
      shellName: args.shellName,
      avatarNickname: args.avatarNickname,
      workspacePath: process.cwd(),
      runtimeSessionId: attached.session.id,
      cliShellCommand: resolveCliShellCommandFromArgv(argvInput),
      tmux: args.tmux,
      daemonHost: args.host,
      daemonPort: args.port,
      authServiceEndpoint: args.authServiceEndpoint,
      managed: attached.managed.managed,
      chatDefaultLayout: settings.chat.defaultLayout,
      heartbeatStatus: await dependencies.readHeartbeatStatus({
        store,
        runtimeSessionId: attached.session.id,
        shellName: args.shellName,
      }),
    });
    console.log(describeCliShellTmuxAttachment({ attached, plan }));
    await dependencies.runTmuxHost({
      plan,
      env: process.env,
    });
  } finally {
    client.close();
  }
};

export const runCliShell = async (argvInput = process.argv): Promise<void> => {
  await runCliShellWithDependencies(argvInput, defaultRunDependencies);
};
