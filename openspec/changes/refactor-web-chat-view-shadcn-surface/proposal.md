## Why

The current Svelte migration preserved room transport behavior but regressed the operator experience and layout discipline. The shared `web-chat-view` is still mostly hand-built DOM/CSS, the `message-system` route drifted away from a chat-first responsive workflow, and feature code started compensating with layout patch classes instead of explicit `flex`/`grid` structure, `ScrollView` ownership, and official shadcn-svelte multipart composition.

## What Changes

- Refactor `@agenter/web-chat-view` into a shadcn-svelte-backed shared conversation surface with a durable transcript/composer shell, responsive metadata placement, and `ScrollView`-owned transcript behavior.
- Rebuild the `message-system` route around one chat-first primary stage, explicit viewer context, and a dedicated room-management dialog/sidebar model that scales from compact to desktop layouts.
- Remove alias-style multipart UI usage in the Svelte WebUI and require official shadcn-svelte composition for shared `Card`, `Tabs`, and related multipart primitives.
- Replace feature-layer layout patch stacks such as compensating card padding and ad hoc overflow ownership with explicit panel shells that use `flex` for linear layout, `grid` for two-dimensional layout, and shared sidebars/dialogs/tabs for responsive secondary content.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `web-chat-view`: upgrade the shared room chat component from hand-built surface markup to a durable shadcn-svelte conversation shell while preserving the transport contract.
- `message-system-surface`: restore a chat-first operator workflow with responsive room management surfaces and canonical viewer/send-as context.
- `svelte-webui-platform`: require official shadcn-svelte multipart composition and responsive primary/secondary shell placement in the active Svelte WebUI.
- `overflow-layout-contract`: tighten the layout contract so feature surfaces derive panel structure from explicit `grid`/`flex` ownership instead of patch classes that compensate for incorrect shell composition.

## Impact

- Affected packages: `packages/web-chat-view`, `packages/webui`
- Affected UI primitives: `card`, `tabs`, route panel shells, responsive sidebars/dialogs, shared `ScrollView`
- Affected routes/surfaces: `Messages`, `Terminals`, `Workspaces`, `History`, `Settings`, running-avatar runtime detail
- Verification: Web chat DOM tests, WebUI DOM/unit tests, targeted Playwright dogfood for `Messages` and system surfaces
