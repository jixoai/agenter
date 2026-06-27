## Context

There are two competing app stories in the existing history:

- Older cli-shell app design expected Chat to sit on the right when enough horizontal space exists.
- Later tmux migration work made Chat popup/on-demand by default to avoid permanent split complexity.

The user's current requirement chooses the first story again: default Chat belongs on the right and should already be open. That is also the better default for mouse-first users because the status bar remains part of the same tmux pane layout instead of being covered by a modal popup mode.

## Decisions

### 1. Default attach opens one right Chat pane

The default cli-shell attach creates or focuses the singleton Room surface as a right dock pane. This is still presentation-local tmux state; MessageRoom truth remains in MessageSystem.

If a matching Room pane already exists for the tmux session and Avatar, attach must focus/reuse that pane instead of creating a duplicate.

### 2. App defaults normalize to dock layouts for attach

`settings.json` still supports `left`, `right`, and `cover` because the Room titlebar has a cover mode. But startup attach must not use cover as the automatic default. If persisted state says `cover`, attach normalizes startup to `right` so the app starts in a clickable, non-modal surface.

### 3. Cover popup is an explicit modal top-layer

tmux documents popups as boxes drawn over panes, and panes are not updated while a popup is present. In a live tmux experiment, status-range clicks wrote `help` in normal pane mode, then stopped writing when a popup was present even though the status bar was still visible. Therefore cover mode cannot promise bottom status-bar mouse controls.

The app law is:

- default and normal Chat work should use the right pane
- cover/floating is an explicit modal/top-layer mode
- while cover is active, close/switch should be done through the Chat titlebar or keyboard flow, not by depending on bottom status-bar clicks

### 4. No core-system changes

This change does not alter TerminalSystem, MessageSystem, AvatarRuntime, AttentionSystem, or app binding truth. tmux remains only the local TUI host.

## Verification Strategy

- BDD unit tests for settings defaults and tmux plan startup.
- BDD action tests proving a missing tmux session option falls back to right pane, not cover popup.
- Help-panel test proving user-facing guidance mentions the popup/status-bar limitation.
- Targeted cli-shell package test and typecheck.
- A local tmux behavior experiment records status click delivery before and during popup mode.
