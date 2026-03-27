## Why

Chat and Terminal surfaces still expose uneven lifecycle controls. Channel create/edit/delete/focus and terminal create/focus/delete are fragmented across runtime-only assumptions, and Quick Start cannot preconfigure room + terminal bootstrap intent.

## What Changes

- Extend message channel lifecycle with explicit archive-by-token API and optional custom token hints for grant bootstrap flows.
- Extend terminal lifecycle API with list/create/focus/delete procedures that map to control-plane semantics.
- Emit lifecycle attention commits (`source=lifecycle`, score default 0) for chat/terminal admin operations.
- Expose message channel discovery tools to AI (`message_channel_list` / `message_channel_get`) so model dispatch logic can query room metadata before reply.
- Upgrade WebUI chat surface with pre-create metadata dialog, stable metadata form controls, explicit focus/archive actions, and protected `chat-main` behavior.
- Upgrade WebUI terminal surface with explicit create/focus/delete controls and advanced create options.
- Upgrade Quick Start with room-config + terminal-config entry actions and workspace-local persistence for defaults.

## Capabilities

### Modified
- `chat-channel-metadata-admin`
- `terminal-control-plane`
- `workspace-chat-surface`
- `client-runtime-store`

### Added
- `quickstart-workspace-bootstrap`

## Impact

- Affected packages: `message-system`, `app-server`, `settings`, `client-sdk`, `webui`.
- Verification: targeted backend tests + Storybook DOM contracts for chat/terminal/quickstart lifecycle flows.
