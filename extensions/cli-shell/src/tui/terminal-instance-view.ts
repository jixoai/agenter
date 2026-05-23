// Product-local adapter over the proven OpenTUI terminal-instance projection stack.
// TerminalSystem still owns terminal truth; cli-shell only mounts this view.
export {
  CLI_SHELL_PRODUCT_DYNAMIC_QUIET_MS,
  createCliShellLiveTerminalMirror,
  type CliShellLiveTerminalMirror,
  type CliShellLiveTerminalPacingOptions,
  type CliShellLiveTerminalTransportSessionFactory,
  type CliShellLiveTerminalTransportSessionInput,
  type CliShellLiveTerminalView,
} from "../../legacy/terminal2/src/tui/live-terminal-mirror";
export {
  BackendTerminalFrameRenderable,
  type BackendTerminalFrameBridge,
  type BackendTerminalFrameOptions,
  type BackendTerminalFrameState,
  type BackendTerminalFrameUpdateResult,
} from "../../legacy/terminal2/src/tui/backend-terminal-frame";
export {
  ShellTerminalViewRenderable,
  type ShellTerminalViewOptions,
  type ShellTerminalViewPermissionProjectionUpdate,
} from "../../legacy/terminal2/src/tui/shell-terminal-view";
