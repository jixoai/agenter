## 1. OpenSpec And Launcher Contract

- [x] 1.1 Create OpenSpec proposal, design, delta specs, and implementation tasks for shell-next product-runtime parity.
- [x] 1.2 Update the `shell2` product descriptor to remain local-only but advertise daemon-backed runtime planes once attach is implemented.
- [x] 1.3 Add launcher tests proving `shell` remains routed to `agenter-ext-shell` and `shell2` remains routed to `agenter-ext-shell-next`.

## 2. Product Bootstrap And Argv

- [x] 2.1 Add shell-next argv parsing for cli-shell-compatible attach flags and command names without importing tmux action behavior.
- [x] 2.2 Add shell-next product runtime dependencies for daemon client/store creation, settings read/write, keybindings read, bootstrap, navigation selection, and app startup.
- [x] 2.3 Implement product attach selection: require explicit session/avatar in non-TTY, otherwise reuse navigation when needed and persist startup settings.
- [x] 2.4 Add tests for attach parsing, non-TTY selection failure, startup selection persistence, and unsupported tmux-only actions.

## 3. Live Terminal Runtime

- [x] 3.1 Add a product-attached shell source that creates `CliShellLiveTerminalProtocolSource` from attached terminal transport data.
- [x] 3.2 Make default `shell2` product attach start from live TerminalSystem transport; keep Local BunPTY available only for explicit local/dev command mode.
- [x] 3.3 Add tests proving attached terminal transport is required and Local BunPTY is not used as attach fallback.

## 4. Product Surfaces

- [x] 4.1 Replace placeholder Chat with a Room-backed OpenTUI surface adapter that can hydrate, render, and send room messages.
- [x] 4.2 Wire shell-next top-layer approvals to real runtime store retain/hydrate/approve/deny APIs.
- [x] 4.3 Wire shell-next statusbar to attached runtime facts and heartbeat summary instead of only local pane counts.
- [x] 4.4 Add tests for Chat send/render, top-layer approval store calls, and statusbar runtime facts.

## 5. Compatibility And Extraction Readiness

- [x] 5.1 Add shell-next command handling for `room/chat`, `top`, `help-panel`, `shell/terminal`, `heartbeat-status`, and `cleanup` where meaningful without tmux.
- [x] 5.2 Add explicit migration errors for tmux-only shell-next actions.
- [x] 5.3 Record shared cli-shell imports that must be extracted before replacement readiness and add a boundary test preventing tmux host imports.

## 6. Verification

- [x] 6.1 Run `openspec validate replace-cli-shell-with-shell-next-product-runtime --strict`.
- [x] 6.2 Run focused shell-next and launcher tests.
- [x] 6.3 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 6.4 Run `git diff --check`.
