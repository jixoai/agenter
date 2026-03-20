## Why

The current WebUI still treats settings as session-owned and keeps most navigation in one large local-state shell. That model no longer matches the product: settings follow a workspace, sessions are runtime instances under that workspace, and background sessions need lightweight unread notifications that survive outside the visible chat view.

## What Changes

- **BREAKING** Move settings inspection and editing from `sessionId` ownership to `workspacePath` ownership so a workspace can be configured before any session is started.
- **BREAKING** Replace the current primary navigation model with a route-driven application shell where the global sidebar only exposes `Quick Start` and `Workspaces`.
- Add a workspace shell with a route-aware header and a bottom navigation that exposes `Chat`, `Devtools`, and `Settings`.
- Add an app-server notification projection for unread assistant replies when a session produces user-facing output outside a visible Chat view.
- Keep effective settings read-only while preserving per-layer editing for each concrete settings source.

## Capabilities

### New Capabilities
- `workspace-settings`: Workspace-scoped settings inspection and editing, including effective merged settings and editable source layers without requiring an active session.
- `session-notifications`: Ephemeral unread session notifications for assistant replies, including unread counts and read-consumption semantics when Chat becomes visible.

### Modified Capabilities
- `webui-chat-navigation`: Replace the old global Chat/Settings navigation with a route-driven workspace shell, workspace-scoped subviews, and updated mobile/desktop navigation behavior.

## Impact

- Affected packages: `@agenter/app-server`, `@agenter/client-sdk`, `@agenter/webui`
- Affected APIs: TRPC settings routes, runtime/app snapshot surfaces, notification subscription/query surfaces, WebUI navigation contracts
- Affected UI systems: sidebar, app header, workspace shell, bottom navigation, settings panel, workspace/session unread badges
