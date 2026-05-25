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
import { disableCliShellManagedMode, enableCliShellManagedMode } from "./managed";
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
import { startCliShellHelpPanelTui } from "./tui/run-cli-shell-help-panel-tui";
import { startCliShellNavigationTui, type CliShellNavigationSelection } from "./tui/run-cli-shell-navigation-tui";
import { startCliShellRoomTui } from "./tui/run-cli-shell-room-tui";
import { startCliShellTopLayerTui } from "./tui/run-cli-shell-top-tui";
import {
  readCliShellKeybindings,
  readCliShellSettings,
  saveCliShellSettings,
  type CliShellKeybindings,
  type CliShellSettings,
} from "./tui/settings";
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
  startNavigationTui?(input: Parameters<typeof startCliShellNavigationTui>[0]): Promise<CliShellNavigationSelection>;
  startTopLayerTui(input: Parameters<typeof startCliShellTopLayerTui>[0] & { argv?: readonly string[] }): Promise<void>;
  startHelpPanelTui(input: Parameters<typeof startCliShellHelpPanelTui>[0]): Promise<void>;
  startShellPaneTui(input: Parameters<typeof startCliShellShellPaneTui>[0]): Promise<void>;
  readHeartbeatStatus(input: Parameters<typeof readCliShellHeartbeatStatus>[0]): Promise<string>;
  buildTmuxPlan(input: Parameters<typeof buildCliShellTmuxPlan>[0]): CliShellTmuxPlan;
  runTmuxHost(input: {
    plan: CliShellTmuxPlan;
    env?: NodeJS.ProcessEnv;
    executor?: CliShellTmuxExecutor;
  }): Promise<void>;
  refreshManagedTmuxStatus(
    input: Parameters<typeof refreshCliShellManagedTmuxStatus>[0],
    managed: boolean,
  ): Promise<void>;
  readCliShellSettings?(): Promise<CliShellSettings>;
  saveCliShellSettings?(settings: CliShellSettings): Promise<void>;
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
  startNavigationTui: async (input) => {
    const controller = await startCliShellNavigationTui(input);
    return await controller.finished;
  },
  startTopLayerTui: async (input) => {
    const controller = await startCliShellTopLayerTui(input);
    await controller.finished;
  },
  startHelpPanelTui: async (input) => {
    const controller = await startCliShellHelpPanelTui(input);
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
  saveCliShellSettings: async (settings) => await saveCliShellSettings(settings),
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

const ensureCliShellAuthenticated = async (
  store: Pick<CliShellRuntimeStore, "autoLogin" | "setAuthToken" | "getAuthToken">,
): Promise<void> => {
  if (store.getAuthToken()) {
    return;
  }
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`cli-shell auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};

const ensureAttachSelection = async (
  input: {
    args: Extract<ReturnType<typeof parseCliShellArgs>, { command: "attach" }>;
    store: CliShellRuntimeStore;
    settings: CliShellSettings;
    tty: boolean;
  },
  dependencies: CliShellRunDependencies,
): Promise<{
  args: Extract<ReturnType<typeof parseCliShellArgs>, { command: "attach" }>;
  settings: CliShellSettings;
}> => {
  if (input.args.sessionExplicit && input.args.avatarExplicit) {
    return {
      args: input.args,
      settings: input.settings,
    };
  }
  if (!input.tty) {
    throw new Error("cli-shell requires --session and --avatar when stdin/stdout is not a TTY");
  }
  await ensureCliShellAuthenticated(input.store);
  const navigationInput: Parameters<typeof startCliShellNavigationTui>[0] = {
    store: input.store,
    settings: input.settings,
    needsShell: !input.args.sessionExplicit,
    needsAvatar: !input.args.avatarExplicit,
    initialShellName: input.args.sessionExplicit ? input.args.shellName : undefined,
    initialAvatarNickname: input.args.avatarExplicit ? input.args.avatarNickname : undefined,
  };
  const selection = dependencies.startNavigationTui
    ? await dependencies.startNavigationTui(navigationInput)
    : await (
        await startCliShellNavigationTui(navigationInput)
      ).finished;
  const nextArgs = {
    ...input.args,
    shellName: input.args.sessionExplicit ? input.args.shellName : selection.shellName,
    avatarNickname: input.args.avatarExplicit ? input.args.avatarNickname : selection.avatarNickname,
    createAvatar: input.args.createAvatar || selection.createAvatar,
    sessionExplicit: true,
    avatarExplicit: true,
  };
  const nextSettings: CliShellSettings = {
    ...input.settings,
    startup: {
      lastShellName: nextArgs.shellName,
      lastAvatarNickname: nextArgs.avatarNickname,
    },
  };
  await (dependencies.saveCliShellSettings?.(nextSettings) ?? saveCliShellSettings(nextSettings));
  return {
    args: nextArgs,
    settings: nextSettings,
  };
};

const buildSelectedCliShellArgv = (
  argvInput: readonly string[],
  args: Extract<ReturnType<typeof parseCliShellArgs>, { command: "attach" }>,
): readonly string[] => [
  argvInput[0] ?? process.execPath,
  argvInput[1] ?? "agenter-cli-shell",
  `--session=${args.shellName}`,
  `--avatar=${args.avatarNickname}`,
];

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
              targetClient: args.targetClient,
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
      targetClient: args.targetClient,
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
  if (args.command === "help-panel") {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      await dependencies.startHelpPanelTui({
        shellName: args.shellName,
        avatarNickname: args.avatarNickname,
      });
      return;
    }
    console.log(`cli-shell help attached`);
    console.log(`avatar: ${args.avatarNickname}`);
    console.log(`tmux: ${args.shellName}`);
    return;
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

    let attachArgs = args;
    let settings = await (dependencies.readCliShellSettings?.() ?? readCliShellSettings());
    const selection = await ensureAttachSelection(
      {
        args,
        store,
        settings,
        tty: process.stdin.isTTY === true && process.stdout.isTTY === true,
      },
      dependencies,
    );
    attachArgs = selection.args;
    settings = selection.settings;
    const selectedArgv = buildSelectedCliShellArgv(argvInput, attachArgs);
    const attached = await dependencies.bootstrap({
      store,
      workspacePath: process.cwd(),
      avatarNickname: attachArgs.avatarNickname,
      shellName: attachArgs.shellName,
      createAvatar: attachArgs.createAvatar,
      clearAvatar: attachArgs.clearAvatar,
    });
    const nextStartupSettings: CliShellSettings = {
      ...settings,
      startup: {
        lastShellName: attachArgs.shellName,
        lastAvatarNickname: attachArgs.avatarNickname,
      },
    };
    await (dependencies.saveCliShellSettings?.(nextStartupSettings) ?? saveCliShellSettings(nextStartupSettings));
    settings = nextStartupSettings;
    const plan = dependencies.buildTmuxPlan({
      shellName: attachArgs.shellName,
      avatarNickname: attachArgs.avatarNickname,
      workspacePath: process.cwd(),
      runtimeSessionId: attached.session.id,
      cliShellCommand: resolveCliShellCommandFromArgv(selectedArgv),
      tmux: attachArgs.tmux,
      daemonHost: attachArgs.host,
      daemonPort: attachArgs.port,
      authServiceEndpoint: attachArgs.authServiceEndpoint,
      managed: attached.managed.managed,
      chatDefaultLayout: settings.chat.defaultLayout,
      heartbeatStatus: await dependencies.readHeartbeatStatus({
        store,
        runtimeSessionId: attached.session.id,
        shellName: attachArgs.shellName,
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
