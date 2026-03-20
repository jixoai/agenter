## Why

The current workspace shell regressed away from the conversation-first contract: Chat exposes cycle structure again, compact layouts waste the first viewport on secondary chrome, unread counts are amplified by repeated mock replies, and hot runtime updates are pushing too much work through the shell. We need to restore the intended product shape before adding more surface area.

## What Changes

- Rebuild the workspace Chat route around a message-first conversation stream and remove cycle rails, cycle badges, and cycle section headers from the primary Chat reading flow.
- Keep cycle inspection available through explicit advanced actions on chat messages and through the dedicated Devtools route.
- Tighten unread notification behavior so counts reflect real unread assistant replies consumed from the visible Chat viewport instead of inflated route projections or self-triggered mock loops.
- Rebalance workspace shell chrome for desktop and compact layouts so the global header stays passive, workspace context stays compact, and Quick Start keeps the composer and `Start` action in the first mobile viewport.
- Reduce unnecessary shell rerenders during hot session activity by tightening runtime publication and selector boundaries.
- **BREAKING**: runtime chat message projections now carry stable cycle linkage so the UI can navigate from a message to Devtools without using cycle-backed Chat rendering.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-surface-presentation`: Chat becomes strictly message-first again, with cycle access hidden behind advanced actions and optimistic/streaming turn rendering restored.
- `workspace-devtools-surface`: Devtools becomes the only explicit cycle-oriented surface and accepts deep links from Chat messages.
- `session-notifications`: unread counts remain true per-message counts but are consumed from the visible Chat viewport and no longer amplified by repeated mock replies.
- `webui-chat-navigation`: the shell hierarchy, compact header behavior, and Quick Start first-viewport priorities change to keep Chat and startup flows usable on mobile.
- `runtime-ui-publication`: runtime publication becomes more selective so hot session bursts do not rerender unrelated shell chrome.

## Impact

- Affected code spans `packages/app-server`, `packages/client-sdk`, and `packages/webui`.
- Runtime chat message types, unread-consumption logic, E2E mock harness behavior, and route-level UI projections change together.
- Storybook DOM, Playwright desktop/mobile runs, and targeted runtime-store/app-server tests need updates to reflect message-first Chat and tighter unread semantics.
