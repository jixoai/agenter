## Why

The current Svelte operator shell regressed in two places that break the intended product contract.

- `HelpHint` currently auto-opens on first paint, which turns optional guidance into persistent overlay noise and obscures primary surfaces like `Workspaces` and `Terminals`.
- The `Copy avatar` dialog in `Workspaces` is not implemented as a real submit flow, so the primary action is unreliable and keyboard submission is not supported as a durable contract.

These regressions directly contradict the operator-surface goal of keeping non-critical information quiet while preserving a fast, predictable primary story.

## What Changes

- Make `HelpHint` closed by default and move passive first-visit onboarding behind explicit opt-in.
- Preserve `HelpHint` discoverability so hover, focus, click, and the global `?` shortcut still work without prior dismissal state.
- Convert the workspace avatar copy dialog to a real form submit flow that supports both pointer and keyboard submission.
- Keep optimistic avatar-copy selection stable by snapshotting source/target facts before the mutation path starts.
- Add targeted BDD regression coverage and rerun desktop/mobile dogfood on the repaired flows.

## Capabilities

### Modified Capabilities

- `persistent-help-hints`: passive first-visit onboarding becomes explicit instead of implicit
- `workspace-avatar-management`: avatar copy submission must be keyboard-safe, pointer-safe, and refresh-safe

## Impact

- `packages/web-components`
- `packages/webui`
- `packages/webui/tests/e2e`
