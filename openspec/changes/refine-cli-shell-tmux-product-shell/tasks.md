> Superseded note:
> Treat these completed tasks as historical interaction evidence only.
> Before any future implementation or replay, follow `realign-cli-shell-with-core-system-boundaries` instead of this task list.

## 1. OpenSpec

- [x] 1.1 Write proposal, design, and delta specs for tmux-native app shell behavior.
- [x] 1.2 Validate `refine-cli-shell-tmux-app-shell` with `openspec validate --strict`.

## 2. Tmux App Shell

- [x] 2.1 Add typed tmux app shell status/key/popup/pane plan modeling.
- [x] 2.2 Configure default attach to create one primary shell pane without permanent Chat split.
- [x] 2.3 Add bottom status bar content for cli-shell session, Avatar, clickable managed state, and right-side Help/Chat entries.
- [x] 2.4 Add Chat popup key binding using `tmux display-popup`.
- [x] 2.5 Add explicit Chat pane fallback key binding using `tmux split-window`.
- [x] 2.6 Add shell focus and status refresh key bindings.
- [x] 2.7 Enable Mouse by default for clickable app chrome and keep an explicit Mouse toggle for native text selection.
- [x] 2.8 Add clickable status ranges for managed, Help, and Chat while keeping Dock, Mouse, Shell, and Refresh as expert key bindings.
- [x] 2.9 Add keyboard and click-accessible shortcut help popup.
- [x] 2.10 Isolate cli-shell tmux attach, bindings, and cleanup inside a app-owned socket namespace.
- [x] 2.11 Store app binding context in session-local tmux options so multiple cli-shell sessions do not overwrite each other.
- [x] 2.12 Split status identity/actions and hide tmux window list so mouse actions remain visible.
- [x] 2.13 Keep Chat popup visible with an exit status when the room command exits.
- [x] 2.14 Replace `prefix` wording with explicit `Ctrl+b`, then key guidance.
- [x] 2.15 Reuse the launcher-provided cli-shell command for Chat popup and Dock room commands.
- [x] 2.16 Highlight the active app surface through tmux status styling instead of showing shortcut text in the bottom bar.
- [x] 2.17 Restore the left-side Avatar Heartbeat preview as tmux session-local app status.
- [x] 2.18 Restore the active `room` subcommand as an OpenTUI MessageRoom surface instead of the plain text console fallback.
- [x] 2.19 Fix tmux status conditional styles so style fragments are not leaked as visible `nobold]` text.
- [x] 2.20 Add an OpenTUI Chat titlebar close button.
- [x] 2.21 Route Chat titlebar `◨` / `◧` / `⿴` controls to tmux-owned layout actions instead of OpenTUI self-layout.
- [x] 2.22 Enforce Chat as a tmux session-local singleton surface so existing dock panes are focused instead of duplicated by a popup.
- [x] 2.23 Defer nested tmux formats with `##{...}` inside `run-shell` so pane discovery reads the actual inner tmux pane list.

## 3. Documentation

- [x] 3.1 Update `apps/cli-shell/SPEC.md` with tmux-native app shell law.
- [x] 3.2 Update `apps/cli-shell/README.md` with Chat/status/key behavior.

## 4. Tests

- [x] 4.1 Add BDD tests for status bar configuration.
- [x] 4.2 Add BDD tests proving Chat popup is the default entry.
- [x] 4.3 Add BDD tests proving pane fallback is bound but not executed by default.
- [x] 4.4 Add BDD tests for app key bindings.
- [x] 4.5 Add BDD tests for Mouse default-on behavior, Mouse toggle, and clickable status actions.
- [x] 4.6 Add BDD tests for shortcut help popup content and bindings.
- [x] 4.7 Add BDD tests for tmux socket isolation and session-local binding context.
- [x] 4.8 Add BDD tests for cleanup using the app-owned tmux socket.
- [x] 4.9 Add BDD tests for visible action rail status layout.
- [x] 4.10 Run `bun run --filter 'agenter-app-shell' test`.
- [x] 4.11 Run `bun run --filter 'agenter-app-shell' typecheck`.
- [x] 4.12 Run `bun run --filter 'agenter-app-shell' test` after the app-shell interaction revision.
- [x] 4.13 Run `openspec validate refine-cli-shell-tmux-app-shell --strict` after the app-shell interaction revision.
- [x] 4.14 Run a real tmux smoke for mouse default, status labels, active action option, and Chat command construction.
- [x] 4.15 Add BDD coverage and smoke evidence for Avatar Heartbeat preview in the tmux bottom bar.
- [x] 4.16 Add BDD coverage proving the active Chat popup path uses OpenTUI room code instead of `room-console`.
- [x] 4.17 Add BDD coverage proving managed status clicks toggle hosting attention without touching TerminalSystem.
- [x] 4.18 Add BDD coverage for Chat titlebar close and tmux layout delegation.
- [x] 4.19 Add BDD coverage for focusing an existing Chat dock instead of opening another surface.
- [x] 4.20 Run a real tmux smoke proving an existing Chat pane remains singleton after triggering `Chat`.
- [x] 4.21 Add BDD coverage for moving existing Chat panes left/right without restarting Room.
- [x] 4.22 Add BDD coverage proving Room input uses an OpenTUI cursor-capable input surface.
- [x] 4.23 Add BDD coverage proving terminal approvals are not rendered inside Room.
- [x] 4.24 Add BDD coverage for the independent `shell top` approval surface keyboard and mouse actions.
- [x] 4.25 Add BDD coverage proving managed status clicks route to the runtime managed action.
- [x] 4.26 Implement pane-preserving left/right Chat layout transitions.
- [x] 4.27 Replace Room draft text rendering with an OpenTUI input surface.
- [x] 4.28 Move approval rendering/actions into an independent OpenTUI `shell top` surface.
- [x] 4.29 Wire tmux `top` action and Room pending-approval nudge without embedding approval UI in Room.
- [x] 4.30 Verify `bun run --filter 'agenter-app-shell' test`, `typecheck`, OpenSpec validation, and a real tmux smoke for layout/top/managed interactions.
