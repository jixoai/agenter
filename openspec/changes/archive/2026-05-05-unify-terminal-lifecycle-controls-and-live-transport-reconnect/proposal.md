## Why

The terminal lifecycle surface has drifted into two separate control owners: `page-toolbar` and `terminal-window` titlebar can each trigger bootstrap/kill differently, and the kill flow lacks one durable confirmation contract. At the same time, `kill -> bootstrap` can leave the viewport disconnected when transport discovery stays stable, because the renderer only reacts to URL changes instead of lifecycle truth.

## What Changes

- Unify terminal lifecycle actions behind one route-owned lifecycle action handler that both the page-toolbar and terminal-window titlebar project.
- Require an explicit kill confirmation flow before stopping the live PTY.
- Keep bootstrap as a pure lifecycle action that starts the PTY from the current durable terminal config, rather than turning the lifecycle button into a launch-parameter editor.
- Let terminal surface projection preserve durable transport discovery across stopped state so stop/bootstrap does not require a new websocket URL.
- Let `terminal-view` reconnect when live transport is re-enabled on the same transport URL after a stop/bootstrap cycle.
- Add targeted Storybook and terminal-view regression coverage for kill confirmation and same-URL reconnect.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `terminal-system-surface`: lifecycle actions become route-owned, page-toolbar and titlebar project the same owner, and `kill` requires confirmation.
- `terminal-view-component`: live websocket reconnect must work when lifecycle truth flips from stopped back to running without a transport URL change.
- `terminal-surface-projection`: stopped terminals preserve transport discovery so hosts can hydrate snapshots and later reconnect on the same endpoint.

## Impact

- `packages/webui/src/lib/features/terminals/terminal-system-surface.svelte`
- `packages/webui/src/lib/features/terminals/terminal-page-toolbar-content.svelte`
- `packages/webui/src/lib/features/terminals/terminal-window-surface.svelte`
- `packages/webui/src/lib/components/terminal-view-host.svelte`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.story-harness.svelte`
- `packages/webui/test/storybook/terminal-system-surface.stories.test.ts`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.stories.ts`
- `packages/terminal-view/src/terminal-view-element.ts`
- `packages/terminal-view/test/terminal-view-element.test.ts`
- `openspec/specs/terminal-system-surface/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
- `openspec/specs/terminal-surface-projection/spec.md`
