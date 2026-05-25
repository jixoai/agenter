## Why

`cli-shell` still lets tmux status clicks and Chat layout controls drift across multiple local surface states, so users can see Help clicks do nothing, duplicate Chat surfaces, stale highlighted status, or Chat disappearing during layout changes. At the same time, Studio terminal routes are exposing killed terminal instances in live terminal navigation even though terminal live/history/archive is already specified as one `terminal_instance` truth with distinct projections.

## What Changes

- **BREAKING**: Tighten `cli-shell` tmux action normalization so status-bar ranges such as `user|help` and `help` resolve to the same product action before execution.
- **BREAKING**: Replace the ad hoc Chat popup/pane open-close sequence with one session-local Chat surface state machine: closed, popup, or pane.
- **BREAKING**: Chat layout controls (`◨`, `◧`, `⿴`) move the singleton Chat surface between tmux containers instead of creating a second Room instance.
- Add a generic `@agenter/tmux-client` package so cli-shell talks to tmux through typed argv-based APIs instead of rebuilding full shell-script command blobs for every state transition.
- Fix status-bar `Chat` so it is a real toggle: closed -> open using saved default layout, open popup/pane -> close exactly that surface and restore shell focus/highlight.
- Fix status-bar `Help` so mouse clicks and `Ctrl+b ?` both open the same Help popup through normalized product actions.
- Fix Studio terminal live navigation so `/terminals/*` live detail/default lists only currently live/running terminal instances.
- Add/finish a terminal history/index projection route where operators can see all `terminal_instance` records: live instances first, then killed instances sorted by killed time.
- Keep terminal history as a projection over the canonical `terminal_instance` table/state, not a second terminal history truth.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-shell-product`: Clarify and enforce singleton Chat surface state, status-click action normalization, and tmux layout switching semantics.
- `terminal-control-plane`: Clarify that live list APIs/projections exclude killed instances while history/archive projections remain queryable from the same terminal instance truth.
- `terminal-system-surface`: Clarify Studio terminal route behavior: live routes default to live instances only, while a history/index page lists live plus killed with stable ordering.

## Impact

- `extensions/cli-shell/src/tmux-host.ts`, `extensions/cli-shell/src/tui/run-cli-shell-room-tui.ts`, related cli-shell tests.
- `packages/tmux-client/**` as a generic tmux SDK with no cli-shell, Avatar, MessageRoom, TerminalSystem, or Studio imports.
- Studio terminal route/store bindings under `packages/studio/src/lib/features/terminals/**` and `/terminals/*` routes.
- TerminalSystem control-plane/runtime-store projection tests where live/history/archive data is exposed to clients.
- OpenSpec and durable specs for cli-shell, terminal control plane, and terminal-system surface.
