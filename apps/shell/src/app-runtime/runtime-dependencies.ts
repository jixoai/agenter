import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";
import {
  bootstrapShellRoom,
  type ShellRoomBootstrapInput,
  type ShellRoomBootstrapResult,
} from "./bootstrap";
import { readShellHeartbeatStatus } from "./heartbeat-status";
import {
  readShellKeybindings,
  readShellSettings,
  saveShellSettings,
  type ShellKeybindings,
  type ShellSettings,
} from "../app-room/settings";
import {
  startShellNavigationTui,
  type ShellNavigationSelection,
} from "../app-navigation/run-navigation-tui";

import { startShellApp, type ShellAppController, type ShellAppInput } from "../app/shell-app";
import { createPaneSourceId, type PaneSource } from "../renderable-mux/pane-source";
import { ShellLiveTerminalProtocolSource } from "../sources/shell-live-terminal-source";

export type ShellClient = ReturnType<typeof createAgenterClient>;
export type ShellRuntimeStore = ReturnType<typeof createRuntimeStore>;

export interface ShellAppRunDependencies {
  createClient(args: { host: string; port: number; authServiceEndpoint?: string }): ShellClient;
  createStore(client: ShellClient): ShellRuntimeStore;
  bootstrapRoom(input: ShellRoomBootstrapInput): Promise<ShellRoomBootstrapResult>;
  startNavigationTui(input: Parameters<typeof startShellNavigationTui>[0]): Promise<ShellNavigationSelection>;
  startApp(input: ShellAppInput): Promise<ShellAppController>;
  createLiveTerminalSource(input: {
    id: string;
    terminalId: string;
    transportUrl: string;
    initialSnapshot: ShellRoomBootstrapResult["terminal"]["entry"]["snapshot"] | null;
    initialTitle?: string | null;
    configuredTitle?: string | null;
    currentTitle?: string | null;
    readTitle?: () => string | null;
    terminateTerminal?: () => void | Promise<void>;
  }): PaneSource;
  readSettings(): Promise<ShellSettings>;
  saveSettings(settings: ShellSettings): Promise<void>;
  readKeybindings(): Promise<ShellKeybindings>;
  readHeartbeatStatus(input: Parameters<typeof readShellHeartbeatStatus>[0]): Promise<string>;
  stdout: Pick<NodeJS.WriteStream, "write">;
  stdinIsTty(): boolean;
  stdoutIsTty(): boolean;
}

export const defaultShellAppRunDependencies: ShellAppRunDependencies = {
  createClient: (args) =>
    createAgenterClient({
      wsUrl: `ws://${args.host}:${args.port}/trpc`,
    }),
  createStore: (client) => createRuntimeStore(client),
  bootstrapRoom: async (input) => await bootstrapShellRoom(input),
  startNavigationTui: async (input) => {
    const controller = await startShellNavigationTui(input);
    return await controller.finished;
  },
  startApp: async (input) => await startShellApp(input),
  createLiveTerminalSource: (input) =>
    new ShellLiveTerminalProtocolSource({
      id: createPaneSourceId(input.id),
      terminalId: input.terminalId,
      transportUrl: input.transportUrl,
      initialSnapshot: input.initialSnapshot,
      initialTitle: input.initialTitle,
      configuredTitle: input.configuredTitle,
      currentTitle: input.currentTitle,
      readTitle: input.readTitle,
      terminateTerminal: input.terminateTerminal,
      geometryRole: "authority",
    }),
  readSettings: async () => await readShellSettings(),
  saveSettings: async (settings) => await saveShellSettings(settings),
  readKeybindings: async () => await readShellKeybindings(),
  readHeartbeatStatus: async (input) => await readShellHeartbeatStatus(input),
  stdout: process.stdout,
  stdinIsTty: () => process.stdin.isTTY === true,
  stdoutIsTty: () => process.stdout.isTTY === true,
};
