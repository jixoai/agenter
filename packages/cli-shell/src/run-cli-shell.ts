import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { isCliShellMetadataOnlyArgv, parseCliShellArgs } from "./argv";
import {
  bootstrapCliShell,
  type CliShellBootstrapInput,
  type CliShellBootstrapResult,
  type CliShellProductHostStore,
} from "./bootstrap";
import { CLI_SHELL_HEARTBEAT_COPY } from "./tui/heartbeat";
import type { CliShellStartupTuiController } from "./tui/startup-shell-tui";
import type { CliShellTuiController } from "./tui/run-cli-shell-tui";
import type { CliShellObservationReadyBaseline, CliShellTuiStore } from "./tui/types";
import type { CliShellWebHostController } from "./web";

const formatCreatedState = (created: boolean): string => (created ? "created" : "reused");

type CliShellClient = ReturnType<typeof createAgenterClient>;
type CliShellRuntimeStore = ReturnType<typeof createRuntimeStore>;

export interface CliShellRunDependencies {
  createClient(args: ReturnType<typeof parseCliShellArgs>): CliShellClient;
  createStore(client: CliShellClient): CliShellRuntimeStore;
  bootstrap(input: CliShellBootstrapInput): Promise<CliShellBootstrapResult>;
  loadStartupTui(): Promise<{
    startCliShellStartupTui(input: {
      shellName: string;
      heartbeat: string;
    }): Promise<CliShellStartupTuiController>;
  }>;
  loadCliShellTui(): Promise<{
    startCliShellTui(input: {
      store: CliShellTuiStore;
      shellName: string;
      attached: CliShellBootstrapResult;
      observationReadyBaseline?: CliShellObservationReadyBaseline | null;
      preconnected?: boolean;
      debug?: boolean;
      experimentalDynamicRefresh?: boolean;
    }): Promise<CliShellTuiController>;
  }>;
  loadCliShellWebHost(): Promise<{
    startCliShellWebHost(input: {
      store: CliShellProductHostStore;
      shellName?: string;
      attached: CliShellBootstrapResult;
      requestedPort: number;
      debug?: boolean;
      experimentalDynamicRefresh?: boolean;
    }): Promise<CliShellWebHostController>;
  }>;
  isInteractive(): boolean;
}

const defaultRunDependencies: CliShellRunDependencies = {
  createClient: (args) =>
    createAgenterClient({
      wsUrl: `ws://${args.host}:${args.port}/trpc`,
    }),
  createStore: (client) => createRuntimeStore(client),
  bootstrap: (input) => bootstrapCliShell(input),
  loadStartupTui: async () => await import("./tui/startup-shell-tui"),
  loadCliShellTui: async () => await import("./tui/run-cli-shell-tui"),
  loadCliShellWebHost: async () => await import("./web"),
  isInteractive: () => Boolean(process.stdout.isTTY && process.stdin.isTTY),
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
  const client = dependencies.createClient(args);
  let activeTui: { finished: Promise<void>; destroy(): void } | null = null;
  let activeWebHost: CliShellWebHostController | null = null;

  try {
    const store = dependencies.createStore(client);
    const startupTui = dependencies.isInteractive() && args.webPort === undefined
      ? await (await dependencies.loadStartupTui()).startCliShellStartupTui({
          shellName: args.shellName,
          heartbeat: CLI_SHELL_HEARTBEAT_COPY.disconnected,
        })
      : null;
    if (startupTui) {
      activeTui = startupTui;
    }

    const attached = await dependencies.bootstrap({
      store,
      workspacePath: process.cwd(),
      avatarNickname: args.avatarNickname,
      shellName: args.shellName,
      backend: args.backend,
      onProgress: (phase) => {
        if (phase === "observation-pending") {
          startupTui?.setHeartbeat(CLI_SHELL_HEARTBEAT_COPY.observationPending);
        }
      },
    });

    if (args.webPort !== undefined) {
      activeWebHost = await (await dependencies.loadCliShellWebHost()).startCliShellWebHost({
        store,
        shellName: args.shellName,
        attached,
        requestedPort: args.webPort,
        debug: args.debug,
        experimentalDynamicRefresh: args.experimentalDynamicRefresh,
      });
      console.log(`cli-shell attached`);
      console.log(`avatar: ${attached.avatar.nickname}`);
      console.log(`runtime: ${attached.avatar.runtimeId}`);
      console.log(
        `shellTruthTerminal: ${attached.shellTruthTerminal.entry.terminalId} (${formatCreatedState(attached.shellTruthTerminal.created)})`,
      );
      console.log(
        `visibleTerminal: ${attached.visibleTerminal.entry.terminalId} (${formatCreatedState(attached.visibleTerminal.created)})`,
      );
      console.log(`backend: ${attached.shellTruthTerminal.entry.backend}`);
      console.log(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})`);
      console.log(`managed: ${attached.managed.managed ? "on" : "off"}`);
      console.log(`source: ${process.env.AGENTER_PRODUCT_SOURCE?.trim() || "direct"}`);
      console.log(`promptSeeded: ${attached.promptSeeded ? "yes" : "no"}`);
      console.log(
        `memorySeeds: ${attached.memoryFiles.map((file) => `${file.path}:${file.created ? "created" : "kept"}`).join(", ") || "none"}`,
      );
      console.log(`web: ${activeWebHost.url}`);
      await activeWebHost.finished;
      return;
    }

    if (startupTui) {
      await store.connect();
      await store.hydrateSessionArtifacts(attached.session.id, {
        includeChatHistory: false,
        observabilityMode: "heartbeat",
      });
      const runtime = store.getState().runtimes[attached.session.id];
      const observationReadyBaseline: CliShellObservationReadyBaseline = {
        version: runtime?.schedulerSignals.terminal.version ?? 0,
        timestamp: runtime?.schedulerSignals.terminal.timestamp ?? null,
      };
      startupTui.destroy();
      activeTui = null;
      const { startCliShellTui } = await dependencies.loadCliShellTui();
      activeTui = await startCliShellTui({
        store,
        shellName: args.shellName,
        attached,
        observationReadyBaseline,
        preconnected: true,
        debug: args.debug,
        experimentalDynamicRefresh: args.experimentalDynamicRefresh,
      });
      await activeTui.finished;
      return;
    }

    console.log(`cli-shell attached`);
    console.log(`avatar: ${attached.avatar.nickname}`);
    console.log(`runtime: ${attached.avatar.runtimeId}`);
    console.log(
      `shellTruthTerminal: ${attached.shellTruthTerminal.entry.terminalId} (${formatCreatedState(attached.shellTruthTerminal.created)})`,
    );
    console.log(
      `visibleTerminal: ${attached.visibleTerminal.entry.terminalId} (${formatCreatedState(attached.visibleTerminal.created)})`,
    );
    console.log(`backend: ${attached.shellTruthTerminal.entry.backend}`);
    console.log(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})`);
    console.log(`managed: ${attached.managed.managed ? "on" : "off"}`);
    console.log(`source: ${process.env.AGENTER_PRODUCT_SOURCE?.trim() || "direct"}`);
    console.log(`promptSeeded: ${attached.promptSeeded ? "yes" : "no"}`);
    console.log(
      `memorySeeds: ${attached.memoryFiles.map((file) => `${file.path}:${file.created ? "created" : "kept"}`).join(", ") || "none"}`,
    );
  } finally {
    activeTui?.destroy();
    await activeWebHost?.stop();
    client.close();
  }
};

export const runCliShell = async (argvInput = process.argv): Promise<void> => {
  await runCliShellWithDependencies(argvInput, defaultRunDependencies);
};
