## Why

The new Svelte `Messages` route is a simplified rewrite that lost the shared chat component, live transcript behavior, and the professional operator layout. Sending a room message often looks like it does nothing because the page is not driven by room-level subscriptions.

## What Changes

- Rebuild the `Messages` route around a shared chat surface instead of a simplified local transcript renderer.
- Migrate `@agenter/web-chat-view` from React to a Svelte custom element so it can be reused by operator-webui and future user-webui.
- Add room-level live subscriptions for catalog, transcript, grants, focus, and read-state updates.
- Restore a professional three-column room surface with room list, transcript/composer, and a dedicated users/access sidebar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `message-system-surface`: the message-system route must behave as a live operator surface instead of a polling transcript page
- `web-chat-view`: the shared chat component must be provided as a Svelte custom element while preserving its room transport contract

## Impact

- `packages/web-chat-view` package implementation and exports
- `packages/app-server` room-level live event subscriptions
- `packages/client-sdk` room state normalization and subscription-backed updates
- `packages/webui` `Messages` route and supporting operator sidebar/dialog components
