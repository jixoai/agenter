## Shared Import Audit

Shell-next currently reuses these safe cli-shell atoms during incubation:

- `bootstrapCliShellRoom` and bootstrap result types for app resource binding.
- `readCliShellSettings`, `saveCliShellSettings`, `readCliShellKeybindings` for app-local preferences.
- `readCliShellHeartbeatStatus` for daemon-backed runtime status text.
- `startCliShellNavigationTui` for temporary session/avatar selection parity.
- `BackendTerminalFrameRenderable`, `ShellTerminalViewRenderable`, `FrameBufferRenderable`, and `createCliShellLiveTerminalMirror` through terminal projection/live source adapters.
- `cleanupCliShellResources` with a no-op tmux executor for app resource cleanup.

Before shell-next can be declared replacement-ready, these shared atoms must move to a neutral boundary owned by shell-next or a shared package. Shell-next must not depend on legacy `agenter-app-shell` as a runtime package after the final rename.

Rejected imports for shell-next runtime/core:

- `agenter-app-shell/src/tmux-host`
- `agenter-app-shell/src/tmux-statusbar`
- tmux socket, tmux pane, tmux status range, or tmux action dispatch as shell-next runtime truth
