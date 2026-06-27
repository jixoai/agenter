## Why

Current cli-shell room and shell-pane behavior still has a few app-critical regressions:

- the shell cursor can drift again in the tmux + shell-pane path even though the older native projection law already solved the historical `(-1,-1)` offset
- Chat does not remember its default layout in a durable app config
- Room still uses a single-line input instead of a multiline composer
- sending a room message can be reported as failed when the write succeeded but the follow-up refresh failed
- slash-command style composer panels such as `/history` do not exist yet

These are app-surface problems inside `apps/cli-shell`. They should be solved without changing the core boundary law already established by `realign-cli-shell-with-core-system-boundaries`.

## What Changes

- Add a dedicated cli-shell app config surface under `~/.agenter/cli-shell/` with separate `settings.json` and `keybindings.json`.
- Upgrade the Room composer from `InputRenderable` to `TextareaRenderable`.
- Add a small composer host model that supports plain textarea mode, slash-command panel mode, and inline confirm mode.
- Implement `/history` as the first panel-style slash command.
- Persist the Chat default layout and make bottom-bar Chat open/close respect the persisted singleton layout.
- Repair the room send flow so send success and refresh failure are modeled separately.
- Replace shallow cursor source-string tests with runtime projection tests that prove the native hardware cursor still follows the old 0-based logical -> 1-based native law in the current shell-pane path.

## Capabilities

### Modified Capabilities

- `cli-shell-app`: add durable app config, textarea composer, slash-command host, and reliable Chat singleton layout behavior
- `terminal-screen-projection-law`: strengthen the native cursor regression coverage for the extension app path without changing the underlying projection law

## Impact

- `apps/cli-shell/src/tui/*`
- `apps/cli-shell/src/run-cli-shell.ts`
- `apps/cli-shell/src/tmux-host.ts`
- `apps/cli-shell/test/*`
- `openspec/specs/cli-shell-app/spec.md`
