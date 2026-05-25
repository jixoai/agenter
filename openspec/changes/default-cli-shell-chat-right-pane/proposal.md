## Why

cli-shell is a mouse-first TUI product for many users, but the current default still behaves like an on-demand Chat popup in several specs and action fallbacks. tmux popups are modal client overlays, so using cover/popup as the default conflicts with the bottom status bar being a reliable clickable control surface.

## What Changes

- Change the built-in cli-shell Chat default layout to a right-side dock pane.
- Open the singleton Chat surface automatically during default tmux attach.
- Keep cover/floating Chat as an explicit titlebar layout request, but document that tmux popup mode captures mouse interaction and status-bar clicks are not a reliable primary control while the popup is active.
- Preserve cli-shell/core separation: this is product TUI presentation behavior only and does not change TerminalSystem, MessageSystem, AvatarRuntime, or authorization truth.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cli-shell-product`: default Chat startup layout, singleton Chat reopen behavior, and tmux popup/status-bar mouse interaction law.

## Impact

- `extensions/cli-shell` tmux host planning, product settings, help text, README, and BDD tests.
- `openspec/specs/cli-shell-product/spec.md` and package durable spec text.
