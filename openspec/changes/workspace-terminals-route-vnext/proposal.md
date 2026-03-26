## Why

The workspace shell currently exposes only `Chat / Devtools / Settings`, even though terminal work is a first-class runtime surface and the codebase already has a reusable `TerminalPanel`. Hiding terminals inside secondary tooling increases navigation cost and keeps the shell misaligned with the multi-terminal mental model.

## What Changes

- Add a dedicated top-level `Terminals` workspace route alongside `Chats`, `Devtools`, and `Settings`.
- Rename the top navigation label from `Chat` to `Chats` so it reflects multi-channel chat rather than a single transcript.
- Reuse the existing terminal panel/runtime contract that currently sits behind secondary tooling instead of rebuilding a separate terminal surface.
- Keep terminal-specific notices and actions inside the route body rather than pushing them into the top header.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `webui-chat-navigation`: the workspace shell route set and top tabs now include `Chats` and a dedicated `Terminals` route.
- `webui-terminal-surface`: the terminal surface becomes a first-class workspace route instead of living only inside a secondary systems/tooling panel.

## Impact

- Affected code: `packages/webui/src/router.tsx`, `packages/webui/src/features/shell/*`, `packages/webui/src/features/terminal/*`, related stories/tests
- Affected UX: workspace top tabs, route labels, route ownership, mobile and desktop shell navigation
