## Why

Recent Svelte WebUI dogfooding exposed three acceptance regressions in the shared system surfaces: empty `message-system` rooms can sit in an infinite loading state, `AsyncSurface` leaks inactive copy into the live DOM, and terminal activity cards collapse user-facing titles into raw tool ids. These issues break real operator trust and also destabilize BDD verification.

## What Changes

- Repair `web-chat-view` so an already-resolved empty room snapshot renders the empty transcript state instead of waiting forever for a websocket snapshot.
- Tighten the Svelte `AsyncSurface` wrapper so only the active state payload is present in light DOM.
- Restore a distinct human-readable action title in terminal activity cards while preserving the raw tool id as secondary metadata.
- Add focused regression coverage in shared package tests for empty room hydration and visible terminal action titles.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-chat-view`: empty resolved room snapshots must terminate the initial loading state.
- `async-surface-states`: inactive async-state payloads must not leak hidden text into the active DOM.
- `terminal-activity-inspector`: action cards must expose a human-readable visible title distinct from the raw tool id.

## Impact

- Affected code: `packages/web-chat-view`, `packages/webui`, and `packages/web-components`.
- Verification: targeted package tests, WebUI typecheck, full WebUI BDD regression, and desktop/mobile browser dogfooding.
