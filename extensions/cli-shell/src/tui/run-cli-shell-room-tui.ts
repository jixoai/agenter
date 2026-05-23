import type { CliRenderer } from "@opentui/core";

import type { CliShellRoomBootstrapResult } from "../bootstrap";
import {
  defaultCliShellSettings,
  saveCliShellSettings,
  type CliShellKeybindings,
  type CliShellSettings,
} from "./settings";
import {
  CLI_SHELL_TMUX_SOCKET_NAME,
  resolveCliShellCommandFromArgv,
  runCliShellTmuxAction,
} from "../tmux-host";
import { startCliShellRoomApp } from "./room-app";
import type { CliShellRoomAppStore, CliShellRoomLayoutMode, CliShellRoomLayoutRequestResult } from "./room-app";

export interface CliShellRoomTuiController {
  finished: Promise<void>;
  destroy(): void;
}

type CliShellRoomSurfaceKind = "popup" | "pane";

export const startCliShellRoomTui = async (input: {
  store: CliShellRoomAppStore & { connect(): Promise<void>; disconnect(): void };
  shellName: string;
  attached: CliShellRoomBootstrapResult;
  settings?: CliShellSettings;
  keybindings?: CliShellKeybindings;
  renderer?: CliRenderer;
  env?: NodeJS.ProcessEnv;
  argv?: readonly string[];
}): Promise<CliShellRoomTuiController> => {
  let done = false;
  let resolveFinished = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  let activeApp: Awaited<ReturnType<typeof startCliShellRoomApp>>["app"] | null = null;
  const env = input.env ?? process.env;
  let currentSettings = input.settings ?? defaultCliShellSettings();
  const targetPane = env.AGENTER_CLI_SHELL_TMUX_TARGET_PANE?.trim();
  const sourceSurface: CliShellRoomSurfaceKind = env.AGENTER_CLI_SHELL_TMUX_SURFACE?.trim() === "pane" ? "pane" : "popup";
  const onLayoutRequest =
    targetPane && targetPane.length > 0
      ? async (mode: CliShellRoomLayoutMode): Promise<CliShellRoomLayoutRequestResult> => {
          const daemonPort = env.AGENTER_DAEMON_PORT ? Number(env.AGENTER_DAEMON_PORT) : undefined;
          const result = await runCliShellTmuxAction({
            action: `layout-${mode}`,
            shellName: env.AGENTER_CLI_SHELL_TMUX_SESSION?.trim() || input.shellName,
            avatarNickname: input.attached.avatar.nickname,
            runtimeSessionId: input.attached.session.id,
            targetPane,
            tmux: env.AGENTER_CLI_SHELL_TMUX ?? "tmux",
            socketName: env.AGENTER_CLI_SHELL_TMUX_SOCKET?.trim() || CLI_SHELL_TMUX_SOCKET_NAME,
            cliShellCommand: resolveCliShellCommandFromArgv(input.argv ?? process.argv),
            daemonHost: env.AGENTER_DAEMON_HOST,
            daemonPort: Number.isFinite(daemonPort) ? daemonPort : undefined,
            authServiceEndpoint: env.AGENTER_AUTH_SERVICE_ENDPOINT,
          });
          if (!result.ok) {
            throw new Error(`layout ${mode} failed: ${result.reason}`);
          }
          const nextSettings: CliShellSettings = {
            ...currentSettings,
            chat: {
              ...currentSettings.chat,
              defaultLayout: mode,
            },
          };
          currentSettings = nextSettings;
          await saveCliShellSettings(nextSettings).catch(() => undefined);
          const closeCurrentSurface =
            mode === "cover" ? true : sourceSurface === "popup" ? true : result.closeCurrentSurface !== false;
          return { closeCurrentSurface };
        }
      : undefined;
  const onTopLayerRequest =
    targetPane && targetPane.length > 0
      ? async (): Promise<void> => {
          const daemonPort = env.AGENTER_DAEMON_PORT ? Number(env.AGENTER_DAEMON_PORT) : undefined;
          await runCliShellTmuxAction({
            action: "top",
            shellName: env.AGENTER_CLI_SHELL_TMUX_SESSION?.trim() || input.shellName,
            avatarNickname: input.attached.avatar.nickname,
            runtimeSessionId: input.attached.session.id,
            targetPane,
            tmux: env.AGENTER_CLI_SHELL_TMUX ?? "tmux",
            socketName: env.AGENTER_CLI_SHELL_TMUX_SOCKET?.trim() || CLI_SHELL_TMUX_SOCKET_NAME,
            cliShellCommand: resolveCliShellCommandFromArgv(input.argv ?? process.argv),
            daemonHost: env.AGENTER_DAEMON_HOST,
            daemonPort: Number.isFinite(daemonPort) ? daemonPort : undefined,
            authServiceEndpoint: env.AGENTER_AUTH_SERVICE_ENDPOINT,
          });
        }
      : undefined;

  const destroy = () => {
    if (done) {
      return;
    }
    done = true;
    activeApp?.dispose();
    input.store.disconnect();
    resolveFinished();
  };

  try {
    await input.store.connect();
    const { app } = await startCliShellRoomApp({
      store: input.store,
      shellName: input.shellName,
      attached: input.attached,
      settings: currentSettings,
      keybindings: input.keybindings,
      renderer: input.renderer,
      onQuit: destroy,
      onLayoutRequest,
      onTopLayerRequest,
    });
    activeApp = app;
  } catch (error) {
    destroy();
    throw error;
  }

  return {
    finished,
    destroy,
  };
};
