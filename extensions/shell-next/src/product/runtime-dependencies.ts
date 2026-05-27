import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";
import {
  bootstrapShellNextRoom,
  type ShellNextRoomBootstrapInput,
  type ShellNextRoomBootstrapResult,
} from "./bootstrap";
import { readShellNextHeartbeatStatus } from "./heartbeat-status";
import {
  readShellNextKeybindings,
  readShellNextSettings,
  saveShellNextSettings,
  type ShellNextKeybindings,
  type ShellNextSettings,
} from "../product-room/settings";
import {
  startShellNextNavigationTui,
  type ShellNextNavigationSelection,
} from "../product-navigation/run-navigation-tui";

import { startShellNextApp, type ShellNextAppController, type ShellNextAppInput } from "../app/shell-next-app";
import { createPaneSourceId, type PaneSource } from "../renderable-mux/pane-source";
import { ShellNextLiveTerminalProtocolSource } from "../sources/shell-next-live-terminal-source";

export type ShellNextClient = ReturnType<typeof createAgenterClient>;
export type ShellNextRuntimeStore = ReturnType<typeof createRuntimeStore>;

export interface ShellNextProductRunDependencies {
  createClient(args: { host: string; port: number; authServiceEndpoint?: string }): ShellNextClient;
  createStore(client: ShellNextClient): ShellNextRuntimeStore;
  bootstrapRoom(input: ShellNextRoomBootstrapInput): Promise<ShellNextRoomBootstrapResult>;
  startNavigationTui(input: Parameters<typeof startShellNextNavigationTui>[0]): Promise<ShellNextNavigationSelection>;
  startApp(input: ShellNextAppInput): Promise<ShellNextAppController>;
  createLiveTerminalSource(input: {
    id: string;
    terminalId: string;
    transportUrl: string;
    initialSnapshot: ShellNextRoomBootstrapResult["terminal"]["entry"]["snapshot"] | null;
    initialTitle?: string | null;
    configuredTitle?: string | null;
    currentTitle?: string | null;
    readTitle?: () => string | null;
  }): PaneSource;
  readSettings(): Promise<ShellNextSettings>;
  saveSettings(settings: ShellNextSettings): Promise<void>;
  readKeybindings(): Promise<ShellNextKeybindings>;
  readHeartbeatStatus(input: Parameters<typeof readShellNextHeartbeatStatus>[0]): Promise<string>;
  stdout: Pick<NodeJS.WriteStream, "write">;
  stdinIsTty(): boolean;
  stdoutIsTty(): boolean;
}

export const defaultShellNextProductRunDependencies: ShellNextProductRunDependencies = {
  createClient: (args) =>
    createAgenterClient({
      wsUrl: `ws://${args.host}:${args.port}/trpc`,
    }),
  createStore: (client) => createRuntimeStore(client),
  bootstrapRoom: async (input) => await bootstrapShellNextRoom(input),
  startNavigationTui: async (input) => {
    const controller = await startShellNextNavigationTui(input);
    return await controller.finished;
  },
  startApp: async (input) => await startShellNextApp(input),
  createLiveTerminalSource: (input) =>
    new ShellNextLiveTerminalProtocolSource({
      id: createPaneSourceId(input.id),
      terminalId: input.terminalId,
      transportUrl: input.transportUrl,
      initialSnapshot: input.initialSnapshot,
      initialTitle: input.initialTitle,
      configuredTitle: input.configuredTitle,
      currentTitle: input.currentTitle,
      readTitle: input.readTitle,
      geometryRole: "authority",
    }),
  readSettings: async () => await readShellNextSettings(),
  saveSettings: async (settings) => await saveShellNextSettings(settings),
  readKeybindings: async () => await readShellNextKeybindings(),
  readHeartbeatStatus: async (input) => await readShellNextHeartbeatStatus(input),
  stdout: process.stdout,
  stdinIsTty: () => process.stdin.isTTY === true,
  stdoutIsTty: () => process.stdout.isTTY === true,
};
