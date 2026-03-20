## Why

Real workspace sessions still need a final hardening pass after the conversation-first Chat rewrite. The current surface can regress under long persisted histories, pagination, virtualization, and real-session runtime churn, which means the product is still less reliable in real workspaces than it appears in mocked or short-session tests.

## What Changes

- Audit and harden the real-session Chat data path from session hydration through message pagination, virtualization, and notification consumption.
- Add explicit behavior contracts for long-history Chat rendering so persisted messages, optimistic turns, streamed replies, and prepended older pages remain visible and stable in the same viewport.
- Tighten session-local publication and hydration rules so opening one real session does not require broad shell rerenders and does not leave the Chat route with stale or missing message data.
- Expand browser-based validation around desktop and mobile real-session walkthroughs, with evidence for Quick Start resume, long Chat histories, notification consumption, and attachment-bearing turns.
- **BREAKING**: none. This change stabilizes existing behavior and contracts rather than introducing a new user-facing surface.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `chat-surface-presentation`: Chat must remain visible and stable for real persisted histories, virtualized rows, prepended pagination, and optimistic/streaming turns.
- `session-notifications`: unread consumption must continue to reflect the visible assistant reply boundary even when Chat history is paged and virtualized.
- `runtime-ui-publication`: session hydration and hot runtime updates must stay scoped so real-session Chat routes receive the facts they need without destabilizing unrelated shell chrome.

## Impact

- Affected code will primarily span `packages/webui`, `packages/client-sdk`, and `packages/app-server`.
- Validation will expand across Vitest unit tests, Storybook DOM tests, Playwright desktop/mobile runs, and real-session walkthrough evidence.
- No public API shape is expected to change, but runtime selector, pagination, and viewport behavior will be tightened.
