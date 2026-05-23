import { spawn } from "node:child_process";

import type { CliShellBootstrapResult } from "./bootstrap";
import type { CliShellChatDefaultLayout } from "./tui/settings";

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
  tmux?: string;
  socketName?: string;
  cliShellCommand?: readonly string[];
  daemonHost?: string;
  daemonPort?: number;
  authServiceEndpoint?: string;
}

export interface CliShellTmuxActionRuntimeOptions {
  input: CliShellTmuxActionInput;
  executor?: CliShellTmuxExecutor;
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
const CLI_SHELL_TMUX_STATUS_STYLE = "fg=colour252,bg=colour234,nobold,noitalics,nounderscore,noreverse,nodim,noblink";
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
    "--socket",
    quoteShellArg(CLI_SHELL_TMUX_SOCKET_NAME),
    "--tmux",
    quoteShellArg(input.tmux?.trim() || "tmux"),
  ].join(" ");

const activeStatusStyle = (name: string): string =>
  `#{?#{==:#{@agenter_cli_shell_active_action},${name}},#[fg=colour16 bg=colour220 bold],#[fg=colour159 bg=colour234 nobold]}`;

const statusRange = (name: string, label: string): string =>
  `#[range=user|${name}]${activeStatusStyle(name)} ${label} ${CLI_SHELL_TMUX_STATUS_RESET}#[norange]`;

const CLI_SHELL_DEFAULT_HEARTBEAT_STATUS = "◉ 等待 Avatar Heartbeat...";

const buildCliShellStatusLeft = (input: CliShellTmuxPlanInput): string =>
  [
    `${CLI_SHELL_TMUX_STATUS_RESET}#[fg=colour51,bold]cli-shell${CLI_SHELL_TMUX_STATUS_RESET}`,
    `#[fg=colour252]${input.shellName}${CLI_SHELL_TMUX_STATUS_RESET}`,
    `#[fg=colour229]@${input.avatarNickname}${CLI_SHELL_TMUX_STATUS_RESET}`,
    `#[fg=colour159]#{@agenter_cli_shell_heartbeat_status}${CLI_SHELL_TMUX_STATUS_RESET}`,
    statusRange("managed", "managed:#{@agenter_cli_shell_managed}"),
  ].join("  ");

const buildCliShellStatusRight = (): string =>
  [
    statusRange("help", "Help"),
    statusRange("chat", "Chat"),
  ].join("  ");

export const CLI_SHELL_TMUX_HELP_TEXT = [
  "cli-shell controls",
  "",
  "Status bar:",
  "  Click managed:on/off, Help, or Chat in the bottom bar.",
  "  The highlighted item shows the current cli-shell surface.",
  "",
  "Actions:",
  "  managed toggles cli-shell hosting attention for the selected Avatar.",
  "  Help   opens this panel.",
  "  Chat   opens the MessageRoom as a floating popup.",
  "  Hidden expert keys still provide Dock, Mouse, Shell, and Refresh.",
  "",
  "How to press a tmux shortcut:",
  "  Press Ctrl+b, release both keys, then press the next key.",
  "  Example: Ctrl+b, then c opens Chat.",
  "",
  "Keyboard:",
  "  Ctrl+b, then c  open Chat popup",
  "  Ctrl+b, then C  open persistent Chat dock",
  "  Ctrl+b, then m  toggle Mouse",
  "  Ctrl+b, then s  focus shell pane",
  "  Ctrl+b, then r  refresh status bar",
  "  Ctrl+b, then ?  show this help",
  "  Ctrl+b, then [  enter copy-mode for page scroll/search/copy",
  "",
  "Copy-mode:",
  "  PageUp/PageDown or arrow keys scroll",
  "  q exits copy-mode",
  "",
  "Popup:",
  "  Help closes with Enter",
  "  Chat closes with Esc or Ctrl-c",
].join("\n");

const buildHelpShellCommand = (text: string): string =>
  [
    `printf %s ${quoteShellArg(text)}`,
    "printf '\\n\\nPress Enter to close.'",
    "IFS= read -r _",
  ].join("; ");

const buildPopupCommand = (title: string, command: string, targetPane?: string): string[] => [
  "display-popup",
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

const buildHelpPopupCommand = (): string[] =>
  buildPopupCommand("cli-shell-help", buildHelpShellCommand(CLI_SHELL_TMUX_HELP_TEXT));

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
    `${prefix} select-pane -t ${quoteShellArg(input.targetPane)} >/dev/null 2>&1 || true`,
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_surface ${quoteShellArg("none")} >/dev/null 2>&1 || true`,
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_pane ${quoteShellArg("")} >/dev/null 2>&1 || true`,
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_active_action ${quoteShellArg("shell")} >/dev/null 2>&1 || true`,
    `${prefix} refresh-client -S >/dev/null 2>&1 || true`,
  ];
};

const buildRoomShellCommand = (roomCommand: string, cleanupCommands: readonly string[] = []): string =>
  buildInteractiveSurfaceShellCommand("Chat", roomCommand, cleanupCommands);

const buildTopShellCommand = (topCommand: string): string =>
  buildInteractiveSurfaceShellCommand("Top layer", topCommand);

type CliShellChatSurface = "popup" | "pane";

const buildChatPaneDiscoveryShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `chat_pane="$(${prefix} show-options -qv -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_pane 2>/dev/null || true)"`,
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

const buildFocusExistingChatPaneShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `if [ -n "$chat_pane" ]; then ${[
      `${prefix} select-pane -t "$chat_pane"`,
      `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_surface pane`,
      `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_pane "$chat_pane"`,
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
      "chat_pane=\"\"",
    ].join("; ")}; fi`,
  ];
};

const buildSetChatSurfaceShell = (
  input: CliShellTmuxActionInput,
  surface: CliShellChatSurface | "none",
  paneValue: string,
): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_surface ${quoteShellArg(surface)}`,
    `${prefix} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_pane ${paneValue}`,
  ];
};

const buildSetChatDefaultLayoutShell = (
  input: CliShellTmuxActionInput,
  layout: CliShellChatDefaultLayout,
): string[] => [
  `${tmuxShellPrefix(input)} set-option -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_default_layout ${quoteShellArg(layout)}`,
];

const buildRestoreShellIfPopupStillOwnsSurface = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
    `chat_surface="$(${prefix} show-options -qv -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_surface 2>/dev/null || true)"`,
    `if [ "$chat_surface" = "popup" ] || [ -z "$chat_surface" ]; then ${[
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
      ...buildSetActiveActionShell(input, "shell"),
      ...buildRefreshStatusShell(input),
    ].join("; ")}; fi`,
  ];
};

const buildNormalizeStaleChatSurfaceShell = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  return [
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
      `${prefix} display-popup -C >/dev/null 2>&1 || true`,
      ...buildSetChatSurfaceShell(input, "none", quoteShellArg("")),
      ...buildSetActiveActionShell(input, "shell"),
      ...buildRefreshStatusShell(input),
      "exit 0",
    ].join("; ")}; fi`,
    `if [ "$chat_surface" = "pane" ] && [ -n "$chat_pane" ]; then ${[
      ...buildResolveFallbackPaneShell(input),
      `${prefix} kill-pane -t "$chat_pane"`,
      'if [ -n "$fallback_pane" ]; then ' +
        `${prefix} select-pane -t "$fallback_pane" >/dev/null 2>&1 || true; fi`,
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
    `chat_surface="$(${tmuxShellPrefix(input)} show-options -qv -t ${quoteShellArg(input.shellName)} @agenter_cli_shell_chat_surface 2>/dev/null || true)"`,
    ...buildNormalizeStaleChatSurfaceShell(input),
    ...buildCloseVisibleChatSurfaceShell(input),
    ...buildFocusExistingChatPaneShell(input),
    ...buildSetActiveActionShell(input, "chat"),
    ...buildSetChatSurfaceShell(input, "popup", quoteShellArg("")),
    ...buildRefreshStatusShell(input),
    tmuxShellCommand(
      input,
      buildPopupCommand("cli-shell-chat", buildRoomShellCommand(buildTmuxActionRoomCommand(input, "popup")), input.targetPane),
    ),
    ...buildRestoreShellIfPopupStillOwnsSurface(input),
  ].join("; ");

const buildSingleChatPopupCommand = (input: CliShellTmuxActionInput): string[] => ["run-shell", buildChatPopupShell(input)];

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
      ")\"",
    ].join(" "),
    ...buildSetChatSurfaceShell(input, "pane", '"$new_pane"'),
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
    `if [ -n "$chat_pane" ]; then ${[
      `${tmuxShellPrefix(input)} move-pane -d -h ${position === "left" ? "-b " : ""}-s "$chat_pane" -t ${quoteShellArg(input.targetPane)} -l 42%`,
      ...buildSetChatSurfaceShell(input, "pane", '"$chat_pane"'),
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
      ")\"",
    ].join(" "),
    ...buildSetChatSurfaceShell(input, "pane", '"$new_pane"'),
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
    tmuxShellCommand(input, buildPopupCommand("cli-shell-top", buildTopShellCommand(buildTmuxActionTopCommand(input)), input.targetPane)),
    ...buildSetActiveActionShell(input, "shell"),
    ...buildRefreshStatusShell(input),
  ].join("; ");
  return ["run-shell", shell];
};

const buildSwitchChatPopupCommand = (input: CliShellTmuxActionInput): string[] => {
  const shell = [
    ...buildSetChatDefaultLayoutShell(input, "cover"),
    ...buildChatPaneDiscoveryShell(input),
    ...buildKillExistingChatPaneShell(input),
    ...buildSetActiveActionShell(input, "chat"),
    ...buildSetChatSurfaceShell(input, "popup", quoteShellArg("")),
    ...buildRefreshStatusShell(input),
    tmuxShellCommand(
      input,
      buildPopupCommand("cli-shell-chat", buildRoomShellCommand(buildTmuxActionRoomCommand(input, "popup")), input.targetPane),
    ),
    ...buildRestoreShellIfPopupStillOwnsSurface(input),
  ].join("; ");
  return ["run-shell", shell];
};

const buildDefaultChatCommand = (input: CliShellTmuxActionInput): string[] => {
  const prefix = tmuxShellPrefix(input);
  const shell = [
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

const buildActiveActionArgs = (
  actionShellCommand: string,
): string[] => ["run-shell", actionShellCommand];

const buildActiveActionString = (
  activeAction: string,
  command: readonly string[],
  restoreAction = "shell",
): string => joinTmuxSequence(buildActiveActionSequence(activeAction, command, restoreAction));

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

const buildMouseDispatchString = (
  entries: readonly { range: string; command: string }[],
  fallback: string,
): string =>
  entries.reduceRight(
    (nextCommand, entry) =>
      joinTmuxCommand([
        "if-shell",
        "-F",
        `#{==:#{mouse_status_range},${entry.range}}`,
        entry.command,
        nextCommand,
      ]),
    fallback,
  );

const buildMouseStatusDispatchCommand = (actionShellCommand: string): string[] => ["run-shell", actionShellCommand];

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
      [
        ...cliShellCommand,
        "shell",
        `--session=${input.shellName}`,
        `--avatar=${input.avatarNickname}`,
      ],
    ),
  );
  const heartbeatStatus = input.heartbeatStatus?.trim() || CLI_SHELL_DEFAULT_HEARTBEAT_STATUS;
  const statusLeft = buildCliShellStatusLeft(input);
  const statusRight = buildCliShellStatusRight();
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
        args: tmuxArgs([
          "set-option",
          "-t",
          input.shellName,
          "@agenter_cli_shell_heartbeat_status",
          heartbeatStatus,
        ]),
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
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status", "on"]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-position", "bottom"]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-style", CLI_SHELL_TMUX_STATUS_STYLE]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-left-style", CLI_SHELL_TMUX_STATUS_STYLE]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-right-style", CLI_SHELL_TMUX_STATUS_STYLE]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-left", statusLeft]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-left-length", "80"]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-right-length", "120"]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "status-right", statusRight]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "window-status-format", ""]),
        productRole: "status",
      },
      {
        command: tmux,
        args: tmuxArgs(["set-option", "-t", input.shellName, "window-status-current-format", ""]),
        productRole: "status",
      },
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
        args: tmuxArgs(["bind-key", "-T", "root", "MouseDown1Status", ...buildMouseStatusDispatchCommand(clickedActionCommand)]),
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
): CliShellTmuxStep | undefined => plan.steps.find((step) => step.productRole === role && findTmuxCommand(step) === "bind-key");

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
  await waitForChild(command, step.args, { stdio: "ignore" });
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
        ...cliShellCommand,
        "top",
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
  const normalized = action.trim();
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
  await runTmuxActionStep(input, ["set-option", "-t", input.shellName, "@agenter_cli_shell_active_action", action], executor);
  await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
  await runTmuxActionStep(input, command, executor);
  await runTmuxActionStep(
    input,
    ["set-option", "-t", input.shellName, "@agenter_cli_shell_active_action", restoreAction],
    executor,
  );
  await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
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
  const action = normalizeTmuxAction(input.action);
  if (!action) {
    await runTmuxActionStep(input, ["display-message", `cli-shell: unknown action ${input.action}`], executor);
    return { ok: false, action: input.action, reason: "unknown-action" };
  }
  if (action === "help") {
    await runActiveTmuxAction(
      input,
      action,
      buildPopupCommand("cli-shell-help", buildHelpShellCommand(CLI_SHELL_TMUX_HELP_TEXT), input.targetPane),
      "shell",
      executor,
    );
    return { ok: true, action };
  }
  if (action === "chat") {
    await runTmuxActionStep(input, buildDefaultChatCommand(input), executor);
    return { ok: true, action };
  }
  if (action === "pane") {
    await runTmuxActionStep(input, buildSingleChatPaneCommand(input, "right"), executor);
    return { ok: true, action };
  }
  if (action === "layout-left") {
    await runTmuxActionStep(input, buildSwitchChatPaneCommand(input, "left"), executor);
    return { ok: true, action, closeCurrentSurface: false };
  }
  if (action === "layout-right") {
    await runTmuxActionStep(input, buildSwitchChatPaneCommand(input, "right"), executor);
    return { ok: true, action, closeCurrentSurface: false };
  }
  if (action === "layout-cover") {
    await runTmuxActionStep(input, buildSwitchChatPopupCommand(input), executor);
    return { ok: true, action };
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
    await runTmuxActionStep(input, buildHeartbeatRefreshCommand(input, buildTmuxActionHeartbeatStatusCommand(input)), executor);
    await runOptionalTmuxActionStep(input, buildStatusRefreshCommand(), executor);
    return { ok: true, action };
  }
  if (action === "managed") {
    await runTmuxActionStep(input, ["display-message", "cli-shell: managed toggle requires product runtime"], executor);
    return { ok: false, action, reason: "managed-runtime-required" };
  }
  if (action === "shell") {
    await runActiveTmuxAction(
      input,
      action,
      ["select-pane", "-t", input.targetPane],
      "shell",
      executor,
    );
    return { ok: true, action, closeCurrentSurface: true };
  }
  await runActiveTmuxAction(input, action, ["select-pane", "-t", input.targetPane], "shell", executor);
  return { ok: true, action };
};

export const defaultCliShellTmuxExecutor: CliShellTmuxExecutor = {
  async which(command) {
    if (command.includes("/")) {
      return command;
    }
    const path = Bun.which(command);
    return path ?? null;
  },
  async run(step, env) {
    await waitForChild(step.command, step.args, {
      env,
      stdio: step.foreground ? "inherit" : "ignore",
    });
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
