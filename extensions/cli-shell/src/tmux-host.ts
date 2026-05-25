import { spawn } from "node:child_process";

import {
  buildTmuxStatusBarMouseBinding,
  defaultTmuxExecutor,
  readTmuxStatusUserRangeId,
  TmuxClient,
  TmuxCommandError,
  type TmuxExecutor,
  type TmuxPane,
} from "@agenter/tmux-client";

import type { CliShellBootstrapResult } from "./bootstrap";
import { buildCliShellStatusBarOptionCommands, CLI_SHELL_TMUX_STATUS_STYLE } from "./tmux-statusbar";
import type { CliShellChatDefaultLayout } from "./tui/settings";
import { CLI_SHELL_HELP_PANEL_TEXT } from "./tui/help-panel-content";

export interface CliShellTmuxPlanInput {
  shellName: string;
  avatarNickname: string;
  workspacePath: string;
  runtimeSessionId?: string;
  tmux?: string;
  shellCommand?: readonly string[];
  cliShellCommand?: readonly string[];
  daemonHost?: string;
  daemonPort?: number;
  authServiceEndpoint?: string;
  managed?: boolean;
  heartbeatStatus?: string;
  chatDefaultLayout?: CliShellChatDefaultLayout;
}

export interface CliShellTmuxActionInput {
  action: string;
  shellName: string;
  avatarNickname: string;
  runtimeSessionId?: string;
  workspacePath?: string;
  targetPane: string;
  targetClient?: string;
  tmux?: string;
  socketName?: string;
  cliShellCommand?: readonly string[];
  daemonHost?: string;
  daemonPort?: number;
  authServiceEndpoint?: string;
  sourceSurface?: CliShellChatSurface;
}

export interface CliShellTmuxActionRuntimeOptions {
  input: CliShellTmuxActionInput;
  executor?: CliShellTmuxExecutor;
  tmuxExecutor?: TmuxExecutor;
}

export type CliShellTmuxActionResult =
  | {
      ok: true;
      action:
        | "help"
        | "chat"
        | "pane"
        | "mouse"
        | "shell"
        | "refresh"
        | "managed"
        | "top"
        | "layout-left"
        | "layout-right"
        | "layout-cover";
      closeCurrentSurface?: boolean;
    }
  | { ok: false; action: string; reason: string };

export interface CliShellTmuxStep {
  command: string;
  args: string[];
  optional?: boolean;
  foreground?: boolean;
  productRole?: CliShellTmuxStepRole;
}

export type CliShellTmuxStepRole =
  | "session-probe"
  | "shell-pane"
  | "session-option"
  | "status"
  | "mouse"
  | "mouse-toggle"
  | "help-popup"
  | "chat-popup"
  | "chat-pane"
  | "focus-shell"
  | "refresh-status"
  | "mouse-dispatch"
  | "attach";

export interface CliShellTmuxPlan {
  sessionName: string;
  tmux: string;
  socketName: string;
  steps: CliShellTmuxStep[];
}

export interface CliShellTmuxExecutor {
  which(command: string): Promise<string | null>;
  run(step: CliShellTmuxStep, env?: NodeJS.ProcessEnv): Promise<void>;
}

export interface CliShellTmuxRuntimeOptions {
  plan: CliShellTmuxPlan;
  env?: NodeJS.ProcessEnv;
  executor?: CliShellTmuxExecutor;
}

const quoteShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

const joinShellCommand = (command: readonly string[]): string => command.map(quoteShellArg).join(" ");

const quoteTmuxArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

const joinTmuxCommand = (command: readonly string[]): string => command.map(quoteTmuxArg).join(" ");
const deferNestedTmuxFormat = (value: string): string => value.replace(/#\{/g, "##{");

export const CLI_SHELL_TMUX_SOCKET_NAME = "agenter-cli-shell";
const CLI_SHELL_TMUX_STATUS_RESET = `#[${CLI_SHELL_TMUX_STATUS_STYLE}]`;
const CLI_SHELL_TMUX_STATUS_ACTIVE = "#[fg=colour16,bg=colour220,bold]";

const tmuxSocketArgs = (socketName: string, args: readonly string[]): string[] => ["-L", socketName, ...args];

const tmuxArgs = (args: readonly string[]): string[] => tmuxSocketArgs(CLI_SHELL_TMUX_SOCKET_NAME, args);

const tmuxActionArgs = (input: CliShellTmuxActionInput, args: readonly string[]): string[] =>
  tmuxSocketArgs(input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME, args);

export const resolveCliShellCommandFromArgv = (scriptArgv: readonly string[] = process.argv): readonly string[] => {
  const executable = scriptArgv[0]?.trim() || process.execPath;
  const scriptPath = scriptArgv[1]?.trim();
  if (scriptPath && scriptPath !== executable) {
    return [executable, scriptPath];
  }
  return [executable];
};

const withDaemonEnv = (input: CliShellTmuxPlanInput, command: readonly string[]): readonly string[] => {
  const envPairs = [
    input.daemonHost ? `AGENTER_DAEMON_HOST=${input.daemonHost}` : null,
    input.daemonPort !== undefined ? `AGENTER_DAEMON_PORT=${String(input.daemonPort)}` : null,
    input.authServiceEndpoint ? `AGENTER_AUTH_SERVICE_ENDPOINT=${input.authServiceEndpoint}` : null,
  ].filter((value): value is string => Boolean(value));
  if (envPairs.length === 0) {
    return command;
  }
  return ["env", ...envPairs, ...command];
};

const findTmuxCommandIndex = (step: CliShellTmuxStep): number =>
  step.args.findIndex((arg) => !arg.startsWith("-") && arg !== CLI_SHELL_TMUX_SOCKET_NAME);

const findTmuxCommand = (step: CliShellTmuxStep): string | undefined => {
  const commandIndex = findTmuxCommandIndex(step);
  return commandIndex >= 0 ? step.args[commandIndex] : undefined;
};

const findTmuxCommandArg = (step: CliShellTmuxStep, offset: number): string | undefined => {
  const commandIndex = findTmuxCommandIndex(step);
  return commandIndex >= 0 ? step.args[commandIndex + offset] : undefined;
};

const buildTmuxActionShellCommand = (
  input: CliShellTmuxPlanInput,
  cliShellCommand: readonly string[],
  action: string,
): string =>
  [
    "env",
    `AGENTER_DAEMON_HOST=#{q:@agenter_cli_shell_daemon_host}`,
    `AGENTER_DAEMON_PORT=#{q:@agenter_cli_shell_daemon_port}`,
    `AGENTER_AUTH_SERVICE_ENDPOINT=#{q:@agenter_cli_shell_auth_service_endpoint}`,
    ...cliShellCommand.map(quoteShellArg),
    "tmux-action",
    "--action",
    action,
    "--session",
    "#{q:session_name}",
    "--avatar",
    "#{q:@agenter_cli_shell_avatar}",
    "--runtime-session-id",
    "#{q:@agenter_cli_shell_runtime_session_id}",
    "--workspace-path",
    "#{q:@agenter_cli_shell_workspace_path}",
    "--target-pane",
    "#{q:pane_id}",
    "--target-client",
    "#{q:client_name}",
    "--socket",
    quoteShellArg(CLI_SHELL_TMUX_SOCKET_NAME),
    "--tmux",
    quoteShellArg(input.tmux?.trim() || "tmux"),
  ].join(" ");

const CLI_SHELL_DEFAULT_HEARTBEAT_STATUS = "◉ 等待 Avatar Heartbeat...";

export const CLI_SHELL_TMUX_HELP_TEXT = CLI_SHELL_HELP_PANEL_TEXT;

const buildPopupCommand = (title: string, command: string, targetPane?: string, targetClient?: string): string[] => [
  "display-popup",
  ...(targetClient ? ["-c", targetClient] : []),
  ...(targetPane ? ["-t", targetPane] : []),
  "-E",
  "-w",
  "80%",
  "-h",
  "80%",
  "-T",
  title,
  command,
];

const tmuxShellPrefix = (input: CliShellTmuxActionInput): string =>
  `${quoteShellArg(input.tmux?.trim() || "tmux")} -L ${quoteShellArg(input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME)}`;

const tmuxShellCommand = (input: CliShellTmuxActionInput, args: readonly string[]): string =>
  `${tmuxShellPrefix(input)} ${args.map(quoteShellArg).join(" ")}`;

const buildClosePopupCommand = (input: CliShellTmuxActionInput): string[] => [
  "display-popup",
  ...(input.targetClient ? ["-c", input.targetClient] : []),
  "-C",
];

const buildInteractiveSurfaceShellCommand = (
  surfaceName: string,
  surfaceCommand: string,
  cleanupCommands: readonly string[] = [],
): string =>
  [
    "set +e",
    surfaceCommand,
    "code=$?",
    'if [ "$code" -ne 0 ]; then',
    `printf '\\n\\n${surfaceName} exited unexpectedly (exit %s). Press Enter to close.' "$code"`,
    "IFS= read -r _",
    "fi",
    ...cleanupCommands,
    'exit "$code"',
  ].join("; ");

const buildPaneExitCleanupCommands = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    'current_chat_pane="${TMUX_PANE:-}"',
    `chat_owner="$(${prefix} show-options -qv -t ${quoteShellArg(input.shellName)} ${CHAT_OWNER_OPTION} 2>/dev/null || true)"`,
    `if [ -n "$current_chat_pane" ]; then ${[
      `${prefix} select-pane -t ${quoteShellArg(input.targetPane)} >/dev/null 2>&1 || true`,
      `if [ "$chat_owner" = "$current_chat_pane" ]; then ${[
        `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_SURFACE_OPTION} ${quoteShellArg("none")} >/dev/null 2>&1 || true`,
        `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_PANE_OPTION} ${quoteShellArg("")} >/dev/null 2>&1 || true`,
        `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_OWNER_OPTION} ${quoteShellArg("")} >/dev/null 2>&1 || true`,
        `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_active_action ${quoteShellArg("shell")} >/dev/null 2>&1 || true`,
        `${prefix} refresh-client -S >/dev/null 2>&1 || true`,
      ].join("; ")}; fi`,
      `${prefix} kill-pane -t "$current_chat_pane" >/dev/null 2>&1 || true`,
    ].join("; ")}; fi`,
  ];
};

const buildRoomShellCommand = (roomCommand: string, cleanupCommands: readonly string[] = []): string =>
  buildInteractiveSurfaceShellCommand("Chat", roomCommand, cleanupCommands);

const buildHelpShellCommand = (helpCommand: string, cleanupCommands: readonly string[] = []): string =>
  buildInteractiveSurfaceShellCommand("Help", helpCommand, cleanupCommands);

const buildTopShellCommand = (topCommand: string): string =>
  buildInteractiveSurfaceShellCommand("Top layer", topCommand);

type CliShellChatSurface = "popup" | "pane";
type CliShellChatSurfaceState = CliShellChatSurface | "none";
type CliShellRoomLayoutAction = "layout-left" | "layout-right" | "layout-cover";

const CHAT_SURFACE_OPTION = "@agenter_cli_shell_chat_surface";
const CHAT_PANE_OPTION = "@agenter_cli_shell_chat_pane";
const CHAT_OWNER_OPTION = "@agenter_cli_shell_chat_owner";

const buildChatPaneDiscoveryShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `chat_pane="$(${prefix} show-options -qv -t ${quoteShellArg(input.shellName)} ${CHAT_PANE_OPTION} 2>/dev/null || true)"`,
    `if [ -n "$chat_pane" ] && ! ${prefix} display-message -p -t "$chat_pane" '${deferNestedTmuxFormat("#{pane_id}")}' >/dev/null 2>&1; then chat_pane=""; fi`,
    [
      `if [ -z "$chat_pane" ]; then chat_pane="$(${prefix}`,
      "list-panes",
      "-t",
      quoteShellArg(input.shellName),
      "-F",
      quoteShellArg(deferNestedTmuxFormat("#{pane_id}|#{pane_start_command}")),
      "2>/dev/null",
      "| grep -F --",
      quoteShellArg("room"),
      "| grep -F --",
      quoteShellArg("--session"),
      "| grep -F --",
      quoteShellArg(input.shellName),
      "| grep -F --",
      quoteShellArg("--avatar"),
      "| grep -F --",
      quoteShellArg(input.avatarNickname),
      "| head -n 1 | cut -d '|' -f 1)\"",
      "; fi",
    ].join(" "),
    `if [ -n "$chat_pane" ] && ! ${prefix} display-message -p -t "$chat_pane" '${deferNestedTmuxFormat("#{pane_id}")}' >/dev/null 2>&1; then chat_pane=""; fi`,
  ];
};

const buildSetActiveActionShell = (input: CliShellTmuxActionInput, action: "chat" | "shell"): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_active_action ${quoteShellArg(action)}`,
  ];
};

const buildRefreshStatusShell = (input: CliShellTmuxActionInput): string[] => [
  `${tmuxShellPrefix(input)} refresh-client -S >/dev/null 2>&1 || true`,
];

const buildHelpPopupExitCleanupCommands = (
  input: CliShellTmuxActionInput,
  restoreAction: "chat" | "shell",
): string[] => [
  ...buildSetActiveActionShell(input, restoreAction),
  ...buildRefreshStatusShell(input),
];

const buildFocusExistingChatPaneShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `if [ -n "$chat_pane" ]; then ${[
      `${prefix} select-pane -t "$chat_pane"`,
      ...buildSetChatSurfaceShell(input, "pane", '"$chat_pane"', '"$chat_pane"'),
      ...buildSetActiveActionShell(input, "chat"),
      ...buildRefreshStatusShell(input),
      `${prefix} display-message ${quoteShellArg("cli-shell Chat pane focused")}`,
      "exit 0",
    ].join("; ")}; fi`,
  ];
};

const buildKillExistingChatPaneShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `if [ -n "$chat_pane" ] && [ "$chat_pane" != ${quoteShellArg(input.targetPane)} ]; then ${[
      `${prefix} kill-pane -t "$chat_pane"`,
      'chat_pane=""',
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
    ].join("; ")}; fi`,
  ];
};

const buildKillContradictoryPopupPaneShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `if [ "$chat_surface" = "popup" ] && [ -n "$chat_pane" ]; then ${[
      `${prefix} kill-pane -t "$chat_pane"`,
      'chat_pane=""',
      `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_PANE_OPTION} ${quoteShellArg("")}`,
      `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_OWNER_OPTION} ${quoteShellArg("popup")}`,
    ].join("; ")}; fi`,
  ];
};

const buildSetChatSurfaceShell = (
  input: CliShellTmuxActionInput,
  surface: CliShellChatSurfaceState,
  paneValue: string,
  ownerValue = quoteShellArg(""),
): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_SURFACE_OPTION} ${quoteShellArg(surface)}`,
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_PANE_OPTION} ${paneValue}`,
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} ${CHAT_OWNER_OPTION} ${ownerValue}`,
  ];
};

const buildSetChatDefaultLayoutShell = (
  input: CliShellTmuxActionInput,
  layout: CliShellChatDefaultLayout,
): string[] => [
  `${tmuxShellPrefix(input)} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_default_layout ${quoteShellArg(layout)}`,
];

const buildReadChatSurfaceShell = (input: CliShellTmuxActionInput): string[] => [
  `chat_surface="$(${tmuxShellPrefix(input)} show-options -qv -t ${quoteShellArg(input.shellName)} ${CHAT_SURFACE_OPTION} 2>/dev/null || true)"`,
  `if [ -z "$chat_surface" ]; then chat_surface="none"; fi`,
];

const buildRestoreShellIfPopupStillOwnsSurface = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    ...buildReadChatSurfaceShell(input),
    `chat_owner="$(${prefix} show-options -qv -t ${quoteShellArg(input.shellName)} ${CHAT_OWNER_OPTION} 2>/dev/null || true)"`,
    `if [ "$chat_surface" = "popup" ] && [ "$chat_owner" = "popup" ]; then ${[
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
      ...buildSetActiveActionShell(input, "shell"),
      ...buildRefreshStatusShell(input),
    ].join("; ")}; fi`,
  ];
};

const buildPopupExitCleanupCommands = (input: CliShellTmuxActionInput): string[] =>
  buildRestoreShellIfPopupStillOwnsSurface(input);

const buildNormalizeStaleChatSurfaceShell = (input: CliShellTmuxActionInput): string[] => {
  return [
    'if [ "$chat_surface" = "none" ] || [ -z "$chat_surface" ]; then if [ -n "$chat_pane" ]; then chat_surface="pane"; fi; fi',
    `if [ "$chat_surface" = "pane" ] && [ -z "$chat_pane" ]; then ${[
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
      ...buildSetActiveActionShell(input, "shell"),
      ...buildRefreshStatusShell(input),
    ].join("; ")}; fi`,
  ];
};

const buildResolveFallbackPaneShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `fallback_pane="$(${prefix} list-panes -t ${quoteShellArg(input.shellName)} -F ${quoteShellArg(deferNestedTmuxFormat("#{pane_id}"))} 2>/dev/null | grep -vFx "$chat_pane" | head -n 1)"`,
  ];
};

const buildCloseVisibleChatSurfaceShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `if [ "$chat_surface" = "popup" ]; then ${[
      `${tmuxShellCommand(input, buildClosePopupCommand(input))} >/dev/null 2>&1 || true`,
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
      ...buildSetActiveActionShell(input, "shell"),
      ...buildRefreshStatusShell(input),
      "exit 0",
    ].join("; ")}; fi`,
    `if [ "$chat_surface" = "pane" ] && [ -n "$chat_pane" ]; then ${[
      ...buildResolveFallbackPaneShell(input),
      `${prefix} kill-pane -t "$chat_pane"`,
      'if [ -n "$fallback_pane" ]; then ' + `${prefix} select-pane -t "$fallback_pane" >/dev/null 2>&1 || true; fi`,
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
      ...buildSetActiveActionShell(input, "shell"),
      ...buildRefreshStatusShell(input),
      "exit 0",
    ].join("; ")}; fi`,
  ];
};

const buildChatPopupShell = (input: CliShellTmuxActionInput): string =>
  [
    ...buildChatPaneDiscoveryShell(input),
    ...buildReadChatSurfaceShell(input),
    ...buildNormalizeStaleChatSurfaceShell(input),
    ...buildKillContradictoryPopupPaneShell(input),
    ...buildCloseVisibleChatSurfaceShell(input),
    ...buildSetActiveActionShell(input, "chat"),
    ...buildSetChatSurfaceShell(input, "popup", quoteShellArg(""), quoteShellArg("popup")),
    ...buildRefreshStatusShell(input),
    tmuxShellCommand(
      input,
      buildPopupCommand(
        "cli-shell-chat",
        buildRoomShellCommand(buildTmuxActionRoomCommand(input, "popup")),
        input.targetPane,
        input.targetClient,
      ),
    ),
    ...buildRestoreShellIfPopupStillOwnsSurface(input),
  ].join("; ");

const buildSingleChatPopupCommand = (input: CliShellTmuxActionInput): string[] => [
  "run-shell",
  buildChatPopupShell(input),
];

const buildChatPaneShell = (input: CliShellTmuxActionInput, position: "left" | "right"): string =>
  [
    ...buildChatPaneDiscoveryShell(input),
    ...buildFocusExistingChatPaneShell(input),
    [
      `new_pane="$(${tmuxShellPrefix(input)}`,
      "split-window",
      "-P",
      "-F",
      quoteShellArg("#{pane_id}"),
      "-t",
      quoteShellArg(input.targetPane),
      "-h",
      ...(position === "left" ? ["-b"] : []),
      "-c",
      quoteShellArg("#{pane_current_path}"),
      "-l",
      "42%",
      quoteShellArg(
        buildRoomShellCommand(buildTmuxActionRoomCommand(input, "pane"), buildPaneExitCleanupCommands(input)),
      ),
      ')"',
    ].join(" "),
    ...buildSetChatSurfaceShell(input, "pane", '"$new_pane"', '"$new_pane"'),
    ...buildSetActiveActionShell(input, "chat"),
    `${tmuxShellPrefix(input)} select-pane -t "$new_pane"`,
    ...buildRefreshStatusShell(input),
  ].join("; ");

const buildSingleChatPaneCommand = (input: CliShellTmuxActionInput, position: "left" | "right"): string[] => [
  "run-shell",
  buildChatPaneShell(input, position),
];

const buildSwitchChatPaneCommand = (input: CliShellTmuxActionInput, position: "left" | "right"): string[] => {
  const shell = [
    ...buildSetChatDefaultLayoutShell(input, position),
    ...buildChatPaneDiscoveryShell(input),
    ...buildReadChatSurfaceShell(input),
    `if [ "$chat_surface" = "popup" ]; then ${[
      `${tmuxShellCommand(input, buildClosePopupCommand(input))} >/dev/null 2>&1 || true`,
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
    ].join("; ")}; fi`,
    `if [ -n "$chat_pane" ]; then ${[
      `${tmuxShellPrefix(input)} move-pane -d -h ${position === "left" ? "-b " : ""}-s "$chat_pane" -t ${quoteShellArg(input.targetPane)} -l 42%`,
      ...buildSetChatSurfaceShell(input, "pane", '"$chat_pane"', '"$chat_pane"'),
      ...buildSetActiveActionShell(input, "chat"),
      `${tmuxShellPrefix(input)} select-pane -t "$chat_pane"`,
      ...buildRefreshStatusShell(input),
      "exit 0",
    ].join("; ")}; fi`,
    [
      `new_pane="$(${tmuxShellPrefix(input)}`,
      "split-window",
      "-P",
      "-F",
      quoteShellArg("#{pane_id}"),
      "-t",
      quoteShellArg(input.targetPane),
      "-h",
      ...(position === "left" ? ["-b"] : []),
      "-c",
      quoteShellArg("#{pane_current_path}"),
      "-l",
      "42%",
      quoteShellArg(
        buildRoomShellCommand(buildTmuxActionRoomCommand(input, "pane"), buildPaneExitCleanupCommands(input)),
      ),
      ')"',
    ].join(" "),
    ...buildSetChatSurfaceShell(input, "pane", '"$new_pane"', '"$new_pane"'),
    ...buildSetActiveActionShell(input, "chat"),
    `${tmuxShellPrefix(input)} select-pane -t "$new_pane"`,
    ...buildRefreshStatusShell(input),
  ].join("; ");
  return ["run-shell", shell];
};

const buildTopLayerPopupCommand = (input: CliShellTmuxActionInput): string[] => {
  const shell = [
    ...buildSetActiveActionShell(input, "chat"),
    ...buildRefreshStatusShell(input),
    tmuxShellCommand(
      input,
      buildPopupCommand(
        "cli-shell-top",
        buildTopShellCommand(buildTmuxActionTopCommand(input)),
        input.targetPane,
        input.targetClient,
      ),
    ),
    ...buildSetActiveActionShell(input, "shell"),
    ...buildRefreshStatusShell(input),
  ].join("; ");
  return ["run-shell", shell];
};

const buildSwitchChatPopupCommand = (input: CliShellTmuxActionInput): string[] => {
  const shell = [
    ...buildSetChatDefaultLayoutShell(input, "cover"),
    ...buildChatPaneDiscoveryShell(input),
    ...buildReadChatSurfaceShell(input),
    ...buildKillContradictoryPopupPaneShell(input),
    `if [ "$chat_surface" = "popup" ]; then ${[
      ...buildSetActiveActionShell(input, "chat"),
      ...buildRefreshStatusShell(input),
      "exit 0",
    ].join("; ")}; fi`,
    ...buildKillExistingChatPaneShell(input),
    ...buildSetActiveActionShell(input, "chat"),
    ...buildSetChatSurfaceShell(input, "popup", quoteShellArg(""), quoteShellArg("popup")),
    ...buildRefreshStatusShell(input),
    tmuxShellCommand(
      input,
      buildPopupCommand(
        "cli-shell-chat",
        buildRoomShellCommand(buildTmuxActionRoomCommand(input, "popup")),
        input.targetPane,
        input.targetClient,
      ),
    ),
    ...buildRestoreShellIfPopupStillOwnsSurface(input),
  ].join("; ");
  return ["run-shell", shell];
};

const buildDefaultChatCommand = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  const shell = [
    ...buildChatPaneDiscoveryShell(input),
    ...buildReadChatSurfaceShell(input),
    ...buildNormalizeStaleChatSurfaceShell(input),
    ...buildCloseVisibleChatSurfaceShell(input),
    `default_layout="$(${prefix} show-options -qv -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_default_layout 2>/dev/null || true)"`,
    `if [ "$default_layout" = "left" ]; then ${buildChatPaneShell(input, "left")}; exit 0; fi`,
    `if [ "$default_layout" = "right" ]; then ${buildChatPaneShell(input, "right")}; exit 0; fi`,
    buildChatPopupShell(input),
  ].join("; ");
  return ["run-shell", shell];
};

const buildStatusRefreshCommand = (): string[] => ["refresh-client", "-S"];

const buildHeartbeatRefreshCommand = (input: CliShellTmuxActionInput, statusCommand: string): string[] => [
  "run-shell",
  [
    `status="$(${statusCommand})"`,
    [
      quoteShellArg(input.tmux?.trim() || "tmux"),
      "-L",
      quoteShellArg(input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME),
      "set-option",
      "-t",
      quoteShellArg(input.shellName),
      "@agenter_cli_shell_heartbeat_status",
      '"$status"',
    ].join(" "),
  ].join("; "),
];

interface CliShellResolvedChatState {
  surface: "closed" | "popup" | "pane";
  paneId: string | null;
}

const createActionTmuxClient = (input: CliShellTmuxActionInput, tmuxExecutor?: TmuxExecutor): TmuxClient =>
  new TmuxClient({
    executable: input.tmux?.trim() || "tmux",
    socketName: input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME,
    executor: tmuxExecutor,
  });

const setTmuxSessionOption = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  name: string,
  value: string,
): Promise<void> => {
  await client.setOption({ target: input.shellName, name, value });
};

const refreshTmuxStatusBestEffort = async (client: TmuxClient): Promise<void> => {
  await client.exec(["refresh-client", "-S"], { allowFailure: true });
};

const setCliShellActiveAction = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  action: "chat" | "help" | "shell" | "pane" | "mouse" | "refresh",
): Promise<void> => {
  await setTmuxSessionOption(client, input, "@agenter_cli_shell_active_action", action);
};

const listCliShellPanes = async (client: TmuxClient, input: CliShellTmuxActionInput): Promise<TmuxPane[]> => {
  try {
    return await client.listPanes({ target: input.shellName });
  } catch {
    return [];
  }
};

const isCliShellRoomPane = (pane: TmuxPane, input: CliShellTmuxActionInput): boolean =>
  pane.startCommand.includes("room") &&
  pane.startCommand.includes("--session") &&
  pane.startCommand.includes(input.shellName) &&
  pane.startCommand.includes("--avatar") &&
  pane.startCommand.includes(input.avatarNickname);

const resolveCliShellChatPaneId = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  storedPaneId: string | null,
): Promise<string | null> => {
  const panes = await listCliShellPanes(client, input);
  if (storedPaneId && panes.some((pane) => pane.paneId === storedPaneId)) {
    return storedPaneId;
  }
  return panes.find((pane) => isCliShellRoomPane(pane, input))?.paneId ?? null;
};

const readCliShellChatState = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
): Promise<CliShellResolvedChatState> => {
  const surfaceOption = (await client.getOption({ target: input.shellName, name: CHAT_SURFACE_OPTION })) ?? "none";
  const storedPaneId = ((await client.getOption({ target: input.shellName, name: CHAT_PANE_OPTION })) ?? "").trim();
  const paneId = await resolveCliShellChatPaneId(client, input, storedPaneId || null);
  if (surfaceOption === "popup") {
    if (paneId) {
      await client.killPane(paneId).catch(() => undefined);
      await setTmuxSessionOption(client, input, CHAT_PANE_OPTION, "");
      await setTmuxSessionOption(client, input, CHAT_OWNER_OPTION, "popup");
    }
    return { surface: "popup", paneId: null };
  }
  if (surfaceOption === "pane" || (!surfaceOption || surfaceOption === "none")) {
    if (paneId) {
      return { surface: "pane", paneId };
    }
  }
  if (surfaceOption === "pane" && !paneId) {
    await setTmuxSessionOption(client, input, CHAT_SURFACE_OPTION, "none");
    await setTmuxSessionOption(client, input, CHAT_PANE_OPTION, "");
    await setTmuxSessionOption(client, input, CHAT_OWNER_OPTION, "");
    await setCliShellActiveAction(client, input, "shell");
    await refreshTmuxStatusBestEffort(client);
  }
  return { surface: "closed", paneId: null };
};

const setCliShellChatSurfaceState = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  state: CliShellResolvedChatState,
): Promise<void> => {
  if (state.surface === "closed") {
    await setTmuxSessionOption(client, input, CHAT_SURFACE_OPTION, "none");
    await setTmuxSessionOption(client, input, CHAT_PANE_OPTION, "");
    await setTmuxSessionOption(client, input, CHAT_OWNER_OPTION, "");
    return;
  }
  if (state.surface === "popup") {
    await setTmuxSessionOption(client, input, CHAT_SURFACE_OPTION, "popup");
    await setTmuxSessionOption(client, input, CHAT_PANE_OPTION, "");
    await setTmuxSessionOption(client, input, CHAT_OWNER_OPTION, "popup");
    return;
  }
  await setTmuxSessionOption(client, input, CHAT_SURFACE_OPTION, "pane");
  await setTmuxSessionOption(client, input, CHAT_PANE_OPTION, state.paneId ?? "");
  await setTmuxSessionOption(client, input, CHAT_OWNER_OPTION, state.paneId ?? "");
};

const selectFallbackPane = async (client: TmuxClient, input: CliShellTmuxActionInput, excludedPaneId: string): Promise<void> => {
  const fallbackPane = (await listCliShellPanes(client, input)).find((pane) => pane.paneId !== excludedPaneId);
  await client.selectPane(fallbackPane?.paneId ?? input.targetPane).catch(() => undefined);
};

const closeCliShellChatPane = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  paneId: string,
): Promise<void> => {
  await selectFallbackPane(client, input, paneId);
  await client.killPane(paneId).catch(() => undefined);
  await setCliShellChatSurfaceState(client, input, { surface: "closed", paneId: null });
  await setCliShellActiveAction(client, input, "shell");
  await refreshTmuxStatusBestEffort(client);
};

const closeCliShellChatPopup = async (client: TmuxClient, input: CliShellTmuxActionInput): Promise<void> => {
  await client.closePopup({ targetClient: input.targetClient }).catch(() => undefined);
  await setCliShellChatSurfaceState(client, input, { surface: "closed", paneId: null });
  await setCliShellActiveAction(client, input, "shell");
  await refreshTmuxStatusBestEffort(client);
};

const restoreCliShellChatState = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  state: CliShellResolvedChatState,
): Promise<void> => {
  await setCliShellChatSurfaceState(client, input, state);
  await setCliShellActiveAction(client, input, state.surface === "closed" ? "shell" : "chat");
  await refreshTmuxStatusBestEffort(client);
};

const openCliShellChatPane = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  position: "left" | "right",
): Promise<string> => {
  const paneId = await client.splitPane({
    target: input.targetPane,
    direction: position,
    cwd: "#{pane_current_path}",
    size: "42%",
    command: buildRoomShellCommand(buildTmuxActionRoomCommand(input, "pane"), buildPaneExitCleanupCommands(input)),
  });
  await setCliShellChatSurfaceState(client, input, { surface: "pane", paneId });
  await setCliShellActiveAction(client, input, "chat");
  await client.selectPane(paneId).catch(() => undefined);
  await refreshTmuxStatusBestEffort(client);
  return paneId;
};

const moveCliShellChatPane = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  paneId: string,
  position: "left" | "right",
): Promise<void> => {
  await client.movePane({ source: paneId, target: input.targetPane, direction: position, size: "42%", detached: true });
  await setCliShellChatSurfaceState(client, input, { surface: "pane", paneId });
  await setCliShellActiveAction(client, input, "chat");
  await client.selectPane(paneId).catch(() => undefined);
  await refreshTmuxStatusBestEffort(client);
};

const openCliShellChatPopup = async (
  client: TmuxClient,
  input: CliShellTmuxActionInput,
  mode: "foreground" | "tmux-server" = "foreground",
  rollbackState: CliShellResolvedChatState = { surface: "closed", paneId: null },
): Promise<void> => {
  const command = buildRoomShellCommand(buildTmuxActionRoomCommand(input, "popup"), buildPopupExitCleanupCommands(input));
  await setCliShellChatSurfaceState(client, input, { surface: "popup", paneId: null });
  await setCliShellActiveAction(client, input, "chat");
  await refreshTmuxStatusBestEffort(client);
  try {
    if (mode === "tmux-server") {
      await client.exec([
        "run-shell",
        "-b",
        tmuxShellCommand(input, buildPopupCommand("cli-shell-chat", command, input.targetPane, input.targetClient)),
      ]);
      return;
    }
    await client.displayPopup({
      target: input.targetPane,
      targetClient: input.targetClient,
      title: "cli-shell-chat",
      width: "80%",
      height: "80%",
      closeOnExit: true,
      command,
    });
  } catch (error) {
    await restoreCliShellChatState(client, input, rollbackState);
    throw error;
  }
  await closeCliShellChatPopup(client, input);
};

const runCliShellChatActionWithClient = async (
  input: CliShellTmuxActionInput,
  tmuxExecutor?: TmuxExecutor,
): Promise<CliShellTmuxActionResult> => {
  const client = createActionTmuxClient(input, tmuxExecutor);
  const state = await readCliShellChatState(client, input);
  if (state.surface === "popup") {
    await closeCliShellChatPopup(client, input);
    return { ok: true, action: "chat" };
  }
  if (state.surface === "pane" && state.paneId) {
    await closeCliShellChatPane(client, input, state.paneId);
    return { ok: true, action: "chat" };
  }
  const defaultLayout =
    ((await client.getOption({ target: input.shellName, name: "@agenter_cli_shell_chat_default_layout" })) ??
      "cover") as CliShellChatDefaultLayout;
  if (defaultLayout === "left" || defaultLayout === "right") {
    await openCliShellChatPane(client, input, defaultLayout);
    return { ok: true, action: "chat" };
  }
  await openCliShellChatPopup(client, input);
  return { ok: true, action: "chat" };
};

const runCliShellPaneActionWithClient = async (
  input: CliShellTmuxActionInput,
  tmuxExecutor?: TmuxExecutor,
): Promise<CliShellTmuxActionResult> => {
  const client = createActionTmuxClient(input, tmuxExecutor);
  const state = await readCliShellChatState(client, input);
  if (state.surface === "pane" && state.paneId) {
    await setCliShellChatSurfaceState(client, input, { surface: "pane", paneId: state.paneId });
    await setCliShellActiveAction(client, input, "chat");
    await client.selectPane(state.paneId).catch(() => undefined);
    await refreshTmuxStatusBestEffort(client);
    return { ok: true, action: "pane" };
  }
  if (state.surface === "popup") {
    await closeCliShellChatPopup(client, input);
  }
  await openCliShellChatPane(client, input, "right");
  return { ok: true, action: "pane" };
};

const runCliShellLayoutActionWithClient = async (
  input: CliShellTmuxActionInput,
  layout: CliShellRoomLayoutAction,
  tmuxExecutor?: TmuxExecutor,
): Promise<CliShellTmuxActionResult> => {
  const client = createActionTmuxClient(input, tmuxExecutor);
  const targetDefaultLayout: CliShellChatDefaultLayout =
    layout === "layout-left" ? "left" : layout === "layout-right" ? "right" : "cover";
  await setTmuxSessionOption(client, input, "@agenter_cli_shell_chat_default_layout", targetDefaultLayout);
  const state = await readCliShellChatState(client, input);
  if (layout === "layout-cover") {
    if (state.surface === "pane" && state.paneId) {
      if (input.sourceSurface === "pane") {
        await openCliShellChatPopup(client, input, "tmux-server", state);
        return { ok: true, action: layout, closeCurrentSurface: true };
      }
      await closeCliShellChatPane(client, input, state.paneId);
      await openCliShellChatPopup(client, input);
      return { ok: true, action: layout, closeCurrentSurface: false };
    }
    if (state.surface !== "popup") {
      await openCliShellChatPopup(client, input);
    }
    return { ok: true, action: layout, closeCurrentSurface: false };
  }
  const position = layout === "layout-left" ? "left" : "right";
  if (state.surface === "pane" && state.paneId) {
    await moveCliShellChatPane(client, input, state.paneId, position);
    return { ok: true, action: layout, closeCurrentSurface: false };
  }
  await openCliShellChatPane(client, input, position);
  return { ok: true, action: layout, closeCurrentSurface: input.sourceSurface === "popup" };
};

const joinTmuxSequence = (commands: readonly (readonly string[])[]): string =>
  commands.map((command) => joinTmuxCommand(command)).join(" ; ");

const buildActiveActionSequence = (
  activeAction: string,
  command: readonly string[],
  restoreAction = "shell",
): readonly (readonly string[])[] => [
  ["set-option", "@agenter_cli_shell_active_action", activeAction],
  buildStatusRefreshCommand(),
  command,
  ["set-option", "@agenter_cli_shell_active_action", restoreAction],
  buildStatusRefreshCommand(),
];

const buildActiveActionArgs = (actionShellCommand: string): string[] => ["run-shell", actionShellCommand];

const buildActiveActionString = (activeAction: string, command: readonly string[], restoreAction = "shell"): string =>
  joinTmuxSequence(buildActiveActionSequence(activeAction, command, restoreAction));

const buildMouseToggleCommand = (): string[] => [
  "if-shell",
  "-F",
  "#{==:#{mouse},on}",
  joinTmuxSequence([
    ["set-option", "mouse", "off"],
    ["display-message", "cli-shell Mouse off: native text selection restored; use Ctrl+b then m to re-enable clicks"],
    buildStatusRefreshCommand(),
  ]),
  joinTmuxSequence([
    ["set-option", "mouse", "on"],
    ["display-message", "cli-shell Mouse on: status clicks enabled; native selection is captured by tmux"],
    buildStatusRefreshCommand(),
  ]),
];

export const buildCliShellTmuxPlan = (input: CliShellTmuxPlanInput): CliShellTmuxPlan => {
  const tmux = input.tmux?.trim() || "tmux";
  const cliShellCommand = input.cliShellCommand ?? resolveCliShellCommandFromArgv();
  const helpActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "help");
  const chatActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "chat");
  const paneActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "pane");
  const mouseActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "mouse");
  const shellActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "shell");
  const refreshActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "refresh");
  const clickedActionCommand = buildTmuxActionShellCommand(input, cliShellCommand, "#{q:mouse_status_range}");
  const shellPaneCommand = joinShellCommand(
    withDaemonEnv(
      {
        shellName: input.shellName,
        avatarNickname: input.avatarNickname,
        runtimeSessionId: input.runtimeSessionId,
        workspacePath: input.workspacePath,
        daemonHost: input.daemonHost,
        daemonPort: input.daemonPort,
        authServiceEndpoint: input.authServiceEndpoint,
      },
      [...cliShellCommand, "shell", `--session=${input.shellName}`, `--avatar=${input.avatarNickname}`],
    ),
  );
  const heartbeatStatus = input.heartbeatStatus?.trim() || CLI_SHELL_DEFAULT_HEARTBEAT_STATUS;
  const statusOptionSteps: CliShellTmuxStep[] = buildCliShellStatusBarOptionCommands({
    shellName: input.shellName,
    avatarNickname: input.avatarNickname,
  }).map((command) => ({
    command: tmux,
    args: tmuxArgs(command.args),
    productRole: "status" as const,
  }));
  return {
    sessionName: input.shellName,
    tmux,
    socketName: CLI_SHELL_TMUX_SOCKET_NAME,
    steps: [
      {
        command: tmux,
        args: tmuxArgs(["has-session", "-t", input.shellName]),
        optional: true,
        productRole: "session-probe",
      },
      {
        command: tmux,
        args: tmuxArgs(["new-session", "-d", "-s", input.shellName, "-c", input.workspacePath, shellPaneCommand]),
        optional: true,
        productRole: "shell-pane",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "@agenter_cli_shell_avatar", input.avatarNickname]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "@agenter_cli_shell_workspace_path", input.workspacePath]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_runtime_session_id",
          input.runtimeSessionId ?? "",
        ]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "@agenter_cli_shell_heartbeat_status", heartbeatStatus]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_daemon_host",
          input.daemonHost ?? "127.0.0.1",
        ]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_daemon_port",
          String(input.daemonPort ?? 4580),
        ]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_auth_service_endpoint",
          input.authServiceEndpoint ?? "",
        ]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_managed",
          input.managed ? "on" : "off",
        ]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_chat_default_layout",
          input.chatDefaultLayout ?? "cover",
        ]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "@agenter_cli_shell_active_action", "shell"]),
        productRole: "session-option",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "mouse", "on"]),
        productRole: "mouse",
      },
      ...statusOptionSteps,
      {
        command: tmux,
        args: tmuxArgs(["bind-key", "?", ...buildActiveActionArgs(helpActionCommand)]),
        productRole: "help-popup",
      },
      {
        command: tmux,
        args: tmuxArgs(["bind-key", "c", ...buildActiveActionArgs(chatActionCommand)]),
        productRole: "chat-popup",
      },
      {
        command: tmux,
        args: tmuxArgs(["bind-key", "C", ...buildActiveActionArgs(paneActionCommand)]),
        productRole: "chat-pane",
      },
      {
        command: tmux,
        args: tmuxArgs(["bind-key", "m", ...buildActiveActionArgs(mouseActionCommand)]),
        productRole: "mouse-toggle",
      },
      {
        command: tmux,
        args: tmuxArgs(["bind-key", "s", ...buildActiveActionArgs(shellActionCommand)]),
        productRole: "focus-shell",
      },
      {
        command: tmux,
        args: tmuxArgs(["bind-key", "r", ...buildActiveActionArgs(refreshActionCommand)]),
        productRole: "refresh-status",
      },
      {
        command: tmux,
        args: tmuxArgs(
          buildTmuxStatusBarMouseBinding({
            table: "root",
            command: clickedActionCommand,
            unknownRangeCommand: "display-message cli-shell: ignored status range",
          }),
        ),
        productRole: "mouse-dispatch",
      },
      {
        command: tmux,
        args: tmuxArgs(["select-pane", "-t", `${input.shellName}:0.0`]),
        productRole: "focus-shell",
      },
      {
        command: tmux,
        args: tmuxArgs(["attach-session", "-t", input.shellName]),
        foreground: true,
        productRole: "attach",
      },
    ],
  };
};

export const findCliShellTmuxBinding = (
  plan: CliShellTmuxPlan,
  role: Extract<
    CliShellTmuxStepRole,
    "help-popup" | "chat-popup" | "chat-pane" | "mouse-toggle" | "focus-shell" | "refresh-status"
  >,
): CliShellTmuxStep | undefined =>
  plan.steps.find((step) => step.productRole === role && findTmuxCommand(step) === "bind-key");

export const findCliShellTmuxStatusStep = (plan: CliShellTmuxPlan): CliShellTmuxStep | undefined =>
  plan.steps.find(
    (step) =>
      step.productRole === "status" &&
      findTmuxCommand(step) === "set-option" &&
      findTmuxCommandArg(step, 3) === "status-right",
  );

export const findCliShellTmuxStatusLeftStep = (plan: CliShellTmuxPlan): CliShellTmuxStep | undefined =>
  plan.steps.find(
    (step) =>
      step.productRole === "status" &&
      findTmuxCommand(step) === "set-option" &&
      findTmuxCommandArg(step, 3) === "status-left",
  );

export const findCliShellTmuxMouseStep = (plan: CliShellTmuxPlan): CliShellTmuxStep | undefined =>
  plan.steps.find((step) => step.productRole === "mouse");

export const findCliShellTmuxMouseDispatch = (plan: CliShellTmuxPlan): CliShellTmuxStep | undefined =>
  plan.steps.find((step) => step.productRole === "mouse-dispatch");

export const findCliShellTmuxShellPaneStep = (plan: CliShellTmuxPlan): CliShellTmuxStep | undefined =>
  plan.steps.find((step) => step.productRole === "shell-pane" && findTmuxCommand(step) === "new-session");

export const findCliShellTmuxHelpText = (_plan: CliShellTmuxPlan): string => CLI_SHELL_TMUX_HELP_TEXT;

const waitForChild = async (
  command: string,
  args: readonly string[],
  options: { env?: NodeJS.ProcessEnv; stdio?: "inherit" | "ignore" },
): Promise<void> =>
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], {
      env: options.env,
      stdio: options.stdio ?? "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`));
    });
  });

const extractTmuxSocketAndArgs = (args: readonly string[]): {
  socketName: string | undefined;
  args: readonly string[];
} => {
  if (args[0] === "-L" && typeof args[1] === "string") {
    return {
      socketName: args[1],
      args: args.slice(2),
    };
  }
  return {
    socketName: undefined,
    args,
  };
};

const runTmuxClientStep = async (step: CliShellTmuxStep, env?: NodeJS.ProcessEnv): Promise<void> => {
  const { socketName, args } = extractTmuxSocketAndArgs(step.args);
  const client = new TmuxClient({
    executable: step.command,
    socketName,
    env,
  });
  await client.assertAvailable();
  await client.exec(args);
};

const runTmuxActionStep = async (
  input: CliShellTmuxActionInput,
  args: readonly string[],
  executor?: CliShellTmuxExecutor,
): Promise<void> => {
  const command = input.tmux?.trim() || "tmux";
  const step: CliShellTmuxStep = {
    command,
    args: tmuxActionArgs(input, args),
  };
  if (executor) {
    const tmuxPath = await executor.which(command);
    if (!tmuxPath) {
      throw new Error(`cli-shell tmux action requires tmux: ${command}`);
    }
    await executor.run({ ...step, command: tmuxPath });
    return;
  }
  await runTmuxClientStep(step);
};

const runOptionalTmuxActionStep = async (
  input: CliShellTmuxActionInput,
  args: readonly string[],
  executor?: CliShellTmuxExecutor,
): Promise<void> => {
  try {
    await runTmuxActionStep(input, args, executor);
  } catch {
    // Some tmux status refresh commands fail when no client is attached.
    // The product truth is the session option update; refresh is only a best-effort projection nudge.
  }
};

const isTmuxPopupDismissedError = (error: unknown): boolean =>
  error instanceof TmuxCommandError &&
  error.result.exitCode === 129 &&
  error.command.args.some((arg) => arg === "display-popup");

const buildTmuxActionRoomCommand = (input: CliShellTmuxActionInput, surface: CliShellChatSurface): string => {
  const cliShellCommand = input.cliShellCommand ?? resolveCliShellCommandFromArgv();
  return joinShellCommand(
    withDaemonEnv(
      {
        shellName: input.shellName,
        avatarNickname: input.avatarNickname,
        runtimeSessionId: input.runtimeSessionId,
        workspacePath: "",
        daemonHost: input.daemonHost,
        daemonPort: input.daemonPort,
        authServiceEndpoint: input.authServiceEndpoint,
      },
      [
        "env",
        `AGENTER_CLI_SHELL_TMUX_SESSION=${input.shellName}`,
        `AGENTER_CLI_SHELL_TMUX_SOCKET=${input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME}`,
        `AGENTER_CLI_SHELL_TMUX_TARGET_PANE=${input.targetPane}`,
        ...(input.targetClient ? [`AGENTER_CLI_SHELL_TMUX_TARGET_CLIENT=${input.targetClient}`] : []),
        `AGENTER_CLI_SHELL_TMUX_SURFACE=${surface}`,
        ...cliShellCommand,
        "room",
        `--session=${input.shellName}`,
        `--avatar=${input.avatarNickname}`,
      ],
    ),
  );
};

const buildTmuxActionTopCommand = (input: CliShellTmuxActionInput): string => {
  const cliShellCommand = input.cliShellCommand ?? resolveCliShellCommandFromArgv();
  return joinShellCommand(
    withDaemonEnv(
      {
        shellName: input.shellName,
        avatarNickname: input.avatarNickname,
        runtimeSessionId: input.runtimeSessionId,
        workspacePath: "",
        daemonHost: input.daemonHost,
        daemonPort: input.daemonPort,
        authServiceEndpoint: input.authServiceEndpoint,
      },
      [
        "env",
        `AGENTER_CLI_SHELL_TMUX_SESSION=${input.shellName}`,
        `AGENTER_CLI_SHELL_TMUX_SOCKET=${input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME}`,
        `AGENTER_CLI_SHELL_TMUX_TARGET_PANE=${input.targetPane}`,
        ...(input.targetClient ? [`AGENTER_CLI_SHELL_TMUX_TARGET_CLIENT=${input.targetClient}`] : []),
        ...cliShellCommand,
        "top",
        `--session=${input.shellName}`,
        `--avatar=${input.avatarNickname}`,
      ],
    ),
  );
};

const buildTmuxActionHelpCommand = (input: CliShellTmuxActionInput): string => {
  const cliShellCommand = input.cliShellCommand ?? resolveCliShellCommandFromArgv();
  return joinShellCommand(
    withDaemonEnv(
      {
        shellName: input.shellName,
        avatarNickname: input.avatarNickname,
        runtimeSessionId: input.runtimeSessionId,
        workspacePath: "",
        daemonHost: input.daemonHost,
        daemonPort: input.daemonPort,
        authServiceEndpoint: input.authServiceEndpoint,
      },
      [
        "env",
        `AGENTER_CLI_SHELL_TMUX_SESSION=${input.shellName}`,
        `AGENTER_CLI_SHELL_TMUX_SOCKET=${input.socketName ?? CLI_SHELL_TMUX_SOCKET_NAME}`,
        `AGENTER_CLI_SHELL_TMUX_TARGET_PANE=${input.targetPane}`,
        ...(input.targetClient ? [`AGENTER_CLI_SHELL_TMUX_TARGET_CLIENT=${input.targetClient}`] : []),
        ...cliShellCommand,
        "help-panel",
        `--session=${input.shellName}`,
        `--avatar=${input.avatarNickname}`,
      ],
    ),
  );
};

const buildTmuxActionHeartbeatStatusCommand = (input: CliShellTmuxActionInput): string => {
  const cliShellCommand = input.cliShellCommand ?? resolveCliShellCommandFromArgv();
  return joinShellCommand(
    withDaemonEnv(
      {
        shellName: input.shellName,
        avatarNickname: input.avatarNickname,
        runtimeSessionId: input.runtimeSessionId,
        workspacePath: "",
        daemonHost: input.daemonHost,
        daemonPort: input.daemonPort,
        authServiceEndpoint: input.authServiceEndpoint,
      },
      [
        ...cliShellCommand,
        "heartbeat-status",
        "--session",
        input.shellName,
        "--avatar",
        input.avatarNickname,
        "--runtime-session-id",
        input.runtimeSessionId ?? "",
      ],
    ),
  );
};

type NormalizedTmuxAction =
  | "help"
  | "chat"
  | "pane"
  | "mouse"
  | "shell"
  | "refresh"
  | "managed"
  | "top"
  | "layout-left"
  | "layout-right"
  | "layout-cover";

const normalizeTmuxAction = (action: string): NormalizedTmuxAction | null => {
  const trimmed = action.trim();
  const normalized = trimmed.includes("|")
    ? (() => {
        try {
          return readTmuxStatusUserRangeId(trimmed);
        } catch {
          return null;
        }
      })()
    : trimmed;
  if (
    normalized === "help" ||
    normalized === "chat" ||
    normalized === "pane" ||
    normalized === "mouse" ||
    normalized === "shell" ||
    normalized === "refresh" ||
    normalized === "managed" ||
    normalized === "top" ||
    normalized === "layout-left" ||
    normalized === "layout-right" ||
    normalized === "layout-cover"
  ) {
    return normalized;
  }
  return null;
};

const runActiveTmuxAction = async (
  input: CliShellTmuxActionInput,
  action: "help" | "chat" | "pane" | "mouse" | "shell" | "refresh",
  command: readonly string[],
  restoreAction: "shell" | "pane" = "shell",
  executor?: CliShellTmuxExecutor,
): Promise<void> => {
  await runTmuxActionStep(
    input,
    ["set-option", "-t", input.shellName, "@agenter_cli_shell_active_action", action],
    executor,
  );
  await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
  try {
    await runTmuxActionStep(input, command, executor);
  } catch (error) {
    if (!isTmuxPopupDismissedError(error)) {
      throw error;
    }
  } finally {
    await runTmuxActionStep(
      input,
      ["set-option", "-t", input.shellName, "@agenter_cli_shell_active_action", restoreAction],
      executor,
    );
    await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
  }
};

const runCliShellHelpActionWithClient = async (
  input: CliShellTmuxActionInput,
  tmuxExecutor?: TmuxExecutor,
): Promise<CliShellTmuxActionResult> => {
  const client = createActionTmuxClient(input, tmuxExecutor);
  const chatStateBeforeHelp = await readCliShellChatState(client, input);
  await client.closePopup({ targetClient: input.targetClient }).catch(() => undefined);
  if (chatStateBeforeHelp.surface === "popup") {
    await setCliShellChatSurfaceState(client, input, { surface: "closed", paneId: null });
  }
  const restoreAction = chatStateBeforeHelp.surface === "pane" ? "chat" : "shell";
  const helpCommand = buildHelpShellCommand(
    buildTmuxActionHelpCommand(input),
    buildHelpPopupExitCleanupCommands(input, restoreAction),
  );
  await setCliShellActiveAction(client, input, "help");
  await refreshTmuxStatusBestEffort(client);
  try {
    await client.displayPopup({
      target: input.targetPane,
      targetClient: input.targetClient,
      title: "cli-shell-help",
      width: "80%",
      height: "80%",
      closeOnExit: true,
      command: helpCommand,
    });
  } catch (error) {
    if (!isTmuxPopupDismissedError(error)) {
      throw error;
    }
  } finally {
    await setCliShellActiveAction(client, input, restoreAction);
    await refreshTmuxStatusBestEffort(client);
  }
  return { ok: true, action: "help" };
};

export const refreshCliShellManagedTmuxStatus = async (
  input: CliShellTmuxActionInput,
  managed: boolean,
  executor?: CliShellTmuxExecutor,
): Promise<void> => {
  await runTmuxActionStep(
    input,
    ["set-option", "-t", input.shellName, "@agenter_cli_shell_managed", managed ? "on" : "off"],
    executor,
  );
  await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
  await runTmuxActionStep(input, ["display-message", `cli-shell managed:${managed ? "on" : "off"}`], executor);
};

export const runCliShellTmuxAction = async (
  options: CliShellTmuxActionInput | CliShellTmuxActionRuntimeOptions,
): Promise<CliShellTmuxActionResult> => {
  const input = "input" in options ? options.input : options;
  const executor = "input" in options ? options.executor : undefined;
  const tmuxExecutor = "input" in options ? options.tmuxExecutor : undefined;
  const action = normalizeTmuxAction(input.action);
  if (!action) {
    await runTmuxActionStep(input, ["display-message", `cli-shell: unknown action ${input.action}`], executor);
    return { ok: false, action: input.action, reason: "unknown-action" };
  }
  if (action === "help") {
    if (!executor) {
      return await runCliShellHelpActionWithClient(input, tmuxExecutor);
    }
    await runActiveTmuxAction(
      input,
      action,
      buildPopupCommand("cli-shell-help", buildTmuxActionHelpCommand(input), input.targetPane, input.targetClient),
      "shell",
      executor,
    );
    return { ok: true, action };
  }
  if (action === "chat") {
    if (!executor) {
      return await runCliShellChatActionWithClient(input, tmuxExecutor);
    }
    await runTmuxActionStep(input, buildDefaultChatCommand(input), executor);
    return { ok: true, action };
  }
  if (action === "pane") {
    if (!executor) {
      return await runCliShellPaneActionWithClient(input, tmuxExecutor);
    }
    await runTmuxActionStep(input, buildSingleChatPaneCommand(input, "right"), executor);
    return { ok: true, action };
  }
  if (action === "layout-left") {
    if (!executor) {
      return await runCliShellLayoutActionWithClient(input, action, tmuxExecutor);
    }
    await runTmuxActionStep(input, buildSwitchChatPaneCommand(input, "left"), executor);
    return { ok: true, action, closeCurrentSurface: false };
  }
  if (action === "layout-right") {
    if (!executor) {
      return await runCliShellLayoutActionWithClient(input, action, tmuxExecutor);
    }
    await runTmuxActionStep(input, buildSwitchChatPaneCommand(input, "right"), executor);
    return { ok: true, action, closeCurrentSurface: false };
  }
  if (action === "layout-cover") {
    if (!executor) {
      return await runCliShellLayoutActionWithClient(input, action, tmuxExecutor);
    }
    await runTmuxActionStep(input, buildSwitchChatPopupCommand(input), executor);
    return { ok: true, action, closeCurrentSurface: false };
  }
  if (action === "top") {
    await runTmuxActionStep(input, buildTopLayerPopupCommand(input), executor);
    return { ok: true, action };
  }
  if (action === "mouse") {
    await runTmuxActionStep(input, buildMouseToggleCommand(), executor);
    return { ok: true, action };
  }
  if (action === "refresh") {
    await runTmuxActionStep(
      input,
      buildHeartbeatRefreshCommand(input, buildTmuxActionHeartbeatStatusCommand(input)),
      executor,
    );
    await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
    return { ok: true, action };
  }
  if (action === "managed") {
    await runTmuxActionStep(input, ["display-message", "cli-shell: managed toggle requires product runtime"], executor);
    return { ok: false, action, reason: "managed-runtime-required" };
  }
  if (action === "shell") {
    await runActiveTmuxAction(input, action, ["select-pane", "-t", input.targetPane], "shell", executor);
    return { ok: true, action, closeCurrentSurface: true };
  }
  await runActiveTmuxAction(input, action, ["select-pane", "-t", input.targetPane], "shell", executor);
  return { ok: true, action };
};

export const defaultCliShellTmuxExecutor: CliShellTmuxExecutor = {
  async which(command) {
    return (await defaultTmuxExecutor.which?.(command)) ?? null;
  },
  async run(step, env) {
    if (step.foreground) {
      await waitForChild(step.command, step.args, {
        env,
        stdio: "inherit",
      });
      return;
    }
    await runTmuxClientStep(step, env);
  },
};

export const runCliShellTmuxHost = async (options: CliShellTmuxRuntimeOptions): Promise<void> => {
  const executor = options.executor ?? defaultCliShellTmuxExecutor;
  const tmuxPath = await executor.which(options.plan.tmux);
  if (!tmuxPath) {
    throw new Error(
      "cli-shell requires tmux for the active host. Install tmux or pass --tmux=/path/to/tmux; the old legacy host fallback is intentionally disabled.",
    );
  }
  for (const step of options.plan.steps) {
    const resolvedStep = step.command === options.plan.tmux ? { ...step, command: tmuxPath } : step;
    try {
      await executor.run(resolvedStep, options.env);
    } catch (error) {
      if (!step.optional) {
        throw error;
      }
    }
  }
};

export const describeCliShellTmuxAttachment = (input: {
  attached: CliShellBootstrapResult;
  plan: CliShellTmuxPlan;
}): string =>
  [
    "cli-shell attached",
    `avatar: ${input.attached.avatar.nickname}`,
    `runtime: ${input.attached.avatar.runtimeId}`,
    `room: ${input.attached.room.entry.chatId}`,
    `managed: ${input.attached.managed.managed ? "on" : "off"}`,
    `tmux: ${input.plan.sessionName}`,
  ].join("\n");
